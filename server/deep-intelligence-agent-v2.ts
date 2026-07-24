import OpenAI from "openai";
import { getAiClient } from "./services/ai-provider";
import { format, addDays, addWeeks } from "date-fns";
import { PlannerMemoryManager, ProjectContext } from "./project-planner-memory";
import { trackTokenUsage, getModelForBudget } from "./services/token-tracker";
import {
  recallMemory,
  formatMemoryForPrompt,
  persistMemory,
  type AgentMemoryContext,
} from "./services/agent-memory";

const openai = (getAiClient() as any);

class DeepProjectPlannerAgent {
  private memoryManager = new PlannerMemoryManager();
  public trackingUserId: string | null = null;

  get memory() {
    return this.memoryManager;
  }

  async initSession(userId: string): Promise<string> {
    return this.memoryManager.createSession(userId);
  }

  async processMessage(message: string, sessionId: string): Promise<any> {
    console.log(`Deep planner processing message with sessionId: ${sessionId}`);
    console.log(
      `Available sessions in memory:`,
      Array.from(this.memoryManager["memories"].keys()),
    );

    const session = this.memoryManager.getSession(sessionId);
    if (!session) {
      console.error(
        `Session ${sessionId} not found in memory. Creating emergency session.`,
      );
      // Create emergency session as fallback
      const emergencySessionId =
        this.memoryManager.createSession("emergency-user");
      const emergencySession =
        this.memoryManager.getSession(emergencySessionId);
      if (!emergencySession) {
        throw new Error("Failed to create emergency session");
      }
      // Use emergency session for processing
      return this.processWithSession(
        message,
        emergencySession,
        emergencySessionId,
      );
    }

    return this.processWithSession(message, session, sessionId);
  }

  private async processWithSession(
    message: string,
    session: any,
    sessionId: string,
  ): Promise<any> {
    // Check if message is a greeting or non-actionable - DO NOT mutate state
    if (this.isGreetingOrNonActionable(message)) {
      console.log(`🤝 Detected greeting/non-actionable message, responding conversationally`);
      this.memoryManager.addMessage(sessionId, "user", message);
      const conversationalResponse = {
        type: "conversation",
        content: "Hello! I'm your AI project planning assistant. How can I help you with your project today? You can ask me to create a new project plan, add features, update timelines, or modify existing milestones.",
        projectPlan: null,
        noChanges: true
      };
      this.memoryManager.addMessage(sessionId, "assistant", conversationalResponse.content);
      return conversationalResponse;
    }

    // Check if message has explicit intent to modify the project
    if (!this.hasExplicitIntent(message)) {
      console.log(`❓ Message lacks explicit intent, asking for clarification`);
      this.memoryManager.addMessage(sessionId, "user", message);
      const clarificationResponse = {
        type: "clarification",
        content: "I'm not sure what changes you'd like me to make. Could you please be more specific? For example, you can ask me to:\n- Add a new feature or milestone\n- Update the timeline or dates\n- Modify task details\n- Create a new project plan",
        projectPlan: null,
        noChanges: true
      };
      this.memoryManager.addMessage(sessionId, "assistant", clarificationResponse.content);
      return clarificationResponse;
    }

    // Extract project information from message
    const extractedInfo = this.extractProjectInfo(message);
    console.log(`🔍 Extracted info from message:`, extractedInfo);
    this.memoryManager.updateContext(sessionId, extractedInfo);

    // Log the final session context
    const updatedSession = this.memoryManager.getSession(sessionId);
    console.log(`🔍 Updated session context:`, updatedSession?.projectContext);

    // Add user message to history
    this.memoryManager.addMessage(sessionId, "user", message);

    // Long-term memory hooks. The user-side persist runs as fire-and-forget;
    // recall is awaited so the result can be folded into prompt building below.
    const memCtx: AgentMemoryContext = {
      userId: (session as any)?.userId ?? this.trackingUserId ?? null,
      agentName: "deep-intelligence-agent-v2",
      sessionId,
      retrieve: true,
      compress: true,
    };
    void persistMemory({ ctx: memCtx, userQuery: message });
    const recall = await recallMemory(message, memCtx);
    const memoryHeader = formatMemoryForPrompt(recall);
    // Stash on the session so prompt builders downstream can read it.
    (session as any).__memoryHeader = memoryHeader;

    // Check if this is a specific request type that should generate immediately
    const isRFPAnalysis =
      message.toLowerCase().includes("analyze client rfp") ||
      (message.toLowerCase().includes("analyze") &&
        message.toLowerCase().includes("rfp"));
    const isComplianceDoc =
      message.toLowerCase().includes("process compliance documentation") ||
      message.toLowerCase().includes("compliance documentation");

    // Generate project plan only when there's explicit intent
    const response = await this.generateProjectPlan(
      message,
      session.projectContext,
      memoryHeader,
    );
    this.memoryManager.addMessage(
      sessionId,
      "assistant",
      response.content || "",
    );
    // Persist the assistant turn to long-term memory.
    void persistMemory({
      ctx: memCtx,
      agentResponse: response.content || "",
    });
    return response;
  }

  private isGreetingOrNonActionable(message: string): boolean {
    const normalizedMessage = message.toLowerCase().trim();
    
    // Common greetings
    const greetings = [
      'hi', 'hello', 'hey', 'hola', 'howdy', 'sup', 'yo',
      'good morning', 'good afternoon', 'good evening', 'good night',
      'hi there', 'hello there', 'hey there',
      'what\'s up', 'whats up', 'wassup',
      'greetings', 'salutations'
    ];
    
    // Non-actionable phrases
    const nonActionable = [
      'thanks', 'thank you', 'thx', 'ty',
      'ok', 'okay', 'k', 'kk',
      'yes', 'no', 'maybe', 'sure', 'alright',
      'cool', 'nice', 'great', 'awesome', 'good',
      'got it', 'understood', 'i see', 'i understand',
      'hmm', 'hm', 'um', 'uh'
    ];
    
    // Check for exact matches or very short messages that are likely greetings
    if (greetings.includes(normalizedMessage) || nonActionable.includes(normalizedMessage)) {
      return true;
    }
    
    // Check if message is too short to be actionable (less than 4 characters)
    if (normalizedMessage.length < 4 && !normalizedMessage.includes('add') && !normalizedMessage.includes('new')) {
      return true;
    }
    
    return false;
  }

