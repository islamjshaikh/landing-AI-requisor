export type CodingAgent = "claude-code" | "cursor" | "lovable";

export interface AgentInfo {
  id: CodingAgent;
  name: string;
  description: string;
  icon: string;
  color: string;
  platformTip: string;
  deepLink: string;
  bestPractices: string[];
  strengths: string[];
}

export const CODING_AGENTS: AgentInfo[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Terminal-based AI that makes file-by-file changes with atomic commits",
    icon: "C",
    color: "bg-orange-500",
    platformTip: "Structured as file-by-file implementation spec with atomic commit guidance",
    deepLink: "https://claude.ai",
    bestPractices: [
      "Provide the project directory structure for better file targeting",
      "Specify the implementation order (schema → storage → routes → frontend)",
      "Ask for atomic commits per logical change for clean git history",
      "Include existing code patterns so Claude matches your style",
    ],
    strengths: [
      "Complex refactoring",
      "Architecture-aware changes",
      "Multi-file coordination",
      "Code review & debugging",
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    description: "IDE-integrated AI that uses @file references for targeted edits",
    icon: "Cu",
    color: "bg-purple-500",
    platformTip: "Includes @codebase references and @file mentions for Composer",
    deepLink: "https://cursor.sh",
    bestPractices: [
      "Use @file references to point Cursor at specific files to modify",
      "Break work into small, focused changes rather than large rewrites",
      "Cursor excels at incremental edits within an existing codebase",
      "Open the relevant files in tabs before pasting the prompt",
    ],
    strengths: [
      "Incremental code changes",
      "Refactoring existing code",
      "IDE-integrated workflow",
      "Multi-file edits with context",
    ],
  },
  {
    id: "lovable",
    name: "Lovable",
    description: "UI-first AI that generates beautiful, component-driven interfaces",
    icon: "L",
    color: "bg-pink-500",
    platformTip: "Optimized for UI-first, component-driven development with visual specs",
    deepLink: "https://lovable.dev",
    bestPractices: [
      "Focus on visual design requirements — colors, spacing, animations",
      "Describe the user experience flow, not just the technical implementation",
      "Include responsive design requirements (mobile, tablet, desktop)",
      "Mention component patterns (cards, modals, forms) for better output",
    ],
    strengths: [
      "Beautiful UI generation",
      "Component-driven design",
      "Responsive layouts",
      "Visual prototyping",
    ],
  },
];

interface ProjectContext {
  projectName?: string;
  projectDescription?: string;
  techStackSummary?: string;
}

export interface FeatureData {
  featureTitle: string;
  whyNow: string | null;
  evidence: string[] | null;
  uiChanges: string | null;
  dataModelChanges: string | null;
  workflowChanges: string | null;
  tasks: any;
  projectContext?: ProjectContext;
}

function formatTasksDetailed(tasks: any): string {
  if (!Array.isArray(tasks) || tasks.length === 0) return "";
  return tasks
    .map((t: any, i: number) => {
      const name = t.name || t.title || t;
      const description = t.description ? `: ${t.description}` : "";
      const priority = t.priority ? ` [${t.priority}]` : "";
      return `${i + 1}. ${name}${priority}${description}`;
    })
    .join("\n");
}

function deriveAcceptanceCriteria(feature: FeatureData): string[] {
  const criteria: string[] = [];
  if (feature.uiChanges) {
    criteria.push(`UI changes are implemented and visually match the specification: ${feature.uiChanges}`);
  }
  if (feature.dataModelChanges) {
    criteria.push(`Data model changes are applied and migrations run successfully: ${feature.dataModelChanges}`);
  }
  if (feature.workflowChanges) {
    criteria.push(`Workflow changes function correctly end-to-end: ${feature.workflowChanges}`);
  }
  if (Array.isArray(feature.tasks) && feature.tasks.length > 0) {
    criteria.push(`All ${feature.tasks.length} implementation tasks are completed`);
  }
  criteria.push("No regressions in existing functionality");
  criteria.push("Feature works on both mobile and desktop viewports");
  return criteria;
}

