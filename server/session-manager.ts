import session from "express-session";
import { Express } from "express";

import MemoryStoreFactory from "memorystore";
const MemoryStore = MemoryStoreFactory(session);

// Session configuration with memory store for better persistence
export const sessionConfig = {
  store: new MemoryStore({
    checkPeriod: 86400000, // prune expired entries every 24h
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    dispose: (key: string, val: any) => {
      console.log("Session disposed:", key);
    },
  }),
  secret:
    process.env.SESSION_SECRET || "your-secret-key-change-this-in-production",
  resave: true, // Force session to be saved back to store
  saveUninitialized: false, // Don't save empty sessions
  rolling: true, // Reset expiry on activity
  cookie: {
    secure: false, // Set to true for HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: "lax" as const,
    path: "/",
  },
  name: "connect.sid",
};

// Setup session middleware with proper configuration
export function setupSessionMiddleware(app: Express) {
  console.log("Setting up session middleware with forced persistence");

  const sessionMiddleware = session(sessionConfig);
  app.use(sessionMiddleware);

  // Add session debugging middleware
  app.use((req, res, next) => {
    console.log("Session Debug - ID:", req.sessionID);
    console.log("Session Debug - Data:", JSON.stringify(req.session, null, 2));
    next();
  });
}

// Helper to save session with promise
export function saveSession(req: any): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err: any) => {
      if (err) {
        console.error("Session save error:", err);
        reject(err);
      } else {
        console.log("Session saved successfully");
        resolve();
      }
    });
  });
}

// Helper to set user session data with enhanced persistence
export async function setUserSession(req: any, userId: string): Promise<void> {
  console.log("=== Setting User Session ===");
  console.log("Setting session userId:", userId);
  console.log("Session ID:", req.sessionID);
  console.log(
    "Session before setting userId:",
    JSON.stringify(req.session, null, 2),
  );

  // Ensure session exists
  if (!req.session) {
    throw new Error("Session not available");
  }

  // Set the userId directly without regeneration to avoid session data loss
  req.session.userId = userId;

  // Also set a timestamp to track when session was set
  req.session.lastUpdated = new Date().toISOString();

  console.log(
    "Session after setting userId:",
    JSON.stringify(req.session, null, 2),
  );

  // Save the session with promise and ensure it's persisted
  return new Promise((resolve, reject) => {
    req.session.save((saveErr: any) => {
      if (saveErr) {
        console.error("Session save error:", saveErr);
        reject(saveErr);
      } else {
        console.log("Session saved successfully for user:", userId);
        console.log("Session persisted with ID:", req.sessionID);
        resolve();
      }
    });
  });
}
