import OpenAI from "openai";
import { getAiClient, userHasOwnKey } from "../services/ai-provider";
import { Project, Task, Insight } from "@shared/schema";
import { trackTokenUsage } from "../services/token-tracker";

const OPENAI_MODEL = "gpt-4o";

const openai = (getAiClient() as any);

// List of project management best practices and patterns
const PROJECT_PATTERNS = [
  "Waterfall", "Agile", "Scrum", "Kanban", "Lean", "PRINCE2", 
  "Critical Path Method", "Six Sigma", "Extreme Programming (XP)",
  "Feature-Driven Development", "Crystal", "Spiral", "Rapid Application Development"
];

// Fallback demo project plan for when OpenAI API is unavailable
function getDemoProjectPlan(idea: string) {
  const now = new Date();
  const twoMonthsLater = new Date(now);
  twoMonthsLater.setMonth(now.getMonth() + 2);
  
  const startDate = now.toISOString().split('T')[0];
  const endDate = twoMonthsLater.toISOString().split('T')[0];
  
  // Try to make the demo project plan more specific based on the idea
  const projectName = idea.length > 30 
    ? idea.substring(0, 30) + "..." 
    : idea || "New Project";
    
  // Determine if this is a software project
  const isSoftware = /app|software|web|mobile|website|platform|system|application|code|develop/i.test(idea);
  // Determine if this is a marketing project
  const isMarketing = /market|campaign|advertising|promotion|launch|brand|social media/i.test(idea);
  // Determine if this is an event
  const isEvent = /event|conference|workshop|webinar|meetup|summit|expo/i.test(idea);
  
  let tasks = [];
  let milestones = [];
  
  if (isSoftware) {
    // Software development specific tasks
    tasks = [
      { 
        name: "Technical Requirements Documentation", 
        description: "Document detailed technical specifications including API requirements, database schema, and system architecture", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 3) 
      },
      { 
        name: "User Story Mapping Session", 
        description: "Conduct workshop with stakeholders to map user journeys and prioritize features", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 8) 
      },
      { 
        name: "Technical Architecture Design", 
        description: "Create detailed system architecture diagrams and technology stack documentation", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 15) 
      },
      { 
        name: "UI/UX Wireframe Creation", 
        description: "Develop interactive wireframes and user interface mockups for key application flows", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 20) 
      },
      { 
        name: "Database Schema Implementation", 
        description: "Create and implement database tables, relationships, and initial data models", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 25) 
      },
      { 
        name: "Core Feature Development", 
        description: "Implement primary application functionalities following agreed architecture", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 35) 
      },
      { 
        name: "API Integration Implementation", 
        description: "Connect application with third-party services and APIs required for functionality", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 40) 
      },
      { 
        name: "Unit and Integration Testing", 
        description: "Develop and execute comprehensive test suite to verify functionality", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 45) 
      },
      { 
        name: "Beta User Acceptance Testing", 
        description: "Conduct structured testing sessions with representative users for feedback", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 50) 
      },
      { 
        name: "Performance Optimization", 
        description: "Identify and address bottlenecks to ensure application speed and scalability", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 53) 
      },
      { 
        name: "Deployment Configuration Setup", 
        description: "Configure production environment, CI/CD pipelines, and monitoring tools", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 55) 
      },
      { 
        name: "Launch Day Operations", 
        description: "Execute production deployment with monitoring and immediate issue resolution", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 58) 
      }
    ];
    milestones = [
      { name: "Technical Requirements Finalized", dueDate: getDateOffset(startDate, 10) },
      { name: "Architecture and Design Approved", dueDate: getDateOffset(startDate, 22) },
      { name: "Core Development Complete", dueDate: getDateOffset(startDate, 40) },
      { name: "Testing and Quality Assurance Passed", dueDate: getDateOffset(startDate, 52) },
      { name: "Production Launch", dueDate: getDateOffset(startDate, 58) }
    ];
  } else if (isMarketing) {
    // Marketing campaign specific tasks
    tasks = [
      { 
        name: "Target Audience Research", 
        description: "Conduct detailed demographic and psychographic analysis of target customer segments", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 3) 
      },
      { 
        name: "Competitive Analysis", 
        description: "Research and document competitor strategies, positioning, and market share", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 7) 
      },
      { 
        name: "Campaign Strategy Document", 
        description: "Create comprehensive strategy including channels, messaging, and KPIs", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 12) 
      },
      { 
        name: "Marketing Messaging Framework", 
        description: "Develop core value propositions, key messages, and brand voice guidelines", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 18) 
      },
      { 
        name: "Creative Brief Development", 
        description: "Draft detailed creative briefs for design team with campaign requirements", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 22) 
      },
      { 
        name: "Content Asset Production", 
        description: "Create campaign visuals, videos, copywriting and other media assets", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 30) 
      },
      { 
        name: "Website Landing Page Creation", 
        description: "Design and develop campaign-specific landing pages with conversion tracking", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 35) 
      },
      { 
        name: "Email Marketing Sequence Setup", 
        description: "Design email journey, create templates, and set up automation workflows", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 40) 
      },
      { 
        name: "Paid Media Channel Setup", 
        description: "Configure ad accounts, develop targeting strategies, and create campaign structure", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 43) 
      },
      { 
        name: "Analytics Dashboard Configuration", 
        description: "Set up comprehensive tracking and reporting dashboard for campaign metrics", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 46) 
      },
      { 
        name: "Campaign Launch Execution", 
        description: "Coordinate cross-channel launch activities with stakeholders", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 50) 
      },
      { 
        name: "Campaign Performance Optimization", 
        description: "Review initial metrics and implement optimizations to improve results", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 55) 
      }
    ];
    milestones = [
      { name: "Campaign Strategy Approved", dueDate: getDateOffset(startDate, 15) },
      { name: "Creative Assets Completed", dueDate: getDateOffset(startDate, 32) },
      { name: "All Channels Configured", dueDate: getDateOffset(startDate, 45) },
      { name: "Campaign Launch", dueDate: getDateOffset(startDate, 50) },
      { name: "First Results Analysis", dueDate: getDateOffset(startDate, 58) }
    ];
  } else if (isEvent) {
    // Event planning specific tasks
    tasks = [
      { 
        name: "Event Concept & Theme Development", 
        description: "Define event purpose, theme, and unique positioning", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 3) 
      },
      { 
        name: "Venue Research & Selection", 
        description: "Research, visit and select appropriate venue matching requirements and budget", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 10) 
      },
      { 
        name: "Budget Planning & Allocation", 
        description: "Create detailed budget breakdown with contingency planning", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 15) 
      },
      { 
        name: "Speaker/Talent Outreach & Booking", 
        description: "Identify, contact, and confirm speakers or performers", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 25) 
      },
      { 
        name: "Sponsorship Package Creation", 
        description: "Develop tiered sponsorship opportunities with defined benefits", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 20) 
      },
      { 
        name: "Event Marketing Plan Execution", 
        description: "Implement promotional strategy across channels to drive registrations", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 30) 
      },
      { 
        name: "Registration System Setup", 
        description: "Configure and test online registration platform and payment processing", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 35) 
      },
      { 
        name: "Event Logistics Coordination", 
        description: "Plan detailed day-of logistics including staffing, catering, and equipment", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 45) 
      },
      { 
        name: "Technical Production Planning", 
        description: "Arrange audio/visual requirements, staging, and technical rehearsals", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 48) 
      },
      { 
        name: "Attendee Communication Schedule", 
        description: "Develop pre-event communication plan with important information", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 50) 
      },
      { 
        name: "On-site Staff Briefing", 
        description: "Conduct comprehensive briefing for all event staff and volunteers", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 55) 
      },
      { 
        name: "Post-Event Evaluation", 
        description: "Gather and analyze attendee feedback, metrics, and team debrief", 
        priority: "low", 
        dueDate: getDateOffset(startDate, 60) 
      }
    ];
    milestones = [
      { name: "Event Concept Finalized", dueDate: getDateOffset(startDate, 5) },
      { name: "Venue & Key Vendors Contracted", dueDate: getDateOffset(startDate, 18) },
      { name: "Registration Launch", dueDate: getDateOffset(startDate, 35) },
      { name: "Event Day", dueDate: getDateOffset(startDate, 55) },
      { name: "Post-Event Report Complete", dueDate: endDate }
    ];
  } else {
    // Generic but more specific than before
    tasks = [
      { 
        name: "Project Objectives Definition Workshop", 
        description: "Facilitate session with stakeholders to define clear project goals, scope, and success metrics", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 3) 
      },
      { 
        name: "Stakeholder Analysis & Communication Plan", 
        description: "Identify all project stakeholders, their influence, and create targeted communication strategy", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 8) 
      },
      { 
        name: "Comprehensive Requirements Documentation", 
        description: "Gather and document detailed project requirements with acceptance criteria", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 15) 
      },
      { 
        name: "Detailed Project Schedule Development", 
        description: "Create work breakdown structure and timeline with dependencies and critical path", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 20) 
      },
      { 
        name: "Risk Assessment & Mitigation Planning", 
        description: "Identify potential risks, assess impact, and develop mitigation strategies", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 25) 
      },
      { 
        name: "Resource Allocation & Team Assembly", 
        description: "Secure necessary resources and finalize project team with clear responsibilities", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 30) 
      },
      { 
        name: "Solution Design & Prototyping", 
        description: "Develop detailed design specifications and prototype key elements", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 35) 
      },
      { 
        name: "Implementation Phase Execution", 
        description: "Execute planned activities according to project schedule with regular checkpoints", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 45) 
      },
      { 
        name: "Quality Control Process", 
        description: "Conduct thorough quality checks against requirements and acceptance criteria", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 50) 
      },
      { 
        name: "Stakeholder Review Facilitation", 
        description: "Organize structured review sessions with key stakeholders for feedback", 
        priority: "medium", 
        dueDate: getDateOffset(startDate, 52) 
      },
      { 
        name: "Transition & Implementation Support", 
        description: "Provide guidance and support during solution implementation or launch", 
        priority: "high", 
        dueDate: getDateOffset(startDate, 55) 
      },
      { 
        name: "Project Retrospective & Documentation", 
        description: "Conduct lessons learned session and complete project documentation", 
        priority: "low", 
        dueDate: getDateOffset(startDate, 60) 
      }
    ];
    milestones = [
      { name: "Project Charter Approved", dueDate: getDateOffset(startDate, 10) },
      { name: "Requirements & Design Finalized", dueDate: getDateOffset(startDate, 25) },
      { name: "Implementation Completed", dueDate: getDateOffset(startDate, 45) },
      { name: "Delivery & Acceptance", dueDate: getDateOffset(startDate, 55) },
      { name: "Project Closure", dueDate: endDate }
    ];
  }
  
  return {
    name: projectName,
    description: `This project plan for "${idea}" includes specific tasks tailored to your project type. The plan follows best practices and includes industry-specific activities to help you achieve your objectives efficiently.`,
    tasks: tasks,
    milestones: milestones,
    timeline: {
      startDate: startDate,
      endDate: endDate,
      duration: 60
    }
  };
}