function buildCorePrompt(feature: FeatureData): string {
  const sections: string[] = [];

  sections.push(`# Feature: ${feature.featureTitle}`);
  sections.push("");

  if (feature.projectContext) {
    const ctx = feature.projectContext;
    sections.push(`## Project Context`);
    if (ctx.projectName) {
      sections.push(`- **Project**: ${ctx.projectName}`);
    }
    if (ctx.projectDescription) {
      sections.push(`- **Description**: ${ctx.projectDescription}`);
    }
    if (ctx.techStackSummary) {
      sections.push(`- **Tech Stack**: ${ctx.techStackSummary}`);
    } else {
      sections.push(`- **Tech Stack**: React 18 + TypeScript + Vite (frontend), Express + Drizzle ORM + PostgreSQL (backend), Tailwind CSS + shadcn/ui (styling), wouter (routing), TanStack Query v5 (data fetching)`);
    }
    sections.push("");
  }

  sections.push(`## Key File Locations`);
  sections.push(`- Schema & types: \`shared/schema.ts\``);
  sections.push(`- Storage interface: \`server/storage.ts\` (IStorage), \`server/database-storage.ts\` (DatabaseStorage)`);
  sections.push(`- API routes: \`server/routes.ts\``);
  sections.push(`- Pages: \`client/src/pages/\``);
  sections.push(`- Components: \`client/src/components/\` (organized by feature)`);
  sections.push(`- Route registration: \`client/src/App.tsx\``);
  sections.push(`- Query client: \`client/src/lib/queryClient.ts\``);
  sections.push("");

  if (feature.whyNow) {
    sections.push(`## Why This Feature`);
    sections.push(feature.whyNow);
    sections.push("");
  }

  if (feature.evidence && feature.evidence.length > 0) {
    sections.push(`## Evidence & User Feedback`);
    feature.evidence.forEach((e, i) => {
      sections.push(`${i + 1}. ${e}`);
    });
    sections.push("");
  }

  const hasChanges = feature.uiChanges || feature.dataModelChanges || feature.workflowChanges;
  if (hasChanges) {
    sections.push(`## Implementation Scope`);
    sections.push("");

    if (feature.uiChanges) {
      sections.push(`### UI Changes`);
      sections.push(feature.uiChanges);
      sections.push("");
    }

    if (feature.dataModelChanges) {
      sections.push(`### Data Model Changes`);
      sections.push(feature.dataModelChanges);
      sections.push("");
    }

    if (feature.workflowChanges) {
      sections.push(`### Workflow Changes`);
      sections.push(feature.workflowChanges);
      sections.push("");
    }
  }

  const taskList = formatTasksDetailed(feature.tasks);
  if (taskList) {
    sections.push(`## Tasks`);
    sections.push(taskList);
    sections.push("");
  }

  const criteria = deriveAcceptanceCriteria(feature);
  sections.push(`## Acceptance Criteria`);
  criteria.forEach((c, i) => {
    sections.push(`${i + 1}. ${c}`);
  });
  sections.push("");

  return sections.join("\n");
}

function generateClaudeCodePrompt(feature: FeatureData): string {
  const core = buildCorePrompt(feature);

  const fileChanges: string[] = [];
  if (feature.dataModelChanges) {
    fileChanges.push(`- \`shared/schema.ts\`: Add/modify table definitions, insert schemas, and types`);
    fileChanges.push(`- \`server/storage.ts\`: Add new methods to IStorage interface`);
    fileChanges.push(`- \`server/database-storage.ts\`: Implement new storage methods`);
  }
  fileChanges.push(`- \`server/routes.ts\`: Add new API endpoints with authentication middleware`);
  if (feature.uiChanges) {
    fileChanges.push(`- \`client/src/pages/\`: Create or modify page components`);
    fileChanges.push(`- \`client/src/components/\`: Create or modify feature-specific components`);
    fileChanges.push(`- \`client/src/App.tsx\`: Register new routes (lazy-loaded)`);
  }

  return [
    `# Implementation Spec: ${feature.featureTitle}`,
    ``,
    core,
    `## Project Directory Layout`,
    `\`\`\``,
    `├── shared/`,
    `│   └── schema.ts              # Drizzle ORM schema, Zod insert schemas, TypeScript types`,
    `├── server/`,
    `│   ├── routes.ts              # Express API routes with isAuthenticated middleware`,
    `│   ├── storage.ts             # IStorage interface`,
    `│   ├── database-storage.ts    # DatabaseStorage implementation`,
    `│   └── services/              # AI and integration services`,
    `├── client/src/`,
    `│   ├── App.tsx                # Route registration (wouter, lazy-loaded)`,
    `│   ├── pages/                 # Page components`,
    `│   ├── components/            # Feature-organized components`,
    `│   │   └── ui/                # shadcn/ui primitives`,
    `│   ├── hooks/                 # Custom hooks (useAuth, useToast, etc.)`,
    `│   └── lib/                   # Utilities (queryClient, api, utils)`,
    `└── drizzle.config.ts          # DO NOT MODIFY`,
    `\`\`\``,
    ``,
    `## File-by-File Changes Required`,
    fileChanges.join("\n"),
    ``,
    `## Implementation Instructions`,
    ``,
    `### Workflow`,
    `1. Review existing code patterns before making changes`,
    `2. Implement schema changes first, then storage, then routes, then frontend`,
    `3. Make atomic commits for each logical change with clear commit messages`,
    `4. Run the dev server (\`npm run dev\`) to verify changes compile and work`,
    `5. Test the feature end-to-end before marking complete`,
    ``,
    `### Architecture Considerations`,
    `- Follow existing patterns in the codebase for consistency`,
    `- Use dependency injection through the storage interface`,
    `- Keep routes thin — business logic belongs in the storage/service layer`,
    `- Prefer composition over inheritance for component design`,
    ``,
    `### Tech Stack Details`,
    `- **ORM**: Drizzle ORM with PostgreSQL. Schema in \`shared/schema.ts\`. Use \`createInsertSchema\` from \`drizzle-zod\` for validation`,
    `- **Frontend routing**: wouter (NOT react-router). Use \`Link\` component and \`useLocation\` hook`,
    `- **Data fetching**: TanStack Query v5 (object form only). Default fetcher is pre-configured. Mutations use \`apiRequest\` from \`client/src/lib/queryClient.ts\``,
    `- **Forms**: React Hook Form + Zod resolvers. Use shadcn \`Form\` component from \`@/components/ui/form\``,
    `- **Styling**: Tailwind CSS + shadcn/ui. Use \`@/\` imports for components. Icons from \`lucide-react\``,
    `- **Auth**: Session-based. Routes use \`isAuthenticated\` middleware. Frontend uses \`useAuth\` hook`,
    ``,
    `### Protected Files (DO NOT MODIFY)`,
    `- \`vite.config.ts\``,
    `- \`package.json\``,
    `- \`drizzle.config.ts\``,
  ].join("\n");
}

