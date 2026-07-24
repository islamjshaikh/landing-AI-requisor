import { Router } from "express";
import { DatabaseStorage } from "../database-storage";
import crypto from "crypto";
import axios from "axios";

const router = Router();
const storage = new DatabaseStorage();

// LinkedIn App credentials from environment variables
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "";
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";
const APP_DOMAIN = process.env.APP_DOMAIN || "http://localhost:5000";

/**
 * Initiate LinkedIn OAuth flow
 * Redirects user to LinkedIn's OAuth authorization page
 */
router.get("/linkedin", (req: any, res) => {
    try {
        if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
            console.error("LinkedIn OAuth credentials not configured");
            return res.status(500).json({
                error: "LinkedIn login not configured. Please contact administrator.",
            });
        }

        // Store the referrer so we can redirect back after authentication
        const returnTo =
            req.query.returnTo || req.get("referer") || "/social-media-agent";
        req.session.linkedinOAuthReturnTo = returnTo;

        // Generate a random state parameter for CSRF protection
        const state = crypto.randomBytes(32).toString("hex");
        req.session.linkedinOAuthState = state;

        const redirectUri = `${APP_DOMAIN}/api/auth/linkedin/callback`;
        // Scopes: openid, profile, email are standard OIDC. w_member_social is for posting.
        const scope = "openid profile email w_member_social";

        // Construct LinkedIn OAuth URL
        const authUrl =
            `https://www.linkedin.com/oauth/v2/authorization?` +
            `response_type=code&` +
            `client_id=${LINKEDIN_CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `state=${state}&` +
            `scope=${encodeURIComponent(scope)}`;

        console.log(`[LinkedIn OAuth] Redirecting to LinkedIn for authorization`);
        res.redirect(authUrl);
    } catch (error: any) {
        console.error("[LinkedIn OAuth] Error initiating OAuth:", error);
        res.status(500).json({ error: "Failed to initiate LinkedIn login" });
    }
});

/**
 * Handle LinkedIn OAuth callback
 * Exchanges authorization code for access token and retrieves user profile
 */
router.get("/linkedin/callback", async (req: any, res) => {
    try {
        const { code, state, error, error_description } = req.query;

        if (error) {
            console.error(
                `[LinkedIn OAuth] Error from LinkedIn: ${error} - ${error_description}`,
            );
            return res.redirect(`/auth?error=linkedin_auth_failed&details=${encodeURIComponent(error_description as string)}`);
        }

        // Verify state parameter for CSRF protection
        if (!state || state !== req.session.linkedinOAuthState) {
            console.error("[LinkedIn OAuth] State mismatch - possible CSRF attack");
            return res.redirect("/auth?error=linkedin_state_mismatch");
        }

        // Clear the state from session
        delete req.session.linkedinOAuthState;

        if (!code) {
            console.error("[LinkedIn OAuth] No authorization code received");
            return res.redirect("/auth?error=linkedin_no_code");
        }

        // Exchange code for access token
        const redirectUri = `${APP_DOMAIN}/api/auth/linkedin/callback`;
        const tokenUrl = "https://www.linkedin.com/oauth/v2/accessToken";

        const params = new URLSearchParams();
        params.append("grant_type", "authorization_code");
        params.append("code", code as string);
        params.append("redirect_uri", redirectUri);
        params.append("client_id", LINKEDIN_CLIENT_ID);
        params.append("client_secret", LINKEDIN_CLIENT_SECRET);

        console.log(`[LinkedIn OAuth] Exchanging code for access token`);

        let accessToken;
        let expiresIn;

        try {
            const tokenResponse = await axios.post(tokenUrl, params, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });

            accessToken = tokenResponse.data.access_token;
            expiresIn = tokenResponse.data.expires_in;
        } catch (tokenError: any) {
            console.error("[LinkedIn OAuth] Token exchange failed:", tokenError.response?.data || tokenError.message);
            const details = tokenError.response?.data?.error_description || tokenError.message;
            return res.redirect(`/auth?error=linkedin_token_error&details=${encodeURIComponent(details)}`);
        }

        // Fetch user profile using OpenID Connect userinfo endpoint
        const profileUrl = "https://api.linkedin.com/v2/userinfo";

        console.log(`[LinkedIn OAuth] Fetching user profile`);
        let profile;

        try {
            const profileResponse = await axios.get(profileUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            profile = profileResponse.data;
        } catch (profileError: any) {
            console.error("[LinkedIn OAuth] Profile fetch failed:", profileError.response?.data || profileError.message);
            const details = profileError.response?.data?.message || profileError.message;
            return res.redirect(`/auth?error=linkedin_profile_error&details=${encodeURIComponent(details)}`);
        }

        // Profile structure: { sub, name, given_name, family_name, picture, email, ... }

        // Store LinkedIn access token for later use
        req.session.linkedinAccessToken = accessToken;
        req.session.linkedinUserId = profile.sub;

        // Check if user is already authenticated
        if (req.isAuthenticated()) {
            const currentUser = req.user;
            const userId = currentUser.dbUserId || currentUser.claims.sub;

            console.log(`[LinkedIn OAuth] Linking account to existing user: ${userId}`);

            // Store LinkedIn account info in database linked to current user
            await storage.createSocialMediaAccount({
                userId: userId,
                platform: "linkedin",
                accountId: profile.sub,
                accountName: profile.name || "LinkedIn User",
                accessToken: accessToken,
                refreshToken: null,
                tokenExpiresAt: expiresIn
                    ? new Date(Date.now() + expiresIn * 1000)
                    : null,
                isActive: true,
            }).catch((error: any) => {
                console.error("[LinkedIn OAuth] Error linking LinkedIn account:", error);
            });

            const returnTo = req.session.linkedinOAuthReturnTo || "/social-media-agent";
            delete req.session.linkedinOAuthReturnTo;

            const separator = returnTo.includes("?") ? "&" : "?";
            return res.redirect(`${returnTo}${separator}linked=linkedin`);
        }

        // Not authenticated - proceed with login/signup flow
        let user = await storage.getUserByEmail(profile.email);

        if (!user) {
            // Create new user from LinkedIn profile
            const userId = crypto.randomUUID();

            // Generate unique username
            const baseUsername =
                profile.given_name?.toLowerCase() || `li${profile.sub.substring(0, 8)}`;
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
                firstName: profile.given_name || "User",
                lastName: profile.family_name || "",
                profileImageUrl: profile.picture || null,
                emailVerified: true, // LinkedIn verifies emails
            });

            console.log(`[LinkedIn OAuth] Created new user: ${user.username}`);
        } else {
            console.log(
                `[LinkedIn OAuth] Existing user logged in: ${user.username}`,
            );
        }

        // Create session for the user
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
                console.error("[LinkedIn OAuth] Session creation failed:", err);
                return res.redirect(`/auth?error=session_failed&details=${encodeURIComponent(err.message)}`);
            }

            console.log(
                `[LinkedIn OAuth] ✅ Session created for ${user.username}`,
            );

            // Store LinkedIn account info in database
            storage
                .createSocialMediaAccount({
                    userId: user.id,
                    platform: "linkedin",
                    accountId: profile.sub,
                    accountName: profile.name || user.username,
                    accessToken: accessToken,
                    refreshToken: null, // LinkedIn v2 doesn't typically provide refresh tokens for this flow
                    tokenExpiresAt: expiresIn
                        ? new Date(Date.now() + expiresIn * 1000)
                        : null,
                    isActive: true,
                })
                .catch((error: any) => {
                    console.error(
                        "[LinkedIn OAuth] Error storing LinkedIn account:",
                        error,
                    );
                });

            // Retrieve the return URL from session or default to social media agent
            const returnTo =
                req.session.linkedinOAuthReturnTo || "/social-media-agent";
            delete req.session.linkedinOAuthReturnTo;

            // Force session save before redirect
            req.session.save((saveErr: any) => {
                if (saveErr) {
                    console.error("[LinkedIn OAuth] Session save failed:", saveErr);
                    return res.redirect(`/auth?error=session_save_failed&details=${encodeURIComponent(saveErr.message)}`);
                }

                console.log(
                    `[LinkedIn OAuth] ✅ Session saved, redirecting to ${returnTo}`,
                );

                const separator = returnTo.includes("?") ? "&" : "?";
                res.redirect(`${returnTo}${separator}linked=linkedin`);
            });
        });
    } catch (error: any) {
        console.error("[LinkedIn OAuth] Callback error:", error);
        const details = error.message || "Unknown error";
        res.redirect(`/auth?error=linkedin_auth_failed&details=${encodeURIComponent(details)}`);
    }
});

export default router;