// Helper function to get a date X days from a start date
function getDateOffset(startDate: string, daysToAdd: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().split('T')[0];
}

export async function generateProjectPlan(idea: string) {
  try {
    // System message to set the context and expectations
    const systemMessage = `
      You are an elite business strategist and project architect with 20+ years executing complex initiatives for Fortune 500s and high-growth startups.
      Your expertise spans digital transformation, product launches, marketing campaigns, software development, and operational excellence.
      
      You think in SYSTEMS, not tasks. Every project plan you create must be:
      
      1. HYPER-CONTEXTUAL: Deeply understand the industry, market dynamics, competitive landscape, and specific challenges
      2. OUTCOME-DRIVEN: Every task produces a tangible deliverable that moves the needle on business metrics
      3. RESOURCE-OPTIMIZED: Consider team bandwidth, skill requirements, budget constraints, and opportunity costs
      4. RISK-AWARE: Identify potential blockers, dependencies, and mitigation strategies upfront
      5. AI-AUGMENTED: Leverage cutting-edge AI tools and automation to 10x productivity
      
      When analyzing a project idea:
      - Extract implicit requirements and unstated assumptions
      - Identify the core business problem being solved
      - Map out the complete value chain and stakeholder ecosystem
      - Consider regulatory, compliance, and market timing factors
      - Build in feedback loops, validation gates, and pivot points
      
      For task descriptions, use this framework:
      - WHAT: Specific deliverable with acceptance criteria
      - WHY: Business impact and dependency chain
      - HOW: Key activities, tools, and methodologies
      - WHO: Required skills and potential AI augmentation
      - METRICS: Success indicators and quality benchmarks
      
      Today is ${new Date().toISOString().split('T')[0]}.
      
      CRITICAL: Generate plans that feel like they came from a $500/hour consultant who intimately understands the client's business.
    `;

    // User prompt with the specific request and idea
    const prompt = `
      Create an enterprise-grade project execution blueprint for: "${idea}"
      
      ANALYSIS PHASE:
      1. Identify the industry vertical, market segment, and business model
      2. Determine if this is B2B/B2C, product/service, digital/physical
      3. Map competitive landscape and differentiation opportunities
      4. Consider regulatory environment and compliance requirements
      5. Assess technical complexity and integration requirements
      
      DELIVERABLE REQUIREMENTS:
      
      Project Name: A compelling, market-ready name that captures the essence and value proposition
      
      Project Description: A comprehensive 5-7 sentence executive summary that includes:
      - The core problem being solved and target market
      - Unique value proposition and competitive advantage
      - High-level approach and key methodologies
      - Expected business impact and success metrics
      - Critical dependencies and stakeholder requirements
      
      Tasks: 12-20 highly specific tasks, each with:
      - NAME: Action-oriented title with specific deliverable (e.g., "Develop Python-based sentiment analysis pipeline for customer review data")
      - DESCRIPTION: 3-5 sentences covering:
        • Specific deliverable with acceptance criteria
        • Business rationale and impact on project success
        • Technical approach, tools, and methodologies
        • Dependencies and integration points
        • Success metrics and quality gates
      - PRIORITY: Based on business impact, technical dependencies, and risk mitigation
      - DUE DATE: Realistic timeline considering complexity and dependencies
      
      Each task must include:
      - Specific technologies, frameworks, or platforms
      - Quantifiable outcomes (e.g., "Process 10,000 reviews/hour with 95% accuracy")
      - AI tool recommendations for acceleration (e.g., "Use Claude for code generation, Midjourney for design assets")
      - Risk factors and mitigation strategies
      
      Example task description format:
      "Design and implement OAuth 2.0 authentication system with multi-factor authentication support. This will secure user access to the platform, protecting sensitive financial data and ensuring SOC 2 compliance. Implement using NextAuth.js with Prisma ORM, supporting Google, Microsoft, and SAML SSO providers. Integrate with SendGrid for email verification and Twilio for SMS-based 2FA. Success criteria: <100ms auth response time, 99.9% uptime, support for 10,000 concurrent sessions. Dependencies: User database schema, API gateway configuration. Risk: Third-party service availability - mitigate with fallback providers."
      
      Industry-Specific Considerations:
      - SaaS: Focus on scalability, multi-tenancy, subscription billing, analytics
      - E-commerce: Inventory, payments, logistics, conversion optimization
      - FinTech: Compliance (PCI-DSS, SOX), security, real-time processing
      - HealthTech: HIPAA compliance, interoperability, clinical validation
      - Marketing: Campaign ROI, attribution, creative testing, audience segmentation
      
      Return ONLY valid JSON without comments:
      {
        "name": "Project Name",
        "description": "Comprehensive description",
        "tasks": [
          {
            "name": "Specific Task Name",
            "description": "Detailed multi-sentence description",
            "priority": "high|medium|low",
            "dueDate": "YYYY-MM-DD"
          }
            "description": "Detailed task description",
            "priority": "medium",
            "dueDate": "YYYY-MM-DD"
          }
        ],
        "milestones": [
          {
            "name": "Descriptive Milestone Name 1",
            "description": "Milestone description", 
            "dueDate": "YYYY-MM-DD"
          },
          {
            "name": "Descriptive Milestone Name 2",
            "description": "Milestone description", 
            "dueDate": "YYYY-MM-DD"
          }
        ],
        "timeline": {
          "startDate": "YYYY-MM-DD",
          "endDate": "YYYY-MM-DD",
          "durationDays": 60
        }
      }
      
      Your plan MUST include:
      
      1. A specific, descriptive project name that accurately reflects the project's purpose
      
      2. A detailed description (3-5 sentences) that explains:
         - The project's purpose and business value
         - Primary stakeholders and target audience
         - Key success criteria
      
      3. A comprehensive task list with 10-15 specific tasks that:
         - Follow a logical workflow sequence
         - Include concrete deliverables (not vague activities)
         - Cover the entire project lifecycle (initiation to completion)
         - Each have clear descriptions, appropriate priorities, and realistic due dates
      
      4. 3-5 significant milestones that represent major achievement points
      
      5. A realistic timeline with:
         - Start date (today or in the near future)
         - End date based on the project's complexity
         - Appropriate duration in days
         
      Your plan should be specific to the project domain and include industry-specific terminology,
      deliverables, and considerations. Avoid generic task templates that could apply to any project.
    `;

    try {
      // Only fall back to the demo plan when there is NO usable provider.
      // Own-key (Claude) users route through their key even when the platform
      // OpenAI key is absent, so don't downgrade them to the demo plan.
      if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
        console.log("No AI provider configured, using fallback demo plan");
        return getDemoProjectPlan(idea);
      }

      console.log("🔍 Generating AI project plan for idea:", idea);
      console.log("📡 Using OpenAI model:", OPENAI_MODEL);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      });
      
      if (response.usage) {
        trackTokenUsage("system", "project-plan-generation", "gpt-4o", response.usage).catch(() => {});
      }

      const content = response.choices[0].message.content;
      if (!content) {
        console.log("❌ OpenAI returned empty content");
        throw new Error("Failed to generate project plan - empty response");
      }
      
      console.log("✅ Received AI response:", content.substring(0, 100) + "...");
      
      try {
        // Parse the JSON response
        const projectPlan = JSON.parse(content);
        console.log("✅ Successfully parsed JSON response");
        
        // Log some project plan details for debugging
        console.log("📋 Project name:", projectPlan.name || projectPlan.projectName || "<missing>");
        console.log("📋 Task count:", (projectPlan.tasks || []).length);
        console.log("📋 Milestone count:", (projectPlan.milestones || []).length);
        
        // Validate and enhance the project plan
        const enhanced = enhanceProjectPlan(projectPlan);
        console.log("✅ Successfully enhanced project plan");
        
        // Return the enhanced project plan
        return enhanced;
      } catch (parseError) {
        console.error("❌ JSON parsing error:", parseError);
        console.log("Raw response:", content);
        throw new Error("Failed to parse OpenAI response as JSON");
      }
    } catch (error: any) {
      console.log("❌ OpenAI API error, using fallback demo plan:", error.message);
      
      // If OpenAI API fails (quota exceeded, etc.), use our demo project plan
      return getDemoProjectPlan(idea);
    }
  } catch (error) {
    console.error("Error generating project plan:", error);
    
    // Last resort fallback
    return getDemoProjectPlan(idea);
  }
}

