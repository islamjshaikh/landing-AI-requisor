import { OpenAI } from "openai";
import { getAiClient } from "./services/ai-provider";
import { trackTokenUsage } from "./services/token-tracker";
import { persistMemory } from "./services/agent-memory";

const openai = (getAiClient() as any);

interface ProjectPlan {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  milestones: Milestone[];
}

interface Milestone {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  tasks: Task[];
}

interface Task {
  id: string;
  name: string;
  description?: string;
  dueDate: string;
  priority: "low" | "medium" | "high";
}

// SPECIFICITY SCORING FUNCTIONS

/**
 * Calculates specificity score for a single task (0-1 scale)
 * Higher score = more specific, detailed, and non-generic
 */
function specificityScore(task: Task): number {
  let score = 0;
  const name = task.name?.toLowerCase() || "";
  const description = task.description?.toLowerCase() || "";
  const combined = name + " " + description;

  // 1. Length check (longer = more context) - max 0.25
  const wordCount = combined.split(/\s+/).filter((w) => w.length > 2).length;
  score += Math.min(wordCount / 20, 0.25);

  // 2. Anti-boilerplate detection (penalty for generic phrases) - max -0.3
  const boilerplatePatterns = [
    "implement best practices",
    "ensure scalability",
    "optimize performance",
    "improve efficiency",
    "enhance user experience",
    "maintain quality",
    "follow standards",
    "conduct research",
    "gather requirements",
    "create documentation",
    "implement features",
    "test thoroughly",
    "deploy to production",
    "monitor and maintain",
  ];

  const boilerplateCount = boilerplatePatterns.filter((pattern) =>
    combined.includes(pattern),
  ).length;
  score -= boilerplateCount * 0.1;

  // 3. Verb + Object detection - max 0.2
  const actionVerbs = [
    "design",
    "build",
    "create",
    "implement",
    "configure",
    "develop",
    "integrate",
    "setup",
    "deploy",
    "test",
    "validate",
    "review",
    "analyze",
    "migrate",
    "refactor",
  ];
  const hasVerb = actionVerbs.some((verb) => name.startsWith(verb));
  if (hasVerb) score += 0.2;

  // 4. Constraints/Context detection - max 0.2
  const contextIndicators = [
    "using",
    "with",
    "for",
    "via",
    "through",
    "based on",
    "including",
    "supporting",
    "targeting",
  ];
  const hasContext = contextIndicators.some((indicator) =>
    combined.includes(indicator),
  );
  if (hasContext) score += 0.2;

  // 5. DoD detection - max 0.3
  const dodIndicators = [
    "dod:",
    "definition of done:",
    "complete when",
    "success criteria:",
    "acceptance criteria:",
    "verified by",
    "validated when",
    "confirmed by",
  ];
  const hasDoD = dodIndicators.some((indicator) =>
    combined.includes(indicator),
  );
  if (hasDoD) score += 0.3;

  // 6. Specificity indicators (numbers, technologies, metrics) - max 0.2
  const hasNumbers = /\d+/.test(combined);
  const hasTechnologies =
    /\b(react|node|python|aws|docker|kubernetes|postgres|mongodb|redis|graphql|rest|api|oauth|jwt|stripe|sendgrid)\b/i.test(
      combined,
    );
  if (hasNumbers) score += 0.1;
  if (hasTechnologies) score += 0.1;

  return Math.max(0, Math.min(1, score)); // Clamp between 0 and 1
}

/**
 * Calculates average specificity across all tasks in a project plan
 */
function planSpecificity(plan: ProjectPlan): number {
  let totalScore = 0;
  let taskCount = 0;

  plan.milestones?.forEach((milestone) => {
    milestone.tasks?.forEach((task) => {
      totalScore += specificityScore(task);
      taskCount++;
    });
  });

  return taskCount > 0 ? totalScore / taskCount : 0;
}

/**
 * Detects if the plan has repetitive or template-like task names
 */
