# Requisor - AI-Powered Project Management Platform

## Overview
Requisor is an intelligent project management platform that combines traditional project management with advanced AI capabilities. It helps users create, plan, and collaborate on projects with AI assistance for project generation, task analysis, and workflow optimization. Requisor aims to enhance productivity and provide insights for solopreneurs, freelancers, and small businesses. Its AI agents assist with project planning, budget estimation, social media content generation, agile story writing, and intelligent task prioritization.

## User Preferences
Preferred communication style: Simple, everyday language.
Code style: Use React with TypeScript, Tailwind CSS for styling, shadcn/ui components.
Development approach: Build comprehensive features with full functionality.
Testing approach: User manually tests features through UI interaction.

## System Architecture
Requisor is a full-stack TypeScript application designed with a client-server architecture.

-   **Frontend**: React with TypeScript, Vite, Radix UI, Tailwind CSS, React Query, Wouter, React Hook Form, and Zod. Features a modern, clean design with intuitive navigation and a ChatGPT-style conversational interface for AI interactions.
-   **Backend**: Node.js with Express and TypeScript, providing a RESTful API and a service layer for business logic.
-   **Database**: PostgreSQL with Drizzle ORM.
-   **Authentication**: OpenID Connect.
-   **AI Integration**: Utilizes OpenAI GPT-4o (with SSE streaming), OpenAI Whisper for audio transcription, and Anthropic Claude for supplementary capabilities. CrewAI is used for content generation workflows.
-   **Core Features**: Includes natural language project creation, AI-powered task breakdown, budget/quote generation, resource allocation, onboarding automation, intelligent task prioritization, and specialized content generation. It supports multi-turn conversations and context awareness for AI agents.
-   **Build Mode**: Integrates coding agents (Replit Agent, Claude Code, Cursor, Lovable) to generate platform-optimized implementation prompts from feature candidates. Prompts are tailored to specific agents and include project context, file locations, tasks, and acceptance criteria.
-   **Meetings & Conversations**: Manages meeting transcripts and chat exports from various sources (Slack, Zoom, Google Meet, Teams, Manual, Transcription). Features manual import, audio/video transcription, and OAuth integrations for major meeting platforms. AI summarization is powered by OpenAI GPT-4o.
-   **Discovery Loop Features**:
    -   **Evidence Library**: A searchable repository for notes, transcripts, files, and usage data, attachable to AI conversations.
    -   **Feature Prioritization & Scoring**: AI-driven (GPT-4o) and manual scoring of feature candidates using Impact, Effort, Confidence (RICE scoring), displayed in a priority matrix.
    -   **Streaming AI Responses**: Real-time streaming of AI responses in both Plan and Build modes using SSE.
    -   **Floating Prompt Suggestions**: Contextual prompt pills in chat for guiding user interaction with AI.
    -   **Product Usage Data Import**: Allows importing CSV/JSON usage data for AI analysis and evidence generation.
    -   **Feature Refinement**: A dialog for refining feature specifications with inline AI chat and suggestions.
    -   **Export & Stakeholder Sharing**: Enables exporting reports as PDF/Markdown and generating shareable, read-only public links.
    -   **Audio/Video Transcription**: Transcribes audio/video files (MP3, MP4, WAV, M4A, WebM) via OpenAI Whisper, saving them as conversations and evidence items.
    -   **Google Meet Integration**: Comprehensive management of Google Meet meetings, including creation, import from calendar, transcript fetching, and timezone-safe storage.
    -   **Microsoft Teams Enhancements**: Improved meeting scheduling with calendar API, multi-attendee support, and Graph API-based transcript fetching.
    -   **Zoom Integration**: Full Zoom meeting management (creation, listing, updates, deletions), email invitations via Brevo, and cloud recording transcript fetching.
    -   **Context Brain**: Structured context intelligence layer that parses raw text (ChatGPT/Claude conversations, meeting notes, feedback) into categorized insights (Problems, Features, Decisions, Insights, Questions). Extends the Evidence Library with `insightType` classification. Supports ChatGPT data export import. Backend service: `server/services/context-parser.ts`, API routes: `/api/context/*`.
    -   **Frequency-Based Auto-Prioritization**: Evidence items and feature candidates track `mentionCount` (how many times a topic appears across sources). Context Brain parse route detects duplicates via title similarity (exact, substring, Jaccard >= 0.6) and increments mention count instead of creating duplicates. RICE scoring applies a frequency boost (+5-15 points) for features mentioned 3+ times. Feature candidates auto-derive mention counts from related evidence during prioritization. Flame badges in UI (brain.tsx, evidence.tsx, FeatureCandidateCard) show mention frequency.

    -   **Bring Your Own Claude Key (BYOK)**: Users can supply their own Anthropic Claude API key so that ALL chat/analysis AI runs through Claude on their own billing, with a zero-retention posture and NO token caps while their own key is active. The platform OpenAI key is never used for own-key users. Architecture: `server/services/ai-context.ts` (AsyncLocalStorage carries the request's userId) + `server/services/ai-provider.ts` (resolves per-user config and returns an OpenAI-SDK-shaped smart client via `getAiClient()` that routes to Claude when a key is active, translating requests/responses incl. streaming and one-way tool/function calling). All `new OpenAI()` call sites use `getAiClient()`. Fails closed — if an own-key user's key is missing/undecryptable it throws rather than falling back to platform. A separate optional user-controlled transcription key (OpenAI Whisper) handles audio, since Claude can't transcribe; own-key users without one get a clear "transcription disabled" error (never a silent platform fallback). Keys are AES-256-GCM encrypted at rest, write-only to the client (only last-4 shown), testable, and removable. Settings table: `user_ai_settings`. API: `GET/PUT/POST-test/DELETE /api/ai-settings`; `/api/tokens/budget` includes `ownKeyActive`/`provider`. UI: Settings → AI Provider (`client/src/pages/settings.tsx`); token caps hidden when own key active (`client/src/pages/token-usage.tsx`).
    -   **AI Token Tracking & Budget System**: Comprehensive token usage tracking across all 56 OpenAI API calls. Database tables: `token_usage` (per-call logs with feature, model, input/output tokens, cost), `token_budgets` (per-user monthly limits with reset dates). Central tracking service: `server/services/token-tracker.ts` with `trackTokenUsage()`, `checkTokenBudget()`, `getTokenUsageSummary()`, `getModelForBudget()`, `getUserPlanSlug()`. Plan-based limits (Free: 5K, Starter: 100K, Builder: 1M, Pro: 5M, Business: 10M, Enterprise: 50M tokens/month). Free plan: 1 project, 5K tokens. Graceful degradation: auto-downgrades to GPT-4o-mini when budget exceeded. Warning at 80% usage. Professional upgrade modal (`UpgradeModal.tsx`) with `useUpgradeModal()` hook triggers on token/project limit hits. Pre-call budget check blocks AI chat when exceeded. Sidebar shows mini budget progress bar. API endpoints: `GET /api/tokens/usage`, `GET /api/tokens/budget` (includes plan name, project limits). UI: Token Usage page at `/token-usage` with budget progress, feature breakdown, recent calls, upgrade button, and cost estimates.

## External Dependencies
-   **Frontend Libraries**: React, Vite, Radix UI, Tailwind CSS, React Query, Wouter, React Hook Form, Zod, jsPDF.
-   **Backend Libraries**: Express, Drizzle ORM, Express Session, Multer.
-   **Database**: PostgreSQL (Neon serverless).
-   **AI Services**: OpenAI (GPT-4o, Whisper), Anthropic, CrewAI.
-   **Authentication**: OpenID Connect provider.
-   **Email Service**: SendGrid.
-   **Project Management Integrations**: Smartsheet API, Asana API, Jira API, Monday.com API.
-   **Utility Libraries**: `react-confetti`, `html2canvas`, `pdf-parse-new`, `mammoth`.
-   **Social Media Integration**: Mastodon API.