// Helper function to validate and enhance a project plan
function enhanceProjectPlan(plan: any) {
  // Set reasonable start and end dates if they weren't generated properly
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Handle project name from different potential fields
  if (!plan.name && plan.projectName) {
    plan.name = plan.projectName;
  } else if (!plan.name && plan.title) {
    plan.name = plan.title;
  } else if (!plan.name) {
    // If the plan has a description, try to generate a name from it
    if (plan.description && plan.description.length > 0) {
      // Extract a name from the description - first few words that make sense
      const words = plan.description.split(' ');
      const nameWords = words.slice(0, Math.min(5, words.length));
      plan.name = nameWords.join(' ');
      
      // Add a project type suffix if we can detect one
      if (plan.description.toLowerCase().includes('app') || 
          plan.description.toLowerCase().includes('application') || 
          plan.description.toLowerCase().includes('software')) {
        plan.name += ' App Project';
      } else if (plan.description.toLowerCase().includes('website') || 
                 plan.description.toLowerCase().includes('web')) {
        plan.name += ' Website Project';
      } else if (plan.description.toLowerCase().includes('marketing') || 
                 plan.description.toLowerCase().includes('campaign')) {
        plan.name += ' Marketing Project';
      } else {
        plan.name += ' Project Plan';
      }
    } else {
      // Use a more generic but still informative name
      const now = new Date();
      const month = now.toLocaleString('default', { month: 'long' });
      const year = now.getFullYear();
      
      plan.name = `Strategic Project Plan (${month} ${year})`;
    }
  }
  
  // Ensure project description exists
  if (!plan.description) {
    plan.description = `Project plan for various deliverables and milestones.`;
  }
  
  // Ensure timeline exists and has valid dates
  if (!plan.timeline) {
    plan.timeline = { startDate: today, duration: 30 };
  }
  
  if (!plan.timeline.startDate || !isValidDate(plan.timeline.startDate)) {
    plan.timeline.startDate = today;
  }
  
  // Calculate end date if missing
  if (!plan.timeline.endDate || !isValidDate(plan.timeline.endDate)) {
    const endDate = new Date(plan.timeline.startDate);
    endDate.setDate(endDate.getDate() + (plan.timeline.duration || 30));
    plan.timeline.endDate = endDate.toISOString().split('T')[0];
  }
  
  // Ensure tasks array exists and has valid properties
  if (!plan.tasks || !Array.isArray(plan.tasks)) {
    plan.tasks = [];
  }
  
  // Process tasks to ensure they have valid dates and priorities
  plan.tasks = plan.tasks.map((task: any, index: number) => {
    // Use taskName if present but name is missing
    if (!task.name && task.taskName) {
      task.name = task.taskName;
    }
    // If both name and taskName are missing, provide a fallback
    else if (!task.name) {
      // Try to generate a more descriptive name from the description if available
      if (task.description && task.description.length > 0) {
        // Extract first sentence or first 30 chars of description as name
        const firstSentence = task.description.split('.')[0];
        task.name = firstSentence.length > 40 ? firstSentence.substring(0, 40) + '...' : firstSentence;
      } else {
        task.name = `Task ${index + 1}: Implementation Activity`;
      }
    }
    
    // Make sure task names and descriptions are unique and specific
    if (task.name && task.name.toLowerCase().includes("phase")) {
      task.name = task.name.replace(/phase/i, "Stage");
    }
    
    // Add more specific details to generic task names
    if (task.name === "Requirements Analysis") {
      task.name = "Detailed Requirements Documentation";
    } else if (task.name === "Project Kick-off") {
      task.name = "Initial Project Alignment Meeting";
    } else if (task.name === "Testing") {
      task.name = "Comprehensive Quality Assurance";
    }
    
    // Generate a due date if missing
    if (!task.dueDate || !isValidDate(task.dueDate)) {
      const taskDate = new Date(plan.timeline.startDate);
      // Space tasks out evenly across the timeline
      const duration = Math.floor((new Date(plan.timeline.endDate).getTime() - new Date(plan.timeline.startDate).getTime()) / (1000 * 60 * 60 * 24));
      const daysPerTask = Math.max(1, Math.floor(duration / (plan.tasks.length + 1)));
      taskDate.setDate(taskDate.getDate() + (index + 1) * daysPerTask);
      task.dueDate = taskDate.toISOString().split('T')[0];
    }
    
    // Ensure priority is valid
    if (!task.priority || !['high', 'medium', 'low'].includes(task.priority.toLowerCase())) {
      task.priority = ['high', 'medium', 'low'][Math.floor(Math.random() * 3)];
    }
    
    // Normalize priority to lowercase
    task.priority = task.priority.toLowerCase();
    
    // Ensure description exists
    if (!task.description) {
      task.description = `Complete the "${task.name}" task according to project specifications.`;
    }
    
    return task;
  });
  
  // Ensure milestones array exists
  if (!plan.milestones || !Array.isArray(plan.milestones)) {
    plan.milestones = [];
  }
  
  // Process milestones to ensure they have valid dates and names
  plan.milestones = plan.milestones.map((milestone: any, index: number) => {
    // Use milestoneName if present but name is missing
    if (!milestone.name && milestone.milestoneName) {
      milestone.name = milestone.milestoneName;
    }
    // If both name and milestoneName are missing, provide a fallback
    else if (!milestone.name) {
      // Try to generate a more descriptive name from the description if available
      if (milestone.description && milestone.description.length > 0) {
        // Extract first sentence or first 40 chars of description as name
        const firstSentence = milestone.description.split('.')[0];
        milestone.name = firstSentence.length > 40 ? firstSentence.substring(0, 40) + '...' : firstSentence;
      } else {
        // Use a more descriptive fallback name based on the milestone position
        const position = index + 1;
        const total = plan.milestones.length;
        if (position === 1) {
          milestone.name = 'Project Initiation Phase Complete';
        } else if (position === total) {
          milestone.name = 'Project Completion';
        } else if (position === Math.ceil(total / 2)) {
          milestone.name = 'Mid-Project Review';
        } else if (position < Math.ceil(total / 2)) {
          milestone.name = `Planning Phase ${position} Complete`;
        } else {
          milestone.name = `Implementation Phase ${position - Math.ceil(total / 2)} Complete`;
        }
      }
    }
    
    if (!milestone.dueDate || !isValidDate(milestone.dueDate)) {
      const milestoneDate = new Date(plan.timeline.startDate);
      const duration = Math.floor((new Date(plan.timeline.endDate).getTime() - new Date(plan.timeline.startDate).getTime()) / (1000 * 60 * 60 * 24));
      const daysPerMilestone = Math.max(1, Math.floor(duration / (plan.milestones.length + 1)));
      milestoneDate.setDate(milestoneDate.getDate() + (index + 1) * daysPerMilestone);
      milestone.dueDate = milestoneDate.toISOString().split('T')[0];
    }
    return milestone;
  });
  
  return plan;
}

