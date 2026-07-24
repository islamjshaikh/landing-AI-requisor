import express from "express";
import multer from "multer";
import { mastodonOAuth } from "../services/mastodon-oauth";
import { DatabaseStorage } from "../database-storage";
import { nanoid } from "nanoid";
import { logger } from "../services/logger";
import { isAuthenticated } from "../auth";
import { config } from "../config/environment";

// Configure multer for file uploads (memory storage for Mastodon uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10, // Max 10 files
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
const storage = new DatabaseStorage();

/**
 * Step 1: Start Mastodon OAuth flow
 * Frontend redirects user here with instance parameter
 */
router.get("/mastodon/login", async (req: any, res) => {
  try {
    const { instance } = req.query;

    if (!instance || typeof instance !== "string") {
      logger.warn(
        "backend",
        "Mastodon login attempt without instance parameter",
      );
      return res.status(400).json({
        error: "Instance parameter is required",
      });
    }

    // Use environment-aware redirect URI
    const redirectUri = config.oauth.mastodon.callback;

    logger.info(
      "backend",
      `Starting Mastodon OAuth for instance: ${instance}`,
      {
        redirectUri,
      },
    );

    // Register app with Mastodon instance
    const app = await mastodonOAuth.registerApp(instance, redirectUri);

    // Generate authorization URL
    const authUrl = mastodonOAuth.generateAuthUrl(
      instance,
      app.client_id,
      redirectUri,
    );

    // Store app details in session for callback
    req.session.mastodonApp = {
      instance,
      client_id: app.client_id,
      client_secret: app.client_secret,
      redirect_uri: redirectUri,
    };

    logger.info(
      "backend",
      `Redirecting to Mastodon authorization for ${instance}`,
    );

    // Redirect user to Mastodon for authorization
    res.redirect(authUrl);
  } catch (error: any) {
    logger.error("backend", "Mastodon OAuth initiation failed", {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: "Failed to initiate Mastodon authentication",
      message: error.message,
    });
  }
});

/**
 * Step 2: Handle OAuth callback from Mastodon
 * User is redirected here after authorizing
 */
router.get("/mastodon/callback", async (req: any, res) => {
  try {
    const { code, state, error } = req.query;
    const appData = req.session.mastodonApp;

    if (error) {
      logger.warn("backend", "Mastodon OAuth callback received error", {
        error,
      });
      return res.redirect(
        `/social-media-agent?error=${encodeURIComponent(error)}`,
      );
    }

    if (!code) {
      logger.warn(
        "backend",
        "Mastodon OAuth callback missing authorization code",
      );
      const host = req.get("host");
      const protocol = process.env.APP_PROTOCOL || (process.env.NODE_ENV === "production" ? "https" : req.protocol);
      const currentDomain = `${protocol}://${host}`;
      return res.redirect(
        `${currentDomain}/social-media-agent?error=Missing+authorization+code`,
      );
    }

    // If session data is missing, try to recover from the OAuth flow
    if (!appData) {
      logger.warn(
        "backend",
        "Session data missing, attempting to recover OAuth flow",
        {
          hasCode: !!code,
          hasAppData: !!appData,
        },
      );

      // For development/testing - fallback to mastodon.social if session lost
      // In production, this would need more robust error handling
      const defaultInstance = "mastodon.social";
      logger.info(
        "backend",
        `Falling back to default instance: ${defaultInstance}`,
      );

      const host = req.get("host");
      const protocol = process.env.APP_PROTOCOL || (process.env.NODE_ENV === "production" ? "https" : req.protocol);
      const currentDomain = `${protocol}://${host}`;
      return res.redirect(
        `${currentDomain}/social-media-agent?error=Session+expired&instance=${defaultInstance}&code=${code}`,
      );
    }

    logger.info(
      "backend",
      `Processing Mastodon OAuth callback for ${appData.instance}`,
    );

    // Exchange authorization code for access token
    const token = await mastodonOAuth.exchangeCodeForToken(
      appData.instance,
      code,
      appData.client_id,
      appData.client_secret,
      appData.redirect_uri,
    );

    // Verify the token works
    const isValid = await mastodonOAuth.verifyToken(
      appData.instance,
      token.access_token,
    );

    if (!isValid) {
      logger.error("backend", "Mastodon token verification failed", {
        instance: appData.instance,
      });
      const host = req.get("host");
      const protocol = process.env.APP_PROTOCOL || (process.env.NODE_ENV === "production" ? "https" : req.protocol);
      const currentDomain = `${protocol}://${host}`;
      return res.redirect(
        `${currentDomain}/social-media-agent?error=Token+verification+failed`,
      );
    }

    // Clean up session
    delete req.session.mastodonApp;

    logger.info(
      "backend",
      `Mastodon OAuth completed successfully for ${appData.instance}`,
    );

    // Redirect back to social media agent with success parameters (use current server)
    const host = req.get("host");
    const protocol = process.env.APP_PROTOCOL || (process.env.NODE_ENV === "production" ? "https" : req.protocol);
    const currentDomain = `${protocol}://${host}`;
    const redirectUrl =
      `${currentDomain}/social-media-agent?` +
      `ma_token=${encodeURIComponent(token.access_token)}&` +
      `ma_instance=${encodeURIComponent(appData.instance)}&` +
      `linked=mastodon`;

    res.redirect(redirectUrl);
  } catch (error: any) {
    logger.error("backend", "Mastodon OAuth callback processing failed", {
      error: error.message,
      stack: error.stack,
    });

    const productionDomain = process.env.APP_DOMAIN || `http://localhost:${process.env.PORT || 8080}`;
    res.redirect(
      `${productionDomain}/social-media-agent?error=${encodeURIComponent("Authentication failed: " + error.message)}`,
    );
  }
});

