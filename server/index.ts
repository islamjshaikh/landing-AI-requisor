// Load .env for local development BEFORE any module that reads process.env
// (e.g. ./routes -> ./db, which throws if DATABASE_URL is unset). No-op on
// Replit/production where the environment is injected and no .env exists.
import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import multer from "multer";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedData } from "./seed-data";
import { logger } from "./services/logger";
import { config } from "./config/environment";
import { setupProductionEnvironment } from "./production-startup";
import { logService } from "./services/log-service";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { createServer as createHttpServer } from "http";
import { executeScheduledPost } from "./services/social-scheduler";
import { DatabaseStorage } from "./database-storage";

// =====================================
// 🚀 REQUISOR STARTUP SEQUENCE
// =====================================
console.log("\n🔧 ===== DEPENDENCIES READY =====");

// Detect environment and setup
const isProduction = process.env.NODE_ENV === "production";
console.log(`✅ Environment: ${isProduction ? "PRODUCTION" : "DEVELOPMENT"}`);
console.log(`✅ Node.js version: ${process.version}`);
console.log(
  `✅ DATABASE_URL: ${process.env.DATABASE_URL ? "CONFIGURED" : "MISSING"}`,
);
console.log(
  `✅ OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "CONFIGURED" : "MISSING"}`,
);

// Setup production environment if needed
if (isProduction) {
  try {
    setupProductionEnvironment();
    console.log(`✅ Production environment: CONFIGURED`);
  } catch (error: any) {
    console.error("❌ Production setup failed:", error);
    process.exit(1);
  }
}

console.log("\n⚙️ ===== CONFIGURATION READY =====");

// CrewAI service is external - no local process management needed
console.log("🌐 CrewAI service: External backend service");

const app = express();

// Set appropriate trust proxy setting for the environment
app.set("trust proxy", isProduction ? 1 : false);

// Apply hardened security headers via helmet (X-Frame-Options, HSTS,
// X-Content-Type-Options, Referrer-Policy, etc.). CSP is set explicitly below.
app.use(
  helmet({
    contentSecurityPolicy: false, // we set our own CSP next
    crossOriginEmbedderPolicy: false, // avoid breaking 3p embeds (Stripe, etc.)
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Content Security Policy — tightened: removed 'unsafe-eval' from script-src
// and restricted inline scripts/styles to those that cannot be removed without
// frontend rework. Frame ancestors prevents clickjacking.
//
// External services are env-driven (CREWAI_SERVICE_URL) so the CSP no longer
// hard-codes any platform-specific origin.
app.use((req, res, next) => {
  // In dev, Vite needs 'unsafe-eval' for HMR. In production we drop it.
  const scriptSrcExtras = isProduction ? "" : " 'unsafe-eval'";

  // Allow the configured CrewAI origin (if any) in connect-src. Strip the
  // path/query so we only emit the scheme+host pair.
  const crewaiUrl = process.env.CREWAI_SERVICE_URL || process.env.CREWAI_URL || "";
  let crewaiOrigin = "";
  if (crewaiUrl) {
    try {
      const u = new URL(crewaiUrl);
      crewaiOrigin = `${u.protocol}//${u.host}`;
    } catch {
      // Bad URL — silently skip rather than break boot.
    }
  }

  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `connect-src 'self' blob: https://cdn.jsdelivr.net https://*.twitter.com https://*.facebook.com https://*.linkedin.com https://*.instagram.com${crewaiOrigin ? " " + crewaiOrigin : ""} https://api.stripe.com`,
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
      `script-src 'self' 'unsafe-inline'${scriptSrcExtras} https://*.twitter.com https://*.facebook.com https://*.linkedin.com https://*.instagram.com https://js.stripe.com`,
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  );
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

// Request logging — only in non-production to avoid leaking PII into logs.
if (!isProduction) {
  app.use((req, res, next) => {
    console.log(`\n[DEBUG REQUEST] ${req.method} ${req.path}`);
    console.log(`[DEBUG REQUEST] Content-Type: ${req.headers["content-type"]}`);
    console.log(`[DEBUG REQUEST] Body keys:`, Object.keys(req.body || {}));
    next();
  });
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10, // Max 10 files
    fieldSize: 10 * 1024 * 1024, // 10MB field size
    fieldNameSize: 100,
    fields: 50,
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types for now, validation happens in routes
    cb(null, true);
  },
});

// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Add multer middleware conditionally - only for routes that need it
// Don't apply to all routes to prevent form parsing errors

// Stripe webhook needs raw body for signature verification — register before JSON parser
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }));

