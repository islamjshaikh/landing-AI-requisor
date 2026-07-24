import express from "express";
import multer from "multer";
import { twitterOAuth } from "../services/twitter-oauth";
import { nanoid } from "nanoid";
import { logger } from "../services/logger";
import { isAuthenticated } from "../auth";
import { config } from "../config/environment";
import { DatabaseStorage } from "../database-storage";

const storage = new DatabaseStorage();

// Configure multer for file uploads (memory storage for Twitter uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 4, // Twitter allows up to 4 images
  },
  fileFilter: (req, file, cb) => {
    // Allow images and videos for social media
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

const router = express.Router();

/**
 * Step 1: Start Twitter OAuth flow
 * Frontend redirects user here
 */
router.get("/twitter/login", (req: any, res) => {
  try {
    logger.info("backend", "Starting Twitter OAuth flow");

    // Generate PKCE challenge
    const { codeVerifier, codeChallenge } = twitterOAuth.generatePKCE();

    // Use environment-aware redirect URI
    const host = req.get("host");
    const protocol = process.env.APP_PROTOCOL || (process.env.NODE_ENV === "production" ? "https" : req.protocol);
    const redirectUri = `${protocol}://${host}/api/social/twitter/callback`;

    logger.info("backend", "Twitter OAuth redirect URI", { redirectUri });

    // Store code verifier and redirect URI in session for callback
    req.session.twitterCodeVerifier = codeVerifier;
    req.session.twitterRedirectUri = redirectUri;

    // Generate authorization URL
    const authUrl = twitterOAuth.generateAuthUrl(redirectUri, codeChallenge);

    logger.info("backend", "Redirecting to Twitter authorization");

    // Redirect user to Twitter for authorization
    res.redirect(authUrl);
  } catch (error: any) {
    logger.error("backend", "Twitter OAuth initiation failed", {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: "Failed to initiate Twitter authentication",
      message: error.message,
    });
  }
});

/**
 * Step 2: Handle OAuth callback from Twitter
 * User is redirected here after authorizing
 */
router.get("/twitter/callback", async (req: any, res) => {
  try {
    const { code, error, state } = req.query;
    const codeVerifier = req.session.twitterCodeVerifier;
    const storedRedirectUri = req.session.twitterRedirectUri;

    logger.info("backend", "Twitter OAuth callback received", {
      hasCode: !!code,
      hasCodeVerifier: !!codeVerifier,
      hasStoredRedirectUri: !!storedRedirectUri,
      state: state ? String(state).substring(0, 8) + "..." : "none",
    });

    if (error) {
      logger.warn("backend", "Twitter OAuth callback received error", {
        error,
      });
      return res.redirect(
        `/social-media-agent?error=${encodeURIComponent(error)}`,
      );
    }

    if (!code) {
      logger.warn(
        "backend",
        "Twitter OAuth callback missing authorization code",
      );
      return res.redirect(
        `/social-media-agent?error=${encodeURIComponent("Missing authorization code")}`,
      );
    }

    if (!codeVerifier) {
      logger.warn(
        "backend",
        "Twitter OAuth callback missing code verifier - session may have expired",
      );
      return res.redirect(
        `/social-media-agent?error=${encodeURIComponent("Session expired - please try connecting Twitter again")}`,
      );
    }

    // Use stored redirect URI from login to ensure it matches exactly
    const host = req.get("host");
    const protocol = process.env.APP_PROTOCOL || (process.env.NODE_ENV === "production" ? "https" : req.protocol);
    const redirectUri =
      storedRedirectUri || `${protocol}://${host}/api/social/twitter/callback`;

    logger.info("backend", "Exchanging Twitter code for token", {
      redirectUri,
      usingStoredUri: !!storedRedirectUri,
    });

    // Exchange code for token
    const tokenData = await twitterOAuth.exchangeCodeForToken(
      code as string,
      redirectUri,
      codeVerifier,
    );

    if (!tokenData.access_token) {
      throw new Error("No access token received from Twitter");
    }

    // Store token in session immediately after getting it
    req.session.twitterAccessToken = tokenData.access_token;

    // Try to get user info, but don't fail if rate limited
    let userData: any = null;
    let username = "twitter_user";

    try {
      userData = await twitterOAuth.getUserInfo(tokenData.access_token);
      username = userData.data?.username || "twitter_user";
      req.session.twitterUsername = username;

      logger.info("backend", "Twitter OAuth successful", {
        username: username,
      });
    } catch (userInfoError: any) {
      // Handle rate limiting or other errors when fetching user info
      const isRateLimit = userInfoError.message?.includes("429");

      logger.warn(
        "backend",
        "Could not fetch Twitter user info, but token is valid",
        {
          error: userInfoError.message,
          isRateLimit,
        },
      );

      // Store a placeholder username - we'll get the real one on first API call
      req.session.twitterUsername = "twitter_user";
      username = "twitter_user";
    }

    // Store Twitter account info if user is authenticated
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      const userId = req.user.dbUserId || req.user.claims.sub;

      try {
        await storage.createSocialMediaAccount({
          userId,
          platform: "twitter",
          accountId: userData?.data?.id || "twitter_" + Date.now(),
          accountName: username,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || null,
          tokenExpiresAt: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null,
          isActive: true,
        });

        logger.info("backend", "Stored Twitter account in database", {
          userId,
          username: username,
        });
      } catch (error) {
        logger.error("backend", "Error storing Twitter account", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Clear Twitter OAuth session data
    delete req.session.twitterCodeVerifier;
    delete req.session.twitterRedirectUri;

    // Redirect to frontend with success parameter
    res.redirect("/social-media-agent?linked=twitter&tw_success=true");
  } catch (error: any) {
    logger.error("backend", "Twitter OAuth callback failed", {
      error: error.message,
      stack: error.stack,
    });

    res.redirect(
      `/social-media-agent?error=${encodeURIComponent("Twitter authentication failed")}`,
    );
  }
});

/**
 * Check Twitter connection status
 */
router.get("/twitter/status", async (req: any, res) => {
  try {
    const accessToken = req.session.twitterAccessToken;
    const username = req.session.twitterUsername;

    if (!accessToken) {
      return res.json({
        success: true,
        data: {
          authenticated: false,
        },
      });
    }

    // Verify token is still valid (handles rate limits gracefully)
    const isValid = await twitterOAuth.verifyToken(accessToken);

    if (!isValid) {
      // Clear invalid token (but not if rate limited - verifyToken handles that)
      delete req.session.twitterAccessToken;
      delete req.session.twitterUsername;

      logger.info("backend", "Cleared invalid Twitter token");

      return res.json({
        success: true,
        data: {
          authenticated: false,
        },
      });
    }

    // If we don't have username yet, try to fetch it (if not rate limited)
    if (!username || username === "twitter_user") {
      try {
        const userData = await twitterOAuth.getUserInfo(accessToken);
        if (userData?.data?.username) {
          req.session.twitterUsername = userData.data.username;
          logger.info("backend", "Updated Twitter username in session", {
            username: userData.data.username,
          });
        }
      } catch (error: any) {
        // Ignore errors fetching username - we already have the token
        logger.info(
          "backend",
          "Could not fetch Twitter username (will use placeholder)",
          {
            error: error.message,
          },
        );
      }
    }

    res.json({
      success: true,
      data: {
        authenticated: true,
        username: req.session.twitterUsername || "twitter_user",
      },
    });
  } catch (error: any) {
    logger.error("backend", "Failed to check Twitter status", {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: "Failed to check Twitter connection status",
    });
  }
});

/**
 * Publish tweet with optional media
 */
router.post(
  "/twitter/publish",
  upload.array("media", 4),
  async (req: any, res) => {
    try {
      const { content } = req.body;
      const accessToken = req.session.twitterAccessToken;

      if (!content || !accessToken) {
        return res.status(400).json({
          success: false,
          error: "Content and authentication are required",
        });
      }

      // Verify token
      // Verify token
      let currentAccessToken = accessToken;
      const isValid = await twitterOAuth.verifyToken(currentAccessToken);

      if (!isValid) {
        logger.info("backend", "Session token invalid/expired, attempting refresh from DB");

        // Try to refresh using DB token
        let refreshSuccess = false;

        if (req.user && (req.user.dbUserId || req.user.claims?.sub)) {
          const userId = req.user.dbUserId || req.user.claims.sub;
          try {
            const accounts = await storage.getSocialMediaAccounts(userId);
            const twitterAccount = accounts.find(acc => acc.platform === 'twitter' && acc.isActive);

            if (twitterAccount && twitterAccount.refreshToken) {
              logger.info("backend", "Found refresh token in DB, attempting refresh");
              const newTokens = await twitterOAuth.refreshToken(twitterAccount.refreshToken);

              // Update DB
              const newExpiry = newTokens.expires_in ? new Date(Date.now() + newTokens.expires_in * 1000) : undefined;
              await storage.updateSocialMediaAccount(twitterAccount.id, {
                accessToken: newTokens.access_token,
                refreshToken: newTokens.refresh_token || twitterAccount.refreshToken,
                tokenExpiresAt: newExpiry
              });

              // Update Session
              req.session.twitterAccessToken = newTokens.access_token;
              currentAccessToken = newTokens.access_token;
              refreshSuccess = true;

              logger.info("backend", "Successfully refreshed Twitter token during publish");
            }
          } catch (refreshError: any) {
            logger.error("backend", "Failed to refresh token during publish flow", refreshError);
          }
        }

        if (!refreshSuccess) {
          delete req.session.twitterAccessToken;
          delete req.session.twitterUsername;

          return res.status(401).json({
            success: false,
            error:
              "Invalid or expired access token. Please reconnect to Twitter.",
          });
        }
      }

      // (Previously aliased `currentAccessToken` into `accessTokenToUse` but
      // the alias was never read. Removed.)

      // Enforce 280 character limit
      const TWITTER_CHAR_LIMIT = 280;
      const text =
        content.length > TWITTER_CHAR_LIMIT
          ? content.slice(0, TWITTER_CHAR_LIMIT - 3) + "..."
          : content;

      // Upload media if provided
      const mediaIds: string[] = [];
      const files = (req.files as Express.Multer.File[]) || [];

      logger.info("backend", "Twitter publish request", {
        hasContent: !!content,
        filesCount: files.length,
        fileDetails: files.map((f) => ({
          name: f.originalname,
          size: f.size,
          mimetype: f.mimetype,
        })),
      });

      if (files.length > 0) {
        logger.info(
          "backend",
          `Uploading ${files.length} media files to Twitter`,
        );

        for (const file of files) {
          try {
            logger.info("backend", "Attempting to upload media file", {
              filename: file.originalname,
              size: file.size,
              mimetype: file.mimetype,
            });

            const mediaId = await twitterOAuth.uploadMedia(
              accessToken,
              file.buffer,
              file.mimetype,
            );
            mediaIds.push(mediaId);

            logger.info("backend", "Media file uploaded successfully", {
              filename: file.originalname,
              mediaId,
            });
          } catch (error: any) {
            logger.error("backend", "Failed to upload media file", {
              error: error.message,
              filename: file.originalname,
              errorDetails: error.response?.data,
            });
            // Continue with other files
          }
        }

        logger.info(
          "backend",
          `Media upload complete - ${mediaIds.length} of ${files.length} files uploaded successfully`,
        );
      }

      // Post tweet
      const result = await twitterOAuth.postTweet(
        accessToken,
        text,
        mediaIds.length > 0 ? mediaIds : undefined,
      );

      const tweetId = result.data?.id;
      const username = req.session.twitterUsername || "unknown";
      const tweetUrl = `https://twitter.com/${username}/status/${tweetId}`;

      logger.info("backend", "Successfully posted tweet", {
        tweetId,
        tweetUrl,
      });

      // Save to completed history
      try {
        const userId = req.user?.dbUserId || req.user?.claims?.sub;
        if (userId) {
          await storage.createCompletedSocialPost({
            id: nanoid(),
            userId,
            topic: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
            platform: "Twitter",
            scheduledTime: new Date(),
            executedAt: new Date(),
            status: "completed",
            finalContent: text,
            mediaUrls: mediaIds,
            platformResponse: result.data,
            userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
        }
      } catch (historyError) {
        logger.error("backend", "Failed to save Twitter post to history", historyError);
        // Don't fail the request if history save fails
      }

      res.json({
        success: true,
        data: {
          tweetId,
          tweetUrl,
          text: result.data?.text,
        },
      });
    } catch (error: any) {
      logger.error("backend", "Failed to publish to Twitter", {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      res.status(500).json({
        success: false,
        error: "Failed to publish to Twitter: " + error.message,
      });
    }
  },
);

export default router;
