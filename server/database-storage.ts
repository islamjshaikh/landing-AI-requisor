import {
  users,
  type User,
  type InsertUser,
  projects,
  type Project,
  type InsertProject,
  tasks,
  type Task,
  type InsertTask,
  integrations,
  type Integration,
  type InsertIntegration,
  insights,
  type Insight,
  type InsertInsight,
  projectMembers,
  type ProjectMember,
  type InsertProjectMember,
  projectInvitations,
  type ProjectInvitation,
  type InsertProjectInvitation,
  kanbanColumns,
  type KanbanColumn,
  type InsertKanbanColumn,
  teamMembers,
  type TeamMember,
  type InsertTeamMember,
  smartTaskAssignments,
  type SmartTaskAssignment,
  type InsertSmartTaskAssignment,
  capacityAlerts,
  type CapacityAlert,
  type InsertCapacityAlert,
  chatSessions,
  chatMessages,
  projectPlans,
  ProjectRole,
  teamProfiles,
  type TeamProfile,
  type InsertTeamProfile,
  teamAvailability,
  type TeamAvailability,
  type InsertTeamAvailability,
  taskAssignments,
  type TaskAssignment,
  type InsertTaskAssignment,
  rgaCategories,
  type RgaCategory,
  type InsertRgaCategory,
  rgaSettings,
  type RgaSettings,
  type InsertRgaSettings,
  rgaReports,
  type RgaReport,
  type InsertRgaReport,
  jiraIntegrations,
  type JiraIntegration,
  type InsertJiraIntegration,
  userStories,
  type UserStory,
  type InsertUserStory,
  storyEstimations,
  type StoryEstimation,
  type InsertStoryEstimation,
  jiraSyncLogs,
  type JiraSyncLog,
  type InsertJiraSyncLog,
  socialMediaAccounts,
  type SocialMediaAccount,
  type InsertSocialMediaAccount,
  socialMediaGoals,
  type SocialMediaGoal,
  type InsertSocialMediaGoal,
  socialMediaBrandProfiles,
  type SocialMediaBrandProfile,
  type InsertSocialMediaBrandProfile,
  socialMediaPosts,
  type SocialMediaPost,
  type InsertSocialMediaPost,
  scheduledSocialPosts,
  type ScheduledSocialPost,
  type InsertScheduledSocialPost,
  completedSocialPosts,
  type CompletedSocialPost,
  type InsertCompletedSocialPost,
  socialMediaPostMetrics,
  type SocialMediaPostMetrics,
  type InsertSocialMediaPostMetrics,
  socialMediaContentTemplates,
  type SocialMediaContentTemplate,
  type InsertSocialMediaContentTemplate,
  passwordResetTokens,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  aiAgents,
  type AiAgent,
  type InsertAiAgent,
  subscriptionPlans,
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
  features,
  type Feature,
  type InsertFeature,
  taskPriorityScores,
  type TaskPriorityScore,
  type InsertTaskPriorityScore,
  priorityWeightingPreferences,
  type PriorityWeightingPreference,
  type InsertPriorityWeightingPreference,
  budgetEstimates,
  type BudgetEstimate,
  type InsertBudgetEstimate,
  budgetLineItems,
  type BudgetLineItem,
  type InsertBudgetLineItem,
  forms,
  type Form,
  type InsertForm,
  formSubmissions,
  type FormSubmission,
  type InsertFormSubmission,
  taskComments,
  type TaskComment,
  type InsertTaskComment,
  taskAttachments,
  type TaskAttachment,
  type InsertTaskAttachment,
  featureCandidates,
  type FeatureCandidate,
  type InsertFeatureCandidate,
  conversations,
  type Conversation,
  type InsertConversation,
  evidenceItems,
  type EvidenceItem,
  type InsertEvidenceItem,
  teamsMeetings,
  type TeamsMeeting,
  type InsertTeamsMeeting,
  googleMeetMeetings,
  type GoogleMeetMeeting,
  type InsertGoogleMeetMeeting,
  zoomMeetings,
  type ZoomMeeting,
  type InsertZoomMeeting,
  themes,
  type Theme,
  type InsertTheme,
  themeMentions,
  type ThemeMention,
  type InsertThemeMention,
  customerTiers,
  type CustomerTier,
  type InsertCustomerTier,
  meetingIntelligenceDocuments,
} from "@shared/schema";
import { db } from "./db";
import {
  eq,
  desc,
  and,
  sql,
  asc,
  ne,
  lte,
  ilike,
  inArray,
  gte,
  gt,
  lt,
  isNull,
  isNotNull,
  not,
  or,
} from "drizzle-orm";

import type { IStorage } from "./storage";

// META helpers (row shapes we upsert/read) - matching IStorage interface
type MetaUserTokenRow = {
  userId: string;
  provider: "meta";
  providerAccountType: "meta_user";
  accountId: string;
  displayName: string;
  accessToken: string;
  tokenExpiresAt?: Date | null;
  scopes?: string[] | null;
};

type MetaPageRow = {
  userId: string;
  provider: "meta";
  providerAccountType: "facebook_page";
  accountId: string;
  displayName: string;
  accessToken: string;
};

type MetaIgRow = {
  userId: string;
  provider: "meta";
  providerAccountType: "instagram";
  accountId: string;
  displayName: string;
  linkedPageId?: string | null;
};

export class DatabaseStorage implements IStorage {
  // === META: upsert long-lived user token ===
  async upsertMetaUserToken(row: MetaUserTokenRow) {
    const [rec] = await db
      .insert(socialMediaAccounts)
      .values({
        userId: row.userId,
        platform: "meta",
        accountName: row.displayName,
        accountId: row.accountId,
        accessToken: row.accessToken,
        tokenExpiresAt: row.tokenExpiresAt ?? null,
      })
      .onConflictDoUpdate({
        target: [socialMediaAccounts.userId, socialMediaAccounts.accountId],
        set: {
          accountName: row.displayName,
          accessToken: row.accessToken,
          tokenExpiresAt: row.tokenExpiresAt ?? null,
        },
      })
      .returning();
    return rec;
  }

  // === META: upsert Facebook Page + page token ===
  async upsertMetaPage(row: MetaPageRow) {
    const [rec] = await db
      .insert(socialMediaAccounts)
      .values({
        userId: row.userId,
        platform: "facebook",
        accountName: row.displayName,
        accountId: row.accountId,
        accessToken: row.accessToken,
      })
      .onConflictDoUpdate({
        target: [socialMediaAccounts.userId, socialMediaAccounts.accountId],
        set: {
          accountName: row.displayName,
          accessToken: row.accessToken,
        },
      })
      .returning();
    return rec;
  }

  // === META: upsert Instagram Business/Creator account (no token) ===
  async upsertMetaIg(row: MetaIgRow) {
    const [rec] = await db
      .insert(socialMediaAccounts)
      .values({
        userId: row.userId,
        platform: "instagram",
        accountName: row.displayName,
        accountId: row.accountId,
      })
      .onConflictDoUpdate({
        target: [socialMediaAccounts.userId, socialMediaAccounts.accountId],
        set: {
          accountName: row.displayName,
        },
      })
      .returning();
    return rec;
  }

  // === META: list pages for current user ===
  async listMetaPages(userId: string) {
    return await db
      .select()
      .from(socialMediaAccounts)
      .where(
        and(
          eq(socialMediaAccounts.userId, userId),
          eq(socialMediaAccounts.platform, "facebook"),
        ),
      );
  }