// Body parsers - MUST skip multipart/form-data (used by file uploads with Multer)
app.use((req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    console.log(
      "[Body Parser] Skipping for multipart/form-data request:",
      req.path,
    );
    return next();
  }
  if (req.path === "/api/stripe/webhook") {
    return next();
  }
  express.json({ limit: "50mb" })(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ extended: true, limit: "50mb" })(req, res, next);
  });
});

// Add cache-busting headers to prevent caching issues
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    // API responses - no cache
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
  } else if (req.path.includes("/assets/")) {
    // Static assets - long cache with versioning
    res.set({
      "Cache-Control": "public, max-age=31536000", // 1 year
      ETag: `"${Date.now()}"`, // Force unique etag
    });
  }
  next();
});

// Basic request logging for /api
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch { }
      }
      if (logLine.length > 80) {
        logLine = logLine.substring(0, 77) + "...";
      }
      log(logLine);
    }
  });

  next();
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  try {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      nodeVersion: process.version,
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: "Health check failed",
    });
  }
});

(async () => {
  try {
    // Database connection and setup
    console.log("🔌 Setting up database connection...");
    logService.log("NODE", "INFO", "🔌 Setting up database connection...");
    const { setupDatabase } = await import("./db-setup");
    await setupDatabase();
    console.log("✅ Database: CONNECTED & CONFIGURED");
    logService.log("NODE", "INFO", "✅ Database: CONNECTED & CONFIGURED");

    // Reschedule pending posts
    console.log("\n⏰ ===== RESCHEDULING PENDING POSTS =====");
    try {
      const storage = new DatabaseStorage();
      const allPosts = await storage.getAllScheduledSocialPosts();
      const pendingPosts = allPosts.filter(p => p.status === 'scheduled');

      console.log(`⏰ Found ${pendingPosts.length} pending scheduled posts`);

      const now = new Date();
      let rescheduledCount = 0;

      for (const post of pendingPosts) {
        if (!post.scheduledTime) continue;

        const scheduledTime = new Date(post.scheduledTime);
        const delay = scheduledTime.getTime() - now.getTime();

        if (delay > 0) {
          console.log(`⏰ Rescheduling post ${post.id} for ${scheduledTime.toISOString()} (in ${Math.round(delay / 1000)}s)`);
          setTimeout(async () => {
            await executeScheduledPost(post);
          }, delay);
          rescheduledCount++;
        } else {
          console.log(`⏰ Post ${post.id} missed schedule (${scheduledTime.toISOString()}), executing immediately`);
          // Execute immediately if missed
          executeScheduledPost(post).catch(err => console.error(`❌ Failed to execute missed post ${post.id}:`, err));
          rescheduledCount++;
        }
      }
      console.log(`✅ Rescheduled/Executed ${rescheduledCount} posts`);
    } catch (error) {
      console.error("❌ Failed to reschedule posts:", error);
    }

    console.log("\n🌐 ===== PORTS READY =====");

    // Use environment-aware port configuration from centralized config
    const PORT = config.ports.server;
    console.log(`✅ Node.js server port: ${PORT} (READY)`);
    console.log(
      `✅ Separate service architecture: Node.js server + Python CrewAI service`,
    );

    // Setup static file serving - static assets first
    console.log("\n📁 ===== SETTING UP STATIC FILES =====");
    const distPath = path.join(process.cwd(), "dist/public");
    const indexPath = path.join(distPath, "index.html");
    
    if (isProduction) {
      console.log("📁 Setting up production static file serving...");
      app.use("/assets", express.static(path.join(process.cwd(), "dist/public/assets"), {
        maxAge: "1y",
        immutable: true,
      }));
      app.use(express.static(path.join(process.cwd(), "dist/public"), {
        maxAge: 0,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          }
        },
      }));
      console.log("✅ Static files: PRODUCTION MODE");
    } else {
      if (fs.existsSync(distPath) && fs.existsSync(indexPath)) {
        console.log("📁 Development mode: Serving built files");
        app.use(express.static(distPath));
        console.log("✅ Static files: DEVELOPMENT MODE");
      } else {
        console.log("⚠️  No built files found - run 'npm run build' first");
      }
    }

    // Register API routes BEFORE the SPA catch-all
    console.log("\n🔗 ===== REGISTERING APIS =====");
    await registerRoutes(app);
    console.log("✅ API Routes: REGISTERED & ACTIVE");

    // MCP server — lets external AI clients (Claude Desktop, Claude Code,
    // Cursor) read this user's meetings and themes.
    //
    // Mounted under /api deliberately: the production SPA catch-all below
    // only excludes /api, /uploads and /media, so a bare /mcp would be
    // answered with index.html. /api also inherits the JSON body parser and
    // the no-cache headers set above.
    //
    // Registered after registerRoutes so that isAuthenticated and the session
    // middleware are already in place for the token-management routes.
    //
    // Wrapped in its own try/catch on purpose. The enclosing block exits the
    // process on failure, which is right for the database and the API routes —
    // but MCP is an additive, optional surface. A missing dependency or a bad
    // import here must degrade to "MCP unavailable", never take the whole
    // product offline for every user.
    try {
      // Auto-create the MCP tables if they're missing, so deploying needs only
      // the code — no manual `psql` migration step. Idempotent (CREATE ... IF
      // NOT EXISTS), so it's a no-op once the tables exist.
      const { ensureMcpSchema } = await import("./mcp/auto-migrate");
      await ensureMcpSchema();

      const { createMcpRouter } = await import("./mcp");
      const mcpTokenRoutes = (await import("./routes/mcp-tokens")).default;
      const { createOAuthRouter, authorizationServerMetadata, protectedResourceMetadata } =
        await import("./mcp/oauth-routes");

      // Token management first — it claims /api/mcp/tokens. The MCP router
      // only binds "/" exactly, so POST /api/mcp still falls through to it.
      app.use("/api/mcp", mcpTokenRoutes);
      app.use("/api/mcp/oauth", createOAuthRouter());
      app.use("/api/mcp", createMcpRouter());

      // OAuth discovery metadata (RFC 8414 + RFC 9728).
      //
      // A spec-compliant MCP client that gets a 401 fetches these well-known
      // paths to learn where to authorize. They MUST return JSON, not HTML —
      // otherwise the client dies on `JSON.parse("<!DOCTYPE ...")` when the SPA
      // catch-all answers instead. openid-configuration stays a 404: we do
      // OAuth authorization, not OpenID Connect identity.
      app.get("/.well-known/oauth-authorization-server", authorizationServerMetadata);
      app.get("/.well-known/oauth-authorization-server/api/mcp", authorizationServerMetadata);
      app.get("/.well-known/oauth-protected-resource", protectedResourceMetadata);
      app.get("/.well-known/oauth-protected-resource/api/mcp", protectedResourceMetadata);
      app.get("/.well-known/openid-configuration", (_req, res) =>
        res.status(404).json({ error: "not_supported" }),
      );

      console.log("✅ MCP server: MOUNTED at /api/mcp (OAuth + token auth)");
    } catch (err: any) {
      console.error(
        "⚠️  MCP server failed to mount — continuing without it:",
        err?.message || err,
      );
      logService.log(
        "NODE",
        "ERROR",
        `MCP server failed to mount: ${err?.message || err}`,
      );
    }
    
    // SPA catch-all route - must be AFTER API routes
    if (isProduction) {
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.startsWith("/media")) return next();
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(path.join(process.cwd(), "dist/public/index.html"));
      });
    } else {
      // Dev mode: Vite middleware will handle the SPA below
    }
    console.log("✅ Authentication: CONFIGURED");
    console.log("✅ Middleware: LOADED");

    const httpServer = createHttpServer(app);

    if (!isProduction) {
      console.log("\n⚡ ===== SETTING UP VITE DEV MIDDLEWARE =====");
      await setupVite(app, httpServer);
      console.log("✅ Vite dev middleware: ACTIVE");
    }

    // Start the server - PORT OPENS IMMEDIATELY
    const server = httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Node.js server: LISTENING on port ${PORT}`);
      logService.log(
        "NODE",
        "INFO",
        `✅ Node.js server: LISTENING on port ${PORT}`,
      );
      console.log(`🚀 Frontend available at: http://0.0.0.0:${PORT}`);

      // CrewAI runs as external service - Node.js forwards requests to it
      console.log(`✅ CrewAI service: External backend service`);
      logService.log(
        "CREWAI",
        "INFO",
        "✅ CrewAI service: External backend service",
      );

      console.log("\n📡 ===== ALL SYSTEMS OPERATIONAL =====");
      console.log("✅ Dependencies: READY");
      console.log("✅ Ports: READY & LISTENING");
      console.log("✅ Configuration: READY");
      console.log("✅ APIs: READY & RESPONDING");

      // Background initialization runs AFTER port is open
      setImmediate(async () => {
        console.log("\n🎯 ===== BACKGROUND TASKS =====");
        await backgroundInitialization();
      });
    });
  } catch (error) {
    console.error("\n💥 ===== STARTUP FAILED =====");
    console.error("❌ Critical startup error:", error);
    process.exit(1);
  }
})();