// Helper function to validate a date string
function isValidDate(dateString: string) {
  if (!dateString) return false;
  
  // Check format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  
  // Check if it's a valid date
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

export async function analyzeProjectForBottlenecks(projects: Project[], tasks: Task[]) {
  try {
    const projectData = JSON.stringify(projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      progress: p.progress,
      totalTasks: p.totalTasks,
      completedTasks: p.completedTasks,
      dueDate: p.dueDate
    })));
    
    const taskData = JSON.stringify(tasks.map(t => ({
      id: t.id,
      name: t.name, 
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      projectId: t.projectId
    })));
    
    try {
      const prompt = `
        You are an AI-powered Project Management Assistant with deep expertise in project management methodologies.
        
        Based on the following project data and task information, analyze the projects for potential bottlenecks, 
        risks, and inefficiencies that could impact project success.
        
        Projects: ${projectData}
        
        Tasks: ${taskData}
        
        For each potential issue you identify, provide:
        1. A clear title describing the issue
        2. A detailed description of the problem
        3. The severity level (info, warning, or critical)
        4. The specific project ID affected
        5. A suggested action to resolve the issue
        
        Please identify at least 3-5 potential issues across the projects, focusing on:
        - Resource conflicts or overallocations
        - Timeline risks and schedule constraints
        - Dependency bottlenecks
        - Task prioritization problems
        - Critical path issues
        - Quality or scope concerns
        
        I need your response in JSON format.
      Return the output as a JSON array with this structure:
        [
          {
            "title": "Issue Title",
            "description": "Detailed description of the issue",
            "severity": "info/warning/critical",
            "projectId": 123,
            "suggestedAction": "Suggested action to resolve the issue"
          }
        ]
      `;
      
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      
      if (response.usage) {
        trackTokenUsage("system", "bottleneck-analysis", "gpt-4o", response.usage).catch(() => {});
      }

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Failed to analyze projects for bottlenecks");
      }
      
      // Parse the JSON response and ensure it's an array
      const result = JSON.parse(content);
      const bottlenecks = Array.isArray(result) ? result : (result.issues || result.bottlenecks || []);
      
      return bottlenecks;
    } catch (error: any) {
      console.log("OpenAI API error, using fallback bottlenecks:", error.message);
      
      // Fallback bottlenecks if OpenAI API fails
      return [
        {
          title: "Resource Conflict Detected",
          description: "Development team is overallocated by 15% in the next sprint.",
          severity: "warning",
          projectId: projects.length > 0 ? projects[0].id : undefined,
          suggestedAction: "Redistribute tasks or extend timeline"
        },
        {
          title: "Timeline Risk",
          description: "Critical path has minimal slack, increasing risk of delays.",
          severity: "warning",
          projectId: projects.length > 1 ? projects[1].id : undefined,
          suggestedAction: "Add buffer time to critical path tasks"
        },
        {
          title: "Dependency Bottleneck",
          description: "Multiple tasks waiting on a single deliverable from external vendor.",
          severity: "critical",
          projectId: projects.length > 2 ? projects[2].id : undefined,
          suggestedAction: "Establish interim milestones with vendor"
        }
      ];
    }
  } catch (error) {
    console.error("Error analyzing projects for bottlenecks:", error);
    throw new Error("Failed to analyze projects for bottlenecks");
  }
}