function generateCursorPrompt(feature: FeatureData): string {
  const core = buildCorePrompt(feature);

  const fileRefs: string[] = [];
  if (feature.dataModelChanges) {
    fileRefs.push(`@shared/schema.ts`, `@server/storage.ts`, `@server/database-storage.ts`);
  }
  fileRefs.push(`@server/routes.ts`);
  if (feature.uiChanges) {
    fileRefs.push(`@client/src/App.tsx`);
  }

  return [
    `@codebase`,
    ``,
    `# Implement Feature: ${feature.featureTitle}`,
    ``,
    `## Key Files to Reference`,
    fileRefs.map(f => `- ${f}`).join("\n"),
    ``,
    core,
    `## Step-by-Step Implementation Order`,
    ``,
    `### Step 1: Schema & Types`,
    `Edit @shared/schema.ts:`,
    `- Define any new Drizzle ORM tables using \`pgTable\``,
    `- Create insert schema: \`createInsertSchema(tableName).omit({ id: true, createdAt: true })\``,
    `- Export insert type: \`z.infer<typeof insertSchema>\``,
    `- Export select type: \`typeof table.$inferSelect\``,
    ``,
    `### Step 2: Storage Layer`,
    `Edit @server/storage.ts — add new methods to the \`IStorage\` interface`,
    `Edit @server/database-storage.ts — implement the methods in \`DatabaseStorage\``,
    ``,
    `### Step 3: API Routes`,
    `Edit @server/routes.ts:`,
    `- Add endpoints with \`isAuthenticated\` middleware`,
    `- Validate request bodies using Zod schemas from @shared/schema.ts`,
    `- Use the storage interface for all CRUD operations`,
    ``,
    `### Step 4: Frontend`,
    `- Create page component in \`client/src/pages/\``,
    `- Register route in @client/src/App.tsx (lazy-loaded with \`React.lazy\`)`,
    `- Use TanStack Query v5 object syntax: \`useQuery({ queryKey: ['/api/...'] })\``,
    `- Mutations: \`useMutation\` with \`apiRequest\` from @client/src/lib/queryClient.ts`,
    `- Invalidate cache after mutations: \`queryClient.invalidateQueries({ queryKey: [...] })\``,
    `- Use shadcn components from \`@/components/ui/\``,
    `- Use wouter for navigation (\`Link\`, \`useLocation\`)`,
    ``,
    `## Cursor-Specific Tips`,
    `- Open the referenced files in tabs before starting for best @file resolution`,
    `- Use Composer for multi-file edits — it handles coordination automatically`,
    `- Break large changes into smaller, focused prompts for better accuracy`,
    ``,
    `## Cursor Rules`,
    `- DO NOT modify: \`vite.config.ts\`, \`package.json\`, \`drizzle.config.ts\``,
    `- Use \`@/\` imports for shadcn components`,
    `- Do NOT import React explicitly (Vite JSX transform handles it)`,
    `- Use \`lucide-react\` for icons`,
    `- Toast via \`useToast\` from \`@/hooks/use-toast\``,
    `- Responsive design with Tailwind breakpoints (sm, md, lg, xl)`,
  ].join("\n");
}