  private hasExplicitIntent(message: string): boolean {
    const normalizedMessage = message.toLowerCase();
    
    // Keywords that indicate explicit intent to create/modify a project
    const actionKeywords = [
      // Creation keywords
      'create', 'build', 'make', 'develop', 'design', 'plan', 'start', 'begin', 'new',
      // Modification keywords
      'add', 'update', 'change', 'modify', 'edit', 'remove', 'delete', 'move', 'shift',
      // Feature/task keywords
      'feature', 'task', 'milestone', 'phase', 'module', 'component', 'integration',
      // Project types
      'project', 'app', 'application', 'system', 'platform', 'website', 'portal',
      'crm', 'erp', 'saas', 'api', 'dashboard', 'mobile',
      // Analysis keywords
      'analyze', 'rfp', 'compliance', 'documentation',
      // Timeline keywords
      'timeline', 'schedule', 'deadline', 'due date', 'duration',
      // Context keywords indicating update request
      'context:', 'merge', 'existing'
    ];
    
    // Check if any action keyword is present
    return actionKeywords.some(keyword => normalizedMessage.includes(keyword));
  }

  private extractProjectInfo(content: string): Partial<ProjectContext> {
    const info: Partial<ProjectContext> = {};

    // Skip date extraction for UPDATE requests to avoid extracting dates from existing project JSON
    const isUpdateRequest = content.includes("CONTEXT: This is an UPDATE");
    
    if (isUpdateRequest) {
      console.log("⏭️ Skipping date extraction for UPDATE request - preserving existing project timeline");
      // Only extract non-date info like project type
      if (content.toLowerCase().includes("marketing"))
        info.projectType = "marketing";
      else if (
        content.toLowerCase().includes("software") ||
        content.toLowerCase().includes("app")
      )
        info.projectType = "software";
      else if (content.toLowerCase().includes("onboarding"))
        info.projectType = "onboarding";
      else if (content.toLowerCase().includes("website"))
        info.projectType = "website";
      else if (content.toLowerCase().includes("launch"))
        info.projectType = "product_launch";
      
      return info;
    }

    // Enhanced date parsing for specific dates and delivery deadlines
    const currentYear = new Date().getFullYear();
    const today = new Date();
    let targetDate: Date | null = null;

    // Try to extract specific dates in various formats
    const datePatterns = [
      // "10 dec", "7th Dec", "7th December" - most common format
      /(?:due\s+date\s+|deadline\s+|by\s+|on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)/i,
      // "Dec 7", "December 7", "dec 10"
      /(?:on\s+|by\s+|deadline\s+|due\s+date\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?/i,
      // "2025-12-07", "12/07/2025", "07/12/2025"
      /(\d{4}-\d{1,2}-\d{1,2})|(\d{1,2}\/\d{1,2}\/\d{4})/,
    ];

    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        try {
          if (pattern === datePatterns[0]) {
            // "10 dec", "7th Dec" format - day month
            const day = parseInt(match[1]);
            const monthStr = match[2].toLowerCase();
            const month = this.parseMonth(monthStr);
            if (month !== -1) {
              targetDate = new Date(currentYear, month, day);
              // If the date has passed this year, assume next year
              if (targetDate < today) {
                targetDate = new Date(currentYear + 1, month, day);
              }
              console.log(
                `📅 Parsed date from "${match[0]}": ${format(targetDate, "yyyy-MM-dd")}`,
              );
            }
          } else if (pattern === datePatterns[1]) {
            // "Dec 7", "dec 10" format - month day
            const monthStr = match[1].toLowerCase();
            const day = parseInt(match[2]);
            const month = this.parseMonth(monthStr);
            if (month !== -1) {
              targetDate = new Date(currentYear, month, day);
              // If the date has passed this year, assume next year
              if (targetDate < today) {
                targetDate = new Date(currentYear + 1, month, day);
              }
              console.log(
                `📅 Parsed date from "${match[0]}": ${format(targetDate, "yyyy-MM-dd")}`,
              );
            }
          } else if (pattern === datePatterns[2]) {
            // ISO or US format
            targetDate = new Date(match[1] || match[2]);
            console.log(
              `📅 Parsed date from "${match[0]}": ${format(targetDate, "yyyy-MM-dd")}`,
            );
          }
          break;
        } catch (error) {
          console.warn("Error parsing date:", error);
        }
      }
    }

    // If we found a target date, work backwards to create project timeline
    if (targetDate && !isNaN(targetDate.getTime())) {
      // Determine project duration based on complexity keywords
      let projectWeeks = 4; // default 4 weeks

      if (
        content.toLowerCase().includes("simple") ||
        content.toLowerCase().includes("quick")
      ) {
        projectWeeks = 2;
      } else if (
        content.toLowerCase().includes("complex") ||
        content.toLowerCase().includes("enterprise")
      ) {
        projectWeeks = 8;
      } else if (
        content.toLowerCase().includes("app") ||
        content.toLowerCase().includes("platform")
      ) {
        projectWeeks = 6;
      }

      // Calculate start date by working backwards from target date
      const startDate = addWeeks(targetDate, -projectWeeks);

      info.timeline = {
        start: format(startDate, "yyyy-MM-dd"),
        end: format(targetDate, "yyyy-MM-dd"),
      };
      console.log(
        `✅ Created timeline from ${format(startDate, "yyyy-MM-dd")} to ${format(targetDate, "yyyy-MM-dd")}`,
      );
    } else {
      // Fallback: Extract duration mentions like "4 weeks", "2 months"
      const timelineMatch = content.match(/(\d+)\s*(week|month|day)s?/i);
      if (timelineMatch) {
        const duration = parseInt(timelineMatch[1]);
        const unit = timelineMatch[2].toLowerCase();
        const startDate = new Date();
        let endDate = new Date();

        if (unit === "week") {
          endDate = addWeeks(startDate, duration);
        } else if (unit === "month") {
          endDate = addWeeks(startDate, duration * 4);
        } else if (unit === "day") {
          endDate = addDays(startDate, duration);
        }

        info.timeline = {
          start: format(startDate, "yyyy-MM-dd"),
          end: format(endDate, "yyyy-MM-dd"),
        };
      }
    }

