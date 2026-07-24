import { DatabaseStorage } from "../database-storage";
import { logService } from "./log-service";
import { twitterOAuth } from "./twitter-oauth";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import mime from "mime-types";

const FB_API_VERSION = "v21.0";

export class SocialMediaService {
    private storage: DatabaseStorage;

    constructor() {
        this.storage = new DatabaseStorage();
    }

    /**
     * Publish content to Facebook
     */
    async publishToFacebook(
        userId: string,
        content: string,
        mediaFiles: any[] = [],
        linkUrl?: string
    ) {
        try {
            // Get credentials
            const accounts = await this.storage.getSocialMediaAccounts(userId);
            const facebookAccount = accounts.find(
                (acc) => acc.platform === "facebook" && acc.isActive
            );

            if (!facebookAccount || !facebookAccount.accessToken) {
                throw new Error("No connected Facebook account found");
            }

            // Proactive Token Refresh (Exchange Long-Lived for Long-Lived)
            if (facebookAccount.tokenExpiresAt) {
                const now = new Date();
                const expiresAt = new Date(facebookAccount.tokenExpiresAt);
                const timeDiff = expiresAt.getTime() - now.getTime();
                const isExpiring = timeDiff < 3 * 24 * 60 * 60 * 1000; // Refresh if < 3 days remaining

                if (isExpiring) {
                    logService.log("NODE", "INFO", "Facebook token expiring soon, attempting refresh");
                    try {
                        const exchangeUrl = `https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token?` +
                            `grant_type=fb_exchange_token&` +
                            `client_id=${process.env.FACEBOOK_APP_ID}&` +
                            `client_secret=${process.env.FACEBOOK_APP_SECRET}&` +
                            `fb_exchange_token=${facebookAccount.accessToken}`;

                        const response = await fetch(exchangeUrl);
                        const data = await response.json();

                        if (data.access_token) {
                            const newExpiry = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined;

                            await this.storage.updateSocialMediaAccount(facebookAccount.id, {
                                accessToken: data.access_token,
                                tokenExpiresAt: newExpiry
                            });

                            facebookAccount.accessToken = data.access_token;
                            logService.log("NODE", "INFO", "Successfully refreshed Facebook long-lived token");
                        }
                    } catch (refreshError) {
                        logService.log("NODE", "ERROR", "Failed to refresh Facebook token", refreshError);
                    }
                }
            }

            const accessToken = facebookAccount.accessToken;

            // Get user's pages
            const pagesResponse = await fetch(
                `https://graph.facebook.com/${FB_API_VERSION}/me/accounts?access_token=${accessToken}`
            );
            const pagesData = await pagesResponse.json();

            if (!pagesData.data || pagesData.data.length === 0) {
                throw new Error("No Facebook pages found to post to");
            }

            // Use the first page - In future we could allow selecting page
            const pageId = pagesData.data[0].id;
            const pageAccessToken = pagesData.data[0].access_token;

            let postId: string;
            let facebookUrl: string;

            // Handle Media
            let photoIds: string[] = [];

            if (mediaFiles && mediaFiles.length > 0) {
                for (const file of mediaFiles) {
                    try {
                        let buffer: Buffer;
                        let filename: string;
                        let mimetype: string;

                        if (typeof file === 'string') {
                            // Path
                            const fullPath = file.startsWith("/") ? file : path.join(process.cwd(), "uploads", path.basename(file));
                            if (!fs.existsSync(fullPath)) continue;
                            buffer = fs.readFileSync(fullPath);
                            filename = path.basename(fullPath);
                            mimetype = mime.lookup(fullPath) || "image/jpeg";
                        } else if (file.buffer) {
                            // Buffer
                            buffer = file.buffer;
                            filename = file.originalname;
                            mimetype = file.mimetype;
                        } else {
                            continue;
                        }

                        const formData = new FormData();
                        formData.append("access_token", pageAccessToken);
                        formData.append("published", "false"); // Don't publish on wall yet
                        formData.append("source", buffer, { filename, contentType: mimetype });

                        // Default to photos endpoint for now. Video support needs 'videos' endpoint and chunked upload for large files
                        const isVideo = mimetype.startsWith("video/");
                        const endpoint = isVideo ? "videos" : "photos";

                        // For videos, published=false might behave differently, but let's stick to photos for this fix
                        const uploadUrl = `https://graph.facebook.com/${FB_API_VERSION}/${pageId}/${endpoint}`;

                        const response = await axios.post(uploadUrl, formData, {
                            headers: { ...formData.getHeaders() }
                        });

                        if (response.data.id) {
                            photoIds.push(response.data.id);
                        }

                    } catch (uploadError) {
                        console.error("Facebook media upload failed:", uploadError);
                    }
                }
            }


            if (photoIds.length > 0) {
                // Multi-photo post (or single photo post via feed)
                const attachedMedia = photoIds.map(id => ({ media_fbid: id }));

                const postData = new URLSearchParams();
                postData.append("message", content.trim());
                postData.append("attached_media", JSON.stringify(attachedMedia));
                postData.append("access_token", pageAccessToken);

                const publishUrl = `https://graph.facebook.com/${FB_API_VERSION}/${pageId}/feed`;
                const response = await fetch(publishUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: postData.toString(),
                });

                const responseData = await response.json();
                if (!response.ok) throw new Error(responseData.error?.message || "Failed to create post with photos");
                postId = responseData.id;
                facebookUrl = `https://www.facebook.com/${postId.replace("_", "/posts/")}`;

            } else if (linkUrl) {
                // Link post
                const formData = new URLSearchParams();
                formData.append("message", content.trim());
                formData.append("link", linkUrl.trim());
                formData.append("access_token", pageAccessToken);

                const response = await fetch(
                    `https://graph.facebook.com/${FB_API_VERSION}/${pageId}/feed`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: formData.toString(),
                    }
                );
                const responseData = await response.json();
                if (!response.ok) throw new Error(responseData.error?.message || "Failed to post");
                postId = responseData.id;
                facebookUrl = `https://www.facebook.com/${postId.replace("_", "/posts/")}`;
            } else {
                // Text only
                const formData = new URLSearchParams();
                formData.append("message", content.trim());
                formData.append("access_token", pageAccessToken);

                const response = await fetch(
                    `https://graph.facebook.com/${FB_API_VERSION}/${pageId}/feed`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: formData.toString(),
                    }
                );