function generateLovablePrompt(feature: FeatureData): string {
  const sections: string[] = [];

  sections.push(`# Build Feature: ${feature.featureTitle}`);
  sections.push("");

  if (feature.projectContext) {
    const ctx = feature.projectContext;
    if (ctx.projectName) {
      sections.push(`This feature is for **${ctx.projectName}**${ctx.projectDescription ? ` — ${ctx.projectDescription}` : ""}.`);
      sections.push("");
    }
  }

  if (feature.whyNow) {
    sections.push(`## Purpose`);
    sections.push(feature.whyNow);
    sections.push("");
  }

  if (feature.evidence && feature.evidence.length > 0) {
    sections.push(`## User Needs`);
    feature.evidence.forEach((e) => {
      sections.push(`- ${e}`);
    });
    sections.push("");
  }

  if (feature.uiChanges) {
    sections.push(`## Visual Design & Components`);
    sections.push(feature.uiChanges);
    sections.push("");
    sections.push(`### Design Requirements`);
    sections.push(`- Create clean, modern UI components with consistent spacing and typography`);
    sections.push(`- Ensure fully responsive layout: mobile-first, adapting gracefully to tablet and desktop`);
    sections.push(`- Use a card-based layout where appropriate for content organization`);
    sections.push(`- Include loading states, empty states, and error states for all data-driven views`);
    sections.push(`- Use subtle animations and transitions for interactive elements`);
    sections.push(`- Pay attention to visual hierarchy: headings, subtext, icons, badges`);
    sections.push("");
  }

  if (feature.workflowChanges) {
    sections.push(`## User Interactions & Flows`);
    sections.push(feature.workflowChanges);
    sections.push("");
    sections.push(`### Interaction Details`);
    sections.push(`- Provide clear visual feedback for all user actions (button states, toasts, confirmations)`);
    sections.push(`- Support keyboard navigation and accessibility best practices`);
    sections.push(`- Include form validation with inline error messages`);
    sections.push(`- Use micro-interactions for delight (hover effects, transitions, success states)`);
    sections.push("");
  }

  if (feature.dataModelChanges) {
    sections.push(`## Data & State Management`);
    sections.push(feature.dataModelChanges);
    sections.push("");
  }

  if (Array.isArray(feature.tasks) && feature.tasks.length > 0) {
    sections.push(`## Component Breakdown`);
    feature.tasks.forEach((t: any, i: number) => {
      const name = t.name || t.title || t;
      const desc = t.description ? ` — ${t.description}` : "";
      sections.push(`${i + 1}. **${name}**${desc}`);
    });
    sections.push("");
  }

  const criteria = deriveAcceptanceCriteria(feature);
  sections.push(`## Success Criteria`);
  criteria.forEach((c, i) => {
    sections.push(`${i + 1}. ${c}`);
  });
  sections.push("");

  sections.push(`## Style Notes`);
  sections.push(`- Use a clean, professional design language with consistent color palette`);
  sections.push(`- Prefer shadcn/ui components for forms, dialogs, cards, and navigation`);
  sections.push(`- Use Tailwind CSS utility classes for layout and spacing`);
  sections.push(`- Icons from lucide-react for action indicators and visual hierarchy`);
  sections.push(`- Ensure the design feels polished and production-ready, not prototype-quality`);

  return sections.join("\n");
}

export function generateAgentPrompt(feature: FeatureData, agent: CodingAgent): string {
  switch (agent) {
    case "claude-code":
      return generateClaudeCodePrompt(feature);
    case "cursor":
      return generateCursorPrompt(feature);
    case "lovable":
      return generateLovablePrompt(feature);
  }
}

export function generateBatchAgentPrompt(features: FeatureData[], agent: CodingAgent): string {
  const header = `# Batch Implementation: ${features.length} Features\n\nImplement the following ${features.length} features in order of priority.\n\n---\n\n`;
  const featurePrompts = features.map((f, i) => {
    const prompt = generateAgentPrompt(f, agent);
    return `## Feature ${i + 1} of ${features.length}\n\n${prompt}`;
  });
  return header + featurePrompts.join("\n\n---\n\n");
}
