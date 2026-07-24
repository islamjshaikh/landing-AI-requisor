import { db } from "./db";
import { users, projects, tasks, insights, integrations, subscriptionPlans, features, conversations } from "@shared/schema";
import { MemStorage } from "./storage";
import { seedAiTools } from "./ai-tools-seed";
import * as bcrypt from "bcryptjs";

async function seedData() {
  if (!process.env.DATABASE_URL) {
    console.log("No DATABASE_URL provided, skipping database seeding.");
    console.log("Application will use in-memory storage instead.");
    return;
  }
  
  console.log("Seeding database with initial data...");
  
  try {
    // Check if there's already data in the users table
    const existingUsers = await db.select().from(users);
    if (existingUsers.length > 0) {
      console.log("Database already has data, skipping seed.");
      await ensureDemoAccount();
      return;
    }

    // First, create subscription plans
    const [freePlan] = await db.insert(subscriptionPlans).values({
      name: "Free",
      slug: "free",
      description: "Basic features for getting started",
      price: 0,
      currency: "USD",
      billingInterval: "month",
      features: ["basic_projects", "basic_ai"],
      maxUsers: 1,
      maxProjects: 1,
      isActive: true,
      sortOrder: 1
    }).returning();

    await db.insert(subscriptionPlans).values([
      {
        name: "Pro",
        slug: "pro",
        description: "For solo founders, freelancers, and small teams",
        price: 2900,
        currency: "USD",
        billingInterval: "month",
        features: ["unlimited_projects", "advanced_ai", "integrations", "team_collaboration"],
        maxUsers: 10,
        maxProjects: 50,
        isActive: true,
        sortOrder: 2
      },
      {
        name: "Business",
        slug: "business",
        description: "For growing teams and agencies",
        price: 9900,
        currency: "USD",
        billingInterval: "month",
        features: ["unlimited_projects", "advanced_ai", "integrations", "team_collaboration", "priority_support"],
        maxUsers: 50,
        maxProjects: 200,
        isActive: true,
        sortOrder: 3
      },
      {
        name: "Enterprise",
        slug: "enterprise",
        description: "For large organizations with custom needs",
        price: 29900,
        currency: "USD",
        billingInterval: "month",
        features: ["unlimited_projects", "advanced_ai", "integrations", "team_collaboration", "priority_support", "sso", "custom_integrations"],
        maxUsers: 500,
        maxProjects: 1000,
        isActive: true,
        sortOrder: 4
      }
    ]);

    console.log("Created subscription plans");
    
    // Insert demo user with proper plan reference
    const [user] = await db.insert(users).values({
      id: "demo1", // Provide a static ID for demo user
      username: "john.smith",
      email: "john.smith@example.com",
      firstName: "John",
      lastName: "Smith",
      bio: "Demo user for a project management app",
      profileImageUrl: "",
      planId: freePlan.id, // Reference the created free plan
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    console.log(`Created user: ${user.username}`);

    // Insert YC demo account
    const partnerPasswordHash = await bcrypt.hash("YC2026", 12);
    await db.insert(users).values({
      id: "demo-partner",
      username: "partner",
      email: "partner@yc.com",
      firstName: "YC",
      lastName: "Partner",
      password: partnerPasswordHash,
      authProvider: "email",
      emailVerified: true,
      planId: freePlan.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log("Created YC demo account: partner@yc.com");
    
    // Insert demo projects
    const projectsData = [
      {
        name: "Website Redesign",
        description: "Revamp company website with modern design",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: "active",
        progress: 45,
        totalTasks: 25,
        completedTasks: 12,
        icon: "globe",
        iconBg: "blue",
        ownerId: user.id,
        aiGenerated: true
      },
      {
        name: "Mobile App Development",
        description: "Create a new mobile app for customer engagement",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "active",
        progress: 25,
        totalTasks: 40,
        completedTasks: 10,
        icon: "smartphone",
        iconBg: "green",
        ownerId: user.id,
        aiGenerated: true
      },
      {
        name: "Data Analytics Dashboard",
        description: "Build analytics dashboard for business intelligence",
        dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        status: "active",
        progress: 15,
        totalTasks: 35,
        completedTasks: 5,
        icon: "pie-chart",
        iconBg: "purple",
        ownerId: user.id,
        aiGenerated: false
      }
    ];
    
    const insertedProjects = await db.insert(projects).values(projectsData).returning();
    console.log(`Created ${insertedProjects.length} projects`);
    
    // Insert demo tasks
    const tasksData = [
      {
        name: "Design homepage wireframe",
        description: "Create wireframes for the new homepage",
        status: "done",
        priority: "high",
        projectId: insertedProjects[0].id,
        assigneeId: user.id
      },
      {
        name: "Implement landing page",
        description: "Build the new landing page with HTML/CSS",
        status: "in-progress",
        priority: "medium",
        projectId: insertedProjects[0].id,
        assigneeId: user.id
      },
      {
        name: "Setup mobile app architecture",
        description: "Define the app architecture and technology stack",
        status: "done",
        priority: "high",
        projectId: insertedProjects[1].id,
        assigneeId: user.id
      },
      {
        name: "Design database schema",
        description: "Create the database schema for the analytics platform",
        status: "todo",
        priority: "medium",
        projectId: insertedProjects[2].id,
        assigneeId: user.id
      }
    ];
    
    const insertedTasks = await db.insert(tasks).values(tasksData).returning();
    console.log(`Created ${insertedTasks.length} tasks`);
    
    // Insert demo integration
    const [integration] = await db.insert(integrations).values({
      userId: user.id,
      provider: "smartsheet",
      accessToken: "demo_access_token",
      refreshToken: "demo_refresh_token",
      tokenExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isConnected: true,
      lastSynced: new Date(),
      workspaceId: "demo_workspace",
      additionalData: {}
    }).returning();
    
    console.log(`Created integration for provider: ${integration.provider}`);
    
    // Insert demo insights
    const insightsData = [
      {
        type: "resource-conflict",
        title: "Resource Conflict Detected",
        description: "Development team is overallocated by 15% in the next sprint.",
        severity: "warning",
        projectId: insertedProjects[1].id,
        suggestedAction: "Redistribute tasks or extend timeline",
        isResolved: false,
        resolvedAt: null
      },
      {
        type: "timeline-risk",
        title: "Project Optimization",
        description: "Resequencing 3 tasks could reduce project timeline by 5 days.",
        severity: "info",
        projectId: insertedProjects[0].id,
        suggestedAction: "Review task dependencies and resequence",
        isResolved: false,
        resolvedAt: null
      },
      {
        type: "on-track",
        title: "On-Track Projects",
        description: "6 of 8 projects are progressing as planned with no critical issues.",
        severity: "info",
        projectId: null,
        suggestedAction: "Continue monitoring",
        isResolved: false,
        resolvedAt: null
      }
    ];
    
    const insertedInsights = await db.insert(insights).values(insightsData).returning();
    console.log(`Created ${insertedInsights.length} insights`);
    
    // Seed AI Tools data
    console.log("Seeding AI tools data...");
    await seedAiTools();
    console.log("AI tools seeding completed.");
    
    console.log("Database seeding completed successfully.");
  } catch (error) {
    console.error("Error seeding database:", error);
    console.log("Application will continue with existing data or in-memory storage.");
  }

  if (process.env.NODE_ENV !== "production") {
    await ensureDemoAccount();
  }
}

async function ensureDemoAccount() {
  try {
    const { eq } = await import("drizzle-orm");
    const existing = await db.select().from(users).where(eq(users.email, "partner@yc.com"));
    if (existing.length > 0) {
      const hashedPassword = await bcrypt.hash("YC2026", 12);
      await db.update(users).set({ 
        password: hashedPassword, 
        emailVerified: true,
        authProvider: "email"
      }).where(eq(users.email, "partner@yc.com"));
      const verify = await bcrypt.compare("YC2026", hashedPassword);
      console.log(`YC demo account synced: partner@yc.com (id=${existing[0].id}, emailVerified=true, hashVerify=${verify})`);
      await ensureDemoConversations(existing[0].id);
      return;
    }
    const hashedPassword = await bcrypt.hash("YC2026", 12);
    await db.insert(users).values({
      id: "demo-partner",
      username: "partner",
      email: "partner@yc.com",
      firstName: "YC",
      lastName: "Partner",
      password: hashedPassword,
      authProvider: "email",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log("Created YC demo account: partner@yc.com");
    await ensureDemoConversations("demo-partner");
  } catch (error) {
    console.error("Error ensuring demo account:", error);
  }
}

async function ensureDemoConversations(userId: string) {
  try {
    const { eq } = await import("drizzle-orm");
    const existing = await db.select().from(conversations).where(eq(conversations.userId, userId));
    if (existing.length > 0) {
      console.log(`Demo conversations already exist for ${userId}, skipping.`);
      return;
    }
    await db.insert(conversations).values([
      {
        userId,
        title: "Product Strategy Meeting - Q1 2026",
        source: "manual",
        content: "Discussion about Q1 priorities. Team agreed to focus on user onboarding improvements and AI-powered feature discovery. Key pain points: users struggle to find relevant features, onboarding flow has 40% drop-off at step 3. Action items: redesign onboarding wizard, add contextual feature suggestions, implement usage analytics dashboard.",
        summary: "Q1 strategy focused on onboarding improvements and AI feature discovery. 40% drop-off at step 3 identified as critical issue.",
        participants: ["Product Lead", "Engineering Manager", "Designer"],
        tags: ["strategy", "q1-2026", "onboarding"],
      },
      {
        userId,
        title: "Customer Interview - Enterprise Client Feedback",
        source: "manual",
        content: "Interview with enterprise client (500+ seat deployment). They love the AI planning features but need better team collaboration tools. Specifically requested: shared project views, role-based access, audit trails, and SSO integration. Budget approved for premium tier. Timeline: want these features within 2 months. Competitor comparison: they evaluated Jira and Linear but chose us for AI capabilities.",
        summary: "Enterprise client needs collaboration features: shared views, RBAC, audit trails, SSO. Budget approved, 2-month timeline.",
        participants: ["Account Executive", "Customer Success", "Enterprise Client PM"],
        tags: ["customer-interview", "enterprise", "collaboration"],
      },
      {
        userId,
        title: "Sprint Retrospective - Team Velocity Review",
        source: "manual",
        content: "Sprint 12 retrospective. Velocity improved 15% after adopting AI-assisted task breakdown. Team feedback: the AI feature suggestions are saving 2-3 hours per sprint planning session. Areas for improvement: need better integration with existing project management tools (Jira, Asana). Bug reports down 20% since implementing automated testing suggestions. Next sprint focus: API integrations and export functionality.",
        summary: "Sprint velocity up 15% with AI task breakdown. Team saves 2-3hrs per sprint planning. Focus next on PM tool integrations.",
        participants: ["Scrum Master", "Dev Team", "QA Lead"],
        tags: ["retrospective", "sprint-12", "velocity"],
      },
    ]);
    console.log(`Created demo conversations for ${userId}`);
  } catch (error) {
    console.error("Error creating demo conversations:", error);
  }
}

export { seedData };