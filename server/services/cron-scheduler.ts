import { DatabaseStorage } from "../database-storage";
import { logger } from "./logger";
import { twitterOAuth } from "./twitter-oauth";

export class CronScheduler {
  private storage: DatabaseStorage;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.storage = new DatabaseStorage();
  }

  start() {
    if (this.isRunning) {
      logger.info("backend", "Cron scheduler already running");
      return;
    }

    this.isRunning = true;
    logger.info("backend", "Starting cron scheduler for social media posts");

    // Check every minute for posts to publish
    this.intervalId = setInterval(async () => {
      await this.checkAndPublishScheduledPosts();
    }, 60000); // Check every minute
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info("backend", "Cron scheduler stopped");
  }

  private async checkAndPublishScheduledPosts() {
    try {
      const now = new Date();

      // Get all scheduled social posts that are due to be published
      // We need to get all users' scheduled posts since this is system-wide cron
      const duePosts = await this.storage.getDueScheduledSocialPosts(now);

      if (duePosts.length === 0) {
        return;
      }

      logger.info(
        "backend",
        `Found ${duePosts.length} posts due for publishing`,
      );

      for (const post of duePosts) {
        try {
          await this.publishScheduledSocialPost(post);

          logger.info(
            "backend",
            `Successfully published post ${post.id} to ${post.platform}`,
          );
        } catch (error: any) {
          logger.error("backend", `Failed to publish post ${post.id}:`, error);

          // Move failed post to completed posts with error
          try {
            await this.storage.moveToCompletedSocialPosts(
              post,
              post.topic, // Use topic as fallback content
              "failed",
              undefined,
              error.message,
            );
          } catch (dbError) {
            logger.error(
              "backend",
              `Failed to move failed post to completed:`,
              dbError,
            );
          }
        }
      }
    } catch (error: any) {
      logger.error("backend", "Error checking scheduled posts:", error);
    }
  }

  private async publishScheduledSocialPost(scheduledPost: any) {
    try {
      logger.info(
        "backend",
        `Publishing scheduled post: ${scheduledPost.topic} on ${scheduledPost.platform}`,
      );

      // Generate content using CrewAI if pre-generated content is not available
      let generatedContent = "";

      if (scheduledPost.preGeneratedContent) {
        logger.info("backend", "Using pre-generated content");
        generatedContent = scheduledPost.preGeneratedContent;
      } else {
        // Generate content using external CrewAI service
        try {
          const response = await fetch(
            process.env.CREWAI_API_ENDPOINT ||
              `http://localhost:${process.env.CREWAI_PORT || 8000}/generate`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                topic: scheduledPost.topic,
                platform: scheduledPost.platform,
                tone: scheduledPost.tone || "professional",
              }),
            },
          );

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.result) {
              generatedContent = result.result;
              logger.info(
                "backend",
                `Content generated successfully via CrewAI API`,
              );
            } else {
              generatedContent = scheduledPost.topic;
              logger.warn("backend", "CrewAI API returned unsuccessful result");
            }
          } else {
            generatedContent = scheduledPost.topic;
            logger.warn(
              "backend",
              `CrewAI API responded with status: ${response.status}`,
            );
          }
        } catch (error) {
          logger.error(
            "backend",
            "CrewAI API unavailable, using topic as content:",
            error,
          );
          generatedContent = scheduledPost.topic;
        }
      }

      // Apply platform-specific content trimming (case-insensitive platform check)
      const platformLower = scheduledPost.platform.toLowerCase();
      if (platformLower === "mastodon" && generatedContent.length > 500) {
        generatedContent = generatedContent.substring(0, 500);
        logger.info("backend", "Trimmed Mastodon content to 500 characters");
      } else if (platformLower === "twitter" && generatedContent.length > 280) {
        generatedContent = generatedContent.substring(0, 277) + "...";
        logger.info("backend", "Trimmed Twitter content to 280 characters");
      }

      // Publish to platform
      let publishResult;
      switch (scheduledPost.platform.toLowerCase()) {
        case "mastodon":
          publishResult = await this.publishToMastodonScheduled(
            generatedContent,
            scheduledPost,
          );
          break;
        case "twitter":
          publishResult = await this.publishToTwitterScheduled(
            generatedContent,
            scheduledPost,
          );
          break;
        case "linkedin":
          publishResult = await this.publishToLinkedInScheduled(
            generatedContent,
            scheduledPost,
          );
          break;
        default:
          throw new Error(`Unsupported platform: ${scheduledPost.platform}`);
      }

      // Move to completed posts with success status
      await this.storage.moveToCompletedSocialPosts(
        scheduledPost,
        generatedContent,
        "published",
        publishResult,
      );
    } catch (error: any) {
      logger.error(
        "backend",
        `Error publishing scheduled post ${scheduledPost.id}:`,
        error,
      );
      throw error;
    }
  }

  private async publishToMastodonScheduled(
    content: string,
    scheduledPost: any,
  ) {
    // Use credentials from scheduled post
    if (!scheduledPost.credentials?.mastodon_access_token) {
      throw new Error("Mastodon access token not found in scheduled post");
    }

    const instanceUrl = scheduledPost.credentials.mastodon_instance?.startsWith(
      "http",
    )
      ? scheduledPost.credentials.mastodon_instance
      : `https://${scheduledPost.credentials.mastodon_instance || "mastodon.social"}`;

    // Handle media uploads if present
    let mediaIds: string[] = [];
    if (scheduledPost.mediaUrls && scheduledPost.mediaUrls.length > 0) {
      for (const mediaUrl of scheduledPost.mediaUrls) {
        try {
          // Fetch media file
          const mediaResponse = await fetch(mediaUrl);
          if (mediaResponse.ok) {
            const mediaBlob = await mediaResponse.blob();

            // Create form data for media upload
            const formData = new FormData();
            formData.append("file", mediaBlob);

            // Upload to Mastodon
            const uploadResponse = await fetch(`${instanceUrl}/api/v2/media`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${scheduledPost.credentials.mastodon_access_token}`,
              },
              body: formData,
            });

            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              mediaIds.push(uploadData.id);
              logger.info(
                "backend",
                `Uploaded media to Mastodon: ${uploadData.id}`,
              );
            }
          }
        } catch (mediaError) {
          logger.error("backend", `Failed to upload media: ${mediaError}`);
        }
      }
    }

    // Create status payload
    const statusPayload: any = { status: content };
    if (mediaIds.length > 0) {
      statusPayload.media_ids = mediaIds;
    }

    const response = await fetch(`${instanceUrl}/api/v1/statuses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${scheduledPost.credentials.mastodon_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(statusPayload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Mastodon API error: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    return { url: result.url, id: result.id };
  }

  private async publishToLinkedInScheduled(
    content: string,
    scheduledPost: any,
  ) {
    // Use credentials from scheduled post (LinkedIn OAuth would be stored here)
    if (!scheduledPost.credentials?.linkedin_access_token) {
      throw new Error("LinkedIn access token not found in scheduled post");
    }

    // Get LinkedIn user info
    const meRes = await fetch("https://api.linkedin.com/v2/me", {
      headers: {
        Authorization: `Bearer ${scheduledPost.credentials.linkedin_access_token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });

    if (!meRes.ok) {
      throw new Error(`Failed to get LinkedIn user info: ${meRes.status}`);
    }

    const me = await meRes.json();
    const authorURN = `urn:li:person:${me.id}`;

    const postPayload = {
      author: authorURN,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: content },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${scheduledPost.credentials.linkedin_access_token}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postPayload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`LinkedIn API error: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    return { id: result.id };
  }

  private async publishToTwitterScheduled(content: string, scheduledPost: any) {
    // Use credentials from scheduled post
    if (!scheduledPost.credentials?.twitter_access_token) {
      throw new Error("Twitter access token not found in scheduled post");
    }

    const accessToken = scheduledPost.credentials.twitter_access_token;

    // Verify token is still valid
    const isValid = await twitterOAuth.verifyToken(accessToken);
    if (!isValid) {
      throw new Error("Twitter access token is invalid or expired");
    }

    // Post tweet (note: media is not supported for Twitter in scheduled posts)
    const result = await twitterOAuth.postTweet(accessToken, content);

    const tweetId = result.data?.id;
    const username =
      scheduledPost.credentials.twitter_username || "twitter_user";
    const tweetUrl = `https://twitter.com/${username}/status/${tweetId}`;

    logger.info("backend", `Successfully posted scheduled tweet: ${tweetId}`);

    return {
      url: tweetUrl,
      id: tweetId,
      text: result.data?.text,
    };
  }
}

// Singleton instance
export const cronScheduler = new CronScheduler();
