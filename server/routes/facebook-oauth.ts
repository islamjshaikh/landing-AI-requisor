import { Router } from "express";
import { DatabaseStorage } from "../database-storage";
import crypto from "crypto";

const router = Router();
const storage = new DatabaseStorage();

// Facebook App credentials from environment variables
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || "";
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || "";
const APP_DOMAIN = process.env.APP_DOMAIN || "http://localhost:5000";

// Facebook Graph API version
const FB_API_VERSION = "v21.0";

/**
 * Initiate Facebook OAuth flow
 * Redirects user to Facebook's OAuth authorization page
 */
router.get("/facebook", (req: any, res) => {
    try {
        if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
            console.error("Facebook OAuth credentials not configured");
            return res.status(500).json({
                error: "Facebook login not configured. Please contact administrator.",
            });
        }

        // Store the referrer so we can redirect back after authentication
        const returnTo =
            req.query.returnTo || req.get("referer") || "/social-media-agent";
        req.session.facebookOAuthReturnTo = returnTo;

        // Generate a random state parameter for CSRF protection
        const state = crypto.randomBytes(32).toString("hex");
        req.session.facebookOAuthState = state;

        const redirectUri = `${APP_DOMAIN}/api/auth/facebook/callback`;
        const scope =
            "public_profile,pages_manage_posts,pages_read_engagement,pages_show_list"; // Request Page posting permissions

        // Construct Facebook OAuth URL (as per official docs)
        const authUrl =
            `https://www.facebook.com/${FB_API_VERSION}/dialog/oauth?` +
            `client_id=${FACEBOOK_APP_ID}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `state=${state}&` +
            `scope=${scope}&` +
            `response_type=code`;

        console.log(
            `[Facebook OAuth] Redirecting to Facebook for authorization`,
        );
        res.redirect(authUrl);
    } catch (error: any) {
        console.error("[Facebook OAuth] Error initiating OAuth:", error);
        res.status(500).json({ error: "Failed to initiate Facebook login" });
    }
});

/**
 * Handle Facebook OAuth callback
 * Exchanges authorization code for access token and retrieves user profile
 */
router.get("/facebook/callback", async (req: any, res) => {
    try {
        const { code, state } = req.query;

        // Verify state parameter for CSRF protection
        if (!state || state !== req.session.facebookOAuthState) {
            console.error(
                "[Facebook OAuth] State mismatch - possible CSRF attack",
            );
            return res.redirect("/auth?error=facebook_auth_failed");
        }

        // Clear the state from session
        delete req.session.facebookOAuthState;

        if (!code) {
            console.error("[Facebook OAuth] No authorization code received");
            return res.redirect("/auth?error=facebook_auth_failed");
        }

        // Exchange code for access token
        const redirectUri = `${APP_DOMAIN}/api/auth/facebook/callback`;
        const tokenUrl =
            `https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token?` +
            `client_id=${FACEBOOK_APP_ID}&` +
            `client_secret=${FACEBOOK_APP_SECRET}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `code=${code}`;

        console.log(`[Facebook OAuth] Exchanging code for access token`);
        const tokenResponse = await fetch(tokenUrl);

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error("[Facebook OAuth] Token exchange failed:", errorText);
            return res.redirect("/auth?error=facebook_auth_failed");
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Fetch user profile from Facebook Graph API
        const profileUrl = `https://graph.facebook.com/${FB_API_VERSION}/me?fields=id,name,email,first_name,last_name,picture&access_token=${accessToken}`;

        console.log(`[Facebook OAuth] Fetching user profile`);
        const profileResponse = await fetch(profileUrl);

        if (!profileResponse.ok) {
            const errorText = await profileResponse.text();
            console.error("[Facebook OAuth] Profile fetch failed:", errorText);
            return res.redirect("/auth?error=facebook_auth_failed");
        }

        const profile = await profileResponse.json();

        // Exchange for Long-Lived User Access Token (60 days)
        const longLivedTokenUrl =
            `https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token?` +
            `grant_type=fb_exchange_token&` +
            `client_id=${FACEBOOK_APP_ID}&` +
            `client_secret=${FACEBOOK_APP_SECRET}&` +
            `fb_exchange_token=${accessToken}`;

        console.log(`[Facebook OAuth] Exchanging for long-lived token`);
        let finalAccessToken = accessToken;
        let tokenExpiry = null;

        try {
            const longLivedResponse = await fetch(longLivedTokenUrl);
            const longLivedData = await longLivedResponse.json();

            if (longLivedData.access_token) {
                finalAccessToken = longLivedData.access_token;
                // Calculate expiry (usually 60 days)
                if (longLivedData.expires_in) {
                    tokenExpiry = new Date(Date.now() + longLivedData.expires_in * 1000);
                }
                console.log(`[Facebook OAuth] Successfully obtained long-lived token`);
            }
        } catch (error) {
            console.error("[Facebook OAuth] Failed to exchange for long-lived token, using short-lived:", error);
        }

        // Store Facebook access token for later use
        req.session.facebookAccessToken = finalAccessToken;
        req.session.facebookUserId = profile.id;

        // Check if user is already authenticated
        if (req.isAuthenticated()) {
            const currentUser = req.user;
            const userId = currentUser.dbUserId || currentUser.claims.sub;

            console.log(`[Facebook OAuth] Linking account to existing user: ${userId}`);

            // Store Facebook account info in database linked to current user
            await storage.createSocialMediaAccount({
                userId: userId,
                platform: "facebook",
                accountId: profile.id,
                accountName: profile.name || "Facebook User",
                accessToken: finalAccessToken,
                refreshToken: null, // Facebook uses the access token itself for refresh
                tokenExpiresAt: tokenExpiry,
                isActive: true,
            }).catch((error: any) => {
                console.error("[Facebook OAuth] Error linking Facebook account:", error);
            });

            const returnTo = req.session.facebookOAuthReturnTo || "/social-media-agent";
            delete req.session.facebookOAuthReturnTo;

            const separator = returnTo.includes("?") ? "&" : "?";
            return res.redirect(`${returnTo}${separator}linked=facebook`);
        }

        // Not authenticated - proceed with login/signup flow
        let user = await storage.getUserByEmail(profile.email);

        if (!user) {
            // Create new user from Facebook profile
            const userId = crypto.randomUUID();

            // Generate unique username from Facebook ID or name
            const baseUsername =
                profile.first_name?.toLowerCase() || `fb${profile.id}`;
            let username = baseUsername;
            let counter = 1;

            while (await storage.getUserByUsername(username)) {
                username = `${baseUsername}${counter}`;
                counter++;
            }

            user = await storage.createUser({
                id: userId,
                username,
                email: profile.email,
                firstName:
                    profile.first_name || profile.name?.split(" ")[0] || "User",
                lastName:
                    profile.last_name ||
                    profile.name?.split(" ").slice(1).join(" ") ||
                    "",
                profileImageUrl: profile.picture?.data?.url || null,
                emailVerified: true, // Facebook verifies emails
            });

            console.log(`[Facebook OAuth] Created new user: ${user.username}`);
        } else {
            // Update existing user's profile image if they don't have one
            if (!user.profileImageUrl && profile.picture?.data?.url) {
                console.log(
                    `updating esiting user profile image if they have one`,
                );
            }
            console.log(
                `[Facebook OAuth] Existing user logged in: ${user.username}`,
            );
        }

        // Create session for the user (compatible with your Passport.js setup)
        const expiresIn365Days = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
        const sessionUser = {
            dbUserId: user.id,
            claims: {
                sub: user.id,
                email: user.email,
                username: user.username,
                first_name: user.firstName,
                last_name: user.lastName,
            },
            expires_at: expiresIn365Days,
            refresh_token: null,
        };

        // Use Passport.js login to establish session
        req.login(sessionUser, (err: any) => {
            if (err) {
                console.error("[Facebook OAuth] Session creation failed:", err);
                return res.redirect("/auth?error=session_failed");
            }

            console.log(
                `[Facebook OAuth] ✅ Session created for ${user.username}`,
            );
            console.log(
                "[Facebook OAuth] Session user object:",
                JSON.stringify(sessionUser, null, 2),
            );

            // Store Facebook account info in database
            storage
                .createSocialMediaAccount({
                    userId: user.id,
                    platform: "facebook",
                    accountId: profile.id,
                    accountName: profile.name || user.username,
                    accessToken: accessToken,
                    refreshToken: null, // Facebook doesn't provide refresh tokens for basic auth
                    tokenExpiresAt: null, // Long-lived tokens don't expire in the same way
                    isActive: true,
                })
                .catch((error: any) => {
                    console.error(
                        "[Facebook OAuth] Error storing Facebook account:",
                        error,
                    );
                    // Don't fail the login if we can't store the account
                });

            // Retrieve the return URL from session or default to social media agent
            const returnTo =
                req.session.facebookOAuthReturnTo || "/social-media-agent";
            delete req.session.facebookOAuthReturnTo;

            // Force session save before redirect to ensure it's persisted
            req.session.save((saveErr: any) => {
                if (saveErr) {
                    console.error(
                        "[Facebook OAuth] Session save failed:",
                        saveErr,
                    );
                    return res.redirect("/auth?error=session_failed");
                }

                console.log(
                    `[Facebook OAuth] ✅ Session saved, redirecting to ${returnTo}`,
                );

                // Add success parameter to indicate Facebook was just connected
                const separator = returnTo.includes("?") ? "&" : "?";
                res.redirect(`${returnTo}${separator}linked=facebook`);
            });
        });
    } catch (error: any) {
        console.error("[Facebook OAuth] Callback error:", error);
        res.redirect("/auth?error=facebook_auth_failed");
    }
});

export default router;
