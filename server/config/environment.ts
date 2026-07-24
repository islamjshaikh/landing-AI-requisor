/**
 * Environment configuration for Requisor application
 *
 * CONFIGURATION PRIORITY:
 * 1. Replit Secrets (Production) - Takes highest priority
 * 2. Environment variables (process.env)
 * 3. .env files (Development/Local)
 * 4. Fallback defaults
 *
 * For production deployment: Use Replit Secrets for all configuration
 * For development: .env file or local environment variables
 */

export const getEnvironmentConfig = () => {
  const isProduction = process.env.NODE_ENV === "production";
  const isDevelopment = !isProduction;

  // Ports - configurable via environment variables
  const serverPort = parseInt(process.env.PORT || "5000", 10);
  const vitePort = parseInt(process.env.VITE_PORT || "5173", 10);
  const crewaiPort = parseInt(process.env.CREWAI_PORT || "8000", 10);

  // Base domain — env-driven only. APP_DOMAIN should be set in production;
  // DEV_DOMAIN (or APP_DOMAIN) for development. No more hard-coded
  // platform-specific fallbacks.
  const baseDomain = isProduction
    ? process.env.APP_DOMAIN ||
      process.env.PRODUCTION_DOMAIN ||
      `http://localhost:${serverPort}`
    : process.env.DEV_DOMAIN ||
      process.env.APP_DOMAIN ||
      `http://localhost:${serverPort}`;

  // Protocol — explicit override via APP_PROTOCOL, otherwise infer from
  // baseDomain (https for any non-localhost address in production).
  const protocol =
    process.env.APP_PROTOCOL ||
    (baseDomain.startsWith("https://")
      ? "https"
      : isProduction
        ? "https"
        : "http");

  const baseUrl = baseDomain.startsWith("http")
    ? baseDomain
    : `${protocol}://${baseDomain}`;

  // CrewAI service URL — external service. Env-driven only; no
  // platform-specific fallback.
  let crewaiBaseUrl =
    process.env.CREWAI_SERVICE_URL ||
    process.env.CREWAI_URL ||
    `http://localhost:${crewaiPort}`;
  crewaiBaseUrl = crewaiBaseUrl.replace(/\/$/, "");

  // Frontend and Backend URLs (for CrewAI integration)
  const frontendUrl = process.env.FRONTEND_URL || baseUrl;
  const backendBase = process.env.BACKEND_BASE || baseUrl;

  return {
    isProduction,
    isDevelopment,

    // Ports
    ports: {
      server: serverPort,
      vite: vitePort,
      crewai: crewaiPort,
    },

    // URLs for different services
    urls: {
      base: baseUrl,
      frontend: frontendUrl,
      backend: baseUrl,
      backendBase: backendBase,
      crewai: crewaiBaseUrl,
      app: baseUrl,
    },

    // API endpoints
    api: {
      base: `${baseUrl}/api`,
      oauth: `${baseUrl}/api/social`,
      crewai: `${crewaiBaseUrl}/generate`,
      openai:
        process.env.OPENAI_API_URL ||
        "https://api.openai.com/v1/chat/completions",
    },

    // OAuth callback URLs
    oauth: {
      mastodon: {
        callback: `${baseUrl}/api/social/mastodon/callback`,
        website: process.env.MASTODON_WEBSITE || "https://requisor.io",
      },
      jira: {
        authUrl:
          process.env.JIRA_AUTH_URL || "https://auth.atlassian.com/authorize",
        tokenUrl:
          process.env.JIRA_TOKEN_URL ||
          "https://auth.atlassian.com/oauth/token",
        apiUrl: process.env.JIRA_API_URL || "https://api.atlassian.com/ex/jira",
        resourcesUrl:
          process.env.JIRA_RESOURCES_URL ||
          "https://api.atlassian.com/oauth/token/accessible-resources",
      },
      smartsheet: {
        apiUrl:
          process.env.SMARTSHEET_API_URL || "https://api.smartsheet.com/2.0",
        authUrl:
          process.env.SMARTSHEET_AUTH_URL ||
          "https://app.smartsheet.com/b/authorize",
        tokenUrl:
          process.env.SMARTSHEET_TOKEN_URL ||
          "https://api.smartsheet.com/2.0/token",
      },
      asana: {
        apiUrl: process.env.ASANA_API_URL || "https://app.asana.com/api/1.0",
        authUrl:
          process.env.ASANA_AUTH_URL ||
          "https://app.asana.com/oauth2/authorize",
        tokenUrl:
          process.env.ASANA_TOKEN_URL || "https://app.asana.com/oauth2/token",
      },
      monday: {
        apiUrl: process.env.MONDAY_API_URL || "https://api.monday.com/v2",
        authUrl:
          process.env.MONDAY_AUTH_URL ||
          "https://auth.monday.com/oauth2/authorize",
        tokenUrl:
          process.env.MONDAY_TOKEN_URL ||
          "https://auth.monday.com/oauth2/token",
      },
    },

    // External service URLs
    external: {
      atlassianTokens:
        process.env.ATLASSIAN_TOKEN_URL ||
        "https://id.atlassian.com/manage-profile/security/api-tokens",
      atlassianSignup:
        process.env.ATLASSIAN_SIGNUP_URL ||
        "https://www.atlassian.com/try/cloud/signup",
    },

    // Media and uploads
    media: {
      baseUrl: process.env.MEDIA_BASE_URL || `${baseUrl}/media`,
      uploadsDir: process.env.UPLOADS_DIR || "./uploads",
    },

    // Database and storage
    database: {
      url: process.env.DATABASE_URL,
      redisUrl: process.env.REDIS_URL || "redis://localhost:6379/0",
    },

    // Email configuration
    email: {
      sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || "team@requisor.io",
      sendgridApiKey: process.env.SENDGRID_API_KEY,
    },

    // Social media & integrations
    social: {
      mastodonEncryptionKey:
        process.env.MASTODON_ENCRYPTION_KEY || process.env.SECRET_KEY,
      linkedinClientId: process.env.LINKEDIN_CLIENT_ID,
      linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      twitterClientId: process.env.TWITTER_CLIENT_ID,
      twitterClientSecret: process.env.TWITTER_CLIENT_SECRET,
      facebookAppId: process.env.FACEBOOK_APP_ID,
      facebookAppSecret: process.env.FACEBOOK_APP_SECRET,
    },

    // AI services
    ai: {
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    },

    // Payment services
    payment: {
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    },

    // Security — never expose a fixed fallback secret. The session layer in
    // server/auth.ts fails-fast in production if this is unset, and
    // generates a per-process random secret in development.
    security: {
      sessionSecret: process.env.SESSION_SECRET || "",
    },

    // Scheduling
    scheduling: {
      timezone: process.env.SCHED_TZ || "UTC",
    },

    // CrewAI configuration
    crewai: {
      baseUrl: crewaiBaseUrl,
      apiUrl: `${crewaiBaseUrl}/generate`,
      healthUrl: `${crewaiBaseUrl}/health`,
    },
  };
};

export const config = getEnvironmentConfig();