// Move background tasks to separate function outside the main block
async function backgroundInitialization() {
  // Seed initial data
  console.log("🌱 Seeding database with initial data...");
  await seedData();
  console.log("✅ Database seeding: COMPLETED");

  // Start cron scheduler
  console.log("⏰ Starting cron scheduler...");
  const { cronScheduler } = await import("./services/cron-scheduler");
  cronScheduler.start();
  console.log("✅ Cron scheduler: ACTIVE");

  console.log("\n🎉 ===== REQUISOR FULLY OPERATIONAL =====");
  console.log("🚀 All systems ready and running!");

  // CrewAI runs as external service - Node.js forwards all requests to it
  console.log("\n✅ ===== EXTERNAL CREWAI SERVICE CONFIGURED =====");
  console.log("🔧 CrewAI content generation handled by external backend service");
}

// CrewAI is now integrated directly - no separate monitoring needed

// Graceful shutdown — let background workers finish in-flight work before
// the process exits. The 10-second cap stops a wedged worker from blocking
// shutdown indefinitely (e.g. a stuck OpenAI call).
async function gracefulShutdown(reason: string): Promise<never> {
  console.log(`\n🛑 Received ${reason}, shutting down gracefully...`);
  try {
    const mod = await import("./services/meeting-intelligence-service");
    // The worker may not have been started (e.g. boot failed before routes
    // ran). startIntelligenceWorker is idempotent, so calling it just to
    // grab the handle is safe-ish, but a typeof check is cleaner:
    if (typeof (mod as any).startIntelligenceWorker === "function") {
      const handle = (mod as any).startIntelligenceWorker?.();
      if (handle?.stop) {
        await Promise.race([
          handle.stop(),
          new Promise((r) => setTimeout(r, 10_000)),
        ]);
      }
    }
  } catch (err) {
    console.error("Error stopping background worker:", err);
  }
  process.exit(0);
}

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});

// Global error handler — never leak stack traces or implementation details
// to clients regardless of NODE_ENV. Full details go to server-side logs only.
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Global error handler:", err);
  res.status(500).json({
    error: "Internal server error",
  });
});

// Server startup is now handled inside the async function above