import { Router } from "express";
import { DatabaseStorage } from "../database-storage";
import multer from "multer";
import fs from "fs";
import axios from "axios";
import { nanoid } from "nanoid";
import { isAuthenticated } from "../auth";

const router = Router();
const storage = new DatabaseStorage();
const upload = multer({ dest: "uploads/" });

/**
 * Check if user has a connected LinkedIn account
 */
router.get("/linkedin/status", isAuthenticated, async (req: any, res) => {
    try {
        const userId = req.user?.dbUserId || req.user?.claims?.sub;
        if (!userId) {
            return res.status(401).json({ connected: false, error: "Not authenticated" });
        }

        const accounts = await storage.getSocialMediaAccounts(userId);
        const linkedinAccount = accounts.find(
            (acc) => acc.platform === "linkedin" && acc.isActive,
        );

        if (linkedinAccount) {
            res.json({
                connected: true,
                username: linkedinAccount.accountName,
                accountId: linkedinAccount.accountId,
            });
        } else {
            res.json({ connected: false });
        }
    } catch (error: any) {
        console.error("[LinkedIn Status] Error checking status:", error);
        res.status(500).json({ connected: false, error: error.message });
    }
});

/**
 * Publish a post to LinkedIn
 * Supports text and single image
 */
router.post(
    "/linkedin/publish",
    isAuthenticated,
    upload.array("media"),
    async (req: any, res) => {
        try {
            const userId = req.user?.dbUserId || req.user?.claims?.sub;
            if (!userId) {
                return res.status(401).json({ error: "Not authenticated" });
            }

            const { text, content, link } = req.body;
            const postText = text || content;
            const mediaFiles = (req.files as any[]) || [];

            if (!postText && mediaFiles.length === 0) {
                return res.status(400).json({ error: "Post content cannot be empty" });
            }

            // Get LinkedIn account
            const accounts = await storage.getSocialMediaAccounts(userId);
            const linkedinAccount = accounts.find(
                (acc) => acc.platform === "linkedin" && acc.isActive,
            );

            if (!linkedinAccount || !linkedinAccount.accessToken) {
                return res.status(400).json({
                    error: "LinkedIn account not connected. Please connect first.",
                });
            }

            // Check Expiry
            if (linkedinAccount.tokenExpiresAt) {
                const now = new Date();
                const expiresAt = new Date(linkedinAccount.tokenExpiresAt);
                if (now > expiresAt) {
                    console.error("[LinkedIn Publish] Token expired at", expiresAt);
                    return res.status(401).json({
                        error: "LinkedIn access token expired. Please reconnect your LinkedIn account."
                    });
                }
            }

            const accessToken = linkedinAccount.accessToken;
            const personUrn = `urn:li:person:${linkedinAccount.accountId}`;

            let assetUrn = null;

            // Handle Image Upload (Single image for now)
            if (mediaFiles.length > 0) {
                const file = mediaFiles[0];
                console.log(`[LinkedIn Publish] Uploading image: ${file.originalname}`);

                // Step 1: Register Upload
                const registerUrl = "https://api.linkedin.com/v2/assets?action=registerUpload";
                const registerBody = {
                    registerUploadRequest: {
                        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                        owner: personUrn,
                        serviceRelationships: [
                            {
                                relationshipType: "OWNER",
                                identifier: "urn:li:userGeneratedContent",
                            },
                        ],
                    },
                };

                const registerResponse = await axios.post(registerUrl, registerBody, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                });

                const uploadUrl =
                    registerResponse.data.value.uploadMechanism[
                        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
                    ].uploadUrl;
                assetUrn = registerResponse.data.value.asset;

                console.log(`[LinkedIn Publish] Image registered. Asset URN: ${assetUrn}`);

                // Step 2: Upload Image Binary
                const fileBuffer = fs.readFileSync(file.path);

                await axios.put(uploadUrl, fileBuffer, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/octet-stream",
                    },
                });

                console.log(`[LinkedIn Publish] Image uploaded successfully`);

                // Clean up temp file
                fs.unlinkSync(file.path);
            }

            // Step 3: Create UGC Post
            const postUrl = "https://api.linkedin.com/v2/ugcPosts";

            let shareMediaCategory = "NONE";
            let media = [];

            if (assetUrn) {
                shareMediaCategory = "IMAGE";
                media.push({
                    status: "READY",
                    description: {
                        text: postText || "Image upload",
                    },
                    media: assetUrn,
                    title: {
                        text: "Shared Image",
                    },
                });
            } else if (link) {
                shareMediaCategory = "ARTICLE";
                media.push({
                    status: "READY",
                    description: {
                        text: postText || "Shared Link",
                    },
                    originalUrl: link,
                    title: {
                        text: "Shared Link",
                    },
                });
            }

            const postBody: any = {
                author: personUrn,
                lifecycleState: "PUBLISHED",
                specificContent: {
                    "com.linkedin.ugc.ShareContent": {
                        shareCommentary: {
                            text: postText || "",
                        },
                        shareMediaCategory: shareMediaCategory,
                    },
                },
                visibility: {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
                },
            };

            if (media.length > 0) {
                postBody.specificContent["com.linkedin.ugc.ShareContent"].media = media;
            }

            console.log(`[LinkedIn Publish] Creating post...`);
            const postResponse = await axios.post(postUrl, postBody, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            });

            const postId = postResponse.data.id;
            console.log(`[LinkedIn Publish] Post published! ID: ${postId}`);

            const url = `https://www.linkedin.com/feed/update/${postId}`;

            // Save to completed history
            try {
                if (userId) {
                    const mediaNames = mediaFiles.length > 0
                        ? mediaFiles.map(f => f.originalname)
                        : (link ? [link] : []);

                    await storage.createCompletedSocialPost({
                        id: nanoid(),
                        userId,
                        topic: (postText || "LinkedIn Post").substring(0, 50),
                        platform: "LinkedIn",
                        scheduledTime: new Date(),
                        executedAt: new Date(),
                        status: "completed",
                        finalContent: postText,
                        mediaUrls: mediaNames,
                        platformResponse: { postId, url },
                        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    });
                }
            } catch (historyError) {
                console.error("[LinkedIn Publish] Failed to save history:", historyError);
            }

            res.json({
                success: true,
                postId: postId,
                url: url,
                message: "Posted to LinkedIn successfully",
            });

        } catch (error: any) {
            console.error("[LinkedIn Publish] Error publishing post:", error.response?.data || error.message);

            // Clean up files if error occurs
            if (req.files) {
                (req.files as any[]).forEach((file) => {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                });
            }

            res.status(500).json({
                success: false,
                error: "Failed to publish to LinkedIn",
                details: error.response?.data || error.message,
            });
        }
    }
);

export default router;
