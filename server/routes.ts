import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { DatabaseStorage } from "./database-storage";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import mime from "mime-types";
import { config } from "./config/environment";import teamsRoutes from "./routes/teams-routes";
import { db, pool } from "./db";
import { projects, tasks, evidenceItems, featureCandidates, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
import { trackTokenUsage, checkTokenBudget, getTokenUsageSummary, ensureTokenBudget, getModelForBudget } from "./services/token-tracker";
import {
  loginLimiter,
  registerLimiter,
  sensitiveAuthLimiter,
  apiLimiter,
} from "./security/rate-limiters";
import { secureRandomId, pickAllowedFields } from "./security/helpers";

const storage = new DatabaseStorage();

function computeTitleContentSimilarity(
  titleA: string, contentA: string,
  titleB: string, contentB: string,
  insightTypeA?: string | null, insightTypeB?: string | null,
): boolean {
  if (insightTypeA && insightTypeB && insightTypeA !== insightTypeB) return false;
  const tA = titleA.toLowerCase().trim();
  const tB = titleB.toLowerCase().trim();
  if (tA === tB) return true;
  const shorter = tA.length < tB.length ? tA : tB;
  const longer = tA.length < tB.length ? tB : tA;
  if (shorter.length > 5 && longer.includes(shorter)) return true;
  const w1 = new Set(tA.split(/\s+/));
  const w2 = new Set(tB.split(/\s+/));
  const inter = [...w1].filter((w) => w2.has(w));
  const uni = new Set([...w1, ...w2]);
  const titleSim = uni.size > 0 ? inter.length / uni.size : 0;
  if (titleSim >= 0.6) return true;
  if (titleSim >= 0.3 && contentA && contentB) {
    const cWords1 = new Set(contentA.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const cWords2 = new Set(contentB.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const cInter = [...cWords1].filter(w => cWords2.has(w));
    const cUni = new Set([...cWords1, ...cWords2]);
    const contentSim = cUni.size > 0 ? cInter.length / cUni.size : 0;
    if (contentSim >= 0.4) return true;
  }
  return false;
}

async function findOrBumpEvidence(
  existingItems: any[],
  newItem: { title: string; content: string; source: string; insightType?: string | null; originId?: string },
): Promise<{ match: any | null }> {
  const match = existingItems.find((existing: any) =>
    computeTitleContentSimilarity(
      newItem.title, newItem.content,
      existing.title || "", existing.content || "",
      newItem.insightType, existing.insightType,
    )
  );
  if (!match) return { match: null };

  const originKey = newItem.originId || `${newItem.source}_${Date.now()}`;
  const existingOrigins: string[] = Array.isArray(match.metadata?.mentionOrigins)
    ? match.metadata.mentionOrigins
    : [`${match.source || "unknown"}_original`];
  const isNewOrigin = !existingOrigins.includes(originKey);
  if (!isNewOrigin) {
    return { match: { ...match } };
  }

  const updatedOrigins = [...existingOrigins, originKey];
  const existingSourceTypes: string[] = Array.isArray(match.metadata?.mentionSources)
    ? match.metadata.mentionSources
    : [match.source || "unknown"];
  const updatedSourceTypes = existingSourceTypes.includes(newItem.source)
    ? existingSourceTypes
    : [...existingSourceTypes, newItem.source];
  const newCount = (match.mentionCount || 1) + 1;

  await db
    .update(evidenceItems)
    .set({
      mentionCount: newCount,
      updatedAt: new Date(),
      metadata: {
        ...(match.metadata || {}),
        mentionOrigins: updatedOrigins,
        mentionSources: updatedSourceTypes,
        distinctSourceCount: updatedSourceTypes.length,
        totalMentions: newCount,
      },
    })
    .where(eq(evidenceItems.id, match.id));
  match.mentionCount = newCount;
  match.metadata = {
    ...(match.metadata || {}),
    mentionOrigins: updatedOrigins,
    mentionSources: updatedSourceTypes,
    distinctSourceCount: updatedSourceTypes.length,
    totalMentions: newCount,
  };
  return { match: { ...match, mentionCount: newCount } };
}

import * as crypto from "crypto";
import { z } from "zod";
import {
  insertProjectSchema,
  insertTaskSchema,
  insertIntegrationSchema,
  insertInsightSchema,
  insertKanbanColumnSchema,
  insertProjectInvitationSchema,
  insertTeamMemberSchema,
  insertSmartTaskAssignmentSchema,
  insertCapacityAlertSchema,
  ProjectRole,
  ToolStatus,
  insertSocialMediaAccountSchema,
  insertSocialMediaGoalSchema,
  insertSocialMediaBrandProfileSchema,
  insertSocialMediaPostSchema,
  insertSocialMediaPostMetricsSchema,
  insertSocialMediaContentTemplateSchema,
  insertAiAgentSchema,
  insertFormSchema,
  insertFormSubmissionSchema,
} from "@shared/schema";
import {
  analyzeProjectForBottlenecks,
  generateProjectPlan,
  generateActionPlan,
  deepProjectAnalysis,
} from "./lib/openai";
import { getSmartsheetData } from "./lib/smartsheet";
import { taskSyncService } from "./lib/taskSync";
import { setupAuth, isAuthenticated } from "./auth";
import { getAiClient, userHasOwnKey, transcriptionCreateForUser, TranscriptionUnavailableError, getSafeAiSettings, saveAiSettings, deleteAiSettings, testAnthropicKey, testTranscriptionKey } from "./services/ai-provider";
import { runWithAiContext } from "./services/ai-context";
import { setupDatabase } from "./db-setup";
import { fileProcessor } from "./services/file-processor";
import {
  analyzeTask,
  getToolRecommendationsForTask,
  updateToolRecommendationStatus,
} from "./lib/task-analysis";
import twitterOAuthRoutes from "./routes/twitter-oauth";
import { twitterOAuth } from "./services/twitter-oauth";
import {
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "./services/email-service";
import { generateSmartAssignments } from "./services/smart-assignments";
import integrationRoutes from "./routes/integration-routes";
import mastodonOAuthRoutes from "./routes/mastodon-oauth";
import instagramOAuthRoutes from "./routes/instagram-oauth";
import facebookOAuthRoutes from "./routes/facebook-oauth";

import facebookSocialRoutes from "./routes/facebook-social";
import linkedinOAuthRoutes from "./routes/linkedin-oauth";
import linkedinSocialRoutes from "./routes/linkedin-social";

import { logger } from "./services/logger";
console.log(
  "[Routes] Facebook social routes imported:",
  !!facebookSocialRoutes,
);

import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import {
  logService,
  logCrewAI,
  logProduction,
  logHealth,
  logNode,
} from "./services/log-service";
import logRoutes from "./routes/log-routes";
// Clean AI agent imports
// Chat persistence functionality is handled through DatabaseStorage
// OpenAI removed - using only custom Python CrewAI scripts
import { jiraAgent } from "./services/jira-agent";
import { jiraIntegration } from "./services/jira-integration";
import { jiraService } from "./services/jira-service";
import type { JiraIntegration, UserStory } from "@shared/schema";
import Stripe from "stripe";
import { nlpTaskUpdater } from "./nlpPlanUpdater";
import { processUserPrompt } from "./services/gemini-agent";
// `executeScheduledPost` is defined locally further down in this file; the
// module-level import was shadowed and therefore dead code.

async function ensureVerificationTable() {
  // Creates a simple token store if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS verification_tokens (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL,
      token VARCHAR NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE
    );
  `);
}

// Initialize Stripe
let stripe: Stripe | null = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-07-30.basil",
    });
    console.log("Stripe initialized successfully");
  } else {
    console.warn("STRIPE_SECRET_KEY not found in environment variables");
  }
} catch (error) {
  console.error("Failed to initialize Stripe:", error);
}

// Configure multer for file uploads
const uploadsDir = config.media.uploadsDir.startsWith("./")
  ? path.join(process.cwd(), config.media.uploadsDir.substring(2))
  : config.media.uploadsDir;
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/wav",
      "audio/x-wav",
      "audio/m4a",
      "audio/x-m4a",
      "audio/webm",
      "video/mp4",
      "video/webm",
      "application/json",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only images, PDFs, documents, and audio/video files are allowed.",
        ),
      );
    }
  },
});

function naiveToUtc(naiveDatetime: string, timeZone: string): Date {
  const clean = naiveDatetime.replace(/[Z]$/i, "").replace(/[+-]\d{2}:\d{2}$/, "").split(".")[0];
  const asUtc = new Date(clean + "Z");
  if (isNaN(asUtc.getTime())) return new Date(naiveDatetime);
  try {
    const getOffset = (refUtc: Date): number => {
      const utcStr = refUtc.toLocaleString("en-US", { timeZone: "UTC" });
      const tzStr = refUtc.toLocaleString("en-US", { timeZone });
      return new Date(utcStr).getTime() - new Date(tzStr).getTime();
    };
    const offset1 = getOffset(asUtc);
    const adjusted = new Date(asUtc.getTime() + offset1);
    const offset2 = getOffset(adjusted);
    return new Date(asUtc.getTime() + offset2);
  } catch {
    return new Date(naiveDatetime);
  }
}

function isNaiveDatetime(dt: string): boolean {
  return !dt.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(dt);
}

export async function registerRoutes(app: Express): Promise<void> {
  // CRITICAL: Setup authentication FIRST before any authenticated routes
  await setupAuth(app);

  // Bind the authenticated user into async-local storage so provider-aware
  // AI clients (getAiClient) route to the user's own Claude key when active.
  // Must run AFTER auth so req.user is populated.
  app.use((req: any, _res, next) => {
    const userId = req.user?.dbUserId || req.user?.claims?.sub;
    runWithAiContext({ userId }, () => next());
  });

  // Social Media OAuth Routes
  app.use("/api/auth", twitterOAuthRoutes);
  app.use("/api/auth", mastodonOAuthRoutes);
  app.use("/api/auth", instagramOAuthRoutes);
  app.use("/api/auth", facebookOAuthRoutes);
  app.use("/api/auth", linkedinOAuthRoutes);

  // Social Media Social Routes
  app.use("/api/social", facebookSocialRoutes);
  app.use("/api/social", linkedinSocialRoutes);

  // CREWAI SERVICE CONTENT GENERATION (Calls separate FastAPI service)
  app.post("/api/social/generate-post", async (req: any, res) => {
    try {
      console.log(
        "🚀 [SOCIAL MEDIA] Starting CrewAI service content generation...",
      );
      logService.log("CREWAI", "INFO", "Content generation request received");

      const { topic, platform, tone } = req.body;

      if (!topic || !platform) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: topic and platform",
        });
      }

      // Call separate CrewAI service
      logService.log(
        "CREWAI",
        "INFO",
        `Forwarding to CrewAI service: ${topic}, platform: ${platform}`,
      );

      const response = await fetch(config.api.crewai, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          platform: platform.toLowerCase(),
          tone: tone || "professional",
        }),
      });

      if (!response.ok) {
        throw new Error(
          `CrewAI service responded with status: ${response.status}`,
        );
      }

      const result = await response.json();

      if (result.success) {
        logService.log("CREWAI", "INFO", "Content generation successful");
        res.json({
          success: true,
          result: result,
          source: "crewai-service",
        });
      } else {
        throw new Error(result.error || "Content generation failed");
      }
    } catch (error: any) {
      logService.log(
        "CREWAI",
        "ERROR",
        `Content generation error: ${error.message}`,
      );
      res.status(500).json({
        success: false,
        error: error.message || "Content generation failed",
        source: "crewai-service-error",
      });
    }
  });

  app.patch(
    "/api/projects/:projectId/tasks/reorder",
    isAuthenticated,
    async (req: any, res) => {
      const projectId = parseInt(req.params.projectId);
      const { taskIds } = req.body;

      // Verify user has access
      const hasAccess = await storage.isUserAuthorized(
        projectId,
        req.user!.id,
        "editor",
      );
      if (!hasAccess) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Update positions
      for (let i = 0; i < taskIds.length; i++) {
        await db
          .update(tasks)
          .set({ position: i })
          .where(eq(tasks.id, taskIds[i]));
      }

      res.json({ message: "Task positions updated" });
    },
  );

  // Calendar/Schedule API Routes
  app.get("/api/schedule", isAuthenticated, async (req: any, res) => {
    try {
      // Get authenticated user ID
      const userId = req.user?.dbUserId || req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get scheduled posts from database
      const scheduledPosts = await storage.getScheduledSocialPosts(userId);

      // Map preGeneratedContent to content for frontend consistency
      const mappedPosts = scheduledPosts.map((post: any) => ({
        ...post,
        content: post.preGeneratedContent || post.topic || "Scheduled content",
      }));

      res.json(mappedPosts);
    } catch (error: any) {
      console.error("Error fetching schedule:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch schedule", message: error.message });
    }
  });

  app.post(
    "/api/schedule",
    isAuthenticated,
    upload.array("media", 10),
    async (req: any, res) => {
      try {
        // Extract data from both body and form fields (since FormData sends fields as strings)
        const userId = req.user?.dbUserId || req.user?.claims?.sub;
        const topic = req.body.topic;
        const tone = req.body.tone;
        const platform = req.body.platform;
        const run_at_iso = req.body.run_at_iso;
        const timezone = req.body.timezone;
        const tz_offset_minutes = req.body.tz_offset_minutes;
        const mastodon_instance = req.body.mastodon_instance;
        const mastodon_access_token = req.body.mastodon_access_token;
        const mediaUrls = req.body.mediaUrls
          ? JSON.parse(req.body.mediaUrls)
          : [];
        const preGeneratedContent = req.body.preGeneratedContent;
        // Get Twitter credentials from session if platform is Twitter
        const twitter_access_token =
          platform.toLowerCase() === "twitter"
            ? req.session.twitterAccessToken
            : null;
        const twitter_username =
          platform.toLowerCase() === "twitter"
            ? req.session.twitterUsername
            : null;

        // Facebook page discovery: log which Page would be used. The actual
        // page token + id are resolved at publish time by the social
        // scheduler from stored OAuth credentials — we don't need to capture
        // them into local variables here.
        if (platform.toLowerCase() === "facebook") {
          const accounts = await storage.getSocialMediaAccounts(userId);
          const fbAccount = accounts.find(
            (acc) => acc.platform === "facebook" && acc.isActive,
          );

          if (fbAccount && fbAccount.accessToken) {
            const FB_API_VERSION = "v21.0";
            try {
              // Token sent via Authorization header (not query string) so it
              // doesn't end up in proxy/browser/error-monitor logs.
              const pagesUrl = `https://graph.facebook.com/${FB_API_VERSION}/me/accounts`;
              const pagesResponse = await fetch(pagesUrl, {
                headers: { Authorization: `Bearer ${fbAccount.accessToken}` },
              });
              const pagesData = await pagesResponse.json();

              if (pagesData.data && pagesData.data.length > 0) {
                const firstPage = pagesData.data[0];
                console.log(
                  `[SCHEDULE] Found Facebook Page: ${firstPage.name} (${firstPage.id})`,
                );
              } else {
                console.warn(`[SCHEDULE] No Facebook Pages found for user`);
              }
            } catch (e) {
              console.error(`[SCHEDULE] Failed to fetch Facebook pages:`, e);
            }
          } else {
            console.warn(
              `[SCHEDULE] No active Facebook account found for user`,
            );
          }
        }
        console.log(
          `[SCHEDULE] 📝 Pre-generated content received:`,
          preGeneratedContent
            ? `"${preGeneratedContent.substring(0, 100)}..."`
            : "null",
        );

        if (!topic || !platform || !run_at_iso) {
          return res
            .status(400)
            .json({ error: "Topic, platform, and run_at_iso are required" });
        }
        // Validate platform-specific credentials
        if (platform.toLowerCase() === "twitter" && !twitter_access_token) {
          return res.status(400).json({
            error:
              "Twitter authentication required. Please connect your Twitter account first.",
          });
        }

        // Parse the user's scheduled time and handle timezone
        const scheduledTime = new Date(run_at_iso);
        const userTimezone = timezone || "UTC";
        const now = new Date();

        // Validate that scheduled time is in the future
        if (scheduledTime <= now) {
          return res.status(400).json({
            error:
              "Cannot schedule posts for past times. Please select a future date and time.",
          });
        }

        console.log(`[SCHEDULE] Scheduling ${platform} post: "${topic}"`);
        console.log(`[SCHEDULE] User timezone: ${userTimezone}`);
        console.log(`[SCHEDULE] Scheduled for: ${scheduledTime.toISOString()}`);
        console.log(`[SCHEDULE] Local time: ${scheduledTime.toLocaleString()}`);

        // Handle uploaded media files
        let mediaFilePaths: string[] = [];
        if (req.files && Array.isArray(req.files)) {
          mediaFilePaths = req.files.map((file: any) => file.path);
          console.log(
            `[SCHEDULE] 📎 ${req.files.length} media files uploaded:`,
            mediaFilePaths,
          );
        }

        // userId is already declared at the top of the function
        console.log(`[SCHEDULE] Using userId:`, userId);

        // Create scheduled post object with userId included for cron execution
        const scheduledPost = {
          id: Date.now().toString(),
          userId, // CRITICAL: Include userId for cron job execution
          topic,
          tone,
          platform,
          scheduledTime: scheduledTime.toISOString(),
          userTimezone,
          status: "scheduled",
          mediaUrls: mediaUrls || [], // Store any existing media URLs
          mediaFilePaths, // Store uploaded file paths
          preGeneratedContent: preGeneratedContent || null, // Store pre-edited content if provided
          credentials: {
            mastodon_instance,
            mastodon_access_token,
            twitter_access_token,
            twitter_username,
          },
          createdAt: new Date().toISOString(),
        };

        // Store the scheduled post in database
        const createdPost = await storage.createScheduledSocialPost({
          id: scheduledPost.id,
          userId,
          topic: scheduledPost.topic,
          tone: scheduledPost.tone,
          platform: scheduledPost.platform,
          scheduledTime: new Date(scheduledPost.scheduledTime),
          userTimezone: scheduledPost.userTimezone,
          status: scheduledPost.status,
          mediaUrls: [
            ...scheduledPost.mediaUrls,
            ...scheduledPost.mediaFilePaths,
          ],
          preGeneratedContent: scheduledPost.preGeneratedContent,
          credentials: scheduledPost.credentials,
        });

        // Use the actual database-stored ID for consistency
        scheduledPost.id = createdPost.id;

        console.log(
          `[SCHEDULE] ✅ Post saved to database - CronScheduler will handle execution at ${scheduledTime.toISOString()}`,
        );

        // Set up a timeout to execute the post at the scheduled time
        const delay = scheduledTime.getTime() - Date.now();

        // Prepare scheduledPost with combined media paths for execution
        const executionPost = {
          ...scheduledPost,
          mediaUrls: [
            ...scheduledPost.mediaUrls,
            ...scheduledPost.mediaFilePaths,
          ], // Combine both arrays
        };

        if (delay > 0) {
          setTimeout(async () => {
            await executeScheduledPost(executionPost);
          }, delay);
          console.log(
            `[CRON] Post scheduled to execute in ${Math.round(delay / 1000)} seconds`,
          );
        } else {
          console.log(
            `[CRON] WARNING: Scheduled time is in the past, executing immediately`,
          );
          await executeScheduledPost(executionPost);
        }

        res.json({
          success: true,
          message: "Post scheduled successfully and cron job set up",
          scheduledTime: scheduledTime.toISOString(),
          userTimezone,
          platform,
          topic,
          tone,
          id: scheduledPost.id,
        });
      } catch (error: any) {
        console.error("Error scheduling post:", error);
        res
          .status(500)
          .json({ error: "Failed to schedule post", message: error.message });
      }
    },
  );

  // CrewAI proxy endpoint - calls separate CrewAI service
  app.post("/api/crewai/generate", async (req, res) => {
    try {
      const { topic, platform, tone } = req.body;

      logService.log(
        "CREWAI",
        "INFO",
        "Content generation request received via proxy",
      );
      logService.log(
        "CREWAI",
        "INFO",
        `Forwarding to CrewAI service: ${topic}, platform: ${platform}`,
      );

      // Call separate CrewAI service
      const response = await fetch(config.api.crewai, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          platform: platform.toLowerCase(),
          tone: tone || "professional",
        }),
      });

      if (!response.ok) {
        throw new Error(
          `CrewAI service responded with status: ${response.status}`,
        );
      }

      const result = await response.json();

      if (result.success) {
        logService.log("CREWAI", "INFO", "Content generation successful");
        res.json({
          success: true,
          result: result,
          source: "crewai-service",
        });
      } else {
        throw new Error(result.error || "Content generation failed");
      }
    } catch (error: any) {
      logService.log(
        "CREWAI",
        "ERROR",
        `Content generation error: ${error.message}`,
      );
      res.status(500).json({
        success: false,
        error: error.message || "Content generation failed",
        source: "crewai-service-error",
      });
    }
  });

  // Chat Session Management
  app.get("/api/agent/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const sessions = await storage.getChatSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.post("/api/agent/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const session = await storage.createChatSession(userId);
      res.json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.get(
    "/api/agent/sessions/:sessionId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;
        const history = await storage.getChatHistory(sessionId);
        res.json(history);
      } catch (error) {
        console.error("Error fetching session history:", error);
        res.status(500).json({ error: "Failed to fetch history" });
      }
    },
  );

  app.delete(
    "/api/agent/sessions/:sessionId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;
        await storage.deleteChatSession(sessionId);
        res.sendStatus(200);
      } catch (error) {
        console.error("Error deleting session:", error);
        res.status(500).json({ error: "Failed to delete session" });
      }
    },
  );

  app.delete("/api/agent/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      await storage.clearAllChatSessions(userId);
      res.sendStatus(200);
    } catch (error) {
      console.error("Error clearing sessions:", error);
      res.status(500).json({ error: "Failed to clear sessions" });
    }
  });

  // Gemini Agent Endpoint
  app.post("/api/agent/process", isAuthenticated, async (req: any, res) => {
    try {
      const { prompt, message, sessionId, timeZone, currentDraftsContext } =
        req.body;
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      const userPrompt = prompt || message;

      if (!userPrompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get or create session
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const newSession = await storage.createChatSession(userId);
        currentSessionId = newSession.sessionId;
      }

      const result = await processUserPrompt(
        userPrompt,
        userId,
        currentSessionId,
        currentDraftsContext,
        timeZone,
      );

      // Generate title for new sessions (or if title is "New Conversation")
      // process in background to not block response
      (async () => {
        try {
          const session = await storage.getChatSession(currentSessionId);
          if (
            session &&
            (session.title === "New Conversation" || !session.title)
          ) {
            const { generateTitle } = await import("./services/gemini-agent");
            const newTitle = await generateTitle(userPrompt, result.text || "");
            await storage.updateChatSessionTitle(currentSessionId, newTitle);
          }
        } catch (err) {
          console.error("Failed to update chat title:", err);
        }
      })().catch((err) => console.error("Title generation crash:", err));

      // Return sessionId so client can persist it
      res.json({ ...result, sessionId: currentSessionId });
    } catch (error: any) {
      console.error("Error processing agent prompt:", error);
      res
        .status(500)
        .json({ error: "Failed to process prompt", message: error.message });
    }
  });

  // Update scheduled post endpoint
  app.put("/api/schedule/:id", isAuthenticated, async (req: any, res) => {
    try {
      // Get authenticated user ID
      const userId = req.user?.dbUserId || req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const postId = req.params.id;
      const { topic, tone, scheduledTime } = req.body;

      if (!postId) {
        return res.status(400).json({ error: "Post ID is required" });
      }

      // Update the scheduled post in database
      const success = await storage.updateScheduledSocialPost(postId, userId, {
        topic,
        tone,
        scheduledTime: new Date(scheduledTime),
      });

      if (!success) {
        return res
          .status(404)
          .json({ error: "Post not found or access denied" });
      }

      res.json({ success: true, message: "Post updated successfully" });
    } catch (error: any) {
      console.error("Error updating scheduled post:", error);
      res
        .status(500)
        .json({ error: "Failed to update post", message: error.message });
    }
  });

  // Get job history endpoint
  app.get("/api/schedule/history", isAuthenticated, async (req: any, res) => {
    try {
      // Get authenticated user ID
      const userId = req.user?.dbUserId || req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Return completed posts from database (already sorted by execution time)
      const completedPosts = await storage.getCompletedSocialPosts(userId);
      res.json(completedPosts);
    } catch (error: any) {
      console.error("Error fetching job history:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch job history", message: error.message });
    }
  });

  // Function to execute scheduled posts
  async function executeScheduledPost(scheduledPost: any) {
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

          console.log(`[CRON] 🔍 DEBUG: Response status: ${response.status}`);
          console.log(`[CRON] 🔍 DEBUG: Response ok: ${response.ok}`);
          console.log(
            `[CRON] 🔍 DEBUG: Response headers:`,
            Object.fromEntries(response.headers.entries()),
          );

          if (response.ok) {
            const result = await response.json();
            console.log(`[CRON] 🔍 DEBUG: Full response body:`, result);

            if (result.success && result.result) {
              generatedContent = result.result;
              console.log(
                `[CRON] ✅ Content generated via CrewAI service: "${generatedContent.substring(0, 100)}..."`,
              );
            } else {
              console.log(`[CRON] ❌ CrewAI response structure issue:`, {
                hasSuccess: !!result.success,
                successValue: result.success,
                hasResult: !!result.result,
                resultValue: result.result,
                fullResult: result,
              });
              throw new Error("CrewAI service returned unsuccessful result");
            }
          } else {
            const errorText = await response.text();
            console.log(`[CRON] 🔍 DEBUG: Error response body:`, errorText);
            throw new Error(
              `CrewAI service responded with status: ${response.status} - ${errorText}`,
            );
          }
        } catch (crewaiError: any) {
          console.log(
            `[CRON] ❌ CrewAI service failed: ${crewaiError.message}`,
          );
          console.log(
            `[CRON] ❌ CRITICAL ERROR: CrewAI service is the only configured content generator`,
          );
          console.log(`[CRON] 🔍 DEBUG: CrewAI URL was: ${config.api.crewai}`);
          console.log(`[CRON] 🔍 DEBUG: Request payload was:`, {
            topic: postToExecute.topic,
            platform: postToExecute.platform.toLowerCase(),
            tone: postToExecute.tone,
          });

          // Log the full error for debugging
          if (crewaiError.response) {
            console.log(
              `[CRON] 🔍 DEBUG: Response status: ${crewaiError.response.status}`,
            );
            console.log(
              `[CRON] 🔍 DEBUG: Response headers:`,
              crewaiError.response.headers,
            );
            console.log(
              `[CRON] 🔍 DEBUG: Response body:`,
              crewaiError.response.data,
            );
          }

          console.log(`[CRON] 🔍 DEBUG: Full error object:`, crewaiError);

          // Use topic as content since CrewAI is the only allowed generator
          generatedContent = `Content generation failed for: ${postToExecute.topic}`;
          console.log(
            `[CRON] ❌ FAILING: No content generation - CrewAI service unavailable`,
          );
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
        // Truncate content for Mastodon's 500 character limit
        const truncatedContent =
          generatedContent.length > 500
            ? generatedContent.substring(0, 497) + "..."
            : generatedContent;

        // Ensure the Mastodon instance URL has the correct protocol
        const instanceUrl =
          postToExecute.credentials.mastodon_instance.startsWith("http")
            ? postToExecute.credentials.mastodon_instance
            : `https://${postToExecute.credentials.mastodon_instance}`;

        console.log(
          `[CRON] 📝 Publishing AI-generated content: "${truncatedContent.substring(0, 50)}..."`,
        );

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
              // Skip empty or invalid paths
              if (!mediaPath || typeof mediaPath !== "string") {
                console.log(
                  `[CRON] ⚠️ Skipping invalid media path:`,
                  mediaPath,
                );
                continue;
              }

              let mediaBuffer: ArrayBuffer;
              let mimeType: string;
              let fileName: string;

              // Local file path - read directly from filesystem
              const fullPath = mediaPath.startsWith("/")
                ? mediaPath
                : path.join(uploadsDir, path.basename(mediaPath));

              if (!fs.existsSync(fullPath)) {
                console.error(`[CRON] ❌ Media file not found: ${fullPath}`);
                continue;
              }

              const fileBuffer = fs.readFileSync(fullPath);
              mediaBuffer = fileBuffer.buffer.slice(
                fileBuffer.byteOffset,
                fileBuffer.byteOffset + fileBuffer.byteLength,
              );
              mimeType = mime.lookup(fullPath) || "image/jpeg";
              fileName = path.basename(fullPath);
              console.log(`[CRON] 📁 Reading local file: ${fullPath}`);

              const formData = new FormData();
              const blob = new Blob([mediaBuffer], { type: mimeType });
              formData.append("file", blob, fileName);

              // Upload to Mastodon
              const uploadResponse = await fetch(
                `${instanceUrl}/api/v2/media`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${scheduledPost.credentials.mastodon_access_token}`,
                  },
                  body: formData,
                },
              );

              if (uploadResponse.ok) {
                const uploadData = await uploadResponse.json();
                mediaIds.push(uploadData.id);
                console.log(
                  `[CRON] ✅ Successfully uploaded media file: ${fileName}`,
                );
              } else {
                console.error(
                  `[CRON] ❌ Failed to upload media file: ${fileName}`,
                  await uploadResponse.text(),
                );
              }
            } catch (error) {
              console.error(`[CRON] ❌ Error uploading media file:`, error);
            }
          }
        }

        // Create status payload
        const statusPayload: any = {
          status: truncatedContent,
        };

        // Add media IDs if any were successfully uploaded
        if (mediaIds.length > 0) {
          statusPayload.media_ids = mediaIds;
          console.log(
            `[CRON] 📎 Attaching ${mediaIds.length} media files to post`,
          );
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
            `[CRON] 🎉 Successfully published AI-generated content to Mastodon: "${truncatedContent.substring(0, 50)}..."`,
          );
        } else {
          scheduledPost.status = "failed";
          const errorText = await mastodonResponse.text();
          scheduledPost.error = `Mastodon API error: ${mastodonResponse.status} - ${errorText}`;
          console.error(`[CRON] ❌ Failed to publish to Mastodon:`, errorText);
        }
      } else if (
        postToExecute.platform.toLowerCase() === "twitter" &&
        postToExecute.credentials.twitter_access_token
      ) {
        // Trim content for Twitter's 280 character limit
        const twitterContent =
          generatedContent.length > 280
            ? generatedContent.substring(0, 277) + "..."
            : generatedContent;

        console.log(
          `[CRON] 📝 Publishing to Twitter: "${twitterContent.substring(0, 50)}..."`,
        );

        try {
          // Verify token is still valid
          const isValid = await twitterOAuth.verifyToken(
            postToExecute.credentials.twitter_access_token,
          );
          if (!isValid) {
            throw new Error("Twitter access token is invalid or expired");
          }

          // Post tweet
          const tweetResult = await twitterOAuth.postTweet(
            postToExecute.credentials.twitter_access_token,
            twitterContent,
          );

          const tweetId = tweetResult.data?.id;
          const username =
            postToExecute.credentials.twitter_username || "twitter_user";
          const tweetUrl = `https://twitter.com/${username}/status/${tweetId}`;

          scheduledPost.status = "published";
          scheduledPost.publishedUrl = tweetUrl;
          console.log(
            `[CRON] 🎉 Successfully published to Twitter: ${tweetUrl}`,
          );
        } catch (twitterError: any) {
          scheduledPost.status = "failed";
          scheduledPost.error = `Twitter API error: ${twitterError.message}`;
          console.error(
            `[CRON] ❌ Failed to publish to Twitter:`,
            twitterError.message,
          );
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
      }
    } catch (error) {
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

  // Delete scheduled post endpoint — auth + ownership verification.
  // Previously unauthenticated, allowing any caller to delete any user's post.
  app.delete("/api/schedule/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Verify ownership before deleting. Return 404 (not 403) on mismatch
      // so attackers can't enumerate the existence of other users' posts.
      const post = await storage.getScheduledSocialPostById?.(id).catch(() => null);
      if (!post || (post.userId && post.userId !== userId)) {
        return res.status(404).json({ error: "Scheduled post not found" });
      }

      const deleted = await storage.deleteScheduledSocialPost(id);
      if (!deleted) {
        return res.status(404).json({ error: "Scheduled post not found" });
      }

      console.log(`[SCHEDULE] 🗑️ Deleted scheduled post ${id} by user ${userId}`);
      res.json({ success: true, message: "Scheduled post deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting scheduled post:", error);
      res.status(500).json({ error: "Failed to delete scheduled post" });
    }
  });

  // Delete ALL scheduled posts endpoint
  app.delete("/api/schedule", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      await storage.deleteAllScheduledSocialPosts(userId);

      res.json({ success: true, message: "All scheduled posts cleared" });
    } catch (error: any) {
      console.error("Error clearing schedule:", error);
      res
        .status(500)
        .json({ error: "Failed to clear schedule", message: error.message });
    }
  });

  // Media upload routes for social media posts - using multer for local storage
  app.post(
    "/api/media/upload",
    upload.single("file"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        // Create media URL that can be accessed later
        const mediaUrl = `/media/${req.file.filename}`;
        console.log("Media uploaded successfully:", mediaUrl);

        res.json({
          mediaUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
        });
      } catch (error: any) {
        console.error("Error uploading media file:", error);
        res.status(500).json({
          error: "Failed to upload media file",
          message: error.message,
        });
      }
    },
  );

  // Serve media files from local storage
  app.get("/media/:filename", (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(uploadsDir, filename);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Media file not found" });
      }

      // Get mime type
      const mimeType = mime.lookup(filePath) || "application/octet-stream";

      // Set headers
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "public, max-age=3600");

      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error: any) {
      console.error("Error serving media file:", error);
      res.status(500).json({ error: "Error serving media file" });
    }
  });

  // NOTE: Mastodon publishing is now handled by OAuth routes in mastodon-oauth.ts
  // The route /api/social/mastodon/publish is handled there with proper OAuth flow

  // Setup database tables if needed with error handling
  try {
    const dbSetupSuccess = await setupDatabase();
    if (!dbSetupSuccess) {
      console.warn("Database setup failed, but server will continue startup");
    }
  } catch (error) {
    console.error("Error during database setup:", error);
    console.warn("Database setup failed, but server will continue startup");
  }

  // Replit Auth already set up at beginning of function

  // Serve static files from uploads directory
  app.use("/uploads", express.static(uploadsDir));

  // Register integration routes
  app.use("/api/integrations", integrationRoutes);

  // Register social media OAuth routes
  app.use("/api/social", mastodonOAuthRoutes);
  app.use("/api/social", instagramOAuthRoutes);
  app.use("/api/social", twitterOAuthRoutes);
  app.use("/api", twitterOAuthRoutes); // For /api/twitter/status and /api/twitter/publish

  // Register log API routes for production debugging
  app.use("/api/logs", logRoutes);

  // Debug endpoints — only registered in non-production. They reveal database
  // schema shape, which would help an attacker craft targeted payloads.
  if (process.env.NODE_ENV !== "production") {
    app.get("/api/debug/task-schema", isAuthenticated, async (req, res) => {
      try {
        res.json({ taskInsertSchema: insertTaskSchema.shape });
      } catch (error) {
        console.error("Error fetching task schema:", error);
        res.status(500).json({ message: "Failed to fetch task schema" });
      }
    });

    app.get("/api/debug/project-schema", isAuthenticated, async (req, res) => {
      try {
        res.json({ projectInsertSchema: insertProjectSchema.shape });
      } catch (error) {
        console.error("Error fetching project schema:", error);
        res.status(500).json({ message: "Failed to fetch project schema" });
      }
    });
  }

  // Development endpoints for project creation without auth
  if (process.env.NODE_ENV !== "production") {
    // Test endpoint
    app.post("/api/test/projects", async (req, res) => {
      try {
        console.log(
          "TEST: Received project creation request with data:",
          JSON.stringify(req.body),
        );

        // Create or get test user first
        let testUser = await storage.getUserByUsername("test-user");
        if (!testUser) {
          testUser = await storage.createUser({
            id: "test-user-123",
            username: "test-user",
            email: "test@example.com",
            firstName: "Test",
            lastName: "User",
          });
        }

        // Clone req.body and add ownerId
        const projectData = {
          ...req.body,
          ownerId: testUser.id,
        };

        console.log(
          "TEST: Creating project with data:",
          JSON.stringify(projectData),
        );

        // Apply schema validation
        try {
          insertProjectSchema.parse(projectData);
        } catch (zodError) {
          console.error("TEST: Project validation error:", zodError);
          return res.status(400).json({
            message: "Invalid project data",
            details:
              zodError instanceof z.ZodError
                ? zodError.errors
                : "Unknown validation error",
          });
        }

        const project = await storage.createProject(projectData);
        console.log(
          "TEST: Project created successfully:",
          JSON.stringify(project),
        );

        res.status(201).json(project);
      } catch (error) {
        console.error("TEST: Error creating project:", error);
        res.status(500).json({
          message: "Failed to create project",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Test task creation
    app.post("/api/test/tasks", async (req, res) => {
      try {
        console.log(
          "TEST: Received task creation request with data:",
          JSON.stringify(req.body),
        );

        const taskData = {
          ...req.body,
          assigneeId: req.body.assigneeId || "test-user-123",
        };

        console.log("TEST: Creating task with data:", JSON.stringify(taskData));

        const validatedData = insertTaskSchema.parse(taskData);
        const task = await storage.createTask(validatedData);

        console.log("TEST: Task created successfully:", JSON.stringify(task));
        res.status(201).json(task);
      } catch (error) {
        console.error("TEST: Error creating task:", error);
        res.status(500).json({
          message: "Failed to create task",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Test project update
    app.patch("/api/test/projects/:id", async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        console.log(
          "TEST: Updating project",
          projectId,
          "with data:",
          JSON.stringify(req.body),
        );

        const updatedProject = await storage.updateProject(projectId, req.body);

        console.log(
          "TEST: Project updated successfully:",
          JSON.stringify(updatedProject),
        );
        res.json(updatedProject);
      } catch (error) {
        console.error("TEST: Error updating project:", error);
        res.status(500).json({
          message: "Failed to update project",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Test task update
    app.patch("/api/test/tasks/:id", async (req, res) => {
      try {
        const taskId = parseInt(req.params.id);
        console.log(
          "TEST: Updating task",
          taskId,
          "with data:",
          JSON.stringify(req.body),
        );

        const updatedTask = await storage.updateTask(taskId, req.body);

        console.log(
          "TEST: Task updated successfully:",
          JSON.stringify(updatedTask),
        );
        res.json(updatedTask);
      } catch (error) {
        console.error("TEST: Error updating task:", error);
        res.status(500).json({
          message: "Failed to update task",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Development workaround - bypass auth for normal project endpoint in dev mode
    // COMMENTED OUT: This was causing foreign key constraint violations
    // app.post("/api/projects", async (req, res) => {
    //   try {
    //     console.log(
    //       "DEV: Received project creation request with data:",
    //       JSON.stringify(req.body),
    //     );

    //     // Use a test user ID for development
    //     const userId = "dev-user-456";

    //     // Clone req.body and add ownerId
    //     const projectData = {
    //       ...req.body,
    //       ownerId: userId,
    //     };

    //     console.log(
    //       "DEV: Creating project with data:",
    //       JSON.stringify(projectData),
    //     );

    //     // Apply schema validation
    //     let validatedProjectData;
    //     try {
    //       validatedProjectData = insertProjectSchema.parse(projectData);
    //     } catch (zodError) {
    //       console.error("DEV: Project validation error:", zodError);
    //       return res.status(400).json({
    //         message: "Invalid project data",
    //         details:
    //           zodError instanceof z.ZodError
    //             ? zodError.errors
    //             : "Unknown validation error",
    //       });
    //     }

    //     const project = await storage.createProject(validatedProjectData);
    //     console.log(
    //       "DEV: Project created successfully:",
    //       JSON.stringify(project),
    //     );

    //     res.status(201).json(project);
    //   } catch (error) {
    //     console.error("DEV: Error creating project:", error);
    //     res.status(500).json({
    //       message: "Failed to create project",
    //       details: error instanceof Error ? error.message : "Unknown error",
    //     });
    //   }
    // });
  }

  // User routes
  app.get("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get(
    "/api/users/by-username/:username",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { username } = req.params;
        const user = await storage.getUserByUsername(username);

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json(user);
      } catch (error) {
        console.error("Error fetching user by username:", error);
        res.status(500).json({ message: "Failed to fetch user" });
      }
    },
  );

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      // First try to use the dbUserId from the session which points to our database record
      const userId = req.user.dbUserId || req.user.claims.sub;

      console.log(`Fetching user data for ID: ${userId}`);
      const user = await storage.getUser(userId);

      if (!user) {
        console.log(
          `User not found with ID: ${userId}, attempting to create/update user`,
        );
        // If user not found but we have claims, try to upsert them
        if (req.user.claims) {
          const createdUser = await storage.upsertUser({
            id: req.user.claims.sub,
            username: req.user.claims.username,
            email: req.user.claims.email,
            firstName: req.user.claims.first_name,
            lastName: req.user.claims.last_name,
            bio: req.user.claims.bio,
            profileImageUrl: req.user.claims.profile_image_url,
          });
          console.log(`Created/updated user: ${createdUser.username}`);
          return res.json(createdUser);
        }
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Custom Authentication Routes
  // User Registration
  // app.post("/api/auth/register", async (req: any, res) => {
  //   try {
  //     const { firstName, lastName, email, password } = req.body;

  //     // Enhanced validation with Zod-like validation
  //     if (!email || !password || !firstName || !lastName) {
  //       return res.status(400).json({ message: "All fields are required" });
  //     }

  //     if (typeof email !== "string" || !email.includes("@")) {
  //       return res
  //         .status(400)
  //         .json({ message: "Please enter a valid email address" });
  //     }

  //     if (typeof password !== "string" || password.length < 6) {
  //       return res
  //         .status(400)
  //         .json({ message: "Password must be at least 6 characters" });
  //     }

  //     if (typeof firstName !== "string" || firstName.length < 2) {
  //       return res
  //         .status(400)
  //         .json({ message: "First name must be at least 2 characters" });
  //     }

  //     if (typeof lastName !== "string" || lastName.length < 2) {
  //       return res
  //         .status(400)
  //         .json({ message: "Last name must be at least 2 characters" });
  //     }

  //     // Check if user already exists
  //     const existingUser = await storage.getUserByEmail(email);
  //     if (existingUser) {
  //       return res
  //         .status(409)
  //         .json({ message: "User already exists with this email" });
  //     }

  //     // Hash password
  //     const hashedPassword = await bcrypt.hash(password, 12);

  //     // Generate unique username from email
  //     const baseUsername = email.split("@")[0];
  //     let username = baseUsername;
  //     let counter = 1;

  //     while (await storage.getUserByUsername(username)) {
  //       username = `${baseUsername}${counter}`;
  //       counter++;
  //     }

  //     // Create user
  //     const userId = crypto.randomUUID();
  //     const newUser = await storage.createUser({
  //       id: userId,
  //       username,
  //       email,
  //       password: hashedPassword,
  //       firstName,
  //       lastName,
  //     });

  //     // Create Passport.js compatible session object
  //     const expiresIn24Hours = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours from now
  //     const sessionUser = {
  //       dbUserId: userId,
  //       claims: {
  //         sub: userId,
  //         email: email,
  //         username: username,
  //         first_name: firstName,
  //         last_name: lastName,
  //       },
  //       expires_at: expiresIn24Hours,
  //       refresh_token: null, // Custom auth doesn't use refresh tokens
  //     };

  //     // Use Passport.js login to establish proper session
  //     req.login(sessionUser, (err) => {
  //       if (err) {
  //         console.error("Passport login error during registration:", err);
  //         return res.status(500).json({ message: "Session creation failed" });
  //       }

  //       // Return user without password
  //       const { password: _, ...userResponse } = newUser;
  //       res.status(201).json(userResponse);
  //     });
  //   } catch (error) {
  //     console.error("Registration error:", error);
  //     res.status(500).json({ message: "Failed to create account" });
  //   }
  // });

  // Custom Authentication Routes
  // User Registration
  // User Registration (email verification flow)
  app.post("/api/auth/register", registerLimiter, async (req: any, res) => {
    try {
      const { firstName, lastName, email, password } = req.body;

      // Basic validation (same as you had)
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "All fields are required" });
      }
      if (typeof email !== "string" || !email.includes("@")) {
        return res
          .status(400)
          .json({ message: "Please enter a valid email address" });
      }
      if (typeof password !== "string" || password.length < 10) {
        return res
          .status(400)
          .json({ message: "Password must be at least 10 characters" });
      }
      if (typeof firstName !== "string" || firstName.length < 2) {
        return res
          .status(400)
          .json({ message: "First name must be at least 2 characters" });
      }
      if (typeof lastName !== "string" || lastName.length < 2) {
        return res
          .status(400)
          .json({ message: "Last name must be at least 2 characters" });
      }

      // Check existing
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res
          .status(409)
          .json({ message: "User already exists with this email" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Generate unique username based on email
      const baseUsername = email.split("@")[0];
      let username = baseUsername;
      let i = 1;
      while (await storage.getUserByUsername(username)) {
        username = `${baseUsername}${i++}`;
      }

      // Create user with email_verified = false
      const userId = crypto.randomUUID();
      const newUser = await storage.createUser({
        id: userId,
        username,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        // important:
        emailVerified: false,
        auth_provider: "email",
      });

      // Prepare verification token
      await ensureVerificationTable();
      const token = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      await pool.query(
        `INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
        [userId, token, expiresAt],
      );

      // Build verify URL (frontend route that we'll implement next)
      const appUrl = process.env.APP_DOMAIN;
      // Option 1: front-end page handles the token & calls backend
      const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
      // Option 2 (alternative): direct backend link that performs verification then redirects
      // const baseUrl = `${req.protocol}://${req.get("host")}`;
      // const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

      // Send verification email
      const emailSent = await sendVerificationEmail(email, verifyUrl);

      if (!emailSent) {
        console.warn(
          `Failed to send verification email to ${email}. User can use 'Resend Verification' or 'Forgot Password' to get a link.`,
        );
        console.warn(
          "Make sure BREVO_API_KEY and BREVO_FROM_EMAIL are configured in production.",
        );
      } else {
        console.log(`Verification email sent successfully to ${email}`);
      }

      // DO NOT log them in yet. Ask client to show "pending" screen.
      // Return minimal safe payload, no password
      const { password: _pw, ...safeUser } = newUser as any;

      return res.status(201).json({
        status: "verification_required",
        user: safeUser,
        message:
          "We sent a verification link to your email. Please verify to continue.",
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "Failed to create account" });
    }
  });

  // User Login
  app.post("/api/auth/login", loginLimiter, async (req: any, res) => {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log(`[LOGIN] No user found for email: ${email}`);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      console.log(`[LOGIN] User found: id=${user.id}, email=${user.email}, hasPassword=${!!user.password}, emailVerified=${user.emailVerified}, authProvider=${user.authProvider}`);

      // Check if user has password (for custom auth users)
      if (!user.password) {
        console.log(`[LOGIN] User ${email} has no password set`);
        return res.status(401).json({
          message: "Please use the OAuth login method for this account",
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      console.log(`[LOGIN] Password comparison for ${email}: valid=${isValidPassword}`);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Create Passport.js compatible session object
      const expiresIn24Hours = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours from now
      const sessionUser = {
        dbUserId: user.id,
        claims: {
          sub: user.id,
          email: user.email,
          username: user.username,
          first_name: user.firstName,
          last_name: user.lastName,
        },
        expires_at: expiresIn24Hours,
        refresh_token: null, // Custom auth doesn't use refresh tokens
      };

      if (!user.emailVerified) {
        return res.status(403).json({
          code: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email to continue.",
          email: user.email,
        });
      }

      // Use Passport.js login to establish proper session
      req.login(sessionUser, (err) => {
        if (err) {
          console.error("Passport login error during login:", err);
          return res.status(500).json({ message: "Session creation failed" });
        }

        // Return user without password
        const { password: _, ...userResponse } = user;
        res.json(userResponse);
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Email Verification endpoint
  app.post("/api/auth/verify-email", async (req: any, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      // Find the token in the database
      const result = await pool.query(
        `SELECT * FROM verification_tokens WHERE token = $1 AND used = FALSE`,
        [token],
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      const verificationRecord = result.rows[0];

      // Check if token is expired
      if (new Date() > new Date(verificationRecord.expires_at)) {
        return res.status(400).json({ message: "Token has expired" });
      }

      // Mark token as used
      await pool.query(
        `UPDATE verification_tokens SET used = TRUE WHERE token = $1`,
        [token],
      );

      // Update user's email_verified status
      await pool.query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [
        verificationRecord.user_id,
      ]);

      // Get the verified user
      const user = await storage.getUser(verificationRecord.user_id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Log them in automatically after verification
      const expiresIn24Hours = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
      const sessionUser = {
        dbUserId: user.id,
        claims: {
          sub: user.id,
          email: user.email,
          username: user.username,
          first_name: user.firstName,
          last_name: user.lastName,
        },
        expires_at: expiresIn24Hours,
        refresh_token: null,
      };

      req.login(sessionUser, (err) => {
        if (err) {
          console.error("Passport login error after verification:", err);
          // Still return success even if session creation fails
          return res.json({
            success: true,
            message: "Email verified successfully",
          });
        }

        const { password: _, ...userResponse } = user;
        res.json({
          success: true,
          user: userResponse,
          message: "Email verified and logged in",
        });
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // Resend Verification Email endpoint — rate-limited; constant generic
  // response prevents email enumeration via either status codes or timing.
  app.post("/api/auth/resend-verification", sensitiveAuthLimiter, async (req: any, res) => {
    const startedAt = Date.now();
    const GENERIC_RESPONSE = {
      message: "If an account exists for that email, a verification message has been sent.",
    };
    // Pad responses to a fixed floor to dampen timing-based enumeration.
    const MIN_RESPONSE_MS = 600;
    const respondPadded = async (status: number, body: any) => {
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, MIN_RESPONSE_MS - elapsed);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      return res.status(status).json(body);
    };

    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return respondPadded(400, { message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return respondPadded(200, GENERIC_RESPONSE);
      }

      const userCheck = await pool.query(
        `SELECT email_verified FROM users WHERE id = $1`,
        [user.id],
      );
      if (userCheck.rows[0]?.email_verified) {
        // Same generic response — do NOT reveal that the address is already verified.
        return respondPadded(200, GENERIC_RESPONSE);
      }

      await pool.query(
        `UPDATE verification_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE`,
        [user.id],
      );

      await ensureVerificationTable();
      const token = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
        [user.id, token, expiresAt],
      );

      const appUrl = process.env.APP_DOMAIN;
      const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
      const emailSent = await sendVerificationEmail(email, verifyUrl);

      if (!emailSent) {
        console.warn(`Failed to resend verification email to ${email}`);
      }
      return respondPadded(200, GENERIC_RESPONSE);
    } catch (error) {
      console.error("Resend verification error:", error);
      // Always return the same generic response shape on failure too.
      return respondPadded(200, GENERIC_RESPONSE);
    }
  });

  // Check Verification Status endpoint (for polling)
  app.get("/api/auth/verification-status", async (req: any, res) => {
    try {
      const email = req.query.email as string;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ verified: false });
      }

      // Check verification status
      const result = await pool.query(
        `SELECT email_verified FROM users WHERE id = $1`,
        [user.id],
      );

      res.json({ verified: result.rows[0]?.email_verified || false });
    } catch (error) {
      console.error("Verification status check error:", error);
      res.status(500).json({ message: "Failed to check verification status" });
    }
  });

  // Forgot Password endpoint
  app.post("/api/auth/forgot-password", sensitiveAuthLimiter, async (req: any, res) => {
    try {
      const { email } = req.body;

      // Validation
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      if (typeof email !== "string" || !email.includes("@")) {
        return res
          .status(400)
          .json({ message: "Please enter a valid email address" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // For security, don't reveal if email exists or not
        return res.json({
          message:
            "If an account with this email exists, a reset link has been sent.",
        });
      }

      // Generate reset token using crypto (same as temp.py)
      const resetToken = crypto.randomBytes(32).toString("base64url");

      // Create reset token record in database
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

      await storage.createPasswordResetToken({
        userId: user.id,
        token: resetToken,
        expiresAt,
        used: false,
      });

      // Send password reset email
      const userName =
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.username;
      const emailSent = await sendPasswordResetEmail(
        user.email,
        userName,
        resetToken,
      );

      if (emailSent) {
        console.log(`Password reset email sent successfully to ${user.email}`);
      } else {
        console.warn(`Failed to send password reset email to ${user.email}`);
      }

      // Always return success for security (don't reveal if email exists)
      res.json({
        message:
          "If an account with this email exists, a reset link has been sent.",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res
        .status(500)
        .json({ message: "Failed to process password reset request" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", async (req: any, res) => {
    try {
      req.session?.destroy((err: any) => {
        if (err) {
          console.error("Logout error:", err);
          return res.status(500).json({ message: "Logout failed" });
        }
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // Password reset endpoint
  app.post("/api/auth/reset-password", sensitiveAuthLimiter, async (req: any, res) => {
    try {
      const { token, password } = req.body;

      // Validation
      if (!token || !password) {
        return res.status(400).json({
          message: "Token and password are required",
        });
      }

      if (typeof password !== "string" || password.length < 10) {
        return res.status(400).json({
          message: "Password must be at least 10 characters",
        });
      }

      // Find and validate reset token
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({
          message: "Invalid or expired reset link",
        });
      }

      // Check if token is expired
      if (new Date() > new Date(resetToken.expiresAt)) {
        return res.status(400).json({
          message: "Reset link has expired",
        });
      }

      // Check if token has been used
      if (resetToken.used) {
        return res.status(400).json({
          message: "Reset link has already been used",
        });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Update user password and mark token as used
      await storage.updateUserPassword(resetToken.userId, hashedPassword);
      await storage.markPasswordResetTokenAsUsed(token);

      // IMPORTANT: Automatically verify email when user completes password reset
      // This is safe because they proved they own the email by clicking the reset link
      await pool.query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [
        resetToken.userId,
      ]);
      console.log(
        `Email automatically verified for user ${resetToken.userId} after password reset`,
      );

      res.json({
        message: "Password updated successfully",
      });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({
        message: "Password reset failed",
      });
    }
  });

  // API routes
  app.get("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      // Only return projects the user is authorized to view
      const userId = req.user.dbUserId || req.user.claims.sub;
      console.log("Fetching projects for user:", {
        dbUserId: req.user.dbUserId,
        claimsSub: req.user.claims?.sub,
        finalUserId: userId,
      });

      const projects = await storage.getProjectsForUser(userId);
      console.log(`Found ${projects.length} projects for user ${userId}`);

      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/recent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      const allProjects = await storage.getProjectsForUser(userId);

      // choose the most recent "signal": opened > updated > created
      const score = (p: any) =>
        new Date(
          p.lastOpenedAt ??
            p.last_opened_at ??
            p.updatedAt ??
            p.updated_at ??
            p.createdAt ??
            p.created_at ??
            0,
        ).getTime();

      const recentProjects = allProjects
        .slice()
        .sort((a, b) => score(b) - score(a))
        .slice(0, 3); // top 3, not 5

      res.json(recentProjects);
    } catch (error) {
      console.error("Error fetching recent projects:", error);
      res.status(500).json({ message: "Failed to fetch recent projects" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const project = await storage.getProject(projectId);
      // Always require an authorization check. Returning 404 instead of 403
      // prevents an attacker from learning which IDs map to real projects
      // belonging to other users.
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      const isAuthorized = await storage.isUserAuthorized(projectId, userId);
      if (!isAuthorized) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Dynamically calculate task counts
      const tasks = await storage.getTasksByProjectId(projectId);
      const totalTasks = tasks?.length || 0;
      const completedTasks =
        tasks?.filter((t: any) => t.status === "done").length || 0;
      const progress =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Return project with updated counts
      res.json({
        ...project,
        totalTasks,
        completedTasks,
        progress,
      });
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      console.log(
        "Received project creation request with data:",
        JSON.stringify(req.body),
      );

      // Set the current user as the owner of the project
      const userId = req.user.dbUserId || req.user.claims.sub;
      console.log("User ID for project creation:", userId);

      // Check project creation limits based on user's subscription plan
      console.log("Checking project creation limits for user:", userId);
      const limitCheck = await storage.canUserCreateProject(userId);
      console.log("Project limit check result:", limitCheck);

      if (!limitCheck.allowed) {
        console.log("Project creation blocked:", limitCheck.reason);
        return res.status(403).json({
          message: "Project creation limit reached",
          reason: limitCheck.reason,
          current: limitCheck.current,
          max: limitCheck.max,
          suggestion: "Please upgrade your plan to create more projects.",
        });
      }

      // Clone req.body and add ownerId
      const projectData = {
        ...req.body,
        ownerId: userId,
      };

      // Apply schema validation
      let validatedProjectData;
      try {
        validatedProjectData = insertProjectSchema.parse(projectData);
      } catch (zodError) {
        console.error("Project validation error:", zodError);
        return res.status(400).json({
          message: "Invalid project data",
          details:
            zodError instanceof z.ZodError
              ? zodError.errors
              : "Unknown validation error",
        });
      }

      console.log(
        "Creating project with validated data:",
        JSON.stringify(validatedProjectData),
      );
      const project = await storage.createProject(validatedProjectData);
      console.log("Project created successfully:", JSON.stringify(project));

      // Automatically add the creator as a project member with OWNER role
      try {
        await storage.addProjectMember({
          projectId: project.id,
          userId: userId,
          role: ProjectRole.OWNER,
        });
        console.log("Added creator as project owner member");
      } catch (memberError) {
        console.error("Error adding creator as project member:", memberError);
        // Don't fail the whole request if member addition fails
      }

      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({
        message: "Failed to create project",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.patch("/api/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;
      const project = await storage.getProject(projectId);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if user is authorized to update this project (editor or owner)
      const isAuthorized = await storage.isUserAuthorized(
        projectId,
        userId,
        ProjectRole.EDITOR,
      );
      if (!isAuthorized) {
        return res.status(403).json({
          message: "You don't have permission to update this project",
        });
      }

      const updatedProject = await storage.updateProject(projectId, req.body);
      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;

      console.log(
        `Attempting to delete project with ID: ${projectId} by user: ${userId}`,
      );

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID format" });
      }

      // Get the project to verify it exists
      const project = await storage.getProject(projectId);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Only owners can delete projects
      const isAuthorized = await storage.isUserAuthorized(
        projectId,
        userId,
        ProjectRole.OWNER,
      );

      if (!isAuthorized) {
        return res.status(403).json({
          message: "You don't have permission to delete this project",
        });
      }

      // Get all tasks for this project first
      const projectTasks = await storage.getTasksByProjectId(projectId);

      // Delete all tasks associated with this project first
      for (const task of projectTasks) {
        await storage.deleteTask(task.id);
      }

      // Now delete the project
      await storage.deleteProject(projectId);

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      if (error instanceof Error) {
        res
          .status(500)
          .json({ message: `Failed to delete project: ${error.message}` });
      } else {
        res.status(500).json({
          message: "Failed to delete project due to an unknown error",
        });
      }
    }
  });

  app.get("/api/projects/:id/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;

      console.log(
        `[DEBUG] Fetching tasks for project ${projectId} requested by user ${userId}`,
      );

      // Check if user has access to the project
      console.log(
        `[DEBUG] Checking user authorization for project ${projectId}`,
      );
      const isAuthorized = await storage.isUserAuthorized(projectId, userId);
      console.log(`[DEBUG] User authorization result: ${isAuthorized}`);

      if (!isAuthorized) {
        console.log(
          `[DEBUG] User ${userId} not authorized to access project ${projectId}`,
        );
        return res.status(403).json({
          message: "You don't have permission to access this project's tasks",
        });
      }

      console.log(`[DEBUG] Retrieving tasks for project ${projectId}`);
      const tasks = await storage.getTasksByProjectId(projectId);
      console.log(
        `[DEBUG] Retrieved ${tasks ? tasks.length : 0} tasks for project ${projectId}`,
      );

      res.json(tasks || []);
    } catch (error) {
      console.error("Error fetching project tasks:", error);
      res.status(500).json({ message: "Failed to fetch project tasks" });
    }
  });

  // Get project milestones
  app.get(
    "/api/projects/:id/milestones",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Check if user has access to the project
        const isAuthorized = await storage.isUserAuthorized(projectId, userId);
        if (!isAuthorized) {
          return res.status(403).json({
            message:
              "You don't have permission to access this project's milestones",
          });
        }

        // Fetch tasks that are marked as milestones
        const allTasks = await storage.getTasksByProjectId(projectId);
        const milestones = allTasks.filter((task) => task.type === "milestone");

        // Transform task data to match milestone interface expected by frontend
        const milestonesFormatted = milestones.map((task) => ({
          id: task.id,
          projectId: task.projectId,
          name: task.name,
          description: task.description || "",
          dueDate: task.dueDate,
          priority: task.priority || "medium",
          status: task.status || "not-started",
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        }));

        return res.json(milestonesFormatted);
      } catch (error) {
        console.error("Error fetching project milestones:", error);
        return res
          .status(500)
          .json({ message: "Failed to fetch project milestones" });
      }
    },
  );

  // Create project milestone
  app.post(
    "/api/projects/:id/milestones",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Check if user has access to the project
        const isAuthorized = await storage.isUserAuthorized(projectId, userId);
        if (!isAuthorized) {
          return res.status(403).json({
            message:
              "You don't have permission to create milestones for this project",
          });
        }

        // For now, we'll create milestones as special tasks
        const { name, description, dueDate, priority, status } = req.body;

        // Convert dueDate string to Date object if provided
        let parsedDueDate = null;
        if (dueDate) {
          try {
            parsedDueDate = new Date(dueDate);
            // Ensure the date is valid
            if (isNaN(parsedDueDate.getTime())) {
              parsedDueDate = null;
            }
          } catch (error) {
            console.warn("Invalid dueDate provided:", dueDate);
            parsedDueDate = null;
          }
        }

        const milestone = await storage.createTask({
          name,
          description: description || "",
          projectId,
          status: status || "todo",
          priority: priority || "medium",
          dueDate: parsedDueDate,
          type: "milestone", // Mark as milestone
        });

        return res.json(milestone);
      } catch (error) {
        console.error("Error creating milestone:", error);
        return res.status(500).json({ message: "Failed to create milestone" });
      }
    },
  );

  // Update milestone
  app.patch("/api/milestones/:id", isAuthenticated, async (req: any, res) => {
    try {
      const milestoneId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;

      // For now, update milestone as a task
      const task = await storage.getTask(milestoneId);
      if (!task) {
        return res.status(404).json({ message: "Milestone not found" });
      }

      // Check if user has access to the project
      const isAuthorized = await storage.isUserAuthorized(
        task.projectId,
        userId,
      );
      if (!isAuthorized) {
        return res.status(403).json({
          message: "You don't have permission to update this milestone",
        });
      }

      // Handle date conversion for updates too
      const updateData = { ...req.body };
      if (updateData.dueDate && typeof updateData.dueDate === "string") {
        try {
          const parsedDate = new Date(updateData.dueDate);
          if (isNaN(parsedDate.getTime())) {
            updateData.dueDate = null;
          } else {
            updateData.dueDate = parsedDate;
          }
        } catch (error) {
          console.warn("Invalid dueDate in update:", updateData.dueDate);
          updateData.dueDate = null;
        }
      }

      const updatedMilestone = await storage.updateTask(
        milestoneId,
        updateData,
      );
      res.json(updatedMilestone);
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ message: "Failed to update milestone" });
    }
  });

  // Delete milestone
  app.delete("/api/milestones/:id", isAuthenticated, async (req: any, res) => {
    try {
      const milestoneId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;

      // For now, delete milestone as a task
      const task = await storage.getTask(milestoneId);
      if (!task) {
        return res.status(404).json({ message: "Milestone not found" });
      }

      // Check if user has access to the project
      const isAuthorized = await storage.isUserAuthorized(
        task.projectId,
        userId,
      );
      if (!isAuthorized) {
        return res.status(403).json({
          message: "You don't have permission to delete this milestone",
        });
      }

      await storage.deleteTask(milestoneId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ message: "Failed to delete milestone" });
    }
  });

  // Project members management routes
  app.get(
    "/api/projects/:id/members",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Check if user has access to the project
        const isAuthorized = await storage.isUserAuthorized(projectId, userId);
        if (!isAuthorized) {
          return res.status(403).json({
            message: "You don't have permission to view this project's members",
          });
        }

        // Get project details to include the owner
        const project = await storage.getProject(projectId);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        const members = await storage.getProjectMembers(projectId);

        // Check if project owner is already in members list
        const ownerAlreadyMember = members.some(
          (member) => member.userId === project.ownerId,
        );

        // If owner is not in members list, add them
        if (!ownerAlreadyMember && project.ownerId) {
          members.push({
            id: 0, // Temporary ID for owner
            projectId: projectId,
            userId: project.ownerId,
            role: "owner",
            createdAt: project.createdAt || new Date().toISOString(),
            updatedAt: project.updatedAt || new Date().toISOString(),
          });
        }

        // Enrich member data with user details
        const enrichedMembers = await Promise.all(
          members.map(async (member) => {
            const user = await storage.getUser(member.userId);
            return {
              ...member,
              userEmail: user?.email || "",
              userFirstName: user?.firstName || "",
              userLastName: user?.lastName || "",
              userUsername: user?.username || "",
            };
          }),
        );

        res.json(enrichedMembers);
      } catch (error) {
        console.error("Error fetching project members:", error);
        res.status(500).json({ message: "Failed to fetch project members" });
      }
    },
  );

  app.post(
    "/api/projects/:id/members",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Check if user is a project owner - only owners can add members
        const isAuthorized = await storage.isUserAuthorized(
          projectId,
          userId,
          ProjectRole.OWNER,
        );
        if (!isAuthorized) {
          return res
            .status(403)
            .json({ message: "Only project owners can add members" });
        }

        const { userId: memberId, role } = req.body;

        if (!memberId || !role) {
          return res
            .status(400)
            .json({ message: "User ID and role are required" });
        }

        // Check if role is valid
        if (!Object.values(ProjectRole).includes(role)) {
          return res.status(400).json({
            message: `Invalid role. Valid roles are: ${Object.values(ProjectRole).join(", ")}`,
          });
        }

        // Check team member limits based on project owner's subscription plan
        const limitCheck = await storage.canUserAddTeamMember(
          projectId,
          userId,
        );
        if (!limitCheck.allowed) {
          return res.status(403).json({
            message: "Team member limit reached",
            reason: limitCheck.reason,
            current: limitCheck.current,
            max: limitCheck.max,
            suggestion: "Please upgrade your plan to add more team members.",
          });
        }

        const member = await storage.addProjectMember({
          projectId,
          userId: memberId,
          role,
        });

        res.status(201).json(member);
      } catch (error) {
        console.error("Error adding project member:", error);
        res.status(500).json({ message: "Failed to add project member" });
      }
    },
  );

  app.patch(
    "/api/projects/:id/members/:memberId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const memberId = req.params.memberId;
        const userId = req.user.dbUserId || req.user.claims.sub;
        const { role } = req.body;

        if (!role) {
          return res.status(400).json({ message: "Role is required" });
        }

        // Check if role is valid
        if (!Object.values(ProjectRole).includes(role)) {
          return res.status(400).json({
            message: `Invalid role. Valid roles are: ${Object.values(ProjectRole).join(", ")}`,
          });
        }

        // Check if user is a project owner - only owners can update roles
        const isAuthorized = await storage.isUserAuthorized(
          projectId,
          userId,
          ProjectRole.OWNER,
        );
        if (!isAuthorized) {
          return res
            .status(403)
            .json({ message: "Only project owners can update member roles" });
        }

        const updatedMember = await storage.updateProjectMemberRole(
          projectId,
          memberId,
          role,
        );
        res.json(updatedMember);
      } catch (error) {
        console.error("Error updating project member:", error);
        res.status(500).json({ message: "Failed to update project member" });
      }
    },
  );

  app.delete(
    "/api/projects/:id/members/:memberId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const memberId = req.params.memberId;
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Get the project to check ownership
        const project = await storage.getProject(projectId);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        // Users can remove themselves from a project (leave project)
        if (memberId === userId) {
          // But prevent project owner from removing themselves
          if (project.ownerId === userId) {
            return res.status(400).json({
              message:
                "The project owner cannot be removed. Transfer ownership to another member first.",
            });
          }

          await storage.removeProjectMember(projectId, memberId);
          return res.status(204).send();
        }

        // For removing other members, the user must be a project owner
        const isAuthorized = await storage.isUserAuthorized(
          projectId,
          userId,
          ProjectRole.OWNER,
        );
        if (!isAuthorized) {
          return res
            .status(403)
            .json({ message: "Only project owners can remove members" });
        }

        await storage.removeProjectMember(projectId, memberId);
        res.status(204).send();
      } catch (error) {
        console.error("Error removing project member:", error);
        res.status(500).json({ message: "Failed to remove project member" });
      }
    },
  );

  // Project Invitation routes
  app.get(
    "/api/projects/:id/invitations",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Check if user has access to the project
        const isAuthorized = await storage.isUserAuthorized(projectId, userId);
        if (!isAuthorized) {
          return res.status(403).json({
            message:
              "You don't have permission to view this project's invitations",
          });
        }

        const invitations = await storage.getProjectInvitations(projectId);
        res.json(invitations);
      } catch (error) {
        console.error("Error fetching project invitations:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch project invitations" });
      }
    },
  );

  app.post(
    "/api/projects/:id/invitations",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;

        console.log("Creating invitation with body:", JSON.stringify(req.body));
        console.log("User ID:", userId);
        console.log("Project ID:", projectId);

        // Get the project to verify it exists
        const project = await storage.getProject(projectId);
        console.log("Project details:", JSON.stringify(project));

        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        // Direct comparison of owner ID for debugging
        console.log(
          `Comparing project owner (${project.ownerId}) with current user (${userId})`,
        );
        const isDirectOwner = String(project.ownerId) === String(userId);
        console.log("Direct ownership match:", isDirectOwner);

        // Check if user is a project owner - only owners can send invitations
        const isAuthorized = await storage.isUserAuthorized(
          projectId,
          userId,
          ProjectRole.OWNER,
        );
        console.log("Authorization check result:", isAuthorized);

        if (!isAuthorized && !isDirectOwner) {
          return res
            .status(403)
            .json({ message: "Only project owners can send invitations" });
        }

        if (!isAuthorized && isDirectOwner) {
          console.log(
            "WARNING: Direct ownership check passed but authorization method failed!",
          );
          console.log("Overriding authorization check for project owner");
        }

        // Create a custom validation schema that only requires email and role
        const invitationFormSchema = z.object({
          email: z
            .string()
            .email({ message: "Please provide a valid email address" }),
          role: z
            .string({ required_error: "Role is required" })
            .refine(
              (val) => Object.values(ProjectRole).includes(val as ProjectRole),
              {
                message: `Role must be one of: ${Object.values(ProjectRole).join(", ")}`,
              },
            ),
        });

        try {
          // Validate just the request body
          const validatedBody = invitationFormSchema.parse(req.body);

          // Create the full invitation data with system-generated fields
          const invitationData = {
            email: validatedBody.email,
            role: validatedBody.role as ProjectRole,
            projectId,
            invitedBy: userId,
            token: crypto.randomBytes(32).toString("hex"),
            status: "pending" as const,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          };

          console.log("Final invitation data:", JSON.stringify(invitationData));

          const invitation =
            await storage.createProjectInvitation(invitationData);
          console.log("Created invitation:", JSON.stringify(invitation));

          // Fetch inviter details to include in the email
          const inviter = await storage.getUser(userId);

          if (project && inviter) {
            try {
              // Send email asynchronously using imported function
              sendInvitationEmail(invitation, project, inviter)
                .then((success) => {
                  if (success) {
                    console.log(
                      `Invitation email sent successfully to ${invitation.email}`,
                    );
                  } else {
                    console.warn(
                      `Failed to send invitation email to ${invitation.email}`,
                    );
                  }
                })
                .catch((error) => {
                  console.error("Error sending invitation email:", error);
                });
            } catch (emailError) {
              console.error("Email service error:", emailError);
              // Non-blocking - we still return the invitation even if email fails
            }
          }

          res.status(201).json(invitation);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return res.status(400).json({
              message: "Validation error",
              errors: error.errors,
            });
          }
          throw error; // Re-throw to be caught by outer catch
        }
      } catch (error) {
        console.error("Error creating project invitation:", error);
        res.status(500).json({
          message: "Failed to create project invitation",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.delete(
    "/api/projects/:id/invitations/:invitationId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const invitationId = parseInt(req.params.invitationId);
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Check if user is a project owner - only owners can delete invitations
        const isAuthorized = await storage.isUserAuthorized(
          projectId,
          userId,
          ProjectRole.OWNER,
        );
        if (!isAuthorized) {
          return res
            .status(403)
            .json({ message: "Only project owners can delete invitations" });
        }

        // Get the invitation to verify it belongs to this project
        const invitation = await storage.getProjectInvitation(invitationId);
        if (!invitation) {
          return res.status(404).json({ message: "Invitation not found" });
        }

        if (invitation.projectId !== projectId) {
          return res
            .status(400)
            .json({ message: "Invitation does not belong to this project" });
        }

        await storage.deleteProjectInvitation(invitationId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting project invitation:", error);
        res
          .status(500)
          .json({ message: "Failed to delete project invitation" });
      }
    },
  );

  app.get("/api/invitations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user || !user.email) {
        return res
          .status(400)
          .json({ message: "User does not have an email address" });
      }

      // Detailed logging for debugging the invitation persistence issue
      console.log(
        `Fetching invitations for user ${userId} with email ${user.email}`,
      );

      const invitations = await storage.getInvitationsByEmail(user.email);
      console.log(
        `Found ${invitations.length} invitations:`,
        JSON.stringify(invitations),
      );

      res.json(invitations);
    } catch (error) {
      console.error("Error fetching user invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.post("/api/invitations", isAuthenticated, async (req: any, res) => {
    try {
      const { projectId, email, role } = req.body;
      const userId = req.user.dbUserId || req.user.claims.sub;

      console.log(
        "Creating invitation via generic endpoint with body:",
        JSON.stringify(req.body),
      );
      console.log("User ID:", userId);
      console.log("Project ID:", projectId);

      if (!projectId || !email || !role) {
        return res.status(400).json({
          message:
            "Missing required fields: projectId, email, and role are required",
        });
      }

      // Get the project to verify it exists
      const project = await storage.getProject(projectId);
      console.log("Project details:", JSON.stringify(project));

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if user is a project owner - only owners can send invitations
      const isAuthorized = await storage.isUserAuthorized(
        projectId,
        userId,
        ProjectRole.OWNER,
      );
      console.log("Authorization check result:", isAuthorized);

      if (!isAuthorized) {
        const isDirectOwner = String(project.ownerId) === String(userId);
        console.log("Direct ownership match:", isDirectOwner);

        if (!isDirectOwner) {
          return res
            .status(403)
            .json({ message: "Only project owners can send invitations" });
        }

        console.log(
          "WARNING: Direct ownership check passed but authorization method failed!",
        );
        console.log("Overriding authorization check for project owner");
      }

      // Validate the email
      const invitationFormSchema = z.object({
        email: z
          .string()
          .email({ message: "Please provide a valid email address" }),
        role: z
          .string({ required_error: "Role is required" })
          .refine(
            (val) => Object.values(ProjectRole).includes(val as ProjectRole),
            {
              message: `Role must be one of: ${Object.values(ProjectRole).join(", ")}`,
            },
          ),
      });

      // Create the invitation data
      const validatedData = invitationFormSchema.parse({
        email: email,
        role: role,
      });

      const invitationData = {
        email: validatedData.email,
        role: validatedData.role as ProjectRole,
        projectId,
        invitedBy: userId,
        token: crypto.randomBytes(32).toString("hex"),
        status: "pending" as const,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      console.log("Final invitation data:", JSON.stringify(invitationData));

      const invitation = await storage.createProjectInvitation(invitationData);
      console.log("Created invitation:", JSON.stringify(invitation));

      // Fetch inviter details to include in the email
      const inviter = await storage.getUser(userId);

      if (project && inviter) {
        try {
          // Send email asynchronously using imported function
          sendInvitationEmail(invitation, project, inviter)
            .then((success) => {
              if (success) {
                console.log(
                  `Invitation email sent successfully to ${invitation.email}`,
                );
              } else {
                console.warn(
                  `Failed to send invitation email to ${invitation.email}`,
                );
              }
            })
            .catch((error) => {
              console.error("Email service error:", error);
            });
        } catch (emailError) {
          console.error("Email service error:", emailError);
          // Non-blocking - we still return the invitation even if email fails
        }
      }

      res.status(201).json(invitation);
    } catch (error) {
      console.error("Error creating project invitation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      res.status(500).json({
        message: "Failed to create project invitation",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post(
    "/api/invitations/:token/accept",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { token } = req.params;
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Accept the invitation and create project membership
        const membership = await storage.acceptInvitation(token, userId);
        res.status(201).json(membership);
      } catch (error: any) {
        console.error("Error accepting invitation:", error);
        res
          .status(500)
          .json({ message: error.message || "Failed to accept invitation" });
      }
    },
  );

  app.get("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      // This endpoint should only return tasks for projects the user has access to
      const userId = req.user.dbUserId || req.user.claims.sub;
      const { projectId } = req.query;

      let accessibleTasks = [];

      if (projectId) {
        // If projectId is specified, fetch tasks for that specific project
        const projectIdNum = parseInt(projectId as string);

        // Check if user has access to this project
        const isAuthorized = await storage.isUserAuthorized(
          projectIdNum,
          userId,
        );
        if (!isAuthorized) {
          return res.status(403).json({
            message: "You don't have permission to access this project's tasks",
          });
        }

        accessibleTasks = await storage.getTasksByProjectId(projectIdNum);
      } else {
        // Get all projects user has access to
        const accessibleProjects = await storage.getProjectsForUser(userId);
        const accessibleProjectIds = accessibleProjects.map((p) => p.id);

        // Get all tasks
        const allTasks = await storage.getAllTasks();

        // Filter tasks to only include those from accessible projects
        accessibleTasks = allTasks.filter(
          (task) =>
            task.projectId && accessibleProjectIds.includes(task.projectId),
        );
      }

      res.json(accessibleTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      console.log(
        "Received task creation request with data:",
        JSON.stringify(req.body),
      );
      const userId = req.user.dbUserId || req.user.claims.sub;

      // Fix date format if needed
      const fixedRequestBody = { ...req.body };

      // Convert date strings to proper format for validation
      if (
        fixedRequestBody.dueDate &&
        typeof fixedRequestBody.dueDate === "string"
      ) {
        try {
          // Ensure the date is valid
          const testDate = new Date(fixedRequestBody.dueDate);
          if (!isNaN(testDate.getTime())) {
            console.log("Valid date format detected");
          } else {
            console.log("Invalid date format, removing dueDate");
            delete fixedRequestBody.dueDate;
          }
        } catch (dateError) {
          console.log("Error parsing date, removing dueDate:", dateError);
          delete fixedRequestBody.dueDate;
        }
      }

      console.log(
        "Processing task with fixed data:",
        JSON.stringify(fixedRequestBody),
      );

      // Apply schema validation
      let taskData;
      try {
        taskData = insertTaskSchema.parse(fixedRequestBody);
        console.log("Task data validated successfully");
      } catch (zodError) {
        console.error("Task validation error:", zodError);
        return res.status(400).json({
          message: "Invalid task data",
          details:
            zodError instanceof z.ZodError
              ? zodError.errors
              : "Unknown validation error",
        });
      }

      // Check if user has editor or owner access to the project
      if (taskData.projectId) {
        console.log(
          `Checking user authorization for project ${taskData.projectId}`,
        );
        const isAuthorized = await storage.isUserAuthorized(
          taskData.projectId,
          userId,
          "editor",
        );

        if (!isAuthorized) {
          console.error(
            `User ${userId} not authorized to add tasks to project ${taskData.projectId}`,
          );
          return res.status(403).json({
            message: "You don't have permission to add tasks to this project",
          });
        }
      }

      console.log(
        "Creating task with validated data:",
        JSON.stringify(taskData),
      );
      const task = await storage.createTask(taskData);
      console.log("Task created successfully:", JSON.stringify(task));

      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({
        message: "Failed to create task",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
  // NLP Task Updater endpoint - processes natural language task commands
  app.post("/api/tasks/nlp-update", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      const { command, projectId } = req.body;

      if (!command || !projectId) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: command and projectId",
          error: "INVALID_REQUEST",
        });
      }

      // Check if user has access to the project
      const isAuthorized = await storage.isUserAuthorized(
        projectId,
        userId,
        "editor",
      );

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to modify tasks in this project",
          error: "UNAUTHORIZED",
        });
      }

      console.log(
        `[NLP Task Updater] Processing command for project ${projectId}: "${command}"`,
      );

      // Process the NLP command
      const result = await nlpTaskUpdater.processCommand(command, projectId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error processing NLP task command:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process command",
        error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      });
    }
  });

  app.patch("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;

      console.log(
        `Updating task ${taskId} with data:`,
        JSON.stringify(req.body),
      );

      const task = await storage.getTask(taskId);
      if (!task) {
        console.log(`Task ${taskId} not found`);
        return res.status(404).json({ message: "Task not found" });
      }

      // Check if user has access to the project this task belongs to
      if (task.projectId) {
        const isAuthorized = await storage.isUserAuthorized(
          task.projectId,
          userId,
          ProjectRole.EDITOR,
        );

        if (!isAuthorized) {
          console.log(`User ${userId} not authorized to update task ${taskId}`);
          return res.status(403).json({
            message:
              "You don't have permission to update tasks in this project",
          });
        }
      }

      // Create a sanitized copy of the update data
      const updateData: Record<string, any> = {};

      // Only copy fields that we want to update
      const allowedFields = [
        "name",
        "description",
        "status",
        "priority",
        "isCompleted",
        "assigneeId",
        "storyPoints",
        "startDate",
      ];

      // Process regular fields
      for (const field of allowedFields) {
        if (field in req.body) {
          updateData[field] = req.body[field];
          console.log(
            `Setting field ${field} to:`,
            req.body[field],
            `(type: ${typeof req.body[field]})`,
          );
        }
      }

      // Helper function for safe date conversion that handles timezone issues
      const safeDateConvert = (value: any): Date | null => {
        if (value === null || value === undefined || value === "") {
          return null;
        }

        try {
          // If it's already a YYYY-MM-DD string, parse it as local date at noon to avoid timezone shifts
          if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [year, month, day] = value.split("-").map(Number);
            // Create date at noon local time to avoid any timezone edge cases
            return new Date(year, month - 1, day, 12, 0, 0);
          }

          const date = new Date(value);
          if (date instanceof Date && !isNaN(date.getTime())) {
            return date;
          } else {
            console.warn("Invalid date value received:", value);
            return null;
          }
        } catch (e) {
          console.error("Error converting date:", e);
          return null;
        }
      };

      // Bulletproof date handling for dueDate
      if ("dueDate" in req.body) {
        updateData.dueDate = safeDateConvert(req.body.dueDate);
      }

      // Bulletproof date handling for startDate
      if ("startDate" in req.body) {
        updateData.startDate = safeDateConvert(req.body.startDate);
        console.log(
          `Processed startDate: ${req.body.startDate} -> ${updateData.startDate}`,
        );
      }

      console.log(`Sanitized update data:`, JSON.stringify(updateData));

      // Ensure assigneeId is handled correctly - it should be a string or null
      if ("assigneeId" in updateData) {
        // Make sure assigneeId is either a string or null, never undefined
        if (
          updateData.assigneeId === undefined ||
          updateData.assigneeId === ""
        ) {
          updateData.assigneeId = null;
        }
        console.log(
          `Processed assigneeId: ${updateData.assigneeId} (type: ${typeof updateData.assigneeId})`,
        );
      }

      try {
        const updatedTask = await storage.updateTask(taskId, updateData);
        console.log(
          `Successfully updated task ${taskId}:`,
          JSON.stringify(updatedTask),
        );
        res.json(updatedTask);
      } catch (storageError) {
        console.error("Storage error during task update:", storageError);
        throw storageError;
      }
    } catch (error) {
      console.error("Error updating task:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        message: `Failed to update task: ${errorMessage}`,
        details:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
    }
  });

  app.delete("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const userId = req.user.dbUserId || req.user.claims.sub;
      const task = await storage.getTask(taskId);

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check if user has editor or owner access to the project this task belongs to
      if (task.projectId) {
        const isAuthorized = await storage.isUserAuthorized(
          task.projectId,
          userId,
          ProjectRole.EDITOR,
        );

        if (!isAuthorized) {
          return res.status(403).json({
            message:
              "You don't have permission to delete tasks in this project",
          });
        }
      }

      await storage.deleteTask(taskId);
      // Return a JSON response instead of empty 204
      return res.status(200).json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({
        message: `Failed to delete task: ${errorMessage}`,
      });
    }
  });

  // Kanban Columns endpoints
  app.get(
    "/api/projects/:id/kanban-columns",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Check if user has access to the project
        const isAuthorized = await storage.isUserAuthorized(projectId, userId);
        if (!isAuthorized) {
          return res.status(403).json({
            message:
              "You don't have permission to access this project's kanban columns",
          });
        }

        // Get or create default columns if they don't exist
        const columns = await storage.getDefaultKanbanColumns(projectId);
        res.json(columns);
      } catch (error) {
        console.error("Error fetching kanban columns:", error);
        res.status(500).json({ message: "Failed to fetch kanban columns" });
      }
    },
  );

  app.post(
    "/api/projects/:id/kanban-columns",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Check if user has access to update the project
        const isAuthorized = await storage.isUserAuthorized(
          projectId,
          userId,
          ProjectRole.EDITOR,
        );
        if (!isAuthorized) {
          return res.status(403).json({
            message:
              "You don't have permission to modify this project's kanban columns",
          });
        }

        const columnData = { ...req.body, projectId };
        const column = await storage.createKanbanColumn(columnData);
        res.status(201).json(column);
      } catch (error) {
        console.error("Error creating kanban column:", error);
        res.status(500).json({ message: "Failed to create kanban column" });
      }
    },
  );

  app.patch(
    "/api/kanban-columns/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const columnId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Get the column to check project permissions
        const column = await storage.getKanbanColumnById(columnId);

        if (!column) {
          return res.status(404).json({ message: "Kanban column not found" });
        }

        // Check if user has access to update the project this column belongs to
        const isAuthorized = await storage.isUserAuthorized(
          column.projectId,
          userId,
          ProjectRole.EDITOR,
        );
        if (!isAuthorized) {
          return res.status(403).json({
            message: "You don't have permission to modify this kanban column",
          });
        }

        const updatedColumn = await storage.updateKanbanColumn(
          columnId,
          req.body,
        );
        res.json(updatedColumn);
      } catch (error) {
        console.error("Error updating kanban column:", error);
        res.status(500).json({ message: "Failed to update kanban column" });
      }
    },
  );

  // AI File Processing endpoint - Process uploaded files for project planning
  app.post("/api/ai/process-files", async (req: any, res) => {
    try {
      // Configure multer for temporary file upload
      const upload = multer({
        dest: "uploads/temp/",
        limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
      }).fields([
        { name: "files", maxCount: 10 },
        { name: "userPrompt", maxCount: 1 },
      ]);

      upload(req, res, async (err) => {
        if (err) {
          console.error("File upload error:", err);
          return res
            .status(400)
            .json({ message: "File upload failed", error: err.message });
        }

        const files =
          (req.files as { [fieldname: string]: Express.Multer.File[] })
            ?.files || [];
        const userPrompt = req.body?.userPrompt || "";

        if (!files || files.length === 0) {
          return res.status(400).json({ message: "No files uploaded" });
        }

        try {
          const result = await fileProcessor.processFiles(files, userPrompt);
          res.json(result);
        } catch (error) {
          console.error("File processing error:", error);
          res.status(500).json({ message: "Failed to process files" });
        }
      });
    } catch (error) {
      console.error("Error in file processing endpoint:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's chat sessions
  app.get("/api/ai/chat-sessions", async (req: any, res) => {
    try {
      // Use authenticated user if available, otherwise demo user
      let userId = "demo-user-123";
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        userId = req.user.dbUserId || req.user.claims?.sub || "demo-user-123";
      }

      const sessions = await storage.getUserChatSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
      res.status(500).json({ message: "Failed to fetch chat sessions" });
    }
  });

  // Create new session
  app.post("/api/agent/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      const session = await storage.createChatSession(userId);
      res.json(session);
    } catch (error: any) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  // Get session history
  app.get(
    "/api/agent/sessions/:sessionId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        // Typically you'd also check if the session belongs to the user,
        // but for now we'll rely on UUID unguessability + nice-to-have ownership check if we had time.
        const history = await storage.getChatHistory(req.params.sessionId);
        res.json(history);
      } catch (error: any) {
        console.error("Error fetching history:", error);
        res.status(500).json({ error: "Failed to fetch history" });
      }
    },
  );

  // Delete session
  app.delete(
    "/api/agent/sessions/:sessionId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        await storage.deleteChatSession(req.params.sessionId);
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting session:", error);
        res.status(500).json({ error: "Failed to delete session" });
      }
    },
  );

  // ------------------------------

  app.post("/api/agent/process", isAuthenticated, async (req: any, res) => {
    console.log("Processing agent request:", req.body);
    try {
      const { message, sessionId: providedSessionId } = req.body;
      const userId = req.user.dbUserId || req.user.claims.sub;

      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Ensure a session exists
      let sessionId = providedSessionId;
      if (!sessionId) {
        const newSession = await storage.createChatSession(userId);
        sessionId = newSession.sessionId;
      }

      // Persist USER message
      await storage.saveChatMessage(sessionId, "user", message);

      const result = await geminiAgent.processMessage(message, userId);

      // Persist ASSISTANT message
      await storage.saveChatMessage(sessionId, "assistant", result.response, {
        actions: result.actions,
        suggestedPrompts: result.suggestedPrompts,
      });

      // Generate title for new sessions (if it's the first exchange)
      // We check if the session was just created or has the default title
      if (!providedSessionId) {
        // Run in background to not delay response, but we risk frontend fetching too early.
        // Or await it. 1.5 Flash is fast, let's await to avoid race condition.
        try {
          console.log(
            `[Title Gen] Attempting to generate title for NEW session: ${sessionId}`,
          );
          const { generateTitle } = await import("./services/gemini-agent");
          const newTitle = await generateTitle(message, result.response);
          console.log(`[Title Gen] Generated title: "${newTitle}"`);
          await storage.updateChatSessionTitle(sessionId, newTitle);
          console.log(
            `[Title Gen] Title updated in DB for session: ${sessionId}`,
          );
        } catch (titleError) {
          console.error("[Title Gen] Failed to generate title:", titleError);
        }
      }

      res.json({ ...result, sessionId });
    } catch (error: any) {
      console.error("Agent processing error:", error);
      res.status(500).json({
        message: "Error processing request",
        error: error.message,
      });
    }
  });

  // Get chat history for a specific session
  app.get("/api/ai/chat-history/:sessionId", async (req: any, res) => {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      const history = await storage.getChatHistory(sessionId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      res.status(500).json({ message: "Failed to fetch chat history" });
    }
  });

  // Create a new chat session
  app.post("/api/ai/chat-sessions", async (req: any, res) => {
    try {
      const { projectId } = req.body;

      // Use authenticated user if available, otherwise demo user
      let userId = "demo-user-123";
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        userId = req.user.dbUserId || req.user.claims?.sub || "demo-user-123";
      }

      const result = await storage.createChatSession(userId, projectId);
      res.json(result);
    } catch (error) {
      console.error("Error creating chat session:", error);
      res.status(500).json({ message: "Failed to create chat session" });
    }
  });

  app.patch("/api/ai/chat-sessions/:sessionId/title", async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { title } = req.body;
      if (!sessionId || !title) {
        return res.status(400).json({ message: "Session ID and title are required" });
      }
      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      let userId = "demo-user-123";
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        userId = req.user.dbUserId || req.user.claims?.sub || "demo-user-123";
      }
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (session.title && session.title !== "New Conversation") {
        return res.json({ success: true, skipped: true });
      }
      const sanitizedTitle = title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
      await storage.updateChatSessionTitle(sessionId, sanitizedTitle);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating session title:", error);
      res.status(500).json({ message: "Failed to update session title" });
    }
  });

  // AI Chat endpoint - Enhanced with working agent
  app.post("/api/ai/chat", async (req: any, res) => {
    try {
      const {
        message,
        projectId,
        attachments,
        sessionId: providedSessionId,
      } = req.body;

      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      console.log(`AI Chat request: "${message}"`);

      // Check for OpenAI API key
      if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
        return res.status(500).json({
          message:
            "OpenAI API key is missing. Please add your API key to enable AI functionality.",
          error: "MISSING_API_KEY",
        });
      }

      // Use authenticated user if available, otherwise demo user
      let userId = "demo-user-123";
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        userId = req.user.dbUserId || req.user.claims?.sub || "demo-user-123";
      }

      const { deepPlannerAgent } = await import("./deep-intelligence-agent-v2");
      const { SimpleAIAgent } = await import("./simple-ai-agent");
      const { detectUpdateIntent } = await import("./utils/update-detection");
      const { plannerMemory } = await import("./project-planner-memory");
      const { mergePlans } = await import("./utils/plan-merge");
      deepPlannerAgent.trackingUserId = userId;

      // Check if this is a project planning request - expanded detection
      const isPlanningRequest =
        message.toLowerCase().includes("plan") ||
        message.toLowerCase().includes("project") ||
        message.toLowerCase().includes("create") ||
        message.toLowerCase().includes("onboard") ||
        message.toLowerCase().includes("launch") ||
        message.toLowerCase().includes("campaign") ||
        message.toLowerCase().includes("analyze client rfp") ||
        (message.toLowerCase().includes("analyze") &&
          message.toLowerCase().includes("rfp")) ||
        message.toLowerCase().includes("process compliance documentation") ||
        message.toLowerCase().includes("compliance documentation") ||
        message.toLowerCase().includes("app") ||
        message.toLowerCase().includes("system") ||
        message.toLowerCase().includes("platform") ||
        message.toLowerCase().includes("website") ||
        message.toLowerCase().includes("build") ||
        message.toLowerCase().includes("develop") ||
        message.toLowerCase().includes("design") ||
        message.toLowerCase().includes("tool") ||
        message.toLowerCase().includes("software");

      // Initialize session for deep agent if needed
      let sessionId = providedSessionId;

      // Create a new session if not provided
      if (!sessionId) {
        const sessionResult = await storage.createChatSession(
          userId,
          projectId,
        );
        sessionId = sessionResult.sessionId;
      }

      // Use robust update detection
      const existingPlanFromClient = req.body.existingProject;
      const existingPlanFromMemory = plannerMemory.getLatestPlan(sessionId);
      const hasActiveProject = !!(
        existingPlanFromClient || existingPlanFromMemory
      );

      const updateDetection = detectUpdateIntent(
        message,
        existingPlanFromClient,
        hasActiveProject,
      );

      const isUpdateRequest = updateDetection.isUpdate;

      console.log(
        `🔍 Request analysis: isPlanningRequest=${isPlanningRequest}, ` +
          `isUpdateRequest=${isUpdateRequest} (${updateDetection.method}, confidence: ${updateDetection.confidence})`,
      );

      if (
        updateDetection.detectedKeywords &&
        updateDetection.detectedKeywords.length > 0
      ) {
        console.log(
          `  Detected keywords: ${updateDetection.detectedKeywords.join(", ")}`,
        );
      }

      // Check if attachments are mentioned in the message
      if (attachments && attachments.length > 0) {
        console.log(
          `Chat request includes ${attachments.length} attachments:`,
          attachments.map((a) => a.name || a.fileName).join(", "),
        );
      }

      // Save user message to database
      await storage.saveChatMessage(sessionId, "user", message, {
        attachments,
      });

      // Build context with user's data
      let projects, allTasks;

      if (userId !== "demo-user-123") {
        // Get user-specific data
        projects = await storage.getProjectsForUser(userId);
        allTasks = [];
        for (const project of projects) {
          const projectTasks = await storage.getTasksByProjectId(project.id);
          allTasks.push(...projectTasks);
        }
      } else {
        // Demo mode - get all data
        projects = await storage.getAllProjects();
        allTasks = await storage.getAllTasks();
      }

      const context = {
        projects: projects.slice(0, 20),
        tasks: allTasks.slice(0, 50),
        userId: userId,
        user: null,
      };

      console.log(
        `Processing message for user ${userId} with ${context.projects.length} projects and ${context.tasks.length} tasks`,
      );
      console.log(
        `🔍 Planning detection for "${message}": isPlanningRequest=${isPlanningRequest}`,
      );

      // Force deep intelligence for RFP analysis, compliance documentation, or project planning requests
      const isRFPAnalysis =
        message.toLowerCase().includes("analyze client rfp") ||
        (message.toLowerCase().includes("analyze") &&
          message.toLowerCase().includes("rfp"));

      const isComplianceDoc =
        message.toLowerCase().includes("process compliance documentation") ||
        message.toLowerCase().includes("compliance documentation");

      // Use deep intelligence for project planning requests OR project updates
      if (
        (isPlanningRequest ||
          isUpdateRequest ||
          isRFPAnalysis ||
          isComplianceDoc) &&
        sessionId
      ) {
        const requestType = isRFPAnalysis
          ? "RFP analysis"
          : isComplianceDoc
            ? "compliance documentation"
            : isUpdateRequest
              ? "project update"
              : "planning";
        console.log(
          `Using deep intelligence agent for ${requestType} request with session ${sessionId}`,
        );

        // Always create a fresh session for the deep planner since it uses in-memory storage
        const validSessionId = await deepPlannerAgent.initSession(userId);
        console.log(`Created new deep planner session: ${validSessionId}`);

        // Get existing plan from client or memory (prioritize client)
        const existingProject =
          existingPlanFromClient || existingPlanFromMemory;

        // If updating existing project, pass the existing project context
        let messageWithContext = message;

        if (isUpdateRequest && existingProject) {
          console.log(
            `📝 Processing UPDATE request with existing project: ${existingProject.name || "Unnamed"}`,
          );
          messageWithContext = `${message}\n\nCONTEXT: This is an UPDATE to an existing project. Here is the current project structure:\n${JSON.stringify(existingProject, null, 2)}\n\nIMPORTANT INSTRUCTIONS:\n- PRESERVE all existing milestone and task IDs that remain in the updated plan\n- MERGE the new request with the existing structure\n- Add new milestones/tasks with new IDs as needed\n- Use the same structure format as the existing project`;
        }

        const deepResponse = await deepPlannerAgent.processMessage(
          messageWithContext,
          validSessionId,
        );

        // Save the generated/updated plan to memory and optionally perform server-side merge
        if (deepResponse.projectCanvas) {
          let finalPlan = deepResponse.projectCanvas;
          let mergeInfo = null;

          // If this was an update, perform server-side merge validation
          if (isUpdateRequest && existingProject) {
            // Extract diff metadata from AI response if available
            const diffMetadata = (deepResponse as any).diff;

            const mergeResult = mergePlans(
              existingProject,
              deepResponse.projectCanvas,
              "preserve_ids",
              diffMetadata,
            );

            console.log(`🔀 Server merge result:`, {
              preservedIds: mergeResult.preservedIds,
              changesAdded: mergeResult.changes.added.length,
              changesUpdated: mergeResult.changes.updated.length,
              changesRemoved: mergeResult.changes.removed.length,
            });

            finalPlan = mergeResult.mergedPlan;
            mergeInfo = {
              preservedIds: mergeResult.preservedIds,
              changes: mergeResult.changes,
            };

            // Update the response with merged plan
            deepResponse.projectCanvas = finalPlan;
          }

          const summary = isUpdateRequest
            ? `Updated plan: ${message.substring(0, 100)}`
            : `Created plan: ${deepResponse.projectCanvas.name || "New Project"}`;

          plannerMemory.savePlanSnapshot(
            sessionId,
            finalPlan,
            summary,
            isUpdateRequest
              ? mergeInfo?.preservedIds
                ? "merged"
                : "updated"
              : "generated",
          );

          console.log(
            `💾 Saved plan snapshot to memory for session ${sessionId}`,
          );

          // Add merge diagnostics to response
          if (mergeInfo) {
            deepResponse.mergeInfo = mergeInfo;
          }

          // Log if diff metadata was expected but missing
          if (isUpdateRequest && existingProject) {
            const diffMetadata = (deepResponse as any).diff;
            if (!diffMetadata) {
              console.warn(
                "⚠️ UPDATE request completed but AI did not provide diff metadata. Falling back to safe merge (preserve unmentioned items).",
              );
            } else {
              console.log(
                "✅ AI provided diff metadata for update:",
                diffMetadata,
              );
            }
          }
        }

        // Save assistant response to database
        await storage.saveChatMessage(
          validSessionId,
          "assistant",
          deepResponse.content,
          {
            projectCanvas: deepResponse.projectCanvas,
            clarifications: deepResponse.clarifications,
            suggestions: deepResponse.suggestions,
            diff: (deepResponse as any).diff, // Include diff metadata in response
          },
        );

        // For RFP analysis or compliance documentation, ensure we always return a project canvas
        if ((isRFPAnalysis || isComplianceDoc) && !deepResponse.projectCanvas) {
          const projectType = isRFPAnalysis
            ? "RFP Analysis"
            : "Compliance Documentation";
          console.log(
            `${projectType} requested but no project canvas generated, creating default structure`,
          );

          // Generate appropriate project structure based on request type
          if (isComplianceDoc) {
            deepResponse.projectCanvas = {
              name: "Compliance Documentation Processing",
              description:
                "Comprehensive compliance documentation project plan",
              timeline: {
                startDate: new Date().toISOString().split("T")[0],
                endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
              },
              milestones: [
                {
                  id: "m1",
                  name: "Compliance Standards Identification",
                  description:
                    "Identify and document all required compliance standards",
                  date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0],
                  tasks: [
                    {
                      id: "t1",
                      name: "Research industry standards",
                      description:
                        "Research applicable compliance standards for your industry",
                      priority: "high",
                      status: "pending",
                      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split("T")[0],
                    },
                    {
                      id: "t2",
                      name: "Document regulatory requirements",
                      description:
                        "Create comprehensive list of all regulatory requirements",
                      priority: "high",
                      status: "pending",
                      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split("T")[0],
                    },
                  ],
                },
                {
                  id: "m2",
                  name: "Documentation Creation",
                  description: "Create all required compliance documentation",
                  date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0],
                  tasks: [
                    {
                      id: "t3",
                      name: "Develop compliance policies",
                      description:
                        "Write comprehensive compliance policies and procedures",
                      priority: "high",
                      status: "pending",
                      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split("T")[0],
                    },
                    {
                      id: "t4",
                      name: "Create audit trail documentation",
                      description:
                        "Establish audit trail and tracking mechanisms",
                      priority: "medium",
                      status: "pending",
                      dueDate: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split("T")[0],
                    },
                  ],
                },
                {
                  id: "m3",
                  name: "Review and Implementation",
                  description:
                    "Review, finalize, and implement compliance framework",
                  date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0],
                  tasks: [
                    {
                      id: "t5",
                      name: "Internal compliance review",
                      description:
                        "Conduct thorough internal review of all documentation",
                      priority: "high",
                      status: "pending",
                      dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split("T")[0],
                    },
                    {
                      id: "t6",
                      name: "Implement compliance framework",
                      description:
                        "Roll out compliance framework across organization",
                      priority: "high",
                      status: "pending",
                      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split("T")[0],
                    },
                  ],
                },
              ],
            };
          } else {
            // RFP Analysis default structure
            deepResponse.projectCanvas = {
              name: "RFP Analysis Project",
              description: "Project plan generated from RFP document analysis",
              timeline: {
                startDate: new Date().toISOString().split("T")[0],
                endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
              },
              milestones: [
                {
                  id: "m1",
                  name: "Requirements Analysis",
                  description: "Analyze and document all RFP requirements",
                  date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0],
                  tasks: [
                    {
                      id: "t1",
                      name: "Review RFP document",
                      description: "Thoroughly review the RFP document",
                      priority: "high",
                      status: "pending",
                      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split("T")[0],
                    },
                  ],
                },
              ],
            };
          }
        }

        // For planning requests, prioritize canvas data over chat content
        if (isPlanningRequest && deepResponse.projectCanvas) {
          console.log(
            "🎯 Planning request detected - returning canvas data directly",
          );
          res.json({
            projectCanvas: deepResponse.projectCanvas,
            content: "", // Empty content for direct canvas updates
            clarifications: deepResponse.clarifications || [],
            suggestions: deepResponse.suggestions || [],
            sessionId: validSessionId,
            confidence: deepResponse.confidence,
            isDirectCanvas: true, // Flag to indicate this is a direct canvas response
            diff: (deepResponse as any).diff, // Include diff metadata
            mergeInfo: deepResponse.mergeInfo, // Include merge diagnostics
          });
        } else {
          res.json({
            content: deepResponse.content,
            projectCanvas: deepResponse.projectCanvas || null,
            clarifications: deepResponse.clarifications || [],
            suggestions: deepResponse.suggestions || [],
            sessionId: validSessionId,
            confidence: deepResponse.confidence,
            diff: (deepResponse as any).diff, // Include diff metadata
            mergeInfo: deepResponse.mergeInfo, // Include merge diagnostics
          });
        }
      } else {
        // Use regular agent for other requests
        console.log(`Using simple agent for general request`);
        const agent = new SimpleAIAgent(userId);
        const response = await agent.processMessage(message, context as any);

        // Save assistant response to database
        await storage.saveChatMessage(
          sessionId,
          "assistant",
          response.content,
          {
            actions: response.actions,
            insights: response.insights,
            suggestedPrompts: response.suggestedPrompts,
            projectCanvas: response.projectCanvas,
          },
        );

        res.json({
          content: response.content,
          actions: response.actions || [],
          insights: response.insights || [],
          suggestedPrompts: response.suggestedPrompts || [],
          projectCanvas: response.projectCanvas || null,
          sessionId: sessionId,
        });
      }
    } catch (error) {
      console.error("AI Chat Error:", error);
      res.status(500).json({
        message:
          "I encountered an error processing your request. Please try again.",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // AI Action execution endpoint
  app.post("/api/ai/execute-action", async (req: any, res) => {
    try {
      const { action } = req.body;

      if (!action || !action.type) {
        return res
          .status(400)
          .json({ message: "Action with type is required" });
      }

      console.log(`Executing AI action: ${action.type}`, action.data);

      // Use authenticated user if available, otherwise demo user
      let userId = "demo-user-123";
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        userId = req.user.dbUserId || req.user.claims?.sub || "demo-user-123";
      }

      let result;

      switch (action.type) {
        case "task_created":
        case "task_updated":
          if (action.data?.taskId) {
            const task = await storage.getTask(action.data.taskId);
            result = { message: `Task action completed`, data: task };
          } else {
            result = { message: "Task action completed" };
          }
          break;

        case "project_created":
          if (action.data?.projectId) {
            const project = await storage.getProject(action.data.projectId);
            result = { message: `Project action completed`, data: project };
          } else {
            result = { message: "Project action completed" };
          }
          break;

        case "show_overdue":
        case "show_roi_tasks":
        case "prioritize_tasks":
          result = { message: `Analysis completed`, data: action.data };
          break;

        default:
          result = { message: `Action ${action.type} executed successfully` };
      }

      res.json(result);
    } catch (error) {
      console.error("AI Action execution error:", error);
      res.status(500).json({
        message: "Failed to execute action",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.delete(
    "/api/kanban-columns/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const columnId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Get the column to check project permissions
        const column = await storage.getKanbanColumnById(columnId);
        if (!column) {
          return res.status(404).json({ message: "Kanban column not found" });
        }

        // Check if user has access to update the project this column belongs to
        const isAuthorized = await storage.isUserAuthorized(
          column.projectId,
          userId,
          ProjectRole.EDITOR,
        );
        if (!isAuthorized) {
          return res.status(403).json({
            message: "You don't have permission to delete this kanban column",
          });
        }

        await storage.deleteKanbanColumn(columnId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting kanban column:", error);
        res.status(500).json({ message: "Failed to delete kanban column" });
      }
    },
  );

  // All integration routes require auth + are now scoped to the calling user.
  app.get("/api/integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const all = await storage.getAllIntegrations();
      // Filter to only integrations owned by this user.
      const mine = (all || []).filter(
        (i: any) => !i.userId || i.userId === userId,
      );
      res.json(mine);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      // Force ownership to the requesting user; never trust a userId in the body.
      const integrationData = insertIntegrationSchema.parse({
        ...req.body,
        userId,
      });
      const integration = await storage.createIntegration(integrationData);
      res.status(201).json(integration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/integrations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const integrationId = parseInt(req.params.id);
      const integration = await storage.getIntegration(integrationId);

      // Return 404 (not 403) on ownership mismatch to prevent enumeration.
      if (!integration || (integration.userId && integration.userId !== userId)) {
        return res.status(404).json({ message: "Integration not found" });
      }

      await storage.deleteIntegration(integrationId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Export to external tools
  app.post("/api/integrations/export/:provider", isAuthenticated, async (req: any, res) => {
    try {
      const { provider } = req.params;
      const { plan } = req.body;

      if (!plan) {
        return res.status(400).json({ message: "Project plan is required" });
      }

      // Check project creation limits before export
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (userId) {
        console.log("Checking project creation limits for export:", userId);
        const limitCheck = await storage.canUserCreateProject(userId);
        console.log("Project limit check result for export:", limitCheck);

        if (!limitCheck.allowed) {
          console.log(
            "Project creation during export blocked:",
            limitCheck.reason,
          );
          return res.status(403).json({
            message: "Project creation limit reached",
            reason: limitCheck.reason,
            current: limitCheck.current,
            max: limitCheck.max,
            suggestion: "Please upgrade your plan to create more projects.",
          });
        }
      }

      // In a real implementation, this would use the appropriate API client for each tool
      // For the demo, we'll simulate a successful export

      // First create the project locally
      const newProject = await storage.createProject({
        name: plan.name,
        description: plan.description,
        dueDate: new Date(plan.timeline.endDate),
        progress: 0,
        totalTasks: plan.tasks.length,
        completedTasks: 0,
        icon: "sparkles",
        iconBg: "blue",
        aiGenerated: true,
        source: provider, // Track that it was exported to this tool
        externalId: `ext-${Date.now()}`, // Simulated external ID
      });

      // Create tasks for the project
      for (const taskData of plan.tasks) {
        await storage.createTask({
          name: taskData.name,
          description: taskData.description || "",
          status: "todo",
          priority: taskData.priority || "medium",
          dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
          projectId: newProject.id,
          assigneeId: taskData.assigneeId,
          source: provider, // Track that it was exported to this tool
          externalId: `ext-task-${Date.now()}-${Math.round(Math.random() * 1000)}`, // Simulated external ID
        });
      }

      // Return a response with export details
      return res.json({
        success: true,
        message: `Project successfully exported to ${provider}`,
        exportDetails: {
          provider,
          projectId: newProject.id,
          externalId: newProject.externalId,
          url: `https://example.com/${provider}/projects/${newProject.externalId}`,
        },
      });
    } catch (error) {
      console.error(`Error exporting to ${req.params.provider}:`, error);
      return res
        .status(500)
        .json({ message: `Failed to export to ${req.params.provider}` });
    }
  });

  app.get("/api/insights", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;

      // Get all projects user has access to
      const accessibleProjects = await storage.getProjectsForUser(userId);
      const accessibleProjectIds = accessibleProjects.map((p) => p.id);

      // Get all insights
      const allInsights = await storage.getAllInsights();

      // Filter insights to only include those from accessible projects
      const accessibleInsights = allInsights.filter(
        (insight) =>
          !insight.projectId ||
          accessibleProjectIds.includes(insight.projectId),
      );

      res.json(accessibleInsights);
    } catch (error) {
      console.error("Error fetching insights:", error);
      res.status(500).json({ message: "Failed to fetch insights" });
    }
  });

  app.post("/api/insights", isAuthenticated, async (req: any, res) => {
    try {
      const insightData = insertInsightSchema.parse(req.body);
      const userId = req.user.dbUserId || req.user.claims.sub;

      // If the insight is related to a project, check access
      if (insightData.projectId) {
        const isAuthorized = await storage.isUserAuthorized(
          insightData.projectId,
          userId,
          ProjectRole.EDITOR,
        );

        if (!isAuthorized) {
          return res.status(403).json({
            message:
              "You don't have permission to create insights for this project",
          });
        }
      }

      const insight = await storage.createInsight(insightData);
      res.status(201).json(insight);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      console.error("Error creating insight:", error);
      res.status(500).json({ message: "Failed to create insight" });
    }
  });

  app.patch("/api/insights/:id", isAuthenticated, async (req: any, res) => {
    try {
      const insightId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;
      const insight = await storage.getInsight(insightId);

      if (!insight) {
        return res.status(404).json({ message: "Insight not found" });
      }

      // If the insight is related to a project, check access
      if (insight.projectId) {
        const isAuthorized = await storage.isUserAuthorized(
          insight.projectId,
          userId,
          ProjectRole.EDITOR,
        );

        if (!isAuthorized) {
          return res.status(403).json({
            message:
              "You don't have permission to update insights for this project",
          });
        }
      }

      const updatedInsight = await storage.updateInsight(insightId, req.body);
      res.json(updatedInsight);
    } catch (error) {
      console.error("Error updating insight:", error);
      res.status(500).json({ message: "Failed to update insight" });
    }
  });

  app.get("/api/metrics", isAuthenticated, async (req: any, res) => {
    try {
      // Only include projects and tasks the user has access to
      const userId = req.user.dbUserId || req.user.claims.sub;
      const projects = await storage.getProjectsForUser(userId);

      // Get all accessible project IDs
      const accessibleProjectIds = projects.map((p) => p.id);

      // Get all tasks for these projects
      const allTasks = await storage.getAllTasks();
      const tasks = allTasks.filter(
        (task) =>
          task.projectId && accessibleProjectIds.includes(task.projectId),
      );

      // Get insights for these projects
      const allInsights = await storage.getAllInsights();
      const insights = allInsights.filter(
        (insight) =>
          insight.projectId && accessibleProjectIds.includes(insight.projectId),
      );

      // Calculate metrics
      const activeProjects = projects.filter(
        (p) => p.status === "active",
      ).length;
      const completedTasks = tasks.filter((t) => t.status === "done").length;
      const totalTasks = tasks.length;
      const completionPercentage =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const atRiskProjects = insights
        .filter((i) => i.severity === "warning" || i.severity === "critical")
        .reduce((uniqueProjectIds, insight) => {
          if (
            insight.projectId &&
            !uniqueProjectIds.includes(insight.projectId)
          ) {
            uniqueProjectIds.push(insight.projectId);
          }
          return uniqueProjectIds;
        }, [] as number[]).length;

      const bottlenecks = insights.filter(
        (i) => i.type === "bottleneck",
      ).length;

      // Calculate on-track percentage (projects without critical issues)
      const projectsWithIssues = insights
        .filter((i) => i.severity === "warning" || i.severity === "critical")
        .reduce((uniqueProjectIds, insight) => {
          if (
            insight.projectId &&
            !uniqueProjectIds.includes(insight.projectId)
          ) {
            uniqueProjectIds.push(insight.projectId);
          }
          return uniqueProjectIds;
        }, [] as number[]);

      const onTrackPercentage =
        activeProjects > 0
          ? Math.round(
              ((activeProjects - projectsWithIssues.length) / activeProjects) *
                100,
            )
          : 100;

      const metrics = {
        activeProjects,
        onTrackPercentage,
        totalTasks,
        completedTasks,
        completionPercentage,
        atRiskProjects,
        bottlenecks,
      };

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // AI Agent endpoint for general conversation and insights
  app.post("/api/agent/message", isAuthenticated, async (req: any, res) => {
    try {
      const { message, context } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const userId = req.user.dbUserId || req.user.claims.sub;

      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
        return res.status(500).json({
          content:
            "AI capabilities are not available. Please configure OpenAI API key.",
          actions: [],
          insights: [],
          suggestedPrompts: [],
        });
      }

      const { SimpleAIAgent } = await import("./simple-ai-agent");
      const agent = new SimpleAIAgent(userId);

      // Get fresh project and task data
      const projects = await storage.getProjectsForUser(userId);
      const allTasks = await storage.getAllTasks();
      const userTasks = allTasks.filter((task) =>
        projects.some((project) => project.id === task.projectId),
      );

      const agentContext = {
        projects,
        tasks: userTasks,
        userId,
      };

      const response = await agent.processMessage(message, agentContext);
      res.json(response);
    } catch (error) {
      console.error("Agent message error:", error);
      res.status(500).json({
        error: "Failed to process agent message",
        content:
          "I encountered an error processing your request. Please try again.",
        actions: [],
        insights: [],
        suggestedPrompts: [],
      });
    }
  });

  // Task breakdown endpoint (AI-powered subtask creation)
  app.post("/api/tasks/breakdown", async (req, res) => {
    try {
      const { taskId, projectId } = req.body;

      if (!taskId || !projectId) {
        return res
          .status(400)
          .json({ error: "Task ID and Project ID are required" });
      }

      // Get the task details
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Use AI to break down the task into subtasks
      const response = await fetch("/api/ai/breakdown-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle: task.title,
          taskDescription: task.description,
          priority: task.priority,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate subtasks");
      }

      const aiResponse = await response.json();
      const subtasks = aiResponse.subtasks || [];

      // Create subtasks in the database
      const createdSubtasks = [];
      for (const subtask of subtasks) {
        const newSubtask = await storage.createSubtask({
          title: subtask.title,
          description: subtask.description,
          projectId: projectId,
          parentTaskId: taskId,
          priority: subtask.priority || task.priority,
          status: "todo",
          dueDate: subtask.dueDate ? new Date(subtask.dueDate) : null,
        });
        createdSubtasks.push(newSubtask);
      }

      res.json({
        message: `Created ${createdSubtasks.length} subtasks`,
        subtasks: createdSubtasks,
      });
    } catch (error) {
      console.error("Task breakdown error:", error);
      res.status(500).json({
        error: "Failed to break down task",
      });
    }
  });

  // Legacy agent action endpoint - redirects to main action handler
  app.post("/api/agent/action", isAuthenticated, async (req: any, res) => {
    try {
      const { action } = req.body;

      if (!action || !action.type) {
        return res
          .status(400)
          .json({ message: "Action with type is required" });
      }

      const userId = req.user.dbUserId || req.user.claims.sub;

      if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
        return res.status(500).json({
          message:
            "OpenAI API key is missing. Please add your API key to enable AI functionality.",
        });
      }

      // Redirect to main action execution logic
      let result;
      switch (action.type) {
        case "task_created":
        case "task_updated":
          if (action.data?.taskId) {
            const task = await storage.getTask(action.data.taskId);
            result = { message: `Task action completed`, data: task };
          } else {
            result = { message: "Task action completed" };
          }
          break;
        case "project_created":
          if (action.data?.projectId) {
            const project = await storage.getProject(action.data.projectId);
            result = { message: `Project action completed`, data: project };
          } else {
            result = { message: "Project action completed" };
          }
          break;
        default:
          result = { message: `Action ${action.type} executed successfully` };
      }

      res.json({ success: true, result });
    } catch (error) {
      console.error("AI Action Execution Error:", error);
      res.status(500).json({
        message: "Failed to execute AI action",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // AI task breakdown generation
  app.post("/api/ai/breakdown-task", async (req, res) => {
    try {
      const { taskTitle, taskDescription, priority } = req.body;

      const userId = (req as any).user?.dbUserId || (req as any).user?.claims?.sub || "anonymous";
      // Own-key (Claude) users don't need the platform OpenAI key; only require
      // it when the user is on the platform default.
      if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey(userId))) {
        return res.status(500).json({ error: "AI provider not configured" });
      }

      const openaiClient = (getAiClient() as any);
      const budgetModel = await getModelForBudget(userId, "gpt-4o");

      const response = await openaiClient.chat.completions.create({
        model: budgetModel,
        messages: [
          {
            role: "system",
            content: `You are a project management assistant. Break down tasks into smaller, actionable subtasks. 
            Each subtask should be specific, measurable, and completable within a few hours to a day.
            Return a JSON array of subtasks with title, description, and priority fields.`,
          },
          {
            role: "user",
            content: `Break down this task into 3-5 smaller subtasks:
            
            Title: ${taskTitle}
            Description: ${taskDescription || "No description provided"}
            Priority: ${priority}
            
            Focus on making each subtask actionable and specific.`,
          },
        ],
        functions: [
          {
            name: "create_subtasks",
            description: "Create a list of subtasks for the given task",
            parameters: {
              type: "object",
              properties: {
                subtasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Subtask title" },
                      description: {
                        type: "string",
                        description: "Detailed description",
                      },
                      priority: {
                        type: "string",
                        enum: ["low", "medium", "high"],
                      },
                      estimatedHours: {
                        type: "number",
                        description: "Estimated hours to complete",
                      },
                    },
                    required: ["title", "description", "priority"],
                  },
                },
              },
              required: ["subtasks"],
            },
          },
        ],
        function_call: { name: "create_subtasks" },
      });

      if (response.usage) {
        const { trackTokenUsage } = await import("./services/token-tracker");
        trackTokenUsage(userId, "task-breakdown", budgetModel, response.usage).catch(() => {});
      }

      const functionCall = response.choices[0].message.function_call;
      if (!functionCall) {
        throw new Error("No function call in AI response");
      }

      const subtasksData = JSON.parse(functionCall.arguments);
      res.json(subtasksData);
    } catch (error) {
      console.error("AI breakdown error:", error);
      res.status(500).json({
        error: "Failed to generate subtasks",
      });
    }
  });

  // Import from integrations
  app.post("/api/import/smartsheet", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      const smartsheetData = await getSmartsheetData();

      // Process and import the data
      const projects = [];
      const tasks = [];

      // In a real implementation, this would process the actual Smartsheet data
      // For this demo, we'll return a placeholder response
      res.json({
        message: "Data imported from Smartsheet",
        projects,
        tasks,
      });
    } catch (error) {
      console.error("Error importing from Smartsheet:", error);
      res
        .status(500)
        .json({ message: "Failed to import data from Smartsheet" });
    }
  });

  // AI Project Assistant endpoint
  app.post(
    "/api/ai/project-assistant",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { projectId, projectName, message, conversationHistory } =
          req.body;

        if ((!message && !conversationHistory) || !projectId) {
          return res.status(400).json({
            message:
              "Message or conversation history and project ID are required",
          });
        }

        // Check if we have an OpenAI API key
        if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
          return res.status(500).json({
            message: "OpenAI API key is missing. Please add your API key.",
          });
        }

        const { handleProjectAssistantMessage } = await import(
          "./project-ai-assistant"
        );
        const result = await handleProjectAssistantMessage(
          { projectId, projectName, message, conversationHistory },
          storage,
        );

        res.json(result);
      } catch (error) {
        console.error("Error in project AI assistant:", error);
        res.status(500).json({
          message: "Failed to process message",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // AI Project Planner endpoint
  app.post("/api/ai/plan-project", isAuthenticated, async (req: any, res) => {
    try {
      const { prompt, attachments } = req.body;

      if (!prompt) {
        return res.status(400).json({ message: "Project prompt is required" });
      }

      // Check if we have an OpenAI API key
      if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
        return res.status(500).json({
          message: "OpenAI API key is missing. Please add your API key.",
        });
      }

      const { generateProjectPlan } = await import("./project-planner-agent");

      // Enhance prompt with attachment context if available
      let enhancedPrompt = prompt;
      if (attachments && attachments.length > 0) {
        enhancedPrompt = `${prompt}\n\nContext from uploaded files: ${attachments.map((a) => a.name).join(", ")}`;
      }

      const projectPlan = await generateProjectPlan(enhancedPrompt);

      res.json(projectPlan);
    } catch (error) {
      console.error("Error generating project plan:", error);
      res.status(500).json({
        message: "Failed to generate project plan",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // AI endpoints
  app.post("/api/ai/generate-plan", isAuthenticated, async (req: any, res) => {
    try {
      const { idea } = req.body;

      if (!idea) {
        return res.status(400).json({ message: "Project idea is required" });
      }

      // Check if we have an OpenAI API key
      if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
        return res.status(500).json({
          message: "OpenAI API key is missing. Please add your API key.",
        });
      }

      const projectPlan = await generateProjectPlan(idea);

      // Store the user prompt for training data
      const userId = req.user.dbUserId || req.user.claims?.sub;
      try {
        await storage.createAiPrompt({
          userId: userId,
          prompt: idea,
          promptType: "project_generation",
          response: projectPlan,
          usedResponse: false, // Will be updated when user actually creates the project
        });
        console.log("✅ Stored AI prompt for training data");
      } catch (promptError) {
        console.error("Failed to store AI prompt:", promptError);
        // Don't fail the request if prompt storage fails
      }

      // Log the plan to see its structure
      console.log(
        "Generated project plan:",
        JSON.stringify(projectPlan, null, 2),
      );

      // For the new flow, we just return the generated plan without saving it yet
      res.json(projectPlan);
    } catch (error) {
      console.error("Error generating project plan:", error);
      res.status(500).json({
        message:
          "Failed to generate project plan: " +
          (error.message || "Unknown error"),
      });
    }
  });

  // Enhanced route to create project from AI agent plan
  app.post(
    "/api/projects/from-plan",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { plan } = req.body;
        const userId = req.user.dbUserId || req.user.claims?.sub;

        if (!plan) {
          return res.status(400).json({ message: "Plan is required" });
        }

        // Check project creation limits before creating from plan
        console.log("Checking project creation limits for user:", userId);
        const limitCheck = await storage.canUserCreateProject(userId);
        console.log("Project limit check result for from-plan:", limitCheck);

        if (!limitCheck.allowed) {
          console.log("Project creation from plan blocked:", limitCheck.reason);
          return res.status(403).json({
            message: "Project creation limit reached",
            reason: limitCheck.reason,
            current: limitCheck.current,
            max: limitCheck.max,
            suggestion: "Please upgrade your plan to create more projects.",
          });
        }

        // Create the project from the plan
        const newProject = await storage.createProject({
          name: plan.name,
          description: plan.description || "",
          dueDate: plan.timeline ? new Date(plan.timeline.endDate) : null,
          progress: 0,
          totalTasks: plan.tasks ? plan.tasks.length : 0,
          completedTasks: 0,
          status: "active",
          ownerId: userId,
          icon: "sparkles",
          iconBg: "purple",
          aiGenerated: true,
        });

        // Create milestones first, then their child tasks linked via parentTaskId
        if (plan.milestones && Array.isArray(plan.milestones)) {
          console.log("Creating milestones for project:", plan.milestones.length);
          for (const milestone of plan.milestones) {
            if (!milestone.name) continue;

            const milestoneTask = await storage.createTask({
              name: milestone.name,
              description: milestone.description || "",
              status: "todo",
              priority: "high",
              dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
              projectId: newProject.id,
            });

            if (milestone.tasks && Array.isArray(milestone.tasks)) {
              for (const taskData of milestone.tasks) {
                const taskName = taskData.name || taskData.taskName;
                if (!taskName) continue;
                await storage.createTask({
                  name: taskName,
                  description: taskData.description || "",
                  status: "todo",
                  priority: taskData.priority || "medium",
                  dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
                  projectId: newProject.id,
                  parentTaskId: milestoneTask.id,
                  isSubtask: true,
                  assigneeId: taskData.assigneeId || null,
                  storyPoints: taskData.storyPoints || null,
                });
              }
            }
          }
        }

        // Create any standalone tasks not under milestones
        const milestoneTaskNames = new Set<string>();
        if (plan.milestones && Array.isArray(plan.milestones)) {
          for (const m of plan.milestones) {
            if (m.tasks && Array.isArray(m.tasks)) {
              for (const t of m.tasks) {
                milestoneTaskNames.add((t.name || t.taskName || "").toLowerCase().trim());
              }
            }
          }
        }

        if (plan.tasks && Array.isArray(plan.tasks)) {
          for (const taskData of plan.tasks) {
            const taskName = taskData.name || taskData.taskName;
            if (!taskName) continue;
            if (milestoneTaskNames.has(taskName.toLowerCase().trim())) continue;

            await storage.createTask({
              name: taskName,
              description: taskData.description || "",
              status: "todo",
              priority: taskData.priority || "medium",
              dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
              projectId: newProject.id,
              assigneeId: taskData.assigneeId || null,
              storyPoints: taskData.storyPoints || null,
            });
          }
        }

        // Automatically add the creator as a project member with OWNER role
        try {
          await storage.addProjectMember({
            projectId: newProject.id,
            userId: userId,
            role: ProjectRole.OWNER,
          });
          console.log("Added creator as project owner member");
        } catch (memberError) {
          console.error("Error adding creator as project member:", memberError);
          // Don't fail the whole request if member addition fails
        }

        // Update AI prompt to mark that the user actually used the generated response
        if (userId && plan.originalPrompt) {
          try {
            // Find the most recent AI prompt for this user with project_generation type
            const userPrompts = await storage.getAiPromptsByUser(userId);
            const recentPrompt = userPrompts
              .filter(
                (p) => p.promptType === "project_generation" && !p.usedResponse,
              )
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              )[0];

            if (recentPrompt) {
              await storage.updateAiPromptFeedback(
                recentPrompt.id,
                "User created project from AI plan",
                5,
                true,
              );
              console.log("✅ Updated AI prompt to mark as used");
            }
          } catch (promptUpdateError) {
            console.error(
              "Failed to update AI prompt usage:",
              promptUpdateError,
            );
          }
        }

        return res.status(201).json({
          success: true,
          project: newProject,
          message: "Project created successfully",
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors });
        }
        console.error("Error creating project from plan:", error);
        return res
          .status(500)
          .json({ message: "Failed to create project from plan" });
      }
    },
  );

  app.post(
    "/api/ai/detect-bottlenecks",
    isAuthenticated,
    async (req: any, res) => {
      try {
        // Check if we have an OpenAI API key
        if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
          return res.status(500).json({
            message: "OpenAI API key is missing. Please add your API key.",
          });
        }

        const userId = req.user.dbUserId || req.user.claims.sub;

        // Get only projects user has access to
        const projects = await storage.getProjectsForUser(userId);
        const projectIds = projects.map((p) => p.id);

        // Get tasks for these projects
        const allTasks = await storage.getAllTasks();
        const tasks = allTasks.filter(
          (task) => task.projectId && projectIds.includes(task.projectId),
        );

        const bottlenecks = await analyzeProjectForBottlenecks(projects, tasks);

        // Store insights from bottleneck analysis
        for (const bottleneck of bottlenecks) {
          await storage.createInsight({
            type: "bottleneck",
            title: bottleneck.title,
            description: bottleneck.description,
            severity: bottleneck.severity,
            projectId: bottleneck.projectId,
            suggestedAction: bottleneck.suggestedAction,
            isResolved: false,
          });
        }

        res.json({ bottlenecks });
      } catch (error) {
        console.error("Error detecting bottlenecks:", error);
        res.status(500).json({
          message:
            "Failed to detect bottlenecks: " +
            (error.message || "Unknown error"),
        });
      }
    },
  );

  app.post("/api/ai/action-plan", isAuthenticated, async (req: any, res) => {
    try {
      // Check if we have an OpenAI API key
      if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
        return res.status(500).json({
          message: "OpenAI API key is missing. Please add your API key.",
        });
      }

      const userId = req.user.dbUserId || req.user.claims.sub;

      // Get only projects user has access to
      const projects = await storage.getProjectsForUser(userId);
      const projectIds = projects.map((p) => p.id);

      // Get tasks and insights for these projects
      const allTasks = await storage.getAllTasks();
      const tasks = allTasks.filter(
        (task) => task.projectId && projectIds.includes(task.projectId),
      );

      const allInsights = await storage.getAllInsights();
      const insights = allInsights.filter(
        (insight) =>
          insight.projectId && projectIds.includes(insight.projectId),
      );

      const actionPlan = await generateActionPlan(projects, tasks, insights);
      res.json(actionPlan);
    } catch (error) {
      console.error("Error generating action plan:", error);
      res.status(500).json({
        message:
          "Failed to generate action plan: " +
          (error.message || "Unknown error"),
      });
    }
  });

  // Frontend-compatible deep project analysis endpoint (GET)
  app.get(
    "/api/projects/:id/deep-analysis",
    isAuthenticated,
    async (req: any, res) => {
      try {
        // Check if we have an OpenAI API key
        if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
          return res.status(500).json({
            message: "OpenAI API key is missing. Please add your API key.",
          });
        }

        const projectId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;
        const project = await storage.getProject(projectId);

        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        // Check if user has access to this project
        const isAuthorized = await storage.isUserAuthorized(projectId, userId);
        if (!isAuthorized) {
          return res.status(403).json({
            message: "You don't have permission to analyze this project",
          });
        }

        const tasks = await storage.getTasksByProjectId(projectId);
        const analysis = await deepProjectAnalysis(project, tasks);

        // Optionally store insights from analysis
        if (analysis.dimensions) {
          for (const dimension of analysis.dimensions) {
            if (dimension.score < 6) {
              // Only store insights for low-scoring dimensions
              await storage.createInsight({
                type: "deep-analysis",
                title: `${dimension.name} needs improvement`,
                description: dimension.assessment,
                severity: dimension.score < 4 ? "critical" : "warning",
                projectId: project.id,
                suggestedAction: dimension.recommendations.join("; "),
                isResolved: false,
              });
            }
          }

          // Store missing elements as insights
          if (analysis.criticalMissingElements) {
            for (const element of analysis.criticalMissingElements) {
              await storage.createInsight({
                type: "missing-element",
                title: `Missing: ${element}`,
                description: `Your project is missing a critical element: ${element}`,
                severity: "warning",
                projectId: project.id,
                suggestedAction: `Add "${element}" to your project plan`,
                isResolved: false,
              });
            }
          }
        }

        res.json(analysis);
      } catch (error) {
        console.error("Error performing deep project analysis:", error);
        res
          .status(500)
          .json({ message: "Failed to perform deep project analysis" });
      }
    },
  );

  // Deep project analysis endpoint
  app.post(
    "/api/ai/deep-project-analysis/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        // Check if we have an OpenAI API key
        if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
          return res.status(500).json({
            message: "OpenAI API key is missing. Please add your API key.",
          });
        }

        const projectId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;
        const project = await storage.getProject(projectId);

        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        // Check if user has access to this project
        const isAuthorized = await storage.isUserAuthorized(projectId, userId);
        if (!isAuthorized) {
          return res.status(403).json({
            message: "You don't have permission to analyze this project",
          });
        }

        const tasks = await storage.getTasksByProjectId(projectId);
        const analysis = await deepProjectAnalysis(project, tasks);

        // Optionally store insights from analysis
        if (analysis.dimensions) {
          for (const dimension of analysis.dimensions) {
            if (dimension.score < 6) {
              // Only store insights for low-scoring dimensions
              await storage.createInsight({
                type: "deep-analysis",
                title: `${dimension.name} needs improvement`,
                description: dimension.assessment,
                severity: dimension.score < 4 ? "critical" : "warning",
                projectId: project.id,
                suggestedAction: dimension.recommendations.join("; "),
                isResolved: false,
              });
            }
          }

          // Store missing elements as insights
          if (analysis.criticalMissingElements) {
            for (const element of analysis.criticalMissingElements) {
              await storage.createInsight({
                type: "missing-element",
                title: `Missing: ${element}`,
                description: `Your project is missing a critical element: ${element}`,
                severity: "warning",
                projectId: project.id,
                suggestedAction: `Add "${element}" to your project plan`,
                isResolved: false,
              });
            }
          }
        }

        res.json(analysis);
      } catch (error) {
        console.error("Error performing deep project analysis:", error);
        res
          .status(500)
          .json({ message: "Failed to perform deep project analysis" });
      }
    },
  );

  // Task synchronization endpoints
  app.post(
    "/api/tasks/:id/sync/:provider",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const taskId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;
        const { provider } = req.params;

        const task = await storage.getTask(taskId);
        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }

        // Check if user has access to the project the task belongs to
        if (task.projectId) {
          const isAuthorized = await storage.isUserAuthorized(
            task.projectId,
            userId,
            ProjectRole.EDITOR,
          );

          if (!isAuthorized) {
            return res.status(403).json({
              success: false,
              message:
                "You don't have permission to sync tasks in this project",
            });
          }
        }

        const result = await taskSyncService.pushTaskToProvider(
          taskId,
          provider as any,
        );

        res.json(result);
      } catch (error) {
        console.error("Error pushing task to provider:", error);
        res.status(500).json({
          success: false,
          message: "Failed to sync task with external provider",
        });
      }
    },
  );

  app.post(
    "/api/tasks/:id/sync-status",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const taskId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;
        const { status } = req.body;

        if (!status) {
          return res.status(400).json({
            success: false,
            message: "Status is required",
          });
        }

        const task = await storage.getTask(taskId);
        if (!task) {
          return res.status(404).json({
            success: false,
            message: "Task not found",
          });
        }

        // Check if user has access to the project the task belongs to
        if (task.projectId) {
          const isAuthorized = await storage.isUserAuthorized(
            task.projectId,
            userId,
            ProjectRole.EDITOR,
          );

          if (!isAuthorized) {
            return res.status(403).json({
              success: false,
              message:
                "You don't have permission to update task status in this project",
            });
          }
        }

        const result = await taskSyncService.syncTaskStatus(taskId, status);

        // Always update the status in our db, even if external sync fails
        if (!result.success) {
          await storage.updateTask(taskId, { status });
        }

        res.json(result);
      } catch (error) {
        console.error("Error syncing task status:", error);
        res.status(500).json({
          success: false,
          message: "Failed to sync task status",
        });
      }
    },
  );

  app.post(
    "/api/integrations/:provider/pull-tasks",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { provider } = req.params;
        const { projectId } = req.body;
        const userId = req.user.dbUserId || req.user.claims.sub;

        // If a specific project is specified, check user's permissions
        if (projectId) {
          const parsedProjectId = parseInt(projectId);
          const isAuthorized = await storage.isUserAuthorized(
            parsedProjectId,
            userId,
            ProjectRole.EDITOR,
          );

          if (!isAuthorized) {
            return res.status(403).json({
              success: false,
              message:
                "You don't have permission to sync tasks to this project",
            });
          }

          const result = await taskSyncService.pullTasksFromProvider(
            provider as any,
            parsedProjectId,
          );

          return res.json(result);
        }

        // If no project specified, just pull all tasks from provider
        const result = await taskSyncService.pullTasksFromProvider(
          provider as any,
        );

        res.json(result);
      } catch (error) {
        console.error(
          `Error pulling tasks from ${req.params.provider}:`,
          error,
        );
        res.status(500).json({
          success: false,
          message: `Failed to pull tasks from ${req.params.provider}`,
        });
      }
    },
  );

  // AI Tool Recommendation Routes
  app.get("/api/tasks/:id/tools", isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;

      // Get the task to check user permissions and get task content
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check if user has access to the task's project
      if (task.projectId) {
        const isAuthorized = await storage.isUserAuthorized(
          task.projectId,
          userId,
        );
        if (!isAuthorized) {
          return res.status(403).json({
            message:
              "You don't have permission to access this task's recommendations",
          });
        }
      }

      // Set no-cache headers to prevent 304 responses
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Date", new Date().toUTCString());

      // Import the analysis functions
      const { analyzeTaskContent } = await import("./lib/task-analysis");

      // Analyze task content to get dynamic recommendations
      const recommendations = await analyzeTaskContent({
        name: task.name,
        description: task.description || "",
      });

      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching tool recommendations:", error);
      res.status(500).json({ message: "Failed to fetch tool recommendations" });
    }
  });

  // Save project plan endpoint
  // Development chat endpoint - redirects to main AI chat
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, conversationHistory = [] } = req.body;
      console.log("Chat request:", {
        message,
        historyLength: conversationHistory.length,
      });

      const userId = "dev-user-123";

      const { SimpleAIAgent } = await import("./simple-ai-agent");
      const agent = new SimpleAIAgent(userId);

      const projects = await storage.getAllProjects();
      const allTasks = await storage.getAllTasks();

      const context = {
        projects: projects.slice(0, 10),
        tasks: allTasks.slice(0, 20),
        userId: userId,
        user: null,
      };

      const response = await agent.processMessage(message, context as any);

      console.log("Chat response:", {
        role: response.role,
        hasProjectPlan: !!response.projectPlan,
      });
      return res.json(response);
    } catch (error) {
      console.error("Chat error:", error);
      return res.status(500).json({
        error: "Failed to process chat message",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post(
    "/api/projects/save-plan",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        // Get authenticated user ID
        const userId = req.user.dbUserId || req.user.claims?.sub;
        const { name, description, timeline, milestones, tasks } = req.body;

        if (!name || !description) {
          return res
            .status(400)
            .json({ error: "Project name and description are required" });
        }

        // Check project creation limits before saving plan
        console.log("Checking project creation limits for save-plan:", userId);
        const limitCheck = await storage.canUserCreateProject(userId);
        console.log("Project limit check result for save-plan:", limitCheck);

        if (!limitCheck.allowed) {
          console.log(
            "Project creation from save-plan blocked:",
            limitCheck.reason,
          );
          return res.status(403).json({
            message: "Project creation limit reached",
            reason: limitCheck.reason,
            current: limitCheck.current,
            max: limitCheck.max,
            suggestion: "Please upgrade your plan to create more projects.",
          });
        }

        // Create the project
        const project = await storage.createProject({
          name,
          description,
          status: "active",
          progress: 0,
          ownerId: userId,
          dueDate: null, // Will be set based on tasks
          aiGenerated: true,
        });

        // Create milestones as tasks with milestone flag
        const createdMilestones = [];
        if (milestones && milestones.length > 0) {
          for (const milestone of milestones) {
            const milestoneTask = await storage.createTask({
              name: milestone.name,
              description: milestone.description,
              status: "todo",
              priority: milestone.priority,
              dueDate: new Date(milestone.dueDate),
              projectId: project.id,
              assigneeId: userId,
            });
            createdMilestones.push(milestoneTask);
          }
        }

        // Create tasks
        const createdTasks = [];
        if (tasks && tasks.length > 0) {
          for (const task of tasks) {
            const newTask = await storage.createTask({
              name: task.name,
              description: task.description,
              status: "todo",
              priority: task.priority,
              dueDate: new Date(task.dueDate),
              projectId: project.id,
              assigneeId: userId,
            });
            createdTasks.push(newTask);
          }
        }

        // Update project due date to latest task due date
        const allDueDates = [...createdMilestones, ...createdTasks]
          .map((t) => t.dueDate)
          .filter((d) => d);

        if (allDueDates.length > 0) {
          const latestDate = new Date(
            Math.max(
              ...allDueDates.map((d) => (d ? new Date(d).getTime() : 0)),
            ),
          );
          await storage.updateProject(project.id, { dueDate: latestDate });
        }

        return res.json({
          success: true,
          projectId: project.id,
          name: project.name,
          milestonesCount: createdMilestones.length,
          tasksCount: createdTasks.length,
        });
      } catch (error) {
        console.error("Save Project Plan Error:", error);
        return res.status(500).json({
          error: "Failed to save project plan",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  app.post("/api/tasks/:id/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;

      // Get the task to check user permissions
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check if user has permission (needs to be at least editor)
      if (task.projectId) {
        const isAuthorized = await storage.isUserAuthorized(
          task.projectId,
          userId,
          ProjectRole.EDITOR,
        );
        if (!isAuthorized) {
          return res.status(403).json({
            message: "You don't have permission to analyze this task",
          });
        }
      }

      // Analyze the task
      const analysis = await analyzeTask(taskId);
      return res.json(analysis);
    } catch (error) {
      console.error("Error analyzing task:", error);
      return res.status(500).json({
        message:
          typeof error === "object" && error !== null
            ? error.message || "Failed to analyze task"
            : "Failed to analyze task",
      });
    }
  });

  app.patch(
    "/api/tasks/:taskId/tools/:toolId/status",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const taskId = parseInt(req.params.taskId);
        const toolId = parseInt(req.params.toolId);
        const userId = req.user.dbUserId || req.user.claims.sub;
        const { status } = req.body;

        if (!status || !Object.values(ToolStatus).includes(status)) {
          return res.status(400).json({
            message: `Invalid status. Valid statuses are: ${Object.values(ToolStatus).join(", ")}`,
          });
        }

        // Get the task to check user permissions
        const task = await storage.getTask(taskId);
        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }

        // Check if user has editor permission
        if (task.projectId) {
          const isAuthorized = await storage.isUserAuthorized(
            task.projectId,
            userId,
            ProjectRole.EDITOR,
          );
          if (!isAuthorized) {
            return res.status(403).json({
              message:
                "You don't have permission to update this tool recommendation",
            });
          }
        }

        // Update the tool recommendation status
        const result = await updateToolRecommendationStatus(
          taskId,
          toolId,
          status as ToolStatus,
        );
        return res.json(result);
      } catch (error) {
        console.error("Error updating tool recommendation status:", error);
        // Send more specific error message to help debugging
        if (error instanceof Error) {
          return res.status(500).json({
            message: `Failed to save tool recommendations: ${error.message}`,
          });
        }
        return res
          .status(500)
          .json({ message: "Failed to update tool recommendation status" });
      }
    },
  );

  // Cleaned up - removed duplicate and legacy agent endpoints

  // AI Workflow Builder
  app.post("/api/workflows/generate", async (req, res) => {
    try {
      const { query } = req.body;

      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }

      if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
        return res.status(500).json({
          message:
            "OpenAI API key is missing. Please add your API key to enable AI functionality.",
          error: "MISSING_API_KEY",
        });
      }

      console.log(`Generating workflow for query: "${query}"`);

      // Get all AI tools from database
      const aiTools = await storage.getAllAiTools();

      // Import the workflow generator
      const { generateWorkflow } = await import(
        "./services/workflow-generator"
      );

      // Generate workflow using OpenAI
      const workflow = await generateWorkflow(query, aiTools);

      res.json(workflow);
    } catch (error) {
      console.error("Workflow generation error:", error);
      res.status(500).json({
        message: "Failed to generate workflow",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Budget & Quote Agent API Routes
  app.post("/api/budgets/estimate", isAuthenticated, async (req: any, res) => {
    try {
      const { BudgetAgent } = await import("./services/budget-agent");
      const budgetAgent = new BudgetAgent();

      const { projectId, clientInfo, customRates } = req.body;
      const userId = req.user.dbUserId || req.user.claims.sub;

      if (!projectId) {
        return res.status(400).json({ message: "Project ID is required" });
      }

      // Check if user has access to the project
      const isAuthorized = await storage.isUserAuthorized(
        projectId,
        userId,
        ProjectRole.VIEWER,
      );
      if (!isAuthorized) {
        return res
          .status(403)
          .json({ message: "Access denied to this project" });
      }

      const estimation = await budgetAgent.estimateProjectBudget({
        projectId,
        clientInfo,
        customRates,
      });

      res.json(estimation);
    } catch (error) {
      console.error("Budget estimation error:", error);
      res.status(500).json({ message: "Failed to generate budget estimate" });
    }
  });

  app.post("/api/budgets/save", isAuthenticated, async (req: any, res) => {
    try {
      const { BudgetAgent } = await import("./services/budget-agent");
      const budgetAgent = new BudgetAgent();

      const { estimation, projectId, clientInfo, additionalInfo } = req.body;
      const userId = req.user.dbUserId || req.user.claims.sub;

      if (!projectId || !estimation) {
        return res
          .status(400)
          .json({ message: "Project ID and estimation data are required" });
      }

      // Check if user has access to the project
      const isAuthorized = await storage.isUserAuthorized(
        projectId,
        userId,
        ProjectRole.EDITOR,
      );
      if (!isAuthorized) {
        return res
          .status(403)
          .json({ message: "Access denied to this project" });
      }

      const budgetId = await budgetAgent.saveBudgetEstimate(
        estimation,
        projectId,
        userId,
        clientInfo,
        additionalInfo,
      );

      res.json({ budgetId });
    } catch (error) {
      console.error("Budget save error:", error);
      res.status(500).json({ message: "Failed to save budget estimate" });
    }
  });

  app.get("/api/budgets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const budgetId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;

      const budget = await storage.getBudgetEstimate(budgetId);
      if (!budget) {
        return res.status(404).json({ message: "Budget estimate not found" });
      }

      // Check if user has access to the project
      const isAuthorized = await storage.isUserAuthorized(
        budget.projectId,
        userId,
        ProjectRole.VIEWER,
      );
      if (!isAuthorized) {
        return res
          .status(403)
          .json({ message: "Access denied to this budget" });
      }

      const lineItems = await storage.getBudgetLineItems(budgetId);
      res.json({ budget, lineItems });
    } catch (error) {
      console.error("Budget fetch error:", error);
      res.status(500).json({ message: "Failed to fetch budget estimate" });
    }
  });

  app.get(
    "/api/projects/:id/budgets",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Check if user has access to the project
        const isAuthorized = await storage.isUserAuthorized(
          projectId,
          userId,
          ProjectRole.VIEWER,
        );
        if (!isAuthorized) {
          return res
            .status(403)
            .json({ message: "Access denied to this project" });
        }

        const budgets = await storage.getBudgetEstimatesByProject(projectId);
        res.json(budgets);
      } catch (error) {
        console.error("Project budgets fetch error:", error);
        res.status(500).json({ message: "Failed to fetch project budgets" });
      }
    },
  );

  app.get("/api/budgets/:id/quote", isAuthenticated, async (req: any, res) => {
    try {
      const { QuoteGenerator } = await import("./services/quote-generator");
      const quoteGenerator = new QuoteGenerator();

      const budgetId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;

      const budget = await storage.getBudgetEstimate(budgetId);
      if (!budget) {
        return res.status(404).json({ message: "Budget estimate not found" });
      }

      // Check if user has access to the project
      const isAuthorized = await storage.isUserAuthorized(
        budget.projectId,
        userId,
        ProjectRole.VIEWER,
      );
      if (!isAuthorized) {
        return res
          .status(403)
          .json({ message: "Access denied to this budget" });
      }

      const htmlQuote = await quoteGenerator.generateQuoteHTML(budgetId);
      res.setHeader("Content-Type", "text/html");
      res.send(htmlQuote);
    } catch (error) {
      console.error("Quote generation error:", error);
      res.status(500).json({ message: "Failed to generate quote" });
    }
  });

  app.post("/api/budgets/:id/email", isAuthenticated, async (req: any, res) => {
    try {
      const { QuoteGenerator } = await import("./services/quote-generator");
      const quoteGenerator = new QuoteGenerator();

      const budgetId = parseInt(req.params.id);
      const { recipientEmail, senderEmail } = req.body;
      const userId = req.user.dbUserId || req.user.claims.sub;

      if (!recipientEmail || !senderEmail) {
        return res
          .status(400)
          .json({ message: "Recipient and sender emails are required" });
      }

      const budget = await storage.getBudgetEstimate(budgetId);
      if (!budget) {
        return res.status(404).json({ message: "Budget estimate not found" });
      }

      // Check if user has access to the project
      const isAuthorized = await storage.isUserAuthorized(
        budget.projectId,
        userId,
        ProjectRole.EDITOR,
      );
      if (!isAuthorized) {
        return res
          .status(403)
          .json({ message: "Access denied to this budget" });
      }

      const success = await quoteGenerator.emailQuote(
        budgetId,
        recipientEmail,
        senderEmail,
      );

      if (success) {
        // Update budget status to 'sent'
        await storage.updateBudgetEstimate(budgetId, { status: "sent" });
        res.json({ success: true, message: "Quote sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send quote email" });
      }
    } catch (error) {
      console.error("Quote email error:", error);
      res
        .status(500)
        .json({ message: error.message || "Failed to send quote email" });
    }
  });

  app.get("/api/rate-templates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      const templates = await storage.getRateTemplates(userId);
      res.json(templates);
    } catch (error) {
      console.error("Rate templates fetch error:", error);
      res.status(500).json({ message: "Failed to fetch rate templates" });
    }
  });

  // Advanced Budget Agent endpoints
  app.post(
    "/api/budget-agent/generate-advanced",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        const { projectType, scopeAnswers, customRates, clientInfo } = req.body;

        const { AdvancedBudgetAgent } = await import(
          "./services/advanced-budget-agent"
        );
        const agent = new AdvancedBudgetAgent();

        const estimation = await agent.generateAdvancedEstimation(
          projectType,
          scopeAnswers,
          customRates,
          clientInfo,
        );

        res.json(estimation);
      } catch (error) {
        console.error("Advanced budget generation error:", error);
        res
          .status(500)
          .json({ message: "Failed to generate advanced budget estimation" });
      }
    },
  );

  app.post(
    "/api/budget-agent/save-quote",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        const { projectId, estimation, clientInfo, projectType } = req.body;
        const userId = req.user.dbUserId || req.user.claims.sub;

        if (!estimation || !clientInfo || !projectType) {
          return res.status(400).json({
            message:
              "Missing required fields: estimation, clientInfo, or projectType",
          });
        }

        // Create budget estimate
        const budgetData = {
          projectId: projectId || null,
          name: `${projectType.replace("_", " ")} Quote - ${clientInfo.company || clientInfo.name}`,
          description: `AI-generated quote for ${projectType.replace("_", " ")} project`,
          status: "draft",
          totalAmount: estimation.totalCost || 0,
          currency: "USD",
          clientName: clientInfo.name || "",
          clientEmail: clientInfo.email || "",
          clientCompany: clientInfo.company || "",
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          notes: `Timeline: ${estimation.timeline || "N/A"}\n\nAssumptions:\n${(estimation.assumptions || []).join("\n")}\n\nRecommendations:\n${(estimation.recommendations || []).join("\n")}`,
          createdBy: userId,
        };

        const savedBudget = await storage.createBudgetEstimate(budgetData);

        // Create line items
        for (const item of estimation.lineItems) {
          await storage.createBudgetLineItem({
            budgetId: savedBudget.id,
            taskId: null,
            category: item.category,
            description: item.description,
            quantity: 1,
            rate: item.rate,
            hours: item.hours,
            totalAmount: item.total,
            role: item.role,
            position: 0,
          });
        }

        return res.json({
          success: true,
          quoteId: savedBudget.id,
          message: "Quote saved successfully",
        });
      } catch (error) {
        console.error("Save quote error:", error);
        return res.status(500).json({ message: "Failed to save quote" });
      }
    },
  );

  // Onboarding Agent API routes
  app.post("/api/onboarding/generate-plan", async (req: any, res) => {
    try {
      let userId = req.user?.dbUserId || req.user?.claims?.sub;

      // For unauthenticated users, create or get anonymous user
      if (!userId) {
        console.log(
          "No authenticated user, creating/getting anonymous user...",
        );
        let anonymousUser = await storage.getUserByUsername("anonymous");
        if (!anonymousUser) {
          console.log("Anonymous user not found, creating new one...");
          anonymousUser = await storage.createUser({
            id: "anonymous-user",
            username: "anonymous",
            email: "anonymous@example.com",
            firstName: "Anonymous",
            lastName: "User",
          });
          console.log("Created anonymous user:", anonymousUser);
        } else {
          console.log("Found existing anonymous user:", anonymousUser);
        }
        userId = anonymousUser.id;
        console.log("Using userId:", userId);
      }

      const {
        type,
        role,
        department,
        duration,
        tools,
        documents,
        culture,
        customRequirements,
      } = req.body;

      console.log("Received onboarding plan request:", {
        type,
        role,
        department,
        duration,
        tools,
        documents,
        culture,
        customRequirements,
        userId,
      });

      if (!type || !role || !duration) {
        console.log("Missing required fields:", {
          type: !!type,
          role: !!role,
          duration: !!duration,
        });
        return res
          .status(400)
          .json({ message: "Type, role, and duration are required" });
      }

      if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
        return res
          .status(500)
          .json({ message: "OpenAI API key not configured" });
      }

      const { OnboardingAgent } = await import("./onboarding-agent");
      const agent = new OnboardingAgent();

      const plan = await agent.generateOnboardingPlan(
        {
          type,
          role,
          department,
          duration: parseInt(duration),
          tools,
          documents,
          culture,
          customRequirements,
        },
        userId,
      );

      console.log("Generated plan successfully:", plan);
      res.json(plan);
    } catch (error) {
      console.error("Error generating onboarding plan:", error);
      res.status(500).json({ message: "Failed to generate onboarding plan" });
    }
  });

  app.get("/api/onboarding/plans", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      const plans = await storage.getOnboardingPlans(userId);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching onboarding plans:", error);
      res.status(500).json({ message: "Failed to fetch onboarding plans" });
    }
  });

  app.get(
    "/api/onboarding/plans/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const planId = parseInt(req.params.id);
        const plan = await storage.getOnboardingPlan(planId);

        if (!plan) {
          return res.status(404).json({ message: "Onboarding plan not found" });
        }

        const steps = await storage.getOnboardingSteps(planId);
        res.json({ ...plan, steps });
      } catch (error) {
        console.error("Error fetching onboarding plan:", error);
        res.status(500).json({ message: "Failed to fetch onboarding plan" });
      }
    },
  );

  app.get(
    "/api/onboarding/plans/:id/steps",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const planId = parseInt(req.params.id);
        const steps = await storage.getOnboardingSteps(planId);
        res.json(steps);
      } catch (error) {
        console.error("Error fetching onboarding steps:", error);
        res.status(500).json({ message: "Failed to fetch onboarding steps" });
      }
    },
  );

  app.post(
    "/api/onboarding/plans/:id/steps",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const planId = parseInt(req.params.id);
        const stepData = req.body;

        const step = await storage.createOnboardingStep({
          ...stepData,
          planId,
        });

        res.status(201).json(step);
      } catch (error) {
        console.error("Error creating onboarding step:", error);
        res.status(500).json({ message: "Failed to create onboarding step" });
      }
    },
  );

  app.put(
    "/api/onboarding/steps/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const stepId = parseInt(req.params.id);
        const stepData = req.body;

        const step = await storage.updateOnboardingStep(stepId, stepData);
        res.json(step);
      } catch (error) {
        console.error("Error updating onboarding step:", error);
        res.status(500).json({ message: "Failed to update onboarding step" });
      }
    },
  );

  app.delete(
    "/api/onboarding/steps/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const stepId = parseInt(req.params.id);
        await storage.deleteOnboardingStep(stepId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting onboarding step:", error);
        res.status(500).json({ message: "Failed to delete onboarding step" });
      }
    },
  );

  app.post(
    "/api/onboarding/instances",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;
        const instanceData = req.body;

        const instance = await storage.createOnboardingInstance({
          ...instanceData,
          managerId: userId,
        });

        res.status(201).json(instance);
      } catch (error) {
        console.error("Error creating onboarding instance:", error);
        res
          .status(500)
          .json({ message: "Failed to create onboarding instance" });
      }
    },
  );

  app.get(
    "/api/onboarding/instances",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;
        const instances = await storage.getOnboardingInstances(userId);
        res.json(instances);
      } catch (error) {
        console.error("Error fetching onboarding instances:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch onboarding instances" });
      }
    },
  );

  app.get(
    "/api/onboarding/instances/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const instanceId = parseInt(req.params.id);
        const instance = await storage.getOnboardingInstance(instanceId);

        if (!instance) {
          return res
            .status(404)
            .json({ message: "Onboarding instance not found" });
        }

        const completions =
          await storage.getOnboardingStepCompletions(instanceId);
        res.json({ ...instance, completions });
      } catch (error) {
        console.error("Error fetching onboarding instance:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch onboarding instance" });
      }
    },
  );

  app.post(
    "/api/onboarding/generate-welcome-email",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { onboardeeName, role, startDate, managerName } = req.body;

        if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
          return res
            .status(500)
            .json({ message: "OpenAI API key not configured" });
        }

        const { OnboardingAgent } = await import("./onboarding-agent");
        const agent = new OnboardingAgent();

        const email = await agent.generateWelcomeEmail(
          onboardeeName,
          role,
          startDate,
          managerName,
        );
        res.json({ email });
      } catch (error) {
        console.error("Error generating welcome email:", error);
        res.status(500).json({ message: "Failed to generate welcome email" });
      }
    },
  );

  app.post(
    "/api/onboarding/generate-quiz",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { topic, difficulty = "medium" } = req.body;

        if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
          return res
            .status(500)
            .json({ message: "OpenAI API key not configured" });
        }

        const { OnboardingAgent } = await import("./onboarding-agent");
        const agent = new OnboardingAgent();

        const quiz = await agent.generateCompletionQuiz(topic, difficulty);
        res.json(quiz);
      } catch (error) {
        console.error("Error generating quiz:", error);
        res.status(500).json({ message: "Failed to generate quiz" });
      }
    },
  );

  app.get(
    "/api/onboarding/plans/:id/suggestions",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const planId = parseInt(req.params.id);

        if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
          return res
            .status(500)
            .json({ message: "OpenAI API key not configured" });
        }

        const { OnboardingAgent } = await import("./onboarding-agent");
        const agent = new OnboardingAgent();

        const suggestions = await agent.suggestImprovements(planId);
        const missing = await agent.flagMissingElements(planId);

        res.json({ suggestions, missing });
      } catch (error) {
        console.error("Error generating suggestions:", error);
        res.status(500).json({ message: "Failed to generate suggestions" });
      }
    },
  );

  app.get("/api/onboarding/templates", async (req: any, res) => {
    try {
      const { type } = req.query;
      const templates = await storage.getOnboardingTemplates(type);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching onboarding templates:", error);
      res.status(500).json({ message: "Failed to fetch onboarding templates" });
    }
  });

  // Smart Bandwidth API routes
  app.get(
    "/api/smart-bandwidth/team-members",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Get team members from the team_members table for this user
        const teamMembers = await storage.getTeamMembersByUser(userId);

        // Transform to match frontend interface and convert hourlyRate from cents to dollars
        const formattedMembers = teamMembers.map((member) => ({
          id: member.id.toString(),
          name: member.name,
          email: member.email || "",
          role: member.role,
          userId: member.userId || userId,
          skills: member.skills || [],
          capacity: member.capacity || 40,
          allocated: member.allocated || 0,
          availability: member.availability || 100,
          performance: member.performance || 90,
          hourlyRate: Math.floor((member.hourlyRate || 7500) / 100), // Convert cents to dollars
          timezone: member.timezone || "UTC",
          workingHours: member.workingHours || "9:00-17:00",
          isActive: member.isActive !== false,
          avatar: member.avatar || "👤",
          department: member.department || "",
          bio: member.bio || "",
          tasks: [], // Add empty tasks array for compatibility
        }));

        res.json(formattedMembers);
      } catch (error) {
        console.error("Error fetching team members:", error);
        res.status(500).json({ message: "Failed to fetch team members" });
      }
    },
  );

  app.post(
    "/api/smart-bandwidth/team-members",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Transform hourlyRate from dollars to cents if needed
        const processedBody = {
          ...req.body,
          userId,
        };

        // Convert hourlyRate to cents if it's less than 1000 (assuming it's in dollars)
        if (processedBody.hourlyRate && processedBody.hourlyRate < 1000) {
          processedBody.hourlyRate = processedBody.hourlyRate * 100;
        }

        console.log("Creating team member with data:", processedBody);
        const teamMemberData = insertTeamMemberSchema.parse(processedBody);
        const teamMember = await storage.createTeamMember(teamMemberData);
        res.status(201).json(teamMember);
      } catch (error) {
        console.error("Error creating team member:", error);
        if (error instanceof Error) {
          console.error("Error details:", error.message);
          console.error("Error stack:", error.stack);
        }
        res.status(500).json({ message: "Failed to create team member" });
      }
    },
  );

  app.get(
    "/api/smart-bandwidth/team-members/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        const teamMember = await storage.getTeamMember(id);
        if (!teamMember) {
          return res.status(404).json({ message: "Team member not found" });
        }
        res.json(teamMember);
      } catch (error) {
        console.error("Error fetching team member:", error);
        res.status(500).json({ message: "Failed to fetch team member" });
      }
    },
  );

  app.patch(
    "/api/smart-bandwidth/team-members/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        const updates = req.body;
        const teamMember = await storage.updateTeamMember(id, updates);
        res.json(teamMember);
      } catch (error) {
        console.error("Error updating team member:", error);
        res.status(500).json({ message: "Failed to update team member" });
      }
    },
  );

  app.delete(
    "/api/smart-bandwidth/team-members/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteTeamMember(id);
        res.json({ message: "Team member deleted successfully" });
      } catch (error) {
        console.error("Error deleting team member:", error);
        res.status(500).json({ message: "Failed to delete team member" });
      }
    },
  );

  app.get(
    "/api/smart-bandwidth/capacity-alerts",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Get user's projects
        const userProjects = await storage.getProjectsForUser(userId);
        const projectIds = userProjects.map((p) => p.id);

        // Get all capacity alerts
        const allAlerts = await storage.getAllCapacityAlerts();

        // Filter alerts to only include those related to user's team members
        const userTeamMemberIds = new Set<string>();

        // Get team members from user's projects
        for (const projectId of projectIds) {
          const projectMembers = await storage.getProjectMembers(projectId);
          projectMembers.forEach((member) => {
            if (member.userId) {
              userTeamMemberIds.add(member.userId);
            }
          });
        }

        // Filter alerts to only those for team members in user's projects
        const filteredAlerts = allAlerts.filter(
          (alert) =>
            alert.teamMemberId && userTeamMemberIds.has(alert.teamMemberId),
        );

        res.json(filteredAlerts);
      } catch (error) {
        console.error("Error fetching capacity alerts:", error);
        res.status(500).json({ message: "Failed to fetch capacity alerts" });
      }
    },
  );

  app.post(
    "/api/smart-bandwidth/generate-assignments",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Get user's projects and tasks
        const projects = await storage.getProjectsForUser(userId);
        const allTasks = await storage.getAllTasks();
        const userTasks = allTasks.filter((task) =>
          projects.some((project) => project.id === task.projectId),
        );

        // Get all unique project members from user's projects only
        const projectMemberIds = new Set<string>();
        const projectMembersData = new Map();

        for (const project of projects) {
          const projectMembers = await storage.getProjectMembers(project.id);
          for (const member of projectMembers) {
            if (member.userId && !projectMemberIds.has(member.userId)) {
              projectMemberIds.add(member.userId);
              // Get user details
              const user = await storage.getUser(member.userId);
              if (user) {
                projectMembersData.set(member.userId, {
                  id: user.id,
                  name:
                    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                    user.username ||
                    user.email ||
                    "Unknown",
                  email: user.email,
                  role: member.role || "Team Member",
                  userId: user.id,
                  skills: [],
                  capacity: 40, // Default 40 hours per week
                  allocated: 0,
                  availability: 100,
                  performance: 90,
                  hourlyRate: 7500, // Default $75/hour in cents
                  timezone: "UTC",
                  workingHours: "9:00-17:00",
                  isActive: true,
                  avatar: "👤",
                  department: "General",
                });
              }
            }
          }
        }

        // Only use project members from user's projects (no global team members)
        const uniqueMembers = Array.from(projectMembersData.values());

        // Generate AI-powered task assignments
        const assignments = await generateSmartAssignments(
          userTasks,
          uniqueMembers,
        );

        res.json(assignments);
      } catch (error) {
        console.error("Error generating smart assignments:", error);
        res
          .status(500)
          .json({ message: "Failed to generate smart assignments" });
      }
    },
  );

  // Enhanced Team Management Routes
  app.get(
    "/api/team/members/enhanced",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Get user's projects
        const userProjects = await storage.getProjectsForUser(userId);
        const projectIds = userProjects.map((p) => p.id);

        // Get all unique project members from user's projects
        const projectMembersData = new Map();

        for (const projectId of projectIds) {
          const projectMembers = await storage.getProjectMembers(projectId);
          for (const member of projectMembers) {
            if (member.userId && !projectMembersData.has(member.userId)) {
              // Get user details
              const user = await storage.getUser(member.userId);
              if (user) {
                // Get current task assignments
                const assignments = await storage.getTasksByAssignee(
                  member.userId,
                );
                // Filter to only tasks in user's projects
                const userProjectAssignments = assignments.filter((task) =>
                  projectIds.includes(task.projectId),
                );

                const currentProjects = new Set(
                  userProjectAssignments.map((task) => task.projectId),
                ).size;
                const completedTasks = userProjectAssignments.filter(
                  (task) => task.status === "completed",
                ).length;

                // Calculate actual allocated hours from assignments
                const allocatedHours = userProjectAssignments
                  .filter((task) => task.status !== "completed")
                  .reduce((sum, task) => sum + (task.estimatedHours || 0), 0);

                // Calculate availability
                const capacity = 40; // Default capacity
                const availability =
                  capacity > 0
                    ? Math.round(((capacity - allocatedHours) / capacity) * 100)
                    : 0;

                projectMembersData.set(member.userId, {
                  id: user.id,
                  userId: user.id,
                  name:
                    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                    user.username ||
                    user.email ||
                    "Unknown",
                  email: user.email,
                  role: member.role || "Team Member",
                  skills: [],
                  capacity,
                  allocated: allocatedHours,
                  availability,
                  currentProjects,
                  completedTasks,
                  performance: 90,
                  hourlyRate: 7500,
                  timezone: "UTC",
                  workingHours: "9:00-17:00",
                  isActive: true,
                  avatar: "👤",
                  department: "General",
                });
              }
            }
          }
        }

        // Only return project members from user's projects
        const enhancedMembers = Array.from(projectMembersData.values());

        res.json(enhancedMembers);
      } catch (error) {
        console.error("Error fetching enhanced team members:", error);
        res.status(500).json({ message: "Failed to fetch team members" });
      }
    },
  );

  app.get(
    "/api/team/workload/:memberId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { memberId } = req.params;
        const member = await storage.getTeamMember(parseInt(memberId));

        if (!member) {
          return res.status(404).json({ message: "Team member not found" });
        }

        // Get tasks assigned to this member
        const tasks = await storage.getTasksByAssignee(member.userId || "");

        // Calculate weekly hours (mock data for now)
        const weeklyHours = [8, 7, 9, 8, 6, 0, 0]; // Mon-Sun

        // Project distribution
        const projectMap = new Map();
        tasks.forEach((task) => {
          const hours = projectMap.get(task.projectId) || 0;
          projectMap.set(task.projectId, hours + (task.estimatedHours || 0));
        });

        const projectDistribution = Array.from(projectMap.entries()).map(
          ([projectId, hours]) => ({
            projectName: `Project ${projectId}`,
            hours,
          }),
        );

        // Upcoming deadlines
        const upcomingDeadlines = tasks
          .filter((task) => task.dueDate && task.status !== "completed")
          .sort(
            (a, b) =>
              new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
          )
          .slice(0, 5)
          .map((task) => ({
            taskTitle: task.title,
            deadline: task.dueDate!,
            hours: task.estimatedHours || 0,
          }));

        res.json({
          teamMemberId: memberId,
          weeklyHours,
          projectDistribution,
          upcomingDeadlines,
        });
      } catch (error) {
        console.error("Error fetching workload data:", error);
        res.status(500).json({ message: "Failed to fetch workload data" });
      }
    },
  );

  app.get(
    "/api/team/assignments/:memberId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { memberId } = req.params;
        const member = await storage.getTeamMember(parseInt(memberId));

        if (!member) {
          return res.status(404).json({ message: "Team member not found" });
        }

        // Get tasks assigned to this member
        const tasks = await storage.getTasksByAssignee(member.userId || "");

        // Format assignments
        const assignments = await Promise.all(
          tasks.map(async (task) => {
            const project = await storage.getProject(task.projectId);
            return {
              id: task.id,
              taskId: task.id,
              taskTitle: task.title,
              projectName: project?.name || "Unknown Project",
              estimatedHours: task.estimatedHours || 0,
              deadline: task.dueDate || new Date().toISOString(),
              priority: task.priority || "medium",
              status: task.status,
            };
          }),
        );

        res.json(assignments);
      } catch (error) {
        console.error("Error fetching assignments:", error);
        res.status(500).json({ message: "Failed to fetch assignments" });
      }
    },
  );

  app.post("/api/team/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      const memberData = {
        ...req.body,
        userId: null, // Not linked to a user account yet
        availability: 100,
        performance: 90,
        isActive: true,
      };

      const newMember = await storage.createTeamMember(memberData);
      res.json(newMember);
    } catch (error) {
      console.error("Error creating team member:", error);
      res.status(500).json({ message: "Failed to create team member" });
    }
  });

  app.patch("/api/team/members/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const updatedMember = await storage.updateTeamMember(
        parseInt(id),
        updates,
      );
      res.json(updatedMember);
    } catch (error) {
      console.error("Error updating team member:", error);
      res.status(500).json({ message: "Failed to update team member" });
    }
  });

  app.delete(
    "/api/team/members/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        await storage.deleteTeamMember(parseInt(id));
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting team member:", error);
        res.status(500).json({ message: "Failed to delete team member" });
      }
    },
  );

  // Task Comments API routes
  app.get(
    "/api/tasks/:taskId/comments",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const taskId = parseInt(req.params.taskId);
        const comments = await storage.getTaskComments(taskId);
        res.json(comments);
      } catch (error) {
        console.error("Error fetching task comments:", error);
        res.status(500).json({ message: "Failed to fetch task comments" });
      }
    },
  );

  app.post(
    "/api/tasks/:taskId/comments",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const taskId = parseInt(req.params.taskId);
        const userId = req.user.dbUserId || req.user.claims.sub;
        const { content, parentCommentId } = req.body;

        if (!content) {
          return res
            .status(400)
            .json({ message: "Comment content is required" });
        }

        const comment = await storage.createTaskComment({
          taskId,
          userId,
          content,
          parentCommentId: parentCommentId || null,
        });

        res.status(201).json(comment);
      } catch (error) {
        console.error("Error creating task comment:", error);
        res.status(500).json({ message: "Failed to create task comment" });
      }
    },
  );

  app.put("/api/tasks/comments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ message: "Comment content is required" });
      }

      const comment = await storage.updateTaskComment(commentId, { content });
      res.json(comment);
    } catch (error) {
      console.error("Error updating task comment:", error);
      res.status(500).json({ message: "Failed to update task comment" });
    }
  });

  app.delete(
    "/api/tasks/comments/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const commentId = parseInt(req.params.id);
        await storage.deleteTaskComment(commentId);
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting task comment:", error);
        res.status(500).json({ message: "Failed to delete task comment" });
      }
    },
  );

  // Subtasks API routes
  app.get(
    "/api/tasks/:taskId/subtasks",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const taskId = parseInt(req.params.taskId);
        const subtasks = await storage.getSubtasks(taskId);
        res.json(subtasks);
      } catch (error) {
        console.error("Error fetching subtasks:", error);
        res.status(500).json({ message: "Failed to fetch subtasks" });
      }
    },
  );

  app.post(
    "/api/tasks/:taskId/generate-subtasks",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const taskId = parseInt(req.params.taskId);
        const userId = req.user.dbUserId || req.user.claims.sub;

        // Get the parent task
        const task = await storage.getTask(taskId);
        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }

        // Generate subtasks using AI
        const { generateSubtasksWithAI } = await import(
          "./services/subtask-generator"
        );
        const subtasks = await generateSubtasksWithAI(task, userId);

        res.json({
          subtasks,
          message: `Generated ${subtasks.length} subtasks`,
        });
      } catch (error) {
        console.error("Error generating subtasks:", error);
        res.status(500).json({ message: "Failed to generate subtasks" });
      }
    },
  );

  // Task Attachments API routes
  app.get(
    "/api/tasks/:taskId/attachments",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const taskId = parseInt(req.params.taskId);
        const attachments = await storage.getTaskAttachments(taskId);
        res.json(attachments);
      } catch (error) {
        console.error("Error fetching task attachments:", error);
        res.status(500).json({ message: "Failed to fetch task attachments" });
      }
    },
  );

  app.post(
    "/api/tasks/:taskId/attachments",
    isAuthenticated,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const taskId = parseInt(req.params.taskId);
        const userId = req.user.dbUserId || req.user.claims.sub;

        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const fileType = req.file.mimetype.startsWith("image/")
          ? "image"
          : req.file.mimetype === "application/pdf"
            ? "pdf"
            : req.file.mimetype.includes("document") ||
                req.file.mimetype.includes("sheet") ||
                req.file.mimetype.includes("presentation")
              ? "document"
              : "other";

        const attachment = await storage.createTaskAttachment({
          taskId,
          userId,
          filename: req.file.filename,
          originalName: req.file.originalname,
          fileType,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          uploadPath: req.file.path,
        });

        res.status(201).json(attachment);
      } catch (error) {
        console.error("Error uploading task attachment:", error);
        res.status(500).json({ message: "Failed to upload task attachment" });
      }
    },
  );

  app.delete(
    "/api/tasks/attachments/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const attachmentId = parseInt(req.params.id);
        await storage.deleteTaskAttachment(attachmentId);
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting task attachment:", error);
        res.status(500).json({ message: "Failed to delete task attachment" });
      }
    },
  );

  // Team AI Assistant endpoint
  app.post("/api/team/ai-assistant", isAuthenticated, async (req: any, res) => {
    try {
      const { message, context } = req.body;
      const userId = req.user.dbUserId || req.user.claims.sub;

      // Get team members and tasks for context
      const teamMembers = await storage.getTeamMembers();
      const allTasks = await storage.getAllTasks();
      const unassignedTasks = allTasks.filter(
        (task) => !task.assigneeId && task.status !== "completed",
      );

      // Build context for AI
      const systemPrompt = `You are a Team Management AI Assistant. You help with:
1. Analyzing team capacity and workload
2. Suggesting optimal task assignments based on skills and availability
3. Identifying overloaded or underutilized team members
4. Providing workload optimization recommendations

Current team data:
${teamMembers.map((m) => `- ${m.name} (${m.role}): ${m.availability}% available, Skills: ${m.skills.join(", ")}`).join("\n")}

Unassigned tasks: ${unassignedTasks.length}

Respond with actionable insights and specific recommendations. Include assignment suggestions and capacity alerts when relevant.`;

      // Call OpenAI
      const openai = (getAiClient() as any);
      const teamModel = await getModelForBudget(userId, "gpt-4o");

      const completion = await openai.chat.completions.create({
        model: teamModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...context.previousMessages.map((msg: any) => ({
            role: msg.type === "user" ? "user" : "assistant",
            content: msg.content,
          })),
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      if (completion.usage) {
        trackTokenUsage(userId, "team-ai-chat", teamModel, completion.usage).catch(() => {});
      }

      const aiResponse =
        completion.choices[0].message.content ||
        "I couldn't process that request.";

      // Parse AI response for suggestions and alerts (simplified for now)
      const suggestions = [];
      const alerts = [];

      // Check for overloaded members
      teamMembers.forEach((member) => {
        if (member.availability < 20) {
          alerts.push({
            type: "overload",
            severity: "high",
            memberId: member.id,
            memberName: member.name,
            message: `${member.name} is overloaded with only ${member.availability}% availability`,
            suggestedAction:
              "Consider redistributing tasks or extending deadlines",
          });
        } else if (member.availability > 60) {
          alerts.push({
            type: "underutilized",
            severity: "medium",
            memberId: member.id,
            memberName: member.name,
            message: `${member.name} has ${member.availability}% availability`,
            suggestedAction: "Assign additional tasks to optimize utilization",
          });
        }
      });

      res.json({
        message: aiResponse,
        suggestions,
        alerts,
      });
    } catch (error) {
      console.error("Error in AI assistant:", error);
      res.status(500).json({ message: "Failed to get AI response" });
    }
  });

  // Foodisaur Agent endpoints
  app.post(
    "/api/foodisaur/generate-recipe",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { idea } = req.body;

        if (!idea) {
          return res.status(400).json({ message: "Recipe idea is required" });
        }

        if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
          return res.status(500).json({ message: "OpenAI API key is missing" });
        }

        const { generateRecipeFromIdea } = await import(
          "./services/foodisaur-service"
        );
        const recipe = await generateRecipeFromIdea(idea);

        res.json(recipe);
      } catch (error) {
        console.error("Error generating recipe:", error);
        res.status(500).json({
          message: "Failed to generate recipe",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.post(
    "/api/foodisaur/generate-media",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { recipe, type, style, voice, customization } = req.body;

        if (!recipe || !type) {
          return res
            .status(400)
            .json({ message: "Recipe and media type are required" });
        }

        const { generateMediaContent } = await import(
          "./services/foodisaur-service"
        );
        const media = await generateMediaContent(
          recipe,
          type,
          style,
          voice,
          customization,
        );

        res.json(media);
      } catch (error) {
        console.error("Error generating media:", error);
        res.status(500).json({
          message: "Failed to generate media",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.post("/api/foodisaur/export", isAuthenticated, async (req: any, res) => {
    try {
      const { recipe, format, media } = req.body;

      console.log("Export request received:", { format, hasRecipe: !!recipe });

      if (!recipe || !format) {
        return res
          .status(400)
          .json({ message: "Recipe and format are required" });
      }

      const { exportRecipe } = await import("./services/foodisaur-service");
      const exportData = await exportRecipe(recipe, format, media);

      // Set appropriate headers based on format
      const contentTypes: Record<string, string> = {
        pdf: "application/pdf",
        png: "image/png",
        mp4: "video/mp4",
        html: "text/html",
      };

      res.setHeader(
        "Content-Type",
        contentTypes[format] || "application/octet-stream",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${recipe.title.replace(/\s+/g, "-").toLowerCase()}.${format}"`,
      );
      res.send(exportData);
    } catch (error) {
      console.error("Error exporting recipe:", error);
      res.status(500).json({
        message: "Failed to export recipe",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post(
    "/api/foodisaur/save-recipe",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { recipe } = req.body;
        const userId = req.session?.userId;

        if (!recipe) {
          return res.status(400).json({ message: "Recipe is required" });
        }

        // Save to user's collection (you can implement this in database)
        // For now, just return success
        res.json({ success: true, message: "Recipe saved to cookbook" });
      } catch (error) {
        console.error("Error saving recipe:", error);
        res.status(500).json({
          message: "Failed to save recipe",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.post(
    "/api/foodisaur/generate-seo",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { recipe } = req.body;

        if (!recipe) {
          return res.status(400).json({ message: "Recipe is required" });
        }

        const { generateSeoContent } = await import(
          "./services/foodisaur-service"
        );
        const seoData = await generateSeoContent(recipe);

        res.json(seoData);
      } catch (error) {
        console.error("Error generating SEO:", error);
        res.status(500).json({
          message: "Failed to generate SEO content",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.post(
    "/api/foodisaur/generate-photo-ideas",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { recipe, style, uploadedImage } = req.body;

        if (!recipe || !style) {
          return res
            .status(400)
            .json({ message: "Recipe and style are required" });
        }

        const { generatePhotoIdeas } = await import(
          "./services/foodisaur-service"
        );
        const ideas = await generatePhotoIdeas(recipe, style, uploadedImage);

        res.json(ideas);
      } catch (error) {
        console.error("Error generating photo ideas:", error);
        res.status(500).json({
          message: "Failed to generate photography ideas",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // JIRA Agent Routes
  app.post("/api/jira/integration", isAuthenticated, async (req: any, res) => {
    try {
      const { jiraUrl, email, apiToken } = req.body;

      if (!jiraUrl || !email || !apiToken) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Test connection first using the new service
      const testResult = await jiraService.testJiraConnection({
        jiraUrl,
        email,
        apiToken,
      });

      if (!testResult.isValid) {
        return res.status(400).json({ message: testResult.message });
      }

      // Save the integration using the new service
      const userId = req.user.dbUserId || req.user.claims.sub;
      const integration = await jiraService.saveJiraIntegration(userId, {
        jiraUrl,
        email,
        apiToken,
        isActive: true,
      });

      res.json({
        message: "JIRA integration configured successfully",
        integration: {
          id: integration.id,
          jiraUrl: integration.jiraUrl,
          email: integration.email,
          isActive: integration.isActive,
        },
        availableProjects: testResult.availableProjects,
      });
    } catch (error: any) {
      console.error("Error saving JIRA integration:", error);
      res.status(500).json({
        message: "Failed to save integration",
        error: error.message || String(error),
      });
    }
  });

  app.get("/api/jira/integration", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      const integration = await jiraService.getJiraIntegration(userId);
      res.json(integration || null);
    } catch (error: any) {
      console.error("Error fetching JIRA integration:", error);
      res.status(500).json({
        message: "Failed to fetch integration",
        error: error.message || String(error),
      });
    }
  });

  app.get("/api/jira/projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      const integration = await jiraService.getJiraIntegration(userId);

      if (!integration || !integration.isActive) {
        return res.json([]);
      }

      const testResult = await jiraService.testJiraConnection(integration);
      res.json(testResult.availableProjects || []);
    } catch (error: any) {
      console.error("Error fetching JIRA projects:", error);
      res.status(500).json({
        message: "Failed to fetch JIRA projects",
        error: error.message || String(error),
      });
    }
  });

  // Get JIRA project metadata including issue types
  app.get(
    "/api/jira/project-metadata/:projectKey",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;
        const { projectKey } = req.params;

        // Get the user's JIRA integration
        const integration = await jiraService.getJiraIntegration(userId);
        if (!integration || !integration.isActive) {
          return res
            .status(404)
            .json({ message: "JIRA integration not found or not active" });
        }

        // Import the correct Jira service
        const { JiraIntegrationService } = await import(
          "./services/jira-integration"
        );
        const jiraIntegrationService = new JiraIntegrationService();

        // Get project details including issue types
        const metadata = await jiraIntegrationService.getProjectMetadata(
          integration,
          projectKey,
        );

        res.json(metadata);
      } catch (error: any) {
        console.error("Failed to get project metadata:", error);
        res.status(500).json({
          message: "Failed to get project metadata",
          error: error.message || "Unknown error",
        });
      }
    },
  );

  // Test JIRA authentication
  app.get("/api/jira/test-auth", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;

      // Get the user's JIRA integration
      const integration = await jiraService.getJiraIntegration(userId);
      if (!integration || !integration.isActive) {
        return res
          .status(404)
          .json({ message: "JIRA integration not found or not active" });
      }

      // Import the correct Jira service
      const { JiraIntegrationService } = await import(
        "./services/jira-integration"
      );
      const jiraIntegrationService = new JiraIntegrationService();

      // Test by getting current user
      const currentUser =
        await jiraIntegrationService.getCurrentUser(integration);

      res.json({
        authenticated: true,
        user: {
          accountId: currentUser.accountId,
          displayName: currentUser.displayName,
          email: currentUser.emailAddress,
        },
      });
    } catch (error: any) {
      console.error("JIRA auth test failed:", error);
      res.status(401).json({
        authenticated: false,
        error: error.message || "Authentication failed",
      });
    }
  });

  // Create JIRA project
  app.post(
    "/api/jira/projects/create",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;
        const { name, key, description, projectTypeKey } = req.body;

        if (!name || !key) {
          return res
            .status(400)
            .json({ message: "Project name and key are required" });
        }

        // Get the user's JIRA integration
        const integration = await jiraService.getJiraIntegration(userId);
        if (!integration || !integration.isActive) {
          return res
            .status(404)
            .json({ message: "JIRA integration not found or not active" });
        }

        // Import the correct Jira service
        const { JiraIntegrationService } = await import(
          "./services/jira-integration"
        );
        const jiraIntegrationService = new JiraIntegrationService();

        // Create project in JIRA
        const result = await jiraIntegrationService.createProject(integration, {
          name,
          key,
          description,
          projectTypeKey,
        });

        if (result.success) {
          res.json(result.project);
        } else {
          res.status(400).json({
            message: "Failed to create JIRA project",
            error: result.error,
          });
        }
      } catch (error: any) {
        console.error("Error creating JIRA project:", error);

        // Check if it's an authentication error
        if (
          (error as any).code === "JIRA_AUTH_EXPIRED" ||
          (error as any).status === 401
        ) {
          return res.status(401).json({
            message: "JIRA authentication failed",
            error:
              "Your JIRA API token has expired. Please update your credentials.",
            code: "JIRA_AUTH_EXPIRED",
          });
        }

        res.status(500).json({
          message: "Failed to create JIRA project",
          error: error.message || "Unknown error",
        });
      }
    },
  );
  app.delete(
    "/api/jira/integration",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;
        const integration = await jiraService.getJiraIntegration(userId);

        if (!integration) {
          return res.status(404).json({ message: "No JIRA integration found" });
        }

        await storage.deleteJiraIntegration(integration.id);
        res.json({ message: "JIRA integration disconnected successfully" });
      } catch (error: any) {
        console.error("Error deleting JIRA integration:", error);
        res.status(500).json({
          message: "Failed to delete integration",
          error: error.message || String(error),
        });
      }
    },
  );

  app.delete(
    "/api/jira/integration/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        await storage.deleteJiraIntegration(parseInt(id));
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting JIRA integration:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to delete integration" });
      }
    },
  );

  // Public Story Writing (no auth required for simplified agent)
  app.post("/api/jira/stories/write", async (req: any, res) => {
    try {
      const { title, projectId, context, targetUser, businessValue } = req.body;

      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      const result = await jiraService.writeUserStory({
        title,
        projectId,
        context,
        targetUser,
        businessValue,
      });
      res.json(result);
    } catch (error: any) {
      console.error("Error writing user story:", error);
      res.status(500).json({
        message: "Failed to write user story",
        error: error.message || String(error),
      });
    }
  });

  // Public Story Estimation (no auth required for simplified agent)
  app.post("/api/jira/stories/estimate", async (req: any, res) => {
    try {
      const {
        title,
        story,
        acceptanceCriteria,
        context,
        previousEstimates,
        teamVelocity,
      } = req.body;

      if (!title || !story) {
        return res
          .status(400)
          .json({ message: "Title and story description are required" });
      }

      const estimation = await jiraService.estimateStoryPoints({
        story: {
          title,
          story,
          acceptanceCriteria: acceptanceCriteria || [],
        } as UserStory,
        previousEstimates,
        teamVelocity,
      });

      res.json(estimation);
    } catch (error: any) {
      console.error("Error estimating story:", error);
      res.status(500).json({
        message: "Failed to estimate story",
        error: error.message || String(error),
      });
    }
  });

  // Agile Planning Agent Routes
  app.post(
    "/api/agile-planning/generate",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { prompt, currentPlan, isRegeneration } = req.body;

        if (!prompt) {
          return res.status(400).json({ message: "Prompt is required" });
        }

        // Check if OpenAI API key is available
        if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
          console.log("OpenAI API key not found, using fallback plan");
          // Return error message to prompt user to add API key
          return res.status(400).json({
            message:
              "OpenAI API key is required. Please add your OpenAI API key in the Settings tab.",
            error: "MISSING_API_KEY",
          });
        }

        // Disable test plan to use real OpenAI
        const USE_TEST_PLAN = false;

        if (USE_TEST_PLAN) {
          console.log("Using test plan for debugging");
          // Return a hardcoded plan for testing
          const testPlan = {
            initiative: {
              id: "test-" + Date.now(),
              name: `Agile Plan: ${prompt.substring(0, 50)}`,
              description: "Generated agile plan for your project",
              epics: [
                {
                  id: "epic-1",
                  name: "User Authentication & Access",
                  description:
                    "Implement secure user authentication and access control",
                  stories: [
                    {
                      id: "story-1",
                      title: "User Registration",
                      description:
                        "As a new user, I want to register an account so that I can access the platform",
                      acceptanceCriteria: [
                        "Registration form works",
                        "Email validation implemented",
                        "Password requirements enforced",
                      ],
                      storyPoints: 5,
                      priority: "high",
                      epicId: "epic-1",
                    },
                    {
                      id: "story-2",
                      title: "User Login",
                      description:
                        "As a user, I want to log in securely so that I can access my account",
                      acceptanceCriteria: [
                        "Login form functional",
                        "Remember me option works",
                        "Password reset available",
                      ],
                      storyPoints: 3,
                      priority: "high",
                      epicId: "epic-1",
                    },
                  ],
                },
                {
                  id: "epic-2",
                  name: "Core Functionality",
                  description: "Build the main features of the application",
                  stories: [
                    {
                      id: "story-3",
                      title: "Dashboard View",
                      description:
                        "As a user, I want to see a dashboard so that I can get an overview of my data",
                      acceptanceCriteria: [
                        "Dashboard loads quickly",
                        "Data is up to date",
                        "Responsive design works",
                      ],
                      storyPoints: 8,
                      priority: "medium",
                      epicId: "epic-2",
                    },
                  ],
                },
              ],
            },
            createdAt: new Date(),
          };

          console.log(
            "Test plan generated with",
            testPlan.initiative.epics.length,
            "epics",
          );
          return res.json(testPlan);
        }

        // Import the agile planning service
        const { agilePlanningService } = await import(
          "./services/agile-planning-service"
        );

        // Generate the agile plan
        const plan = await agilePlanningService.generateAgilePlan(
          prompt,
          currentPlan,
          isRegeneration,
        );

        console.log("Generated plan structure:", {
          hasInitiative: !!plan.initiative,
          initiativeName: plan.initiative?.name,
          epicsCount: plan.initiative?.epics?.length || 0,
          firstEpicName: plan.initiative?.epics?.[0]?.name,
        });

        // Ensure the plan has the correct structure
        if (
          !plan ||
          !plan.initiative ||
          !plan.initiative.epics ||
          plan.initiative.epics.length === 0
        ) {
          console.error("Invalid plan generated:", plan);
          throw new Error("Generated plan has invalid structure");
        }

        res.json(plan);
      } catch (error) {
        console.error("Error generating agile plan:", error);
        res.status(500).json({
          message: "Failed to generate agile plan",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.post(
    "/api/agile-planning/save-to-project",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { plan } = req.body;
        const userId = req.user.dbUserId || req.user.claims.sub;

        if (!plan || !plan.initiative) {
          return res.status(400).json({ message: "Plan is required" });
        }

        // Create a new project from the agile plan
        const project = await storage.createProject({
          name: plan.initiative.name,
          description: plan.initiative.description,
          ownerId: userId,
          status: "planning",
          tags: ["agile"],
          dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
          source: "agile-planning",
        });

        // Create milestones from epics
        for (const epic of plan.initiative.epics) {
          const milestone = await storage.createTask({
            projectId: project.id,
            name: epic.name,
            description: epic.description,
            status: "todo",
            priority: "medium",
            type: "milestone",
            createdById: userId,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          });

          // Create tasks from user stories
          for (const story of epic.stories) {
            await storage.createTask({
              projectId: project.id,
              name: story.title,
              description: `${story.description}\n\nAcceptance Criteria:\n${story.acceptanceCriteria.map((ac) => `- ${ac}`).join("\n")}`,
              status: "todo",
              priority: story.priority,
              type: "task",
              createdById: userId,
              parentTaskId: milestone.id,
              estimatedHours: story.storyPoints ? story.storyPoints * 8 : null, // Convert story points to hours
              storyPoints: story.storyPoints || null,
            });
          }
        }

        res.json({
          projectId: project.id,
          message: "Agile plan saved as project successfully",
        });
      } catch (error) {
        console.error("Error saving agile plan to project:", error);
        res.status(500).json({
          message: "Failed to save agile plan to project",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.post(
    "/api/agile-planning/export-jira",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { plan } = req.body;

        if (!plan || !plan.initiative) {
          return res.status(400).json({ message: "Plan is required" });
        }

        // Import the agile planning service
        const { agilePlanningService } = await import(
          "./services/agile-planning-service"
        );

        // Export to Jira format
        const jiraExport = await agilePlanningService.exportToJira(plan);

        res.json(jiraExport);
      } catch (error) {
        console.error("Error exporting to Jira:", error);
        res.status(500).json({
          message: "Failed to export to Jira",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Enhanced Agile Planning AI Chat
  app.post("/api/agile-planning/enhanced-chat", async (req: any, res) => {
    try {
      const { message, canvas, chatHistory, actionHistory } = req.body;

      console.log("Enhanced agile chat debug:", {
        message,
        hasCanvas: !!canvas,
        canvasEpicsCount: canvas?.initiative?.epics?.length || 0,
        chatHistoryLength: chatHistory?.length || 0,
      });

      const { EnhancedAgileAgent } = await import(
        "./services/enhanced-agile-agent"
      );
      const enhancedAgent = new EnhancedAgileAgent();
      const action = await enhancedAgent.processUserRequest(
        message,
        canvas,
        chatHistory || [],
        actionHistory || [],
      );

      console.log("Agent action result:", {
        action: action.action,
        target: action.target,
        explanation: action.explanation,
      });

      // Apply canvas updates if needed
      let updatedCanvas = canvas;
      if (
        canvas &&
        action.action !== "analyze" &&
        action.action !== "create_plan"
      ) {
        updatedCanvas = enhancedAgent.applyCanvasUpdate(canvas, action);
        console.log("Canvas updated:", {
          originalEpics: canvas?.initiative?.epics?.length || 0,
          updatedEpics: updatedCanvas?.initiative?.epics?.length || 0,
        });
      }

      res.json({
        ...action,
        updatedCanvas: updatedCanvas !== canvas ? updatedCanvas : null,
      });
    } catch (error) {
      console.error("Enhanced agile chat error:", error);
      res.status(500).json({
        message: "Enhanced agile chat failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Jira Integration Management Routes
  app.get("/api/jira/integration", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      console.log("GET /api/jira/integration - userId:", userId);

      const integration = await storage.getJiraIntegration(userId);
      console.log("GET /api/jira/integration - integration:", integration);

      if (!integration) {
        return res.json(null);
      }

      // Return integration but mask the API token
      const response = {
        ...integration,
        apiToken: integration.apiToken ? "********" : null,
        isActive: integration.isActive !== false, // Default to true if not explicitly false
      };

      console.log("GET /api/jira/integration - response:", response);
      res.json(response);
    } catch (error) {
      console.error("Error fetching Jira integration:", error);
      res.status(500).json({
        message: "Failed to fetch Jira integration",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/jira/integration", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      const { jiraUrl, email, apiToken } = req.body;

      if (!jiraUrl || !email || !apiToken) {
        return res
          .status(400)
          .json({ message: "Jira URL, email, and API token are required" });
      }

      // Create or update integration
      const integration = await storage.createJiraIntegration({
        userId,
        jiraUrl,
        email,
        apiToken,
        isActive: true,
      });

      res.json({
        ...integration,
        apiToken: "********", // Mask the token in response
      });
    } catch (error) {
      console.error("Error saving Jira integration:", error);
      res.status(500).json({
        message: "Failed to save Jira integration",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete(
    "/api/jira/integration",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;
        const integration = await storage.getJiraIntegration(userId);

        if (!integration) {
          return res.status(404).json({ message: "No Jira integration found" });
        }

        await storage.deleteJiraIntegration(integration.id);
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting Jira integration:", error);
        res.status(500).json({
          message: "Failed to delete Jira integration",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.post(
    "/api/jira/test-connection",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { jiraUrl, email, apiToken } = req.body;

        if (!jiraUrl || !email || !apiToken) {
          return res
            .status(400)
            .json({ message: "Jira URL, email, and API token are required" });
        }

        // Import the correct Jira service
        const { jiraService } = await import("./services/jira-service");

        // Test the connection
        const testResult = await jiraService.testJiraConnection({
          jiraUrl,
          email,
          apiToken,
        });

        if (!testResult.isValid) {
          return res.status(400).json({
            message:
              testResult.message ||
              "Failed to connect to Jira. Please check your credentials.",
          });
        }

        res.json({
          isValid: true,
          projectCount: testResult.availableProjects?.length || 0,
          siteName: new URL(jiraUrl).hostname.split(".")[0],
          availableProjects: testResult.availableProjects,
        });
      } catch (error) {
        console.error("Error testing Jira connection:", error);
        res.status(400).json({
          message: "Failed to connect to Jira",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.get("/api/jira/projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      console.log("Fetching Jira projects for user:", userId);

      const integration = await storage.getJiraIntegration(userId);
      console.log(
        "Integration found:",
        integration ? "Yes" : "No",
        integration?.isActive ? "Active" : "Inactive",
      );

      if (!integration || !integration.isActive) {
        return res
          .status(400)
          .json({ message: "No active Jira integration found" });
      }

      // Import Jira integration service
      const { JiraIntegrationService } = await import(
        "./services/jira-integration"
      );
      const jiraService = new JiraIntegrationService();

      const projects = await jiraService.getProjects(integration);
      console.log("Projects fetched:", projects.length);
      console.log("Projects data:", JSON.stringify(projects));
      res.json(projects);
    } catch (error: any) {
      console.error("Error fetching Jira projects:", error);

      // Check if it's an authentication error
      if (
        (error as any).code === "JIRA_AUTH_EXPIRED" ||
        (error as any).status === 401
      ) {
        return res.status(401).json({
          message: "JIRA authentication failed",
          error:
            "Your JIRA API token has expired. Please update your credentials.",
          code: "JIRA_AUTH_EXPIRED",
        });
      }

      res.status(500).json({
        message: "Failed to fetch Jira projects",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get issue types for a specific project
  app.get(
    "/api/jira/project/:projectKey/issue-types",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;
        const { projectKey } = req.params;
        console.log("Fetching issue types for project:", projectKey);

        const integration = await storage.getJiraIntegration(userId);

        if (!integration || !integration.isActive) {
          return res
            .status(400)
            .json({ message: "No active Jira integration found" });
        }

        // Import Jira integration service
        const { JiraIntegrationService } = await import(
          "./services/jira-integration"
        );
        const jiraService = new JiraIntegrationService();

        const issueTypes = await jiraService.getProjectIssueTypes(
          integration,
          projectKey,
        );
        console.log("Issue types fetched for", projectKey, ":", issueTypes);

        res.json({
          projectKey,
          issueTypes,
          issueTypeNames: issueTypes.map((t: any) => t.name),
        });
      } catch (error: any) {
        console.error("Error fetching issue types:", error);

        // Check if it's an authentication error
        if (
          (error as any).code === "JIRA_AUTH_EXPIRED" ||
          (error as any).status === 401
        ) {
          return res.status(401).json({
            message: "JIRA authentication failed",
            error:
              "Your JIRA API token has expired. Please update your credentials.",
            code: "JIRA_AUTH_EXPIRED",
          });
        }

        res.status(500).json({
          message: "Failed to fetch issue types",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.post(
    "/api/agile-planning/export-to-jira",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;
        const { plan, projectKey } = req.body;

        console.log(
          "Export to Jira - Request body:",
          JSON.stringify(req.body, null, 2),
        );
        console.log("Export to Jira - Plan structure:", {
          hasPlan: !!plan,
          hasInitiative: !!plan?.initiative,
          hasEpics: !!plan?.initiative?.epics,
          epicsIsArray: Array.isArray(plan?.initiative?.epics),
          epicsCount: plan?.initiative?.epics?.length || 0,
          epicNames: plan?.initiative?.epics?.map((e: any) => e.name) || [],
        });

        // Log the actual epic data to debug
        if (plan?.initiative?.epics) {
          console.log("Export to Jira - Epic details:");
          plan.initiative.epics.forEach((epic: any, index: number) => {
            console.log(`Epic ${index + 1}:`, {
              id: epic.id,
              name: epic.name,
              hasStories: !!epic.stories,
              storiesCount: epic.stories?.length || 0,
            });
          });
        }

        if (!plan || !plan.initiative || !projectKey) {
          return res
            .status(400)
            .json({ message: "Plan and project key are required" });
        }

        // Get user's Jira integration first, before checking epics
        const integration = await storage.getJiraIntegration(userId);

        if (!integration || !integration.isActive) {
          return res
            .status(400)
            .json({ message: "No active Jira integration found" });
        }

        if (!plan.initiative.epics || plan.initiative.epics.length === 0) {
          console.log("Export to Jira - No epics found in plan!");
          console.log("Full request body:", JSON.stringify(req.body, null, 2));
          return res.json({
            success: true,
            epicsCreated: 0,
            storiesCreated: 0,
            errors: ["No epics found in the plan to export"],
            projectKey,
            jiraUrl: `${integration.jiraUrl}/browse/${projectKey}`,
          });
        }

        // Import services and use the exportPlanToJira method that has issue type detection
        const { JiraIntegrationService } = await import(
          "./services/jira-integration"
        );
        const jiraService = new JiraIntegrationService();

        // Collect all story IDs from all epics to export everything
        const allStoryIds: string[] = [];
        plan.initiative.epics.forEach((epic: any) => {
          if (epic.stories && Array.isArray(epic.stories)) {
            epic.stories.forEach((story: any) => {
              if (story.id) {
                allStoryIds.push(story.id);
              }
            });
          }
        });

        console.log(
          `Exporting ${plan.initiative.epics.length} epics with ${allStoryIds.length} total stories`,
        );
        console.log("Using exportPlanToJira method with issue type detection");

        // Add projectKey to the plan object
        const planWithProjectKey = {
          ...plan,
          projectKey: projectKey,
        };

        // Use the exportPlanToJira method which has issue type detection
        const result = await jiraService.exportPlanToJira(
          integration.id,
          planWithProjectKey,
          allStoryIds,
        );

        console.log("Export result from exportPlanToJira:", result);

        // Return the result from exportPlanToJira which already has the proper format
        res.json(result);
      } catch (error: any) {
        console.error("Error exporting to Jira:", error);
        console.error("Error details:", error.response?.data);

        // Check if it's an authentication error
        if (
          (error as any).code === "JIRA_AUTH_EXPIRED" ||
          (error as any).status === 401
        ) {
          return res.status(401).json({
            message: "JIRA authentication failed",
            error:
              "Your JIRA API token has expired. Please update your credentials.",
            code: "JIRA_AUTH_EXPIRED",
          });
        }

        res.status(500).json({
          message: "Failed to export to Jira",
          error: error.message || String(error),
          details: error.response?.data,
        });
      }
    },
  );

  app.post("/api/jira/stories", isAuthenticated, async (req: any, res) => {
    try {
      const storyData = req.body;

      if (!storyData.projectId || !storyData.title) {
        return res
          .status(400)
          .json({ message: "ProjectId and title are required" });
      }

      // Calculate ROI score using the new service
      const roiScore = await jiraService.calculateRoiScore(
        storyData as UserStory,
      );

      const story = await jiraService.saveUserStory({
        ...storyData,
        roiScore,
      });

      res.json(story);
    } catch (error: any) {
      console.error("Error creating user story:", error);
      res.status(500).json({
        message: "Failed to create story",
        error: error.message || String(error),
      });
    }
  });

  app.get(
    "/api/jira/stories/:projectId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { projectId } = req.params;
        const stories = await jiraService.getUserStoriesForProject(
          parseInt(projectId),
        );
        res.json(stories);
      } catch (error: any) {
        console.error("Error fetching user stories:", error);
        res.status(500).json({
          message: "Failed to fetch stories",
          error: error.message || String(error),
        });
      }
    },
  );

  // Public Backlog Generation (no auth required for simplified agent)
  app.post("/api/jira/backlog/generate", async (req: any, res) => {
    try {
      const { feature, projectId, context, targetSprint, estimatedTeamSize } =
        req.body;

      if (!feature) {
        return res
          .status(400)
          .json({ message: "Feature description is required" });
      }

      const result = await jiraService.generateBacklog({
        feature,
        projectId: projectId || 0, // Default to 0 for standalone use
        context,
        targetSprint,
        estimatedTeamSize,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error generating backlog:", error);
      res.status(500).json({
        message: "Failed to generate backlog",
        error: error.message || String(error),
      });
    }
  });

  // New API route for selective export to Jira
  app.post(
    "/api/jira/export/:credentialId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const credentialId = Number(req.params.credentialId);
        const { plan, selectedStoryIds } = req.body;

        console.log("JIRA Export Request - credentialId:", credentialId);
        console.log("JIRA Export Request - plan:", !!plan);
        console.log(
          "JIRA Export Request - selectedStoryIds:",
          selectedStoryIds,
        );

        if (!plan || !selectedStoryIds) {
          return res.status(400).json({ message: "Missing data to export." });
        }

        // Import the export function
        const { exportPlanToJira } = await import(
          "./services/jira-integration"
        );
        console.log("Export request:", {
          credentialId,
          planExists: !!plan,
          selectedStoryIds,
        });
        const result = await exportPlanToJira(
          credentialId,
          plan,
          selectedStoryIds,
        );
        console.log("Export result:", result);
        res.status(200).json(result);
      } catch (err: any) {
        console.error("Jira export error - Full error:", err);
        console.error("Jira export error - Stack:", err.stack);
        res.status(500).json({ message: err.message || "Export failed" });
      }
    },
  );

  app.delete(
    "/api/jira/stories/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        await storage.deleteUserStory(parseInt(id));
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting user story:", error);
        res.status(500).json({
          message: "Failed to delete story",
          error: error.message || String(error),
        });
      }
    },
  );

  app.put("/api/jira/stories/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Recalculate ROI if priority or points changed
      if (updates.priority || updates.storyPoints) {
        const story = await storage.getUserStory(parseInt(id));
        if (story) {
          updates.roiScore = await jiraAgent.calculateRoiScore({
            ...story,
            ...updates,
          });
        }
      }

      const updated = await storage.updateUserStory(parseInt(id), updates);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating user story:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to update story" });
    }
  });

  app.delete(
    "/api/jira/stories/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        await storage.deleteUserStory(parseInt(id));
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting user story:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to delete story" });
      }
    },
  );

  // Helper function
  function getComplexityLevel(score: number): string {
    if (score <= 2) return "low";
    if (score <= 4) return "medium";
    return "high";
  }

  // Story Estimation
  app.post(
    "/api/jira/stories/:id/estimate",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { previousEstimates, teamVelocity } = req.body;

        const story = await storage.getUserStory(parseInt(id));
        if (!story) {
          return res.status(404).json({ error: "Story not found" });
        }

        const estimation = await jiraAgent.estimateStoryPoints({
          story,
          previousEstimates,
          teamVelocity,
        });

        // Save estimation
        await storage.createStoryEstimation({
          storyId: parseInt(id),
          estimatedBy: req.session.userId,
          storyPoints: estimation.storyPoints,
          reasoning: estimation.reasoning,
          factors: estimation.factors,
        });

        // Update story with points
        // Update story with points
        await storage.updateUserStory(parseInt(id), {
          storyPoints: estimation.storyPoints,
          complexity: getComplexityLevel(estimation.factors.complexity),
          risk: getComplexityLevel(estimation.factors.risk),
          effort: getComplexityLevel(estimation.factors.effort),
        });

        res.json(estimation);
      } catch (error: any) {
        console.error("Error estimating story:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to estimate story" });
      }
    },
  );

  // Backlog Generation
  app.post(
    "/api/jira/backlog/generate",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { feature, projectId, context } = req.body;

        if (!feature) {
          return res
            .status(400)
            .json({ error: "Feature description is required" });
        }

        const result = await jiraAgent.generateBacklog({
          feature,
          projectId,
          context,
        });

        // If projectId is provided, save all generated stories
        if (projectId) {
          const savedStories = [];
          for (const storyData of result.stories) {
            const roiScore = await jiraAgent.calculateRoiScore(
              storyData as UserStory,
            );

            const saved = await storage.createUserStory({
              projectId: parseInt(projectId),
              ...storyData,
              roiScore,
            });

            savedStories.push(saved);
          }

          res.json({ stories: savedStories });
        } else {
          // Return generated stories without saving
          res.json({ stories: result.stories });
        }
      } catch (error: any) {
        console.error("Error generating backlog:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to generate backlog" });
      }
    },
  );

  // JIRA Sync
  app.post(
    "/api/jira/sync/push/:storyId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { storyId } = req.params;
        const { projectKey } = req.body;

        const integration = await storage.getJiraIntegration(
          req.session.userId,
        );
        if (!integration) {
          return res
            .status(400)
            .json({ error: "JIRA integration not configured" });
        }

        const story = await storage.getUserStory(parseInt(storyId));
        if (!story) {
          return res.status(404).json({ error: "Story not found" });
        }

        const jiraIssue = await jiraIntegration.createIssue(
          integration,
          story,
          projectKey,
        );

        // Update story with JIRA info
        await storage.updateUserStory(parseInt(storyId), {
          jiraIssueKey: jiraIssue.key,
          jiraIssueId: jiraIssue.id,
        });

        // Log sync
        await storage.createJiraSyncLog({
          integrationId: integration.id,
          syncType: "push",
          syncStatus: "success",
          itemsSynced: 1,
          syncData: { storyId, jiraIssueKey: jiraIssue.key },
        });

        res.json({ success: true, jiraIssueKey: jiraIssue.key });
      } catch (error: any) {
        console.error("Error pushing to JIRA:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to push to JIRA" });
      }
    },
  );

  app.post(
    "/api/jira/sync/pull/:projectId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { projectId } = req.params;
        const { projectKey } = req.body;

        const integration = await storage.getJiraIntegration(
          req.session.userId,
        );
        if (!integration) {
          return res
            .status(400)
            .json({ error: "JIRA integration not configured" });
        }

        await jiraIntegration.syncProjectIssues(
          integration,
          parseInt(projectId),
          projectKey,
        );

        res.json({ success: true });
      } catch (error: any) {
        console.error("Error pulling from JIRA:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to pull from JIRA" });
      }
    },
  );

  // Social Media API routes
  // Brand Profile routes
  app.get("/api/social-media/brand-profiles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const profiles = await storage.getSocialMediaBrandProfiles(userId);
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching brand profiles:", error);
      res.status(500).json({ message: "Failed to fetch brand profiles" });
    }
  });

  app.post("/api/social-media/brand-profiles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      // Force ownership server-side; never trust a client-supplied userId.
      const profileData = insertSocialMediaBrandProfileSchema.parse({
        ...req.body,
        userId,
      });
      const profile = await storage.createSocialMediaBrandProfile(profileData);
      res.json(profile);
    } catch (error: any) {
      console.error("Error creating brand profile:", error);
      res.status(400).json({
        message: "Failed to create brand profile",
        error: error.message,
      });
    }
  });

  app.put(
    "/api/social-media/brand-profiles/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const profile = await storage.updateSocialMediaBrandProfile(
          parseInt(req.params.id),
          req.body,
        );
        res.json(profile);
      } catch (error) {
        console.error("Error updating brand profile:", error);
        res.status(500).json({ message: "Failed to update brand profile" });
      }
    },
  );

  // Goal routes
  app.get("/api/social-media/goals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const goals = await storage.getSocialMediaGoals(userId);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.post("/api/social-media/goals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const goalData = insertSocialMediaGoalSchema.parse({
        ...req.body,
        userId,
      });
      const goal = await storage.createSocialMediaGoal(goalData);
      res.json(goal);
    } catch (error: any) {
      console.error("Error creating goal:", error);
      res.status(400).json({
        message: "Failed to create goal",
        error: error.message,
      });
    }
  });

  app.put(
    "/api/social-media/goals/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const goal = await storage.updateSocialMediaGoal(
          parseInt(req.params.id),
          req.body,
        );
        res.json(goal);
      } catch (error) {
        console.error("Error updating goal:", error);
        res.status(500).json({ message: "Failed to update goal" });
      }
    },
  );

  app.delete(
    "/api/social-media/goals/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        await storage.deleteSocialMediaGoal(parseInt(req.params.id));
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting goal:", error);
        res.status(500).json({ message: "Failed to delete goal" });
      }
    },
  );

  // Post routes
  app.get("/api/social-media/posts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const posts = await storage.getSocialMediaPosts(userId);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  app.get(
    "/api/social-media/posts/scheduled",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;
        const posts = await storage.getScheduledPosts(userId);
        res.json(posts);
      } catch (error) {
        console.error("Error fetching scheduled posts:", error);
        res.status(500).json({ message: "Failed to fetch scheduled posts" });
      }
    },
  );

  app.get(
    "/api/social-media/posts/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const post = await storage.getSocialMediaPost(parseInt(req.params.id));
        if (!post) {
          return res.status(404).json({ message: "Post not found" });
        }
        res.json(post);
      } catch (error) {
        console.error("Error fetching post:", error);
        res.status(500).json({ message: "Failed to fetch post" });
      }
    },
  );

  app.post("/api/social-media/posts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const postData = insertSocialMediaPostSchema.parse({
        ...req.body,
        userId,
        aiGenerated: true,
      });
      const post = await storage.createSocialMediaPost(postData);
      res.json(post);
    } catch (error: any) {
      console.error("Error creating post:", error);
      res.status(400).json({
        message: "Failed to create post",
        error: error.message,
      });
    }
  });

  app.put(
    "/api/social-media/posts/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const post = await storage.updateSocialMediaPost(
          parseInt(req.params.id),
          req.body,
        );
        res.json(post);
      } catch (error) {
        console.error("Error updating post:", error);
        res.status(500).json({ message: "Failed to update post" });
      }
    },
  );

  app.delete(
    "/api/social-media/posts/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        await storage.deleteSocialMediaPost(parseInt(req.params.id));
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).json({ message: "Failed to delete post" });
      }
    },
  );

  // Post Metrics routes
  app.get(
    "/api/social-media/posts/:postId/metrics",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const metrics = await storage.getSocialMediaPostMetrics(
          parseInt(req.params.postId),
        );
        res.json(metrics);
      } catch (error) {
        console.error("Error fetching post metrics:", error);
        res.status(500).json({ message: "Failed to fetch post metrics" });
      }
    },
  );

  app.post(
    "/api/social-media/posts/:postId/metrics",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const metricsData = insertSocialMediaPostMetricsSchema.parse({
          ...req.body,
          postId: parseInt(req.params.postId),
        });
        const metrics = await storage.createSocialMediaPostMetrics(metricsData);
        res.json(metrics);
      } catch (error: any) {
        console.error("Error creating post metrics:", error);
        res.status(400).json({
          message: "Failed to create post metrics",
          error: error.message,
        });
      }
    },
  );

  // Content Template routes
  app.get(
    "/api/social-media/templates",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;
        const templates = await storage.getSocialMediaContentTemplates(userId);
        res.json(templates);
      } catch (error) {
        console.error("Error fetching templates:", error);
        res.status(500).json({ message: "Failed to fetch templates" });
      }
    },
  );

  app.post(
    "/api/social-media/templates",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;
        const templateData = insertSocialMediaContentTemplateSchema.parse({
          ...req.body,
          userId,
        });
        const template =
          await storage.createSocialMediaContentTemplate(templateData);
        res.json(template);
      } catch (error: any) {
        console.error("Error creating template:", error);
        res.status(400).json({
          message: "Failed to create template",
          error: error.message,
        });
      }
    },
  );

  // Social Media AI Content Generation endpoint - ONLY CUSTOM CREWAI SCRIPTS
  app.post("/api/social-media/generate-content", isAuthenticated, apiLimiter, async (req: any, res) => {
    try {
      const {
        sourceContent,
        sourceType,
        platforms,
        brandProfileId,
        goalId,
        tone,
      } = req.body;

      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      // Get brand profile if specified — verify ownership before using it.
      let brandProfile = null;
      if (brandProfileId) {
        const candidate = await storage.getSocialMediaBrandProfile(brandProfileId);
        if (candidate && (!candidate.userId || candidate.userId === userId)) {
          brandProfile = candidate;
        } else if (candidate) {
          return res.status(404).json({ message: "Brand profile not found" });
        }
      }

      // Get goal if specified
      let goal = null;
      if (goalId) {
        goal = await storage.getSocialMediaGoal(goalId);
      }

      // ONLY USE CUSTOM CREWAI PYTHON SCRIPTS - NO OPENAI INTEGRATION
      console.log("[SOCIAL-MEDIA] Using ONLY custom CrewAI Python scripts");

      // Call your custom CrewAI service with your Python scripts
      const crewaiUrl = config.services.crewai.baseUrl;
      console.log(
        `[SOCIAL-MEDIA] Calling custom CrewAI service at: ${crewaiUrl}/generate`,
      );

      const topic = sourceContent || "social media content";
      const platform = platforms?.[0] || "Mastodon"; // Use first platform
      const toneStyle = tone || "professional";

      const response = await fetch(`${crewaiUrl}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: topic,
          platform: platform,
          tone: toneStyle,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `CrewAI service failed with status: ${response.status}`,
        );
      }

      const crewaiResult = await response.json();
      console.log(
        "[SOCIAL-MEDIA] Custom CrewAI scripts generated content successfully",
      );

      // Pass through the RAW response from your custom Python scripts
      console.log(
        "[SOCIAL-MEDIA] Returning raw CrewAI response with tasks_output and agents",
      );
      res.json(crewaiResult);
    } catch (error: any) {
      console.error("Error generating content:", error);
      res.status(500).json({
        message: "Failed to generate content",
        error: error.message,
      });
    }
  });

  // RGA Assistant API routes
  app.get("/api/rga/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      let settings = await storage.getRgaSettings(userId);

      // Create default settings if none exist
      if (!settings) {
        settings = await storage.createRgaSettings({
          userId,
          mode: "pre-funding",
          targetRgaPercentage: 40,
          weeklyCustomerHours: 20,
        });
      }

      res.json(settings);
    } catch (error) {
      console.error("Error fetching RGA settings:", error);
      res.status(500).json({ message: "Failed to fetch RGA settings" });
    }
  });

  app.put("/api/rga/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      let settings = await storage.getRgaSettings(userId);

      if (settings) {
        settings = await storage.updateRgaSettings(settings.id, req.body);
      } else {
        settings = await storage.createRgaSettings({
          userId,
          ...req.body,
        });
      }

      res.json(settings);
    } catch (error) {
      console.error("Error updating RGA settings:", error);
      res.status(500).json({ message: "Failed to update RGA settings" });
    }
  });

  app.get("/api/rga/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      console.log("[DEBUG] RGA tasks - userId:", userId);

      // Get user's tasks with RGA categories - this already includes project and assignee names
      const tasks = await storage.getTasksForUser(userId);
      console.log("[DEBUG] RGA tasks - found tasks:", tasks.length);

      // Enrich tasks with RGA categories
      const enrichedTasks = await Promise.all(
        tasks.map(async (task) => {
          const rgaCategory = await storage.getRgaCategory(task.id);
          return {
            ...task,
            rgaCategory: rgaCategory?.category || null,
            rgaConfidence: rgaCategory?.confidence || null,
            rgaReasoning: rgaCategory?.reasoning || null,
          };
        }),
      );

      console.log("[DEBUG] RGA tasks - enriched tasks:", enrichedTasks.length);
      res.json(enrichedTasks);
    } catch (error) {
      console.error("Error fetching RGA tasks:", error);
      res.status(500).json({ message: "Failed to fetch RGA tasks" });
    }
  });

  app.post(
    "/api/rga/tasks/:taskId/categorize",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const taskId = parseInt(req.params.taskId);
        const { category } = req.body;

        let rgaCategory = await storage.getRgaCategory(taskId);

        if (rgaCategory) {
          rgaCategory = await storage.updateRgaCategory(rgaCategory.id, {
            category,
          });
        } else {
          rgaCategory = await storage.createRgaCategory({
            taskId,
            category,
            confidence: 100, // Manual categorization has full confidence
            reasoning: "Manually categorized by user",
          });
        }

        res.json(rgaCategory);
      } catch (error) {
        console.error("Error categorizing task:", error);
        res.status(500).json({ message: "Failed to categorize task" });
      }
    },
  );

  app.get(
    "/api/rga/reports/current",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;
        const reports = await storage.getRgaReports(userId, 1);

        if (reports.length === 0) {
          // Calculate current week's report
          const tasks = await storage.getTasksForUser(userId);
          const categorizedTasks = await Promise.all(
            tasks.map(async (task) => {
              const rgaCategory = await storage.getRgaCategory(task.id);
              return {
                ...task,
                rgaCategory: rgaCategory?.category || null,
              };
            }),
          );

          const totalTasks = categorizedTasks.length;
          const rgaTasks = categorizedTasks.filter(
            (t) => t.rgaCategory === "rga",
          ).length;
          const nonRgaTasks = categorizedTasks.filter(
            (t) => t.rgaCategory === "non-rga",
          ).length;
          const strategicTasks = categorizedTasks.filter(
            (t) => t.rgaCategory === "strategic",
          ).length;

          res.json({
            rgaPercentage:
              totalTasks > 0 ? Math.round((rgaTasks / totalTasks) * 100) : 0,
            nonRgaPercentage:
              totalTasks > 0 ? Math.round((nonRgaTasks / totalTasks) * 100) : 0,
            strategicPercentage:
              totalTasks > 0
                ? Math.round((strategicTasks / totalTasks) * 100)
                : 0,
            totalHours: 40, // Default weekly hours
            recommendations: [],
          });
        } else {
          res.json(reports[0]);
        }
      } catch (error) {
        console.error("Error fetching RGA report:", error);
        res.status(500).json({ message: "Failed to fetch RGA report" });
      }
    },
  );

  app.post(
    "/api/rga/ai/auto-classify",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user?.dbUserId || req.user?.claims?.sub || "anonymous";
        const { tasks } = req.body;

        if (!tasks || tasks.length === 0) {
          return res.json({ classified: 0 });
        }

        // Use OpenAI to classify tasks
        const prompt = `Classify the following tasks into categories:
      - RGA (Revenue-Generating Activities): directly supports revenue growth (sales, marketing, customer onboarding, delivery)
      - Non-RGA: internal operations, legal, admin, technical debt, maintenance
      - Strategic: fundraising, partnerships, vision setting, long-term planning
      
      Tasks to classify:
      ${tasks.map((t: any) => `Task ID ${t.id}: "${t.name}" - ${t.description || "No description"}`).join("\n")}
      
      Return a JSON object with a "classifications" array containing objects with: taskId (number), category (string), confidence (0-100), reasoning (string)`;

        const classifyModel = await getModelForBudget(userId, "gpt-4o");
        const openai = (getAiClient() as any);
        const response = await openai.chat.completions.create({
          model: classifyModel,
          messages: [
            {
              role: "system",
              content:
                "You are an expert at categorizing startup tasks based on their revenue impact. Be strict about what counts as revenue-generating.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1000,
        });

        if (response.usage) {
          trackTokenUsage(userId, "rga-classify", classifyModel, response.usage).catch(() => {});
        }

        const classifications = JSON.parse(
          response.choices[0].message.content || '{"classifications":[]}',
        );

        // Save classifications to database
        let classifiedCount = 0;
        for (const classification of classifications.classifications || []) {
          const task = tasks.find((t: any) => t.id === classification.taskId);
          if (task) {
            let rgaCategory = await storage.getRgaCategory(task.id);

            if (rgaCategory) {
              await storage.updateRgaCategory(rgaCategory.id, {
                category: classification.category,
                confidence: classification.confidence,
                reasoning: classification.reasoning,
              });
            } else {
              await storage.createRgaCategory({
                taskId: task.id,
                category: classification.category,
                confidence: classification.confidence || 85,
                reasoning: classification.reasoning || "AI classified",
              });
            }
            classifiedCount++;
          }
        }

        res.json({ classified: classifiedCount });
      } catch (error) {
        console.error("Error auto-classifying tasks:", error);
        res.status(500).json({ message: "Failed to auto-classify tasks" });
      }
    },
  );

  app.post(
    "/api/rga/ai/recommendations",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims.sub;
        const settings = await storage.getRgaSettings(userId);
        const tasks = await storage.getTasksForUser(userId);

        // Enrich tasks with RGA categories
        const categorizedTasks = await Promise.all(
          tasks.map(async (task) => {
            const rgaCategory = await storage.getRgaCategory(task.id);
            return {
              ...task,
              rgaCategory: rgaCategory?.category || null,
            };
          }),
        );

        const rgaTasks = categorizedTasks.filter(
          (t) => t.rgaCategory === "rga",
        );
        const totalTasks = categorizedTasks.length;
        const rgaPercentage =
          totalTasks > 0 ? (rgaTasks.length / totalTasks) * 100 : 0;
        const targetPercentage = settings?.targetRgaPercentage || 40;

        // Generate AI recommendations using OpenAI
        const prompt = `You are an RGA (Revenue-Generating Activities) advisor for startups. 
      Current situation:
      - Startup mode: ${settings?.mode || "pre-funding"}
      - Current RGA percentage: ${rgaPercentage.toFixed(0)}%
      - Target RGA percentage: ${targetPercentage}%
      - Revenue channel: ${settings?.revenueChannel || "Not specified"}
      
      Based on this data, provide 3-4 specific, actionable recommendations to optimize revenue-generating activities.
      Format as JSON array with objects containing: title, description, impact (High/Medium/Low), effort (High/Medium/Low).`;

        const recsModel = await getModelForBudget(userId, "gpt-4o");
        const openai = (getAiClient() as any);
        const response = await openai.chat.completions.create({
          model: recsModel,
          messages: [
            {
              role: "system",
              content:
                "You are an expert startup advisor focused on optimizing revenue-generating activities.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 800,
        });

        if (response.usage) {
          trackTokenUsage(userId, "rga-recommendations", recsModel, response.usage).catch(() => {});
        }

        const recommendations = JSON.parse(
          response.choices[0].message.content || '{"recommendations":[]}',
        );

        res.json(recommendations);
      } catch (error) {
        console.error("Error generating AI recommendations:", error);
        // Fallback recommendations if AI fails
        res.json({
          recommendations: [
            {
              title: "Increase Customer Touchpoints",
              description:
                "Schedule more discovery calls and product demos to boost RGA percentage",
              impact: "High",
              effort: "Medium",
            },
            {
              title: "Batch Administrative Tasks",
              description:
                "Group non-RGA activities into dedicated time blocks to minimize context switching",
              impact: "Medium",
              effort: "Low",
            },
            {
              title: "Automate Routine Processes",
              description:
                "Use AI tools to handle repetitive tasks and free up time for customer interactions",
              impact: "High",
              effort: "High",
            },
          ],
        });
      }
    },
  );

  // AI Agents API routes
  app.get("/api/ai-agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      const agents = await storage.getAiAgents(userId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching AI agents:", error);
      res.status(500).json({ message: "Failed to fetch AI agents" });
    }
  });

  app.post("/api/ai-agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      const agentData = insertAiAgentSchema.parse({
        ...req.body,
        createdBy: userId,
      });
      const agent = await storage.createAiAgent(agentData);
      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating AI agent:", error);
      res.status(500).json({ message: "Failed to create AI agent" });
    }
  });

  app.get("/api/ai-agents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const agent = await storage.getAiAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "AI agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error fetching AI agent:", error);
      res.status(500).json({ message: "Failed to fetch AI agent" });
    }
  });

  app.patch("/api/ai-agents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const agent = await storage.updateAiAgent(id, updates);
      res.json(agent);
    } catch (error) {
      console.error("Error updating AI agent:", error);
      res.status(500).json({ message: "Failed to update AI agent" });
    }
  });

  app.delete("/api/ai-agents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAiAgent(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting AI agent:", error);
      res.status(500).json({ message: "Failed to delete AI agent" });
    }
  });

  app.get(
    "/api/projects/:projectId/ai-agents",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        const agents = await storage.getAiAgentsForProject(projectId);
        res.json(agents);
      } catch (error) {
        console.error("Error fetching project AI agents:", error);
        res.status(500).json({ message: "Failed to fetch project AI agents" });
      }
    },
  );

  // Deep project analysis endpoint (GET)
  app.get(
    "/api/projects/:id/deep-analysis",
    isAuthenticated,
    async (req: any, res) => {
      try {
        // Check if we have an OpenAI API key
        if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
          return res.status(500).json({
            message: "OpenAI API key is missing. Please add your API key.",
          });
        }

        const projectId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;
        const project = await storage.getProject(projectId);

        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        // Check if user has access to this project
        const isAuthorized = await storage.isUserAuthorized(projectId, userId);
        if (!isAuthorized) {
          return res.status(403).json({
            message: "You don't have permission to analyze this project",
          });
        }

        const tasks = await storage.getTasksByProjectId(projectId);
        const analysis = await deepProjectAnalysis(project, tasks);

        // Optionally store insights from analysis
        if (analysis.dimensions) {
          for (const dimension of analysis.dimensions) {
            if (dimension.score < 6) {
              // Only store insights for low-scoring dimensions
              await storage.createInsight({
                type: "deep-analysis",
                title: `${dimension.name} needs improvement`,
                description: dimension.assessment,
                severity: dimension.score < 4 ? "critical" : "warning",
                projectId: project.id,
                suggestedAction: dimension.recommendations.join("; "),
                isResolved: false,
              });
            }
          }

          // Store missing elements as insights
          if (analysis.criticalMissingElements) {
            for (const element of analysis.criticalMissingElements) {
              await storage.createInsight({
                type: "missing-element",
                title: `Missing: ${element}`,
                description: `Your project is missing a critical element: ${element}`,
                severity: "warning",
                projectId: project.id,
                suggestedAction: `Add "${element}" to your project plan`,
                isResolved: false,
              });
            }
          }
        }

        res.json(analysis);
      } catch (error) {
        console.error("Error performing deep project analysis:", error);
        res
          .status(500)
          .json({ message: "Failed to perform deep project analysis" });
      }
    },
  );
  // Subscription Management API Routes

  // Get all available subscription plans
  app.get("/api/subscription-plans", async (req, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ message: "Failed to fetch subscription plans" });
    }
  });

  // Get user's current subscription with plan details
  app.get("/api/user/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims?.sub;
      const userWithPlan = await storage.getUserWithPlan(userId);

      if (!userWithPlan) {
        return res.status(404).json({ message: "User not found" });
      }

      // If user has no plan, assign them to Free plan (ID: 1)
      if (!userWithPlan.planId || !userWithPlan.plan) {
        await storage.updateUserSubscription(userId, 1); // Free plan
        const updatedUser = await storage.getUserWithPlan(userId);
        return res.json(updatedUser);
      }

      res.json(userWithPlan);
    } catch (error) {
      console.error("Error fetching user subscription:", error);
      res.status(500).json({ message: "Failed to fetch user subscription" });
    }
  });

  // Check if user has access to a specific feature
  app.get(
    "/api/user/feature-access/:featureSlug",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims?.sub;
        const { featureSlug } = req.params;

        const hasAccess = await storage.checkUserFeatureAccess(
          userId,
          featureSlug,
        );
        res.json({ hasAccess, featureSlug });
      } catch (error) {
        console.error("Error checking feature access:", error);
        res.status(500).json({ message: "Failed to check feature access" });
      }
    },
  );

  // Check project creation limits for the current user
  app.get(
    "/api/user/project-limits",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims?.sub;

        const limitCheck = await storage.canUserCreateProject(userId);
        res.json(limitCheck);
      } catch (error) {
        console.error("Error checking project limits:", error);
        res.status(500).json({ message: "Failed to check project limits" });
      }
    },
  );

  // Update user's subscription plan
  app.post("/api/user/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims?.sub;
      const { planId } = req.body;

      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }

      // Verify the plan exists
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) {
        return res.status(404).json({ message: "Subscription plan not found" });
      }

      const updatedUser = await storage.updateUserSubscription(userId, planId);
      const userWithPlan = await storage.getUserWithPlan(userId);

      if (userWithPlan && (userWithPlan as any).password) {
        delete (userWithPlan as any).password;
      }
      res.json(userWithPlan);
    } catch (error) {
      console.error("Error updating user subscription:", error);
      res.status(500).json({ message: "Failed to update user subscription" });
    }
  });

  // Stripe Payment Integration
  
  // Get Stripe public key for frontend
  app.get("/api/stripe/config", (req, res) => {
    const publishableKey = process.env.VITE_STRIPE_PUBLIC_KEY;
    if (!publishableKey) {
      console.error("VITE_STRIPE_PUBLIC_KEY not configured");
      return res.status(500).json({ message: "Payment service not configured" });
    }
    res.json({ publishableKey });
  });

  // Create checkout session for subscription upgrade
  app.post(
    "/api/stripe/create-payment-intent",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims?.sub;
        const { planId } = req.body;

        if (!planId) {
          return res.status(400).json({ message: "Plan ID is required" });
        }

        // Get the subscription plan
        const plan = await storage.getSubscriptionPlan(planId);
        if (!plan) {
          return res
            .status(404)
            .json({ message: "Subscription plan not found" });
        }

        // Get user info for Stripe customer
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Check if Stripe is initialized
        if (!stripe) {
          console.error("Stripe not initialized");
          return res
            .status(500)
            .json({ message: "Payment service not configured" });
        }

        // Create checkout session with Stripe
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: plan.name,
                  description: plan.description,
                },
                unit_amount: Math.round(plan.price * 100), // Convert to cents
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${req.headers.origin}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}&plan=${planId}`,
          cancel_url: `${req.headers.origin}/pricing?cancelled=true`,
          customer_email: user.email,
          metadata: {
            userId,
            planId: planId.toString(),
            planName: plan.name,
          },
        });

        res.json({
          sessionId: session.id,
          amount: plan.price,
          planName: plan.name,
        });
      } catch (error) {
        console.error("Error creating checkout session:", error);
        res.status(500).json({ message: "Failed to create checkout session" });
      }
    },
  );

  // Handle successful payment and upgrade subscription
  app.post("/api/stripe/payment-success", async (req: any, res) => {
    try {
      const { session_id } = req.body;
      console.log("Processing payment success for session:", session_id);

      if (!session_id) {
        console.error("Payment success error: No session ID provided");
        return res.status(400).json({ message: "Session ID is required" });
      }

      // Check if Stripe is properly initialized
      if (!stripe) {
        console.error(
          "Payment success error: Stripe not initialized. Check STRIPE_SECRET_KEY",
        );
        return res
          .status(500)
          .json({ message: "Payment service not configured" });
      }

      // Retrieve the checkout session from Stripe
      console.log("Retrieving Stripe session:", session_id);
      const session = await stripe.checkout.sessions.retrieve(session_id);
      console.log("Session retrieved:", {
        id: session.id,
        payment_status: session.payment_status,
        metadata: session.metadata,
      });

      if (session.payment_status !== "paid") {
        console.error("Payment not completed, status:", session.payment_status);
        return res.status(400).json({ message: "Payment not completed" });
      }

      const userId = session.metadata?.userId;
      const planId = parseInt(session.metadata?.planId || "0");

      console.log("Processing for user:", userId, "plan:", planId);

      if (!userId || !planId) {
        console.error("Missing metadata - userId:", userId, "planId:", planId);
        return res
          .status(400)
          .json({ message: "Missing user or plan information" });
      }

      // Update user's subscription
      // The updateUserSubscription method handles both creating and updating
      await storage.updateUserSubscription(
        userId,
        planId,
        session.customer as string | undefined, // Stripe customer ID if available
        session.subscription as string | undefined, // Stripe subscription ID if available
      );
      console.log("Subscription updated for user:", userId, "to plan:", planId);

      res.json({
        success: true,
        message: "Subscription upgraded successfully",
      });
    } catch (error: any) {
      console.error("Error processing payment success:", error);
      console.error("Error details:", {
        message: error.message,
        type: error.type,
        statusCode: error.statusCode,
        raw: error.raw,
      });

      // Check for specific Stripe errors
      if (error.type === "StripeInvalidRequestError") {
        return res.status(400).json({
          message: "Invalid payment session",
          error: error.message,
        });
      }

      res.status(500).json({
        message: "Failed to process payment",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // Stripe webhook for subscription lifecycle events
  app.post("/api/stripe/webhook", async (req: any, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe) {
      console.error("[Stripe Webhook] Stripe not initialized");
      return res.status(500).json({ error: "Stripe not configured" });
    }

    let event: any;

    if (webhookSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error("[Stripe Webhook] Signature verification failed:", err.message);
        return res.status(400).json({ error: "Webhook signature verification failed" });
      }
    } else {
      try {
        event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        if (Buffer.isBuffer(req.body)) {
          event = JSON.parse(req.body.toString());
        }
      } catch {
        return res.status(400).json({ error: "Invalid payload" });
      }
      console.warn("[Stripe Webhook] No webhook secret configured — processing without signature verification");
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    try {
      switch (event.type) {
        case "customer.subscription.deleted":
        case "customer.subscription.updated": {
          const subscription = event.data.object;
          const status = subscription.status;
          const stripeCustomerId = subscription.customer;

          console.log(`[Stripe Webhook] Subscription ${event.type}: status=${status}, customer=${stripeCustomerId}`);

          if (status === "canceled" || status === "unpaid" || status === "past_due") {
            const allUsers = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId));

            if (allUsers.length > 0) {
              const user = allUsers[0];
              console.log(`[Stripe Webhook] Downgrading user ${user.id} to Free plan`);

              const freePlan = await storage.getSubscriptionPlan(1);
              if (freePlan) {
                await storage.updateUserSubscription(user.id, freePlan.id);

                const { ensureTokenBudget } = await import("./services/token-tracker");
                await ensureTokenBudget(user.id, "free");

                console.log(`[Stripe Webhook] User ${user.id} downgraded to Free plan successfully`);
              }
            } else {
              console.log(`[Stripe Webhook] No user found for Stripe customer ${stripeCustomerId}`);
            }
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const stripeCustomerId = invoice.customer;
          console.log(`[Stripe Webhook] Payment failed for customer ${stripeCustomerId}`);
          break;
        }

        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("[Stripe Webhook] Error processing event:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Create subscription for recurring billing
  app.post(
    "/api/stripe/create-subscription",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims?.sub;
        const { planId } = req.body;

        if (!planId) {
          return res.status(400).json({ message: "Plan ID is required" });
        }

        // Get user and plan details
        const user = await storage.getUser(userId);
        const plan = await storage.getSubscriptionPlan(planId);

        if (!user || !plan) {
          return res.status(404).json({ message: "User or plan not found" });
        }

        // Create or get Stripe customer
        let stripeCustomerId = user.stripeCustomerId;

        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            email: user.email || "",
            metadata: { userId },
          });
          stripeCustomerId = customer.id;
        }

        // For now, we'll handle subscriptions as one-time payments
        // In a real app, you'd create actual recurring subscriptions
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(plan.price * 100),
          currency: "usd",
          customer: stripeCustomerId,
          metadata: {
            userId,
            planId: planId.toString(),
            planName: plan.name,
            type: "subscription",
          },
        });

        // Update user with Stripe customer ID
        await storage.updateUserSubscription(
          userId,
          user.planId || 1,
          stripeCustomerId,
        );

        res.json({
          clientSecret: paymentIntent.client_secret,
          amount: plan.price,
          planName: plan.name,
          customerId: stripeCustomerId,
        });
      } catch (error) {
        console.error("Error creating subscription:", error);
        res.status(500).json({ message: "Failed to create subscription" });
      }
    },
  );

  // ===== PRIORITISOR AGENT V2 ENDPOINTS =====

  // Get tasks for prioritization V2
  app.get(
    "/api/v2/prioritisor/tasks",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims?.sub;
        const { projectId } = req.query;

        console.log(
          `[Prioritisor V2] Fetching tasks for user: ${userId}, projectId: ${projectId}`,
        );

        let tasks = [];

        if (projectId) {
          // Check project access
          const hasAccess = await storage.isUserAuthorized(
            parseInt(projectId),
            userId,
          );
          if (!hasAccess) {
            return res
              .status(403)
              .json({ message: "Access denied to this project" });
          }
          tasks = await storage.getTasksByProjectId(parseInt(projectId));
        } else {
          // Get all accessible tasks
          const userProjects = await storage.getProjectsForUser(userId);
          const allTasks = await storage.getAllTasks();
          tasks = allTasks.filter(
            (task) =>
              task.projectId &&
              userProjects.some((p) => p.id === task.projectId),
          );
        }

        console.log(`[Prioritisor V2] Returning ${tasks.length} tasks`);
        res.json({ tasks });
      } catch (error) {
        console.error("Error fetching tasks for prioritization V2:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch tasks", error: error.message });
      }
    },
  );

  // Analyze and prioritize tasks using AI
  app.post(
    "/api/v2/prioritisor/analyze",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims?.sub;
        const { tasks, weightingProfile, projectId } = req.body;

        console.log(`[Prioritisor V2] Received request to analyze tasks`);
        console.log(
          `[Prioritisor V2] Tasks received:`,
          tasks ? tasks.length : "none",
        );
        console.log(`[Prioritisor V2] Weighting profile:`, weightingProfile);

        if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
          console.log(`[Prioritisor V2] OpenAI API key is missing`);
          return res.status(500).json({
            message:
              "OpenAI API key is missing. Please add your API key to enable AI prioritization.",
            error: "MISSING_API_KEY",
          });
        }

        if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
          console.log(`[Prioritisor V2] No valid tasks to analyze`);
          return res.json({
            prioritizedTasks: [],
            message: "No tasks to prioritize",
          });
        }

        console.log(`[Prioritisor V2] Analyzing ${tasks.length} tasks with AI`);
        console.log(`[Prioritisor V2] Sample task:`, tasks[0]);

        // Import and use the prioritization agent
        const { prioritizeTasksV2 } = await import("./prioritisor-agent-v2");

        const prioritizedTasks = await prioritizeTasksV2(
          tasks,
          weightingProfile,
        );

        console.log(
          `[Prioritisor V2] Successfully analyzed ${prioritizedTasks.length} tasks`,
        );

        res.json({
          prioritizedTasks,
          message: `Successfully prioritized ${prioritizedTasks.length} tasks`,
        });
      } catch (error) {
        console.error("Error analyzing tasks with AI:", error);
        res
          .status(500)
          .json({ message: "Failed to analyze tasks", error: error.message });
      }
    },
  );

  // Save prioritized tasks to database
  app.post(
    "/api/v2/prioritisor/save",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims?.sub;
        const { prioritizedTasks, projectId } = req.body;

        if (!prioritizedTasks || prioritizedTasks.length === 0) {
          return res
            .status(400)
            .json({ message: "No prioritized tasks to save" });
        }

        console.log(
          `[Prioritisor V2] Saving ${prioritizedTasks.length} task priorities`,
        );

        // Save or update priority scores for each task
        const savedCount = 0;
        for (const task of prioritizedTasks) {
          try {
            const scoreData = {
              taskId: task.id,
              priorityScore: Math.round(task.priorityScore * 10), // Store as 1-100
              roiLevel: task.roiLevel,
              effortLevel: task.effortLevel,
              urgencyLevel: task.urgencyLevel,
              strategicFit: task.strategicFit,
              recommendation: task.recommendation,
              confidence: task.confidence || 85,
              weightingProfile: "custom",
              analysisData: {
                timestamp: new Date().toISOString(),
              },
              generatedBy: userId,
            };

            // Check if score exists
            const existingScore = await storage.getTaskPriorityScore(task.id);
            if (existingScore) {
              await storage.updateTaskPriorityScore(task.id, scoreData);
            } else {
              await storage.createTaskPriorityScore(scoreData);
            }
          } catch (error) {
            console.warn(`Failed to save priority for task ${task.id}:`, error);
          }
        }

        res.json({
          message: `Successfully saved priorities for ${prioritizedTasks.length} tasks`,
          savedCount: prioritizedTasks.length,
        });
      } catch (error) {
        console.error("Error saving prioritized tasks:", error);
        res
          .status(500)
          .json({ message: "Failed to save priorities", error: error.message });
      }
    },
  );

  // ===== ORIGINAL PRIORITISOR AGENT ENDPOINTS =====

  // Get tasks for prioritization
  app.get("/api/prioritisor/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims?.sub;
      const { projectId } = req.query;

      console.log(
        `[Prioritisor] Fetching tasks for user: ${userId}, projectId: ${projectId}`,
      );

      let tasks = [];
      if (projectId) {
        // Get tasks for specific project
        const project = await storage.getProject(parseInt(projectId));
        console.log(
          `[Prioritisor] Project found:`,
          project ? `${project.name} (ID: ${project.id})` : "null",
        );

        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        // Check if user has access to this project
        const hasAccess = await storage.isUserAuthorized(
          parseInt(projectId),
          userId,
        );
        console.log(
          `[Prioritisor] User access to project ${projectId}:`,
          hasAccess,
        );

        if (!hasAccess) {
          return res
            .status(403)
            .json({ message: "Access denied to this project" });
        }

        tasks = await storage.getTasksByProjectId(parseInt(projectId));
        console.log(
          `[Prioritisor] Tasks found for project ${projectId}:`,
          tasks.length,
        );
      } else {
        // Get all tasks for user's projects
        const userProjects = await storage.getProjectsForUser(userId);
        console.log(`[Prioritisor] User projects found:`, userProjects.length);

        const allTasks = await storage.getAllTasks();
        console.log(`[Prioritisor] All tasks in system:`, allTasks.length);

        tasks = allTasks.filter(
          (task) =>
            task.projectId && userProjects.some((p) => p.id === task.projectId),
        );
        console.log(`[Prioritisor] User's tasks found:`, tasks.length);
      }

      // Get existing priority scores
      const taskIds = tasks.map((t) => t.id);
      console.log(
        `[Prioritisor] Getting priority scores for ${taskIds.length} tasks`,
      );

      const priorityScores = await storage.getTaskPriorityScores(taskIds);
      console.log(
        `[Prioritisor] Priority scores found:`,
        priorityScores.length,
      );

      // Combine tasks with their priority scores
      const tasksWithPriority = tasks.map((task) => ({
        ...task,
        priorityScore:
          priorityScores.find((ps) => ps.taskId === task.id) || null,
      }));

      console.log(
        `[Prioritisor] Returning ${tasksWithPriority.length} tasks with priority data`,
      );
      res.json({ tasks: tasksWithPriority });
    } catch (error) {
      console.error("Error fetching tasks for prioritization:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch tasks", error: error.message });
    }
  });

  // Prioritize tasks using AI
  app.post(
    "/api/prioritisor/prioritize",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims?.sub;
        const { projectId, weightingProfile, contextInfo } = req.body;

        if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
          return res.status(500).json({
            message:
              "OpenAI API key is missing. Please add your API key to enable AI prioritization.",
            error: "MISSING_API_KEY",
          });
        }

        // Get tasks
        let tasks = [];
        if (projectId) {
          const hasAccess = await storage.isUserAuthorized(projectId, userId);
          if (!hasAccess) {
            return res
              .status(403)
              .json({ message: "Access denied to this project" });
          }
          tasks = await storage.getTasksByProjectId(projectId);
        } else {
          const userProjects = await storage.getProjectsForUser(userId);
          const allTasks = await storage.getAllTasks();
          tasks = allTasks.filter(
            (task) =>
              task.projectId &&
              userProjects.some((p) => p.id === task.projectId),
          );
        }

        if (tasks.length === 0) {
          return res.json({
            analyses: [],
            message: "No tasks found to prioritize",
          });
        }

        // Import and use the prioritization agent
        const { prioritizeTasksWithGPT } = await import("./prioritisor-agent");

        const analyses = await prioritizeTasksWithGPT(
          tasks,
          weightingProfile,
          contextInfo,
        );

        // Save priority scores to database
        const savedScores = [];
        for (const analysis of analyses) {
          const taskId = parseInt(analysis.task_id);
          const scoreData = {
            taskId,
            priorityScore: Math.round(analysis.priority_score * 10), // Store as 1-100 for precision
            roiLevel: analysis.roi,
            effortLevel: analysis.effort,
            urgencyLevel: analysis.urgency,
            strategicFit: analysis.strategic_fit,
            recommendation: analysis.recommendation,
            confidence: analysis.confidence,
            weightingProfile: weightingProfile?.profileName || "balanced",
            analysisData: {
              reasoning: analysis.reasoning,
              rawScore: analysis.priority_score,
              timestamp: new Date().toISOString(),
            },
            generatedBy: userId,
          };

          try {
            // Try to update existing score first
            const existingScore = await storage.getTaskPriorityScore(taskId);
            if (existingScore) {
              const updatedScore = await storage.updateTaskPriorityScore(
                taskId,
                scoreData,
              );
              savedScores.push(updatedScore);
            } else {
              const newScore = await storage.createTaskPriorityScore(scoreData);
              savedScores.push(newScore);
            }
          } catch (scoreError) {
            console.warn(
              `Failed to save priority score for task ${taskId}:`,
              scoreError,
            );
          }
        }

        res.json({
          analyses,
          savedScores,
          message: `Successfully prioritized ${analyses.length} tasks`,
        });
      } catch (error) {
        console.error("Error in task prioritization:", error);
        res.status(500).json({
          message: "Failed to prioritize tasks",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Get/Set user weighting preferences
  app.get(
    "/api/prioritisor/preferences",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims?.sub;
        const { projectId } = req.query;

        const preferences = await storage.getPriorityWeightingPreference(
          userId,
          projectId ? parseInt(projectId) : undefined,
        );

        if (!preferences) {
          // Return default preferences
          res.json({
            roiWeight: 25,
            effortWeight: 25,
            urgencyWeight: 25,
            strategicWeight: 25,
            profileName: "Balanced",
          });
        } else {
          res.json(preferences);
        }
      } catch (error) {
        console.error("Error fetching priority preferences:", error);
        res.status(500).json({ message: "Failed to fetch preferences" });
      }
    },
  );

  app.post(
    "/api/prioritisor/preferences",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims?.sub;
        const {
          projectId,
          roiWeight,
          effortWeight,
          urgencyWeight,
          strategicWeight,
          profileName,
        } = req.body;

        // Validate weights sum to 100
        const totalWeight =
          roiWeight + effortWeight + urgencyWeight + strategicWeight;
        if (Math.abs(totalWeight - 100) > 1) {
          return res.status(400).json({
            message: "Weights must sum to 100%",
          });
        }

        const preferenceData = {
          userId,
          projectId: projectId || null,
          roiWeight,
          effortWeight,
          urgencyWeight,
          strategicWeight,
          profileName: profileName || "Custom",
        };

        // Check if preferences already exist
        const existing = await storage.getPriorityWeightingPreference(
          userId,
          projectId,
        );

        let preferences;
        if (existing) {
          preferences = await storage.updatePriorityWeightingPreference(
            existing.id,
            preferenceData,
          );
        } else {
          preferences =
            await storage.createPriorityWeightingPreference(preferenceData);
        }

        res.json(preferences);
      } catch (error) {
        console.error("Error saving priority preferences:", error);
        res.status(500).json({ message: "Failed to save preferences" });
      }
    },
  );

  // Update task priority from Prioritisor recommendations
  app.patch(
    "/api/prioritisor/tasks/:taskId/priority",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.dbUserId || req.user.claims?.sub;
        const taskId = parseInt(req.params.taskId);
        const { priority } = req.body;

        // Validate priority value
        if (!["low", "medium", "high"].includes(priority)) {
          return res.status(400).json({ message: "Invalid priority value" });
        }

        // Get task and verify access
        const task = await storage.getTask(taskId);
        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }

        if (task.projectId) {
          const hasAccess = await storage.isUserAuthorized(
            task.projectId,
            userId,
          );
          if (!hasAccess) {
            return res
              .status(403)
              .json({ message: "Access denied to this task" });
          }
        }

        // Update task priority
        const updatedTask = await storage.updateTask(taskId, { priority });

        res.json(updatedTask);
      } catch (error) {
        console.error("Error updating task priority:", error);
        res.status(500).json({ message: "Failed to update task priority" });
      }
    },
  );
  app.get(
    "/api/projects/:id/deep-analysis",
    isAuthenticated,
    async (req: any, res) => {
      try {
        // Check if we have an OpenAI API key
        if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
          return res.status(500).json({
            message: "OpenAI API key is missing. Please add your API key.",
          });
        }

        const projectId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;
        const project = await storage.getProject(projectId);

        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        // Check if user has access to this project
        const isAuthorized = await storage.isUserAuthorized(projectId, userId);
        if (!isAuthorized) {
          return res.status(403).json({
            message: "You don't have permission to analyze this project",
          });
        }

        const tasks = await storage.getTasksByProjectId(projectId);
        const analysis = await deepProjectAnalysis(project, tasks);

        // Optionally store insights from analysis
        if (analysis.dimensions) {
          for (const dimension of analysis.dimensions) {
            if (dimension.score < 6) {
              // Only store insights for low-scoring dimensions
              await storage.createInsight({
                type: "deep-analysis",
                title: `${dimension.name} needs improvement`,
                description: dimension.assessment,
                severity: dimension.score < 4 ? "critical" : "warning",
                projectId: project.id,
                suggestedAction: dimension.recommendations.join("; "),
                isResolved: false,
              });
            }
          }

          // Store missing elements as insights
          if (analysis.criticalMissingElements) {
            for (const element of analysis.criticalMissingElements) {
              await storage.createInsight({
                type: "missing-element",
                title: `Missing: ${element}`,
                description: `Your project is missing a critical element: ${element}`,
                severity: "warning",
                projectId: project.id,
                suggestedAction: `Add "${element}" to your project plan`,
                isResolved: false,
              });
            }
          }
        }

        res.json(analysis);
      } catch (error) {
        console.error("Error performing deep project analysis:", error);
        res
          .status(500)
          .json({ message: "Failed to perform deep project analysis" });
      }
    },
  );

  // ===== AI PROJECT PLANNER ENDPOINTS =====

  // Generate project plan using AI
  app.post(
    "/api/agent/generate-plan",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { prompt, outputFormat, depth } = req.body;

        if (!prompt || !prompt.trim()) {
          return res.status(400).json({
            message: "Project description is required",
          });
        }

        if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
          return res.status(500).json({
            message:
              "OpenAI API key is missing. Please add your API key to enable AI project planning.",
            error: "MISSING_API_KEY",
          });
        }

        // Import and use the project planner
        const { generateProjectPlan } = await import("./ai-project-planner");

        const plan = await generateProjectPlan({
          prompt,
          outputFormat: outputFormat || "structured",
          depth: depth || "detailed",
        });

        res.json({
          plan,
          message: "Project plan generated successfully",
        });
      } catch (error) {
        console.error("Error generating project plan:", error);
        res.status(500).json({
          message: "Failed to generate project plan",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Social Media OAuth and Publishing Routes

  // LinkedIn OAuth
  app.get("/api/social/linkedin/login", (req: any, res) => {
    const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;

    if (!LINKEDIN_CLIENT_ID) {
      return res
        .status(500)
        .json({ error: "LinkedIn Client ID not configured" });
    }

    // Use APP_PROTOCOL env (or HTTPS in production) — host-string sniffing
    // for a specific PaaS removed.
    const host = req.get("host");
    const protocol = process.env.APP_PROTOCOL ||
      (process.env.NODE_ENV === "production" ? "https" : req.protocol);
    const baseUrl = `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/api/social/linkedin/callback`;

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=w_member_social&state=linkedin_oauth`;

    console.log("LinkedIn OAuth URL:", authUrl);
    res.redirect(authUrl);
  });

  app.get("/api/social/linkedin/callback", async (req: any, res) => {
    try {
      const { code, state, error, error_description } = req.query;

      console.log("LinkedIn callback received:", {
        code: !!code,
        state,
        error,
        error_description,
      });

      if (error) {
        console.error("LinkedIn OAuth error:", error, error_description);
        return res.redirect(
          "/social-media-agent?error=" +
            encodeURIComponent(error_description || error),
        );
      }

      if (!code) {
        console.error("No authorization code received");
        return res.redirect("/social-media-agent?error=no_code");
      }

      const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
      const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;

      if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
        console.error("LinkedIn credentials not configured");
        return res.redirect("/social-media-agent?error=config_missing");
      }

      // Use APP_PROTOCOL env (or HTTPS in production) — host-string sniffing
      // for a specific PaaS removed.
      const host = req.get("host");
      const protocol = process.env.APP_PROTOCOL ||
        (process.env.NODE_ENV === "production" ? "https" : req.protocol);
      const baseUrl = `${protocol}://${host}`;
      const redirectUri = `${baseUrl}/api/social/linkedin/callback`;

      console.log("Exchanging code for token with redirect URI:", redirectUri);

      // Exchange code for access token
      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: redirectUri,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      });

      console.log("Token request params:", Object.fromEntries(tokenParams));

      const tokenResponse = await fetch(
        "https://www.linkedin.com/oauth/v2/accessToken",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: tokenParams,
        },
      );

      const tokenData = await tokenResponse.json();
      console.log("Token response status:", tokenResponse.status);
      console.log(
        "Token response headers:",
        Object.fromEntries(tokenResponse.headers),
      );

      if (!tokenResponse.ok) {
        console.error("LinkedIn token exchange failed:", {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          body: tokenData,
        });
      } else {
        console.log("LinkedIn token exchange successful:", {
          hasAccessToken: !!tokenData.access_token,
          tokenType: tokenData.token_type,
          expiresIn: tokenData.expires_in,
        });
      }

      if (tokenData.access_token) {
        // Store the access token in session
        req.session.linkedinAccessToken = tokenData.access_token;

        // Get user info for storage using OIDC endpoint
        const userResponse = await fetch(
          "https://api.linkedin.com/v2/userinfo",
          {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
            },
          },
        );

        const userData = await userResponse.json();

        // Store LinkedIn account info if user is authenticated
        if (req.isAuthenticated && req.isAuthenticated() && req.user) {
          const userId = req.user.dbUserId || req.user.claims.sub;

          try {
            await storage.createSocialMediaAccount({
              userId,
              platform: "linkedin",
              accountId: userData.sub,
              accountName: `${userData.given_name} ${userData.family_name}`,
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
              tokenExpiresAt: tokenData.expires_in
                ? new Date(Date.now() + tokenData.expires_in * 1000)
                : null,
              isActive: true,
            });
          } catch (error) {
            console.error("Error storing LinkedIn account:", error);
          }
        }

        // Redirect back to the social media agent page
        console.log("LinkedIn authentication successful, redirecting...");
        res.redirect("/social-media-agent?linked=linkedin");
      } else {
        console.error("Failed to get LinkedIn access token:", {
          tokenData,
          hasAccessToken: !!tokenData.access_token,
          errorField: tokenData.error,
          errorDescription: tokenData.error_description,
        });
        const errorMsg =
          tokenData.error_description || tokenData.error || "token_failed";
        res.redirect(
          "/social-media-agent?error=" + encodeURIComponent(errorMsg),
        );
      }
    } catch (error) {
      console.error("LinkedIn OAuth error:", error);
      res.redirect("/social-media-agent?error=oauth_failed");
    }
  });

  // Twitter OAuth (using OAuth 2.0 PKCE)
  app.get("/api/social/twitter/login", (req: any, res) => {
    const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;

    if (!TWITTER_CLIENT_ID) {
      return res.status(500).json({ error: "Twitter OAuth not configured" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${baseUrl}/api/social/twitter/callback`;

    // Generate PKCE challenge
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    // Store code verifier in session
    req.session.twitterCodeVerifier = codeVerifier;

    const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${TWITTER_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=tweet.read%20tweet.write%20users.read%20offline.access&state=state&code_challenge=${codeChallenge}&code_challenge_method=S256`;

    res.redirect(authUrl);
  });

  app.get("/api/social/twitter/callback", async (req: any, res) => {
    try {
      const { code } = req.query;
      const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
      const codeVerifier = req.session.twitterCodeVerifier;

      if (!TWITTER_CLIENT_ID || !codeVerifier) {
        return res
          .status(400)
          .json({ error: "Missing Twitter OAuth configuration" });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const redirectUri = `${baseUrl}/api/social/twitter/callback`;

      // Exchange code for access token
      const tokenResponse = await fetch(
        "https://api.twitter.com/2/oauth2/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: code as string,
            redirect_uri: redirectUri,
            client_id: TWITTER_CLIENT_ID,
            code_verifier: codeVerifier,
          }),
        },
      );

      const tokenData = await tokenResponse.json();

      if (tokenData.access_token) {
        req.session.twitterAccessToken = tokenData.access_token;

        // Get user info
        const userResponse = await fetch("https://api.twitter.com/2/users/me", {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        });

        const userData = await userResponse.json();

        // Store Twitter account info if user is authenticated
        if (
          req.isAuthenticated &&
          req.isAuthenticated() &&
          req.user &&
          userData.data
        ) {
          const userId = req.user.dbUserId || req.user.claims.sub;

          try {
            await storage.createSocialMediaAccount({
              userId,
              platform: "twitter",
              accountId: userData.data.id,
              accountName: userData.data.username,
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
              tokenExpiresAt: tokenData.expires_in
                ? new Date(Date.now() + tokenData.expires_in * 1000 * 24) // Extend by 24x (approx 48h instead of 2h)
                : null,
              isActive: true,
            });
          } catch (error) {
            console.error("Error storing Twitter account:", error);
          }
        }

        res.redirect("/social-media-agent?linked=twitter");
      } else {
        res.status(400).json({ error: "Failed to get access token" });
      }
    } catch (error) {
      console.error("Twitter OAuth error:", error);
      res.status(500).json({ error: "OAuth process failed" });
    }
  });

  // Facebook OAuth
  app.get("/api/social/facebook/login", (req: any, res) => {
    const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;

    if (!FACEBOOK_APP_ID) {
      return res.status(500).json({ error: "Facebook OAuth not configured" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${baseUrl}/api/social/facebook/callback`;

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=pages_manage_posts,pages_read_engagement&response_type=code`;

    res.redirect(authUrl);
  });

  app.get("/api/social/facebook/callback", async (req: any, res) => {
    try {
      const { code } = req.query;
      const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
      const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

      if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
        return res
          .status(400)
          .json({ error: "Missing Facebook OAuth configuration" });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const redirectUri = `${baseUrl}/api/social/facebook/callback`;

      // Exchange code for access token
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`,
      );

      const tokenData = await tokenResponse.json();

      if (tokenData.access_token) {
        req.session.facebookAccessToken = tokenData.access_token;

        // Get user info
        const userResponse = await fetch(
          `https://graph.facebook.com/me?access_token=${tokenData.access_token}`,
        );
        const userData = await userResponse.json();

        // Store Facebook account info if user is authenticated
        if (req.isAuthenticated && req.isAuthenticated() && req.user) {
          const userId = req.user.dbUserId || req.user.claims.sub;

          try {
            await storage.createSocialMediaAccount({
              userId,
              platform: "facebook",
              accountId: userData.id,
              accountName: userData.name,
              accessToken: tokenData.access_token,
              refreshToken: null,
              tokenExpiresAt: tokenData.expires_in
                ? new Date(Date.now() + tokenData.expires_in * 1000)
                : null,
              isActive: true,
            });
          } catch (error) {
            console.error("Error storing Facebook account:", error);
          }
        }

        res.redirect("/social-media-agent?linked=facebook");
      } else {
        res.status(400).json({ error: "Failed to get access token" });
      }
    } catch (error) {
      console.error("Facebook OAuth error:", error);
      res.status(500).json({ error: "OAuth process failed" });
    }
  });

  // Instagram OAuth (uses Facebook OAuth)
  app.get("/api/social/instagram/login", (req: any, res) => {
    const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;

    if (!FACEBOOK_APP_ID) {
      return res.status(500).json({
        error: "Instagram OAuth not configured (requires Facebook app)",
      });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${baseUrl}/api/social/instagram/callback`;

    const authUrl = `https://www.facebook.com/v24.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=instagram_basic,instagram_content_publish&response_type=code`;

    res.redirect(authUrl);
  });

  app.get("/api/social/instagram/callback", async (req: any, res) => {
    try {
      const { code } = req.query;
      const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
      const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

      if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
        return res
          .status(400)
          .json({ error: "Missing Instagram OAuth configuration" });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const redirectUri = `${baseUrl}/api/social/instagram/callback`;

      // Exchange code for access token
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`,
      );

      const tokenData = await tokenResponse.json();

      if (tokenData.access_token) {
        req.session.instagramAccessToken = tokenData.access_token;

        // Get Instagram account info
        const accountsResponse = await fetch(
          `https://graph.facebook.com/me/accounts?access_token=${tokenData.access_token}`,
        );
        const accountsData = await accountsResponse.json();

        // Store Instagram account info if user is authenticated
        if (req.isAuthenticated && req.isAuthenticated() && req.user) {
          const userId = req.user.dbUserId || req.user.claims.sub;

          try {
            await storage.createSocialMediaAccount({
              userId,
              platform: "instagram",
              accountId: accountsData.data?.[0]?.id || "unknown",
              accountName: accountsData.data?.[0]?.name || "Instagram User",
              accessToken: tokenData.access_token,
              refreshToken: null,
              tokenExpiresAt: tokenData.expires_in
                ? new Date(Date.now() + tokenData.expires_in * 1000)
                : null,
              isActive: true,
            });
          } catch (error) {
            console.error("Error storing Instagram account:", error);
          }
        }

        res.redirect("/social-media-agent?linked=instagram");
      } else {
        res.status(400).json({ error: "Failed to get access token" });
      }
    } catch (error) {
      console.error("Instagram OAuth error:", error);
      res.status(500).json({ error: "OAuth process failed" });
    }
  });

  app.post("/api/social/linkedIn/publish", async (req: any, res) => {
    const userId = req.user?.dbUserId || req.user?.claims?.sub;
    const content = req.body?.content;

    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (!content || content.trim() === "") {
      return res
        .status(400)
        .json({ success: false, error: "Content is required" });
    }

    try {
      // Check for LinkedIn access token from database or session
      let accessToken = req.body?.access_token;

      if (!accessToken) {
        // Try to get from database first
        const accounts = await storage.getSocialMediaAccounts(userId);
        const linkedinAccount = accounts.find(
          (acc) => acc.platform === "linkedin",
        );

        if (linkedinAccount && linkedinAccount.accessToken) {
          accessToken = linkedinAccount.accessToken;
        } else {
          // Fallback to session (for newly authenticated users)
          accessToken = req.session?.linkedinAccessToken;
        }
      }

      if (!accessToken) {
        return res.status(401).json({
          success: false,
          error: "LinkedIn account not connected. Please authenticate first.",
        });
      }

      // STEP 1: Get the LinkedIn user URN using OIDC endpoint
      const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const me = await meRes.json();
      const authorURN = `urn:li:person:${me.sub}`;

      if (!me.sub) {
        return res
          .status(500)
          .json({ success: false, error: "Unable to get LinkedIn user ID" });
      }

      // STEP 2: Publish the post
      const postPayload = {
        author: authorURN,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      };

      const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postPayload),
      });

      const postResult = await postRes.json();

      if (!postRes.ok) {
        console.error("LinkedIn post failed:", postResult);
        return res.status(500).json({
          success: false,
          error: "Failed to publish post to LinkedIn",
        });
      }

      console.log("✅ Successfully posted to LinkedIn:", postResult);
      res.json({ success: true, data: postResult });
    } catch (err) {
      console.error("❌ Publish error:", err);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // Helper function to publish to LinkedIn
  async function publishToLinkedIn(content: string, accessToken: string) {
    try {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
      };

      // Get user profile
      const meResponse = await fetch("https://api.linkedin.com/v2/me", {
        headers,
      });
      const meData = await meResponse.json();
      const userUrn = meData.id;

      if (!userUrn) {
        return {
          success: false,
          error: "Unable to get LinkedIn user ID",
          details: meData,
        };
      }

      // Create post
      const postData = {
        author: `urn:li:person:${userUrn}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      };

      const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers,
        body: JSON.stringify(postData),
      });

      if (postResponse.ok) {
        return {
          success: true,
          message: "Successfully published to LinkedIn!",
          platform: "LinkedIn",
        };
      } else {
        const errorData = await postResponse.json();
        return {
          success: false,
          error: "Failed to publish to LinkedIn",
          details: errorData,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: "LinkedIn publishing error",
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Helper function to publish to Twitter
  async function publishToTwitter(content: string, accessToken: string) {
    try {
      const response = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: content,
        }),
      });

      if (response.ok) {
        return {
          success: true,
          message: "Successfully published to Twitter!",
          platform: "Twitter",
        };
      } else {
        const errorData = await response.json();
        return {
          success: false,
          error: "Failed to publish to Twitter",
          details: errorData,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: "Twitter publishing error",
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Helper function to publish to Facebook
  async function publishToFacebook(content: string, accessToken: string) {
    try {
      // Get user's pages
      const pagesResponse = await fetch(
        `https://graph.facebook.com/me/accounts?access_token=${accessToken}`,
      );
      const pagesData = await pagesResponse.json();

      if (!pagesData.data || pagesData.data.length === 0) {
        return {
          success: false,
          error:
            "No Facebook pages found. Please ensure you have a Facebook page to post to.",
        };
      }

      // Use the first page
      const pageId = pagesData.data[0].id;
      const pageAccessToken = pagesData.data[0].access_token;

      const response = await fetch(
        `https://graph.facebook.com/${pageId}/feed`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            message: content,
            access_token: pageAccessToken,
          }),
        },
      );

      if (response.ok) {
        return {
          success: true,
          message: "Successfully published to Facebook!",
          platform: "Facebook",
        };
      } else {
        const errorData = await response.json();
        return {
          success: false,
          error: "Failed to publish to Facebook",
          details: errorData,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: "Facebook publishing error",
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Helper function to publish to Instagram
  async function publishToInstagram(content: string, accessToken: string) {
    try {
      // Note: Instagram requires image/video content. Text-only posts are not supported.
      return {
        success: false,
        error:
          "Instagram requires image or video content. Text-only posts are not supported by Instagram's API.",
      };
    } catch (error) {
      return {
        success: false,
        error: "Instagram publishing error",
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==========================================================================
  // FORMS API ROUTES
  // ==========================================================================

  // Get forms for authenticated user
  app.get("/api/forms", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;
      const forms = await storage.getFormsByUserId(userId);
      res.json(forms);
    } catch (error) {
      console.error("Error fetching forms:", error);
      res.status(500).json({ message: "Failed to fetch forms" });
    }
  });

  // Create new form
  app.post("/api/forms", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.dbUserId || req.user.claims.sub;

      // Generate unique share token
      const shareToken = crypto.randomBytes(20).toString("hex");

      const formData = {
        ...req.body,
        createdBy: userId,
        shareToken: shareToken,
      };

      // Apply schema validation
      try {
        insertFormSchema.parse(formData);
      } catch (zodError) {
        console.error("Form validation error:", zodError);
        return res.status(400).json({
          message: "Invalid form data",
          details:
            zodError instanceof z.ZodError
              ? zodError.errors
              : "Unknown validation error",
        });
      }

      const form = await storage.createForm(formData);
      res.status(201).json(form);
    } catch (error) {
      console.error("Error creating form:", error);
      res.status(500).json({
        message: "Failed to create form",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get specific form (authenticated)
  app.get("/api/forms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const formId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;

      const form = await storage.getForm(formId);
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      // Check if user owns this form
      if (form.createdBy !== userId) {
        return res
          .status(403)
          .json({ message: "You don't have permission to access this form" });
      }

      res.json(form);
    } catch (error) {
      console.error("Error fetching form:", error);
      res.status(500).json({ message: "Failed to fetch form" });
    }
  });

  // Update form
  app.patch("/api/forms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const formId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;

      const form = await storage.getForm(formId);
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      // Check if user owns this form
      if (form.createdBy !== userId) {
        return res
          .status(403)
          .json({ message: "You don't have permission to update this form" });
      }

      const updatedForm = await storage.updateForm(formId, req.body);
      res.json(updatedForm);
    } catch (error) {
      console.error("Error updating form:", error);
      res.status(500).json({ message: "Failed to update form" });
    }
  });

  // Delete form
  app.delete("/api/forms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const formId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;

      const form = await storage.getForm(formId);
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      // Check if user owns this form
      if (form.createdBy !== userId) {
        return res
          .status(403)
          .json({ message: "You don't have permission to delete this form" });
      }

      await storage.deleteForm(formId);
      res.status(200).json({ message: "Form deleted successfully" });
    } catch (error) {
      console.error("Error deleting form:", error);
      res.status(500).json({ message: "Failed to delete form" });
    }
  });

  // Get public form by share token (no authentication required)
  app.get("/api/f/:shareToken", async (req: any, res) => {
    try {
      const { shareToken } = req.params;
      const form = await storage.getFormByShareToken(shareToken);

      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      if (!form.isActive) {
        return res.status(404).json({ message: "Form is no longer available" });
      }

      // Return form without sensitive data
      const publicForm = {
        id: form.id,
        title: form.title,
        description: form.description,
        fields: form.fields,
        settings: form.settings,
      };

      res.json(publicForm);
    } catch (error) {
      console.error("Error fetching public form:", error);
      res.status(500).json({ message: "Failed to fetch form" });
    }
  });

  // Submit form response (no authentication required)
  app.post("/api/f/:shareToken/submit", async (req: any, res) => {
    try {
      const { shareToken } = req.params;
      const form = await storage.getFormByShareToken(shareToken);

      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      if (!form.isActive) {
        return res
          .status(400)
          .json({ message: "Form is no longer accepting responses" });
      }

      // Extract submitter info if provided
      const submitterEmail = req.body.responseData?.email || req.body.email;
      const submitterName = req.body.responseData?.name || req.body.name;

      const submissionData = {
        formId: form.id,
        responseData: req.body.responseData || req.body,
        submitterEmail,
        submitterName,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent"),
        referrer: req.get("Referer"),
      };

      // Apply schema validation
      try {
        insertFormSubmissionSchema.parse(submissionData);
      } catch (zodError) {
        console.error("Form submission validation error:", zodError);
        return res.status(400).json({
          message: "Invalid submission data",
          details:
            zodError instanceof z.ZodError
              ? zodError.errors
              : "Unknown validation error",
        });
      }

      const submission = await storage.createFormSubmission(submissionData);

      // Update form response count
      await storage.updateForm(form.id, {
        responseCount: (form.responseCount || 0) + 1,
      });

      res.status(201).json({
        message: "Response submitted successfully",
        submissionId: submission.id,
      });
    } catch (error) {
      console.error("Error submitting form:", error);
      res.status(500).json({ message: "Failed to submit response" });
    }
  });

  // Get form submissions (authenticated)
  app.get(
    "/api/forms/:id/submissions",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const formId = parseInt(req.params.id);
        const userId = req.user.dbUserId || req.user.claims.sub;

        const form = await storage.getForm(formId);
        if (!form) {
          return res.status(404).json({ message: "Form not found" });
        }

        // Check if user owns this form
        if (form.createdBy !== userId) {
          return res.status(403).json({
            message:
              "You don't have permission to view submissions for this form",
          });
        }

        const submissions = await storage.getFormSubmissions(formId);
        res.json(submissions);
      } catch (error) {
        console.error("Error fetching form submissions:", error);
        res.status(500).json({ message: "Failed to fetch submissions" });
      }
    },
  );

  // Generate QR code for form (authenticated)
  app.get("/api/forms/:id/qr", isAuthenticated, async (req: any, res) => {
    try {
      const formId = parseInt(req.params.id);
      const userId = req.user.dbUserId || req.user.claims.sub;

      const form = await storage.getForm(formId);
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      // Check if user owns this form
      if (form.createdBy !== userId) {
        return res.status(403).json({
          message:
            "You don't have permission to generate QR code for this form",
        });
      }

      // Generate the form URL
      const baseUrl = req.get("host");
      const protocol = req.get("x-forwarded-proto") || "http";
      const formUrl = `${protocol}://${baseUrl}/form/${form.shareToken}`;

      res.json({
        qrUrl: formUrl,
        shareToken: form.shareToken,
        formUrl: formUrl,
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  // Server creation moved to main index.ts file for immediate health check response

  app.patch(
    "/api/projects/:id/opened",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const projectId = Number(req.params.id);
        if (!Number.isFinite(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        const userId = req.user.dbUserId || req.user.claims.sub;

        // mirror your existing authorization pattern used elsewhere
        const isAuthorized = await storage.isUserAuthorized(projectId, userId);
        if (!isAuthorized) {
          return res.status(403).json({
            message: "You don't have permission to access this project",
          });
        }

        await db
          .update(projects)
          .set({ lastOpenedAt: new Date() })
          .where(eq(projects.id, projectId));

        res.json({ ok: true, id: projectId });
      } catch (error) {
        console.error("Error marking project opened:", error);
        res.status(500).json({ message: "Failed to update lastOpenedAt" });
      }
    },
  );

  // ---- Change Password endpoint ----
  const changePasswordBody = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
  });

  app.post("/api/auth/change-password", isAuthenticated, async (req, res) => {
    try {
      const parsed = changePasswordBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload" });
      }

      const { currentPassword, newPassword } = parsed.data;

      // user id from your normalized req.user (set by isAuthenticated)
      const userId =
        (req as any).user?.dbUserId ||
        (req as any).user?.claims?.sub ||
        (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // 1) Load user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // 2) Determine which password column your DB uses
      const passwordHash: string | undefined =
        (user as any).passwordHash ||
        (user as any).password ||
        (user as any).password_hash;

      if (!passwordHash) {
        // Likely an OAuth-only account without a local password set
        return res
          .status(400)
          .json({ message: "Password not set for this account" });
      }

      // 3) Verify current password
      const ok = await bcrypt.compare(currentPassword, passwordHash);
      if (!ok) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      // 4) Prevent re-use
      const sameAsOld = await bcrypt.compare(newPassword, passwordHash);
      if (sameAsOld) {
        return res
          .status(400)
          .json({ message: "New password must be different" });
      }

      // 5) Hash & update
      const newHash = await bcrypt.hash(newPassword, 12);

      // Figure out which key to update, based on what exists on the user row
      const passwordKey =
        "passwordHash" in (user as any)
          ? "passwordHash"
          : "password" in (user as any)
            ? "password"
            : "password_hash";

      const updatePayload: Record<string, any> = {};
      updatePayload[passwordKey] = newHash;

      if (typeof (storage as any).updateUserPassword === "function") {
        await (storage as any).updateUserPassword(userId, newHash);
      } else {
        await storage.updateUser(userId, updatePayload);
      }

      // 6) Optional: rotate the session to mitigate fixation, keep user logged in
      req.session.regenerate((err) => {
        if (err) {
          console.warn("Session regeneration failed:", err);
        }
        req.session.userId = userId;
        return res.json({ success: true });
      });
    } catch (e) {
      console.error("change-password error:", e);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/verify-email", async (req: any, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ message: "Missing token" });

      await ensureVerificationTable();

      // find token
      const { rows } = await pool.query(
        `SELECT * FROM verification_tokens WHERE token = $1`,
        [token],
      );
      const rec = rows[0];
      if (!rec) return res.status(400).json({ message: "Invalid token" });
      if (rec.used)
        return res.status(400).json({ message: "Token already used" });
      if (new Date(rec.expires_at).getTime() < Date.now()) {
        return res.status(400).json({ message: "Token expired" });
      }

      // mark user verified
      await pool.query(
        `UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [rec.user_id],
      );

      // mark token used
      await pool.query(
        `UPDATE verification_tokens SET used = true WHERE id = $1`,
        [rec.id],
      );

      // fetch user for session
      const user = await storage.getUser(rec.user_id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // create a session (so frontend can jump to home)
      req.login(
        {
          dbUserId: user.id,
          claims: { sub: user.id, email: user.email, username: user.username },
        },
        (err: any) => {
          if (err) {
            console.warn("verify-email login error:", err);
            // not fatal, still return success
          }
          const { password, ...safe } = user as any;
          return res.json({ success: true, user: safe });
        },
      );
    } catch (e) {
      console.error("verify-email error:", e);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/verification-status", async (req: any, res) => {
    try {
      const email = (req.query.email || "").toString().trim().toLowerCase();
      if (!email) return res.status(400).json({ message: "email required" });

      const user = await storage.getUserByEmail(email);
      if (!user) return res.json({ verified: false });

      return res.json({ verified: !!(user as any).email_verified });
    } catch (e) {
      console.error("verification-status error:", e);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/resend-verification", async (req: any, res) => {
    try {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ message: "email required" });

      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ message: "User not found" });

      if ((user as any).email_verified) {
        return res.status(200).json({ message: "Already verified" });
      }

      await ensureVerificationTable();
      const token = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
        [user.id, token, expiresAt],
      );

      const appUrl = process.env.APP_DOMAIN || "http://localhost:3000";
      const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;

      await sendVerificationEmail(email, verifyUrl);

      return res.json({ success: true });
    } catch (e) {
      console.error("resend-verification error:", e);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Feature Candidates API (Build Mode)
  app.get("/api/feature-candidates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const candidates = await storage.getFeatureCandidates(userId);
      res.json(candidates);
    } catch (error: any) {
      console.error("Error fetching feature candidates:", error);
      res.status(500).json({ error: "Failed to fetch feature candidates" });
    }
  });

  app.post("/api/feature-candidates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      // Normalise evidence_refs. Accept either camelCase (from our React
      // mapper) or snake_case (raw LLM JSON) so callers don't have to
      // remap, and so a future agent can POST directly. Strip anything
      // that doesn't have a quote string — we never store empty refs.
      const rawRefs =
        req.body?.evidenceRefs ?? req.body?.evidence_refs ?? [];
      const evidenceRefs = Array.isArray(rawRefs)
        ? rawRefs
            .map((r: any) => {
              if (!r || typeof r !== "object") return null;
              const quote =
                typeof r.quote === "string" ? r.quote.trim() : null;
              if (!quote) return null;
              return {
                quote,
                transcriptId: r.transcriptId ?? r.transcript_id ?? null,
                documentId:
                  typeof r.documentId === "number"
                    ? r.documentId
                    : typeof r.document_id === "number"
                      ? r.document_id
                      : null,
                sourceLabel: r.sourceLabel ?? r.source_label ?? null,
                meetingTitle: r.meetingTitle ?? r.meeting_title ?? null,
              };
            })
            .filter(Boolean)
        : [];

      const candidate = await storage.createFeatureCandidate({
        ...req.body,
        evidenceRefs: evidenceRefs as any,
        userId,
      });
      res.json(candidate);
    } catch (error: any) {
      console.error("Error creating feature candidate:", error);
      res.status(500).json({ error: "Failed to create feature candidate" });
    }
  });

  app.delete("/api/feature-candidates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const id = parseInt(req.params.id);
      const candidate = await storage.getFeatureCandidate(id);
      if (!candidate) return res.status(404).json({ error: "Feature candidate not found" });
      if (candidate.userId !== userId) return res.status(403).json({ error: "Not authorized to delete this feature candidate" });

      await storage.deleteFeatureCandidate(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting feature candidate:", error);
      res.status(500).json({ error: "Failed to delete feature candidate" });
    }
  });

  app.post("/api/feature-candidates/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const id = parseInt(req.params.id);
      const candidate = await storage.getFeatureCandidate(id);
      if (!candidate) return res.status(404).json({ error: "Feature candidate not found" });
      if (candidate.userId !== userId) return res.status(403).json({ error: "Not authorized to approve this feature candidate" });

      const candidateTasks = Array.isArray(candidate.tasks) ? candidate.tasks : [];
      const project = await storage.createProject({
        name: candidate.featureTitle,
        description: candidate.whyNow || candidate.featureTitle,
        status: "active",
        ownerId: userId,
        totalTasks: candidateTasks.length,
        completedTasks: 0,
        progress: 0,
      });

      for (let i = 0; i < candidateTasks.length; i++) {
        const t = candidateTasks[i] as any;
        await storage.createTask({
          name: t.name || t.title || `Task ${i + 1}`,
          description: t.description || "",
          projectId: project.id,
          status: "todo",
          priority: t.priority || "medium",
          position: i,
        });
      }

      const approved = await storage.approveFeatureCandidate(id, project.id);
      res.json({ candidate: approved, project });
    } catch (error: any) {
      console.error("Error approving feature candidate:", error);
      res.status(500).json({ error: "Failed to approve feature candidate" });
    }
  });

  app.post("/api/feature-candidates/prioritize", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const candidates = await storage.getFeatureCandidates(userId);
      const pendingCandidates = candidates.filter((c: any) => c.status === "candidate");

      if (pendingCandidates.length === 0) {
        return res.json({ candidates: [], message: "No pending candidates to prioritize" });
      }

      const allEvidence = await storage.getEvidenceItems(userId);
      const candidateSourceCounts = new Map<number, number>();

      for (const candidate of pendingCandidates) {
          const titleLower = (candidate.featureTitle || "").toLowerCase().trim();
          const relatedEvidence = allEvidence.filter((ev) => {
            const evTitle = (ev.title || "").toLowerCase().trim();
            if (evTitle === titleLower) return true;
            const shorter = titleLower.length < evTitle.length ? titleLower : evTitle;
            const longer = titleLower.length < evTitle.length ? evTitle : titleLower;
            if (shorter.length > 5 && longer.includes(shorter)) return true;
            const w1 = new Set(titleLower.split(/\s+/));
            const w2 = new Set(evTitle.split(/\s+/));
            const inter = [...w1].filter((w) => w2.has(w));
            const uni = new Set([...w1, ...w2]);
            return uni.size > 0 && inter.length / uni.size >= 0.5;
          });
          const allSources = new Set<string>();
          const allOrigins = new Set<string>();
          for (const ev of relatedEvidence) {
            if (Array.isArray(ev.metadata?.mentionSources)) {
              ev.metadata.mentionSources.forEach((s: string) => allSources.add(s));
            } else if (ev.source) {
              allSources.add(ev.source);
            }
            if (Array.isArray(ev.metadata?.mentionOrigins)) {
              ev.metadata.mentionOrigins.forEach((o: string) => allOrigins.add(o));
            } else {
              allOrigins.add(`${ev.source || "unknown"}_original_${ev.id}`);
            }
          }
          const maxEvMentions = relatedEvidence.reduce((max, ev) => Math.max(max, ev.mentionCount || 1), 1);
          const derivedCount = Math.max(allOrigins.size, maxEvMentions);
          candidateSourceCounts.set(candidate.id, allSources.size);
          if (derivedCount > 1 || allSources.size > 1) {
            candidate.mentionCount = derivedCount;
            await db
              .update(featureCandidates)
              .set({
                mentionCount: derivedCount,
              })
              .where(eq(featureCandidates.id, candidate.id));
          }
      }

      const openai = (getAiClient() as any);

      const candidatesSummary = pendingCandidates.map((c: any) => ({
        id: c.id,
        title: c.featureTitle,
        whyNow: c.whyNow || "",
        evidence: c.evidence || [],
        uiChanges: c.uiChanges || "",
        dataModelChanges: c.dataModelChanges || "",
        workflowChanges: c.workflowChanges || "",
        tasks: c.tasks || [],
        mentionCount: c.mentionCount || 1,
      }));

      const scoringPrompt = `You are a product prioritization expert. Score each feature candidate on three dimensions (1-100 scale):

1. **Impact** (user value, revenue potential, strategic alignment)
2. **Effort** (complexity, dependencies, risk — higher = more effort)  
3. **Confidence** (evidence strength, market validation — higher = more confident)

IMPORTANT: Each candidate includes a "mentionCount" field indicating how many times this topic has been mentioned. Features with high mention counts (3+) across separate sources signal strong user demand and should receive a significant confidence boost (+10-20 points) and a moderate impact boost (+5-10 points).

Then compute a RICE score: (Impact * Confidence) / Effort (normalized to 1-100 range).

For each candidate, provide a brief reasoning object with fields: impactReason, effortReason, confidenceReason.

Feature candidates to score:
${JSON.stringify(candidatesSummary, null, 2)}

Return a JSON object with a "scores" array, where each element has:
{ "id": number, "impactScore": number, "effortScore": number, "confidenceScore": number, "riceScore": number, "reasoning": { "impactReason": string, "effortReason": string, "confidenceReason": string } }

Sort the array by riceScore descending (best first).`;

      const riceModel = await getModelForBudget(userId, "gpt-4o");
      const response = await openai.chat.completions.create({
        model: riceModel,
        messages: [
          { role: "system", content: "You are an expert product manager who scores feature candidates using the RICE framework. Return valid JSON only." },
          { role: "user", content: scoringPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 4000,
      });

      if (response.usage) {
        trackTokenUsage(userId, "rice-scoring", riceModel, response.usage).catch(() => {});
      }

      const result = JSON.parse(response.choices[0].message.content || "{}");
      const scores = result.scores || result.results || [];

      const scoredEntries = scores.map((score: any) => {
        const candidateId = score.id;
        const impactScore = Math.max(1, Math.min(100, Math.round(score.impactScore || 50)));
        const effortScore = Math.max(1, Math.min(100, Math.round(score.effortScore || 50)));
        const confidenceScore = Math.max(1, Math.min(100, Math.round(score.confidenceScore || 50)));
        let riceScore = Math.max(1, Math.min(100, Math.round(score.riceScore || ((impactScore * confidenceScore) / Math.max(effortScore, 1)))));

        const candidate = pendingCandidates.find((c: any) => c.id === candidateId);
        const distinctSources = candidateSourceCounts.get(candidateId) || 0;
        if (distinctSources >= 3) {
          const frequencyBoost = Math.min(15, (distinctSources - 2) * 5);
          riceScore = Math.min(100, riceScore + frequencyBoost);
        }

        return { candidateId, impactScore, effortScore, confidenceScore, riceScore, reasoning: score.reasoning || null };
      });

      scoredEntries.sort((a: any, b: any) => b.riceScore - a.riceScore);

      const updatedCandidates = [];
      for (let i = 0; i < scoredEntries.length; i++) {
        const entry = scoredEntries[i];
        const updated = await storage.updateFeatureCandidate(entry.candidateId, {
          impactScore: entry.impactScore,
          effortScore: entry.effortScore,
          confidenceScore: entry.confidenceScore,
          riceScore: entry.riceScore,
          priorityRank: i + 1,
          scoreReasoning: entry.reasoning,
        });
        updatedCandidates.push(updated);
      }

      res.json({ candidates: updatedCandidates });
    } catch (error: any) {
      console.error("Error prioritizing feature candidates:", error);
      res.status(500).json({ error: "Failed to prioritize feature candidates" });
    }
  });

  app.patch("/api/feature-candidates/:id/scores", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const id = parseInt(req.params.id);
      const candidate = await storage.getFeatureCandidate(id);
      if (!candidate) return res.status(404).json({ error: "Feature candidate not found" });
      if (candidate.userId !== userId) return res.status(403).json({ error: "Not authorized to update this feature candidate" });

      const { impactScore, effortScore, confidenceScore } = req.body;

      const updates: any = {};
      if (impactScore !== undefined) updates.impactScore = Math.max(1, Math.min(100, Math.round(impactScore)));
      if (effortScore !== undefined) updates.effortScore = Math.max(1, Math.min(100, Math.round(effortScore)));
      if (confidenceScore !== undefined) updates.confidenceScore = Math.max(1, Math.min(100, Math.round(confidenceScore)));

      const finalImpact = updates.impactScore ?? candidate.impactScore ?? 50;
      const finalEffort = updates.effortScore ?? candidate.effortScore ?? 50;
      const finalConfidence = updates.confidenceScore ?? candidate.confidenceScore ?? 50;
      updates.riceScore = Math.max(1, Math.min(100, Math.round((finalImpact * finalConfidence) / Math.max(finalEffort, 1))));

      const updated = await storage.updateFeatureCandidate(id, updates);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating feature candidate scores:", error);
      res.status(500).json({ error: "Failed to update scores" });
    }
  });

  app.patch("/api/feature-candidates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const id = parseInt(req.params.id);
      const candidate = await storage.getFeatureCandidate(id);
      if (!candidate) return res.status(404).json({ error: "Feature candidate not found" });
      if (candidate.userId !== userId) return res.status(403).json({ error: "Not authorized to update this feature candidate" });

      const { featureTitle, whyNow, evidence, uiChanges, dataModelChanges, workflowChanges, tasks, lastSentToAgent, lastSentAt } = req.body;

      const updates: any = {};
      if (featureTitle !== undefined) updates.featureTitle = featureTitle;
      if (whyNow !== undefined) updates.whyNow = whyNow;
      if (evidence !== undefined) updates.evidence = evidence;
      if (uiChanges !== undefined) updates.uiChanges = uiChanges;
      if (dataModelChanges !== undefined) updates.dataModelChanges = dataModelChanges;
      if (workflowChanges !== undefined) updates.workflowChanges = workflowChanges;
      if (tasks !== undefined) updates.tasks = tasks;
      if (lastSentToAgent !== undefined) updates.lastSentToAgent = lastSentToAgent;
      if (lastSentAt !== undefined) updates.lastSentAt = new Date(lastSentAt);

      const updated = await storage.updateFeatureCandidate(id, updates);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating feature candidate:", error);
      res.status(500).json({ error: "Failed to update feature candidate" });
    }
  });

  app.post("/api/ai/refine-feature", isAuthenticated, async (req: any, res) => {
    try {
      const { message, feature } = req.body;
      if (!message || !feature) return res.status(400).json({ error: "Message and feature are required" });

      const refineUserId = req.user?.dbUserId || req.user?.claims?.sub || "anonymous";
      // Own-key (Claude) users don't need the platform OpenAI key.
      if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey(refineUserId))) {
        return res.status(500).json({ error: "AI provider not configured" });
      }

      const openai = (getAiClient() as any);
      const refineModel = await getModelForBudget(refineUserId, "gpt-4o");

      const response = await openai.chat.completions.create({
        model: refineModel,
        messages: [
          {
            role: "system",
            content: `You are an expert product manager helping refine a feature specification. The user will ask you to refine, simplify, or adjust aspects of the feature. Respond with helpful advice and, when appropriate, suggest updated field values.

When you suggest changes to the feature spec, include a JSON block at the end of your response in this format:
\`\`\`json
{
  "updates": {
    "featureTitle": "Updated title if changed",
    "whyNow": "Updated reasoning if changed",
    "uiChanges": "Updated UI changes if changed",
    "dataModelChanges": "Updated data model if changed",
    "workflowChanges": "Updated workflow if changed",
    "tasks": [{"name": "Task name", "description": "Task description"}]
  }
}
\`\`\`
Only include fields that should be updated. If no spec changes are needed (e.g. the user is just asking a question), omit the JSON block entirely.`
          },
          {
            role: "user",
            content: `Current feature spec:
Title: ${feature.featureTitle}
Why Now: ${feature.whyNow || "N/A"}
Evidence: ${(feature.evidence || []).join(", ") || "N/A"}
UI Changes: ${feature.uiChanges || "N/A"}
Data Model Changes: ${feature.dataModelChanges || "N/A"}
Workflow Changes: ${feature.workflowChanges || "N/A"}
Tasks: ${JSON.stringify(feature.tasks || [])}

User request: ${message}`
          }
        ],
        temperature: 0.6,
        max_tokens: 2000,
      });

      if (response.usage && refineUserId) {
        trackTokenUsage(refineUserId, "feature-refinement", refineModel, response.usage).catch(() => {});
      }

      const responseText = response.choices?.[0]?.message?.content || "I couldn't process that request.";

      let updates: any = null;
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          updates = parsed.updates || null;
        } catch (e) {}
      }

      res.json({ text: responseText.replace(/```json[\s\S]*?```/g, "").trim(), updates });
    } catch (error: any) {
      console.error("Error refining feature:", error);
      res.status(500).json({ error: "Failed to refine feature" });
    }
  });

  app.post("/api/discovery-reports", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { title, reportData } = req.body;
      if (!title || !reportData) return res.status(400).json({ error: "Title and reportData are required" });

      const shareToken = crypto.randomBytes(16).toString("hex");

      const result = await pool.query(
        `INSERT INTO discovery_reports (user_id, share_token, title, report_data, is_public)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [userId, shareToken, title, JSON.stringify(reportData)]
      );

      res.json({ id: result.rows[0].id, shareToken: result.rows[0].share_token });
    } catch (error: any) {
      console.error("Error creating discovery report:", error);
      res.status(500).json({ error: "Failed to create discovery report" });
    }
  });

  app.get("/api/discovery-reports/shared/:token", async (req: any, res) => {
    try {
      const { token } = req.params;

      const result = await pool.query(
        `UPDATE discovery_reports SET view_count = COALESCE(view_count, 0) + 1
         WHERE share_token = $1 AND is_public = true
         RETURNING *`,
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Report not found or no longer shared" });
      }

      const report = result.rows[0];
      res.json({
        id: report.id,
        title: report.title,
        reportData: report.report_data,
        viewCount: report.view_count,
        createdAt: report.created_at,
      });
    } catch (error: any) {
      console.error("Error fetching shared report:", error);
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  function extractFeatureSections(text: string): Map<string, string> {
    const sections = new Map<string, string>();
    const featurePattern = /##\s*Recommended Feature:\s*(.+?)\n([\s\S]*?)(?=##\s*Recommended Feature:|```json|$)/gi;
    let match;
    while ((match = featurePattern.exec(text)) !== null) {
      sections.set(match[1].trim().toLowerCase(), match[2]);
    }
    return sections;
  }

  function extractInsightsFromSection(sectionText: string): Array<{theme: string; root_cause: string; supporting_quotes: string[]}> {
    const insights: Array<{theme: string; root_cause: string; supporting_quotes: string[]}> = [];
    const insightPattern = /###\s*Insight:\s*(.+?)\n([\s\S]*?)(?=###|##|$)/gi;
    let match;
    while ((match = insightPattern.exec(sectionText)) !== null) {
      const theme = match[1].trim();
      const body = match[2];
      const rootCauseMatch = body.match(/\*\*Root cause:\*\*\s*(.+?)(?:\n|$)/i);
      const root_cause = rootCauseMatch ? rootCauseMatch[1].trim() : "";
      const supporting_quotes: string[] = [];
      const quotePattern = /-\s*"([^"]+)"/g;
      let qm;
      while ((qm = quotePattern.exec(body)) !== null) {
        supporting_quotes.push(qm[1]);
      }
      if (theme && (root_cause || supporting_quotes.length > 0)) {
        insights.push({ theme, root_cause, supporting_quotes });
      }
    }
    return insights;
  }

  function extractReasoningFromSection(sectionText: string): string | null {
    const whySection = sectionText.match(/###\s*Why this,?\s*not something simpler\??\s*\n([\s\S]*?)(?=###|##|$)/i);
    return whySection ? whySection[1].replace(/\*\*/g, '').trim().slice(0, 500) : null;
  }

  // Build Mode AI chat endpoint
  app.post("/api/ai/build-chat-stream", async (req: any, res) => {
    try {
      const {
        message,
        context,
        chatHistory,
        useContextBrain: enableBrain,
        /**
         * Optional structured transcripts. When the client provides this
         * array, the server formats each entry with a [TRANSCRIPT …]
         * marker so the LLM can cite transcript_ids in the evidence_refs
         * it returns. Each entry shape:
         *   { id: string, source?: string, date?: string,
         *     title?: string, text: string }
         * Legacy callers that only pass `context` keep working — they
         * just won't get transcript-linked evidence in the result.
         */
        transcripts,
      } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      let userId = "demo-user-123";
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        userId = req.user.dbUserId || req.user.claims?.sub || "demo-user-123";
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Own-key (Claude) users don't need the platform OpenAI key.
      if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey(userId))) {
        sendEvent({ type: "error", content: "AI provider not configured" });
        sendEvent({ type: "done" });
        return res.end();
      }

      const openai = (getAiClient() as any);

      const { logService } = await import("./services/log-service");

      let brainContext = "";
      let brainContextCount = 0;
      if (enableBrain !== false) {
        try {
          const { getRelevantContext } = await import("./services/context-injector");
          const injected = await getRelevantContext(userId, message);
          brainContext = injected.text;
          brainContextCount = injected.count;
        } catch (e) {
          console.warn("[Build Mode] Context injection failed:", e);
        }
      }

      const BUILD_MODE_SYSTEM_PROMPT = `You are in BUILD MODE — a senior product strategist and discovery assistant.
Your job is to determine what should be built next. Be decisive, structured, and strategic.

CONVERSATIONAL BEHAVIOR (HIGHEST PRIORITY):
- If the user sends a greeting (hi, hey, hello, what's up, how's it going, etc.) or casual message, respond naturally and warmly. Introduce yourself briefly as their product discovery assistant and ask what they're working on or what they'd like to explore. Do NOT use the structured feature format for greetings or small talk.
- If the user asks a general question (not about a specific product or feature), answer conversationally.
- ONLY use the structured format when you're actually recommending a feature based on evidence or substantive analysis request.
- Match the user's energy — short casual messages get short friendly replies, detailed questions get detailed answers.

PERSONALITY:
- Strategic and analytical. Think like a VP of Product.
- Evidence-driven — always tie recommendations to user evidence.
- Confident and concise. No hedging, no rambling.
- Slightly visionary — connect pain points to product opportunities.
- Warm and approachable — you're a collaborative partner, not a cold machine.

CRITICAL ANALYSIS METHOD — INSIGHTS BEFORE FEATURES:
Before recommending any features, you MUST first synthesize insights from the evidence. Do NOT map symptoms directly to features. Instead:
1. Extract behavioral patterns and recurring themes from the evidence
2. Identify ROOT CAUSES behind what users say — users describe symptoms, your job is to diagnose the underlying problem
3. Cite direct quotes that support each insight
4. Only THEN derive features from those root causes

Example of BAD analysis: User says "I get distracted easily" → recommend a "focus mode" feature
Example of GOOD analysis: User says "I get distracted easily" + "I have 20 tasks all marked urgent" → Root cause: lack of task differentiation creates overwhelm, which manifests as perceived distraction → recommend priority intelligence that reduces cognitive load

RESPONSE FORMAT — Use this structure ONLY for actual feature recommendations (not greetings or general chat):

## Insights Identified

For each insight you extracted from the evidence:

### Insight: [Theme Name]
**Pattern observed:** What you noticed across the evidence
**Root cause:** The underlying problem (not the surface symptom)
**Supporting quotes:**
- "[Direct quote from user]" — [source]
- "[Another quote]" — [source]

---

Then for each recommended feature:

## Recommended Feature: [Feature Name]

### What's happening
1-2 sentence summary tying back to the root cause identified above.

### What to build
Concise, specific feature description. No vague language.

### Why this, not something simpler?
Explain the reasoning chain: quote → insight → root cause → why this specific solution addresses the root cause and why a simpler alternative would fall short.

### Suggested changes
- **UI:** Specific interface changes needed
- **Data model:** Schema or data changes required
- **Workflow:** Process or logic changes

### Next step
One clear, actionable recommendation for the team.

RULES:
- NO long paragraphs. Use headers, bullets, and short sentences.
- NO vague advice like "improve UX" or "enhance performance."
- NO execution details (timelines, sprints) unless explicitly asked.
- Focus on WHAT and WHY, not HOW to implement.
- If you identify multiple features, present each one using the structure above.
- Always reference evidence. If no context is provided, ask for it.
- The "Insights Identified" section MUST come before any feature recommendations.

CLARIFICATION BEHAVIOR:
If the user asks about a specific product or feature topic but their input is vague or lacks enough context to make a recommendation, DO NOT guess. Instead respond:

**Before I recommend anything, I need clarity on:**
1. [Specific question]
2. [Specific question]

This ensures quality over quantity. Do NOT use this format for greetings or casual messages — just respond naturally.

FEATURE JSON (MANDATORY — include at the END of every feature recommendation response):
You MUST include this JSON block at the very end for automated processing. The "insights" and "reasoning_chain" fields are REQUIRED — never omit them.

Here is a COMPLETE example with all required fields filled in:
\`\`\`json
{
  "features": [
    {
      "feature_title": "Smart Priority Intelligence",
      "why_now": "Users report feeling overwhelmed because all 20+ tasks appear urgent with no differentiation, leading to paralysis and perceived distraction",
      "evidence": ["I have 20 tasks and they all feel urgent", "I get distracted because I don't know what to do first"],
      "ui_changes": "Add priority scoring badges and a 'Focus Mode' that surfaces the top 3 tasks based on impact and deadlines",
      "data_model_changes": "Add computed priority_score field to tasks based on urgency, impact, and dependencies",
      "workflow_changes": "Auto-calculate priority scores when tasks are created or updated",
      "insights": [
        {
          "theme": "Task Overwhelm Masquerading as Distraction",
          "root_cause": "Users lack a system to differentiate urgency levels, so everything feels equally urgent, creating decision paralysis that manifests as distraction",
          "supporting_quotes": ["I have 20 tasks and they all feel urgent", "I get distracted because I don't know what to do first"]
        }
      ],
      "reasoning_chain": "Users say they get distracted (symptom) → but also say all tasks feel urgent (pattern) → root cause is lack of priority differentiation creating overwhelm → a simple 'focus mode' would hide tasks but not solve prioritization → Smart Priority Intelligence actively ranks tasks so users always know what matters most",
      "tasks": [
        {"name": "Priority scoring engine", "description": "Build algorithm that scores tasks by urgency, impact, and dependencies", "priority": "high"}
      ]
    }
  ]
}
\`\`\`

Your JSON MUST follow this exact structure. Every feature MUST include a non-empty "insights" array and a "reasoning_chain" string.

EVIDENCE TRACEABILITY (IMPORTANT):
When the user-provided context includes one or more transcripts, each transcript will be introduced with a line of the form:
    [TRANSCRIPT transcript_id=AUTO-XXXX source="Zoom" date="2026-05-08" title="Customer call: Acme Q3"]
followed by the transcript body, then [END TRANSCRIPT].

For every "evidence" entry you cite, ALSO include a matching entry in a parallel "evidence_refs" array. Each ref must reference the transcript the quote came from:
    "evidence":      ["I was almost ready to buy, but the checkout was just too complicated."],
    "evidence_refs": [{"quote": "I was almost ready to buy, but the checkout was just too complicated.", "transcript_id": "AUTO-XXXX", "source_label": "Zoom · 2026-05-08", "meeting_title": "Customer call: Acme Q3"}]

Rules:
  - evidence_refs[i].quote MUST exactly match evidence[i] (same index, same string).
  - If a quote spans multiple transcripts, emit a separate ref per transcript and duplicate the quote in evidence accordingly.
  - If a quote did not come from a transcript (e.g. the user typed it in chat), set transcript_id to null and source_label to "Chat".
  - If no transcripts were provided at all, omit evidence_refs entirely — don't fabricate ids.
NEVER invent a transcript_id that was not in the context. Hallucinated references are worse than missing ones.
`;

      // Pack any structured transcripts into the prompt with markers the
      // LLM is taught to recognise (see EVIDENCE TRACEABILITY rules in the
      // system prompt). Each marker carries the transcript_id the model
      // must cite in evidence_refs.
      const transcriptsBlock = Array.isArray(transcripts) && transcripts.length
        ? transcripts
            .filter((t: any) => t && typeof t.text === "string" && t.text.trim())
            .map((t: any) => {
              const id = String(t.id ?? t.transcript_id ?? t.transcriptId ?? "").trim();
              const src = String(t.source ?? t.meeting_source ?? "").trim();
              const date = String(t.date ?? t.meeting_date ?? "").trim();
              const title = String(
                t.title ?? t.meeting_title ?? t.meetingTitle ?? "",
              ).trim();
              // Cap each transcript body so a giant upload doesn't blow the
              // context window; the LLM will still see the marker + opening
              // chunk, which is enough to cite by id.
              const body = String(t.text).slice(0, 12_000);
              return (
                `[TRANSCRIPT transcript_id=${id || "UNKNOWN"}` +
                (src ? ` source=${JSON.stringify(src)}` : "") +
                (date ? ` date=${JSON.stringify(date)}` : "") +
                (title ? ` title=${JSON.stringify(title)}` : "") +
                `]\n${body}\n[END TRANSCRIPT]`
              );
            })
            .join("\n\n")
        : "";

      const contextNote = (transcriptsBlock || context)
        ? "\n\n[User-provided context (transcripts, notes, files):]\n" +
          [transcriptsBlock, context].filter(Boolean).join("\n\n")
        : "";

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: BUILD_MODE_SYSTEM_PROMPT },
      ];

      if (chatHistory && chatHistory.length > 0) {
        const recentHistory = chatHistory.slice(-10);
        for (const msg of recentHistory) {
          messages.push({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content.replace(/```json[\s\S]*?```/g, "").trim(),
          });
        }
      }

      if (brainContext) {
        messages.push({ role: "system", content: brainContext });
      }
      messages.push({ role: "user", content: message + contextNote });

      if (brainContextCount > 0) {
        sendEvent({ type: "context_brain", count: brainContextCount });
      }

      const buildChatModel = await getModelForBudget(userId, "gpt-4o");
      const stream = await openai.chat.completions.create({
        model: buildChatModel,
        messages,
        temperature: 0.6,
        max_tokens: 6000,
        stream: true,
        stream_options: { include_usage: true },
      });

      let fullText = "";
      let streamUsage: any = null;

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          fullText += content;
          sendEvent({ type: "text", content });
        }
        if ((chunk as any).usage) {
          streamUsage = (chunk as any).usage;
        }
      }

      if (streamUsage) {
        trackTokenUsage(userId, "build-mode-chat", buildChatModel, streamUsage).catch(() => {});
      }

      let features: any[] = [];
      const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          features = parsed.features || [];
          logService.log("NODE", "INFO", `[Build Mode] Parsed ${features.length} features from JSON block`);
        } catch (e) {
          logService.log("NODE", "WARN", "[Build Mode] Failed to parse feature JSON: " + (e as Error).message);
        }
      } else {
        logService.log("NODE", "INFO", "[Build Mode] No JSON block found in response");
      }

      if (features.length > 0) {
        const featureSections = extractFeatureSections(fullText);
        const insightsSection = fullText.match(/##\s*Insights Identified\s*\n([\s\S]*?)(?=##\s*Recommended Feature:|```json|$)/i);

        for (let i = 0; i < features.length; i++) {
          const f = features[i];
          const hasInsights = f.insights && Array.isArray(f.insights) && f.insights.length > 0;
          const hasReasoning = !!f.reasoning_chain;
          logService.log("NODE", "INFO", `[Build Mode] Feature "${f.feature_title}": insights=${hasInsights}, reasoning=${hasReasoning}`);

          if (!hasInsights) {
            const featureKey = (f.feature_title || "").toLowerCase();
            const matchedSection = featureSections.get(featureKey);
            let extractedInsights: Array<{theme: string; root_cause: string; supporting_quotes: string[]}> = [];

            if (matchedSection) {
              extractedInsights = extractInsightsFromSection(matchedSection);
            }
            if (extractedInsights.length === 0 && insightsSection) {
              extractedInsights = extractInsightsFromSection(insightsSection[1]);
            }
            if (extractedInsights.length > 0) {
              f.insights = extractedInsights;
              logService.log("NODE", "INFO", `[Build Mode] Extracted ${extractedInsights.length} insights from markdown for "${f.feature_title}"`);
            }
          }

          if (!hasReasoning) {
            const featureKey = (f.feature_title || "").toLowerCase();
            const matchedSection = featureSections.get(featureKey);
            if (matchedSection) {
              const reasoning = extractReasoningFromSection(matchedSection);
              if (reasoning) f.reasoning_chain = reasoning;
            }
          }
        }

        sendEvent({ type: "features", data: features });
      }

      sendEvent({ type: "done", fullText });
      res.end();
    } catch (error: any) {
      console.error("Error in streaming build mode chat:", error);
      try {
        res.write(`data: ${JSON.stringify({ type: "error", content: error.message || "Stream failed" })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      } catch {
        res.end();
      }
    }
  });

  app.post("/api/ai/chat-stream", async (req: any, res) => {
    try {
      const { message, projectId, attachments, sessionId: providedSessionId, existingProject, useContextBrain: enablePlanBrain } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      let userId = "demo-user-123";
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        userId = req.user.dbUserId || req.user.claims?.sub || "demo-user-123";
      }

      // Own-key (Claude) users don't need the platform OpenAI key.
      if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey(userId))) {
        sendEvent({ type: "error", content: "AI provider not configured" });
        sendEvent({ type: "done" });
        return res.end();
      }

      const msgTrimmed = message.trim();
      const msgLower = msgTrimmed.toLowerCase();
      const wordCount = msgTrimmed.split(/\s+/).length;

      const planningKeywords = ["plan", "project", "create", "app", "system", "platform", "build", "develop", "design", "tool", "software", "website", "feature", "product", "launch", "startup", "business", "workflow", "automate", "integrate", "api", "dashboard", "mobile", "saas"];
      const hasPlanningKeyword = planningKeywords.some(kw => msgLower.includes(kw));
      const isPlanningRequest = hasPlanningKeyword && (wordCount >= 3 || msgLower.includes("plan") || msgLower.includes("project"));

      const isConversational = !isPlanningRequest;

      let planBrainContext = "";
      let planBrainCount = 0;
      if (enablePlanBrain !== false) {
        try {
          const { getRelevantContext } = await import("./services/context-injector");
          const injected = await getRelevantContext(userId, message);
          planBrainContext = injected.text;
          planBrainCount = injected.count;
        } catch (e) {
          console.warn("[Plan Mode] Context injection failed:", e);
        }
      }

      if (planBrainCount > 0) {
        sendEvent({ type: "context_brain", count: planBrainCount });
      }

      if (isConversational) {
        let sessionId = providedSessionId;
        if (!sessionId) {
          const sessionResult = await storage.createChatSession(userId, projectId);
          sessionId = sessionResult.sessionId;
        }
        sendEvent({ type: "session", sessionId });
        await storage.saveChatMessage(sessionId, "user", message, { attachments });

        const openai = (getAiClient() as any);

        const chatHistory = await storage.getChatHistory(sessionId);
        const recentHistory = chatHistory.slice(-6).map((msg: any) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));

        const conversationalMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          {
            role: "system",
            content: "You are Requisor AI, a warm and knowledgeable project planning assistant. You help people plan projects, break down ideas, and organize their work.\n\nCONVERSATIONAL RULES:\n- Respond naturally and warmly to greetings, casual messages, emotional expressions, and general questions.\n- If someone shares feelings (stressed, overwhelmed, excited), empathize genuinely and offer to help with what's on their mind.\n- Keep casual responses short — 1-3 sentences.\n- If the conversation naturally leads toward a project idea, gently ask about it rather than forcing planning mode.\n- Never output JSON, structured formats, or markdown headers for conversational messages.\n- You're a helpful partner, not a cold planning machine.\n- If Context Brain insights are provided, you may reference them when relevant but don't force them into casual replies."
          },
        ];

        if (planBrainContext) {
          conversationalMessages.push({ role: "system", content: planBrainContext });
        }

        conversationalMessages.push(...recentHistory);
        conversationalMessages.push({ role: "user", content: message });

        const planChatModel = await getModelForBudget(userId, "gpt-4o");
        const chatResponse = await openai.chat.completions.create({
          model: planChatModel,
          messages: conversationalMessages,
          max_tokens: 300,
        });

        if (chatResponse.usage) {
          trackTokenUsage(userId, "plan-mode-chat", planChatModel, chatResponse.usage).catch(() => {});
        }

        const reply = chatResponse.choices[0]?.message?.content || "Hey! I'm here to help. What's on your mind?";
        const words = reply.split(" ");
        for (let i = 0; i < words.length; i += 3) {
          const chunk = words.slice(i, i + 3).join(" ") + " ";
          sendEvent({ type: "text", content: chunk });
          await new Promise((r) => setTimeout(r, 20));
        }

        await storage.saveChatMessage(sessionId, "assistant", reply, {});
        sendEvent({ type: "done", sessionId });
        return res.end();
      }

      sendEvent({ type: "status", content: "Analyzing your project requirements..." });

      const { deepPlannerAgent } = await import("./deep-intelligence-agent-v2");
      const { plannerMemory } = await import("./project-planner-memory");
      const { detectUpdateIntent } = await import("./utils/update-detection");
      deepPlannerAgent.trackingUserId = userId;

      let sessionId = providedSessionId;
      if (!sessionId) {
        const sessionResult = await storage.createChatSession(userId, projectId);
        sessionId = sessionResult.sessionId;
      }

      sendEvent({ type: "session", sessionId });

      const existingPlanFromClient = existingProject;
      const existingPlanFromMemory = plannerMemory.getLatestPlan(sessionId);
      const hasActiveProject = !!(existingPlanFromClient || existingPlanFromMemory);
      const updateDetection = detectUpdateIntent(message, existingPlanFromClient, hasActiveProject);
      const isUpdateRequest = updateDetection.isUpdate;

      await storage.saveChatMessage(sessionId, "user", message, { attachments });

      sendEvent({ type: "status", content: "Generating your project plan..." });

      if (isPlanningRequest || isUpdateRequest) {
        const validSessionId = await deepPlannerAgent.initSession(userId);
        const existingProjectCtx = existingPlanFromClient || existingPlanFromMemory;

        let messageWithContext = message;
        if (isUpdateRequest && existingProjectCtx) {
          messageWithContext = `${message}\n\nCONTEXT: This is an UPDATE to an existing project. Here is the current project structure:\n${JSON.stringify(existingProjectCtx, null, 2)}\n\nIMPORTANT INSTRUCTIONS:\n- PRESERVE all existing milestone and task IDs that remain in the updated plan\n- MERGE the new request with the existing structure\n- Add new milestones/tasks with new IDs as needed\n- Use the same structure format as the existing project`;
        }
        if (planBrainContext) {
          messageWithContext = messageWithContext + "\n\n" + planBrainContext;
        }

        const deepResponse = await deepPlannerAgent.processMessage(messageWithContext, validSessionId);

        if (deepResponse.projectCanvas) {
          plannerMemory.savePlanSnapshot(sessionId, deepResponse.projectCanvas);
        }

        const content = deepResponse.content ||
          (deepResponse.projectCanvas && !isUpdateRequest
            ? "I've created a comprehensive project plan for you. You can review and edit the details on the right before saving it to your projects."
            : deepResponse.projectCanvas && isUpdateRequest
              ? "Project plan updated. Please review the changes."
              : "I've processed your request.");

        if (content) {
          const words = content.split(" ");
          for (let i = 0; i < words.length; i += 3) {
            const chunk = words.slice(i, i + 3).join(" ") + " ";
            sendEvent({ type: "text", content: chunk });
            await new Promise((r) => setTimeout(r, 20));
          }
        }

        if (deepResponse.projectCanvas) {
          sendEvent({
            type: "plan",
            data: {
              projectCanvas: deepResponse.projectCanvas,
              clarifications: deepResponse.clarifications || [],
              suggestions: deepResponse.suggestions || [],
              confidence: deepResponse.confidence,
              isDirectCanvas: isPlanningRequest,
              diff: (deepResponse as any).diff,
              mergeInfo: deepResponse.mergeInfo,
            },
          });
        }

        await storage.saveChatMessage(sessionId, "assistant", content, {
          projectCanvas: deepResponse.projectCanvas,
        });

        sendEvent({ type: "done", sessionId: validSessionId });
      } else {
        const { SimpleAIAgent } = await import("./simple-ai-agent");
        const agent = new SimpleAIAgent(userId);

        const projects = userId !== "demo-user-123" ? await storage.getProjectsForUser(userId) : await storage.getAllProjects();
        const allTasks: any[] = [];
        for (const project of projects) {
          const projectTasks = await storage.getTasksByProjectId(project.id);
          allTasks.push(...projectTasks);
        }

        const context = { projects: projects.slice(0, 20), tasks: allTasks.slice(0, 50), userId, user: null };
        const response = await agent.processMessage(message, context as any);

        if (response.content) {
          const words = response.content.split(" ");
          for (let i = 0; i < words.length; i += 3) {
            const chunk = words.slice(i, i + 3).join(" ") + " ";
            sendEvent({ type: "text", content: chunk });
            await new Promise((r) => setTimeout(r, 20));
          }
        }

        await storage.saveChatMessage(sessionId, "assistant", response.content, {
          actions: response.actions,
          insights: response.insights,
          suggestedPrompts: response.suggestedPrompts,
          projectCanvas: response.projectCanvas,
        });

        sendEvent({
          type: "done",
          sessionId,
          actions: response.actions || [],
          insights: response.insights || [],
          suggestedPrompts: response.suggestedPrompts || [],
        });
      }

      res.end();
    } catch (error: any) {
      console.error("AI Chat Stream Error:", error);
      try {
        res.write(`data: ${JSON.stringify({ type: "error", content: error.message || "Stream failed" })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      } catch {
        res.end();
      }
    }
  });

  app.post("/api/ai/build-chat", async (req: any, res) => {
    try {
      const { message, context, chatHistory } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      let userId = "demo-user-123";
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        userId = req.user.dbUserId || req.user.claims?.sub || "demo-user-123";
      }

      const recentHistory = Array.isArray(chatHistory)
        ? chatHistory.slice(-10).map((m: any) => ({ role: m.role, content: m.content }))
        : undefined;

      const { processBuildModePrompt } = await import("./services/gemini-agent");
      const result = await processBuildModePrompt(message, userId, context, recentHistory);
      res.json(result);
    } catch (error: any) {
      console.error("Error in build mode chat:", error);
      res.status(500).json({ error: "Failed to process build mode request" });
    }
  });

  // ==================== Meeting Integrations OAuth ====================
  
  const { meetingIntegrations } = await import("./services/meeting-integrations");

  // Get integration status for all providers
  app.get("/api/integrations/meetings/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const providers = ["slack", "zoom", "google_meet", "teams"];
      const statuses: Record<string, { connected: boolean; workspaceName?: string; lastSynced?: string }> = {};
      
      for (const provider of providers) {
        const integration = await storage.getIntegrationByProvider(userId, provider);
        statuses[provider] = {
          connected: integration?.isConnected || false,
          workspaceName: (integration?.additionalData as any)?.workspaceName,
          lastSynced: integration?.lastSynced?.toISOString(),
        };
      }
      
      res.json(statuses);
    } catch (error: any) {
      console.error("Error fetching integration statuses:", error);
      res.status(500).json({ error: "Failed to fetch integration statuses" });
    }
  });

  // Get OAuth URL for a provider (generates state for CSRF protection)
  app.get("/api/integrations/meetings/:provider/auth-url", isAuthenticated, async (req: any, res) => {
    try {
      const { provider } = req.params;
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const oauthBase = (process.env.APP_DOMAIN || "").replace(/\/+$/, "");
      let redirectUri: string;
      if (oauthBase) {
        redirectUri = `${oauthBase}/api/integrations/meetings/${provider}/callback`;
      } else {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers["x-forwarded-host"] || req.headers.host;
        redirectUri = `${protocol}://${host}/api/integrations/meetings/${provider}/callback`;
      }

      console.log(`OAuth auth-url for ${provider}: redirectUri=${redirectUri}`);

      const state = crypto.randomBytes(32).toString("hex");
      if (!req.session) return res.status(500).json({ error: "Session not available" });
      req.session.oauthState = state;
      req.session.oauthUserId = userId;
      req.session.oauthProvider = provider;

      // Generate PKCE code_verifier and code_challenge for Zoom General Apps
      const codeVerifier = crypto.randomBytes(32).toString("base64url");
      const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
      req.session.oauthCodeVerifier = codeVerifier;

      // Store OAuth state in DB for cross-domain callback support (dev preview → production callback)
      try {
        await pool.query(
          `INSERT INTO oauth_states (state, user_id, provider, code_verifier, created_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (state) DO UPDATE SET user_id=$2, provider=$3, code_verifier=$4, created_at=NOW()`,
          [state, userId, provider, codeVerifier]
        );
      } catch (dbErr: any) {
        console.log("Could not save OAuth state to DB (table may not exist):", dbErr.message);
      }

      let authUrl: string;
      switch (provider) {
        case "slack": authUrl = meetingIntegrations.getSlackAuthUrl(redirectUri, state); break;
        case "zoom": authUrl = meetingIntegrations.getZoomAuthUrl(redirectUri, state, codeChallenge); break;
        case "google_meet": authUrl = meetingIntegrations.getGoogleAuthUrl(redirectUri, state); break;
        case "teams": authUrl = meetingIntegrations.getTeamsAuthUrl(redirectUri, state); break;
        default: return res.status(400).json({ error: "Invalid provider" });
      }

      res.json({ authUrl });
    } catch (error: any) {
      console.error("Error generating auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  // OAuth callback for all providers (validates state for CSRF protection)
  app.get("/api/integrations/meetings/:provider/callback", async (req: any, res) => {
    try {
      const { provider } = req.params;
      const { code, state } = req.query;

      if (!code) return res.redirect("/meetings?error=no_code");

      let savedState = req.session?.oauthState;
      let userId = req.session?.oauthUserId;
      let savedProvider = req.session?.oauthProvider;
      let codeVerifier = req.session?.oauthCodeVerifier;

      // Fallback: if session doesn't have OAuth state (cross-domain callback), check DB
      if ((!savedState || savedState !== state) && state) {
        try {
          const dbResult = await pool.query(
            `SELECT user_id, provider, code_verifier FROM oauth_states WHERE state = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
            [state]
          );
          if (dbResult.rows.length > 0) {
            const row = dbResult.rows[0];
            savedState = state as string;
            userId = row.user_id;
            savedProvider = row.provider;
            codeVerifier = row.code_verifier;
            console.log(`OAuth callback: recovered state from DB for ${provider}, userId=${userId}`);
            await pool.query(`DELETE FROM oauth_states WHERE state = $1`, [state]);
          }
        } catch (dbErr: any) {
          console.log("Could not check OAuth state in DB:", dbErr.message);
        }
      }

      if (!state || !savedState || state !== savedState) {
        console.log(`OAuth callback state mismatch for ${provider}: received=${state}, saved=${savedState}, hasSession=${!!req.session}`);
        return res.redirect(`/meetings?error=invalid_state&provider=${provider}&detail=state_mismatch`);
      }
      if (!userId) {
        return res.redirect(`/meetings?error=not_authenticated&provider=${provider}&detail=no_user_in_session`);
      }
      if (savedProvider !== provider) {
        return res.redirect(`/meetings?error=provider_mismatch&provider=${provider}&detail=expected_${savedProvider}`);
      }

      if (req.session?.oauthState) {
        delete req.session.oauthState;
        delete req.session.oauthUserId;
        delete req.session.oauthProvider;
        delete req.session.oauthCodeVerifier;
      }

      const oauthBase = (process.env.APP_DOMAIN || "").replace(/\/+$/, "");
      let redirectUri: string;
      if (oauthBase) {
        redirectUri = `${oauthBase}/api/integrations/meetings/${provider}/callback`;
      } else {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers["x-forwarded-host"] || req.headers.host;
        redirectUri = `${protocol}://${host}/api/integrations/meetings/${provider}/callback`;
      }

      console.log(`OAuth callback for ${provider}: redirectUri=${redirectUri}, hasCodeVerifier=${!!codeVerifier}`);

      let tokenData: any;
      try {
        switch (provider) {
          case "slack": tokenData = await meetingIntegrations.exchangeSlackCode(code as string, redirectUri); break;
          case "zoom": tokenData = await meetingIntegrations.exchangeZoomCode(code as string, redirectUri, codeVerifier); break;
          case "google_meet": tokenData = await meetingIntegrations.exchangeGoogleCode(code as string, redirectUri); break;
          case "teams": tokenData = await meetingIntegrations.exchangeTeamsCode(code as string, redirectUri); break;
          default: return res.redirect(`/meetings?error=invalid_provider&provider=${provider}`);
        }
      } catch (tokenError: any) {
        console.error(`Token exchange error for ${provider}:`, tokenError.message);
        return res.redirect(`/meetings?error=token_exchange_failed&provider=${provider}&detail=${encodeURIComponent(tokenError.message)}`);
      }

      const existing = await storage.getIntegrationByProvider(userId, provider);
      if (existing) {
        await storage.updateIntegration(existing.id, {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken || existing.refreshToken,
          isConnected: true,
          lastSynced: new Date(),
          additionalData: { workspaceName: tokenData.teamName || tokenData.teamId || provider },
        });
      } else {
        await storage.createIntegration({
          userId,
          provider,
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken || null,
          tokenExpiry: null,
          isConnected: true,
          workspaceId: tokenData.teamId || null,
          additionalData: { workspaceName: tokenData.teamName || tokenData.teamId || provider },
        });
      }

      res.redirect(`/meetings?connected=${provider}`);
    } catch (error: any) {
      console.error(`OAuth callback error for ${req.params.provider}:`, error);
      res.redirect(`/meetings?error=oauth_failed&provider=${req.params.provider}`);
    }
  });

  // Disconnect a provider
  app.post("/api/integrations/meetings/:provider/disconnect", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { provider } = req.params;
      const integration = await storage.getIntegrationByProvider(userId, provider);
      if (integration) {
        await storage.updateIntegration(integration.id, {
          accessToken: null,
          refreshToken: null,
          isConnected: false,
        });
      }

      if (provider === "google_meet") {
        try {
          const googleMeetService = await import("./services/google-meet-service");
          googleMeetService.removeToken(userId);
        } catch (e) {}
      }

      if (provider === "zoom") {
        try {
          const zoomService = await import("./services/zoom-service");
          zoomService.removeToken(userId);
        } catch (e) {}
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error disconnecting integration:", error);
      res.status(500).json({ error: "Failed to disconnect" });
    }
  });

  // Import conversations from a connected provider
  app.post("/api/integrations/meetings/:provider/import", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { provider } = req.params;
      const integration = await storage.getIntegrationByProvider(userId, provider);
      if (!integration || !integration.isConnected || !integration.accessToken) {
        return res.status(400).json({ error: `${provider} is not connected` });
      }
      
      let conversations: any[] = [];
      switch (provider) {
        case "slack": conversations = await meetingIntegrations.fetchSlackConversations(integration.accessToken); break;
        case "zoom": conversations = await meetingIntegrations.fetchZoomTranscripts(integration.accessToken); break;
        case "google_meet": conversations = await meetingIntegrations.fetchGoogleMeetTranscripts(integration.accessToken); break;
        case "teams": conversations = await meetingIntegrations.fetchTeamsTranscripts(integration.accessToken); break;
        default: return res.status(400).json({ error: "Invalid provider" });
      }
      
      // Save imported conversations
      const imported = [];
      for (const conv of conversations) {
        const saved = await storage.createConversation({
          userId,
          title: conv.title,
          source: conv.source,
          content: conv.content,
          participants: conv.participants,
          meetingDate: conv.meetingDate,
          tags: [],
        });
        imported.push(saved);
      }
      
      // Update last synced
      await storage.updateIntegration(integration.id, { lastSynced: new Date() });
      
      res.json({ imported: imported.length, conversations: imported });
    } catch (error: any) {
      console.error(`Error importing from ${req.params.provider}:`, error);
      res.status(500).json({ error: `Failed to import from ${req.params.provider}` });
    }
  });

  // ==================== Microsoft Teams Meetings ====================

  function createTeamsOAuthState(userId: string): string {
    const hmacSecret = process.env.MICROSOFT_CLIENT_SECRET || "teams-oauth-fallback";
    const nonce = crypto.randomBytes(8).toString("hex");
    const ts = Date.now().toString();
    const payload = `${userId}:${nonce}:${ts}`;
    const sig = crypto.createHmac("sha256", hmacSecret).update(payload).digest("hex").slice(0, 16);
    return Buffer.from(JSON.stringify({ u: userId, n: nonce, t: ts, s: sig })).toString("base64url");
  }

  function verifyTeamsOAuthState(state: string): string | null {
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
      const hmacSecret = process.env.MICROSOFT_CLIENT_SECRET || "teams-oauth-fallback";
      const payload = `${decoded.u}:${decoded.n}:${decoded.t}`;
      const expectedSig = crypto.createHmac("sha256", hmacSecret).update(payload).digest("hex").slice(0, 16);
      if (expectedSig !== decoded.s) return null;
      const elapsed = Date.now() - parseInt(decoded.t);
      if (elapsed > 10 * 60 * 1000) return null;
      return decoded.u;
    } catch {
      return null;
    }
  }

  app.get("/api/teams/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const teamsService = await import("./services/teams-service");
      let connected = teamsService.hasToken(userId);
      if (!connected) {
        const integration = await storage.getIntegrationByProvider(userId, "teams");
        if (integration?.refreshToken) {
          try {
            const newTokens = await teamsService.refreshAccessToken(integration.refreshToken);
            teamsService.storeToken(userId, newTokens.access_token, newTokens.refresh_token || integration.refreshToken, newTokens.expires_in);
            await storage.updateIntegration(integration.id, {
              accessToken: newTokens.access_token,
              refreshToken: newTokens.refresh_token || integration.refreshToken,
            });
            connected = true;
            console.log(`[Teams] Rehydrated token for user ${userId} via refresh`);
          } catch (refreshErr: any) {
            console.log(`[Teams] Token refresh failed for user ${userId}, need to reconnect:`, refreshErr.message);
            connected = false;
          }
        } else if (integration?.accessToken) {
          teamsService.storeToken(userId, integration.accessToken, "", 300);
          connected = true;
          console.log(`[Teams] Rehydrated token for user ${userId} from DB (no refresh token, may be expired)`);
        }
      }
      res.json({
        configured: teamsService.isTeamsConfigured(),
        connected,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get Teams status" });
    }
  });

  app.get("/api/teams/connect", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const teamsService = await import("./services/teams-service");
      if (!teamsService.isTeamsConfigured()) {
        return res.status(501).json({ message: "Microsoft Teams OAuth credentials not configured." });
      }
      const state = createTeamsOAuthState(userId);
      const url = teamsService.getAuthUrl(state);
      console.log(`[Teams OAuth] Connect: userId=${userId}, redirectUri=${teamsService.getRedirectUri ? teamsService.getRedirectUri() : "N/A"}`);
      res.json({ url });
    } catch (error: any) {
      console.error("Teams connect error:", error);
      res.status(500).json({ error: "Failed to generate Teams auth URL" });
    }
  });

  app.get("/api/teams/oauth/callback", async (req: any, res) => {
    try {
      const { code, state, error: oauthError } = req.query;
      console.log(`[Teams OAuth] Callback hit: hasCode=${!!code}, hasState=${!!state}, error=${oauthError || "none"}`);

      if (oauthError) {
        console.log(`[Teams OAuth] Microsoft returned error: ${oauthError}`);
        return res.redirect(`/meetings?teams_error=${encodeURIComponent(String(oauthError))}`);
      }

      if (!code || !state) {
        return res.redirect("/meetings?teams_error=missing_code");
      }

      const userId = verifyTeamsOAuthState(state as string);
      if (!userId) {
        console.log(`[Teams OAuth] Invalid or expired state parameter`);
        return res.redirect("/meetings?teams_error=expired_state");
      }

      console.log(`[Teams OAuth] Valid state for userId=${userId}, exchanging code...`);

      const teamsService = await import("./services/teams-service");
      const tokens = await teamsService.exchangeCodeForToken(code as string);
      teamsService.storeToken(userId, tokens.access_token, tokens.refresh_token || "", tokens.expires_in);

      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        console.log(`[Teams OAuth] User ${userId} not in users table, creating stub entry...`);
        try {
          await storage.upsertUser({
            id: userId,
            username: `user_${userId}`,
            email: `${userId}@placeholder.local`,
          });
        } catch (upsertErr: any) {
          console.log(`[Teams OAuth] User upsert note: ${upsertErr.message}`);
        }
      }

      const existing = await storage.getIntegrationByProvider(userId, "teams");
      if (existing) {
        await storage.updateIntegration(existing.id, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
        });
      } else {
        await storage.createIntegration({
          userId,
          provider: "teams",
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
        });
      }

      console.log(`[Teams OAuth] Successfully connected for user ${userId}`);
      res.redirect("/meetings?connected=teams");
    } catch (error: any) {
      console.error("[Teams OAuth] Callback error:", error);
      const errMsg = encodeURIComponent(error.message || "auth_failed");
      res.redirect(`/meetings?teams_error=${errMsg}`);
    }
  });

  app.delete("/api/teams/disconnect", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const teamsService = await import("./services/teams-service");
      teamsService.removeToken(userId);
      const integration = await storage.getIntegrationByProvider(userId, "teams");
      if (integration) {
        await storage.updateIntegration(integration.id, { accessToken: null, refreshToken: null });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Teams disconnect error:", error);
      res.status(500).json({ error: "Failed to disconnect Teams" });
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // AI Meeting Intelligence — bulk-transcript MOM processor
  // ────────────────────────────────────────────────────────────────────
  // Endpoints are auth-required + rate-limited (LLM call per transcript can
  // be expensive). Heavy lifting lives in services/meeting-intelligence-service.
  {
    const {
      processTranscript,
      enqueueBulkTranscripts,
      listIntelligenceDocuments,
      getIntelligenceDocument,
      listIntelligenceBatches,
      getIntelligenceBatch,
      getBatchSummary,
      retryFailedDocuments,
      reprocessDocument,
      startIntelligenceWorker,
      describeOpenAIKeyProblem,
    } = await import("./services/meeting-intelligence-service");

    // Start the background queue worker exactly once (the function itself is
    // idempotent — repeat calls return the existing handle). The worker
    // claims 'queued' rows from the documents table and runs the same
    // extraction pipeline the synchronous endpoint uses, with concurrency
    // capped so we don't blow through OpenAI rate limits.
    startIntelligenceWorker({
      concurrency: parseInt(
        process.env.MEETING_INTELLIGENCE_CONCURRENCY || "5",
        10,
      ),
    });

    app.post(
      "/api/meetings/intelligence/process",
      isAuthenticated,
      apiLimiter,
      async (req: any, res) => {
        try {
          const userId = req.user?.dbUserId || req.user?.claims?.sub;
          if (!userId) return res.status(401).json({ error: "Unauthorized" });

          // Pre-flight: bail out with a clear actionable error if the
          // OpenAI key isn't configured, instead of letting the worker
          // hit a 401 from OpenAI and write a cryptic failure row.
          const keyProblem = (await userHasOwnKey(userId)) ? null : describeOpenAIKeyProblem();
          if (keyProblem) {
            return res.status(400).json({
              error: keyProblem,
              code: "OPENAI_KEY_NOT_CONFIGURED",
            });
          }

          const {
            transcript_text,
            project_name,
            department,
            meeting_source,
            meeting_date,
            participants,
            transcript_id,
          } = req.body || {};

          if (typeof transcript_text !== "string" || transcript_text.trim().length < 20) {
            return res.status(400).json({
              error: "transcript_text is required (≥20 chars)",
            });
          }
          if (typeof meeting_source !== "string" || !meeting_source.trim()) {
            return res.status(400).json({ error: "meeting_source is required" });
          }

          const safeParticipants = Array.isArray(participants)
            ? participants.filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim())
            : [];

          const doc = await processTranscript({
            userId,
            transcriptText: transcript_text,
            projectName:
              typeof project_name === "string" && project_name.trim()
                ? project_name.trim()
                : null,
            department:
              typeof department === "string" && department.trim()
                ? department.trim()
                : null,
            meetingSource: meeting_source.trim(),
            meetingDate:
              typeof meeting_date === "string" && meeting_date.trim()
                ? meeting_date.trim()
                : null,
            participants: safeParticipants,
            transcriptId:
              typeof transcript_id === "string" && transcript_id.trim()
                ? transcript_id.trim()
                : undefined,
          });
          res.json(doc);
        } catch (error: any) {
          console.error("[meeting-intelligence] route error:", error);
          res.status(500).json({
            error: error?.message || "Processing failed",
          });
        }
      },
    );

    app.get(
      "/api/meetings/intelligence/documents",
      isAuthenticated,
      async (req: any, res) => {
        try {
          const userId = req.user?.dbUserId || req.user?.claims?.sub;
          if (!userId) return res.status(401).json({ error: "Unauthorized" });
          const limit = Math.min(
            Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1),
            200,
          );
          const docs = await listIntelligenceDocuments(userId, limit);
          res.json(docs);
        } catch (error: any) {
          console.error("[meeting-intelligence] list error:", error);
          res.status(500).json({ error: "Failed to list documents" });
        }
      },
    );

    app.get(
      "/api/meetings/intelligence/documents/:id",
      isAuthenticated,
      async (req: any, res) => {
        try {
          const userId = req.user?.dbUserId || req.user?.claims?.sub;
          if (!userId) return res.status(401).json({ error: "Unauthorized" });
          const id = parseInt(req.params.id, 10);
          if (!Number.isFinite(id)) {
            return res.status(400).json({ error: "Invalid id" });
          }
          const doc = await getIntelligenceDocument(userId, id);
          // Return 404 (not 403) on ownership mismatch to prevent enumeration.
          if (!doc) return res.status(404).json({ error: "Not found" });
          res.json(doc);
        } catch (error: any) {
          console.error("[meeting-intelligence] get error:", error);
          res.status(500).json({ error: "Failed to fetch document" });
        }
      },
    );

    // Re-extract: re-queues a completed/failed document so the worker
    // re-runs the (current) extraction prompt. The primary use case is
    // backfilling evidence_quotes onto docs processed before that field
    // was added — no re-upload of the transcript required.
    app.post(
      "/api/meetings/intelligence/documents/:id/reprocess",
      isAuthenticated,
      apiLimiter,
      async (req: any, res) => {
        try {
          const userId = req.user?.dbUserId || req.user?.claims?.sub;
          if (!userId) return res.status(401).json({ error: "Unauthorized" });

          const keyProblem = (await userHasOwnKey(userId)) ? null : describeOpenAIKeyProblem();
          if (keyProblem) {
            return res
              .status(400)
              .json({ error: keyProblem, code: "OPENAI_KEY_NOT_CONFIGURED" });
          }

          const id = parseInt(req.params.id, 10);
          if (!Number.isFinite(id)) {
            return res.status(400).json({ error: "Invalid id" });
          }
          // Ownership: getIntelligenceDocument returns null if the doc
          // belongs to another user. 404 (not 403) to prevent enumeration.
          const existing = await getIntelligenceDocument(userId, id);
          if (!existing) return res.status(404).json({ error: "Not found" });

          // Idempotent: if the doc is already queued/processing from an
          // earlier click, just acknowledge it. No state change needed,
          // no error surfaced to the user — the worker is already on it.
          if (
            existing.status === "queued" ||
            existing.status === "processing"
          ) {
            return res.json({
              requeued: false,
              alreadyQueued: true,
              documentId: id,
              status: existing.status,
            });
          }

          const result = await reprocessDocument({ userId, documentId: id });
          if (!result.requeued) {
            // The window between getIntelligenceDocument and the UPDATE is
            // tiny but real. If a competing process moved the row out of
            // a re-processable state, fall through to a friendly response
            // rather than a hard 409.
            return res.json({
              requeued: false,
              alreadyQueued: false,
              documentId: id,
              status: existing.status,
            });
          }
          res.json(result);
        } catch (error: any) {
          console.error("[meeting-intelligence] reprocess error:", error);
          res.status(500).json({ error: "Failed to re-extract document" });
        }
      },
    );

    // ── Bulk processing ────────────────────────────────────────────
    // Accepts an array of transcripts and enqueues them as a single batch.
    // The actual work happens in the background worker; the request returns
    // immediately with the batch id so the UI can start polling progress.
    //
    // Body shape:
    //   {
    //     label?: string,                     // human-readable batch label
    //     defaultMeetingSource?: string,      // used when an item omits one
    //     metadata?: object,
    //     transcripts: [
    //       { transcript_text, transcript_id?, project_name?, department?,
    //         meeting_source?, meeting_date?, participants? }
    //     ]
    //   }
    app.post(
      "/api/meetings/intelligence/batches",
      isAuthenticated,
      apiLimiter,
      async (req: any, res) => {
        try {
          const userId = req.user?.dbUserId || req.user?.claims?.sub;
          if (!userId) return res.status(401).json({ error: "Unauthorized" });

          // Same pre-flight as the single-shot endpoint. Bail out before
          // we write N queued rows the worker can only fail.
          const keyProblem = (await userHasOwnKey(userId)) ? null : describeOpenAIKeyProblem();
          if (keyProblem) {
            return res.status(400).json({
              error: keyProblem,
              code: "OPENAI_KEY_NOT_CONFIGURED",
            });
          }

          const body = req.body || {};
          const arr = Array.isArray(body.transcripts) ? body.transcripts : null;
          if (!arr || arr.length === 0) {
            return res
              .status(400)
              .json({ error: "transcripts must be a non-empty array" });
          }
          // Defensive cap so a runaway client can't enqueue a million items
          // in one request. Real bulk uploads should chunk client-side.
          const MAX_BULK = 2_500;
          if (arr.length > MAX_BULK) {
            return res.status(400).json({
              error: `Too many transcripts in one request. Cap is ${MAX_BULK}; chunk client-side.`,
            });
          }

          const result = await enqueueBulkTranscripts({
            userId,
            label: typeof body.label === "string" ? body.label : undefined,
            defaultMeetingSource:
              typeof body.defaultMeetingSource === "string"
                ? body.defaultMeetingSource
                : undefined,
            metadata: body.metadata || undefined,
            transcripts: arr.map((t: any) => ({
              transcriptText: String(t?.transcript_text ?? ""),
              transcriptId:
                typeof t?.transcript_id === "string" ? t.transcript_id : undefined,
              projectName:
                typeof t?.project_name === "string" ? t.project_name : null,
              department:
                typeof t?.department === "string" ? t.department : null,
              meetingSource:
                typeof t?.meeting_source === "string"
                  ? t.meeting_source
                  : undefined,
              meetingDate:
                typeof t?.meeting_date === "string" ? t.meeting_date : null,
              participants: Array.isArray(t?.participants)
                ? t.participants.filter(
                    (p: any) => typeof p === "string" && p.trim(),
                  )
                : [],
            })),
          });
          res.status(201).json(result);
        } catch (error: any) {
          console.error("[meeting-intelligence] enqueue error:", error);
          res.status(500).json({ error: "Failed to enqueue batch" });
        }
      },
    );

    app.get(
      "/api/meetings/intelligence/batches",
      isAuthenticated,
      async (req: any, res) => {
        try {
          const userId = req.user?.dbUserId || req.user?.claims?.sub;
          if (!userId) return res.status(401).json({ error: "Unauthorized" });
          const limit = Math.min(
            Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1),
            200,
          );
          const batches = await listIntelligenceBatches(userId, limit);
          res.json(batches);
        } catch (error: any) {
          console.error("[meeting-intelligence] list batches error:", error);
          res.status(500).json({ error: "Failed to list batches" });
        }
      },
    );

    // Retry every failed document in a batch (or, when ?all=1 is passed
    // without a batch id, every failed document the user owns). Useful
    // after fixing an env-level problem like a missing OpenAI key.
    app.post(
      "/api/meetings/intelligence/batches/:id/retry",
      isAuthenticated,
      apiLimiter,
      async (req: any, res) => {
        try {
          const userId = req.user?.dbUserId || req.user?.claims?.sub;
          if (!userId) return res.status(401).json({ error: "Unauthorized" });

          // Don't even re-queue the rows if the key still isn't set —
          // they'll just fail again immediately.
          const keyProblem = (await userHasOwnKey(userId)) ? null : describeOpenAIKeyProblem();
          if (keyProblem) {
            return res.status(400).json({
              error: keyProblem,
              code: "OPENAI_KEY_NOT_CONFIGURED",
            });
          }
          const id = parseInt(req.params.id, 10);
          if (!Number.isFinite(id)) {
            return res.status(400).json({ error: "Invalid id" });
          }
          // Ownership check: getIntelligenceBatch returns null if the batch
          // belongs to another user, so we 404 (not 403) for enumeration.
          const exists = await getIntelligenceBatch(userId, id);
          if (!exists) return res.status(404).json({ error: "Not found" });
          const result = await retryFailedDocuments({ userId, batchId: id });
          res.json(result);
        } catch (error: any) {
          console.error("[meeting-intelligence] retry error:", error);
          res.status(500).json({ error: "Failed to retry batch" });
        }
      },
    );

    app.get(
      "/api/meetings/intelligence/batches/:id",
      isAuthenticated,
      async (req: any, res) => {
        try {
          const userId = req.user?.dbUserId || req.user?.claims?.sub;
          if (!userId) return res.status(401).json({ error: "Unauthorized" });
          const id = parseInt(req.params.id, 10);
          if (!Number.isFinite(id)) {
            return res.status(400).json({ error: "Invalid id" });
          }
          const data = await getIntelligenceBatch(userId, id);
          if (!data) return res.status(404).json({ error: "Not found" });
          res.json(data);
        } catch (error: any) {
          console.error("[meeting-intelligence] get batch error:", error);
          res.status(500).json({ error: "Failed to fetch batch" });
        }
      },
    );

    // Aggregated MOM for an entire batch: every completed doc's items
    // merged together, with each item carrying the list of source docs
    // (and verbatim quotes when present) that produced it. This is the
    // "all-meetings-in-one" view the user can use to spot cross-meeting
    // patterns. Returns same 404 shape on ownership mismatch.
    app.get(
      "/api/meetings/intelligence/batches/:id/summary",
      isAuthenticated,
      async (req: any, res) => {
        try {
          const userId = req.user?.dbUserId || req.user?.claims?.sub;
          if (!userId) return res.status(401).json({ error: "Unauthorized" });
          const id = parseInt(req.params.id, 10);
          if (!Number.isFinite(id)) {
            return res.status(400).json({ error: "Invalid id" });
          }
          const data = await getBatchSummary(userId, id);
          if (!data) return res.status(404).json({ error: "Not found" });
          res.json(data);
        } catch (error: any) {
          console.error("[meeting-intelligence] batch summary error:", error);
          res.status(500).json({ error: "Failed to build batch summary" });
        }
      },
    );
  }

  app.get("/api/teams/meetings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const meetings = await storage.getTeamsMeetings(userId);
      res.json(meetings);
    } catch (error: any) {
      console.error("Error fetching Teams meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.post("/api/teams/meetings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { subject, startTime, endTime, attendees, timeZone } = req.body;
      if (!subject || !startTime || !endTime) {
        return res.status(400).json({ error: "Subject, startTime, and endTime are required" });
      }

      const teamsService = await import("./services/teams-service");
      let token = await teamsService.getValidToken(userId);
      if (!token) {
        const integration = await storage.getIntegrationByProvider(userId, "teams");
        if (integration?.refreshToken) {
          try {
            const newTokens = await teamsService.refreshAccessToken(integration.refreshToken);
            teamsService.storeToken(userId, newTokens.access_token, newTokens.refresh_token || integration.refreshToken, newTokens.expires_in);
            await storage.updateIntegration(integration.id, {
              accessToken: newTokens.access_token,
              refreshToken: newTokens.refresh_token || integration.refreshToken,
            });
            token = newTokens.access_token;
            console.log(`[Teams] Refreshed token for meeting creation, user ${userId}`);
          } catch (refreshErr: any) {
            console.log(`[Teams] Token refresh failed during meeting creation:`, refreshErr.message);
          }
        }
      }
      if (!token) return res.status(401).json({ error: "Not connected to Teams. Please reconnect your account." });

      const attendeeList = attendees || [];
      const meeting = await teamsService.createOnlineMeeting(token, subject, startTime, endTime, attendeeList, timeZone || "UTC");
      const usedCalendarApi = meeting.meetingType === "calendar" || attendeeList.length > 0;
      const meetingIdValue = usedCalendarApi ? `calendar:${meeting.id}` : meeting.id;

      const joinLink = meeting.joinWebUrl || meeting.joinUrl || null;
      console.log(`[Teams] Meeting created: type=${meeting.meetingType}, joinUrl=${joinLink}, id=${meetingIdValue}`);

      const tz = timeZone || "UTC";
      const startNaive = isNaiveDatetime(meeting.startDateTime);
      const endNaive = isNaiveDatetime(meeting.endDateTime);
      const saved = await storage.createTeamsMeeting({
        userId,
        meetingId: meetingIdValue,
        subject: meeting.subject,
        startTime: startNaive ? naiveToUtc(meeting.startDateTime, tz) : new Date(meeting.startDateTime),
        endTime: endNaive ? naiveToUtc(meeting.endDateTime, tz) : new Date(meeting.endDateTime),
        joinUrl: joinLink,
        threadId: meeting.chatInfo?.threadId || null,
        attendees: attendees || [],
        status: "scheduled",
      });
      res.json({ ...saved, meetingType: meeting.meetingType });
    } catch (error: any) {
      console.error("Error creating Teams meeting:", error);
      res.status(500).json({ error: "Failed to create meeting: " + error.message });
    }
  });

  app.patch("/api/teams/meetings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getTeamsMeeting(meetingId);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      const { subject, startTime, endTime, attendees, description, timeZone } = req.body;

      const teamsService = await import("./services/teams-service");
      let token = await teamsService.getValidToken(userId);
      if (!token) {
        const integration = await storage.getIntegrationByProvider(userId, "teams");
        if (integration?.refreshToken) {
          try {
            const newTokens = await teamsService.refreshAccessToken(integration.refreshToken);
            teamsService.storeToken(userId, newTokens.access_token, newTokens.refresh_token || integration.refreshToken, newTokens.expires_in);
            token = newTokens.access_token;
          } catch (refreshErr: any) {
            console.log(`[Teams] Token refresh failed during meeting update:`, refreshErr.message);
          }
        }
      }

      const calendarEventId = meeting.meetingId?.startsWith("calendar:") ? meeting.meetingId.replace("calendar:", "") : null;
      if (token && calendarEventId) {
        try {
          await teamsService.updateCalendarEvent(token, calendarEventId, {
            subject, startTime, endTime, attendees, description, timeZone: timeZone || "UTC",
          });
          console.log(`[Teams] Calendar event ${calendarEventId} updated successfully`);
        } catch (calErr: any) {
          console.log(`[Teams] Calendar event update failed (updating local only): ${calErr.message}`);
        }
      }

      const tz = timeZone || "UTC";
      const updateData: any = {};
      if (subject) updateData.subject = subject;
      if (startTime) updateData.startTime = naiveToUtc(startTime, tz);
      if (endTime) updateData.endTime = naiveToUtc(endTime, tz);
      if (attendees) updateData.attendees = attendees;

      const updated = await storage.updateTeamsMeeting(meetingId, updateData);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating Teams meeting:", error);
      res.status(500).json({ error: "Failed to update meeting: " + error.message });
    }
  });

  app.post("/api/teams/meetings/:id/fetch-transcript", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getTeamsMeeting(meetingId);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      if (!meeting.meetingId || meeting.meetingId.startsWith("local:")) {
        return res.status(400).json({ error: "Cannot fetch transcript for this meeting type. Use 'Paste Transcript' instead." });
      }

      const teamsService = await import("./services/teams-service");
      let token = await teamsService.getValidToken(userId);
      if (!token) {
        const integration = await storage.getIntegrationByProvider(userId, "teams");
        if (integration?.refreshToken) {
          try {
            const newTokens = await teamsService.refreshAccessToken(integration.refreshToken);
            teamsService.storeToken(userId, newTokens.access_token, newTokens.refresh_token || integration.refreshToken, newTokens.expires_in);
            await storage.updateIntegration(integration.id, {
              accessToken: newTokens.access_token,
              refreshToken: newTokens.refresh_token || integration.refreshToken,
            });
            token = newTokens.access_token;
          } catch {}
        }
      }
      if (!token) {
        return res.status(401).json({ error: "Not connected to Teams. Please reconnect." });
      }

      let onlineMeetingId: string | null = null;

      const joinUrl = meeting.joinUrl || "";
      const hasTeamsJoinLink = joinUrl && !joinUrl.includes("outlook.live.com") && !joinUrl.includes("outlook.office");
      const rawMeetingId = meeting.meetingId || "";
      const isCalendarId = rawMeetingId.startsWith("calendar:") || rawMeetingId.startsWith("AQMk");

      console.log(`[Teams] Fetch transcript: meetingId=${rawMeetingId.substring(0, 30)}..., joinUrl=${joinUrl.substring(0, 60)}..., isCalendarId=${isCalendarId}, hasTeamsJoinLink=${hasTeamsJoinLink}`);

      if (hasTeamsJoinLink) {
        console.log(`[Teams] Looking up online meeting by join URL: ${joinUrl}`);
        onlineMeetingId = await teamsService.findOnlineMeetingByJoinUrl(token, joinUrl);
        if (onlineMeetingId) {
          console.log(`[Teams] Found online meeting ID via join URL: ${onlineMeetingId}`);
        }
      }

      if (!onlineMeetingId && isCalendarId) {
        const calendarEventId = rawMeetingId.replace("calendar:", "");
        console.log(`[Teams] Fetching calendar event details for ${calendarEventId.substring(0, 30)}...`);
        const eventDetails = await teamsService.getCalendarEventDetails(token, calendarEventId);
        const eventJoinUrl = eventDetails?.onlineMeeting?.joinUrl || eventDetails?.onlineMeetingUrl || "";
        if (eventJoinUrl && !eventJoinUrl.includes("outlook.live.com") && !eventJoinUrl.includes("outlook.office")) {
          console.log(`[Teams] Found join URL from calendar event: ${eventJoinUrl}`);
          onlineMeetingId = await teamsService.findOnlineMeetingByJoinUrl(token, eventJoinUrl);
          if (onlineMeetingId) {
            console.log(`[Teams] Found online meeting ID via calendar event: ${onlineMeetingId}`);
          }
        }
      }

      if (!onlineMeetingId && !isCalendarId) {
        onlineMeetingId = rawMeetingId;
      }

      if (!onlineMeetingId) {
        const reason = !hasTeamsJoinLink
          ? "This meeting doesn't have a Teams join link. Transcripts are only available for meetings that were held on Microsoft Teams with transcription enabled."
          : "Could not find the online meeting record for this meeting. It may not have been started yet, or transcription was not enabled during the call.";
        return res.status(400).json({
          error: `${reason} You can use 'Paste Transcript' to add one manually.`
        });
      }

      try {
        console.log(`[Teams] Fetching transcripts for online meeting: ${onlineMeetingId}`);
        const transcripts = await teamsService.getMeetingTranscripts(token, onlineMeetingId);
        if (!transcripts || transcripts.length === 0) {
          return res.status(404).json({ error: "No transcripts available yet. Make sure the meeting was held and transcription was enabled during the call." });
        }

        let fullTranscript = "";
        for (const t of transcripts) {
          const content = await teamsService.getTranscriptContent(token, onlineMeetingId, t.id);
          fullTranscript += content + "\n\n";
        }
        fullTranscript = fullTranscript.trim();

        const updated = await storage.updateTeamsMeeting(meetingId, {
          transcript: fullTranscript,
          status: "completed",
        });

        await storage.createConversation({
          userId,
          title: `Teams: ${meeting.subject}`,
          source: "teams",
          content: fullTranscript,
          participants: meeting.attendees || [],
          tags: ["teams", "transcript"],
        });

        res.json(updated);
      } catch (graphErr: any) {
        console.error("Graph API transcript error:", graphErr);
        if (graphErr.message?.includes("NotFound") || graphErr.message?.includes("not supported")) {
          return res.status(400).json({
            error: "Transcript fetching is not supported for this meeting type. You can manually add a transcript using the 'Paste Transcript' option instead."
          });
        }
        res.status(500).json({ error: "Failed to fetch transcript from Microsoft Graph" });
      }
    } catch (error: any) {
      console.error("Error fetching transcript:", error);
      res.status(500).json({ error: "Failed to fetch transcript" });
    }
  });

  app.post("/api/teams/meetings/:id/save-transcript", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getTeamsMeeting(meetingId);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      const { transcript } = req.body;
      if (!transcript || typeof transcript !== "string") {
        return res.status(400).json({ error: "Transcript text is required" });
      }
      const cleanTranscript = transcript.replace(/\x00/g, "");
      const updated = await storage.updateTeamsMeeting(meetingId, {
        transcript: cleanTranscript,
        status: "completed",
      });

      await storage.createConversation({
        userId,
        title: `Teams: ${meeting.subject}`,
        source: "teams",
        content: cleanTranscript,
        participants: meeting.attendees || [],
        tags: ["teams", "transcript"],
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error saving transcript:", error);
      res.status(500).json({ error: "Failed to save transcript" });
    }
  });

  app.post("/api/teams/meetings/:id/generate-plan", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getTeamsMeeting(meetingId);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      if (!meeting.transcript) {
        return res.status(400).json({ error: "No transcript available to generate plan from" });
      }

      // Route through the provider abstraction so own-key (Claude) users are
      // billed on their own key and never touch the platform OpenAI key.
      const aiData = await getAiClient().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a project management AI. Analyze the meeting transcript and generate a structured project plan. Return a JSON object with: name (string), description (string), tasks (array of {name, description, priority: high|medium|low, dueDate?}), milestones (array of {name, date?}). Only return valid JSON, no markdown.",
          },
          {
            role: "user",
            content: `Generate a project plan from this meeting transcript:\n\n${meeting.transcript.substring(0, 8000)}`,
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const planText = aiData.choices?.[0]?.message?.content;
      let plan;
      try {
        plan = JSON.parse(planText);
      } catch {
        plan = { name: meeting.subject, description: "Generated plan", tasks: [], milestones: [] };
      }

      const updated = await storage.updateTeamsMeeting(meetingId, { projectPlan: plan });
      res.json({ meeting: updated, plan });
    } catch (error: any) {
      console.error("Error generating plan:", error);
      res.status(500).json({ error: "Failed to generate project plan" });
    }
  });

  app.delete("/api/teams/meetings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getTeamsMeeting(meetingId);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      await storage.deleteTeamsMeeting(meetingId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting meeting:", error);
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  // ==================== Google Meet Meetings ====================

  app.get("/api/google-meet/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const integration = await storage.getIntegrationByProvider(userId, "google_meet");
      if (!integration || (!integration.accessToken && !integration.refreshToken)) {
        return res.json({ connected: false });
      }

      const googleMeetService = await import("./services/google-meet-service");
      let token = googleMeetService.getValidToken(userId);

      if (!token && integration.refreshToken) {
        try {
          const newTokens = await googleMeetService.refreshAccessToken(integration.refreshToken);
          googleMeetService.storeToken(userId, newTokens.access_token, newTokens.refresh_token || integration.refreshToken, newTokens.expires_in);
          await storage.updateIntegration(integration.id, {
            accessToken: newTokens.access_token,
            refreshToken: newTokens.refresh_token || integration.refreshToken,
          });
          token = newTokens.access_token;
        } catch (err: any) {
          console.log(`[Google Meet] Token refresh failed for ${userId}:`, err.message);
          return res.json({ connected: false, error: "Token expired. Please reconnect." });
        }
      }

      if (!token && integration.accessToken) {
        token = integration.accessToken;
        if (integration.refreshToken) {
          googleMeetService.storeToken(userId, token, integration.refreshToken, 3600);
        }
      }

      if (!token) {
        return res.json({ connected: false });
      }

      res.json({ connected: true });
    } catch (error: any) {
      console.error("[Google Meet] Status error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/google-meet/meetings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const meetings = await storage.getGoogleMeetMeetings(userId);
      res.json(meetings);
    } catch (error: any) {
      console.error("[Google Meet] List meetings error:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.post("/api/google-meet/meetings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { subject, startTime, endTime, attendees, description, timeZone } = req.body;
      if (!subject || !startTime || !endTime) {
        return res.status(400).json({ error: "Subject, startTime, and endTime are required" });
      }

      const googleMeetService = await import("./services/google-meet-service");
      const integration = await storage.getIntegrationByProvider(userId, "google_meet");

      let token = googleMeetService.getValidToken(userId);
      if (!token && integration?.refreshToken) {
        try {
          const newTokens = await googleMeetService.refreshAccessToken(integration.refreshToken);
          googleMeetService.storeToken(userId, newTokens.access_token, newTokens.refresh_token || integration.refreshToken, newTokens.expires_in);
          await storage.updateIntegration(integration.id, {
            accessToken: newTokens.access_token,
            refreshToken: newTokens.refresh_token || integration.refreshToken,
          });
          token = newTokens.access_token;
        } catch {}
      }
      if (!token && integration?.accessToken) {
        token = integration.accessToken;
      }
      if (!token) {
        return res.status(401).json({ error: "Not connected to Google. Please connect your Google account first." });
      }

      const event = await googleMeetService.createMeetingWithGoogleMeet(
        token,
        subject,
        startTime,
        endTime,
        attendees || [],
        description || "",
        timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      );

      const meeting = await storage.createGoogleMeetMeeting({
        userId,
        subject: event.subject,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
        meetLink: event.meetLink,
        calendarEventId: event.eventId,
        organizerEmail: event.organizerEmail,
        status: "scheduled",
        attendees: attendees || [],
      });

      res.json(meeting);
    } catch (error: any) {
      console.error("[Google Meet] Create meeting error:", error);
      res.status(500).json({ error: "Failed to create meeting: " + error.message });
    }
  });

  app.patch("/api/google-meet/meetings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getGoogleMeetMeeting(meetingId);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      const { subject, startTime, endTime, attendees, description, timeZone } = req.body;

      const googleMeetService = await import("./services/google-meet-service");

      if (meeting.calendarEventId) {
        const integration = await storage.getIntegrationByProvider(userId, "google_meet");
        let token = googleMeetService.getValidToken(userId);
        if (!token && integration?.refreshToken) {
          try {
            const newTokens = await googleMeetService.refreshAccessToken(integration.refreshToken);
            googleMeetService.storeToken(userId, newTokens.access_token, newTokens.refresh_token || integration.refreshToken, newTokens.expires_in);
            await storage.updateIntegration(integration.id, {
              accessToken: newTokens.access_token,
              refreshToken: newTokens.refresh_token || integration.refreshToken,
            });
            token = newTokens.access_token;
          } catch {}
        }
        if (!token && integration?.accessToken) {
          token = integration.accessToken;
        }

        if (token) {
          try {
            await googleMeetService.updateCalendarEvent(
              token,
              meeting.calendarEventId,
              subject || meeting.subject,
              startTime || meeting.startTime.toISOString(),
              endTime || meeting.endTime.toISOString(),
              attendees || meeting.attendees || [],
              description || "",
              timeZone || "UTC"
            );
          } catch (err: any) {
            console.log(`[Google Meet] Calendar update failed (updating local only): ${err.message}`);
          }
        }
      }

      const tz = timeZone || "UTC";
      const updates: any = {};
      if (subject) updates.subject = subject;
      if (startTime) updates.startTime = naiveToUtc(startTime, tz);
      if (endTime) updates.endTime = naiveToUtc(endTime, tz);
      if (attendees) updates.attendees = attendees;

      const updated = await storage.updateGoogleMeetMeeting(meetingId, updates);
      res.json(updated);
    } catch (error: any) {
      console.error("[Google Meet] Update meeting error:", error);
      res.status(500).json({ error: "Failed to update meeting: " + error.message });
    }
  });

  app.post("/api/google-meet/import-calendar", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const googleMeetService = await import("./services/google-meet-service");
      const integration = await storage.getIntegrationByProvider(userId, "google_meet");

      let token = googleMeetService.getValidToken(userId);
      if (!token && integration?.refreshToken) {
        try {
          const newTokens = await googleMeetService.refreshAccessToken(integration.refreshToken);
          googleMeetService.storeToken(userId, newTokens.access_token, newTokens.refresh_token || integration.refreshToken, newTokens.expires_in);
          await storage.updateIntegration(integration.id, {
            accessToken: newTokens.access_token,
            refreshToken: newTokens.refresh_token || integration.refreshToken,
          });
          token = newTokens.access_token;
        } catch (refreshErr: any) {
          console.error("[Google Meet] Token refresh failed for import-calendar:", refreshErr.message);
          return res.status(401).json({ error: "Google connection expired. Please disconnect and reconnect your Google account." });
        }
      }
      if (!token && integration?.accessToken) {
        token = integration.accessToken;
      }
      if (!token) {
        return res.status(401).json({ error: "Not connected to Google. Please reconnect." });
      }

      const calendarEvents = await googleMeetService.importCalendarMeetings(token);

      const existingMeetings = await storage.getGoogleMeetMeetings(userId);
      const existingEventIds = new Set(existingMeetings.map(m => m.calendarEventId).filter(Boolean));
      const existingMeetLinks = new Set(existingMeetings.map(m => m.meetLink).filter(Boolean));

      let imported = 0;
      let skipped = 0;
      for (const event of calendarEvents) {
        if (existingEventIds.has(event.eventId)) { skipped++; continue; }
        if (existingMeetLinks.has(event.meetLink)) { skipped++; continue; }

        await storage.createGoogleMeetMeeting({
          userId,
          subject: event.subject,
          startTime: new Date(event.startTime),
          endTime: new Date(event.endTime),
          meetLink: event.meetLink,
          calendarEventId: event.eventId,
          organizerEmail: event.organizerEmail,
          status: new Date(event.endTime) < new Date() ? "completed" : "scheduled",
          attendees: [],
        });
        imported++;
      }

      console.log(`[Google Meet] Import summary: ${imported} new, ${skipped} already existed, ${calendarEvents.length} total from calendar`);
      res.json({ imported, total: calendarEvents.length, skipped });
    } catch (error: any) {
      console.error("[Google Meet] Import calendar error:", error);
      res.status(500).json({ error: "Failed to import calendar events: " + error.message });
    }
  });

  app.post("/api/google-meet/meetings/:id/fetch-transcript", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getGoogleMeetMeeting(meetingId);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      const googleMeetService = await import("./services/google-meet-service");
      const integration = await storage.getIntegrationByProvider(userId, "google_meet");

      let token = googleMeetService.getValidToken(userId);
      if (!token && integration?.refreshToken) {
        try {
          const newTokens = await googleMeetService.refreshAccessToken(integration.refreshToken);
          googleMeetService.storeToken(userId, newTokens.access_token, newTokens.refresh_token || integration.refreshToken, newTokens.expires_in);
          await storage.updateIntegration(integration.id, {
            accessToken: newTokens.access_token,
            refreshToken: newTokens.refresh_token || integration.refreshToken,
          });
          token = newTokens.access_token;
        } catch {}
      }
      if (!token && integration?.accessToken) {
        token = integration.accessToken;
      }
      if (!token) {
        return res.status(401).json({ error: "Not connected to Google. Please reconnect." });
      }

      const result = await googleMeetService.fetchTranscriptPipeline(token, {
        meetLink: meeting.meetLink,
        subject: meeting.subject,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        calendarEventId: meeting.calendarEventId,
        transcriptDocId: (meeting as any).transcriptDocId || null,
        conferenceRecordId: (meeting as any).conferenceRecordId || null,
        meetingCode: (meeting as any).meetingCode || null,
      });

      if (!result) {
        return res.status(404).json({
          error: "No transcript found. Make sure transcription was enabled during the meeting (Settings > Recording > Turn on transcription). Transcripts appear in Drive a few minutes after the meeting ends. You can also paste a transcript manually.",
        });
      }

      const updateData: any = {
        transcript: result.content,
        status: "completed",
      };
      if (result.documentId) updateData.transcriptDocId = result.documentId;
      if (result.conferenceRecordId) updateData.conferenceRecordId = result.conferenceRecordId;
      if (result.meetingCode) updateData.meetingCode = result.meetingCode;

      const updated = await storage.updateGoogleMeetMeeting(meetingId, updateData);

      await storage.createConversation({
        userId,
        title: meeting.subject || "Google Meet Transcript",
        content: result.content,
        source: "google_meet",
        participants: meeting.attendees || [],
        meetingDate: meeting.startTime,
      });

      console.log(`[Google Meet] Transcript fetched via ${result.source} for meeting ${meetingId}`);
      res.json({ transcript: result.content, meeting: updated, source: result.source });
    } catch (error: any) {
      console.error("[Google Meet] Fetch transcript error:", error);
      res.status(500).json({ error: "Failed to fetch transcript: " + error.message });
    }
  });

  app.post("/api/google-meet/meetings/:id/save-transcript", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getGoogleMeetMeeting(meetingId);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      const { transcript } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: "Transcript content is required" });
      }

      const cleanTranscript = transcript.replace(/\x00/g, "");
      const updated = await storage.updateGoogleMeetMeeting(meetingId, {
        transcript: cleanTranscript,
        status: "completed",
      });

      await storage.createConversation({
        userId,
        title: meeting.subject || "Google Meet Transcript",
        content: cleanTranscript,
        source: "google_meet",
        participants: meeting.attendees || [],
        meetingDate: meeting.startTime,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("[Google Meet] Save transcript error:", error);
      res.status(500).json({ error: "Failed to save transcript" });
    }
  });

  app.delete("/api/google-meet/meetings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getGoogleMeetMeeting(meetingId);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      if (meeting.calendarEventId) {
        try {
          const googleMeetService = await import("./services/google-meet-service");
          const integration = await storage.getIntegrationByProvider(userId, "google_meet");
          let token = googleMeetService.getValidToken(userId);
          if (!token && integration?.refreshToken) {
            try {
              const newTokens = await googleMeetService.refreshAccessToken(integration.refreshToken);
              token = newTokens.access_token;
            } catch {}
          }
          if (!token && integration?.accessToken) token = integration.accessToken;
          if (token) {
            await googleMeetService.deleteCalendarEvent(token, meeting.calendarEventId);
          }
        } catch (err: any) {
          console.log(`[Google Meet] Failed to delete calendar event:`, err.message);
        }
      }

      await storage.deleteGoogleMeetMeeting(meetingId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Google Meet] Delete meeting error:", error);
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  // ==================== Zoom Meetings ====================

  app.get("/api/zoom/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ connected: false });
      const integration = await storage.getIntegrationByProvider(userId, "zoom");
      res.json({
        connected: !!integration?.accessToken,
        configured: !!(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET),
      });
    } catch {
      res.json({ connected: false, configured: false });
    }
  });

  app.get("/api/zoom/meetings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const zoomService = await import("./services/zoom-service");
      const integration = await storage.getIntegrationByProvider(userId, "zoom");
      let token = zoomService.getValidToken(userId);
      if (!token && integration?.refreshToken) {
        try {
          const newTokens = await zoomService.refreshAccessToken(integration.refreshToken);
          zoomService.storeToken(userId, newTokens.access_token, newTokens.refresh_token || integration.refreshToken, newTokens.expires_in);
          if (integration.id) {
            await storage.updateIntegration(integration.id, {
              accessToken: newTokens.access_token,
              refreshToken: newTokens.refresh_token || integration.refreshToken,
            });
          }
          token = newTokens.access_token;
        } catch (err: any) {
          console.log("[Zoom] Token refresh failed during sync:", err.message);
        }
      }
      if (!token && integration?.accessToken) token = integration.accessToken;

      if (token) {
        try {
          const zoomMeetings = await zoomService.listMeetings(token);
          const localMeetings = await storage.getZoomMeetings(userId);

          for (const zm of zoomMeetings) {
            const zoomId = String(zm.id);
            const existing = localMeetings.find(m => m.zoomMeetingId === zoomId);

            if (existing) {
              const updates: any = {};
              if (zm.topic && zm.topic !== existing.subject) updates.subject = zm.topic;
              if (zm.start_time) {
                const zoomStart = new Date(zm.start_time);
                const existingStart = new Date(existing.startTime);
                if (Math.abs(zoomStart.getTime() - existingStart.getTime()) > 60000) {
                  updates.startTime = zoomStart;
                  const dur = zm.duration || existing.duration || 60;
                  updates.endTime = new Date(zoomStart.getTime() + dur * 60 * 1000);
                }
              }
              if (zm.duration && zm.duration !== existing.duration) {
                updates.duration = zm.duration;
                const start = updates.startTime || new Date(existing.startTime);
                updates.endTime = new Date(new Date(start).getTime() + zm.duration * 60 * 1000);
              }
              if (zm.join_url && zm.join_url !== existing.joinUrl) updates.joinUrl = zm.join_url;
              if (zm.status) {
                const mappedStatus = zm.status === "waiting" ? "scheduled" : zm.status === "started" ? "in_progress" : zm.status;
                if (mappedStatus !== existing.status) updates.status = mappedStatus;
              }

              if (Object.keys(updates).length > 0) {
                console.log(`[Zoom] Syncing meeting ${zoomId}: ${JSON.stringify(updates)}`);
                await storage.updateZoomMeeting(existing.id, updates);
              }
            }
          }
        } catch (err: any) {
          console.log("[Zoom] Sync from Zoom API failed (returning local data):", err.message);
        }
      }

      const meetings = await storage.getZoomMeetings(userId);
      res.json(meetings);
    } catch (error: any) {
      console.error("[Zoom] Error fetching meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.post("/api/zoom/meetings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { subject, startTime, duration, attendees, description, timeZone } = req.body;
      if (!subject || !startTime) {
        return res.status(400).json({ error: "Subject and start time are required" });
      }

      const zoomService = await import("./services/zoom-service");
      const integration = await storage.getIntegrationByProvider(userId, "zoom");

      let token = zoomService.getValidToken(userId);
      if (!token && integration?.refreshToken) {
        try {
          const newTokens = await zoomService.refreshAccessToken(integration.refreshToken);
          zoomService.storeToken(userId, newTokens.access_token, newTokens.refresh_token || integration.refreshToken, newTokens.expires_in);
          if (integration.id) {
            await storage.updateIntegration(integration.id, {
              accessToken: newTokens.access_token,
              refreshToken: newTokens.refresh_token || integration.refreshToken,
            });
          }
          token = newTokens.access_token;
        } catch (err: any) {
          console.log("[Zoom] Token refresh failed:", err.message);
        }
      }
      if (!token && integration?.accessToken) {
        token = integration.accessToken;
      }
      if (!token) {
        return res.status(401).json({ error: "Not connected to Zoom. Please connect your Zoom account first." });
      }

      const tz = timeZone || "UTC";
      const durationMins = duration || 60;
      const meeting = await zoomService.createMeeting(token, subject, startTime, durationMins, description || "", tz);

      const startUtc = naiveToUtc(startTime, tz);
      const endUtc = new Date(startUtc.getTime() + durationMins * 60 * 1000);

      const saved = await storage.createZoomMeeting({
        userId,
        subject: meeting.topic || subject,
        startTime: startUtc,
        endTime: endUtc,
        duration: durationMins,
        joinUrl: meeting.join_url,
        startUrl: meeting.start_url,
        zoomMeetingId: String(meeting.id),
        status: "scheduled",
        attendees: attendees || [],
        description: description || "",
      });

      if (attendees && attendees.length > 0) {
        zoomService.sendMeetingInvitations(
          attendees,
          subject,
          meeting.join_url,
          startUtc.toISOString(),
          durationMins,
          tz,
        ).catch(err => console.log("[Zoom] Email invitation error:", err.message));
      }

      res.json(saved);
    } catch (error: any) {
      console.error("[Zoom] Create meeting error:", error);
      res.status(500).json({ error: "Failed to create meeting: " + error.message });
    }
  });

  app.patch("/api/zoom/meetings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getZoomMeeting(meetingId);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      const { subject, startTime, duration, attendees, description, timeZone } = req.body;
      const tz = timeZone || "UTC";

      const zoomService = await import("./services/zoom-service");
      if (meeting.zoomMeetingId) {
        const integration = await storage.getIntegrationByProvider(userId, "zoom");
        let token = zoomService.getValidToken(userId);
        if (!token && integration?.refreshToken) {
          try {
            const newTokens = await zoomService.refreshAccessToken(integration.refreshToken);
            zoomService.storeToken(userId, newTokens.access_token, newTokens.refresh_token || integration.refreshToken, newTokens.expires_in);
            token = newTokens.access_token;
          } catch {}
        }
        if (!token && integration?.accessToken) token = integration.accessToken;

        if (token) {
          try {
            const zoomUpdates: any = {};
            if (subject) zoomUpdates.topic = subject;
            if (startTime) zoomUpdates.start_time = startTime;
            if (duration) zoomUpdates.duration = duration;
            if (description) zoomUpdates.agenda = description;
            if (timeZone) zoomUpdates.timezone = timeZone;
            await zoomService.updateMeeting(token, meeting.zoomMeetingId, zoomUpdates);
          } catch (err: any) {
            console.log(`[Zoom] API update failed (updating local only): ${err.message}`);
          }
        }
      }

      const updates: any = {};
      if (subject) updates.subject = subject;
      if (startTime) updates.startTime = naiveToUtc(startTime, tz);
      if (duration) updates.duration = duration;
      if (attendees) updates.attendees = attendees;
      if (description !== undefined) updates.description = description;

      const effectiveStart = startTime ? naiveToUtc(startTime, tz) : meeting.startTime;
      const effectiveDuration = duration || meeting.duration || 60;
      updates.endTime = new Date(new Date(effectiveStart).getTime() + effectiveDuration * 60 * 1000);

      const updated = await storage.updateZoomMeeting(meetingId, updates);

      const effectiveAttendees = attendees || meeting.attendees || [];
      const subjectChanged = subject && subject !== meeting.subject;
      const durationChanged = duration && duration !== meeting.duration;
      const timeChanged = startTime && (
        Math.abs(naiveToUtc(startTime, tz).getTime() - new Date(meeting.startTime).getTime()) > 60000
      );
      const hasRealChanges = subjectChanged || durationChanged || timeChanged;

      if (effectiveAttendees.length > 0 && hasRealChanges) {
        const effectiveSubject = subject || meeting.subject || "Zoom Meeting";
        const effectiveJoinUrl = meeting.joinUrl || "";
        const effectiveStartUtc = startTime ? naiveToUtc(startTime, tz).toISOString() : new Date(meeting.startTime).toISOString();
        const effectiveDur = duration || meeting.duration || 60;
        const emailTz = timeZone || tz;

        zoomService.sendMeetingInvitations(
          effectiveAttendees,
          effectiveSubject + " (Updated)",
          effectiveJoinUrl,
          effectiveStartUtc,
          effectiveDur,
          emailTz,
        ).catch(err => console.log("[Zoom] Update email invitation error:", err.message));
      }

      res.json(updated);
    } catch (error: any) {
      console.error("[Zoom] Update meeting error:", error);
      res.status(500).json({ error: "Failed to update meeting: " + error.message });
    }
  });

  app.delete("/api/zoom/meetings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getZoomMeeting(meetingId);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      if (meeting.zoomMeetingId) {
        try {
          const zoomService = await import("./services/zoom-service");
          const integration = await storage.getIntegrationByProvider(userId, "zoom");
          let token = zoomService.getValidToken(userId);
          if (!token && integration?.refreshToken) {
            try {
              const newTokens = await zoomService.refreshAccessToken(integration.refreshToken);
              token = newTokens.access_token;
            } catch {}
          }
          if (!token && integration?.accessToken) token = integration.accessToken;
          if (token) {
            await zoomService.deleteMeeting(token, meeting.zoomMeetingId);
          }
        } catch (err: any) {
          console.log(`[Zoom] Failed to delete Zoom meeting:`, err.message);
        }
      }

      await storage.deleteZoomMeeting(meetingId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Zoom] Delete meeting error:", error);
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  app.post("/api/zoom/meetings/:id/fetch-transcript", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getZoomMeeting(meetingId);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      if (!meeting.zoomMeetingId) {
        return res.status(400).json({ error: "No Zoom meeting ID. Use 'Paste Transcript' instead." });
      }

      const zoomService = await import("./services/zoom-service");
      const integration = await storage.getIntegrationByProvider(userId, "zoom");
      let token = zoomService.getValidToken(userId);
      if (!token && integration?.refreshToken) {
        try {
          const newTokens = await zoomService.refreshAccessToken(integration.refreshToken);
          zoomService.storeToken(userId, newTokens.access_token, newTokens.refresh_token || integration.refreshToken, newTokens.expires_in);
          if (integration.id) {
            await storage.updateIntegration(integration.id, {
              accessToken: newTokens.access_token,
              refreshToken: newTokens.refresh_token || integration.refreshToken,
            });
          }
          token = newTokens.access_token;
        } catch {}
      }
      if (!token && integration?.accessToken) token = integration.accessToken;
      if (!token) {
        return res.status(401).json({ error: "Not connected to Zoom. Please reconnect." });
      }

      const rawTranscript = await zoomService.fetchTranscript(token, meeting.zoomMeetingId);
      if (!rawTranscript) {
        return res.status(404).json({ error: "No transcript available. Make sure cloud recording and audio transcript are enabled in your Zoom settings, and the meeting has ended." });
      }
      const cleanTranscript = rawTranscript.replace(/\x00/g, "");

      const updated = await storage.updateZoomMeeting(meetingId, {
        transcript: cleanTranscript,
        status: "completed",
      });

      await storage.createConversation({
        userId,
        title: `Zoom: ${meeting.subject}`,
        source: "zoom",
        content: cleanTranscript,
        participants: meeting.attendees || [],
        tags: ["zoom", "transcript"],
      });

      res.json(updated);
    } catch (error: any) {
      console.error("[Zoom] Fetch transcript error:", error);
      res.status(500).json({ error: "Failed to fetch transcript: " + error.message });
    }
  });

  app.post("/api/zoom/meetings/:id/save-transcript", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getZoomMeeting(meetingId);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      const { transcript } = req.body;
      if (!transcript || typeof transcript !== "string") {
        return res.status(400).json({ error: "Transcript text is required" });
      }
      const cleanTranscript = transcript.replace(/\x00/g, "");
      const updated = await storage.updateZoomMeeting(meetingId, {
        transcript: cleanTranscript,
        status: "completed",
      });

      await storage.createConversation({
        userId,
        title: `Zoom: ${meeting.subject}`,
        source: "zoom",
        content: cleanTranscript,
        participants: meeting.attendees || [],
        tags: ["zoom", "transcript"],
      });

      res.json(updated);
    } catch (error: any) {
      console.error("[Zoom] Save transcript error:", error);
      res.status(500).json({ error: "Failed to save transcript" });
    }
  });

  // ==================== Conversations / Meetings ====================

  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const list = await storage.getConversations(userId);
      res.json(list);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { title, source, content, participants, meetingDate, tags } = req.body;
      if (!title || typeof title !== "string" || !content || typeof content !== "string") {
        return res.status(400).json({ error: "Title and content are required strings" });
      }
      const conv = await storage.createConversation({
        userId,
        title: title.trim(),
        source: typeof source === "string" ? source : "manual",
        content: content.trim(),
        participants: Array.isArray(participants) ? participants.filter((p: any) => typeof p === "string") : [],
        meetingDate: meetingDate ? new Date(meetingDate) : null,
        tags: Array.isArray(tags) ? tags.filter((t: any) => typeof t === "string") : [],
      });
      res.json(conv);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.delete("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const id = parseInt(req.params.id);
      const conv = await storage.getConversation(id);
      if (!conv || conv.userId !== userId) return res.status(404).json({ error: "Conversation not found" });
      await storage.deleteConversation(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // ── Meetings search & AI assistant ────────────────────────────────────────
  // Source types covered by the Meetings page (everything except evidence).
  const MEETING_SOURCE_TYPES = ["zoom", "google_meet", "teams", "conversation", "intelligence"];

  // Unified meetings search: semantic-first with keyword fallback. Response
  // carries searchMode so the UI can show a degradation indicator.
  app.get("/api/meetings/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (!q) return res.json({ results: [], searchMode: "none" });

      const { semanticSearchContent, keywordSearchSources } = await import(
        "./services/content-indexer"
      );

      let searchMode: "semantic" | "keyword" = "keyword";
      let hits: any[] = [];
      try {
        const out = await runWithAiContext({ userId }, () =>
          semanticSearchContent(userId, q, {
            topK: 24,
            sourceTypes: MEETING_SOURCE_TYPES,
          }),
        );
        if (out.mode === "semantic") {
          searchMode = "semantic";
          hits = out.hits;
        }
      } catch (err: any) {
        console.error(
          "Semantic meetings search failed, falling back to keyword:",
          err?.message || err,
        );
      }

      if (searchMode === "keyword" || hits.length === 0) {
        const kw = await keywordSearchSources(userId, q, MEETING_SOURCE_TYPES, 24);
        if (searchMode === "keyword") {
          hits = kw;
        } else {
          // Semantic ran but returned nothing — merge keyword matches so
          // results never regress for content not yet indexed.
          hits = kw;
        }
      }

      const results = hits.map((h: any) => ({
        sourceType: h.sourceType,
        sourceId: h.sourceId,
        sourceLabel: h.metadata?.sourceLabel || `${h.sourceType} #${h.sourceId}`,
        snippet: String(h.content || "").slice(0, 400),
        similarity: typeof h.similarity === "number" ? h.similarity : null,
      }));

      res.json({ results, searchMode });
    } catch (error: any) {
      console.error("Error searching meetings:", error);
      res.status(500).json({ error: "Failed to search meetings" });
    }
  });

  // Streaming RAG assistant grounded ONLY in retrieved meeting passages.
  app.post("/api/meetings/ask", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
      if (!question) return res.status(400).json({ error: "Question is required" });
      const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
      const history = rawHistory
        .filter(
          (m: any) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string",
        )
        .slice(-10)
        .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));

      // Budget pre-check BEFORE any model call (BYOK users bypass inside).
      const budget = await checkTokenBudget(userId);
      if (!budget.allowed) {
        return res.status(402).json({
          error: "Monthly AI token budget exceeded. Upgrade your plan or wait for the monthly reset.",
          budgetExceeded: true,
        });
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      const sendEvent = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);

      // Retrieve grounding passages (semantic first, keyword fallback).
      const { semanticSearchContent, keywordSearchSources } = await import(
        "./services/content-indexer"
      );
      let retrievalMode: "semantic" | "keyword" = "keyword";
      let hits: any[] = [];
      try {
        const out = await runWithAiContext({ userId }, () =>
          semanticSearchContent(userId, question, {
            topK: 8,
            sourceTypes: MEETING_SOURCE_TYPES,
          }),
        );
        if (out.mode === "semantic") {
          retrievalMode = "semantic";
          hits = out.hits;
        }
      } catch (err: any) {
        console.error("Meetings ask: semantic retrieval failed:", err?.message || err);
      }
      if (hits.length === 0) {
        hits = await keywordSearchSources(userId, question, MEETING_SOURCE_TYPES, 8);
        if (retrievalMode !== "semantic" || hits.length > 0) retrievalMode = hits.length > 0 ? "keyword" : retrievalMode;
      }

      const citations = hits.map((h: any, i: number) => ({
        index: i + 1,
        sourceType: h.sourceType,
        sourceId: h.sourceId,
        sourceLabel: h.metadata?.sourceLabel || `${h.sourceType} #${h.sourceId}`,
        snippet: String(h.content || "").slice(0, 300),
      }));
      sendEvent({ type: "citations", citations, retrievalMode });

      // Nothing retrieved → say so explicitly. Never let the model guess.
      if (hits.length === 0) {
        sendEvent({
          type: "content",
          content:
            "I couldn't find anything in your imported meetings related to that. Try rephrasing, or import the relevant meeting/transcript first.",
        });
        sendEvent({ type: "done" });
        return res.end();
      }

      const passagesBlock = hits
        .map(
          (h: any, i: number) =>
            `[${i + 1}] (${h.metadata?.sourceLabel || h.sourceType}) ${String(h.content || "").slice(0, 1500)}`,
        )
        .join("\n\n");

      const systemPrompt = `You are a meetings research assistant. Answer the user's question using ONLY the numbered meeting passages provided below. Rules:
- Every factual claim must cite its passage with bracketed numbers like [1] or [2][3].
- Cite ONLY the passage numbers provided (1-${hits.length}). Never invent citations.
- If the passages do not contain the answer, say plainly that the imported meetings don't cover it. Do NOT use outside knowledge or guess.
- Be concise and direct. Quote short verbatim phrases when useful.

MEETING PASSAGES:
${passagesBlock}`;

      const model = await getModelForBudget(userId, "gpt-4o").catch(() => "gpt-4o");
      const openai = getAiClient() as any;

      const stream = await runWithAiContext({ userId }, () =>
        openai.chat.completions.create({
          model,
          stream: true,
          stream_options: { include_usage: true },
          temperature: 0.2,
          max_tokens: 1200,
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: question },
          ],
        }),
      );

      let usage: any = null;
      for await (const chunk of stream as any) {
        const delta = chunk?.choices?.[0]?.delta?.content;
        if (delta) sendEvent({ type: "content", content: delta });
        if (chunk?.usage) usage = chunk.usage;
      }

      try {
        await trackTokenUsage(userId, "meetings_ask", model, usage, {
          retrievalMode,
          passages: hits.length,
        });
      } catch (e) {
        console.error("Meetings ask: token tracking failed:", e);
      }

      sendEvent({ type: "done" });
      res.end();
    } catch (error: any) {
      console.error("Error in meetings ask:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: error?.message || "Failed to answer question" });
      }
      try {
        res.write(
          `data: ${JSON.stringify({ type: "error", content: error?.message || "AI request failed" })}\n\n`,
        );
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      } catch {}
      res.end();
    }
  });

  // Evidence Library API
  app.get("/api/evidence", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const source = typeof req.query.source === "string" ? req.query.source : undefined;
      const tags = typeof req.query.tags === "string" ? req.query.tags.split(",").filter(Boolean) : undefined;
      const items = await storage.getEvidenceItems(userId, { source, tags });
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching evidence items:", error);
      res.status(500).json({ error: "Failed to fetch evidence items" });
    }
  });

  app.get("/api/evidence/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const q = typeof req.query.q === "string" ? req.query.q : "";
      if (!q.trim()) return res.json({ items: [], searchMode: "none" });

      // Semantic-first with keyword fallback. Never fails silently — the
      // response carries the mode so the UI can show a degradation indicator.
      let searchMode: "semantic" | "keyword" = "keyword";
      let items: any[] = [];
      try {
        const { semanticSearchContent } = await import("./services/content-indexer");
        const { hits, mode } = await semanticSearchContent(userId, q.trim(), {
          topK: 40,
          sourceTypes: ["evidence"],
        });
        if (mode === "semantic") {
          searchMode = "semantic";
          const ids = Array.from(new Set(hits.map((h) => parseInt(h.sourceId, 10)))).filter(
            (n) => !Number.isNaN(n),
          );
          if (ids.length > 0) {
            const all = await storage.getEvidenceItems(userId);
            const byId = new Map(all.map((e: any) => [e.id, e]));
            items = ids.map((id) => byId.get(id)).filter(Boolean);
          }
        }
      } catch (err: any) {
        console.error("Semantic evidence search failed, falling back to keyword:", err?.message || err);
      }

      if (searchMode === "keyword") {
        items = await storage.searchEvidence(userId, q.trim());
      } else if (items.length === 0) {
        // Semantic ran but the index may not cover older rows yet — merge in
        // keyword matches so results never regress.
        items = await storage.searchEvidence(userId, q.trim());
      }

      res.json({ items, searchMode });
    } catch (error: any) {
      console.error("Error searching evidence:", error);
      res.status(500).json({ error: "Failed to search evidence" });
    }
  });

  // ── Semantic search infrastructure ──────────────────────────────────────
  // Health/status of the vector index + embedding provider for this user.
  app.get("/api/search/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { getSearchStatus } = await import("./services/content-indexer");
      res.json(await getSearchStatus(userId));
    } catch (error: any) {
      console.error("Error getting search status:", error);
      res.status(500).json({ error: "Failed to get search status" });
    }
  });

  // Batched, budget-aware backfill of the semantic index for this user.
  app.post("/api/search/reindex", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const force = req.body?.force === true;
      const { backfillUserContent } = await import("./services/content-indexer");
      const result = await runWithAiContext({ userId }, () =>
        backfillUserContent(userId, { force }),
      );
      res.json(result);
    } catch (error: any) {
      console.error("Error reindexing content:", error);
      res.status(500).json({ error: error?.message || "Failed to reindex content" });
    }
  });

  app.post("/api/evidence", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { title, content, source, sourceId, tags, metadata, insightType } = req.body;
      if (!title || !content) return res.status(400).json({ error: "Title and content are required" });

      const existingItems = await storage.getEvidenceItems(userId);
      const importOrigin = `${source || "note"}_manual_${Date.now()}`;
      const { match } = await findOrBumpEvidence(existingItems, {
        title, content, source: source || "note", insightType, originId: importOrigin,
      });

      if (match) {
        res.json({ ...match, bumped: true });
      } else {
        const item = await storage.createEvidenceItem({
          userId,
          title,
          content,
          source: source || "note",
          sourceId: sourceId || null,
          tags: Array.isArray(tags) ? tags : [],
          metadata: metadata || {},
          insightType: insightType || null,
        });
        res.json(item);
      }
    } catch (error: any) {
      console.error("Error creating evidence item:", error);
      res.status(500).json({ error: "Failed to create evidence item" });
    }
  });

  app.patch("/api/evidence/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const id = parseInt(req.params.id);
      const existing = await storage.getEvidenceItem(id);
      if (!existing || existing.userId !== userId) return res.status(404).json({ error: "Evidence item not found" });
      const updated = await storage.updateEvidenceItem(id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating evidence item:", error);
      res.status(500).json({ error: "Failed to update evidence item" });
    }
  });

  app.delete("/api/evidence/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const id = parseInt(req.params.id);
      const existing = await storage.getEvidenceItem(id);
      if (!existing || existing.userId !== userId) return res.status(404).json({ error: "Evidence item not found" });
      await storage.deleteEvidenceItem(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting evidence item:", error);
      res.status(500).json({ error: "Failed to delete evidence item" });
    }
  });

  // Context Brain API
  app.post("/api/context/parse", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { text, source } = req.body;
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Text content is required" });
      }

      const validSources = ["chatgpt", "claude", "meeting", "manual", "other"];
      const normalizedSource = validSources.includes(source) ? source : "manual";

      const { parseContext } = await import("./services/context-parser");
      const parsed = await parseContext(text.trim(), normalizedSource, userId);

      const createdItems = [];
      const insightTypes = ["problems", "features", "decisions", "insights", "questions"] as const;
      const typeMap: Record<string, string> = {
        problems: "problem",
        features: "feature",
        decisions: "decision",
        insights: "insight",
        questions: "question",
      };

      const existingItems = await storage.getEvidenceItems(userId);
      const parseBatchId = `${normalizedSource}_parse_${Date.now()}`;
      let newCount = 0;
      let bumpedCount = 0;

      for (const category of insightTypes) {
        for (const item of parsed[category]) {
          const insightType = typeMap[category];

          const { match } = await findOrBumpEvidence(existingItems, {
            title: item.title, content: item.content,
            source: normalizedSource, insightType,
            originId: parseBatchId,
          });

          if (match) {
            createdItems.push(match);
            bumpedCount++;
          } else {
            const created = await storage.createEvidenceItem({
              userId,
              title: item.title,
              content: item.content,
              source: normalizedSource,
              tags: [insightType, "context-brain"],
              metadata: { parsedFrom: "context-brain", originalSource: normalizedSource },
              insightType,
            });
            createdItems.push(created);
            existingItems.push(created);
            newCount++;
          }
        }
      }

      res.json({
        parsed,
        storedCount: createdItems.length,
        newCount,
        bumpedCount,
        breakdown: {
          problems: parsed.problems.length,
          features: parsed.features.length,
          decisions: parsed.decisions.length,
          insights: parsed.insights.length,
          questions: parsed.questions.length,
        },
      });
    } catch (error: any) {
      console.error("Error parsing context:", error);
      res.status(500).json({ error: "Failed to parse context" });
    }
  });

  app.get("/api/context/insights", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const insightType = typeof req.query.type === "string" ? req.query.type : undefined;
      const grouped = req.query.grouped === "true";
      const items = await storage.getEvidenceByInsightType(userId, insightType);

      if (grouped && !insightType) {
        const groupedResult: Record<string, typeof items> = {
          problem: [],
          feature: [],
          decision: [],
          insight: [],
          question: [],
        };
        for (const item of items) {
          const key = item.insightType || "insight";
          if (groupedResult[key]) {
            groupedResult[key].push(item);
          }
        }
        return res.json(groupedResult);
      }

      res.json(items);
    } catch (error: unknown) {
      console.error("Error fetching context insights:", error);
      res.status(500).json({ error: "Failed to fetch context insights" });
    }
  });

  app.post("/api/context/import-chatgpt", isAuthenticated, upload.single("file"), async (req: any, res) => {
    const file = req.file;
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      if (!file) return res.status(400).json({ error: "File is required" });

      let fileContent: string;
      const isZip = file.originalname?.toLowerCase().endsWith(".zip") || file.mimetype === "application/zip";

      if (isZip) {
        const JSZip = (await import("jszip")).default;
        const zipData = fs.readFileSync(file.path);
        const zip = await JSZip.loadAsync(zipData);
        const conversationsFile = zip.file("conversations.json") || zip.file(/conversations\.json$/i)[0];
        if (!conversationsFile) {
          return res.status(400).json({ error: "ZIP does not contain conversations.json" });
        }
        fileContent = await conversationsFile.async("string");
      } else {
        fileContent = fs.readFileSync(file.path, "utf-8");
      }

      const action = req.body.action || "list";

      if (action === "list") {
        const { extractChatGPTConversationList } = await import("./services/context-parser");
        const conversations = extractChatGPTConversationList(fileContent);
        return res.json({ conversations });
      }

      if (action === "process") {
        let ids: string[];
        try {
          const parsed = JSON.parse(req.body.conversationIds || "null");
          if (!Array.isArray(parsed)) throw new Error("not an array");
          ids = parsed;
        } catch {
          return res.status(400).json({ error: "conversationIds must be a JSON array of strings" });
        }

        if (ids.length > 20) {
          return res.status(400).json({ error: "Maximum 20 conversations per import request" });
        }

        const { extractChatGPTConversationText, parseContext } = await import("./services/context-parser");
        const conversationTexts = extractChatGPTConversationText(fileContent, ids);

        const typeMap: Record<string, string> = {
          problems: "problem",
          features: "feature",
          decisions: "decision",
          insights: "insight",
          questions: "question",
        };

        let totalStored = 0;
        let totalBumped = 0;
        const existingItems = await storage.getEvidenceItems(userId);
        const allBreakdowns: Record<string, Record<string, number>> = {};

        for (const [convId, text] of conversationTexts.entries()) {
          const parsed = await parseContext(text, "chatgpt", userId);
          let convStored = 0;

          for (const category of Object.keys(typeMap)) {
            for (const item of parsed[category as keyof typeof parsed]) {
              const insightType = typeMap[category];
              const { match } = await findOrBumpEvidence(existingItems, {
                title: item.title, content: item.content,
                source: "chatgpt", insightType,
                originId: `chatgpt_conv_${convId}`,
              });

              if (match) {
                totalBumped++;
              } else {
                const created = await storage.createEvidenceItem({
                  userId,
                  title: item.title,
                  content: item.content,
                  source: "chatgpt",
                  tags: [insightType, "context-brain", "chatgpt-import"],
                  metadata: { parsedFrom: "chatgpt-export", conversationId: convId },
                  insightType,
                });
                existingItems.push(created);
              }
              convStored++;
            }
          }

          totalStored += convStored;
          allBreakdowns[convId] = {
            problems: parsed.problems.length,
            features: parsed.features.length,
            decisions: parsed.decisions.length,
            insights: parsed.insights.length,
            questions: parsed.questions.length,
          };
        }

        return res.json({
          processedConversations: conversationTexts.size,
          totalStored,
          breakdowns: allBreakdowns,
        });
      }

      return res.status(400).json({ error: "Invalid action. Use 'list' or 'process'" });
    } catch (error: unknown) {
      console.error("Error with ChatGPT import:", error);
      res.status(500).json({ error: "Failed to process ChatGPT export" });
    } finally {
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch {}
      }
    }
  });

  app.post("/api/transcribe", isAuthenticated, upload.single("audio"), async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const file = req.file;
      if (!file) return res.status(400).json({ error: "Audio file is required" });

      const allowedTypes = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/wav", "audio/x-wav", "audio/m4a", "audio/x-m4a", "audio/webm", "video/mp4", "video/webm"];
      if (!allowedTypes.some((t) => file.mimetype.startsWith(t.split("/")[0]))) {
        const fs = await import("fs");
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: "Unsupported file type. Supported: MP3, MP4, WAV, M4A, WebM" });
      }

      if (file.size > 25 * 1024 * 1024) {
        const fs = await import("fs");
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: "File too large. Maximum size is 25MB." });
      }

      // Transcription is routed per-user: own-key users use their own
      // transcription key (or get a clear "disabled" error), platform users use
      // the platform key. We do NOT hard-block on OPENAI_API_KEY here so that a
      // BYOK user with a custom transcription key works even if the platform
      // key is absent.
      const fs = await import("fs");

      const transcription = await transcriptionCreateForUser(userId, {
        file: fs.createReadStream(file.path),
        model: "whisper-1",
      });

      fs.unlinkSync(file.path);

      trackTokenUsage(userId, "audio-transcription", "whisper-1", { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, { fileName: file.originalname }).catch(() => {});

      const transcript = transcription.text;
      const title = `Transcription: ${file.originalname}`;

      const conversation = await storage.createConversation({
        userId,
        title,
        source: "transcription",
        content: transcript,
      });

      try {
        const existingItems = await storage.getEvidenceItems(userId);
        const { match } = await findOrBumpEvidence(existingItems, {
          title, content: transcript, source: "transcript",
          originId: `transcript_${file.originalname}_${Date.now()}`,
        });
        if (!match) {
          await storage.createEvidenceItem({
            userId,
            title,
            content: transcript,
            source: "transcript",
            tags: ["transcription", "auto-imported"],
            metadata: {
              filename: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype,
            },
          });
        }
      } catch (e) {
        console.warn("Could not auto-save transcription as evidence:", e);
      }

      res.json({ transcript, conversation });
    } catch (error: any) {
      console.error("Error transcribing audio:", error);
      if (req.file) {
        try {
          const fs = await import("fs");
          fs.unlinkSync(req.file.path);
        } catch {}
      }
      if (error instanceof TranscriptionUnavailableError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to transcribe audio: " + (error.message || "Unknown error") });
    }
  });

  app.post("/api/evidence/usage-import", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { data, title, format: dataFormat } = req.body;
      if (!data) return res.status(400).json({ error: "Data is required" });

      if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey(userId))) {
        return res.status(500).json({ error: "No AI provider configured. Add your own Claude key in Settings, or ask an admin to configure the platform key." });
      }

      let parsedData: any[];
      if (dataFormat === "json") {
        parsedData = Array.isArray(data) ? data : [data];
      } else {
        const lines = data.split("\n").filter((l: string) => l.trim());
        if (lines.length < 2) return res.status(400).json({ error: "CSV must have headers and at least one data row" });
        const headers = lines[0].split(",").map((h: string) => h.trim());
        parsedData = lines.slice(1).map((line: string) => {
          const values = line.split(",").map((v: string) => v.trim());
          const row: any = {};
          headers.forEach((h: string, i: number) => { row[h] = values[i] || ""; });
          return row;
        });
      }

      const dataPreview = JSON.stringify(parsedData.slice(0, 20), null, 2);

      const openai = (getAiClient() as any);
      const usageModel = await getModelForBudget(userId, "gpt-4o");
      const completion = await openai.chat.completions.create({
        model: usageModel,
        messages: [
          {
            role: "system",
            content: `You are a product analytics expert. Analyze the following product usage data and provide actionable insights. Structure your response with:
1. **Overview**: High-level summary of what the data shows
2. **Key Patterns**: Major trends, power features, underused features
3. **Drop-off Points**: Where users are disengaging
4. **Growth Opportunities**: Features or areas with high potential
5. **Recommendations**: Specific, actionable next steps for the product team

Be specific and reference actual data points. Use percentages and comparisons when possible.`,
          },
          {
            role: "user",
            content: `Analyze this product usage data:\n\n${dataPreview}\n\nTotal rows: ${parsedData.length}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 2000,
      });

      if (completion.usage) {
        trackTokenUsage(userId, "usage-data-analysis", usageModel, completion.usage).catch(() => {});
      }

      const summary = completion.choices[0]?.message?.content || "Unable to generate analysis.";

      const usageTitle = title || `Usage Data Import (${new Date().toLocaleDateString()})`;
      const usageContent = `## AI Analysis\n\n${summary}\n\n---\n\n## Raw Data\n\n\`\`\`json\n${JSON.stringify(parsedData.slice(0, 50), null, 2)}\n\`\`\``;
      const existingItems = await storage.getEvidenceItems(userId);
      const { match } = await findOrBumpEvidence(existingItems, {
        title: usageTitle, content: usageContent, source: "usage-data",
        originId: `usage_import_${Date.now()}`,
      });

      let evidenceItem;
      if (match) {
        evidenceItem = match;
      } else {
        evidenceItem = await storage.createEvidenceItem({
          userId,
          title: usageTitle,
          content: usageContent,
          source: "usage-data",
          tags: ["usage-data", "auto-analyzed"],
          metadata: {
            rowCount: parsedData.length,
            columns: Object.keys(parsedData[0] || {}),
            importDate: new Date().toISOString(),
            format: dataFormat || "csv",
          },
        });
      }

      res.json({ evidenceItem, summary, rowCount: parsedData.length });
    } catch (error: any) {
      console.error("Error importing usage data:", error);
      res.status(500).json({ error: "Failed to import usage data" });
    }
  });

  app.patch("/api/conversations/:id/summarize", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const id = parseInt(req.params.id);
      const conv = await storage.getConversation(id);
      if (!conv || conv.userId !== userId) return res.status(404).json({ error: "Conversation not found" });

      const openai = (getAiClient() as any);
      const summaryModel = await getModelForBudget(userId, "gpt-4o");
      const completion = await openai.chat.completions.create({
        model: summaryModel,
        messages: [
          {
            role: "system",
            content: "You are a meeting summarization assistant. Produce a concise summary of the conversation below. Include: key topics discussed, decisions made, action items, and notable quotes or insights. Format with bullet points.",
          },
          { role: "user", content: conv.content },
        ],
        max_tokens: 1000,
      });

      if (completion.usage) {
        trackTokenUsage(userId, "meeting-summary", summaryModel, completion.usage).catch(() => {});
      }

      const summary = completion.choices[0]?.message?.content || "Unable to generate summary.";
      const updated = await storage.updateConversation(id, { summary });
      res.json(updated);
    } catch (error: any) {
      console.error("Error summarizing conversation:", error);
      res.status(500).json({ error: "Failed to summarize conversation" });
    }
  });

  app.get("/api/tokens/usage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      await ensureTokenBudget(userId);
      const summary = await getTokenUsageSummary(userId);
      res.json(summary);
    } catch (error: any) {
      console.error("Error getting token usage:", error);
      res.status(500).json({ error: "Failed to get token usage" });
    }
  });

  app.get("/api/tokens/budget", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const budget = await checkTokenBudget(userId);
      const userWithPlan = await storage.getUserWithPlan(userId);
      const planName = userWithPlan?.plan?.name || "Free";
      const planSlug = userWithPlan?.plan?.slug || "free";
      const projectLimit = await storage.canUserCreateProject(userId);
      const aiSettings = await getSafeAiSettings(userId);
      res.json({
        ...budget,
        planName,
        planSlug,
        // When the user runs their own Claude key, token caps do not apply.
        ownKeyActive: aiSettings.ownKeyActive,
        provider: aiSettings.provider,
        projectLimit: {
          current: projectLimit.current,
          max: projectLimit.max,
          allowed: projectLimit.allowed,
        },
      });
    } catch (error: any) {
      console.error("Error getting token budget:", error);
      res.status(500).json({ error: "Failed to get token budget" });
    }
  });

  // ===== AI provider settings (Bring Your Own Claude key) =====

  app.get("/api/ai-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      res.json(await getSafeAiSettings(userId));
    } catch (error: any) {
      console.error("Error getting AI settings:", error);
      res.status(500).json({ error: "Failed to get AI settings" });
    }
  });

  app.put("/api/ai-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { provider, anthropicApiKey, transcriptionApiKey, zeroRetention } = req.body || {};

      if (provider && provider !== "platform" && provider !== "anthropic") {
        return res.status(400).json({ error: "Invalid provider" });
      }

      // If switching to Claude, require a key to be present (existing or new).
      if (provider === "anthropic") {
        const existing = await getSafeAiSettings(userId);
        const willHaveKey =
          (typeof anthropicApiKey === "string" && anthropicApiKey.trim() !== "") ||
          (existing.hasAnthropicKey && anthropicApiKey === undefined);
        if (!willHaveKey) {
          return res.status(400).json({
            error: "A Claude API key is required to use your own provider.",
          });
        }
      }

      // Validate any newly-provided keys with a live check before saving.
      if (typeof anthropicApiKey === "string" && anthropicApiKey.trim() !== "") {
        const err = await testAnthropicKey(anthropicApiKey);
        if (err) return res.status(400).json({ error: err });
      }
      if (typeof transcriptionApiKey === "string" && transcriptionApiKey.trim() !== "") {
        const err = await testTranscriptionKey(transcriptionApiKey);
        if (err) return res.status(400).json({ error: err });
      }

      const saved = await saveAiSettings(userId, {
        provider,
        anthropicApiKey,
        transcriptionApiKey,
        zeroRetention,
      });
      res.json(saved);
    } catch (error: any) {
      console.error("Error saving AI settings:", error);
      res.status(500).json({ error: "Failed to save AI settings" });
    }
  });

  app.post("/api/ai-settings/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { keyType, apiKey } = req.body || {};
      if (typeof apiKey !== "string" || apiKey.trim() === "") {
        return res.status(400).json({ error: "No API key provided" });
      }
      const err =
        keyType === "transcription"
          ? await testTranscriptionKey(apiKey)
          : await testAnthropicKey(apiKey);
      if (err) return res.status(400).json({ valid: false, error: err });
      res.json({ valid: true });
    } catch (error: any) {
      console.error("Error testing AI key:", error);
      res.status(500).json({ error: "Failed to test API key" });
    }
  });

  app.delete("/api/ai-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      res.json(await deleteAiSettings(userId));
    } catch (error: any) {
      console.error("Error deleting AI settings:", error);
      res.status(500).json({ error: "Failed to delete AI settings" });
    }
  });

  // ── Recurring Theme Finder ─────────────────────────────────────────────────

  // Assemble a theme with its mentions grouped and per-source / per-tier breakdowns.
  const assembleTheme = (theme: any, mentions: any[]) => {
    const sourceBreakdown: Record<string, number> = {};
    const tierBreakdown: Record<string, number> = {};
    const companies = new Set<string>();
    let confidenceSum = 0;
    let confidenceCount = 0;
    for (const m of mentions) {
      sourceBreakdown[m.sourceType] = (sourceBreakdown[m.sourceType] || 0) + 1;
      const tier = m.customerTier || "standard";
      tierBreakdown[tier] = (tierBreakdown[tier] || 0) + 1;
      if (m.company) companies.add(m.company);
      if (typeof m.confidence === "number") {
        confidenceSum += m.confidence;
        confidenceCount++;
      }
    }
    // Drop the raw embedding from the API payload — it's large and internal.
    const { embedding, ...themeRest } = theme || {};
    return {
      ...themeRest,
      sourceBreakdown,
      tierBreakdown,
      companies: Array.from(companies),
      avgConfidence: confidenceCount ? confidenceSum / confidenceCount : null,
      mentions,
    };
  };

  // Run AI clustering across all imported content to (re)build themes.
  app.post("/api/themes/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const budget = await checkTokenBudget(userId);
      if (budget && (budget as any).exceeded) {
        return res.status(402).json({ error: "Token budget exceeded", budget });
      }

      const { analyzeThemes } = await import("./services/theme-analyzer");
      const result = await analyzeThemes(userId);
      res.json(result);
    } catch (error: any) {
      console.error("Error analyzing themes:", error);
      res.status(500).json({ error: error?.message || "Failed to analyze themes" });
    }
  });

  // List themes, optionally filtered by plain-language query `q`.
  app.get("/api/themes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const rawQ = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const q = rawQ.toLowerCase();
      const allMentions = await storage.getThemeMentionsForUser(userId);
      const byTheme = new Map<number, any[]>();
      for (const m of allMentions) {
        if (!byTheme.has(m.themeId)) byTheme.set(m.themeId, []);
        byTheme.get(m.themeId)!.push(m);
      }

      let searchMode: "semantic" | "keyword" | "none" = "none";
      let themes = await storage.getThemes(userId);

      if (rawQ) {
        // Step 8: semantic search — embed the query and rank themes by vector
        // similarity. Degrade to keyword matching when no embedding is available
        // (or the vector search returns nothing).
        let semanticThemes: any[] | null = null;
        try {
          const { memoryManager } = await import("./services/memory-manager");
          const queryEmbedding = await memoryManager.getEmbedding(rawQ);
          if (queryEmbedding && (storage as any).searchThemesBySimilarity) {
            const hits = await (storage as any).searchThemesBySimilarity(userId, queryEmbedding);
            if (hits && hits.length) semanticThemes = hits;
          }
        } catch (e) {
          console.warn("Semantic theme search failed, falling back to keyword:", e);
        }

        if (semanticThemes) {
          themes = semanticThemes;
          searchMode = "semantic";
        } else {
          searchMode = "keyword";
        }
      }

      let assembled = themes.map((t) => assembleTheme(t, byTheme.get(t.id) || []));

      if (searchMode === "keyword") {
        // Keyword fallback (used when no embedding provider is available).
        // Tokenise the query and match themes containing ANY significant term,
        // so a natural-language query like "latency issues" still matches a
        // theme that only mentions "latency". Full semantic matching (e.g.
        // "slow" ↔ "latency") requires the embedding path.
        const STOP = new Set([
          "issue", "issues", "problem", "problems", "concern", "concerns",
          "need", "needs", "the", "a", "an", "and", "or", "of", "in", "on",
          "for", "to", "with", "about", "is", "are", "our", "we",
        ]);
        const terms = q.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
        const effectiveTerms = terms.length ? terms : q ? [q] : [];
        const hasTerm = (text: string | null | undefined) => {
          if (!text) return false;
          const lc = text.toLowerCase();
          return effectiveTerms.some((w) => lc.includes(w));
        };
        assembled = assembled.filter((t) => {
          if (hasTerm(t.title) || hasTerm(t.description) || hasTerm(t.category)) return true;
          return (t.mentions || []).some(
            (m: any) => hasTerm(m.quote) || hasTerm(m.company) || hasTerm(m.speaker),
          );
        });
      }

      // Return list without full mention arrays to keep payload light.
      const list = assembled.map(({ mentions, ...rest }) => ({
        ...rest,
        sampleMention: mentions[0] || null,
      }));
      res.json({ themes: list, searchMode });
    } catch (error: any) {
      console.error("Error listing themes:", error);
      res.status(500).json({ error: "Failed to list themes" });
    }
  });

  // Theme detail with all traced mentions.
  app.get("/api/themes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const id = parseInt(req.params.id, 10);
      const theme = await storage.getTheme(id);
      if (!theme || theme.userId !== userId) {
        return res.status(404).json({ error: "Theme not found" });
      }
      const mentions = await storage.getThemeMentions(id);
      res.json(assembleTheme(theme, mentions));
    } catch (error: any) {
      console.error("Error fetching theme:", error);
      res.status(500).json({ error: "Failed to fetch theme" });
    }
  });

  // Basic curation: rename / edit description or category.
  app.patch("/api/themes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const id = parseInt(req.params.id, 10);
      const theme = await storage.getTheme(id);
      if (!theme || theme.userId !== userId) {
        return res.status(404).json({ error: "Theme not found" });
      }
      const updates: any = {};
      if (typeof req.body.title === "string") updates.title = req.body.title.trim();
      if (typeof req.body.description === "string") updates.description = req.body.description;
      if (typeof req.body.category === "string") updates.category = req.body.category;
      const updated = await storage.updateTheme(id, updates);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating theme:", error);
      res.status(500).json({ error: "Failed to update theme" });
    }
  });

  // Basic curation: merge one theme into another (mentions are reassigned).
  app.post("/api/themes/:id/merge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const sourceId = parseInt(req.params.id, 10);
      const targetId = parseInt(req.body.targetId, 10);
      if (!Number.isInteger(targetId) || sourceId === targetId) {
        return res.status(400).json({ error: "Invalid target theme" });
      }
      const source = await storage.getTheme(sourceId);
      const target = await storage.getTheme(targetId);
      if (!source || source.userId !== userId || !target || target.userId !== userId) {
        return res.status(404).json({ error: "Theme not found" });
      }
      await storage.reassignThemeMentions(sourceId, targetId);
      await storage.deleteTheme(sourceId);
      const { recomputeThemeAggregates } = await import("./services/theme-analyzer");
      const updated = await recomputeThemeAggregates(targetId);
      res.json(updated);
    } catch (error: any) {
      console.error("Error merging themes:", error);
      res.status(500).json({ error: "Failed to merge themes" });
    }
  });

  app.delete("/api/themes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const id = parseInt(req.params.id, 10);
      const theme = await storage.getTheme(id);
      if (!theme || theme.userId !== userId) {
        return res.status(404).json({ error: "Theme not found" });
      }
      await storage.deleteTheme(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting theme:", error);
      res.status(500).json({ error: "Failed to delete theme" });
    }
  });

  // Export a theme for engineering (markdown by default, or json).
  app.get("/api/themes/:id/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const id = parseInt(req.params.id, 10);
      const theme = await storage.getTheme(id);
      if (!theme || theme.userId !== userId) {
        return res.status(404).json({ error: "Theme not found" });
      }
      const mentions = await storage.getThemeMentions(id);
      const assembled = assembleTheme(theme, mentions);
      const format = req.query.format === "json" ? "json" : "markdown";
      const slug = (theme.title || "theme").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="theme-${slug}.json"`);
        return res.send(JSON.stringify(assembled, null, 2));
      }

      const lines: string[] = [];
      lines.push(`# ${theme.title}`);
      lines.push("");
      if (theme.description) lines.push(theme.description, "");
      lines.push(`- **Mentions:** ${theme.mentionCount}`);
      lines.push(`- **Distinct sources:** ${theme.distinctSourceCount}`);
      lines.push(`- **Customer-weighted score:** ${theme.weightedScore}`);
      if (theme.category) lines.push(`- **Category:** ${theme.category}`);
      if (theme.lastSeenAt) {
        lines.push(`- **Last seen:** ${new Date(theme.lastSeenAt).toISOString().slice(0, 10)}`);
      }
      if (typeof assembled.avgConfidence === "number") {
        lines.push(`- **Avg. AI confidence:** ${Math.round(assembled.avgConfidence * 100)}%`);
      }
      const srcParts = Object.entries(assembled.sourceBreakdown).map(([k, v]) => `${k}: ${v}`);
      if (srcParts.length) lines.push(`- **By source:** ${srcParts.join(", ")}`);
      const tierParts = Object.entries(assembled.tierBreakdown).map(([k, v]) => `${k}: ${v}`);
      if (tierParts.length) lines.push(`- **By customer tier:** ${tierParts.join(", ")}`);
      if (assembled.companies.length) lines.push(`- **Companies:** ${assembled.companies.join(", ")}`);
      lines.push("", "## Traced mentions", "");
      for (const m of mentions) {
        const who = [m.speaker, m.company].filter(Boolean).join(", ");
        const ts = m.timestampLabel ? ` @ ${m.timestampLabel}` : "";
        lines.push(`> ${m.quote}`);
        const conf = typeof m.confidence === "number" ? `, confidence ${Math.round(m.confidence * 100)}%` : "";
        const attribution = [who || "Unknown", `${m.sourceLabel} (${m.sourceType})${ts}${conf}`]
          .filter(Boolean)
          .join(" — ");
        lines.push(`> — ${attribution}`);
        if (m.deepLink) {
          lines.push(`> [Open at timestamp](${m.deepLink})`);
        } else if (m.recordingUrl) {
          lines.push(`> Recording: ${m.recordingUrl} (no timestamp available)`);
        } else {
          lines.push(`> _No recording link available_`);
        }
        lines.push("");
      }

      res.setHeader("Content-Type", "text/markdown");
      res.setHeader("Content-Disposition", `attachment; filename="theme-${slug}.md"`);
      res.send(lines.join("\n"));
    } catch (error: any) {
      console.error("Error exporting theme:", error);
      res.status(500).json({ error: "Failed to export theme" });
    }
  });

  // Resolve the raw source transcript behind a theme mention that has no
  // recording link (uploaded transcripts, imported conversations, evidence),
  // so the UI can open the text and jump to / highlight the exact quote.
  app.get("/api/theme-source-transcript", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const sourceId = parseInt(String(req.query.sourceId), 10);
      const sourceType = String(req.query.sourceType || "").toLowerCase();
      if (!Number.isFinite(sourceId)) {
        return res.status(400).json({ error: "sourceId is required" });
      }

      const tryIntelDoc = async () => {
        try {
          const { getIntelligenceDocument } = await import(
            "./services/meeting-intelligence-service"
          );
          const doc: any = await getIntelligenceDocument(userId, sourceId);
          if (doc?.transcriptText) {
            return {
              transcriptText: doc.transcriptText,
              sourceLabel: doc.meetingTitle || doc.projectName || `Transcript #${sourceId}`,
            };
          }
        } catch {}
        return null;
      };
      const tryConversation = async () => {
        const convs = await storage.getConversations(userId).catch(() => []);
        const c = (convs as any[]).find((x) => x.id === sourceId);
        if (c?.content) return { transcriptText: c.content, sourceLabel: c.title || `Conversation #${sourceId}` };
        return null;
      };
      const tryEvidence = async () => {
        const evs = await storage.getEvidenceItems(userId).catch(() => []);
        const e = (evs as any[]).find((x) => x.id === sourceId);
        if (e?.content) return { transcriptText: `${e.title}\n${e.content}`, sourceLabel: e.title || `Evidence #${sourceId}` };
        return null;
      };

      // Order resolution by the source-type hint to avoid id collisions across
      // tables (an intelligence doc and a conversation can share an id).
      const CONV_TYPES = new Set(["conversation", "slack", "support", "note", "manual"]);
      const order = CONV_TYPES.has(sourceType)
        ? [tryConversation, tryEvidence, tryIntelDoc]
        : [tryIntelDoc, tryConversation, tryEvidence];

      for (const fn of order) {
        const hit = await fn();
        if (hit) return res.json(hit);
      }
      return res.status(404).json({ error: "No source transcript available for this mention" });
    } catch (error: any) {
      console.error("Error resolving source transcript:", error);
      res.status(500).json({ error: "Failed to load source transcript" });
    }
  });

  // ── Customer tiers (importance weighting) ──────────────────────────────────
  app.get("/api/customer-tiers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      res.json(await storage.getCustomerTiers(userId));
    } catch (error: any) {
      console.error("Error listing customer tiers:", error);
      res.status(500).json({ error: "Failed to list customer tiers" });
    }
  });

  app.post("/api/customer-tiers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const company = typeof req.body.company === "string" ? req.body.company.trim() : "";
      const tier = typeof req.body.tier === "string" ? req.body.tier.trim() : "standard";
      if (!company) return res.status(400).json({ error: "Company is required" });
      const { defaultWeightForTier } = await import("./services/theme-analyzer");
      const weight =
        typeof req.body.weight === "number" && req.body.weight > 0
          ? req.body.weight
          : defaultWeightForTier(tier);
      const saved = await storage.upsertCustomerTier(userId, company, tier, weight);
      res.json(saved);
    } catch (error: any) {
      console.error("Error saving customer tier:", error);
      res.status(500).json({ error: "Failed to save customer tier" });
    }
  });

  app.delete("/api/customer-tiers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.dbUserId || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      await storage.deleteCustomerTier(parseInt(req.params.id, 10), userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting customer tier:", error);
      res.status(500).json({ error: "Failed to delete customer tier" });
    }
  });
}