function hasRepetitionRisk(plan: ProjectPlan): boolean {
  const taskNames = new Set<string>();
  const allNames: string[] = [];

  plan.milestones?.forEach((milestone) => {
    milestone.tasks?.forEach((task) => {
      const normalized = task.name.toLowerCase().trim();
      allNames.push(normalized);
      taskNames.add(normalized);
    });
  });

  // If >30% of tasks have duplicate names, it's repetitive
  const uniqueRatio = taskNames.size / allNames.length;
  return uniqueRatio < 0.7;
}

/**
 * Ensures each task has a Definition of Done (DoD)
 * Generates context-aware DoD based on task content
 */
function ensureDoD(task: Task): Task {
  const description = task.description || "";
  const taskName = task.name || "";
  const dodIndicators = [
    "dod:",
    "definition of done:",
    "complete when",
    "success criteria:",
    "acceptance criteria:",
  ];

  const hasDoD = dodIndicators.some((indicator) =>
    description.toLowerCase().includes(indicator),
  );

  if (!hasDoD && description) {
    // Generate context-aware DoD based on task content
    const combined = (taskName + " " + description).toLowerCase();
    let specificDoD = "";

    // Match common patterns and generate relevant DoD
    if (combined.includes("deploy") || combined.includes("launch")) {
      specificDoD =
        "DoD: Deployed to target environment, passes health checks, and accessible to users.";
    } else if (combined.includes("test") || combined.includes("validation")) {
      specificDoD =
        "DoD: All test cases pass, edge cases covered, and results documented.";
    } else if (
      combined.includes("design") ||
      combined.includes("ui") ||
      combined.includes("interface")
    ) {
      specificDoD =
        "DoD: Design approved by stakeholders, responsive across devices, and meets accessibility standards.";
    } else if (combined.includes("api") || combined.includes("endpoint")) {
      specificDoD =
        "DoD: API responds with correct status codes, handles errors gracefully, and passes integration tests.";
    } else if (combined.includes("database") || combined.includes("schema")) {
      specificDoD =
        "DoD: Schema migrated successfully, data integrity verified, and queries optimized for performance.";
    } else if (combined.includes("integrate") || combined.includes("connect")) {
      specificDoD =
        "DoD: Integration tested end-to-end, error handling implemented, and data flows correctly between systems.";
    } else if (combined.includes("document") || combined.includes("readme")) {
      specificDoD =
        "DoD: Documentation is complete, code examples provided, and reviewed for clarity.";
    } else {
      // Generic fallback that references the task
      specificDoD =
        "DoD: Implementation complete, functionality verified through testing, and code reviewed.";
    }

    const enhancedDescription = `${description}\n\n${specificDoD}`;
    return { ...task, description: enhancedDescription };
  }

  return task;
}

/**
 * Refines a plan that scored too low on specificity
 */