/**
 * Publish post to Mastodon
 */
// ADD multer to this route and use req protocol/host for absolute URLs
router.post('/mastodon/publish', upload.array('media', 10), async (req: any, res) => {
  try {
    const { content, instance, access_token } = req.body;

    // mediaUrls arrive as string or array depending on the browser
    let mediaUrls: string[] = [];
    const rawUrls = req.body.mediaUrls || req.body['mediaUrls[]'];
    if (Array.isArray(rawUrls)) mediaUrls = rawUrls;
    else if (typeof rawUrls === 'string' && rawUrls.trim()) mediaUrls = [rawUrls];

    if (!content || !instance || !access_token) {
      return res.status(400).json({
        success: false,
        error: 'Content, instance, and access_token are required'
      });
    }

    // verify token
    const ok = await mastodonOAuth.verifyToken(instance, access_token);
    if (!ok) return res.status(401).json({ success: false, error: 'Invalid or expired access token' });

    // enforce 500 chars
    const MASTODON_CHAR_LIMIT = 500;
    const text = content.length > MASTODON_CHAR_LIMIT
      ? content.slice(0, MASTODON_CHAR_LIMIT - 3) + '...'
      : content;

    // collect media buffers
    const mediaFiles: Buffer[] = [];

    // a) direct multipart files
    const files = (req.files as Express.Multer.File[]) || [];
    for (const f of files) mediaFiles.push(f.buffer);

    // b) previously uploaded URLs (served by your app)
    if (mediaUrls.length) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      for (const u of mediaUrls) {
        try {
          const full = u.startsWith('http') ? u : `${baseUrl}${u}`;
          const r = await fetch(full);
          if (!r.ok) continue;
          const arr = await r.arrayBuffer();
          mediaFiles.push(Buffer.from(arr));
        } catch { }
      }
    }

    const result = await mastodonOAuth.postStatus(
      instance, access_token, text, mediaFiles.length ? mediaFiles : undefined
    );

    // Save to completed history
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (userId) {
        await storage.createCompletedSocialPost({
          id: nanoid(),
          userId,
          topic: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
          platform: "Mastodon",
          scheduledTime: new Date(),
          executedAt: new Date(),
          status: "completed",
          finalContent: text,
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : (mediaFiles.length ? ["Attached Media"] : []),
          platformResponse: result,
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }
    } catch (historyError) {
      logger.error("backend", "Failed to save Mastodon history", { error: historyError });
    }

    res.json({ success: true, result: { id: result.id, url: result.url, created_at: result.created_at } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Failed to publish to Mastodon: ' + e.message });
  }
});


/**
 * Direct token exchange for session recovery
 */
router.post("/mastodon/exchange-token", async (req: any, res) => {
  try {
    const { instance, code } = req.body;

    if (!instance || !code) {
      return res.status(400).json({
        success: false,
        error: "Instance and code are required",
      });
    }

    logger.info("backend", `Direct token exchange for ${instance}`);

    // Register app with Mastodon to get client credentials
    const appData = await mastodonOAuth.registerApp(
      instance,
      config.oauth.mastodon.callback,
    );

    // Exchange code for access token
    const token = await mastodonOAuth.exchangeCodeForToken(
      instance,
      code,
      appData.client_id,
      appData.client_secret,
      appData.redirect_uri,
    );

    // Verify the token works
    const isValid = await mastodonOAuth.verifyToken(
      instance,
      token.access_token,
    );

    if (!isValid) {
      logger.error("backend", "Direct token verification failed", { instance });
      return res.status(400).json({
        success: false,
        error: "Token verification failed",
      });
    }

    logger.info(
      "backend",
      `Direct token exchange completed successfully for ${instance}`,
    );

    res.json({
      success: true,
      access_token: token.access_token,
      instance: instance,
    });
  } catch (error: any) {
    logger.error("backend", "Direct token exchange failed", {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: "Token exchange failed: " + error.message,
    });
  }
});

export default router;
