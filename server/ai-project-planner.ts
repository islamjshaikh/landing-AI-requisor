import OpenAI from "openai";
import { getAiClient } from "./services/ai-provider";
import { v4 as uuidv4 } from 'uuid';
import { format, addWeeks, addDays } from 'date-fns';
import { trackTokenUsage } from './services/token-tracker';
import { persistMemory } from './services/agent-memory';

const openai = (getAiClient() as any);

interface ProjectPlanRequest {
  prompt: string;
  outputFormat: "structured" | "markdown" | "json";
  depth: "basic" | "detailed" | "comprehensive";
  contextInfo?: {
    industry?: string;
    teamSize?: string;
    budget?: string;
    timeline?: string;
    techPreferences?: string[];
  };
}

interface Task {
  id: string;
  name: string;
  description?: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  status?: string;
  assignee?: string;
}

interface Milestone {
  id: string;
  name: string;
  description?: string;
  dueDate: string;
  tasks: Task[];
}

interface CanvasProjectPlan {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  milestones: Milestone[];
}

interface ProjectPlan {
  // Canvas-compatible format
  canvasPlan: CanvasProjectPlan;

  // Additional detailed information
  overview: string;
  modules: string[];
  techStack: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    devops?: string[];
  };
  qaStrategy: string;
  apiRequirements: string[];
  databaseSchema: string;
  timeline: {
    phase: string;
    duration: string;
    deliverables: string[];
  }[];
  roles: {
    role: string;
    responsibilities: string[];
  }[];
  risks: string[];
  deliverables: string[];
  rawMarkdown: string;
  metadata: {
    domain: string;
    outputType: string;
    depth: string;
    confidence: number;
    suggestions?: string[];
  };
}

function getDepthInstructions(depth: string): string {
  switch (depth) {
    case "basic":
      return "Provide a concise, high-level overview focusing on key components and timelines.";
    case "comprehensive":
      return "Provide an extremely detailed analysis including code examples, specific configurations, advanced architectural patterns, and granular implementation details.";
    default:
      return "Provide a well-balanced, detailed plan with specific recommendations and clear implementation guidance.";
  }
}