                const responseData = await response.json();
                if (!response.ok) throw new Error(responseData.error?.message || "Failed to post");
                postId = responseData.id;
                facebookUrl = `https://www.facebook.com/${postId.replace("_", "/posts/")}`;
            }

            return {
                success: true,
                postId,
                url: facebookUrl,
                platform: "Facebook"
            };

        } catch (error: any) {
            logService.log("NODE", "ERROR", "SocialMediaService.publishToFacebook error:", error);
            throw error;
        }
    }

    /**
     * Publish content to Twitter
     */
    async publishToTwitter(userId: string, content: string, mediaFiles: any[] = []) {
        let twitterAccount: any;
        try {
            const accounts = await this.storage.getSocialMediaAccounts(userId);
            twitterAccount = accounts.find(
                (acc) => acc.platform === "twitter" && acc.isActive
            );

            logService.log("NODE", "INFO", "Agent attempting to publish to Twitter", {
                userId,
                foundAccount: !!twitterAccount,
                accountId: twitterAccount?.id
            });

            if (!twitterAccount || !twitterAccount.accessToken) {
                throw new Error("Twitter account not connected or missing access token.");
            }

            // Token refresh logic check
            // Token refresh logic check: Proactively check expiry
            if (twitterAccount.tokenExpiresAt) {
                const now = new Date();
                const expiresAt = new Date(twitterAccount.tokenExpiresAt);
                // Refresh if expired or expiring within 5 minutes
                const timeDiff = expiresAt.getTime() - now.getTime();
                const isExpiring = timeDiff < 5 * 60 * 1000; // 5 minutes buffer

                if (isExpiring && twitterAccount.refreshToken) {
                    logService.log("NODE", "INFO", "Twitter token expired or expiring soon, refreshing proactively", {
                        expiresAt: expiresAt.toISOString(),
                        timeLeftMinutes: Math.floor(timeDiff / 60000)
                    });

                    try {
                        const newTokens = await twitterOAuth.refreshToken(twitterAccount.refreshToken);
                        const newExpiry = newTokens.expires_in ? new Date(Date.now() + newTokens.expires_in * 1000) : undefined;

                        await this.storage.updateSocialMediaAccount(twitterAccount.id, {
                            accessToken: newTokens.access_token,
                            refreshToken: newTokens.refresh_token || twitterAccount.refreshToken,
                            tokenExpiresAt: newExpiry
                        });

                        // Update local account object with new token
                        twitterAccount.accessToken = newTokens.access_token;
                        logService.log("NODE", "INFO", "Proactive Twitter token refresh successful");
                    } catch (refreshError: any) {
                        logService.log("NODE", "WARN", "Proactive Twitter refresh failed, will attempt request anyway", {
                            error: refreshError.message
                        });
                        // Fall through to try request anyway, looking for 401 later
                    }
                }
            }

            const executePublish = async (token: string) => {
                // Handle media
                let mediaIds: string[] = [];
                if (mediaFiles && mediaFiles.length > 0) {
                    for (const file of mediaFiles) {
                        try {
                            let buffer: Buffer;
                            let mimeType: string;

                            if (typeof file === 'string') {
                                // It's a path
                                const fullPath = file.startsWith("/") ? file : path.join(process.cwd(), "uploads", path.basename(file));
                                if (!fs.existsSync(fullPath)) continue;
                                buffer = fs.readFileSync(fullPath);
                                mimeType = mime.lookup(fullPath) || "image/jpeg";
                            } else if (file.buffer) {
                                // It's a multer object or similar
                                buffer = file.buffer;
                                mimeType = file.mimetype;
                            } else {
                                continue;
                            }

                            const mediaId = await twitterOAuth.uploadMedia(token, buffer, mimeType);
                            if (mediaId) mediaIds.push(mediaId);
                        } catch (mediaError) {
                            console.error("Failed to upload media to Twitter:", mediaError);
                        }
                    }
                }

                return await twitterOAuth.postTweet(token, content, mediaIds);
            };

            try {
                const result = await executePublish(twitterAccount.accessToken);
                return this.formatTwitterSuccess(result, twitterAccount);
            } catch (error: any) {
                // Check if error is due to expired token (401 Unauthorized)
                const isUnauthorized = error.message?.includes("401") || error.response?.status === 401;

                if (isUnauthorized && twitterAccount.refreshToken) {
                    logService.log("NODE", "INFO", "Twitter token expired, attempting refresh");
                    try {
                        const newTokens = await twitterOAuth.refreshToken(twitterAccount.refreshToken);
                        await this.storage.updateSocialMediaAccount(twitterAccount.id, {
                            accessToken: newTokens.access_token,
                            refreshToken: newTokens.refresh_token || twitterAccount.refreshToken,
                            tokenExpiresAt: newTokens.expires_in ? new Date(Date.now() + newTokens.expires_in * 1000) : undefined
                        });

                        // Retry with new token
                        const retryResult = await executePublish(newTokens.access_token);
                        return this.formatTwitterSuccess(retryResult, twitterAccount);
                    } catch (refreshError: any) {
                        throw new Error(`TWITTER_REFRESH_FAIL: ${refreshError.message}`);
                    }
                }
                throw error;
            }

        } catch (error: any) {
            logService.log("NODE", "ERROR", "SocialMediaService.publishToTwitter error:", error.message);
            throw error;
        }
    }

    private formatTwitterSuccess(result: any, account: any) {
        const tweetId = result.data?.id;
        const username = account.accountName || "twitter_user";
        const tweetUrl = `https://twitter.com/${username}/status/${tweetId}`;

        return {
            success: true,
            postId: tweetId,
            url: tweetUrl,
            platform: "Twitter"
        };
    }

    /**
     * Publish content to LinkedIn
     */
    async publishToLinkedIn(userId: string, content: string, mediaFiles: any[] = []) {
        try {
            const accounts = await this.storage.getSocialMediaAccounts(userId);
            const linkedInAccount = accounts.find(
                (acc) => acc.platform === "linkedin" && acc.isActive
            );

            if (!linkedInAccount || !linkedInAccount.accessToken) {
                throw new Error("LinkedIn account not connected or missing access token.");
            }

            // LinkedIn Token Expiry Check
            if (linkedInAccount.tokenExpiresAt) {
                const now = new Date();
                const expiresAt = new Date(linkedInAccount.tokenExpiresAt);
                // Check if expired
                if (now > expiresAt) {
                    logService.log("NODE", "WARN", "LinkedIn token expired", {
                        expiresAt: expiresAt.toISOString(),
                        userId
                    });
                    throw new Error("LinkedIn access token expired. Please reconnect your LinkedIn account.");
                }
            }

            const accessToken = linkedInAccount.accessToken;
            // Use accountId from DB which corresponds to user URN ID usually
            // If missing, we could fetch /me, but let's assume it's correct from login
            const personUrn = `urn:li:person:${linkedInAccount.accountId}`;

            let assetUrn = null;

            // Handle Media Upload (Single image support for now to match route logic)
            if (mediaFiles && mediaFiles.length > 0) {
                const file = mediaFiles[0];
                let buffer: Buffer;
                // Resolve buffer
                if (typeof file === 'string') {
                    const fullPath = file.startsWith("/") ? file : path.join(process.cwd(), "uploads", path.basename(file));
                    if (fs.existsSync(fullPath)) {
                        buffer = fs.readFileSync(fullPath);
                    } else {
                        throw new Error(`Media file not found: ${fullPath}`);
                    }
                } else if (file.buffer) {
                    buffer = file.buffer;
                } else {
                    throw new Error("Invalid media file format");
                }

                // Register
                const registerUrl = "https://api.linkedin.com/v2/assets?action=registerUpload";
                const registerBody = {
                    registerUploadRequest: {
                        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                        owner: personUrn,
                        serviceRelationships: [{
                            relationshipType: "OWNER",
                            identifier: "urn:li:userGeneratedContent",
                        }],
                    },
                };

                const registerResponse = await axios.post(registerUrl, registerBody, {
                    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
                });

                const uploadUrl = registerResponse.data.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
                assetUrn = registerResponse.data.value.asset;

                // Upload
                await axios.put(uploadUrl, buffer, {
                    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/octet-stream" }
                });
            }

            // Create Post
            const postBody: any = {
                author: personUrn,
                lifecycleState: "PUBLISHED",
                specificContent: {
                    "com.linkedin.ugc.ShareContent": {
                        shareCommentary: { text: content },
                        shareMediaCategory: assetUrn ? "IMAGE" : "NONE",
                    },
                },
                visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
            };

            if (assetUrn) {
                postBody.specificContent["com.linkedin.ugc.ShareContent"].media = [{
                    status: "READY",
                    description: { text: content.substring(0, 200) },
                    media: assetUrn,
                    title: { text: "Shared Image" }
                }];
            }

            const response = await axios.post("https://api.linkedin.com/v2/ugcPosts", postBody, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "X-Restli-Protocol-Version": "2.0.0",
                    "Content-Type": "application/json",
                },
            });

            const postId = response.data.id;
            return {
                success: true,
                postId: postId,
                url: `https://www.linkedin.com/feed/update/${postId}`,
                platform: "LinkedIn"
            };

        } catch (error: any) {
            logService.log("NODE", "ERROR", "SocialMediaService.publishToLinkedIn error:", error.message || error);
            throw error;
        }
    }
}

export const socialMediaService = new SocialMediaService();
