import express from "express";
import multer from "multer";
import { instagramOAuth } from "../services/instagram-oauth";
import { logger } from "../services/logger";
import { isAuthenticated } from "../auth";
import { config } from "../config/environment";
import { storage } from "../storage";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for Instagram
    files: 1, // Instagram supports single image/video
  },
  fileFilter: (req, file, cb) => {
    // Instagram supports images and videos
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
 * Step 1: Start Instagram OAuth flow
 */
router.get("/instagram/login", async (req: any, res) => {
  try {
    logger.info("backend", "Starting Instagram OAuth flow");

    // Check if running in demo mode
    const isDemoMode = !process.env.FACEBOOK_APP_ID && !process.env.META_APP_ID;
    
    if (isDemoMode) {
      logger.info("backend", "Instagram OAuth running in DEMO mode");
      return res.redirect(
        `/social-media-agent?demo=instagram&message=${encodeURIComponent("Instagram integration ready! Add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET to connect real accounts.")}`
      );
    }

    // Use environment-aware redirect URI
    const host = req.get("host");
    const protocol = process.env.APP_PROTOCOL || (process.env.NODE_ENV === "production" ? "https" : req.protocol);
    const redirectUri = `${protocol}://${host}/api/social/instagram/callback`;

    logger.info("backend", "Instagram OAuth redirect URI", { redirectUri });

    // Generate authorization URL
    const authUrl = instagramOAuth.generateAuthUrl(redirectUri);

    logger.info("backend", "Redirecting to Instagram authorization");

    // Redirect user to Instagram for authorization
    res.redirect(authUrl);
  } catch (error: any) {
    logger.error("backend", "Instagram OAuth initiation failed", {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: "Failed to initiate Instagram authentication",
      message: error.message,
    });
  }
});

/**
 * Step 2: Handle OAuth callback from Instagram
 */
router.get("/instagram/callback", async (req: any, res) => {
  try {
    const { code, error, error_description } = req.query;

    if (error) {
      logger.warn("backend", "Instagram OAuth callback received error", {
        error,
        error_description,
      });
      return res.redirect(
        `/social-media-agent?error=${encodeURIComponent(error_description || error)}`,
      );
    }

    if (!code) {
      logger.warn("backend", "Instagram OAuth callback missing authorization code");
      return res.redirect(
        `/social-media-agent?error=Missing+authorization+code`,
      );
    }

    logger.info("backend", "Processing Instagram OAuth callback");

    // Get redirect URI for token exchange
    const host = req.get("host");
    const protocol = process.env.APP_PROTOCOL || (process.env.NODE_ENV === "production" ? "https" : req.protocol);
    const redirectUri = `${protocol}://${host}/api/social/instagram/callback`;

    // Exchange authorization code for access token
    const tokenData = await instagramOAuth.exchangeCodeForToken(code, redirectUri);

    // Verify the token works
    const isValid = await instagramOAuth.verifyToken(tokenData.access_token);

    if (!isValid) {
      logger.error("backend", "Instagram token verification failed");
      return res.redirect(
        `/social-media-agent?error=Token+verification+failed`,
      );
    }

    // Get user's Facebook pages (required for Instagram Business)
    const pages = await instagramOAuth.getUserPages(tokenData.access_token);
    
    // Filter pages that have Instagram Business accounts
    const instagramPages = pages.filter(page => page.instagram_business_account);

    if (instagramPages.length === 0) {
      logger.warn("backend", "No Instagram Business accounts found");
      return res.redirect(
        `/social-media-agent?error=No+Instagram+Business+accounts+found`,
      );
    }

    // Store Instagram accounts in database if user is authenticated
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      const userId = req.user.dbUserId || req.user.claims.sub;

      for (const page of instagramPages) {
        try {
          const igAccount = await instagramOAuth.getInstagramAccount(
            page.access_token,
            page.instagram_business_account!.id
          );

          // Store using our new Meta helper methods
          await storage.upsertMetaPage?.({
            userId,
            provider: "meta",
            providerAccountType: "facebook_page",
            accountId: page.id,
            displayName: page.name,
            accessToken: page.access_token,
          });

          await storage.upsertMetaIg?.({
            userId,
            provider: "meta", 
            providerAccountType: "instagram",
            accountId: igAccount.id,
            displayName: igAccount.username,
            linkedPageId: page.id,
          });

          logger.info("backend", `Stored Instagram account: @${igAccount.username}`);
        } catch (error) {
          logger.error("backend", "Error storing Instagram account", { error });
        }
      }
    }

    logger.info("backend", `Instagram OAuth completed successfully - linked ${instagramPages.length} accounts`);

    // Redirect back to social media agent with success
    const redirectUrl = `/social-media-agent?linked=instagram&accounts=${instagramPages.length}`;
    res.redirect(redirectUrl);
  } catch (error: any) {
    logger.error("backend", "Instagram OAuth callback processing failed", {
      error: error.message,
      stack: error.stack,
    });

    res.redirect(
      `/social-media-agent?error=${encodeURIComponent("Instagram authentication failed: " + error.message)}`,
    );
  }
});