  // === META: list IG accounts for current user ===
  async listMetaIgAccounts(userId: string) {
    return await db
      .select()
      .from(socialMediaAccounts)
      .where(
        and(
          eq(socialMediaAccounts.userId, userId),
          eq(socialMediaAccounts.platform, "instagram"),
        ),
      );
  }
  // At "Stub implementations for other methods"
  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getRecentProjects(limit: number): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt))
      .limit(limit);
  }

  async getTaskPriorityScores(taskIds: number[]): Promise<TaskPriorityScore[]> {
    if (taskIds.length === 0) return [];
    return await db
      .select()
      .from(taskPriorityScores)
      .where(inArray(taskPriorityScores.taskId, taskIds));
  }

  // === META: get page token for a user's page ===
  async getMetaPageToken(userId: string, pageId: string) {
    const [row] = await db
      .select()
      .from(socialMediaAccounts)
      .where(
        and(
          eq(socialMediaAccounts.userId, userId),
          eq(socialMediaAccounts.platform, "facebook"),
          eq(socialMediaAccounts.accountId, pageId),
        ),
      );
    return row?.accessToken || null;
  }

  // === META: get long-lived user token row ===
  async getMetaUserToken(userId: string) {
    const [row] = await db
      .select()
      .from(socialMediaAccounts)
      .where(
        and(
          eq(socialMediaAccounts.userId, userId),
          eq(socialMediaAccounts.platform, "meta"),
        ),
      );
    return row || null;
  }

  // User methods
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.createdAt));
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async upsertUser(user: InsertUser & { id: string }): Promise<User> {
    const [upsertedUser] = await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...user,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upsertedUser;
  }

  async updateUserPassword(
    userId: string,
    hashedPassword: string,
  ): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  // Password Reset Token methods
  async getPasswordResetToken(
    token: string,
  ): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return resetToken;
  }

  async createPasswordResetToken(
    tokenData: InsertPasswordResetToken,
  ): Promise<PasswordResetToken> {
    const [newToken] = await db
      .insert(passwordResetTokens)
      .values(tokenData)
      .returning();
    return newToken;
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));
  }

  // Subscription methods
  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(asc(subscriptionPlans.sortOrder));
  }

  async getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, id));
    return plan;
  }

  async getSubscriptionPlanBySlug(
    slug: string,
  ): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.slug, slug));
    return plan;
  }

  async createSubscriptionPlan(
    plan: InsertSubscriptionPlan,
  ): Promise<SubscriptionPlan> {
    const [newPlan] = await db
      .insert(subscriptionPlans)
      .values(plan)
      .returning();
    return newPlan;
  }

  async updateSubscriptionPlan(
    id: number,
    plan: Partial<SubscriptionPlan>,
  ): Promise<SubscriptionPlan> {
    const [updatedPlan] = await db
      .update(subscriptionPlans)
      .set({ ...plan, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return updatedPlan;
  }

  async deleteSubscriptionPlan(id: number): Promise<void> {
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
  }

  // Feature methods
  async getAllFeatures(): Promise<Feature[]> {
    return await db
      .select()
      .from(features)
      .where(eq(features.isActive, true))
      .orderBy(asc(features.category), asc(features.name));
  }

  async getFeature(id: number): Promise<Feature | undefined> {
    const [feature] = await db
      .select()
      .from(features)
      .where(eq(features.id, id));
    return feature;
  }

  async getFeatureBySlug(slug: string): Promise<Feature | undefined> {
    const [feature] = await db
      .select()
      .from(features)
      .where(eq(features.slug, slug));
    return feature;
  }

  async createFeature(feature: InsertFeature): Promise<Feature> {
    const [newFeature] = await db.insert(features).values(feature).returning();
    return newFeature;
  }

  async updateFeature(id: number, feature: Partial<Feature>): Promise<Feature> {
    const [updatedFeature] = await db
      .update(features)
      .set(feature)
      .where(eq(features.id, id))
      .returning();
    return updatedFeature;
  }

  async deleteFeature(id: number): Promise<void> {
    await db.delete(features).where(eq(features.id, id));
  }

  // User subscription methods
  async updateUserSubscription(
    userId: string,
    planId: number,
    stripeCustomerId?: string,
    stripeSubscriptionId?: string,
  ): Promise<User> {
    const updateData: any = {
      planId,
      updatedAt: new Date(),
    };

    if (stripeCustomerId) updateData.stripeCustomerId = stripeCustomerId;
    if (stripeSubscriptionId)
      updateData.stripeSubscriptionId = stripeSubscriptionId;

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async getUserWithPlan(
    userId: string,
  ): Promise<(User & { plan?: SubscriptionPlan }) | undefined> {
    const result = await db
      .select({
        user: users,
        plan: subscriptionPlans,
      })
      .from(users)
      .leftJoin(subscriptionPlans, eq(users.planId, subscriptionPlans.id))
      .where(eq(users.id, userId));

    if (result.length === 0) return undefined;

    const { user, plan } = result[0];
    return { ...user, plan: plan || undefined };
  }

  async checkUserFeatureAccess(
    userId: string,
    featureSlug: string,
  ): Promise<boolean> {
    const userWithPlan = await this.getUserWithPlan(userId);
    if (!userWithPlan || !userWithPlan.plan) return false;

    return userWithPlan.plan.features?.includes(featureSlug) || false;
  }

  // Project limit methods
  async getProjectCountForUser(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(projects)
      .where(eq(projects.ownerId, userId));

    return result[0]?.count || 0;
  }

  async getTeamMemberCountForProject(projectId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));

    return result[0]?.count || 0;
  }

  async canUserCreateProject(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    current: number;
    max: number;
  }> {
    const userWithPlan = await this.getUserWithPlan(userId);

    if (!userWithPlan) {
      return {
        allowed: false,
        reason: "User not found",
        current: 0,
        max: 0,
      };
    }

    // If user has no plan, assign them to Free plan (ID: 1) temporarily
    let maxProjects = 10; // default for free plan
    if (userWithPlan.plan) {
      maxProjects = userWithPlan.plan.maxProjects || 10;
    } else {
      // User has no plan, check the free plan
      const freePlan = await this.getSubscriptionPlan(1);
      maxProjects = freePlan?.maxProjects || 10;
    }

    // If maxProjects is -1, treat as unlimited
    if (maxProjects === -1) {
      const currentCount = await this.getProjectCountForUser(userId);
      return {
        allowed: true,
        current: currentCount,
        max: -1,
      };
    }

    const currentCount = await this.getProjectCountForUser(userId);

    if (currentCount >= maxProjects) {
      return {
        allowed: false,
        reason: `You have reached your project limit of ${maxProjects}. Please upgrade your plan to create more projects.`,
        current: currentCount,
        max: maxProjects,
      };
    }

    return {
      allowed: true,
      current: currentCount,
      max: maxProjects,
    };
  }

  async canUserAddTeamMember(
    projectId: number,
    userId: string,
  ): Promise<{
    allowed: boolean;
    reason?: string;
    current: number;
    max: number;
  }> {
    // Get the project owner
    const project = await this.getProject(projectId);
    if (!project) {
      return {
        allowed: false,
        reason: "Project not found",
        current: 0,
        max: 0,
      };
    }

    const userWithPlan = await this.getUserWithPlan(project.ownerId);

    if (!userWithPlan) {
      return {
        allowed: false,
        reason: "Project owner not found",
        current: 0,
        max: 0,
      };
    }

    // Get max users from plan
    let maxUsers = 1; // default for free plan
    if (userWithPlan.plan) {
      maxUsers = userWithPlan.plan.maxUsers || 1;
    } else {
      // User has no plan, check the free plan
      const freePlan = await this.getSubscriptionPlan(1);
      maxUsers = freePlan?.maxUsers || 1;
    }

    // If maxUsers is -1, treat as unlimited
    if (maxUsers === -1) {
      const currentCount = await this.getTeamMemberCountForProject(projectId);
      return {
        allowed: true,
        current: currentCount,
        max: -1,
      };
    }

    const currentCount = await this.getTeamMemberCountForProject(projectId);

    if (currentCount >= maxUsers) {
      return {
        allowed: false,
        reason: `You have reached your team member limit of ${maxUsers}. Please upgrade your plan to add more team members.`,
        current: currentCount,
        max: maxUsers,
      };
    }

    return {
      allowed: true,
      current: currentCount,
      max: maxUsers,
    };
  }

  // Stub implementations for other methods (to be implemented as needed)

  async getProjectsForUser(userId: string): Promise<Project[]> {
    // Get projects where user is the owner
    const ownedProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, userId))
      .orderBy(desc(projects.createdAt));

    // Get projects where user is a member (not owner)
    const memberProjects = await db
      .select({
        project: projects,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(
        and(
          eq(projectMembers.userId, userId),
          ne(projects.ownerId, userId), // Exclude projects where user is owner (already fetched)
        ),
      )
      .orderBy(desc(projects.createdAt));

    // Combine and return all projects
    const allProjects = [
      ...ownedProjects,
      ...memberProjects.map((pm) => pm.project),
    ].sort((a, b) => {
      // Prioritize lastOpenedAt, then updatedAt, then createdAt
      const dateA = a.lastOpenedAt || a.updatedAt || a.createdAt;
      const dateB = b.lastOpenedAt || b.updatedAt || b.createdAt;

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return new Date(dateB).getTime() - new Date(dateA).getTime(); // Sort by most recent first
    });

    return allProjects;
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    return project;
  }
  async createProject(project: InsertProject): Promise<Project> {
    // Convert dueDate string to Date object if provided
    const projectData = {
      ...project,
      dueDate: project.dueDate ? new Date(project.dueDate) : null,
    };

    const [newProject] = await db
      .insert(projects)
      .values(projectData)
      .returning();
    return newProject;
  }
  async updateProject(id: number, project: Partial<Project>): Promise<Project> {
    const [updatedProject] = await db
      .update(projects)
      .set(project)
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  }

  // Helper method to recalculate and update project completion counts
  async updateProjectCompletionCounts(projectId: number): Promise<void> {
    const allTasks = await this.getTasksByProjectId(projectId);
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(
      (task) => task.isCompleted === true || task.status === "done",
    ).length;

    // Update using the correct TypeScript field names
    await db
      .update(projects)
      .set({
        totalTasks: totalTasks,
        completedTasks: completedTasks,
      })
      .where(eq(projects.id, projectId));
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  // Project Member methods
  async getProjectMembers(projectId: number): Promise<ProjectMember[]> {
    return await db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));
  }
  async getProjectMember(
    projectId: number,
    userId: string,
  ): Promise<ProjectMember | undefined> {
    const [member] = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
        ),
      )
      .limit(1);
    return member;
  }
  async addProjectMember(member: InsertProjectMember): Promise<ProjectMember> {
    const { projectId, userId, role } = member;

    // Check if project exists
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project) {
      throw new Error("Project not found");
    }

    // Check if user exists
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if member already exists
    const existingMember = await this.getProjectMember(projectId, userId);
    if (existingMember) {
      // Update existing member's role instead of creating duplicate
      return await this.updateProjectMemberRole(projectId, userId, role);
    }

    // Create the project member
    const [newMember] = await db
      .insert(projectMembers)
      .values(member)
      .returning();
    return newMember;
  }
  async updateProjectMemberRole(
    projectId: number,
    userId: string,
    role: string,
  ): Promise<ProjectMember> {
    const [updatedMember] = await db
      .update(projectMembers)
      .set({ role })
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
        ),
      )
      .returning();
    return updatedMember;
  }
  async removeProjectMember(projectId: number, userId: string): Promise<void> {
    await db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
        ),
      );
  }
  async isUserAuthorized(
    projectId: number,
    userId: string,
    requiredRole?: string,
  ): Promise<boolean> {
    console.log(
      `[DEBUG] isUserAuthorized called with projectId: ${projectId}, userId: ${userId}, requiredRole: ${requiredRole}`,
    );

    // First, check if user is the owner of the project
    const project = await this.getProject(projectId);
    console.log(`[DEBUG] getProject result:`, project);
    console.log(
      `[DEBUG] project.ownerId: "${project?.ownerId}" (type: ${typeof project?.ownerId}), userId: "${userId}" (type: ${typeof userId})`,
    );
    console.log(
      `[DEBUG] Ownership check: ${project && project.ownerId === userId}`,
    );

    if (project && project.ownerId === userId) {
      // Project owner has all permissions
      console.log(
        `[DEBUG] User ${userId} is owner of project ${projectId}, returning true`,
      );
      return true;
    }

    // Check if user is a member of the project
    console.log(`[DEBUG] User is not owner, checking project membership...`);
    const member = await this.getProjectMember(projectId, userId);
    console.log(`[DEBUG] getProjectMember result:`, member);
    if (!member) {
      console.log(
        `[DEBUG] User ${userId} is not a member of project ${projectId}, returning false`,
      );
      return false;
    }

    // If no specific role required, just membership is enough
    if (!requiredRole) {
      return true;
    }

    // Check role hierarchy: owner > editor > viewer
    const roleHierarchy: { [key: string]: number } = {
      owner: 3,
      editor: 2,
      viewer: 1,
    };

    const memberRoleLevel = roleHierarchy[member.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    return memberRoleLevel >= requiredRoleLevel;
  }
  // Stub implementations for remaining methods - these would be implemented as needed
  async getProjectInvitations(projectId: number): Promise<ProjectInvitation[]> {
    const invitations = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.projectId, projectId))
      .orderBy(desc(projectInvitations.createdAt));
    return invitations;
  }
  async getProjectInvitation(
    id: number,
  ): Promise<ProjectInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.id, id));
    return invitation;
  }
  async getInvitationByToken(
    token: string,
  ): Promise<ProjectInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.token, token));
    return invitation;
  }
  async getInvitationsByEmail(email: string): Promise<ProjectInvitation[]> {
    const invitations = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.email, email))
      .orderBy(desc(projectInvitations.createdAt));
    return invitations;
  }
  async createProjectInvitation(
    invitation: InsertProjectInvitation,
  ): Promise<ProjectInvitation> {
    const [newInvitation] = await db
      .insert(projectInvitations)
      .values(invitation)
      .returning();
    return newInvitation;
  }
  async updateProjectInvitation(
    id: number,
    invitation: Partial<ProjectInvitation>,
  ): Promise<ProjectInvitation> {
    const [updatedInvitation] = await db
      .update(projectInvitations)
      .set(invitation)
      .where(eq(projectInvitations.id, id))
      .returning();
    return updatedInvitation;
  }
  async deleteProjectInvitation(id: number): Promise<void> {
    await db.delete(projectInvitations).where(eq(projectInvitations.id, id));
  }
  async acceptInvitation(
    token: string,
    userId: string,
  ): Promise<ProjectMember> {
    // Get the invitation by token
    const [invitation] = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.token, token))
      .limit(1);

    if (!invitation) {
      throw new Error("Invitation not found or expired");
    }

    if (invitation.status !== "pending") {
      throw new Error(`Invitation has already been ${invitation.status}`);
    }

    // Check if the invitation is expired
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      await db
        .update(projectInvitations)
        .set({ status: "expired" })
        .where(eq(projectInvitations.id, invitation.id));
      throw new Error("Invitation has expired");
    }

    // Check if user exists
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      throw new Error("User not found");
    }

    // Create project membership using the invitation details
    let member: ProjectMember;
    try {
      member = await this.addProjectMember({
        projectId: invitation.projectId,
        userId,
        role: invitation.role,
      });
    } catch (error: any) {
      throw new Error(`Failed to add user to project: ${error.message}`);
    }

    // Update invitation status
    await db
      .update(projectInvitations)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
      })
      .where(eq(projectInvitations.id, invitation.id));

    return member;
  }

  // Task methods - stub implementations
  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }
  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }
  async getTasksByProjectId(projectId: number): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(desc(tasks.createdAt));
  }
  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }
  async updateTask(id: number, task: Partial<Task>): Promise<Task> {
    // Get the existing task to check for completion status changes
    const existingTask = await this.getTask(id);
    if (!existingTask) {
      throw new Error(`Task with id ${id} not found`);
    }

    // Update the task
    const [updatedTask] = await db
      .update(tasks)
      .set(task)
      .where(eq(tasks.id, id))
      .returning();

    // Check if completion status changed (either via isCompleted field OR status field)
    const oldCompleted =
      existingTask.isCompleted || existingTask.status === "done";
    const newCompleted =
      updatedTask.isCompleted || updatedTask.status === "done";

    // If the task belongs to a project and completion status changed, update project counts
    if (updatedTask.projectId && oldCompleted !== newCompleted) {
      await this.updateProjectCompletionCounts(updatedTask.projectId);
    }

    return updatedTask;
  }
  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }
  async getSubtasks(parentTaskId: number): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.parentTaskId, parentTaskId))
      .orderBy(desc(tasks.createdAt));
  }

  // All other stub implementations
  async getAllIntegrations(): Promise<Integration[]> {
    return [];
  }
  async getIntegration(id: number): Promise<Integration | undefined> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, id));
    return integration;
  }
  async getIntegrationByProvider(
    userId: string,
    provider: string,
  ): Promise<Integration | undefined> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)));
    return integration;
  }
  async createIntegration(
    integration: InsertIntegration,
  ): Promise<Integration> {
    const [newIntegration] = await db
      .insert(integrations)
      .values(integration)
      .returning();
    return newIntegration;
  }
  async updateIntegration(
    id: number,
    integration: Partial<Integration>,
  ): Promise<Integration> {
    const [updatedIntegration] = await db
      .update(integrations)
      .set(integration)
      .where(eq(integrations.id, id))
      .returning();
    return updatedIntegration;
  }
  async deleteIntegration(id: number): Promise<void> {
    await db.delete(integrations).where(eq(integrations.id, id));
  }

  async getAllInsights(): Promise<Insight[]> {
    return [];
  }
  async getInsight(id: number): Promise<Insight | undefined> {
    return undefined;
  }
  async getInsightsByProjectId(projectId: number): Promise<Insight[]> {
    return [];
  }
  async createInsight(insight: InsertInsight): Promise<Insight> {
    const [newInsight] = await db.insert(insights).values(insight).returning();
    return newInsight;
  }
  async updateInsight(id: number, insight: Partial<Insight>): Promise<Insight> {
    const [updatedInsight] = await db
      .update(insights)
      .set(insight)
      .where(eq(insights.id, id))
      .returning();
    return updatedInsight;
  }
  async deleteInsight(id: number): Promise<void> {
    await db.delete(insights).where(eq(insights.id, id));
  }

  async getAllKanbanColumns(): Promise<KanbanColumn[]> {
    return [];
  }
  async getKanbanColumnById(id: number): Promise<KanbanColumn | undefined> {
    return undefined;
  }
  async getKanbanColumns(projectId: number): Promise<KanbanColumn[]> {
    return [];
  }
  async createKanbanColumn(column: InsertKanbanColumn): Promise<KanbanColumn> {
    const [newColumn] = await db
      .insert(kanbanColumns)
      .values(column)
      .returning();
    return newColumn;
  }
  async updateKanbanColumn(
    id: number,
    column: Partial<KanbanColumn>,
  ): Promise<KanbanColumn> {
    const [updatedColumn] = await db
      .update(kanbanColumns)
      .set(column)
      .where(eq(kanbanColumns.id, id))
      .returning();
    return updatedColumn;
  }
  async deleteKanbanColumn(id: number): Promise<void> {
    await db.delete(kanbanColumns).where(eq(kanbanColumns.id, id));
  }
  async getDefaultKanbanColumns(projectId: number): Promise<KanbanColumn[]> {
    return [];
  }

  // Chat methods
  async createChatSession(
    userId: string,
    projectId?: number,
  ): Promise<{ sessionId: string }> {
    const sessionId = crypto.randomUUID();
    await db.insert(chatSessions).values({
      userId,
      projectId,
      sessionId,
      title: "New Conversation",
    });
    return { sessionId };
  }

  async getChatSessions(userId: string): Promise<any[]> {
    return await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.createdAt));
  }

  async updateChatSessionTitle(sessionId: string, title: string): Promise<void> {
    await db
      .update(chatSessions)
      .set({ title })
      .where(eq(chatSessions.sessionId, sessionId));
  }

  async clearAllChatSessions(userId: string): Promise<void> {
    await db.delete(chatSessions).where(eq(chatSessions.userId, userId));
    // Messages cascade or handle separately if needed, but cascade is better
  }

  async getChatSession(sessionId: string): Promise<any> {
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId));
    return session;
  }

  async saveChatMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string,
    metadata?: any,
  ): Promise<void> {
    // Sanitize content to remove null bytes (0x00) which PostgreSQL doesn't accept
    let sanitizedContent = content.replace(/\x00/g, '');
    let insights = metadata?.insights ? JSON.stringify(metadata.insights) : null;

    // Zero-data-retention enforcement: own-key (Claude) users with the
    // zero-retention posture enabled must NOT have their raw prompts / AI
    // responses persisted by the app. We resolve the session's owner and, if
    // suppression applies, store a redaction placeholder (and drop raw insights)
    // instead of the real content. The conversation row still exists so the UI
    // does not break; only the sensitive body is withheld.
    //
    // This MUST fail SAFE: if we cannot determine the session owner or resolve
    // their config (missing session, transient DB error), we suppress the
    // content rather than risk persisting it for a zero-retention user.
    let suppress = false;
    try {
      const [session] = await db
        .select({ userId: chatSessions.userId })
        .from(chatSessions)
        .where(eq(chatSessions.sessionId, sessionId));
      if (session?.userId) {
        const { shouldSuppressAiRetention } = await import(
          "./services/ai-provider"
        );
        suppress = await shouldSuppressAiRetention(session.userId);
      } else {
        // Could not resolve the session owner -> cannot prove retention is
        // permitted. Fail safe.
        suppress = true;
      }
    } catch (err) {
      console.error("[zero-retention] saveChatMessage guard failed; failing safe (suppressing content):", err);
      suppress = true;
    }
    if (suppress) {
      sanitizedContent = "[content withheld — zero data retention enabled]";
      insights = null;
    }

    await db.insert(chatMessages).values({
      sessionId,
      role,
      content: sanitizedContent,
      insights,
      actions: metadata?.actions ? JSON.stringify(metadata.actions) : null,
      suggestedPrompts: metadata?.suggestedPrompts
        ? JSON.stringify(metadata.suggestedPrompts)
        : null,
    });
  }

  async getChatHistory(sessionId: string): Promise<any[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt));
  }

  async getUserChatSessions(userId: string): Promise<any[]> {
    return await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.updatedAt));
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    await db.delete(chatSessions).where(eq(chatSessions.sessionId, sessionId));
    // Messages also cascade if set up, or we manually delete:
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  }

  async deleteOldChatSessions(
    userId: string,
    keepCount: number,
  ): Promise<void> {
    // Implementation to keep only the last N sessions
    const sessions = await this.getUserChatSessions(userId);
    if (sessions.length <= keepCount) return;

    const sessionsToDelete = sessions.slice(keepCount);
    const sessionIdsToDelete = sessionsToDelete.map((s) => s.sessionId);

    if (sessionIdsToDelete.length > 0) {
      await db
        .delete(chatSessions)
        .where(inArray(chatSessions.sessionId, sessionIdsToDelete));
      // Messages will be deleted by cascade if configured, otherwise need manual deletion
      await db
        .delete(chatMessages)
        .where(inArray(chatMessages.sessionId, sessionIdsToDelete));
    }
  }

  // Remaining stub implementations for all other methods...
  async getAllTeamMembers(): Promise<TeamMember[]> {
    return [];
  }
  async getTeamMember(id: number): Promise<TeamMember | undefined> {
    return undefined;
  }
  async getTeamMembersByUser(userId: string): Promise<TeamMember[]> {
    return await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .orderBy(desc(teamMembers.createdAt));
  }
  async createTeamMember(teamMember: InsertTeamMember): Promise<TeamMember> {
    const [newTeamMember] = await db
      .insert(teamMembers)
      .values(teamMember)
      .returning();
    return newTeamMember;
  }
  async updateTeamMember(
    id: number,
    teamMember: Partial<TeamMember>,
  ): Promise<TeamMember> {
    const [updatedTeamMember] = await db
      .update(teamMembers)
      .set({ ...teamMember, updatedAt: new Date() })
      .where(eq(teamMembers.id, id))
      .returning();
    return updatedTeamMember;
  }
  async deleteTeamMember(id: number): Promise<void> { }

  async getAllSmartTaskAssignments(): Promise<SmartTaskAssignment[]> {
    return [];
  }
  async getSmartTaskAssignment(
    id: number,
  ): Promise<SmartTaskAssignment | undefined> {
    return undefined;
  }
  async getSmartTaskAssignmentsByTask(
    taskId: number,
  ): Promise<SmartTaskAssignment[]> {
    return [];
  }
  async createSmartTaskAssignment(
    assignment: InsertSmartTaskAssignment,
  ): Promise<SmartTaskAssignment> {
    throw new Error("Not implemented");
  }
  async updateSmartTaskAssignment(
    id: number,
    assignment: Partial<SmartTaskAssignment>,
  ): Promise<SmartTaskAssignment> {
    throw new Error("Not implemented");
  }
  async deleteSmartTaskAssignment(id: number): Promise<void> { }

  async getAllCapacityAlerts(): Promise<CapacityAlert[]> {
    return [];
  }
  async getCapacityAlert(id: number): Promise<CapacityAlert | undefined> {
    return undefined;
  }
  async getCapacityAlertsByTeamMember(
    teamMemberId: number,
  ): Promise<CapacityAlert[]> {
    return [];
  }
  async createCapacityAlert(
    alert: InsertCapacityAlert,
  ): Promise<CapacityAlert> {
    throw new Error("Not implemented");
  }
  async updateCapacityAlert(
    id: number,
    alert: Partial<CapacityAlert>,
  ): Promise<CapacityAlert> {
    throw new Error("Not implemented");
  }
  async deleteCapacityAlert(id: number): Promise<void> { }

  async getTeamProfile(userId: string): Promise<TeamProfile | undefined> {
    return undefined;
  }
  async createTeamProfile(profile: InsertTeamProfile): Promise<TeamProfile> {
    throw new Error("Not implemented");
  }
  async updateTeamProfile(
    userId: string,
    profile: Partial<TeamProfile>,
  ): Promise<TeamProfile> {
    throw new Error("Not implemented");
  }
  async deleteTeamProfile(userId: string): Promise<void> { }
  async getAllTeamProfiles(): Promise<TeamProfile[]> {
    return [];
  }

  async getTeamAvailability(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TeamAvailability[]> {
    return [];
  }
  async createTeamAvailability(
    availability: InsertTeamAvailability,
  ): Promise<TeamAvailability> {
    throw new Error("Not implemented");
  }
  async updateTeamAvailability(
    id: number,
    availability: Partial<TeamAvailability>,
  ): Promise<TeamAvailability> {
    throw new Error("Not implemented");
  }
  async deleteTeamAvailability(id: number): Promise<void> { }

  async getTaskAssignments(taskId: number): Promise<TaskAssignment[]> {
    return [];
  }
  async getTaskAssignmentsByUser(userId: string): Promise<TaskAssignment[]> {
    return [];
  }
  async createTaskAssignment(
    assignment: InsertTaskAssignment,
  ): Promise<TaskAssignment> {
    throw new Error("Not implemented");
  }
  async updateTaskAssignment(
    id: number,
    assignment: Partial<TaskAssignment>,
  ): Promise<TaskAssignment> {
    throw new Error("Not implemented");
  }
  async deleteTaskAssignment(id: number): Promise<void> { }
  async getActiveTaskAssignments(userId: string): Promise<TaskAssignment[]> {
    return [];
  }

  async getRgaCategory(taskId: number): Promise<RgaCategory | undefined> {
    return undefined;
  }
  async createRgaCategory(category: InsertRgaCategory): Promise<RgaCategory> {
    throw new Error("Not implemented");
  }
  async updateRgaCategory(
    id: number,
    category: Partial<RgaCategory>,
  ): Promise<RgaCategory> {
    throw new Error("Not implemented");
  }
  async getRgaSettings(userId: string): Promise<RgaSettings | undefined> {
    return undefined;
  }
  async createRgaSettings(settings: InsertRgaSettings): Promise<RgaSettings> {
    throw new Error("Not implemented");
  }
  async updateRgaSettings(
    id: number,
    settings: Partial<RgaSettings>,
  ): Promise<RgaSettings> {
    throw new Error("Not implemented");
  }
  async getRgaReports(userId: string, limit?: number): Promise<RgaReport[]> {
    return [];
  }
  async createRgaReport(report: InsertRgaReport): Promise<RgaReport> {
    throw new Error("Not implemented");
  }
  async getTasksByCategory(userId: string, category: string): Promise<Task[]> {
    return [];
  }
  async getTasksForUser(userId: string): Promise<Task[]> {
    return [];
  }

  async createJiraIntegration(
    integration: InsertJiraIntegration,
  ): Promise<JiraIntegration> {
    const [newIntegration] = await db
      .insert(jiraIntegrations)
      .values(integration)
      .returning();
    return newIntegration;
  }
  async getJiraIntegration(
    userId: string,
  ): Promise<JiraIntegration | undefined> {
    const [integration] = await db
      .select()
      .from(jiraIntegrations)
      .where(eq(jiraIntegrations.userId, userId));
    return integration;
  }
  async getJiraIntegrationById(
    id: number,
  ): Promise<JiraIntegration | undefined> {
    const [integration] = await db
      .select()
      .from(jiraIntegrations)
      .where(eq(jiraIntegrations.id, id));
    return integration;
  }
  async updateJiraIntegration(
    id: number,
    integration: Partial<InsertJiraIntegration>,
  ): Promise<JiraIntegration> {
    const [updatedIntegration] = await db
      .update(jiraIntegrations)
      .set({ ...integration, updatedAt: new Date() })
      .where(eq(jiraIntegrations.id, id))
      .returning();
    return updatedIntegration;
  }
  async deleteJiraIntegration(id: number): Promise<void> {
    await db.delete(jiraIntegrations).where(eq(jiraIntegrations.id, id));
  }

  async createUserStory(story: InsertUserStory): Promise<UserStory> {
    throw new Error("Not implemented");
  }
  async getUserStory(id: number): Promise<UserStory | undefined> {
    return undefined;
  }
  async getUserStoriesForProject(projectId: number): Promise<UserStory[]> {
    return [];
  }
  async updateUserStory(
    id: number,
    story: Partial<InsertUserStory>,
  ): Promise<UserStory> {
    throw new Error("Not implemented");
  }
  async deleteUserStory(id: number): Promise<void> { }

  async createStoryEstimation(
    estimation: InsertStoryEstimation,
  ): Promise<StoryEstimation> {
    throw new Error("Not implemented");
  }
  async getStoryEstimations(storyId: number): Promise<StoryEstimation[]> {
    return [];
  }

  async createJiraSyncLog(log: InsertJiraSyncLog): Promise<JiraSyncLog> {
    throw new Error("Not implemented");
  }
  async getJiraSyncLogs(integrationId: number): Promise<JiraSyncLog[]> {
    return [];
  }

  // Social Media methods
  async createSocialMediaAccount(
    account: InsertSocialMediaAccount,
  ): Promise<SocialMediaAccount> {
    // Check for existing account to prevent duplicates (since no unique constraint in schema)
    const existing = await db
      .select()
      .from(socialMediaAccounts)
      .where(
        and(
          eq(socialMediaAccounts.userId, account.userId),
          eq(socialMediaAccounts.platform, account.platform),
          account.accountId
            ? eq(socialMediaAccounts.accountId, account.accountId)
            : undefined,
        ),
      );

    if (existing.length > 0) {
      // Update the most recent one
      // Sort by ID desc (assuming higher ID = newer) or createdAt
      const sorted = existing.sort((a, b) => b.id - a.id);
      const target = sorted[0];

      // Preserve refresh token if not provided in update
      const refreshToken = account.refreshToken || target.refreshToken;

      const [updated] = await db
        .update(socialMediaAccounts)
        .set({ ...account, refreshToken, updatedAt: new Date() })
        .where(eq(socialMediaAccounts.id, target.id))
        .returning();

      // Delete older duplicates to clean up
      if (sorted.length > 1) {
        const idsToDelete = sorted.slice(1).map((a) => a.id);
        await db
          .delete(socialMediaAccounts)
          .where(inArray(socialMediaAccounts.id, idsToDelete));
      }

      return updated;
    }

    const [newAccount] = await db
      .insert(socialMediaAccounts)
      .values(account)
      .returning();
    return newAccount;
  }
  async getSocialMediaAccounts(userId: string): Promise<SocialMediaAccount[]> {
    return await db
      .select()
      .from(socialMediaAccounts)
      .where(eq(socialMediaAccounts.userId, userId))
      .orderBy(desc(socialMediaAccounts.id));
  }
  async getSocialMediaAccount(
    id: number,
  ): Promise<SocialMediaAccount | undefined> {
    const [account] = await db
      .select()
      .from(socialMediaAccounts)
      .where(eq(socialMediaAccounts.id, id));
    return account || undefined;
  }
  async updateSocialMediaAccount(
    id: number,
    account: Partial<SocialMediaAccount>,
  ): Promise<SocialMediaAccount> {
    const [updatedAccount] = await db
      .update(socialMediaAccounts)
      .set(account)
      .where(eq(socialMediaAccounts.id, id))
      .returning();
    return updatedAccount;
  }
  async deleteSocialMediaAccount(id: number): Promise<void> {
    await db.delete(socialMediaAccounts).where(eq(socialMediaAccounts.id, id));
  }

  async createSocialMediaGoal(
    goal: InsertSocialMediaGoal,
  ): Promise<SocialMediaGoal> {
    throw new Error("Not implemented");
  }
  async getSocialMediaGoals(userId: string): Promise<SocialMediaGoal[]> {
    return [];
  }
  async getSocialMediaGoal(id: number): Promise<SocialMediaGoal | undefined> {
    return undefined;
  }
  async updateSocialMediaGoal(
    id: number,
    goal: Partial<SocialMediaGoal>,
  ): Promise<SocialMediaGoal> {
    throw new Error("Not implemented");
  }
  async deleteSocialMediaGoal(id: number): Promise<void> { }

  async createSocialMediaBrandProfile(
    profile: InsertSocialMediaBrandProfile,
  ): Promise<SocialMediaBrandProfile> {
    throw new Error("Not implemented");
  }
  async getSocialMediaBrandProfiles(
    userId: string,
  ): Promise<SocialMediaBrandProfile[]> {
    return [];
  }
  async getSocialMediaBrandProfile(
    id: number,
  ): Promise<SocialMediaBrandProfile | undefined> {
    return undefined;
  }
  async updateSocialMediaBrandProfile(
    id: number,
    profile: Partial<SocialMediaBrandProfile>,
  ): Promise<SocialMediaBrandProfile> {
    throw new Error("Not implemented");
  }
  async deleteSocialMediaBrandProfile(id: number): Promise<void> { }

  async createSocialMediaPost(
    post: InsertSocialMediaPost,
  ): Promise<SocialMediaPost> {
    throw new Error("Not implemented");
  }
  async getSocialMediaPosts(userId: string): Promise<SocialMediaPost[]> {
    return [];
  }
  async getSocialMediaPost(id: number): Promise<SocialMediaPost | undefined> {
    return undefined;
  }
  async updateSocialMediaPost(
    id: number,
    post: Partial<SocialMediaPost>,
  ): Promise<SocialMediaPost> {
    throw new Error("Not implemented");
  }
  async deleteSocialMediaPost(id: number): Promise<void> { }
  async schedulePost(postData: {
    userId: string;
    content: string;
    platform: string;
    scheduledTime: Date;
    metadata: any;
    status: string;
  }): Promise<SocialMediaPost> {
    const [post] = await db
      .insert(socialMediaPosts)
      .values({
        userId: postData.userId,
        content: postData.content,
        platforms: [postData.platform],
        scheduledAt: postData.scheduledTime,
        status: postData.status,
      })
      .returning();
    return post;
  }

  async getScheduledPosts(userId: string): Promise<SocialMediaPost[]> {
    const posts = await db.select().from(socialMediaPosts);
    return posts;
  }

  // New methods for scheduled social posts cron system
  async createScheduledSocialPost(
    postData: InsertScheduledSocialPost,
  ): Promise<ScheduledSocialPost> {
    const [post] = await db
      .insert(scheduledSocialPosts)
      .values(postData)
      .returning();
    return post;
  }

  async getScheduledSocialPosts(
    userId: string,
  ): Promise<ScheduledSocialPost[]> {
    const posts = await db
      .select()
      .from(scheduledSocialPosts)
      .where(eq(scheduledSocialPosts.userId, userId));
    return posts;
  }

  async getAllScheduledSocialPosts(): Promise<ScheduledSocialPost[]> {
    const posts = await db.select().from(scheduledSocialPosts);
    return posts;
  }

  async updateScheduledSocialPost(
    postId: string,
    userId: string,
    updates: { topic?: string; tone?: string; scheduledTime?: Date },
  ): Promise<boolean> {
    try {
      const result = await db
        .update(scheduledSocialPosts)
        .set({
          topic: updates.topic,
          tone: updates.tone,
          scheduledTime: updates.scheduledTime,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(scheduledSocialPosts.id, postId),
            eq(scheduledSocialPosts.userId, userId),
          ),
        );
      // Check if any rows were actually updated
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error updating scheduled post:", error);
      return false;
    }
  }

  async deleteScheduledSocialPost(postId: string): Promise<boolean> {
    const result = await db
      .delete(scheduledSocialPosts)
      .where(eq(scheduledSocialPosts.id, postId));
    return true;
  }

  async deleteAllScheduledSocialPosts(userId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(scheduledSocialPosts)
        .where(eq(scheduledSocialPosts.userId, userId));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting all scheduled posts:", error);
      return false;
    }
  }

  async updateScheduledSocialPostStatus(
    postId: string,
    status: string,
    executedAt?: Date,
    errorMessage?: string,
  ): Promise<void> {
    await db
      .update(scheduledSocialPosts)
      .set({
        status,
        executedAt,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(scheduledSocialPosts.id, postId));
  }

  async moveToCompletedSocialPosts(
    scheduledPost: ScheduledSocialPost,
    finalContent: string,
    status: string,
    platformResponse?: any,
    errorMessage?: string,
  ): Promise<CompletedSocialPost> {
    try {
      // Create completed post record with proper date handling and fallback user_id
      const [completedPost] = await db
        .insert(completedSocialPosts)
        .values({
          id: scheduledPost.id,
          userId: scheduledPost.userId || "schedule-user", // Ensure user_id is never null
          topic: scheduledPost.topic,
          tone: scheduledPost.tone,
          platform: scheduledPost.platform,
          scheduledTime:
            scheduledPost.scheduledTime instanceof Date
              ? scheduledPost.scheduledTime
              : new Date(scheduledPost.scheduledTime),
          executedAt: new Date(),
          status,
          finalContent,
          mediaUrls: scheduledPost.mediaUrls,
          errorMessage,
          platformResponse,
          userTimezone: scheduledPost.userTimezone,
        })
        .returning();

      // Remove from scheduled posts
      await this.deleteScheduledSocialPost(scheduledPost.id);

      return completedPost;
    } catch (error: any) {
      // Handle duplicate key constraint violation (race condition between cron systems)
      if (
        error.code === "23505" &&
        error.constraint === "completed_social_posts_pkey"
      ) {
        console.log(
          `[DATABASE] ✅ Post ${scheduledPost.id} already moved to completed posts by another process`,
        );

        // Just remove from scheduled posts and return existing completed post
        await this.deleteScheduledSocialPost(scheduledPost.id);

        // Return the existing completed post
        const [existingPost] = await db
          .select()
          .from(completedSocialPosts)
          .where(eq(completedSocialPosts.id, scheduledPost.id));

        return existingPost;
      }

      // Re-throw other errors
      throw error;
    }
  }

  async getCompletedSocialPosts(
    userId: string,
  ): Promise<CompletedSocialPost[]> {
    const posts = await db
      .select()
      .from(completedSocialPosts)
      .where(eq(completedSocialPosts.userId, userId))
      .orderBy(sql`${completedSocialPosts.executedAt} DESC`);
    return posts;
  }

  async createCompletedSocialPost(
    post: InsertCompletedSocialPost,
  ): Promise<CompletedSocialPost> {
    const [createdPost] = await db
      .insert(completedSocialPosts)
      .values(post)
      .returning();
    return createdPost;
  }


  async getDueScheduledSocialPosts(
    currentTime: Date,
  ): Promise<ScheduledSocialPost[]> {
    try {
      const posts = await db
        .select()
        .from(scheduledSocialPosts)
        .where(
          and(
            eq(scheduledSocialPosts.status, "scheduled"),
            lte(scheduledSocialPosts.scheduledTime, currentTime),
          ),
        );

      // Populate credentials if missing
      for (const post of posts) {
        if (!post.credentials || Object.keys(post.credentials as object).length === 0) {
          try {
            // Find matching social media account
            // Note: platform in scheduledSocialPosts might be capitalized (e.g. "Facebook"), 
            // while socialMediaAccounts usually stores lowercase.
            const [account] = await db
              .select()
              .from(socialMediaAccounts)
              .where(
                and(
                  eq(socialMediaAccounts.userId, post.userId),
                  // Use sql lower() for case-insensitive comparison if possible, 
                  // but here we'll just try to match lowercase
                  eq(socialMediaAccounts.platform, post.platform.toLowerCase())
                )
              );

            if (account && account.accessToken) {
              const creds: any = { ...(post.credentials as object || {}) };
              const platform = post.platform.toLowerCase();

              if (platform === 'facebook') {
                creds.facebook_access_token = account.accessToken;
              } else if (platform === 'twitter') {
                creds.twitter_access_token = account.accessToken;
                creds.twitter_username = account.accountName;
              } else if (platform === 'linkedin') {
                creds.linkedin_access_token = account.accessToken;
              } else if (platform === 'mastodon') {
                creds.mastodon_access_token = account.accessToken;
                // Try to recover instance from localStorage logic or other fields if needed
                // For now, assume it might be in accountId or we need another way.
                // But user asked for Facebook, so we focus on that.
              }

              post.credentials = creds;
            }
          } catch (err) {
            console.error(`Failed to fetch credentials for post ${post.id}:`, err);
          }
        }
      }

      return posts;
    } catch (error) {
      console.error("Error in getDueScheduledSocialPosts:", error);
      return [];
    }
  }


  async getDueScheduledPosts(currentTime: Date): Promise<SocialMediaPost[]> {
    try {
      const posts = await db
        .select()
        .from(socialMediaPosts)
        .where(
          and(
            eq(socialMediaPosts.status, "scheduled"),
            lte(socialMediaPosts.scheduledAt, currentTime),
          ),
        );
      return posts;
    } catch (error) {
      console.error("Error in getDueScheduledPosts:", error);
      return [];
    }
  }

  async updateSocialMediaPostStatus(
    postId: number,
    status: string,
  ): Promise<void> {
    await db
      .update(socialMediaPosts)
      .set({
        status,
        updatedAt: new Date(),
        publishedAt: status === "published" ? new Date() : undefined,
      })
      .where(eq(socialMediaPosts.id, postId));
  }

  async createSocialMediaPostMetrics(
    metrics: InsertSocialMediaPostMetrics,
  ): Promise<SocialMediaPostMetrics> {
    throw new Error("Not implemented");
  }
  async getSocialMediaPostMetrics(
    postId: number,
  ): Promise<SocialMediaPostMetrics[]> {
    return [];
  }
  async updateSocialMediaPostMetrics(
    id: number,
    metrics: Partial<SocialMediaPostMetrics>,
  ): Promise<SocialMediaPostMetrics> {
    throw new Error("Not implemented");
  }

  async createSocialMediaContentTemplate(
    template: InsertSocialMediaContentTemplate,
  ): Promise<SocialMediaContentTemplate> {
    throw new Error("Not implemented");
  }
  async getSocialMediaContentTemplates(
    userId: string | null,
  ): Promise<SocialMediaContentTemplate[]> {
    return [];
  }
  async getSocialMediaContentTemplate(
    id: number,
  ): Promise<SocialMediaContentTemplate | undefined> {
    return undefined;
  }
  async updateSocialMediaContentTemplate(
    id: number,
    template: Partial<SocialMediaContentTemplate>,
  ): Promise<SocialMediaContentTemplate> {
    throw new Error("Not implemented");
  }
  async deleteSocialMediaContentTemplate(id: number): Promise<void> { }

  async createAiAgent(agent: InsertAiAgent): Promise<AiAgent> {
    const [newAgent] = await db.insert(aiAgents).values(agent).returning();
    return newAgent;
  }
  async getAiAgents(userId: string): Promise<AiAgent[]> {
    return await db
      .select()
      .from(aiAgents)
      .where(eq(aiAgents.createdBy, userId));
  }
  async getAiAgent(id: number): Promise<AiAgent | undefined> {
    const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, id));
    return agent;
  }
  async updateAiAgent(id: number, agent: Partial<AiAgent>): Promise<AiAgent> {
    const [updatedAgent] = await db
      .update(aiAgents)
      .set(agent)
      .where(eq(aiAgents.id, id))
      .returning();
    return updatedAgent;
  }
  async deleteAiAgent(id: number): Promise<void> {
    await db.delete(aiAgents).where(eq(aiAgents.id, id));
  }
  async getAiAgentsForProject(projectId: number): Promise<AiAgent[]> {
    return await db
      .select()
      .from(aiAgents)
      .where(eq(aiAgents.projectId, projectId));
  }

  // Task Priority Score methods
  async getTaskPriorityScore(
    taskId: number,
  ): Promise<TaskPriorityScore | undefined> {
    const [score] = await db
      .select()
      .from(taskPriorityScores)
      .where(eq(taskPriorityScores.taskId, taskId));
    return score;
  }

  async createTaskPriorityScore(
    score: InsertTaskPriorityScore,
  ): Promise<TaskPriorityScore> {
    const [newScore] = await db
      .insert(taskPriorityScores)
      .values(score)
      .returning();
    return newScore;
  }

  async updateTaskPriorityScore(
    taskId: number,
    score: Partial<TaskPriorityScore>,
  ): Promise<TaskPriorityScore> {
    const [updatedScore] = await db
      .update(taskPriorityScores)
      .set({ ...score, updatedAt: new Date() })
      .where(eq(taskPriorityScores.taskId, taskId))
      .returning();
    return updatedScore;
  }

  async deleteTaskPriorityScore(taskId: number): Promise<void> {
    await db
      .delete(taskPriorityScores)
      .where(eq(taskPriorityScores.taskId, taskId));
  }

  // Priority Weighting Preference methods
  async getPriorityWeightingPreference(
    userId: string,
    projectId?: number,
  ): Promise<PriorityWeightingPreference | undefined> {
    if (projectId) {
      const [preference] = await db
        .select()
        .from(priorityWeightingPreferences)
        .where(
          and(
            eq(priorityWeightingPreferences.userId, userId),
            eq(priorityWeightingPreferences.projectId, projectId),
          ),
        );
      return preference;
    } else {
      const [preference] = await db
        .select()
        .from(priorityWeightingPreferences)
        .where(
          and(
            eq(priorityWeightingPreferences.userId, userId),
            sql`${priorityWeightingPreferences.projectId} IS NULL`,
          ),
        );
      return preference;
    }
  }

  async createPriorityWeightingPreference(
    preference: InsertPriorityWeightingPreference,
  ): Promise<PriorityWeightingPreference> {
    const [newPreference] = await db
      .insert(priorityWeightingPreferences)
      .values(preference)
      .returning();
    return newPreference;
  }

  async updatePriorityWeightingPreference(
    id: number,
    preference: Partial<PriorityWeightingPreference>,
  ): Promise<PriorityWeightingPreference> {
    const [updatedPreference] = await db
      .update(priorityWeightingPreferences)
      .set({ ...preference, updatedAt: new Date() })
      .where(eq(priorityWeightingPreferences.id, id))
      .returning();
    return updatedPreference;
  }

  // Budget Estimate methods
  async createBudgetEstimate(
    estimate: InsertBudgetEstimate,
  ): Promise<BudgetEstimate> {
    const [newEstimate] = await db
      .insert(budgetEstimates)
      .values(estimate)
      .returning();
    return newEstimate;
  }

  async getBudgetEstimate(id: number): Promise<BudgetEstimate | undefined> {
    const [estimate] = await db
      .select()
      .from(budgetEstimates)
      .where(eq(budgetEstimates.id, id));
    return estimate;
  }

  async getBudgetEstimates(userId: string): Promise<BudgetEstimate[]> {
    return await db
      .select()
      .from(budgetEstimates)
      .where(eq(budgetEstimates.createdBy, userId))
      .orderBy(desc(budgetEstimates.createdAt));
  }

  async updateBudgetEstimate(
    id: number,
    estimate: Partial<BudgetEstimate>,
  ): Promise<BudgetEstimate> {
    const [updatedEstimate] = await db
      .update(budgetEstimates)
      .set({ ...estimate, updatedAt: new Date() })
      .where(eq(budgetEstimates.id, id))
      .returning();
    return updatedEstimate;
  }

  async deleteBudgetEstimate(id: number): Promise<void> {
    await db.delete(budgetEstimates).where(eq(budgetEstimates.id, id));
  }

  // Budget Line Item methods
  async createBudgetLineItem(
    item: InsertBudgetLineItem,
  ): Promise<BudgetLineItem> {
    const [newItem] = await db.insert(budgetLineItems).values(item).returning();
    return newItem;
  }

  async getBudgetLineItems(budgetId: number): Promise<BudgetLineItem[]> {
    return await db
      .select()
      .from(budgetLineItems)
      .where(eq(budgetLineItems.budgetId, budgetId))
      .orderBy(asc(budgetLineItems.position));
  }

  async updateBudgetLineItem(
    id: number,
    item: Partial<BudgetLineItem>,
  ): Promise<BudgetLineItem> {
    const [updatedItem] = await db
      .update(budgetLineItems)
      .set(item)
      .where(eq(budgetLineItems.id, id))
      .returning();
    return updatedItem;
  }

  async deleteBudgetLineItem(id: number): Promise<void> {
    await db.delete(budgetLineItems).where(eq(budgetLineItems.id, id));
  }

  // Form methods
  async createForm(form: InsertForm): Promise<Form> {
    const [newForm] = await db.insert(forms).values(form).returning();
    return newForm;
  }

  async getForm(id: number): Promise<Form | null> {
    const results = await db.select().from(forms).where(eq(forms.id, id));
    return results[0] || null;
  }

  async getFormsByUserId(userId: string): Promise<Form[]> {
    return await db
      .select()
      .from(forms)
      .where(eq(forms.createdBy, userId))
      .orderBy(desc(forms.createdAt));
  }

  async updateForm(id: number, form: Partial<Form>): Promise<Form> {
    const [updatedForm] = await db
      .update(forms)
      .set(form)
      .where(eq(forms.id, id))
      .returning();
    return updatedForm;
  }

  async deleteForm(id: number): Promise<void> {
    await db.delete(forms).where(eq(forms.id, id));
  }

  async getFormByShareToken(shareToken: string): Promise<Form | null> {
    const results = await db
      .select()
      .from(forms)
      .where(eq(forms.shareToken, shareToken));
    return results[0] || null;
  }

  // Form submission methods
  async createFormSubmission(
    submission: InsertFormSubmission,
  ): Promise<FormSubmission> {
    const [newSubmission] = await db
      .insert(formSubmissions)
      .values(submission)
      .returning();
    return newSubmission;
  }

  async getFormSubmissions(formId: number): Promise<FormSubmission[]> {
    return await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, formId))
      .orderBy(desc(formSubmissions.createdAt));
  }

  async deleteFormSubmission(id: number): Promise<void> {
    await db.delete(formSubmissions).where(eq(formSubmissions.id, id));
  }

  // Task Comment methods
  async getTaskComments(taskId: number): Promise<TaskComment[]> {
    return await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(desc(taskComments.createdAt));
  }

  async createTaskComment(comment: InsertTaskComment): Promise<TaskComment> {
    const [newComment] = await db
      .insert(taskComments)
      .values(comment)
      .returning();
    return newComment;
  }

  async updateTaskComment(
    id: number,
    comment: Partial<TaskComment>,
  ): Promise<TaskComment> {
    const [updatedComment] = await db
      .update(taskComments)
      .set({ ...comment, isEdited: true, updatedAt: new Date() })
      .where(eq(taskComments.id, id))
      .returning();
    return updatedComment;
  }

  async deleteTaskComment(id: number): Promise<void> {
    await db.delete(taskComments).where(eq(taskComments.id, id));
  }

  // Task Attachment methods
  async getTaskAttachments(taskId: number): Promise<TaskAttachment[]> {
    return await db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId))
      .orderBy(desc(taskAttachments.createdAt));
  }

  async createTaskAttachment(
    attachment: InsertTaskAttachment,
  ): Promise<TaskAttachment> {
    const [newAttachment] = await db
      .insert(taskAttachments)
      .values(attachment)
      .returning();
    return newAttachment;
  }

  async deleteTaskAttachment(id: number): Promise<void> {
    await db.delete(taskAttachments).where(eq(taskAttachments.id, id));
  }

  async getFeatureCandidates(userId: string): Promise<FeatureCandidate[]> {
    return await db
      .select()
      .from(featureCandidates)
      .where(eq(featureCandidates.userId, userId))
      .orderBy(desc(featureCandidates.createdAt));
  }

  async getFeatureCandidate(id: number): Promise<FeatureCandidate | undefined> {
    const [candidate] = await db
      .select()
      .from(featureCandidates)
      .where(eq(featureCandidates.id, id));
    return candidate;
  }

  async createFeatureCandidate(candidate: InsertFeatureCandidate): Promise<FeatureCandidate> {
    const [newCandidate] = await db
      .insert(featureCandidates)
      .values(candidate)
      .returning();
    return newCandidate;
  }

  async updateFeatureCandidate(id: number, updates: Partial<FeatureCandidate>): Promise<FeatureCandidate> {
    const [updated] = await db
      .update(featureCandidates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(featureCandidates.id, id))
      .returning();
    return updated;
  }

  async deleteFeatureCandidate(id: number): Promise<void> {
    await db.delete(featureCandidates).where(eq(featureCandidates.id, id));
  }

  async approveFeatureCandidate(id: number, projectId: number): Promise<FeatureCandidate> {
    const [updated] = await db
      .update(featureCandidates)
      .set({
        status: "approved",
        approvedAt: new Date(),
        projectId,
        updatedAt: new Date(),
      })
      .where(eq(featureCandidates.id, id))
      .returning();
    return updated;
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt));
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return conv;
  }

  async createConversation(conv: InsertConversation): Promise<Conversation> {
    const [newConv] = await db
      .insert(conversations)
      .values(conv)
      .returning();
    this.indexForSearch("conversation", newConv.id, newConv.userId, newConv.content, newConv.title);
    return newConv;
  }

  async updateConversation(id: number, updates: Partial<Conversation>): Promise<Conversation> {
    const [updated] = await db
      .update(conversations)
      .set(updates)
      .where(eq(conversations.id, id))
      .returning();
    if (updates.content !== undefined) {
      this.indexForSearch("conversation", updated.id, updated.userId, updated.content, updated.title);
    }
    return updated;
  }

  /**
   * Fire-and-forget hook: (re)embed a source into the unified content index
   * whenever content is created/updated. Never blocks or fails the write.
   */
  private indexForSearch(
    sourceType: string,
    sourceId: number | string,
    userId: string | null | undefined,
    text: string | null | undefined,
    sourceLabel?: string | null,
  ): void {
    if (!userId || !text || !text.trim()) return;
    void import("./services/content-indexer")
      .then((m) =>
        m.safeIndexContent({
          userId,
          sourceType,
          sourceId,
          text,
          metadata: sourceLabel ? { sourceLabel } : undefined,
        }),
      )
      .catch((err) =>
        console.error(`[storage] search-index hook failed for ${sourceType}:${sourceId}:`, err),
      );
  }

  private removeFromSearchIndex(sourceType: string, sourceId: number | string): void {
    void import("./services/content-indexer")
      .then((m) => m.removeFromIndex(sourceType, sourceId))
      .catch(() => undefined);
  }

  async deleteConversation(id: number): Promise<void> {
    await db.delete(conversations).where(eq(conversations.id, id));
    this.removeFromSearchIndex("conversation", id);
  }

  async createEvidenceItem(item: InsertEvidenceItem): Promise<EvidenceItem> {
    const [result] = await db.insert(evidenceItems).values(item).returning();
    this.indexForSearch(
      "evidence",
      result.id,
      result.userId,
      `${result.title || ""}\n${result.content || ""}`,
      result.title,
    );
    return result;
  }

  async getEvidenceItems(userId: string, filters?: { source?: string; tags?: string[] }): Promise<EvidenceItem[]> {
    const conditions = [eq(evidenceItems.userId, userId)];
    if (filters?.source) {
      conditions.push(eq(evidenceItems.source, filters.source));
    }
    if (filters?.tags && filters.tags.length > 0) {
      conditions.push(sql`${evidenceItems.tags} && ${filters.tags}`);
    }
    return await db
      .select()
      .from(evidenceItems)
      .where(and(...conditions))
      .orderBy(desc(evidenceItems.createdAt));
  }

  async getEvidenceItem(id: number): Promise<EvidenceItem | undefined> {
    const [result] = await db.select().from(evidenceItems).where(eq(evidenceItems.id, id));
    return result;
  }

  async updateEvidenceItem(id: number, item: Partial<EvidenceItem>): Promise<EvidenceItem> {
    const [result] = await db
      .update(evidenceItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(evidenceItems.id, id))
      .returning();
    if (item.content !== undefined || item.title !== undefined) {
      this.indexForSearch(
        "evidence",
        result.id,
        result.userId,
        `${result.title || ""}\n${result.content || ""}`,
        result.title,
      );
    }
    return result;
  }

  async deleteEvidenceItem(id: number): Promise<void> {
    await db.delete(evidenceItems).where(eq(evidenceItems.id, id));
    this.removeFromSearchIndex("evidence", id);
  }

  async searchEvidence(userId: string, query: string): Promise<EvidenceItem[]> {
    return await db
      .select()
      .from(evidenceItems)
      .where(
        and(
          eq(evidenceItems.userId, userId),
          or(
            ilike(evidenceItems.title, `%${query}%`),
            ilike(evidenceItems.content, `%${query}%`)
          )
        )
      )
      .orderBy(desc(evidenceItems.createdAt));
  }

  async getEvidenceByInsightType(userId: string, insightType?: string): Promise<EvidenceItem[]> {
    const conditions = [eq(evidenceItems.userId, userId)];
    if (insightType) {
      conditions.push(eq(evidenceItems.insightType, insightType));
    } else {
      conditions.push(sql`${evidenceItems.insightType} IS NOT NULL`);
    }
    return await db
      .select()
      .from(evidenceItems)
      .where(and(...conditions))
      .orderBy(desc(evidenceItems.createdAt));
  }

  async getTeamsMeetings(userId: string): Promise<TeamsMeeting[]> {
    return await db
      .select()
      .from(teamsMeetings)
      .where(eq(teamsMeetings.userId, userId))
      .orderBy(desc(teamsMeetings.startTime));
  }

  async getTeamsMeeting(id: number): Promise<TeamsMeeting | undefined> {
    const [meeting] = await db
      .select()
      .from(teamsMeetings)
      .where(eq(teamsMeetings.id, id));
    return meeting;
  }

  async createTeamsMeeting(meeting: InsertTeamsMeeting): Promise<TeamsMeeting> {
    const [created] = await db
      .insert(teamsMeetings)
      .values(meeting)
      .returning();
    return created;
  }

  async updateTeamsMeeting(id: number, updates: Partial<TeamsMeeting>): Promise<TeamsMeeting> {
    const [updated] = await db
      .update(teamsMeetings)
      .set(updates)
      .where(eq(teamsMeetings.id, id))
      .returning();
    if (updates.transcript !== undefined) {
      this.indexForSearch("teams", updated.id, updated.userId, updated.transcript, updated.subject);
    }
    return updated;
  }

  async deleteTeamsMeeting(id: number): Promise<void> {
    await db.delete(teamsMeetings).where(eq(teamsMeetings.id, id));
  }

  async getGoogleMeetMeetings(userId: string): Promise<GoogleMeetMeeting[]> {
    return await db
      .select()
      .from(googleMeetMeetings)
      .where(eq(googleMeetMeetings.userId, userId))
      .orderBy(desc(googleMeetMeetings.startTime));
  }

  async getGoogleMeetMeeting(id: number): Promise<GoogleMeetMeeting | undefined> {
    const [meeting] = await db
      .select()
      .from(googleMeetMeetings)
      .where(eq(googleMeetMeetings.id, id));
    return meeting;
  }

  async createGoogleMeetMeeting(meeting: InsertGoogleMeetMeeting): Promise<GoogleMeetMeeting> {
    const [created] = await db
      .insert(googleMeetMeetings)
      .values(meeting)
      .returning();
    return created;
  }

  async updateGoogleMeetMeeting(id: number, updates: Partial<GoogleMeetMeeting>): Promise<GoogleMeetMeeting> {
    const [updated] = await db
      .update(googleMeetMeetings)
      .set(updates)
      .where(eq(googleMeetMeetings.id, id))
      .returning();
    if (updates.transcript !== undefined) {
      this.indexForSearch("google_meet", updated.id, updated.userId, updated.transcript, updated.subject);
    }
    return updated;
  }

  async deleteGoogleMeetMeeting(id: number): Promise<void> {
    await db.delete(googleMeetMeetings).where(eq(googleMeetMeetings.id, id));
  }

  async getZoomMeetings(userId: string): Promise<ZoomMeeting[]> {
    return await db
      .select()
      .from(zoomMeetings)
      .where(eq(zoomMeetings.userId, userId))
      .orderBy(desc(zoomMeetings.startTime));
  }

  async getZoomMeeting(id: number): Promise<ZoomMeeting | undefined> {
    const [meeting] = await db
      .select()
      .from(zoomMeetings)
      .where(eq(zoomMeetings.id, id));
    return meeting;
  }

  async createZoomMeeting(meeting: InsertZoomMeeting): Promise<ZoomMeeting> {
    const [created] = await db
      .insert(zoomMeetings)
      .values(meeting)
      .returning();
    return created;
  }

  async updateZoomMeeting(id: number, updates: Partial<ZoomMeeting>): Promise<ZoomMeeting> {
    const [updated] = await db
      .update(zoomMeetings)
      .set(updates)
      .where(eq(zoomMeetings.id, id))
      .returning();
    if (updates.transcript !== undefined) {
      this.indexForSearch("zoom", updated.id, updated.userId, updated.transcript, updated.subject);
    }
    return updated;
  }

  async deleteZoomMeeting(id: number): Promise<void> {
    await db.delete(zoomMeetings).where(eq(zoomMeetings.id, id));
  }

  // ── Customer tiers ──────────────────────────────────────────────────────
  async getCustomerTiers(userId: string): Promise<CustomerTier[]> {
    return await db
      .select()
      .from(customerTiers)
      .where(eq(customerTiers.userId, userId))
      .orderBy(desc(customerTiers.weight));
  }

  async upsertCustomerTier(
    userId: string,
    company: string,
    tier: string,
    weight: number,
  ): Promise<CustomerTier> {
    const normalized = company.trim();
    const [existing] = await db
      .select()
      .from(customerTiers)
      .where(
        and(
          eq(customerTiers.userId, userId),
          ilike(customerTiers.company, normalized),
        ),
      );
    if (existing) {
      const [updated] = await db
        .update(customerTiers)
        .set({ tier, weight, updatedAt: new Date() })
        .where(eq(customerTiers.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(customerTiers)
      .values({ userId, company: normalized, tier, weight })
      .returning();
    return created;
  }

  async deleteCustomerTier(id: number, userId: string): Promise<void> {
    await db
      .delete(customerTiers)
      .where(and(eq(customerTiers.id, id), eq(customerTiers.userId, userId)));
  }

  // ── Themes ──────────────────────────────────────────────────────────────
  async createTheme(theme: InsertTheme): Promise<Theme> {
    const [created] = await db.insert(themes).values(theme).returning();
    return created;
  }

  async getThemes(userId: string): Promise<Theme[]> {
    return await db
      .select()
      .from(themes)
      .where(
        and(eq(themes.userId, userId), eq(themes.status, "active")),
      )
      .orderBy(desc(themes.weightedScore), desc(themes.mentionCount));
  }

  async getTheme(id: number): Promise<Theme | undefined> {
    const [result] = await db.select().from(themes).where(eq(themes.id, id));
    return result;
  }

  // Semantic search over themes via pgvector cosine similarity. Returns active
  // themes ranked most-relevant first, filtered to those above `threshold`.
  async searchThemesBySimilarity(
    userId: string,
    queryEmbedding: number[],
    limit = 50,
    threshold = 0.35,
  ): Promise<Theme[]> {
    const vec = JSON.stringify(queryEmbedding);
    const similarity = sql<number>`1 - (${themes.embedding} <=> ${vec}::vector)`;
    return await db
      .select()
      .from(themes)
      .where(
        and(
          eq(themes.userId, userId),
          eq(themes.status, "active"),
          isNotNull(themes.embedding),
          gt(similarity, threshold),
        ),
      )
      .orderBy(desc(similarity))
      .limit(limit);
  }

  async updateTheme(id: number, updates: Partial<Theme>): Promise<Theme> {
    const [updated] = await db
      .update(themes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(themes.id, id))
      .returning();
    return updated;
  }

  async deleteTheme(id: number): Promise<void> {
    await db.delete(themeMentions).where(eq(themeMentions.themeId, id));
    await db.delete(themes).where(eq(themes.id, id));
  }

  // ── Theme mentions ────────────────────────────────────────────────────────
  async createThemeMention(mention: InsertThemeMention): Promise<ThemeMention> {
    const [created] = await db
      .insert(themeMentions)
      .values(mention)
      .returning();
    return created;
  }

  async getThemeMentions(themeId: number): Promise<ThemeMention[]> {
    return await db
      .select()
      .from(themeMentions)
      .where(eq(themeMentions.themeId, themeId))
      .orderBy(desc(themeMentions.weight), desc(themeMentions.createdAt));
  }

  async getThemeMentionsForUser(userId: string): Promise<ThemeMention[]> {
    return await db
      .select()
      .from(themeMentions)
      .where(eq(themeMentions.userId, userId));
  }

  async reassignThemeMentions(fromThemeId: number, toThemeId: number): Promise<void> {
    await db
      .update(themeMentions)
      .set({ themeId: toThemeId })
      .where(eq(themeMentions.themeId, fromThemeId));
  }

  // Completed Meeting-Intelligence documents, exposed to the Theme Finder so
  // bulk-uploaded transcripts become a first-class theme source (spec step 1).
  async getCompletedIntelligenceDocuments(userId: string): Promise<any[]> {
    return await db
      .select()
      .from(meetingIntelligenceDocuments)
      .where(
        and(
          eq(meetingIntelligenceDocuments.userId, userId),
          eq(meetingIntelligenceDocuments.status, "completed"),
        ),
      );
  }
}

export const storage = new DatabaseStorage();