    // Extract budget mentions
    const budgetMatch = content.match(/\$?([\d,]+)k?\s*(budget|cost)?/i);
    if (budgetMatch) {
      const amount = parseFloat(budgetMatch[1].replace(/,/g, ""));
      info.budget = budgetMatch[1].includes("k") ? amount * 1000 : amount;
    }

    // Extract team size
    const teamMatch = content.match(/(\d+)\s*(person|people|team member)s?/i);
    if (teamMatch) {
      info.teamSize = parseInt(teamMatch[1]);
    }

    // Detect project type
    if (content.toLowerCase().includes("marketing"))
      info.projectType = "marketing";
    else if (
      content.toLowerCase().includes("software") ||
      content.toLowerCase().includes("app")
    )
      info.projectType = "software";
    else if (content.toLowerCase().includes("onboarding"))
      info.projectType = "onboarding";
    else if (content.toLowerCase().includes("website"))
      info.projectType = "website";
    else if (content.toLowerCase().includes("launch"))
      info.projectType = "product_launch";

    return info;
  }

  private parseMonth(monthStr: string): number {
    const months: { [key: string]: number } = {
      jan: 0,
      january: 0,
      feb: 1,
      february: 1,
      mar: 2,
      march: 2,
      apr: 3,
      april: 3,
      may: 4,
      jun: 5,
      june: 5,
      jul: 6,
      july: 6,
      aug: 7,
      august: 7,
      sep: 8,
      september: 8,
      oct: 9,
      october: 9,
      nov: 10,
      november: 10,
      dec: 11,
      december: 11,
    };
    return months[monthStr.toLowerCase()] ?? -1;
  }

  private getMissingInformation(context: ProjectContext): string[] {
    const missing: string[] = [];

    if (!context.projectType) {
      missing.push("project_type");
    }
    if (!context.timeline) {
      missing.push("timeline");
    }
    if (!context.goals || context.goals.length === 0) {
      missing.push("goals");
    }

    return missing;
  }

  private isReadyToGeneratePlan(
    message: string,
    context: ProjectContext,
  ): boolean {
    // Check if this is an RFP analysis request
    const isRFPAnalysis =
      message.toLowerCase().includes("analyze client rfp") ||
      (message.toLowerCase().includes("analyze") &&
        message.toLowerCase().includes("rfp"));

    // For RFP analysis, always generate a plan immediately
    if (isRFPAnalysis) {
      return true;
    }

    // Check if user is explicitly asking for a plan
    const planKeywords = [
      "create",
      "generate",
      "build",
      "plan",
      "start",
      "begin",
    ];
    const hasExplicitRequest = planKeywords.some((keyword) =>
      message.toLowerCase().includes(keyword),
    );

    // Check if we have enough context
    const hasBasicInfo =
      Boolean(context.projectType) || message.length > 50 || hasExplicitRequest;

    return hasBasicInfo;
  }

  private async generateClarifyingQuestions(
    message: string,
    context: ProjectContext,
    missingInfo: string[],
  ): Promise<any> {
    const systemPrompt = `You are an expert project planning consultant helping users create detailed project plans.
Your role is to ask thoughtful, clarifying questions to gather the information needed for a comprehensive plan.

Current context:
- Project Type: ${context.projectType || "Not specified"}
- Timeline: ${context.timeline ? `${context.timeline.start} to ${context.timeline.end}` : "Not specified"}
- Budget: ${context.budget ? `$${context.budget}` : "Not specified"}
- Team Size: ${context.teamSize || "Not specified"}

Missing information: ${missingInfo.join(", ")}

Ask 2-3 specific, helpful questions to clarify the project scope. Be conversational and professional.
Focus on understanding their goals, constraints, and success criteria.`;

    const clarifyModel = this.trackingUserId ? await getModelForBudget(this.trackingUserId, "gpt-4o") : "gpt-4o";
    const completion = await openai.chat.completions.create({
      model: clarifyModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    if (this.trackingUserId && completion.usage) {
      trackTokenUsage(this.trackingUserId, "deep-planner-clarify", clarifyModel, completion.usage).catch(() => {});
    }

    return {
      content:
        completion.choices[0].message.content ||
        "Could you provide more details about your project?",
      suggestions: [],
      confidence: 0.8,
    };
  }

  /**
   * Enriches user message with domain-specific context
   */
  private enrichMessageWithContext(message: string): string {
    const lowerMessage = message.toLowerCase();
    let enrichedContext = "";

    // CRM/Marketing domain
    if (
      lowerMessage.includes("crm") ||
      lowerMessage.includes("customer relationship")
    ) {
      enrichedContext += `\n\n🎯 DOMAIN CONTEXT - CRM System (Generate SPECIFIC modules, not generic phases):
Core Modules to Build:
- Lead Management Module: Lead capture forms, lead scoring algorithm, lead assignment rules, follow-up task automation, lead source tracking
- Contact Database: Contact profiles with custom fields, communication history log, organization hierarchy, contact segmentation by tags
- Sales Pipeline Builder: Drag-drop deal stages, revenue forecasting calculations, pipeline analytics dashboard, deal probability scoring
- Campaign Management: Multi-channel campaign builder (email/social/ads), budget allocation, ROI calculation, conversion tracking
- Activity Timeline: Call logging with notes, email thread integration, meeting scheduler, task creation and assignment
- Email Sync Integration: Gmail API OAuth flow, email tracking pixels, email templates library, automated follow-up sequences
- Analytics Dashboard: Lead-by-source charts, conversion funnel visualization, sales rep performance metrics, campaign ROI reports
- Notification System: Follow-up reminders, deal stage change alerts, campaign milestone notifications
- User Role Management: Admin/Sales Manager/Sales Rep permissions, access control by data ownership

Technical Stack Requirements:
- Frontend: React with TypeScript, Chart.js/Recharts for analytics, Drag-and-drop library (react-beautiful-dnd)
- Backend: Node.js/Express with RESTful APIs, JWT authentication, role-based middleware
- Database: PostgreSQL with properly indexed foreign keys for relationships
- Auth: OAuth 2.0 for Google/Microsoft, JWT tokens, bcrypt password hashing
- External APIs: Gmail API, Google Ads API, Meta Business API for campaign tracking
- Real-time: WebSocket connections for live notifications`;
    }

    // E-commerce domain
    if (
      lowerMessage.includes("ecommerce") ||
      lowerMessage.includes("e-commerce") ||
      lowerMessage.includes("online store")
    ) {
      enrichedContext += `\n\n🎯 DOMAIN CONTEXT - E-commerce Platform (Generate SPECIFIC features, not generic phases):
Core Features to Build:
- Product Catalog System: Product CRUD with images, variant management (size/color/etc), inventory tracking, category tree, product search with filters
- Shopping Cart Module: Add to cart functionality, quantity updates, cart persistence, coupon code validation, cart abandonment tracking
- Checkout Flow: Multi-step form (shipping/billing/payment), address validation, payment method selection, order summary preview
- Payment Integration: Stripe Checkout integration, webhook handlers for payment confirmation, refund processing, payment method storage
- Order Management: Order status tracking (pending→processing→shipped→delivered), order history page, invoice PDF generation
- User Account System: Registration/login, profile management, saved addresses, order history, wishlist functionality
- Shipping Calculator: Integration with shipping APIs (ShipStation/EasyPost), rate calculation, label generation, tracking number updates
- Admin Dashboard: Product inventory management, order processing interface, customer management, sales analytics
- Product Reviews: Star rating system, review submission form, review moderation queue, helpful votes
- Analytics Module: Sales reports by date range, best-selling products, customer lifetime value, conversion rate tracking

Technical Stack Requirements:
- Frontend: React/Next.js, responsive design (mobile-first), image optimization (next/image)
- Backend: Node.js with Express or Next.js API routes, session management
- Database: PostgreSQL for transactional data, Redis for cart caching
- Payment: Stripe API with webhooks, PCI compliance considerations
- Storage: AWS S3 for product images, CloudFront CDN
- Email: SendGrid for order confirmations, abandoned cart emails`;
    }

    // Healthcare domain
    if (
      lowerMessage.includes("health") ||
      lowerMessage.includes("medical") ||
      lowerMessage.includes("patient")
    ) {
      enrichedContext += `\n\n🎯 DOMAIN CONTEXT - Healthcare System (Generate SPECIFIC features, not generic phases):
Core Features to Build:
- Patient Registration: Patient intake form, insurance information capture, medical history questionnaire, emergency contact storage
- Appointment Scheduler: Calendar view with doctor availability, time slot booking, appointment reminders (SMS/email), rescheduling workflow
- Electronic Health Records: Clinical notes editor, diagnosis codes (ICD-10), prescription management, lab results viewer, allergy tracking
- Billing Module: Charge capture, insurance claim generation, copay calculation, payment processing, billing statement generation
- Doctor Portal: Daily schedule view, patient chart access, e-prescription writing, lab order entry, clinical documentation
- Telemedicine Platform: Video consultation integration (Twilio/Zoom), screen sharing, chat messaging, session recording
- Lab Integration: Lab order creation, HL7/FHIR results parsing, abnormal value flagging, results notification
- Prescription System: Drug database integration, dosage calculator, interaction checker, pharmacy e-prescription transmission
- HIPAA Compliance: Audit logging, data encryption at rest/transit, access control, user activity tracking

Technical Stack Requirements:
- Frontend: React with HIPAA-compliant hosting, secure WebSocket connections
- Backend: FHIR-compliant REST APIs, Node.js/Django with security middleware
- Database: PostgreSQL with encryption at rest, regular HIPAA-compliant backups
- Security: OAuth 2.0, multi-factor authentication, role-based access control
- Video: Twilio Video API or Zoom SDK with end-to-end encryption
- Notifications: Twilio SMS for appointment reminders, SendGrid for encrypted emails`;
    }

    // Social Media domain
    if (
      lowerMessage.includes("social media") ||
      lowerMessage.includes("social network")
    ) {
      enrichedContext += `\n\n🎯 DOMAIN CONTEXT - Social Media Platform (Generate SPECIFIC features, not generic phases):
Core Features to Build:
- User Profile System: Profile creation with bio, avatar upload with crop tool, cover photo, follower/following counts, verification badges
- Post Creation: Text/image/video posts, media upload with compression, hashtag parsing, mention tagging, post privacy settings
- Feed Algorithm: Chronological or algorithmic feed, post ranking by engagement, infinite scroll pagination, real-time updates
- Interaction System: Like/unlike functionality, nested comment threads, post sharing/reposting, reaction types
- Real-time Messaging: Direct message threads, group chat creation, typing indicators, read receipts, message search
- Content Moderation: User reporting system, admin review queue, auto-flagging of inappropriate content, user blocking
- Notification Center: Real-time push notifications for likes/comments/follows, notification preferences, mark as read
- Search & Discovery: User search autocomplete, hashtag search, trending topics algorithm, explore page recommendations
- Privacy Controls: Public/private account toggle, block/unblock users, hide posts, content visibility settings
- Media CDN: Image/video upload to S3, CloudFront distribution, responsive image sizes, lazy loading

Technical Stack Requirements:
- Frontend: React/Next.js with WebSocket client, real-time UI updates
- Backend: Node.js with Socket.io for WebSockets, GraphQL or REST APIs
- Database: PostgreSQL for user/post data, Redis for real-time feeds and caching
- Storage: AWS S3 for media, CloudFront for CDN delivery
- Real-time: Socket.io or Server-Sent Events for live updates
- Moderation: AWS Rekognition for image moderation, Perspective API for text`;
    }

    // Education/Learning domain
    if (
      lowerMessage.includes("learning") ||
      lowerMessage.includes("education") ||
      lowerMessage.includes("course") ||
      lowerMessage.includes("lms")
    ) {
      enrichedContext += `\n\n🎯 DOMAIN CONTEXT - Learning Management System (Generate SPECIFIC features, not generic phases):
Core Features to Build:
- Course Catalog: Course listings with thumbnails, category filtering, search functionality, rating/review display, enrollment counts
- Enrollment System: Course enrollment workflow, payment integration, refund processing, access control by enrollment status
- Video Player: Custom video player with progress tracking, playback speed control, quality selection, resume from last position
- Content Delivery: Lesson navigation sidebar, reading materials viewer, downloadable resources, sequential unlocking
- Assessment Engine: Quiz builder with multiple question types, auto-grading system, assignment upload, peer review workflow
- Progress Tracking: Course completion percentage, time spent per lesson, quiz score history, learning path visualization
- Discussion Forums: Course-specific forum threads, Q&A upvoting, instructor response highlighting, notification on replies
- Instructor Dashboard: Content upload interface, student progress analytics, assignment grading interface, communication tools
- Certificate Generation: Auto-generate completion certificates with unique codes, PDF download, verification portal
- Live Class Integration: Zoom/Agora integration for live sessions, screen sharing, breakout rooms, session recording

Technical Stack Requirements:
- Frontend: React with Video.js or Plyr for video playback
- Backend: Node.js/Django with REST APIs, file upload handling
- Database: PostgreSQL for course data, MongoDB for flexible assessment schemas
- Video Hosting: AWS S3 + CloudFront for HLS streaming, video transcoding
- Live Video: Zoom SDK, Agora.io, or WebRTC for live classes
- Certificates: jsPDF or PDFKit for certificate generation`;
    }

    // Fintech/Banking domain
    if (
      lowerMessage.includes("fintech") ||
      lowerMessage.includes("banking") ||
      lowerMessage.includes("payment") ||
      lowerMessage.includes("wallet")
    ) {
      enrichedContext += `\n\n🎯 DOMAIN CONTEXT - Fintech Application (Generate SPECIFIC features, not generic phases):
Core Features to Build:
- Account Creation: User registration with KYC verification (document upload, facial recognition), account approval workflow
- Digital Wallet: Wallet balance display, add funds via bank transfer/card, withdraw to linked bank, transaction limits
- Transaction System: P2P money transfer, QR code payments, transaction history with search/filter, receipt generation
- Card Management: Virtual card issuance, card controls (freeze/unfreeze), spending limits by category, PIN management
- Bill Payment Module: Utility bill payment integration, mobile recharge, scheduled payments, payment reminders
- Bank Linking: Plaid integration for account verification, balance checking, ACH transfers, multi-bank support
- Security Features: 2FA with SMS/authenticator app, biometric authentication (fingerprint/face), transaction alerts
- Spending Analytics: Categorize transactions automatically, spending breakdown charts, budget tracking, export to CSV
- Compliance Module: AML screening for high-value transactions, KYC document storage, audit trail logging, regulatory reporting
- Customer Support: In-app chat support, dispute transaction flow, FAQ/help center

Technical Stack Requirements:
- Frontend: React with secure architecture, encryption for sensitive data display
- Backend: Node.js/.NET with PCI-DSS compliance, secure API design
- Database: PostgreSQL with encryption at rest, audit logging
- Security: OAuth 2.0, JWT with short expiry, AES-256 encryption, HSM for key storage
- Payment APIs: Stripe for card processing, Plaid for bank account linking
- Compliance: Jumio/Onfido for KYC verification, ComplyAdvantage for AML screening`;
    }

    return message + enrichedContext;
  }

  private async generateProjectPlan(
    message: string,
    context: ProjectContext,
    memoryHeader: string = "",
  ): Promise<any> {
    const today = new Date();
    const defaultStartDate = format(today, "yyyy-MM-dd");
    const defaultEndDate = format(addWeeks(today, 4), "yyyy-MM-dd");

    // Enrich message with domain-specific context
    const enrichedMessage = this.enrichMessageWithContext(message);
    console.log(
      `[Deep Planner] Enriched message with domain context. Original length: ${message.length}, Enriched length: ${enrichedMessage.length}`,
    );

    // Check if this is an RFP analysis request
    const isRFPAnalysis =
      message.toLowerCase().includes("analyze client rfp") ||
      (message.toLowerCase().includes("analyze") &&
        message.toLowerCase().includes("rfp"));

    // Check if this is a compliance documentation request
    const isComplianceDoc =
      message.toLowerCase().includes("process compliance documentation") ||
      message.toLowerCase().includes("compliance documentation");

    // Check if this is an update/merge request with existing project context
    const isUpdateRequest = message
      .toLowerCase()
      .includes("context: this is an update");
    let existingProjectContext = null;

    if (isUpdateRequest) {
      // Extract existing project JSON from the message context
      const contextMatch = message.match(
        /here is the current project structure:\s*(\{[\s\S]*?\})\s*\n\nPlease MERGE/i,
      );
      if (contextMatch) {
        try {
          existingProjectContext = JSON.parse(contextMatch[1]);
          console.log(
            "Extracted existing project context for merging:",
            existingProjectContext.name || "Unnamed Project",
          );
        } catch (error) {
          console.warn(
            "Failed to parse existing project context, proceeding with new plan",
          );
        }
      }
    }

    const getSpecialization = () => {
      if (isRFPAnalysis)
        return " specializing in RFP analysis and response planning";
      if (isComplianceDoc)
        return " specializing in compliance documentation and regulatory frameworks";
      return "";
    };

    // Prepend memory header (long-term recall + recent turns) when present.
    const memoryPrefix = memoryHeader ? `${memoryHeader}\n\n---\n\n` : "";
    const systemPrompt = `${memoryPrefix}You are an AI Project Planning Assistant. Your job is to create, update, and maintain project timelines, milestones, and tasks with fully consistent dates.

CRITICAL: You must ONLY output valid JSON. Never respond with natural language, explanations, markdown, or code fences. ONLY return a single JSON object.

-------------------------
PROJECT PLAN RULES
-------------------------

1. When the user changes the project start date, end date, or any individual task's dates, you MUST recalculate the entire timeline.

2. All dependent tasks must shift forward or backward proportionally unless the user specifies exact new dates.

3. Never leave old dates unchanged after the user requests a date modification.

4. Always ensure:
   - start_date < end_date
   - tasks follow logical order
   - no task starts before the project start date
   - project end date automatically becomes the last task's end date

5. Each task must maintain its original duration unless the user explicitly requests changing the duration.

6. If the user changes:
   - ONLY project start date → shift all tasks
   - ONLY project end date → adjust final task duration or ask for clarification
   - A single task date → update dependent tasks accordingly

7. If any date provided by the user is impossible (e.g., end before start), ask for clarification instead of producing an invalid plan.

-------------------------
START DATE CHANGE HANDLING (CRITICAL)
-------------------------

When the user requests a change to the project start date, you MUST follow the user's EXPLICIT instruction about what to preserve:

CASE 1: User says "keep end date unchanged", "do NOT change end date", "end date must remain", "same end date":
- Update ONLY the start_date to the new date
- Keep the end_date EXACTLY the same as before
- Recalculate duration (duration = end_date - new_start_date)
- Shift milestone and task dates proportionally to fit within the new compressed/expanded timeframe
- The end_date must be IDENTICAL to the original end_date

CASE 2: User says "preserve duration", "keep duration", "same duration", "shift everything", "move everything":
- Update the start_date to the new date
- Calculate the delta (difference in days between old and new start date)
- Shift the end_date by the SAME delta
- Shift ALL milestone and task dates by the same delta
- All durations remain exactly the same

CASE 3: Ambiguous (user requests start date change but does NOT specify what to preserve):
- If the user just says "change start date to X" or "move start date to X" without specifying whether to keep end date or preserve duration:
- YOU MUST ask for clarification
- Return a JSON with "clarification" field containing the question: "Do you want to keep the end date unchanged (which will compress/expand the timeline) or preserve the project duration (which will shift the end date)?"
- DO NOT assume. DO NOT make changes to the project plan when ambiguous.

EXAMPLES:
- "Change start date to Dec 1 but keep the end date" → CASE 1: Update start, keep exact end date
- "Move start date to Dec 1, preserve the duration" → CASE 2: Shift everything by delta
- "Start the project on Dec 1 instead" → CASE 3: Ambiguous, ask clarification
- "Push back start date 2 weeks but DO NOT change end date" → CASE 1: Update start, keep exact end date
- "Delay start by 1 week, shift all dates" → CASE 2: Shift everything by delta

-------------------------
OUTPUT EXPECTATIONS
-------------------------

Always output a FULL updated project plan including:
- Project Name
- Description
- Start Date
- End Date
- Milestones (with updated dates)
- Tasks (with updated dates and priorities)

You must ALWAYS return the entire project plan after any update request, not only the updated field.

-------------------------
DATE SHIFTING LOGIC
-------------------------

When the project start date changes:
- Calculate the difference in days between the old and new start date.
- Shift ALL tasks and milestones by the same number of days.
Example:
Old start: Nov 1
New start: Nov 10 → shift = +9 days
Shift every task and milestone forward by 9 days.

When a single task's start or end date changes:
- Update that task.
- Recalculate dependent tasks.
- Keep durations consistent unless explicitly instructed otherwise.

-------------------------
TEXT CONTENT UPDATES (CRITICAL)
-------------------------

When the user requests text modifications like "make description more concise", "shorten", "simplify", "make shorter", "make more detailed", etc.:

1. IDENTIFY THE TARGET: Determine what the user wants to modify:
   - "make description more concise" → Modify the PROJECT description field
   - "make milestone X description shorter" → Modify a specific MILESTONE description
   - "simplify task Y description" → Modify a specific TASK description

2. PRESERVE EVERYTHING ELSE:
   - Keep ALL dates exactly the same
   - Keep ALL milestone and task names exactly the same
   - Keep ALL IDs exactly the same
   - Keep ALL priorities exactly the same
   - Keep ALL status values exactly the same
   - ONLY change the specific text field(s) requested

3. APPLY THE REQUESTED CHANGE:
   - "concise" / "shorter" → Reduce word count by 30-50% while preserving key information
   - "more detailed" → Add 2-3 more sentences with relevant details
   - "simplify" → Use simpler vocabulary, shorter sentences
   - "professional" → Use business terminology, formal tone

EXAMPLES:
- User: "Make the description more concise"
  → Shorten ONLY the projectCanvas.description field, keep everything else identical

- User: "Make milestone 1 description shorter"
  → Shorten ONLY that specific milestone's description, keep everything else identical

- User: "Add more detail to the first task"
  → Expand ONLY that task's description, keep everything else identical

⚠️ NEVER regenerate milestones, tasks, or dates for text-only requests.
⚠️ The structure must remain IDENTICAL - only the requested text changes.

-------------------------
MILESTONE COMBINATION/MERGE REQUESTS (CRITICAL)
-------------------------

When the user requests to combine, merge, or consolidate milestones:

1. IDENTIFY THE MILESTONES: Parse the user's request to identify which milestones to combine.
   - "Combine Milestone 3 and Milestone 4" → Combine those two specific milestones
   - "Merge 'Launch Preparation' and 'Marketing Strategy'" → Find milestones by name
   - "Consolidate the last two milestones" → Combine the final two milestones

2. CREATE THE COMBINED MILESTONE:
   - Name: Create a new name that represents both milestones (e.g., "Launch Preparation & Marketing Strategy")
   - Description: Merge the descriptions from both milestones into a cohesive summary
   - Due Date: Use the LATER due date of the two milestones
   - Tasks: Combine ALL tasks from BOTH milestones into the new milestone
   - Generate a NEW unique ID for the combined milestone

3. PRESERVE EVERYTHING ELSE:
   - Keep all OTHER milestones unchanged (same IDs, names, dates, tasks)
   - Adjust milestone numbering if needed
   - Keep all dates consistent

4. REPORT THE CHANGE:
   - In the "diff" field, list the original milestones in "removed" and the combined milestone in "added"
   - In the "content" field, describe exactly what was merged: "Merged 'Milestone X' and 'Milestone Y' into 'Combined Milestone Name'"

EXAMPLE:
User: "Combine Milestone 3 (Launch Preparation) and Milestone 4 (Marketing Strategy) into one"
→ Create new milestone "Launch Preparation & Marketing Strategy"
→ Merge both descriptions
→ Use the later due date
→ Combine all tasks from both milestones
→ DO NOT include "Launch Preparation" or "Marketing Strategy" in projectCanvas.milestones
→ ONLY include the new combined milestone
→ In diff.milestones.removed: ["Launch Preparation", "Marketing Strategy"] 
→ In diff.milestones.added: ["Launch Preparation & Marketing Strategy"]
→ Report: "Merged 'Launch Preparation' and 'Marketing Strategy' into 'Launch Preparation & Marketing Strategy' with all 8 tasks combined."

⚠️ CRITICAL: When combining milestones, the OLD milestones MUST NOT appear in your projectCanvas.milestones array!
⚠️ Your projectCanvas should ONLY contain: milestones NOT being combined + the NEW combined milestone.
⚠️ NEVER ignore a combine/merge request - this is a high priority structural change.
⚠️ ALWAYS provide feedback about what was merged in the "content" field.
⚠️ The diff.milestones.removed array MUST list the EXACT names of the old milestones being combined.

-------------------------
IMPORTANT
-------------------------

Never ignore a user's update request.
Never leave dates inconsistent.
Never generate partial or incomplete updates.

Your output MUST reflect exactly what the user requested, fully updated and logically consistent.

🚫 ABSOLUTELY FORBIDDEN - DO NOT GENERATE THESE GENERIC PATTERNS:
- "Design Phase" / "Development Phase" / "Testing Phase" / "Deployment Phase"
- "Planning and Requirements" / "Implementation" / "Quality Assurance"
- "Frontend Development" / "Backend Development" / "Integration"
- "Research and Analysis" / "Build" / "Test" / "Launch"
- Any milestone or task name containing only "Design", "Development", "Testing", or "Deployment"

✅ INSTEAD, GENERATE DOMAIN-SPECIFIC MILESTONES & TASKS:
For CRM: "Lead Management Module", "Sales Pipeline Builder", "Gmail/Outlook Email Integration", "Analytics Dashboard with Charts"
For E-commerce: "Product Catalog System", "Shopping Cart & Checkout Flow", "Stripe Payment Integration", "Order Management Dashboard"
For Healthcare: "Patient Registration Portal", "Appointment Scheduler", "Electronic Health Records System", "Telemedicine Video Platform"
For Social Media: "User Profile & Authentication", "Feed Algorithm & Posts", "Real-time Messaging System", "Content Moderation Tools"

RULES:
1. Generate 2-4 SPECIFIC, DOMAIN-RELEVANT milestones (NOT generic phases like "Design" or "Development")
2. Each milestone MUST be a CONCRETE FEATURE or MODULE to build (e.g., "Lead Management Module", not "Phase 1")
3. Each task MUST specify EXACTLY what to build, using what technology, with what success criteria
4. ALL dates must be in the future (today is ${defaultStartDate})
5. Use realistic timelines - spread tasks and milestones appropriately
6. Descriptions should be detailed (3-5 sentences) with technical specifics (APIs, frameworks, libraries)
${
  isUpdateRequest && existingProjectContext
    ? `7. MERGE MODE: You are updating an existing project. Keep all current milestones and tasks, and intelligently add/modify based on the new request. Preserve the project structure and only add what's needed.`
    : `7. CREATE MODE: Generate a completely new project plan based on the requirements.`
}
8. If requirements are unclear, make reasonable assumptions and add them to the "assumptions" field
9. Always produce a full ProjectPlan with SPECIFIC, ACTIONABLE items (never generic phases)

Project Context:
- Type: ${context.projectType || "General project"}
- Timeline: ${context.timeline ? `${context.timeline.start} to ${context.timeline.end}` : `${defaultStartDate} to ${defaultEndDate}`}
- Budget: ${context.budget ? `$${context.budget}` : "To be determined"}
- Team Size: ${context.teamSize || "To be determined"}

${context.timeline ? `IMPORTANT: The user specified an END DATE of ${context.timeline.end}. This is the final deadline. Plan all milestones and tasks to finish by this date.` : ""}

REQUIRED JSON STRUCTURE:
{
  "projectCanvas": {
    "name": "Compelling project name",
    "description": "5-7 sentence executive summary covering problem, solution, approach, expected outcomes, and key stakeholders",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "assumptions": ["assumption 1", "assumption 2"],
    "milestones": [
      {
        "id": "unique-id",
        "name": "Milestone name",
        "description": "2-3 sentences explaining the milestone's purpose and deliverables",
        "dueDate": "YYYY-MM-DD",
        "tasks": [
          {
            "id": "unique-id",
            "name": "Specific task name with clear deliverable",
            "description": "3-5 sentences: What will be delivered, why it matters, how it will be done, what tools will be used, success criteria",
            "dueDate": "YYYY-MM-DD",
            "priority": "high|medium|low",
            "status": "To Do"
          }
        ]
      }
    ]
  },${
  isUpdateRequest
    ? `
  "diff": {
    "milestones": {
      "added": ["IDs or names of NEW milestones"],
      "updated": ["IDs or names of MODIFIED milestones"],
      "removed": ["IDs or names of REMOVED/COMBINED milestones"]
    },
    "tasks": {
      "added": ["IDs or names of NEW tasks"],
      "updated": ["IDs or names of MODIFIED tasks"],
      "removed": ["IDs or names of REMOVED/COMBINED tasks"]
    }
  },
  "content": "MUST BE A DETAILED CHANGE SUMMARY - SEE INSTRUCTIONS BELOW",`
    : `
  "content": "",`
}
  "suggestions": ["Follow-up question 1", "Follow-up question 2"],
  "isDirectCanvas": true
}${
  isUpdateRequest
    ? `

CRITICAL: For UPDATE requests, you MUST include the "diff" field that explicitly lists:
- added: Milestones/tasks that did NOT exist before (new IDs or new names)
- updated: Milestones/tasks that existed before and were modified (use their IDs or names)
- removed: Milestones/tasks that should be deleted (use their IDs or names)

EXAMPLES:
- If combining "Milestone 2" and "Milestone 3" into a new "Combined Milestone", list "Milestone 2" and "Milestone 3" in removed, and "Combined Milestone" in added
- If just updating the description of "Milestone 1", list "Milestone 1" in updated
- If removing "Task A", list "Task A" in removed

RESPONSE FORMATTING FOR UPDATE REQUESTS:
🚫 NEVER use generic messages like: "I've updated your project plan based on your request. You can review the changes on the right."

✅ ALWAYS generate a dynamic change summary in the "content" field that describes exactly what changed:

Format: "Here is what I changed:" followed by bullet points of exact modifications.

Your "content" field MUST include:
- What was added (specific milestone/task names)
- What was removed (specific milestone/task names)
- What was updated or merged (specific changes made)
- Any milestones or tasks that were renumbered
- Any dependencies that were modified

EXAMPLE GOOD RESPONSES:
"Here is what I changed:
- Added: New milestone 'API Integration Phase' with 4 tasks
- Updated: Milestone 'Backend Development' deadline moved from Dec 15 to Dec 20
- Merged: Milestones 'Testing Phase' and 'QA Review' into 'Quality Assurance Phase'
- Removed: Task 'Manual deployment script' (replaced with automated CI/CD)
- Renumbered: Milestone 3 became Milestone 2 after merge
- Dependencies: Task 'Database migration' now depends on 'Schema design completion'"

EXAMPLE BAD RESPONSES (FORBIDDEN):
❌ "I've updated your project plan based on your request."
❌ "The changes have been made. You can review them on the right."
❌ "Your project plan has been updated."
❌ Any generic message that doesn't specify what changed`
    : ""
}`;

    // Check if this is a combined message with user request AND file context
    const hasCombinedInput = enrichedMessage.includes("User Request:") && enrichedMessage.includes("Context from uploaded files:");
    
    const getUserPromptPrefix = () => {
      if (isRFPAnalysis) {
        return "Analyze this RFP requirement and create a comprehensive response plan with implementation milestones, deliverables, and timelines:";
      }
      if (isComplianceDoc) {
        return "Process this compliance documentation requirement and create a structured plan for achieving full compliance:";
      }
      if (hasCombinedInput) {
        return `IMPORTANT: This request contains BOTH a user request AND file context. You MUST:
1. Read the "User Request:" section to understand WHAT the user wants (this is the PRIMARY focus)
2. Use the "Context from uploaded files:" section as SUPPORTING INFORMATION
3. Generate a project plan that specifically addresses the user's request, using insights from the file content

For example, if the user says "Generate Project plan for twitter and linkedin" and the file contains social media metrics:
- Focus the plan on Twitter and LinkedIn strategies specifically
- Use the metrics and recommendations from the file to inform the plan's milestones and tasks
- Do NOT create a generic social media plan - focus on EXACTLY what the user requested

Here is the combined input:`;
      }
      return "Create a detailed project plan for:";
    };

    const getFocusAreas = () => {
      if (isRFPAnalysis) {
        return "Focus on:\n- Requirements analysis and compliance\n- Technical solution design\n- Implementation phases\n- Deliverables and acceptance criteria\n- Risk mitigation strategies\n\n";
      }
      if (isComplianceDoc) {
        return "Focus on:\n- Regulatory requirements identification\n- Gap analysis and current state assessment\n- Policy and procedure development\n- Documentation creation and management\n- Audit preparation and compliance verification\n- Training and implementation rollout\n- Ongoing monitoring and maintenance\n\n";
      }
      if (hasCombinedInput) {
        return "\nCRITICAL: Your project plan MUST specifically address what the user requested. Use the file content as context but the USER REQUEST is the primary directive.\n\n";
      }
      return "";
    };

    const userPrompt = `${getUserPromptPrefix()} ${enrichedMessage}

${getFocusAreas()}${
      existingProjectContext
        ? `EXISTING PROJECT TO UPDATE:
${JSON.stringify(existingProjectContext, null, 2)}

MERGE INSTRUCTIONS: Keep all existing milestones and tasks. Add new ones as needed based on the request. Update project details if necessary.

`
        : ""
    }Additional context from our conversation:
${JSON.stringify(context, null, 2)}`;

    const generateModel = this.trackingUserId ? await getModelForBudget(this.trackingUserId, "gpt-4o") : "gpt-4o";
    const completion = await openai.chat.completions.create({
      model: generateModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    if (this.trackingUserId && completion.usage) {
      trackTokenUsage(this.trackingUserId, "deep-planner-generate", generateModel, completion.usage).catch(() => {});
    }

    const response = JSON.parse(completion.choices[0].message.content || "{}");

    // Validate UPDATE responses have proper change summaries
    if (isUpdateRequest && response.projectCanvas) {
      if (!response.content || response.content.trim() === "" || response.content.includes("MUST BE A DETAILED CHANGE SUMMARY")) {
        console.error("❌ UPDATE response missing required change summary in content field");
        response.content = "⚠️ Update applied, but the AI did not provide a change summary. Please review the project plan for changes.";
      }
    }

    // Ensure all dates are in the future and respect context timeline
    if (response.projectCanvas) {
      response.projectCanvas = this.validateAndFixDates(
        response.projectCanvas,
        context.timeline,
      );
    }

    return {
      ...response,
      confidence: 0.95,
    };
  }

  private validateAndFixDates(projectCanvas: any, contextTimeline?: any): any {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    // If we have context timeline, use it as the authoritative dates
    if (contextTimeline && contextTimeline.start && contextTimeline.end) {
      console.log(
        `🎯 Using context timeline: ${contextTimeline.start} to ${contextTimeline.end}`,
      );
      projectCanvas.startDate = contextTimeline.start;
      projectCanvas.endDate = contextTimeline.end;
    } else {
      // Fix project dates if no context timeline
      if (
        !projectCanvas.startDate ||
        new Date(projectCanvas.startDate) < today
      ) {
        projectCanvas.startDate = todayStr;
      }

      if (
        !projectCanvas.endDate ||
        new Date(projectCanvas.endDate) <= new Date(projectCanvas.startDate)
      ) {
        projectCanvas.endDate = format(
          addWeeks(new Date(projectCanvas.startDate), 4),
          "yyyy-MM-dd",
        );
      }
    }

    // Fix milestone and task dates
    if (projectCanvas.milestones) {
      projectCanvas.milestones = projectCanvas.milestones.map(
        (milestone: any, index: number) => {
          if (!milestone.dueDate || new Date(milestone.dueDate) < today) {
            milestone.dueDate = format(
              addWeeks(new Date(projectCanvas.startDate), index + 1),
              "yyyy-MM-dd",
            );
          }

          if (milestone.tasks) {
            milestone.tasks = milestone.tasks.map(
              (task: any, taskIndex: number) => {
                if (!task.dueDate || new Date(task.dueDate) < today) {
                  const baseDate = new Date(milestone.dueDate);
                  task.dueDate = format(
                    addDays(baseDate, -(7 - taskIndex * 2)),
                    "yyyy-MM-dd",
                  );
                }
                return task;
              },
            );
          }

          return milestone;
        },
      );
    }

    return projectCanvas;
  }
}

export const deepPlannerAgent = new DeepProjectPlannerAgent();