/**
 * Performs deep analysis of a project, evaluating it across multiple dimensions
 * including methodology fit, resource allocation, timeline optimization,
 * and best practices. This function provides comprehensive insights
 * beyond simple bottleneck detection.
 */
export async function deepProjectAnalysis(project: Project, tasks: Task[]) {
  try {
    const projectData = JSON.stringify({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      progress: project.progress,
      totalTasks: project.totalTasks,
      completedTasks: project.completedTasks,
      dueDate: project.dueDate,
      aiGenerated: project.aiGenerated
    });
    
    const projectTasks = tasks.filter(t => t.projectId === project.id);
    const taskData = JSON.stringify(projectTasks.map(t => ({
      id: t.id,
      name: t.name, 
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate
    })));
    
    try {
      const prompt = `
        You are an AI-powered Project Management Assistant with deep expertise in project management methodologies.
        Analyze the following project and its tasks to provide comprehensive insights on multiple dimensions.
        
        Project: ${projectData}
        
        Tasks: ${taskData}
        
        PROJECT MANAGEMENT PATTERNS: ${PROJECT_PATTERNS.join(", ")}
        
        Please analyze the project across the following dimensions and provide detailed insights:
        
        1. Methodology Fit: Identify which project management pattern best fits this project and explain why
        2. Resource Optimization: Analyze the distribution and allocation of tasks
        3. Timeline Analysis: Evaluate the project timeline, critical path, and potential schedule optimizations
        4. Risk Assessment: Identify potential risks not captured in current tasks
        5. Quality Assurance: Recommend quality control measures appropriate for this project
        6. Best Practices: Identify specific industry best practices that should be applied
        7. Missing Elements: Identify any critical components, tasks, or considerations missing from the current plan
        
        For each dimension, provide:
        - A brief assessment (1-2 sentences)
        - A score from 1-10 (10 being excellent)
        - 2-3 specific, actionable recommendations
        
        I need your response in JSON format.
        Return the output as a JSON object with this structure:
        {
          "overallRating": 7,
          "summary": "Brief overall summary",
          "dimensions": [
            {
              "name": "Dimension Name",
              "score": 8,
              "assessment": "Brief assessment of this dimension",
              "recommendations": [
                "First specific recommendation",
                "Second specific recommendation"
              ]
            }
          ],
          "suggestedMethodology": "Name of recommended PM methodology",
          "methodologyRationale": "Explanation of why this methodology fits",
          "criticalMissingElements": [
            "First missing critical element",
            "Second missing critical element"
          ]
        }
      `;
      
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      
      if (response.usage) {
        trackTokenUsage("system", "deep-project-analysis", "gpt-4o", response.usage).catch(() => {});
      }

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Failed to perform deep project analysis");
      }
      
      return JSON.parse(content);
    } catch (error: any) {
      console.log("OpenAI API error in deep analysis, using fallback analysis:", error.message);
      
      // Fallback analysis if OpenAI API fails
      return {
        overallRating: 6,
        summary: "This project has several areas that could benefit from optimization, particularly in timeline management and resource allocation.",
        dimensions: [
          {
            name: "Methodology Fit",
            score: 7,
            assessment: "The project structure suggests an Agile approach, but implementation is incomplete.",
            recommendations: [
              "Formalize sprint planning and retrospectives",
              "Implement daily stand-ups to improve communication"
            ]
          },
          {
            name: "Resource Optimization",
            score: 5,
            assessment: "Tasks appear unevenly distributed, creating potential bottlenecks.",
            recommendations: [
              "Redistribute high-priority tasks across available resources",
              "Consider bringing in specialized expertise for technical tasks"
            ]
          },
          {
            name: "Timeline Analysis",
            score: 6,
            assessment: "The project timeline has minimal buffer for delays in critical path items.",
            recommendations: [
              "Add 15% buffer to critical path tasks",
              "Identify opportunities for parallel task execution"
            ]
          }
        ],
        suggestedMethodology: "Agile with Kanban elements",
        methodologyRationale: "The iterative nature of the project with clearly defined deliverables makes it suitable for Agile, while the workflow visualization benefits of Kanban would help identify bottlenecks.",
        criticalMissingElements: [
          "Stakeholder communication plan",
          "Risk mitigation strategy",
          "Quality assurance checkpoints"
        ]
      };
    }
  } catch (error) {
    console.error("Error performing deep project analysis:", error);
    throw new Error("Failed to perform deep project analysis");
  }
}