async function refinePlanForSpecificity(
  originalPrompt: string,
  genericPlan: ProjectPlan,
): Promise<ProjectPlan> {
  const refinementPrompt = `The following project plan is too generic. Please refine it to be MORE SPECIFIC and CONTEXTUALLY RELEVANT.

Original request: ${originalPrompt}

Current plan:
${JSON.stringify(genericPlan, null, 2)}

REFINEMENT REQUIREMENTS:
1. Replace ALL generic task names with specific, actionable ones
2. Add domain-specific technical details and technologies
3. Include clear constraints, parameters, and success criteria
4. Add Definition of Done (DoD) for each task
5. Use format: Verb + Object + Context + Constraints + DoD
6. Avoid boilerplate phrases like "implement best practices" or "ensure scalability"
7. Add specific numbers, metrics, or technologies where relevant

Return the refined plan in the same JSON structure with enhanced specificity.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are an expert project planner who creates highly specific, contextually relevant project plans.",
      },
      { role: "user", content: refinementPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
    presence_penalty: 0.5,
    frequency_penalty: 0.7,
    max_tokens: 3000,
  });

  if (completion.usage) {
    trackTokenUsage("system", "project-planner-refine", "gpt-4o", completion.usage).catch(() => {});
  }

  return JSON.parse(
    completion.choices[0].message.content || JSON.stringify(genericPlan),
  );
}

/**
 * Enriches user prompt with domain-specific context
 */
function enrichPromptWithContext(userPrompt: string): string {
  const lowerPrompt = userPrompt.toLowerCase();
  let enrichedContext = "";

  // CRM/Marketing domain
  if (
    lowerPrompt.includes("crm") ||
    lowerPrompt.includes("customer relationship")
  ) {
    enrichedContext += `\n\nDOMAIN CONTEXT - CRM System:
Core Features Expected:
- Lead Management: Capture, qualify, assign leads. Track lead source, status, score. Follow-up reminders and activity tracking.
- Contact/Client Management: Store contact details, communication history, organization profiles, tags/segments.
- Sales Pipeline: Visualize deals through stages (prospecting → qualified → proposal → negotiation → closed). Track revenue forecasts.
- Campaign Management: Track marketing campaigns across channels (email, social, ads). Monitor budget, ROI, conversion metrics.
- Task & Activity Tracking: Create tasks, set deadlines, assign to team members. Log calls, emails, meetings.
- Email Integration: Connect Gmail/Outlook for email tracking, templates, automated follow-ups.
- Reporting & Analytics: Dashboards for leads by source, conversion rates, revenue by rep, campaign performance.
- Notifications: Alerts for follow-ups, deal updates, campaign milestones.
- User Roles: Admin, Sales Manager, Sales Rep, Marketing permissions.

Technology Stack Expectations:
- Frontend: React/Vue/Angular or Flutter for mobile
- Backend: Node.js/Django/.NET with RESTful APIs
- Database: PostgreSQL/MongoDB for data storage
- Auth: OAuth 2.0, JWT, role-based access control
- Integrations: Gmail API, Outlook API, Google Ads API, Meta Business API
- Analytics: Chart.js, D3.js, or similar for visualizations`;
  }

  // E-commerce domain
  if (
    lowerPrompt.includes("ecommerce") ||
    lowerPrompt.includes("e-commerce") ||
    lowerPrompt.includes("online store") ||
    lowerPrompt.includes("marketplace")
  ) {
    enrichedContext += `\n\nDOMAIN CONTEXT - E-commerce Platform:
Core Features Expected:
- Product Catalog: Product listings, variants (size/color), inventory management, categories, search/filtering.
- Shopping Cart: Add to cart, quantity updates, price calculations, coupon codes, abandoned cart recovery.
- Checkout: Multi-step checkout, shipping address, payment methods (Stripe/PayPal), order confirmation.
- Order Management: Track orders (pending → processing → shipped → delivered), order history, invoices.
- User Accounts: Registration, login, profile management, saved addresses, wishlist.
- Payment Gateway: Stripe/PayPal integration, secure payment processing, refund handling.
- Shipping Integration: Calculate shipping rates, track shipments, generate labels.
- Admin Dashboard: Manage products, orders, customers, analytics, inventory.
- Reviews & Ratings: Customer reviews, star ratings, moderation.
- Analytics: Sales reports, conversion rates, customer lifetime value, product performance.

Technology Stack Expectations:
- Frontend: React/Next.js with responsive design
- Backend: Node.js/Django with REST or GraphQL APIs
- Database: PostgreSQL for transactions, Redis for caching
- Payment: Stripe API, PayPal SDK
- Cloud Storage: AWS S3 for product images
- Email: SendGrid for order confirmations`;
  }

  // Healthcare domain
  if (
    lowerPrompt.includes("health") ||
    lowerPrompt.includes("medical") ||
    lowerPrompt.includes("patient") ||
    lowerPrompt.includes("clinic") ||
    lowerPrompt.includes("hospital")
  ) {
    enrichedContext += `\n\nDOMAIN CONTEXT - Healthcare System:
Core Features Expected:
- Patient Management: Patient records, medical history, demographics, insurance info.
- Appointment Scheduling: Book, reschedule, cancel appointments. Calendar view, time slots, doctor availability.
- Electronic Health Records (EHR): Clinical notes, diagnoses, prescriptions, lab results, allergies.
- Billing & Insurance: Generate bills, insurance claims, payment tracking, copay calculations.
- Doctor/Staff Portal: View schedule, update patient records, e-prescriptions.
- Telemedicine: Video consultations, chat, screen sharing.
- Lab Integration: Order labs, receive results, flag abnormal values.
- Prescription Management: E-prescribing, refill requests, drug interaction checks.
- Notifications: Appointment reminders via SMS/email, prescription ready alerts.
- Compliance: HIPAA compliance, audit logs, data encryption, access controls.

Technology Stack Expectations:
- Frontend: React with HIPAA-compliant hosting
- Backend: FHIR-compliant APIs, Node.js/Django
- Database: PostgreSQL with encryption at rest
- Security: OAuth 2.0, MFA, role-based access
- Video: Twilio/Zoom SDK for telemedicine
- Notifications: Twilio SMS, SendGrid email`;
  }

  // Social Media domain
  if (
    lowerPrompt.includes("social media") ||
    lowerPrompt.includes("social network") ||
    lowerPrompt.includes("community platform")
  ) {
    enrichedContext += `\n\nDOMAIN CONTEXT - Social Media Platform:
Core Features Expected:
- User Profiles: Bio, avatar, cover photo, follower/following counts, verification badges.
- Posts & Feed: Create posts (text, images, videos), like, comment, share. Algorithmic or chronological feed.
- Real-time Interactions: Live comments, notifications, online status indicators.
- Messaging: Direct messages, group chats, typing indicators, read receipts.
- Content Moderation: Report abuse, flagging system, admin review queue, content filters.
- Notifications: Push notifications for likes, comments, follows, mentions.
- Search & Discovery: Search users/posts, hashtags, trending topics, explore page.
- Privacy Controls: Public/private profiles, block users, hide posts, content visibility settings.
- Media Upload: Image/video upload, compression, CDN delivery.
- Analytics: Engagement metrics, reach, impressions, follower growth.

Technology Stack Expectations:
- Frontend: React/Next.js with real-time updates (WebSockets)
- Backend: Node.js with Socket.io, GraphQL/REST APIs
- Database: PostgreSQL for user data, Redis for caching/sessions
- Storage: AWS S3/CloudFront for media CDN
- Real-time: WebSockets, Server-Sent Events
- Moderation: AI content moderation APIs (AWS Rekognition, Perspective API)`;
  }

  // Education/Learning domain
  if (
    lowerPrompt.includes("learning") ||
    lowerPrompt.includes("education") ||
    lowerPrompt.includes("course") ||
    lowerPrompt.includes("lms") ||
    lowerPrompt.includes("e-learning")
  ) {
    enrichedContext += `\n\nDOMAIN CONTEXT - Learning Management System:
Core Features Expected:
- Course Catalog: Browse courses, categories, search, filtering, ratings/reviews.
- User Enrollment: Enroll in courses, track progress, certificates of completion.
- Content Delivery: Video lectures, reading materials, quizzes, assignments, downloadable resources.
- Progress Tracking: Completion percentage, time spent, quiz scores, learning path.
- Assessments: Quizzes with auto-grading, assignments with file upload, peer review.
- Discussion Forums: Course-specific forums, Q&A, upvoting, instructor responses.
- Instructor Dashboard: Upload content, grade assignments, track student progress, analytics.
- Certificates: Auto-generate completion certificates, PDF download, verification codes.
- Payments: Course pricing, payment gateway, refund handling, subscription plans.
- Live Sessions: Video conferencing for live classes, screen sharing, chat, recording.

Technology Stack Expectations:
- Frontend: React with video player (Video.js/Plyr)
- Backend: Node.js/Django with REST APIs
- Database: PostgreSQL for course data, MongoDB for assessments
- Video: AWS S3 + CloudFront, HLS streaming
- Live Video: Zoom SDK, Agora, or WebRTC
- Certificates: PDF generation (jsPDF, PDFKit)`;
  }

  // Fintech/Banking domain
  if (
    lowerPrompt.includes("fintech") ||
    lowerPrompt.includes("banking") ||
    lowerPrompt.includes("payment") ||
    lowerPrompt.includes("wallet") ||
    lowerPrompt.includes("financial")
  ) {
    enrichedContext += `\n\nDOMAIN CONTEXT - Fintech Application:
Core Features Expected:
- Account Management: Create accounts, KYC verification, account details, balance display.
- Transactions: Send money, receive payments, transaction history, receipts, recurring payments.
- Wallet: Digital wallet, add funds, withdraw to bank, peer-to-peer transfers.
- Cards: Virtual/physical card management, card controls, spending limits, freeze/unfreeze.
- Bill Payments: Pay utilities, mobile recharge, schedule payments, payment reminders.
- Analytics: Spending insights, categorization, budgeting, financial reports.
- Security: 2FA, biometric auth, transaction alerts, fraud detection.
- Compliance: AML/KYC checks, audit logs, regulatory reporting.
- Integrations: Bank account linking (Plaid), payment gateways (Stripe).
- Notifications: Transaction alerts, balance updates, payment reminders.

Technology Stack Expectations:
- Frontend: React with secure architecture
- Backend: Node.js/.NET with PCI-DSS compliance
- Database: PostgreSQL with encryption
- Security: OAuth 2.0, JWT, AES-256 encryption, HSM for keys
- Payment: Stripe, Plaid for bank integration
- Compliance: KYC APIs (Jumio, Onfido), AML screening`;
  }

  return userPrompt + enrichedContext;
}

export async function generateProjectPlan(
  prompt: string,
  /** Optional. When supplied, the call is logged to long-term memory. */
  userId?: string,
): Promise<ProjectPlan> {
  try {
    const currentDate = new Date().toISOString().split("T")[0];

    // Enrich prompt with domain-specific context
    const enrichedPrompt = enrichPromptWithContext(prompt);
    console.log(
      `[Project Planner] Enriched prompt with domain context. Original length: ${prompt.length}, Enriched length: ${enrichedPrompt.length}`,
    );

    const systemPrompt = `You are in PLAN MODE — a senior project manager and delivery lead.
Your job is to organize and execute. Be concise, concrete, and operational.

PERSONALITY:
- Operational and delivery-focused. Think like a senior PM.
- Clear and concrete. No abstract strategy or vague recommendations.
- Practical — every output should be immediately actionable.
- Do NOT suggest new features. Focus on organizing what's been decided.

RESPONSE STYLE:
- Use short sentences and bullet points.
- Every response must end with a clear "Next step" recommendation.
- NO long paragraphs or philosophical explanations.

TASK FORMAT (MANDATORY):
Every task MUST follow: Verb + Object + Context + Constraints + DoD
Example: "Configure OAuth 2.0 authentication using Passport.js with Google provider. DoD: Users can log in via Google, sessions persist for 7 days."

FORBIDDEN PHRASES:
- "Implement best practices" / "Ensure scalability" / "Optimize performance"
- "Improve efficiency" / "Enhance user experience" / "Follow standards"
- "Conduct research" / "Gather requirements"
Use SPECIFIC, MEASURABLE language instead.

DOMAIN-SPECIFIC REQUIREMENTS:
- Include specific technologies, frameworks, and tools
- Add measurable metrics and constraints
- Reference domain-specific standards by name (e.g., "WCAG 2.1 AA" not "accessibility")
- Include technical details (API endpoints, schemas, architecture)

DATE REQUIREMENTS:
- Today is ${currentDate}
- ALL dates MUST be in the future (after ${currentDate})
- Plan should include 2-4 milestones with 2-5 tasks each

CLARIFICATION BEHAVIOR:
If the user's input is too vague to create a quality plan, DO NOT guess. Respond:
**Before I create this plan, I need clarity on:**
1. [Specific question]
2. [Specific question]

JSON STRUCTURE — Return the plan in this exact format:
{
  "name": "Specific Project Name",
  "description": "Detailed project description with context and goals",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "milestones": [
    {
      "id": "milestone-1",
      "name": "Specific Milestone Name",
      "description": "Detailed milestone description",
      "dueDate": "YYYY-MM-DD",
      "tasks": [
        {
          "id": "task-1-1",
          "name": "Verb + Object + Context",
          "description": "Full task details ending with DoD: [specific criteria]",
          "dueDate": "YYYY-MM-DD",
          "priority": "high|medium|low"
        }
      ]
    }
  ]
}

GOAL: Create a plan so specific that anyone can understand EXACTLY what needs to be built, how, and when it's done.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: enrichedPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      presence_penalty: 0.3,
      frequency_penalty: 0.5,
      max_tokens: 4000,
    });

    if (completion.usage) {
      trackTokenUsage("system", "project-planner-generate", "gpt-4o", completion.usage).catch(() => {});
    }

    let projectPlan = JSON.parse(completion.choices[0].message.content || "{}");

    // Long-term memory log.
    void persistMemory({
      ctx: { userId, agentName: "project-planner-agent", retrieve: false },
      userQuery: prompt.slice(0, 4000),
      agentResponse: completion.choices[0].message.content || "",
    });

    // Add unique IDs if not present and ensure dates are in the future
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Fix start date if missing or in the past
    if (!projectPlan.startDate || new Date(projectPlan.startDate) < today) {
      projectPlan.startDate = todayStr;
    }

    // Fix end date if missing or in the past
    if (
      !projectPlan.endDate ||
      new Date(projectPlan.endDate) <= new Date(projectPlan.startDate)
    ) {
      const endDate = new Date(projectPlan.startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      projectPlan.endDate = endDate.toISOString().split("T")[0];
    }

    if (projectPlan.milestones) {
      projectPlan.milestones = projectPlan.milestones.map(
        (m: any, mi: number) => {
          // Fix milestone due date if in the past
          if (!m.dueDate || new Date(m.dueDate) < today) {
            const milestoneDate = new Date(projectPlan.startDate);
            milestoneDate.setDate(milestoneDate.getDate() + (mi + 1) * 7); // Space milestones a week apart
            m.dueDate = milestoneDate.toISOString().split("T")[0];
          }

          return {
            ...m,
            id: m.id || `milestone-${Date.now()}-${mi}`,
            tasks:
              m.tasks?.map((t: any, ti: number) => {
                // Fix task due date if in the past
                if (!t.dueDate || new Date(t.dueDate) < today) {
                  const taskDate = new Date(projectPlan.startDate);
                  taskDate.setDate(taskDate.getDate() + mi * 5 + (ti + 1) * 2); // Space tasks 2 days apart
                  t.dueDate = taskDate.toISOString().split("T")[0];
                }

                return {
                  ...t,
                  id: t.id || `task-${Date.now()}-${mi}-${ti}`,
                  priority: t.priority || "medium",
                };
              }) || [],
          };
        },
      );
    }

    // AUTOMATIC QUALITY ENHANCEMENT
    // IMPORTANT: Score BEFORE applying ensureDoD to avoid inflating scores with injected text

    // 1. Check specificity score and repetition risk (on original plan without DoD injection)
    const initialSpecificity = planSpecificity(projectPlan);
    const hasRepetition = hasRepetitionRisk(projectPlan);

    console.log(
      `[Project Planner] Initial specificity: ${initialSpecificity.toFixed(2)}, Repetition risk: ${hasRepetition}`,
    );

    // 2. If plan is too generic or repetitive, refine it BEFORE adding DoD
    if (initialSpecificity < 0.58 || hasRepetition) {
      console.log(
        "[Project Planner] Plan quality below threshold. Refining for specificity...",
      );
      try {
        const refinedPlan = await refinePlanForSpecificity(
          enrichedPrompt,
          projectPlan,
        );

        // Apply the same date and ID fixes to refined plan
        if (refinedPlan.milestones) {
          refinedPlan.milestones = refinedPlan.milestones.map(
            (m: any, mi: number) => {
              if (!m.dueDate || new Date(m.dueDate) < today) {
                const milestoneDate = new Date(refinedPlan.startDate);
                milestoneDate.setDate(milestoneDate.getDate() + (mi + 1) * 7);
                m.dueDate = milestoneDate.toISOString().split("T")[0];
              }

              return {
                ...m,
                id: m.id || `milestone-${Date.now()}-${mi}`,
                tasks:
                  m.tasks?.map((t: any, ti: number) => {
                    if (!t.dueDate || new Date(t.dueDate) < today) {
                      const taskDate = new Date(refinedPlan.startDate);
                      taskDate.setDate(
                        taskDate.getDate() + mi * 5 + (ti + 1) * 2,
                      );
                      t.dueDate = taskDate.toISOString().split("T")[0];
                    }

                    return {
                      ...t,
                      id: t.id || `task-${Date.now()}-${mi}-${ti}`,
                      priority: t.priority || "medium",
                    };
                  }) || [],
              };
            },
          );
        }

        // Re-score after refinement to verify improvement
        const refinedSpecificity = planSpecificity(refinedPlan);
        console.log(
          `[Project Planner] Refinement complete. New specificity: ${refinedSpecificity.toFixed(2)}`,
        );

        // Only use refined plan if it actually improved
        if (refinedSpecificity > initialSpecificity) {
          projectPlan = refinedPlan;
        } else {
          console.log(
            "[Project Planner] Refinement did not improve quality, using original plan",
          );
        }
      } catch (error) {
        console.error(
          "[Project Planner] Refinement failed, using original plan:",
          error,
        );
      }
    }

    // 3. AFTER refinement check, apply DoD to all tasks (context-aware generation)
    projectPlan.milestones = projectPlan.milestones?.map(
      (milestone: Milestone) => ({
        ...milestone,
        tasks: milestone.tasks?.map((task) => ensureDoD(task)) || [],
      }),
    );

    // 4. Final quality check after DoD injection
    const finalSpecificity = planSpecificity(projectPlan);
    console.log(
      `[Project Planner] Final plan specificity (with DoD): ${finalSpecificity.toFixed(2)}`,
    );

    return projectPlan;
  } catch (error) {
    console.error("Error generating project plan:", error);

    // Return a basic template as fallback
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 1);

    return {
      name: "New Project",
      description: "Project generated from: " + prompt,
      startDate: today.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      milestones: [
        {
          id: `milestone-${Date.now()}-0`,
          name: "Planning Phase",
          description: "Initial planning and setup",
          dueDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          tasks: [
            {
              id: `task-${Date.now()}-0-0`,
              name: "Define project scope",
              dueDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "high" as const,
            },
            {
              id: `task-${Date.now()}-0-1`,
              name: "Create project timeline",
              dueDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "medium" as const,
            },
          ],
        },
        {
          id: `milestone-${Date.now()}-1`,
          name: "Execution Phase",
          description: "Main implementation work",
          dueDate: new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          tasks: [
            {
              id: `task-${Date.now()}-1-0`,
              name: "Implement core features",
              dueDate: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "high" as const,
            },
            {
              id: `task-${Date.now()}-1-1`,
              name: "Test and refine",
              dueDate: new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "medium" as const,
            },
          ],
        },
      ],
    };
  }
}
