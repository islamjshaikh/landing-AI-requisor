import { storage } from "../database-storage";
import { config } from "../config/environment";
import { socialMediaService } from "./social-media-service";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import FormData from "form-data";
import axios from "axios";

export async function executeScheduledPost(scheduledPost: any) {
    let generatedContent = "";
    try {
        // Get fresh data from database to ensure we have the latest edits
        const allScheduledPosts = await storage.getScheduledSocialPosts(
            scheduledPost.userId,
        );
        const freshPost = allScheduledPosts.find(
            (post) => post.id === scheduledPost.id,
        );
        if (!freshPost) {
            console.error(
                `[CRON] ❌ Scheduled post ${scheduledPost.id} not found in database - skipping execution`,
            );
            return;
        }

        // Use fresh data from database instead of cached data
        const postToExecute = {
            ...scheduledPost,
            topic: freshPost.topic,
            tone: freshPost.tone,
            preGeneratedContent: freshPost.preGeneratedContent, // CRITICAL: Copy the latest content edits
            // Keep other fields that might not be in database (like credentials)
            credentials: scheduledPost.credentials,
        };

        console.log(
            `[CRON] ⏰ Executing scheduled post: ${postToExecute.topic} on ${postToExecute.platform}`,
        );

        // Ensure we have userId for database operations
        if (!postToExecute.userId) {
            console.error(
                `[CRON] ❌ No userId found for scheduled post ${postToExecute.id} - skipping execution`,
            );
            return;
        }

        // Update status to executing
        postToExecute.status = "executing";

        if (postToExecute.preGeneratedContent) {
            console.log(`[CRON] 📝 Using pre-generated content from user preview`);
            generatedContent = postToExecute.preGeneratedContent;
        } else {
            // Generate content using separate CrewAI service
            try {
                console.log(
                    `[CRON] 🔄 Calling CrewAI service for content generation`,
                );
                console.log(`[CRON] 🔍 DEBUG: CrewAI URL: ${config.api.crewai}`);

                const requestPayload = {
                    topic: postToExecute.topic,
                    platform: postToExecute.platform.toLowerCase(),
                    tone: postToExecute.tone,
                };
                console.log(`[CRON] 🔍 DEBUG: Request payload:`, requestPayload);

                const response = await fetch(config.api.crewai, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(requestPayload),
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.result) {
                        generatedContent = result.result;
                        console.log(
                            `[CRON] ✅ Content generated via CrewAI service: "${generatedContent.substring(0, 100)}..."`,
                        );
                    } else {
                        throw new Error("CrewAI service returned unsuccessful result");
                    }
                } else {
                    const errorText = await response.text();
                    throw new Error(
                        `CrewAI service responded with status: ${response.status} - ${errorText}`,
                    );
                }
            } catch (crewaiError: any) {
                console.log(
                    `[CRON] ❌ CrewAI service failed: ${crewaiError.message}`,
                );
                // Use topic as content since CrewAI is the only allowed generator
                generatedContent = `Content generation failed for: ${postToExecute.topic}`;
            }
        }

        // Apply platform-specific content trimming
        if (
            postToExecute.platform === "Mastodon" &&
            generatedContent.length > 500
        ) {
            generatedContent = generatedContent.substring(0, 500);
            console.log(`[CRON] ✂️ Trimmed Mastodon content to 500 characters`);
        }

        // Store the generated content for history
        postToExecute.publishedContent = generatedContent;

        // Publish to platform
        if (
            postToExecute.platform === "Mastodon" &&
            postToExecute.credentials.mastodon_access_token
        ) {
            // Mastodon publishing logic
            const truncatedContent =
                generatedContent.length > 500
                    ? generatedContent.substring(0, 497) + "..."
                    : generatedContent;

            const instanceUrl =
                postToExecute.credentials.mastodon_instance.startsWith("http")
                    ? postToExecute.credentials.mastodon_instance
                    : `https://${postToExecute.credentials.mastodon_instance}`;

            // Handle media attachments if any
            let mediaIds: string[] = [];
            const mediaUrls = Array.isArray(postToExecute.mediaUrls)
                ? postToExecute.mediaUrls
                : [];

            if (mediaUrls.length > 0) {
                console.log(
                    `[CRON] 📎 Uploading ${mediaUrls.length} media files to Mastodon`,
                );

                for (const mediaPath of mediaUrls) {
                    try {
                        if (!mediaPath || typeof mediaPath !== "string") continue;

                        // Local file path - read directly from filesystem
                        const fullPath = mediaPath.startsWith("/")
                            ? mediaPath
                            : path.join(process.cwd(), "uploads", path.basename(mediaPath));

                        if (!fs.existsSync(fullPath)) {
                            console.error(`[CRON] ❌ Media file not found: ${fullPath}`);
                            continue;
                        }

                        const fileBuffer = fs.readFileSync(fullPath);
                        const mimeType = mime.lookup(fullPath) || "image/jpeg";
                        const fileName = path.basename(fullPath);

                        const formData = new FormData();
                        formData.append("file", fileBuffer, { filename: fileName, contentType: mimeType });

                        const uploadResponse = await axios.post(
                            `${instanceUrl}/api/v2/media`,
                            formData,
                            {
                                headers: {
                                    Authorization: `Bearer ${scheduledPost.credentials.mastodon_access_token}`,
                                    ...formData.getHeaders(),
                                },
                            }
                        );

                        if (uploadResponse.status === 200) {
                            mediaIds.push(uploadResponse.data.id);
                            console.log(
                                `[CRON] ✅ Successfully uploaded media file: ${fileName}`,
                            );
                        }
                    } catch (error) {
                        console.error(`[CRON] ❌ Error uploading media file:`, error);
                    }
                }
            }

            const statusPayload: any = {
                status: truncatedContent,
            };

            if (mediaIds.length > 0) {
                statusPayload.media_ids = mediaIds;
            }

            const mastodonResponse = await fetch(`${instanceUrl}/api/v1/statuses`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${scheduledPost.credentials.mastodon_access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(statusPayload),
            });

            if (mastodonResponse.ok) {
                const responseData = await mastodonResponse.json();
                scheduledPost.status = "published";
                scheduledPost.publishedUrl = responseData.url;
                console.log(
                    `[CRON] 🎉 Successfully published to Mastodon`,
                );
            } else {
                scheduledPost.status = "failed";
                const errorText = await mastodonResponse.text();
                scheduledPost.error = `Mastodon API error: ${mastodonResponse.status} - ${errorText}`;
            }

        } else if (postToExecute.platform.toLowerCase() === "twitter") {
            // Twitter publishing logic via Service (handles fresh tokens & refresh)
            console.log(`[CRON] 🐦 Publishing to Twitter for: ${postToExecute.topic}`);

            try {
                // Determine mediaUrls
                const mediaUrls = Array.isArray(postToExecute.mediaUrls) ? postToExecute.mediaUrls : [];

                const result = await socialMediaService.publishToTwitter(
                    postToExecute.userId,
                    generatedContent,
                    mediaUrls
                );

                if (result.success) {
                    scheduledPost.status = "published";
                    scheduledPost.publishedUrl = result.url;
                    console.log(`[CRON] 🎉 Successfully published to Twitter: ${result.url}`);
                } else {
                    throw new Error("Twitter publish returned unsuccessful result");
                }
            } catch (twitterError: any) {
                // Enhanced error logging
                const errorDetails = twitterError.response?.data ? JSON.stringify(twitterError.response.data) : twitterError.message;
                console.error(`[CRON] ❌ Twitter API Error Details:`, errorDetails);

                scheduledPost.status = "failed";
                scheduledPost.error = `Twitter API error: ${errorDetails}`;
            }

        } else if (
            postToExecute.platform.toLowerCase() === "facebook" &&
            postToExecute.credentials.facebook_page_access_token &&
            postToExecute.credentials.facebook_page_id
        ) {
            // Facebook publishing logic via Service (Unified)
            console.log(`[CRON] 📝 Publishing to Facebook for: ${postToExecute.topic}`);

            try {
                // Determine mediaUrls
                const mediaUrls = Array.isArray(postToExecute.mediaUrls) ? postToExecute.mediaUrls : [];

                const result = await socialMediaService.publishToFacebook(
                    postToExecute.userId,
                    generatedContent,
                    mediaUrls
                );

                if (result.success) {
                    scheduledPost.status = "published";
                    scheduledPost.publishedUrl = result.url;
                    console.log(`[CRON] 🎉 Successfully published to Facebook: ${result.url}`);
                } else {
                    throw new Error("Facebook publish returned unsuccessful result");
                }

            } catch (fbError: any) {
                // Enhanced error logging
                const errorDetails = fbError.response?.data ? JSON.stringify(fbError.response.data) : fbError.message;
                console.error(`[CRON] ❌ Facebook API Error Details:`, errorDetails);

                scheduledPost.status = "failed";
                scheduledPost.error = `Facebook API error: ${errorDetails}`;
            }

        } else if (postToExecute.platform.toLowerCase() === 'linkedin') {
            // Real LinkedIn publishing using the shared service
            console.log(`[CRON] 👔 Publishing to LinkedIn for: ${postToExecute.topic}`);

            try {
                // Determine mediaUrls
                const mediaUrls = Array.isArray(postToExecute.mediaUrls) ? postToExecute.mediaUrls : [];

                const result = await socialMediaService.publishToLinkedIn(
                    postToExecute.userId,
                    generatedContent,
                    mediaUrls
                );

                if (result.success) {
                    scheduledPost.status = "published";
                    scheduledPost.publishedUrl = result.url;
                    console.log(`[CRON] 🎉 Successfully published to LinkedIn: ${result.url}`);
                } else {
                    throw new Error("LinkedIn publish returned unsuccessful status");
                }
            } catch (liError: any) {
                scheduledPost.status = "failed";
                scheduledPost.error = `LinkedIn API error: ${liError.message}`;
                console.error(`[CRON] ❌ Failed to publish to LinkedIn:`, liError.message);
            }

        } else {
            scheduledPost.status = "completed";
            console.log(
                `[CRON] ✅ Scheduled post completed (platform: ${scheduledPost.platform})`,
            );
        }

        scheduledPost.executedAt = new Date().toISOString();

        // Move completed/failed posts to history in database
        if (
            scheduledPost.status === "published" ||
            scheduledPost.status === "completed" ||
            scheduledPost.status === "failed"
        ) {
            try {
                await storage.moveToCompletedSocialPosts(
                    scheduledPost,
                    generatedContent,
                    scheduledPost.status,
                    scheduledPost.publishedUrl
                        ? { url: scheduledPost.publishedUrl }
                        : undefined,
                    scheduledPost.error,
                );
                console.log(
                    `[CRON] ✅ Moved scheduled post to completed posts with status: ${scheduledPost.status}`,
                );
            } catch (dbError) {
                console.error(
                    `[CRON] ❌ Failed to move post to completed posts:`,
                    dbError,
                );
            }

            // --- SEND EMAIL NOTIFICATION ON SUCCESS ---
            if (scheduledPost.status === "published" && scheduledPost.publishedUrl) {
                try {
                    // Fetch user email
                    const user = await storage.getUser(scheduledPost.userId);
                    if (user && user.email) {
                        console.log(`[CRON] 📧 Sending success email to ${user.email}`);
                        const { sendPostSuccessEmail } = await import("./email-service"); // Dynamic import to avoid circular dep risks
                        await sendPostSuccessEmail(
                            user.email,
                            user.username || "Creator",
                            scheduledPost.platform,
                            scheduledPost.publishedUrl,
                            generatedContent || scheduledPost.topic
                        );
                        console.log(`[CRON] ✅ Success email sent.`);
                    } else {
                        console.warn(`[CRON] ⚠️ User or email not found for post ${scheduledPost.id}, skipping email.`);
                    }
                } catch (emailError: any) {
                    // Important: Email failure should not mark the post as failed since it's already published
                    console.error(`[CRON] ❌ Failed to send success email:`, emailError.message);
                }
            }
        }
    } catch (error: any) {
        console.error(`[CRON] ❌ Error executing scheduled post:`, error);
        scheduledPost.status = "failed";
        scheduledPost.error = error.message;
        scheduledPost.executedAt = new Date().toISOString();

        // Move failed posts to history in database
        try {
            await storage.moveToCompletedSocialPosts(
                scheduledPost,
                generatedContent || scheduledPost.topic,
                "failed",
                undefined,
                error.message,
            );
            console.log(`[CRON] ✅ Moved failed post to completed posts`);
        } catch (dbError) {
            console.error(
                `[CRON] ❌ Failed to move failed post to completed posts:`,
                dbError,
            );
        }
    }
}