export async function generateActionPlan(projects: Project[], tasks: Task[], insights: Insight[]) {
  try {
    const projectData = JSON.stringify(projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      progress: p.progress,
      totalTasks: p.totalTasks,
      completedTasks: p.completedTasks,
      dueDate: p.dueDate
    })));
    
    const taskData = JSON.stringify(tasks.map(t => ({
      id: t.id,
      name: t.name, 
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      projectId: t.projectId
    })));
    
    const insightData = JSON.stringify(insights.map(i => ({
      type: i.type,
      title: i.title,
      description: i.description,
      severity: i.severity,
      projectId: i.projectId,
      suggestedAction: i.suggestedAction
    })));
    
    try {
      const prompt = `
        You are an AI-powered Project Management Assistant with deep expertise in project management methodologies.
        
        Based on the following project data, task information, and previously identified insights, 
        generate a comprehensive action plan that addresses the critical issues and optimizes the projects for success.
        
        Projects: ${projectData}
        
        Tasks: ${taskData}
        
        Insights: ${insightData}
        
        The action plan should:
        1. Prioritize critical issues that need immediate attention
        2. Provide specific, actionable steps to resolve each issue
        3. Estimate the impact of each action on the overall project health
        4. Suggest timelines for implementation
        
        Return the output as a JSON object with this structure:
        {
          "title": "Action Plan Title",
          "summary": "Brief summary of the plan",
          "actions": [
            {
              "title": "Action Title",
              "description": "Detailed description of the action",
              "priority": "high/medium/low",
              "timeline": "Suggested timeline for implementation",
              "impact": "Expected impact on project"
            }
          ]
        }
      `;
      
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      
      if (response.usage) {
        trackTokenUsage("system", "action-plan-generation", "gpt-4o", response.usage).catch(() => {});
      }

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Failed to generate action plan");
      }
      
      return JSON.parse(content);
    } catch (error: any) {
      console.log("OpenAI API error, using fallback action plan:", error.message);
      
      // Fallback action plan if OpenAI API fails
      return {
        title: "AI-Generated Action Plan",
        summary: "This action plan addresses the critical issues identified in your projects.",
        actions: [
          {
            title: "Resolve Resource Conflict",
            description: "Redistribute tasks to balance team workload in the upcoming sprint.",
            priority: "high",
            timeline: "Implement within 2 days",
            impact: "Will prevent team burnout and ensure quality deliverables"
          },
          {
            title: "Address Timeline Risk",
            description: "Add 2-day buffer to critical path tasks to account for potential delays.",
            priority: "medium",
            timeline: "Implement within 1 week",
            impact: "Provides realistic timeline for stakeholders"
          },
          {
            title: "Mitigate Dependency Bottleneck",
            description: "Establish weekly check-ins with external vendor and create contingency plan.",
            priority: "high",
            timeline: "Implement immediately",
            impact: "Reduces risk of cascading delays"
          }
        ]
      };
    }
  } catch (error) {
    console.error("Error generating action plan:", error);
    throw new Error("Failed to generate action plan");
  }
}