/**
 * Get connected Instagram accounts
 */
router.get("/instagram/accounts", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.dbUserId || req.user.claims.sub;

    // Get Instagram accounts using our helper methods
    const igAccounts = await storage.listMetaIgAccounts?.(userId) || [];
    const pages = await storage.listMetaPages?.(userId) || [];

    // Combine data
    const accounts = igAccounts.map((ig: any) => {
      const linkedPage = pages.find((p: any) => p.accountId === ig.linkedPageId);
      return {
        id: ig.accountId,
        username: ig.accountName,
        type: "instagram",
        linkedPage: linkedPage ? linkedPage.accountName : null,
        isActive: ig.isActive,
      };
    });

    res.json({
      success: true,
      accounts,
    });
  } catch (error: any) {
    logger.error("backend", "Failed to fetch Instagram accounts", { error });
    res.status(500).json({
      success: false,
      error: "Failed to fetch accounts",
    });
  }
});

/**
 * Publish post to Instagram
 */
router.post("/instagram/publish", upload.single("media"), async (req: any, res) => {
  try {
    const { content, instagramAccountId } = req.body;

    if (!content || !instagramAccountId) {
      return res.status(400).json({
        success: false,
        error: "Content and Instagram account ID are required",
      });
    }

    const userId = req.user?.dbUserId || req.user?.claims.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
    }

    // Get page access token for this Instagram account
    const igAccounts = await storage.listMetaIgAccounts?.(userId) || [];
    const igAccount = igAccounts.find((acc: any) => acc.accountId === instagramAccountId);
    
    if (!igAccount || !igAccount.linkedPageId) {
      return res.status(404).json({
        success: false,
        error: "Instagram account not found or not properly linked",
      });
    }

    const pageToken = await storage.getMetaPageToken?.(userId, igAccount.linkedPageId);
    if (!pageToken) {
      return res.status(401).json({
        success: false,
        error: "Page access token not found - please reconnect Instagram",
      });
    }

    // For now, require image URL (we'll enhance with file upload later)
    const imageUrl = req.body.imageUrl;
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: "Image URL is required for Instagram posts",
      });
    }

    // Publish to Instagram
    const result = await instagramOAuth.publishImage(
      instagramAccountId,
      pageToken,
      imageUrl,
      content
    );

    logger.info("backend", `Successfully published to Instagram: ${result.id}`);

    res.json({
      success: true,
      result: {
        id: result.id,
        instagramUrl: `https://www.instagram.com/p/${result.id}/`,
      },
    });
  } catch (error: any) {
    logger.error("backend", "Instagram publish failed", { error });
    res.status(500).json({
      success: false,
      error: "Failed to publish to Instagram: " + error.message,
    });
  }
});

export default router;