export async function generateProjectPlan(
  request: ProjectPlanRequest,
  /** Optional. When supplied, the call is logged to long-term memory. */
  userId?: string,
): Promise<ProjectPlan> {
  const { prompt, outputFormat = "structured", depth = "detailed", contextInfo } = request;

  console.log(`Generating AI project plan with depth: ${depth} and format: ${outputFormat}`);

  // Enhanced system message with better contextual understanding
  const systemPrompt = `You are an expert AI Project Planner with deep understanding of various industries and domains. You analyze prompts contextually to generate comprehensive, actionable project plans.

Your expertise spans:
- Web & Mobile Development (React, React Native, Flutter, Swift, Kotlin)
- Enterprise Solutions (ERP, CRM, HR systems, Supply Chain)
- SaaS & Cloud Platforms (Multi-tenant, Microservices, Serverless)
- AI/ML Projects (Computer Vision, NLP, Predictive Analytics, GenAI)
- E-commerce & Marketplaces (B2B, B2C, D2C)
- FinTech & Banking (Payment systems, Trading platforms, Digital wallets)
- Healthcare & MedTech (EHR, Telemedicine, Medical devices)
- EdTech & Learning Platforms (LMS, Course platforms, Assessment tools)
- IoT & Hardware Integration (Smart devices, Industrial IoT, Wearables)
- Gaming & Entertainment (Mobile games, Streaming platforms, Social apps)

You understand context from:
- Industry-specific requirements and regulations
- Technical constraints and best practices
- Team dynamics and resource limitations
- Market conditions and competitive landscape
- User needs and business objectives

When generating a project plan, you must include:
1. Project Overview
2. Modules/Features (specific, actionable items)
3. Tech Stack (categorized by frontend, backend, database, devops)
4. QA Strategy (testing approach, tools, coverage)
5. API Requirements (specific endpoints needed)
6. Database Schema (tables, relationships, key fields)
7. Timeline & Milestones (phases with durations and deliverables)
8. Roles & Responsibilities (team structure)
9. Risk & Compliance (potential issues and mitigation)
10. Deliverables (concrete outputs)

${getDepthInstructions(request.depth)}

Generate plans that are:
- Contextually aware and industry-appropriate
- Technically sound and feasible
- Resource-optimized and realistic
- Risk-aware with mitigation strategies
- Aligned with modern development practices`;

  // Build enhanced user message with context
  let userPrompt = `Generate a comprehensive project plan for: "${request.prompt}"\n\n`;

  if (contextInfo) {
    userPrompt += `Additional Context:\n`;
    if (contextInfo.industry) userPrompt += `- Industry: ${contextInfo.industry}\n`;
    if (contextInfo.teamSize) userPrompt += `- Team Size: ${contextInfo.teamSize}\n`;
    if (contextInfo.budget) userPrompt += `- Budget: ${contextInfo.budget}\n`;
    if (contextInfo.timeline) userPrompt += `- Timeline: ${contextInfo.timeline}\n`;
    if (contextInfo.techPreferences?.length) userPrompt += `- Tech Preferences: ${contextInfo.techPreferences.join(', ')}\n`;
    userPrompt += `\n`;
  }

  userPrompt += `Depth level: ${request.depth}

Please analyze the prompt contextually and provide a complete JSON response with:
{
  "projectName": "extracted or generated project name",
  "overview": "comprehensive project overview",
  "modules": ["detailed feature modules"],
  "techStack": {
    "frontend": ["appropriate frontend technologies"],
    "backend": ["appropriate backend technologies"],
    "database": ["appropriate database technologies"],
    "devops": ["appropriate devops tools"]
  },
  "qaStrategy": "comprehensive testing strategy",
  "apiRequirements": ["specific API endpoints"],
  "databaseSchema": "detailed schema design",
  "timeline": [
    {
      "phase": "phase name",
      "duration": "duration",
      "deliverables": ["specific deliverables"],
      "description": "phase description"
    }
  ],
  "roles": [
    {
      "role": "role name",
      "responsibilities": ["specific responsibilities"]
    }
  ],
  "risks": ["identified risks with mitigation"],
  "deliverables": ["final project deliverables"],
  "metadata": {
    "domain": "detected domain",
    "outputType": "plan type",
    "depth": "${request.depth}"
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4000
    });

    if (response.usage) {
      trackTokenUsage("system", "ai-project-planner", "gpt-4o", response.usage).catch(() => {});
    }

    // Long-term memory log.
    void persistMemory({
      ctx: { userId, agentName: "ai-project-planner", retrieve: false },
      userQuery: prompt.slice(0, 4000),
      agentResponse: response.choices[0].message.content || "",
    });

    const aiResponse = JSON.parse(response.choices[0].message.content || "{}");

    // Generate canvas-compatible plan from AI response
    const canvasPlan = generateCanvasPlan(aiResponse, request.prompt);

    // Generate markdown version
    const markdown = generateMarkdown(aiResponse);

    // Calculate confidence score based on prompt clarity and domain match
    const confidence = calculateConfidence(request.prompt, aiResponse);

    // Generate contextual suggestions
    const suggestions = generateSuggestions(request.prompt, aiResponse);

    return {
      canvasPlan,
      overview: aiResponse.overview || generateOverview(request.prompt, aiResponse),
      modules: aiResponse.modules || [],
      techStack: aiResponse.techStack || {},
      qaStrategy: aiResponse.qaStrategy || "Comprehensive testing strategy including unit, integration, and E2E tests",
      apiRequirements: aiResponse.apiRequirements || [],
      databaseSchema: aiResponse.databaseSchema || "Database schema will be designed based on requirements",
      timeline: aiResponse.timeline || generateDefaultTimeline(canvasPlan),
      roles: aiResponse.roles || generateDefaultRoles(),
      risks: aiResponse.risks || [],
      deliverables: aiResponse.deliverables || [],
      rawMarkdown: markdown,
      metadata: {
        domain: detectDomain(request.prompt, aiResponse),
        outputType: outputFormat,
        depth,
        confidence,
        suggestions
      }
    };
  } catch (error) {
    console.error("Error generating project plan:", error);
    throw new Error("Failed to generate project plan");
  }
}

function generateCanvasPlan(aiResponse: any, prompt: string): CanvasProjectPlan {
  const startDate = format(new Date(), 'yyyy-MM-dd');
  const projectName = aiResponse.projectName || extractProjectName(prompt) || "AI Generated Project";
  const description = aiResponse.description || aiResponse.overview || prompt;

  // Generate milestones from AI response
  const milestones: Milestone[] = [];

  if (aiResponse.timeline && Array.isArray(aiResponse.timeline)) {
    // Convert timeline phases to milestones
    aiResponse.timeline.forEach((phase: any, index: number) => {
      const milestoneDueDate = format(addWeeks(new Date(startDate), (index + 1) * 2), 'yyyy-MM-dd');
      const milestone: Milestone = {
        id: uuidv4(),
        name: phase.phase || `Phase ${index + 1}`,
        description: phase.description || `Complete ${phase.phase}`,
        dueDate: milestoneDueDate,
        tasks: []
      };

      // Generate tasks from deliverables
      if (phase.deliverables && Array.isArray(phase.deliverables)) {
        phase.deliverables.forEach((deliverable: string, taskIndex: number) => {
          const taskDueDate = format(addDays(new Date(milestoneDueDate), -7 + taskIndex), 'yyyy-MM-dd');
          milestone.tasks.push({
            id: uuidv4(),
            name: deliverable,
            description: `Complete ${deliverable}`,
            dueDate: taskDueDate,
            priority: determinePriority(deliverable, taskIndex),
            status: 'To Do'
          });
        });
      }

      milestones.push(milestone);
    });
  } else {
    // Generate default milestones if timeline not provided
    const defaultPhases = [
      { name: "Planning & Architecture", tasks: ["Requirements gathering", "Technical design", "Architecture planning"] },
      { name: "Core Development", tasks: ["Backend setup", "Frontend implementation", "Database design"] },
      { name: "Integration & Testing", tasks: ["API integration", "Unit testing", "Integration testing"] },
      { name: "Deployment & Launch", tasks: ["Production setup", "User training", "Go-live support"] }
    ];

    defaultPhases.forEach((phase, index) => {
      const milestoneDueDate = format(addWeeks(new Date(startDate), (index + 1) * 2), 'yyyy-MM-dd');
      const milestone: Milestone = {
        id: uuidv4(),
        name: phase.name,
        description: `Complete ${phase.name} phase`,
        dueDate: milestoneDueDate,
        tasks: phase.tasks.map((taskName, taskIndex) => ({
          id: uuidv4(),
          name: taskName,
          description: `Complete ${taskName}`,
          dueDate: format(addDays(new Date(milestoneDueDate), -5 + taskIndex * 2), 'yyyy-MM-dd'),
          priority: taskIndex === 0 ? 'high' : taskIndex === 1 ? 'medium' : 'low',
          status: 'To Do'
        }))
      };
      milestones.push(milestone);
    });
  }

  const endDate = milestones.length > 0 
    ? milestones[milestones.length - 1].dueDate 
    : format(addWeeks(new Date(startDate), 8), 'yyyy-MM-dd');

  return {
    name: projectName,
    description,
    startDate,
    endDate,
    milestones
  };
}

function extractProjectName(prompt: string): string {
  // Try to extract project name from prompt
  const patterns = [
    /(?:build|create|develop|design)\s+(?:a|an)?\s*([^.]+?)(?:\s+(?:for|that|with)|$)/i,
    /(?:project|app|application|system|platform)\s*(?:called|named)?\s*[:\-]?\s*([^.]+?)(?:\s|$)/i,
    /^([^.]+?)(?:\s+project|\s+app|\s+application|\s+system|\s+platform)/i
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Fallback: use first few words
  const words = prompt.split(' ').slice(0, 5).join(' ');
  return words.length > 50 ? words.substring(0, 50) + '...' : words;
}

function determinePriority(deliverable: string, index: number): 'high' | 'medium' | 'low' {
  const highPriorityKeywords = ['core', 'critical', 'essential', 'security', 'authentication', 'payment'];
  const lowPriorityKeywords = ['optional', 'nice-to-have', 'future', 'enhancement'];

  const lowerDeliverable = deliverable.toLowerCase();

  if (highPriorityKeywords.some(keyword => lowerDeliverable.includes(keyword))) {
    return 'high';
  }

  if (lowPriorityKeywords.some(keyword => lowerDeliverable.includes(keyword))) {
    return 'low';
  }

  // Default based on index
  return index === 0 ? 'high' : index < 3 ? 'medium' : 'low';
}

function generateOverview(prompt: string, aiResponse: any): string {
  if (aiResponse.overview) return aiResponse.overview;

  return `This project aims to ${prompt}. It will be developed using modern technologies and best practices to ensure scalability, maintainability, and optimal performance.`;
}

function generateDefaultTimeline(canvasPlan: CanvasProjectPlan): any[] {
  return canvasPlan.milestones.map(milestone => ({
    phase: milestone.name,
    duration: "2 weeks",
    deliverables: milestone.tasks.map(t => t.name)
  }));
}

function generateDefaultRoles(): any[] {
  return [
    {
      role: "Project Manager",
      responsibilities: ["Project planning", "Resource allocation", "Stakeholder communication"]
    },
    {
      role: "Tech Lead",
      responsibilities: ["Technical architecture", "Code reviews", "Team mentoring"]
    },
    {
      role: "Full Stack Developer",
      responsibilities: ["Frontend development", "Backend development", "API integration"]
    },
    {
      role: "QA Engineer",
      responsibilities: ["Test planning", "Test execution", "Bug tracking"]
    }
  ];
}

function detectDomain(prompt: string, aiResponse: any): string {
  const domainKeywords = {
    'e-commerce': ['shop', 'store', 'product', 'cart', 'payment', 'order', 'inventory'],
    'fintech': ['payment', 'banking', 'finance', 'trading', 'wallet', 'transaction'],
    'healthcare': ['patient', 'medical', 'health', 'clinic', 'doctor', 'appointment'],
    'education': ['course', 'student', 'learning', 'education', 'training', 'lesson'],
    'saas': ['subscription', 'tenant', 'dashboard', 'analytics', 'management'],
    'social': ['social', 'community', 'chat', 'messaging', 'profile', 'feed'],
    'ai-ml': ['ai', 'machine learning', 'ml', 'neural', 'prediction', 'classification']
  };

  const lowerPrompt = prompt.toLowerCase();
  const techStack = JSON.stringify(aiResponse.techStack || {}).toLowerCase();

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    const matchCount = keywords.filter(keyword => 
      lowerPrompt.includes(keyword) || techStack.includes(keyword)
    ).length;

    if (matchCount >= 2) return domain;
  }

  return 'general';
}

function calculateConfidence(prompt: string, aiResponse: any): number {
  let confidence = 0.5; // Base confidence

  // Increase confidence based on prompt clarity
  if (prompt.length > 50) confidence += 0.1;
  if (prompt.includes('build') || prompt.includes('create')) confidence += 0.1;

  // Increase confidence based on response completeness
  if (aiResponse.modules?.length > 3) confidence += 0.1;
  if (aiResponse.techStack?.frontend?.length > 0) confidence += 0.1;
  if (aiResponse.timeline?.length > 2) confidence += 0.1;

  return Math.min(confidence, 1.0);
}

function generateSuggestions(prompt: string, aiResponse: any): string[] {
  const suggestions = [];

  // Tech stack suggestions
  if (!aiResponse.techStack?.frontend?.length) {
    suggestions.push("Consider specifying your preferred frontend framework (React, Vue, Angular)");
  }

  // Timeline suggestions
  if (!prompt.includes('timeline') && !prompt.includes('deadline')) {
    suggestions.push("Provide a target timeline for more accurate milestone planning");
  }

  // Team suggestions
  if (!prompt.includes('team') && !prompt.includes('developer')) {
    suggestions.push("Specify team size and expertise for better resource planning");
  }

  // Budget suggestions
  if (!prompt.includes('budget') && !prompt.includes('cost')) {
    suggestions.push("Include budget constraints for appropriate technology choices");
  }

  return suggestions;
}

function generateMarkdown(plan: any): string {
  let markdown = `# ${plan.overview.split('\n')[0]}\n\n`;

  markdown += `## 🔷 Project Overview\n${plan.overview}\n\n`;

  markdown += `## 📦 Modules & Features\n`;
  plan.modules.forEach((module: string) => {
    markdown += `- ${module}\n`;
  });
  markdown += '\n';

  markdown += `## 🧠 Technology Stack\n`;
  if (plan.techStack.frontend?.length) {
    markdown += `### Frontend\n`;
    plan.techStack.frontend.forEach((tech: string) => {
      markdown += `- ${tech}\n`;
    });
  }
  if (plan.techStack.backend?.length) {
    markdown += `### Backend\n`;
    plan.techStack.backend.forEach((tech: string) => {
      markdown += `- ${tech}\n`;
    });
  }
  if (plan.techStack.database?.length) {
    markdown += `### Database\n`;
    plan.techStack.database.forEach((tech: string) => {
      markdown += `- ${tech}\n`;
    });
  }
  if (plan.techStack.devops?.length) {
    markdown += `### DevOps\n`;
    plan.techStack.devops.forEach((tech: string) => {
      markdown += `- ${tech}\n`;
    });
  }
  markdown += '\n';

  markdown += `## 🧪 QA Strategy\n${plan.qaStrategy}\n\n`;

  markdown += `## 🧩 API Requirements\n`;
  plan.apiRequirements.forEach((api: string) => {
    markdown += `- ${api}\n`;
  });
  markdown += '\n';

  markdown += `## 🗂️ Database Schema\n\`\`\`\n${plan.databaseSchema}\n\`\`\`\n\n`;

  markdown += `## 📅 Timeline & Milestones\n`;
  plan.timeline.forEach((phase: any) => {
    markdown += `### ${phase.phase} (${phase.duration})\n`;
    phase.deliverables.forEach((deliverable: string) => {
      markdown += `- ${deliverable}\n`;
    });
    markdown += '\n';
  });

  markdown += `## 👥 Roles & Responsibilities\n`;
  plan.roles.forEach((role: any) => {
    markdown += `### ${role.role}\n`;
    role.responsibilities.forEach((resp: string) => {
      markdown += `- ${resp}\n`;
    });
    markdown += '\n';
  });

  markdown += `## ✅ Risk & Compliance\n`;
  plan.risks.forEach((risk: string) => {
    markdown += `- ${risk}\n`;
  });
  markdown += '\n';

  markdown += `## 📂 Deliverables\n`;
  plan.deliverables.forEach((deliverable: string) => {
    markdown += `- ${deliverable}\n`;
  });

  return markdown;
}