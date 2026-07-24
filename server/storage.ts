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
  socialMediaPostMetrics,
  type SocialMediaPostMetrics,
  type InsertSocialMediaPostMetrics,
  socialMediaContentTemplates,
  type SocialMediaContentTemplate,
  type InsertSocialMediaContentTemplate,
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
  passwordResetTokens,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  evidenceItems,
  type EvidenceItem,
  type InsertEvidenceItem,
  type Theme,
  type InsertTheme,
  type ThemeMention,
  type InsertThemeMention,
  type CustomerTier,
  type InsertCustomerTier,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import crypto from "crypto";
import { secureRandomId } from "./security/helpers";

export interface IStorage {
  // === META helpers (optional in MemStorage, implemented in DatabaseStorage) ===
  upsertMetaUserToken?(row: {
    userId: string;
    provider: "meta";
    providerAccountType: "meta_user";
    accountId: string;
    displayName: string;
    accessToken: string;
    tokenExpiresAt?: Date | null;
    scopes?: string[] | null;
  }): Promise<any>;

  upsertMetaPage?(row: {
    userId: string;
    provider: "meta";
    providerAccountType: "facebook_page";
    accountId: string;
    displayName: string;
    accessToken: string;
  }): Promise<any>;

  upsertMetaIg?(row: {
    userId: string;
    provider: "meta";
    providerAccountType: "instagram";
    accountId: string;
    displayName: string;
    linkedPageId?: string | null;
  }): Promise<any>;

  listMetaPages?(userId: string): Promise<SocialMediaAccount[]>;
  listMetaIgAccounts?(userId: string): Promise<SocialMediaAccount[]>;
  getMetaPageToken?(userId: string, pageId: string): Promise<string | null>;
  getMetaUserToken?(userId: string): Promise<SocialMediaAccount | null>;

  // User methods
  getAllUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: InsertUser & { id: string }): Promise<User>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<User>;

  // Password Reset Token methods
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  createPasswordResetToken(tokenData: InsertPasswordResetToken): Promise<PasswordResetToken>;
  markPasswordResetTokenAsUsed(token: string): Promise<void>;

  // Project methods
  getAllProjects(): Promise<Project[]>;
  getProjectsForUser(userId: string): Promise<Project[]>; // Get only projects user has access to
  getRecentProjects(limit: number): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<Project>): Promise<Project>;
  deleteProject(id: number): Promise<void>;

  // Project Member methods
  getProjectMembers(projectId: number): Promise<ProjectMember[]>;
  getProjectMember(
    projectId: number,
    userId: string,
  ): Promise<ProjectMember | undefined>;
  addProjectMember(member: InsertProjectMember): Promise<ProjectMember>;
  updateProjectMemberRole(
    projectId: number,
    userId: string,
    role: string,
  ): Promise<ProjectMember>;
  removeProjectMember(projectId: number, userId: string): Promise<void>;
  isUserAuthorized(
    projectId: number,
    userId: string,
    requiredRole?: string,
  ): Promise<boolean>;

  // Project Invitation methods
  getProjectInvitations(projectId: number): Promise<ProjectInvitation[]>;
  getProjectInvitation(id: number): Promise<ProjectInvitation | undefined>;
  getInvitationByToken(token: string): Promise<ProjectInvitation | undefined>;
  getInvitationsByEmail(email: string): Promise<ProjectInvitation[]>;
  createProjectInvitation(
    invitation: InsertProjectInvitation,
  ): Promise<ProjectInvitation>;
  updateProjectInvitation(
    id: number,
    invitation: Partial<ProjectInvitation>,
  ): Promise<ProjectInvitation>;
  deleteProjectInvitation(id: number): Promise<void>;
  acceptInvitation(token: string, userId: string): Promise<ProjectMember>;

  // Task methods
  getAllTasks(): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  getTasksByProjectId(projectId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<Task>): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  getSubtasks(parentTaskId: number): Promise<Task[]>;

  // Task Priority Score methods
  getTaskPriorityScore(taskId: number): Promise<TaskPriorityScore | undefined>;
  getTaskPriorityScores(taskIds: number[]): Promise<TaskPriorityScore[]>;
  createTaskPriorityScore(
    score: InsertTaskPriorityScore,
  ): Promise<TaskPriorityScore>;
  updateTaskPriorityScore(
    taskId: number,
    score: Partial<TaskPriorityScore>,
  ): Promise<TaskPriorityScore>;
  deleteTaskPriorityScore(taskId: number): Promise<void>;

  // Priority Weighting Preference methods
  getPriorityWeightingPreference(
    userId: string,
    projectId?: number,
  ): Promise<PriorityWeightingPreference | undefined>;
  createPriorityWeightingPreference(
    preference: InsertPriorityWeightingPreference,
  ): Promise<PriorityWeightingPreference>;
  updatePriorityWeightingPreference(
    id: number,
    preference: Partial<PriorityWeightingPreference>,
  ): Promise<PriorityWeightingPreference>;

  // Integration methods
  getAllIntegrations(): Promise<Integration[]>;
  getIntegration(id: number): Promise<Integration | undefined>;
  getIntegrationByProvider(
    userId: string,
    provider: string,
  ): Promise<Integration | undefined>;
  createIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegration(
    id: number,
    integration: Partial<Integration>,
  ): Promise<Integration>;
  deleteIntegration(id: number): Promise<void>;

  // Insight methods
  getAllInsights(): Promise<Insight[]>;
  getInsight(id: number): Promise<Insight | undefined>;
  getInsightsByProjectId(projectId: number): Promise<Insight[]>;
  createInsight(insight: InsertInsight): Promise<Insight>;
  updateInsight(id: number, insight: Partial<Insight>): Promise<Insight>;
  deleteInsight(id: number): Promise<void>;

  // Kanban Column methods
  getAllKanbanColumns(): Promise<KanbanColumn[]>;
  getKanbanColumnById(id: number): Promise<KanbanColumn | undefined>;
  getKanbanColumns(projectId: number): Promise<KanbanColumn[]>;
  createKanbanColumn(column: InsertKanbanColumn): Promise<KanbanColumn>;
  updateKanbanColumn(
    id: number,
    column: Partial<KanbanColumn>,
  ): Promise<KanbanColumn>;
  deleteKanbanColumn(id: number): Promise<void>;
  getDefaultKanbanColumns(projectId: number): Promise<KanbanColumn[]>;

  // Chat persistence methods
  createChatSession(
    userId: string,
    projectId?: number,
  ): Promise<{ sessionId: string }>;
  getChatSession(sessionId: string): Promise<any>;
  saveChatMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string,
    metadata?: any,
  ): Promise<void>;
  getChatHistory(sessionId: string): Promise<any[]>;
  getUserChatSessions(userId: string): Promise<any[]>;
  deleteOldChatSessions(userId: string, keepCount: number): Promise<void>;

  // Team Member methods
  getAllTeamMembers(): Promise<TeamMember[]>;
  getTeamMember(id: number): Promise<TeamMember | undefined>;
  getTeamMembersByUser(userId: string): Promise<TeamMember[]>;
  createTeamMember(teamMember: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(
    id: number,
    teamMember: Partial<TeamMember>,
  ): Promise<TeamMember>;
  deleteTeamMember(id: number): Promise<void>;

  // Smart Task Assignment methods
  getAllSmartTaskAssignments(): Promise<SmartTaskAssignment[]>;
  getSmartTaskAssignment(id: number): Promise<SmartTaskAssignment | undefined>;
  getSmartTaskAssignmentsByTask(taskId: number): Promise<SmartTaskAssignment[]>;
  createSmartTaskAssignment(
    assignment: InsertSmartTaskAssignment,
  ): Promise<SmartTaskAssignment>;
  updateSmartTaskAssignment(
    id: number,
    assignment: Partial<SmartTaskAssignment>,
  ): Promise<SmartTaskAssignment>;
  deleteSmartTaskAssignment(id: number): Promise<void>;

  // Capacity Alert methods
  getAllCapacityAlerts(): Promise<CapacityAlert[]>;
  getCapacityAlert(id: number): Promise<CapacityAlert | undefined>;
  getCapacityAlertsByTeamMember(teamMemberId: number): Promise<CapacityAlert[]>;
  createCapacityAlert(alert: InsertCapacityAlert): Promise<CapacityAlert>;
  updateCapacityAlert(
    id: number,
    alert: Partial<CapacityAlert>,
  ): Promise<CapacityAlert>;
  deleteCapacityAlert(id: number): Promise<void>;

  // Team Profile methods
  getTeamProfile(userId: string): Promise<TeamProfile | undefined>;
  createTeamProfile(profile: InsertTeamProfile): Promise<TeamProfile>;
  updateTeamProfile(
    userId: string,
    profile: Partial<TeamProfile>,
  ): Promise<TeamProfile>;
  deleteTeamProfile(userId: string): Promise<void>;
  getAllTeamProfiles(): Promise<TeamProfile[]>;

  // Team Availability methods
  getTeamAvailability(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TeamAvailability[]>;
  createTeamAvailability(
    availability: InsertTeamAvailability,
  ): Promise<TeamAvailability>;
  updateTeamAvailability(
    id: number,
    availability: Partial<TeamAvailability>,
  ): Promise<TeamAvailability>;
  deleteTeamAvailability(id: number): Promise<void>;

  // Task Assignment methods
  getTaskAssignments(taskId: number): Promise<TaskAssignment[]>;
  getTaskAssignmentsByUser(userId: string): Promise<TaskAssignment[]>;
  createTaskAssignment(
    assignment: InsertTaskAssignment,
  ): Promise<TaskAssignment>;
  updateTaskAssignment(
    id: number,
    assignment: Partial<TaskAssignment>,
  ): Promise<TaskAssignment>;
  deleteTaskAssignment(id: number): Promise<void>;
  getActiveTaskAssignments(userId: string): Promise<TaskAssignment[]>;

  // RGA methods
  getRgaCategory(taskId: number): Promise<RgaCategory | undefined>;
  createRgaCategory(category: InsertRgaCategory): Promise<RgaCategory>;
  updateRgaCategory(
    id: number,
    category: Partial<RgaCategory>,
  ): Promise<RgaCategory>;
  getRgaSettings(userId: string): Promise<RgaSettings | undefined>;
  createRgaSettings(settings: InsertRgaSettings): Promise<RgaSettings>;
  updateRgaSettings(
    id: number,
    settings: Partial<RgaSettings>,
  ): Promise<RgaSettings>;
  getRgaReports(userId: string, limit?: number): Promise<RgaReport[]>;
  createRgaReport(report: InsertRgaReport): Promise<RgaReport>;
  getTasksByCategory(userId: string, category: string): Promise<Task[]>;
  getTasksForUser(userId: string): Promise<Task[]>;

  // JIRA Integration methods
  createJiraIntegration(
    integration: InsertJiraIntegration,
  ): Promise<JiraIntegration>;
  getJiraIntegration(userId: string): Promise<JiraIntegration | undefined>;
  getJiraIntegrationById(id: number): Promise<JiraIntegration | undefined>;
  updateJiraIntegration(
    id: number,
    integration: Partial<InsertJiraIntegration>,
  ): Promise<JiraIntegration>;
  deleteJiraIntegration(id: number): Promise<void>;

  // User Story methods
  createUserStory(story: InsertUserStory): Promise<UserStory>;
  getUserStory(id: number): Promise<UserStory | undefined>;
  getUserStoriesForProject(projectId: number): Promise<UserStory[]>;
  updateUserStory(
    id: number,
    story: Partial<InsertUserStory>,
  ): Promise<UserStory>;
  deleteUserStory(id: number): Promise<void>;

  // Story Estimation methods
  createStoryEstimation(
    estimation: InsertStoryEstimation,
  ): Promise<StoryEstimation>;
  getStoryEstimations(storyId: number): Promise<StoryEstimation[]>;

  // JIRA Sync methods
  createJiraSyncLog(log: InsertJiraSyncLog): Promise<JiraSyncLog>;
  getJiraSyncLogs(integrationId: number): Promise<JiraSyncLog[]>;

  // Social Media methods
  // Account methods
  createSocialMediaAccount(
    account: InsertSocialMediaAccount,
  ): Promise<SocialMediaAccount>;
  getSocialMediaAccounts(userId: string): Promise<SocialMediaAccount[]>;
  getSocialMediaAccount(id: number): Promise<SocialMediaAccount | undefined>;
  updateSocialMediaAccount(
    id: number,
    account: Partial<SocialMediaAccount>,
  ): Promise<SocialMediaAccount>;
  deleteSocialMediaAccount(id: number): Promise<void>;

  // Goal methods
  createSocialMediaGoal(goal: InsertSocialMediaGoal): Promise<SocialMediaGoal>;
  getSocialMediaGoals(userId: string): Promise<SocialMediaGoal[]>;
  getSocialMediaGoal(id: number): Promise<SocialMediaGoal | undefined>;
  updateSocialMediaGoal(
    id: number,
    goal: Partial<SocialMediaGoal>,
  ): Promise<SocialMediaGoal>;
  deleteSocialMediaGoal(id: number): Promise<void>;

  // Brand Profile methods
  createSocialMediaBrandProfile(
    profile: InsertSocialMediaBrandProfile,
  ): Promise<SocialMediaBrandProfile>;
  getSocialMediaBrandProfiles(
    userId: string,
  ): Promise<SocialMediaBrandProfile[]>;
  getSocialMediaBrandProfile(
    id: number,
  ): Promise<SocialMediaBrandProfile | undefined>;
  updateSocialMediaBrandProfile(
    id: number,
    profile: Partial<SocialMediaBrandProfile>,
  ): Promise<SocialMediaBrandProfile>;
  deleteSocialMediaBrandProfile(id: number): Promise<void>;

  // Post methods
  createSocialMediaPost(post: InsertSocialMediaPost): Promise<SocialMediaPost>;
  getSocialMediaPosts(userId: string): Promise<SocialMediaPost[]>;
  getSocialMediaPost(id: number): Promise<SocialMediaPost | undefined>;
  updateSocialMediaPost(
    id: number,
    post: Partial<SocialMediaPost>,
  ): Promise<SocialMediaPost>;
  deleteSocialMediaPost(id: number): Promise<void>;
  getScheduledPosts(userId: string): Promise<SocialMediaPost[]>;
  schedulePost(postData: {
    userId: string;
    content: string;
    platform: string;
    scheduledTime: Date;
    metadata: any;
    status: string;
  }): Promise<SocialMediaPost>;
  getDueScheduledPosts(currentTime: Date): Promise<SocialMediaPost[]>;
  updateSocialMediaPostStatus(postId: number, status: string): Promise<void>;

  // Post Metrics methods
  createSocialMediaPostMetrics(
    metrics: InsertSocialMediaPostMetrics,
  ): Promise<SocialMediaPostMetrics>;
  getSocialMediaPostMetrics(postId: number): Promise<SocialMediaPostMetrics[]>;
  updateSocialMediaPostMetrics(
    id: number,
    metrics: Partial<SocialMediaPostMetrics>,
  ): Promise<SocialMediaPostMetrics>;

  // Form methods
  createForm(form: InsertForm): Promise<Form>;
  getForm(id: number): Promise<Form | null>;
  getFormsByUserId(userId: string): Promise<Form[]>;
  updateForm(id: number, form: Partial<Form>): Promise<Form>;
  deleteForm(id: number): Promise<void>;
  getFormByShareToken(shareToken: string): Promise<Form | null>;
  
  // Form submission methods
  createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission>;
  getFormSubmissions(formId: number): Promise<FormSubmission[]>;
  deleteFormSubmission(id: number): Promise<void>;

  // Content Template methods
  createSocialMediaContentTemplate(
    template: InsertSocialMediaContentTemplate,
  ): Promise<SocialMediaContentTemplate>;
  getSocialMediaContentTemplates(
    userId: string | null,
  ): Promise<SocialMediaContentTemplate[]>;
  getSocialMediaContentTemplate(
    id: number,
  ): Promise<SocialMediaContentTemplate | undefined>;
  updateSocialMediaContentTemplate(
    id: number,
    template: Partial<SocialMediaContentTemplate>,
  ): Promise<SocialMediaContentTemplate>;
  deleteSocialMediaContentTemplate(id: number): Promise<void>;

  // AI Agent methods
  createAiAgent(agent: InsertAiAgent): Promise<AiAgent>;
  getAiAgents(userId: string): Promise<AiAgent[]>;
  getAiAgent(id: number): Promise<AiAgent | undefined>;
  updateAiAgent(id: number, agent: Partial<AiAgent>): Promise<AiAgent>;
  deleteAiAgent(id: number): Promise<void>;
  getAiAgentsForProject(projectId: number): Promise<AiAgent[]>;

  // Subscription methods
  getAllSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined>;
  getSubscriptionPlanBySlug(
    slug: string,
  ): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(
    plan: InsertSubscriptionPlan,
  ): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(
    id: number,
    plan: Partial<SubscriptionPlan>,
  ): Promise<SubscriptionPlan>;
  deleteSubscriptionPlan(id: number): Promise<void>;

  // Feature methods
  getAllFeatures(): Promise<Feature[]>;
  getFeature(id: number): Promise<Feature | undefined>;
  getFeatureBySlug(slug: string): Promise<Feature | undefined>;
  createFeature(feature: InsertFeature): Promise<Feature>;
  updateFeature(id: number, feature: Partial<Feature>): Promise<Feature>;
  deleteFeature(id: number): Promise<void>;

  // User subscription methods
  updateUserSubscription(
    userId: string,
    planId: number,
    stripeCustomerId?: string,
    stripeSubscriptionId?: string,
  ): Promise<User>;
  getUserWithPlan(
    userId: string,
  ): Promise<(User & { plan?: SubscriptionPlan }) | undefined>;
  checkUserFeatureAccess(userId: string, featureSlug: string): Promise<boolean>;

  // Budget Estimate methods
  createBudgetEstimate(estimate: InsertBudgetEstimate): Promise<BudgetEstimate>;
  getBudgetEstimate(id: number): Promise<BudgetEstimate | undefined>;
  getBudgetEstimates(userId: string): Promise<BudgetEstimate[]>;
  updateBudgetEstimate(
    id: number,
    estimate: Partial<BudgetEstimate>,
  ): Promise<BudgetEstimate>;
  deleteBudgetEstimate(id: number): Promise<void>;

  // Budget Line Item methods
  createBudgetLineItem(item: InsertBudgetLineItem): Promise<BudgetLineItem>;
  getBudgetLineItems(budgetId: number): Promise<BudgetLineItem[]>;
  updateBudgetLineItem(
    id: number,
    item: Partial<BudgetLineItem>,
  ): Promise<BudgetLineItem>;
  deleteBudgetLineItem(id: number): Promise<void>;

  // Task Comment methods
  getTaskComments(taskId: number): Promise<TaskComment[]>;
  createTaskComment(comment: InsertTaskComment): Promise<TaskComment>;
  updateTaskComment(id: number, comment: Partial<TaskComment>): Promise<TaskComment>;
  deleteTaskComment(id: number): Promise<void>;

  // Task Attachment methods
  getTaskAttachments(taskId: number): Promise<TaskAttachment[]>;
  createTaskAttachment(attachment: InsertTaskAttachment): Promise<TaskAttachment>;
  deleteTaskAttachment(id: number): Promise<void>;

  // Evidence Item methods
  createEvidenceItem(item: InsertEvidenceItem): Promise<EvidenceItem>;
  getEvidenceItems(userId: string, filters?: { source?: string; tags?: string[] }): Promise<EvidenceItem[]>;
  getEvidenceItem(id: number): Promise<EvidenceItem | undefined>;
  updateEvidenceItem(id: number, item: Partial<EvidenceItem>): Promise<EvidenceItem>;
  deleteEvidenceItem(id: number): Promise<void>;
  searchEvidence(userId: string, query: string): Promise<EvidenceItem[]>;
  getEvidenceByInsightType(userId: string, insightType?: string): Promise<EvidenceItem[]>;

  // Customer Tier methods (Recurring Theme Finder)
  getCustomerTiers?(userId: string): Promise<CustomerTier[]>;
  upsertCustomerTier?(userId: string, company: string, tier: string, weight: number): Promise<CustomerTier>;
  deleteCustomerTier?(id: number, userId: string): Promise<void>;

  // Theme methods (Recurring Theme Finder)
  createTheme?(theme: InsertTheme): Promise<Theme>;
  getThemes?(userId: string): Promise<Theme[]>;
  getTheme?(id: number): Promise<Theme | undefined>;
  searchThemesBySimilarity?(userId: string, queryEmbedding: number[], limit?: number, threshold?: number): Promise<Theme[]>;
  updateTheme?(id: number, updates: Partial<Theme>): Promise<Theme>;
  deleteTheme?(id: number): Promise<void>;

  // Theme Mention methods (Recurring Theme Finder)
  createThemeMention?(mention: InsertThemeMention): Promise<ThemeMention>;
  getThemeMentions?(themeId: number): Promise<ThemeMention[]>;
  getThemeMentionsForUser?(userId: string): Promise<ThemeMention[]>;
  reassignThemeMentions?(fromThemeId: number, toThemeId: number): Promise<void>;
  getCompletedIntelligenceDocuments?(userId: string): Promise<any[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<number, Project>;
  private tasks: Map<number, Task>;
  private integrations: Map<number, Integration>;
  private insights: Map<number, Insight>;
  private projectMembers: Map<string, ProjectMember>; // key format: `${projectId}-${userId}`
  private projectInvitations: Map<number, ProjectInvitation>;
  private invitationsByToken: Map<string, number>; // token -> invitation id
  private kanbanColumns: Map<number, KanbanColumn>;

  private projectId: number;
  private taskId: number;
  private integrationId: number;
  private insightId: number;
  private projectMemberId: number;
  private projectInvitationId: number;
  private kanbanColumnId: number;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.tasks = new Map();
    this.integrations = new Map();
    this.insights = new Map();
    this.projectMembers = new Map();
    this.projectInvitations = new Map();
    this.invitationsByToken = new Map();
    this.kanbanColumns = new Map();

    this.projectId = 1;
    this.taskId = 1;
    this.integrationId = 1;
    this.insightId = 1;
    this.projectMemberId = 1;
    this.projectInvitationId = 1;
    this.kanbanColumnId = 1;

    // Seed with demo data
    this.seedData();
  }

  // META stubs for MemStorage
  async upsertMetaUserToken() {
    throw new Error("Meta integration not available in memory storage");
  }
  async upsertMetaPage() {
    throw new Error("Meta integration not available in memory storage");
  }
  async upsertMetaIg() {
    throw new Error("Meta integration not available in memory storage");
  }
  async listMetaPages() {
    return [];
  }
  async listMetaIgAccounts() {
    return [];
  }
  async getMetaPageToken() {
    return null;
  }
  async getMetaUserToken() {
    return null;
  }

  private seedData() {
    // Create a demo user
    const user: User = {
      id: "1",
      username: "john.smith",
      email: "john.smith@example.com",
      firstName: "John",
      lastName: "Smith",
      bio: "Demo user for a project management app",
      profileImageUrl: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);

    // Create a few demo projects
    const projects: InsertProject[] = [
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
        aiGenerated: true,
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
        aiGenerated: true,
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
        aiGenerated: false,
      },
    ];

    for (const projectData of projects) {
      const project: Project = {
        ...projectData,
        id: this.projectId++,
        createdAt: new Date(),
      };
      this.projects.set(project.id, project);
    }

    // Create some demo tasks
    const tasks: InsertTask[] = [
      {
        name: "Design homepage wireframe",
        description: "Create wireframes for the new homepage",
        status: "done",
        priority: "high",
        projectId: 1,
        assigneeId: user.id,
      },
      {
        name: "Implement landing page",
        description: "Build the new landing page with HTML/CSS",
        status: "in-progress",
        priority: "medium",
        projectId: 1,
        assigneeId: user.id,
      },
      {
        name: "Setup mobile app architecture",
        description: "Define the app architecture and technology stack",
        status: "done",
        priority: "high",
        projectId: 2,
        assigneeId: user.id,
      },
      {
        name: "Design database schema",
        description: "Create the database schema for the analytics platform",
        status: "todo",
        priority: "medium",
        projectId: 3,
        assigneeId: user.id,
      },
    ];

    for (const taskData of tasks) {
      const task: Task = {
        ...taskData,
        id: this.taskId++,
        createdAt: new Date(),
      };
      this.tasks.set(task.id, task);
    }

    // Create a demo integration
    const integration: Integration = {
      id: this.integrationId++,
      userId: user.id,
      provider: "smartsheet",
      accessToken: "demo_access_token",
      refreshToken: "demo_refresh_token",
      tokenExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isConnected: true,
      lastSynced: new Date(),
      workspaceId: "demo_workspace",
      additionalData: {},
    };
    this.integrations.set(integration.id, integration);

    // Create demo insights
    const insights: InsertInsight[] = [
      {
        type: "resource-conflict",
        title: "Resource Conflict Detected",
        description:
          "Development team is overallocated by 15% in the next sprint.",
        severity: "warning",
        projectId: 2,
        suggestedAction: "Redistribute tasks or extend timeline",
        isResolved: false,
      },
      {
        type: "timeline-risk",
        title: "Project Optimization",
        description:
          "Resequencing 3 tasks could reduce project timeline by 5 days.",
        severity: "info",
        projectId: 1,
        suggestedAction: "Review task dependencies and resequence",
        isResolved: false,
      },
      {
        type: "on-track",
        title: "On-Track Projects",
        description:
          "6 of 8 projects are progressing as planned with no critical issues.",
        severity: "info",
        suggestedAction: "Continue monitoring",
        isResolved: false,
      },
    ];

    for (const insightData of insights) {
      const insight: Insight = {
        ...insightData,
        id: this.insightId++,
        createdAt: new Date(),
        resolvedAt: null,
      };
      this.insights.set(insight.id, insight);
    }
  }

  // User methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(userData: InsertUser): Promise<User> {
    // Cryptographically random user ID — Math.random() is predictable across
    // V8 Math.random call sequences and would let attackers guess fresh IDs.
    const id = secureRandomId(8);
    const user: User = {
      ...userData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async upsertUser(userData: InsertUser & { id: string }): Promise<User> {
    const existingUser = await this.getUser(userData.id);
    if (existingUser) {
      const updatedUser: User = {
        ...existingUser,
        ...userData,
        updatedAt: new Date(),
      };
      this.users.set(userData.id, updatedUser);
      return updatedUser;
    }
    const newUser: User = {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(userData.id, newUser);
    return newUser;
  }

  // Project methods
  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort(
      (a, b) =>
        (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime(),
    );
  }

  async getProjectsForUser(userId: string): Promise<Project[]> {
    // Get all projects where the user is the owner
    const ownedProjects = Array.from(this.projects.values()).filter(
      (project) => project.ownerId === userId,
    );

    // Get all projects where the user is a member
    const memberProjects = Array.from(this.projectMembers.values())
      .filter((member) => member.userId === userId)
      .map((member) => this.projects.get(member.projectId))
      .filter(Boolean) as Project[];

    // Combine both lists and remove duplicates
    const allUserProjects = [...ownedProjects];

    // Add member projects if they're not already in the list
    for (const project of memberProjects) {
      if (!allUserProjects.some((p) => p.id === project.id)) {
        allUserProjects.push(project);
      }
    }

    // Sort by creation date (newest first)
    return allUserProjects.sort(
      (a, b) =>
        (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime(),
    );
  }

  async getRecentProjects(limit: number): Promise<Project[]> {
    return Array.from(this.projects.values())
      .sort(
        (a, b) =>
          (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime(),
      )
      .slice(0, limit);
  }

  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(projectData: InsertProject): Promise<Project> {
    const id = this.projectId++;
    const project: Project = {
      ...projectData,
      id,
      createdAt: new Date(),
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(
    id: number,
    projectData: Partial<Project>,
  ): Promise<Project> {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error("Project not found");
    }

    const updatedProject = { ...project, ...projectData };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: number): Promise<void> {
    console.log(`MemStorage: Deleting project with ID: ${id}`);

    // Check if the project exists before deleting
    const project = this.projects.get(id);
    if (!project) {
      console.warn(
        `MemStorage: Project with ID ${id} not found, nothing to delete.`,
      );
      return;
    }

    // Delete the project
    this.projects.delete(id);
    console.log(
      `MemStorage: Project ${id} deleted. Projects remaining: ${this.projects.size}`,
    );

    // Delete associated tasks
    for (const [taskId, task] of Array.from(this.tasks.entries())) {
      if (task.projectId === id) {
        this.tasks.delete(taskId);
        console.log(
          `MemStorage: Deleted task ${taskId} associated with project ${id}`,
        );
      }
    }

    // Delete associated insights
    for (const [insightId, insight] of Array.from(this.insights.entries())) {
      if (insight.projectId === id) {
        this.insights.delete(insightId);
        console.log(
          `MemStorage: Deleted insight ${insightId} associated with project ${id}`,
        );
      }
    }

    // Delete associated project members
    for (const [key, member] of Array.from(this.projectMembers.entries())) {
      if (member.projectId === id) {
        this.projectMembers.delete(key);
        console.log(
          `MemStorage: Deleted project member ${key} associated with project ${id}`,
        );
      }
    }

    // Delete associated kanban columns
    for (const [columnId, column] of Array.from(this.kanbanColumns.entries())) {
      if (column.projectId === id) {
        this.kanbanColumns.delete(columnId);
        console.log(
          `MemStorage: Deleted kanban column ${columnId} associated with project ${id}`,
        );
      }
    }
  }

  // Project Member methods
  async getProjectMembers(projectId: number): Promise<ProjectMember[]> {
    return Array.from(this.projectMembers.values()).filter(
      (member) => member.projectId === projectId,
    );
  }

  async getProjectMember(
    projectId: number,
    userId: string,
  ): Promise<ProjectMember | undefined> {
    const key = `${projectId}-${userId}`;
    return this.projectMembers.get(key);
  }

  async addProjectMember(
    memberData: InsertProjectMember,
  ): Promise<ProjectMember> {
    const { projectId, userId, role } = memberData;

    // Check if project exists
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Check if user exists
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Create unique key for the map
    const key = `${projectId}-${userId}`;

    // Check if membership already exists
    const existingMember = this.projectMembers.get(key);
    if (existingMember) {
      // If it exists, just update the role
      return this.updateProjectMemberRole(projectId, userId, role);
    }

    // Create new membership
    const id = this.projectMemberId++;
    const member: ProjectMember = {
      id,
      projectId,
      userId,
      role,
      addedAt: new Date(),
    };

    this.projectMembers.set(key, member);
    return member;
  }

  async updateProjectMemberRole(
    projectId: number,
    userId: string,
    role: string,
  ): Promise<ProjectMember> {
    const key = `${projectId}-${userId}`;
    const member = this.projectMembers.get(key);

    if (!member) {
      throw new Error("Project member not found");
    }

    const updatedMember = { ...member, role };
    this.projectMembers.set(key, updatedMember);
    return updatedMember;
  }

  async removeProjectMember(projectId: number, userId: string): Promise<void> {
    const key = `${projectId}-${userId}`;
    this.projectMembers.delete(key);
  }

  async isUserAuthorized(
    projectId: number,
    userId: string,
    requiredRole?: string,
  ): Promise<boolean> {
    // First, check if the user is the project owner
    const project = await this.getProject(projectId);
    if (!project) {
      return false;
    }

    // Project owners have full access to their projects
    if (project.ownerId === userId) {
      return true;
    }

    // If not the owner, check if they're a member
    const member = await this.getProjectMember(projectId, userId);
    if (!member) {
      return false;
    }

    // If no specific role is required, any project member can access
    if (!requiredRole) {
      return true;
    }

    // Check role permissions (hierarchy: owner > editor > viewer)
    switch (requiredRole) {
      case ProjectRole.VIEWER:
        // Any role can view
        return true;
      case ProjectRole.EDITOR:
        // Only editors and owners can edit
        return (
          member.role === ProjectRole.EDITOR ||
          member.role === ProjectRole.OWNER
        );
      case ProjectRole.OWNER:
        // Only owners can perform owner actions
        return member.role === ProjectRole.OWNER;
      default:
        return false;
    }
  }

  // Project Invitation methods
  async getProjectInvitations(projectId: number): Promise<ProjectInvitation[]> {
    return Array.from(this.projectInvitations.values()).filter(
      (invitation) => invitation.projectId === projectId,
    );
  }

  async getProjectInvitation(
    id: number,
  ): Promise<ProjectInvitation | undefined> {
    return this.projectInvitations.get(id);
  }

  async getInvitationByToken(
    token: string,
  ): Promise<ProjectInvitation | undefined> {
    const invitationId = this.invitationsByToken.get(token);
    if (!invitationId) return undefined;
    return this.projectInvitations.get(invitationId);
  }

  async getInvitationsByEmail(email: string): Promise<ProjectInvitation[]> {
    return Array.from(this.projectInvitations.values()).filter(
      (invitation) =>
        invitation.email === email && invitation.status === "pending",
    );
  }

  async createProjectInvitation(
    invitationData: InsertProjectInvitation,
  ): Promise<ProjectInvitation> {
    // Check if project exists
    const project = await this.getProject(invitationData.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Check if user sending the invitation exists and is authorized
    const user = await this.getUser(invitationData.invitedBy);
    if (!user) {
      throw new Error("User not found");
    }

    const isAuthorized = await this.isUserAuthorized(
      invitationData.projectId,
      invitationData.invitedBy,
      ProjectRole.OWNER,
    );
    if (!isAuthorized) {
      throw new Error("Only project owners can send invitations");
    }

    // Check if there's already a pending invitation for this email
    const existingInvitations = await this.getInvitationsByEmail(
      invitationData.email,
    );
    const existingInvitationForProject = existingInvitations.find(
      (inv) => inv.projectId === invitationData.projectId,
    );

    if (existingInvitationForProject) {
      // Just update the existing invitation
      return await this.updateProjectInvitation(
        existingInvitationForProject.id,
        {
          ...invitationData,
          token: invitationData.token, // Use the new token
          status: "pending",
          createdAt: new Date(),
        },
      );
    }

    // Create new invitation
    const id = this.projectInvitationId++;
    const invitation: ProjectInvitation = {
      id,
      status: "pending",
      createdAt: new Date(),
      acceptedAt: null,
      role: invitationData.role || "viewer",
      ...invitationData,
    };

    this.projectInvitations.set(id, invitation);
    this.invitationsByToken.set(invitationData.token, id);

    return invitation;
  }

  async updateProjectInvitation(
    id: number,
    invitationData: Partial<ProjectInvitation>,
  ): Promise<ProjectInvitation> {
    const invitation = await this.getProjectInvitation(id);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    // If token is being updated, update the token map
    if (invitationData.token && invitationData.token !== invitation.token) {
      this.invitationsByToken.delete(invitation.token);
      this.invitationsByToken.set(invitationData.token, id);
    }

    const updatedInvitation = { ...invitation, ...invitationData };
    this.projectInvitations.set(id, updatedInvitation);

    return updatedInvitation;
  }

  async deleteProjectInvitation(id: number): Promise<void> {
    const invitation = await this.getProjectInvitation(id);
    if (invitation) {
      this.invitationsByToken.delete(invitation.token);
      this.projectInvitations.delete(id);
    }
  }

  async acceptInvitation(
    token: string,
    userId: string,
  ): Promise<ProjectMember> {
    const invitation = await this.getInvitationByToken(token);
    if (!invitation) {
      throw new Error("Invitation not found or expired");
    }

    if (invitation.status !== "pending") {
      throw new Error(`Invitation has already been ${invitation.status}`);
    }

    // Check if the invitation is expired
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      await this.updateProjectInvitation(invitation.id, {
        status: "expired",
      });
      throw new Error("Invitation has expired");
    }

    // Check if user exists
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Create project membership
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
    await this.updateProjectInvitation(invitation.id, {
      status: "accepted",
      acceptedAt: new Date(),
    });

    return member;
  }

  // Task methods
  async getAllTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async getTask(id: number): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getTasksByProjectId(projectId: number): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(
      (task) => task.projectId === projectId,
    );
  }

  async createTask(taskData: InsertTask): Promise<Task> {
    const id = this.taskId++;
    const task: Task = {
      ...taskData,
      id,
      createdAt: new Date(),
    };
    this.tasks.set(id, task);

    // Update project task counts
    if (task.projectId) {
      const project = this.projects.get(task.projectId);
      if (project) {
        const updatedProject = {
          ...project,
          totalTasks: project.totalTasks + 1,
          completedTasks:
            task.status === "done"
              ? project.completedTasks + 1
              : project.completedTasks,
        };
        this.projects.set(project.id, updatedProject);
      }
    }

    return task;
  }

  async updateTask(id: number, taskData: Partial<Task>): Promise<Task> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error("Task not found");
    }

    const oldStatus = task.status;
    const updatedTask = { ...task, ...taskData };
    this.tasks.set(id, updatedTask);

    // Update project task counts if status changed
    if (task.projectId && oldStatus !== updatedTask.status) {
      const project = this.projects.get(task.projectId);
      if (project) {
        let completedTasks = project.completedTasks;

        if (oldStatus !== "done" && updatedTask.status === "done") {
          completedTasks += 1;
        } else if (oldStatus === "done" && updatedTask.status !== "done") {
          completedTasks -= 1;
        }

        const progress = Math.round(
          (completedTasks / project.totalTasks) * 100,
        );

        const updatedProject = {
          ...project,
          completedTasks,
          progress,
        };
        this.projects.set(project.id, updatedProject);
      }
    }

    return updatedTask;
  }

  async deleteTask(id: number): Promise<void> {
    const task = this.tasks.get(id);
    if (!task) return;

    this.tasks.delete(id);

    // Update project task counts
    if (task.projectId) {
      const project = this.projects.get(task.projectId);
      if (project) {
        const updatedProject = {
          ...project,
          totalTasks: project.totalTasks - 1,
          completedTasks:
            task.status === "done"
              ? project.completedTasks - 1
              : project.completedTasks,
        };
        this.projects.set(project.id, updatedProject);
      }
    }
  }

  async getSubtasks(parentTaskId: number): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(
      (task) => task.parentTaskId === parentTaskId && task.isSubtask === true,
    );
  }

  // Integration methods
  async getAllIntegrations(): Promise<Integration[]> {
    return Array.from(this.integrations.values());
  }

  async getIntegration(id: number): Promise<Integration | undefined> {
    return this.integrations.get(id);
  }

  async getIntegrationByProvider(
    userId: string,
    provider: string,
  ): Promise<Integration | undefined> {
    return Array.from(this.integrations.values()).find(
      (integration) =>
        integration.userId === userId && integration.provider === provider,
    );
  }

  async createIntegration(
    integrationData: InsertIntegration,
  ): Promise<Integration> {
    const id = this.integrationId++;
    const integration: Integration = {
      ...integrationData,
      id,
      lastSynced: new Date(),
    };
    this.integrations.set(id, integration);
    return integration;
  }

  async updateIntegration(
    id: number,
    integrationData: Partial<Integration>,
  ): Promise<Integration> {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error("Integration not found");
    }

    const updatedIntegration = { ...integration, ...integrationData };
    this.integrations.set(id, updatedIntegration);
    return updatedIntegration;
  }

  async deleteIntegration(id: number): Promise<void> {
    this.integrations.delete(id);
  }

  // Insight methods
  async getAllInsights(): Promise<Insight[]> {
    return Array.from(this.insights.values());
  }

  async getInsight(id: number): Promise<Insight | undefined> {
    return this.insights.get(id);
  }

  async getInsightsByProjectId(projectId: number): Promise<Insight[]> {
    return Array.from(this.insights.values()).filter(
      (insight) => insight.projectId === projectId,
    );
  }

  async createInsight(insightData: InsertInsight): Promise<Insight> {
    const id = this.insightId++;
    const insight: Insight = {
      ...insightData,
      id,
      createdAt: new Date(),
      resolvedAt: null,
    };
    this.insights.set(id, insight);
    return insight;
  }

  async updateInsight(
    id: number,
    insightData: Partial<Insight>,
  ): Promise<Insight> {
    const insight = this.insights.get(id);
    if (!insight) {
      throw new Error("Insight not found");
    }

    const updatedInsight = { ...insight, ...insightData };
    this.insights.set(id, updatedInsight);
    return updatedInsight;
  }

  async deleteInsight(id: number): Promise<void> {
    this.insights.delete(id);
  }

  // Kanban Column methods
  async getKanbanColumns(projectId: number): Promise<KanbanColumn[]> {
    return Array.from(this.kanbanColumns.values())
      .filter((column) => column.projectId === projectId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async getAllKanbanColumns(): Promise<KanbanColumn[]> {
    return Array.from(this.kanbanColumns.values());
  }

  async getKanbanColumnById(id: number): Promise<KanbanColumn | undefined> {
    return this.kanbanColumns.get(id);
  }

  async createKanbanColumn(
    columnData: InsertKanbanColumn,
  ): Promise<KanbanColumn> {
    const id = this.kanbanColumnId++;
    const column: KanbanColumn = {
      ...columnData,
      id,
      createdAt: new Date(),
    };
    this.kanbanColumns.set(id, column);
    return column;
  }

  async updateKanbanColumn(
    id: number,
    columnData: Partial<KanbanColumn>,
  ): Promise<KanbanColumn> {
    const column = this.kanbanColumns.get(id);
    if (!column) {
      throw new Error("Kanban column not found");
    }

    const updatedColumn = { ...column, ...columnData };
    this.kanbanColumns.set(id, updatedColumn);
    return updatedColumn;
  }

  async deleteKanbanColumn(id: number): Promise<void> {
    this.kanbanColumns.delete(id);
  }

  async getDefaultKanbanColumns(projectId: number): Promise<KanbanColumn[]> {
    // Check if columns already exist for this project
    const existingColumns = await this.getKanbanColumns(projectId);
    if (existingColumns.length > 0) {
      return existingColumns;
    }

    // Create default columns
    const defaultColumns: InsertKanbanColumn[] = [
      {
        projectId,
        title: "To Do",
        status: "todo",
        color: "bg-slate-100",
        iconName: "circle",
        order: 0,
      },
      {
        projectId,
        title: "In Progress",
        status: "in-progress",
        color: "bg-blue-100",
        iconName: "arrow-right",
        order: 1,
      },
      {
        projectId,
        title: "Done",
        status: "done",
        color: "bg-green-100",
        iconName: "check-circle-2",
        order: 2,
      },
    ];

    const createdColumns: KanbanColumn[] = [];
    for (const columnData of defaultColumns) {
      const column = await this.createKanbanColumn(columnData);
      createdColumns.push(column);
    }

    return createdColumns;
  }

  // JIRA Integration methods - stub implementations for MemStorage
  async createJiraIntegration(
    integration: InsertJiraIntegration,
  ): Promise<JiraIntegration> {
    throw new Error("JIRA integrations not supported in memory storage");
  }

  async getJiraIntegration(
    userId: string,
  ): Promise<JiraIntegration | undefined> {
    return undefined;
  }

  async getJiraIntegrationById(
    id: number,
  ): Promise<JiraIntegration | undefined> {
    return undefined;
  }

  async updateJiraIntegration(
    id: number,
    integration: Partial<InsertJiraIntegration>,
  ): Promise<JiraIntegration> {
    throw new Error("JIRA integrations not supported in memory storage");
  }

  async deleteJiraIntegration(id: number): Promise<void> {
    throw new Error("JIRA integrations not supported in memory storage");
  }

  // User Story methods - stub implementations for MemStorage
  async createUserStory(story: InsertUserStory): Promise<UserStory> {
    throw new Error("User stories not supported in memory storage");
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
    throw new Error("User stories not supported in memory storage");
  }

  async deleteUserStory(id: number): Promise<void> {
    throw new Error("User stories not supported in memory storage");
  }

  // Story Estimation methods - stub implementations for MemStorage
  async createStoryEstimation(
    estimation: InsertStoryEstimation,
  ): Promise<StoryEstimation> {
    throw new Error("Story estimations not supported in memory storage");
  }

  async getStoryEstimations(storyId: number): Promise<StoryEstimation[]> {
    return [];
  }

  // JIRA Sync methods - stub implementations for MemStorage
  async createJiraSyncLog(log: InsertJiraSyncLog): Promise<JiraSyncLog> {
    throw new Error("JIRA sync logs not supported in memory storage");
  }

  async getJiraSyncLogs(integrationId: number): Promise<JiraSyncLog[]> {
    return [];
  }

  // Social Media Account methods - MemStorage implementation
  async createSocialMediaAccount(
    account: InsertSocialMediaAccount,
  ): Promise<SocialMediaAccount> {
    throw new Error("Social media features not available in memory storage");
  }

  async getSocialMediaAccounts(userId: string): Promise<SocialMediaAccount[]> {
    return [];
  }

  async getSocialMediaAccount(
    id: number,
  ): Promise<SocialMediaAccount | undefined> {
    return undefined;
  }

  async updateSocialMediaAccount(
    id: number,
    account: Partial<SocialMediaAccount>,
  ): Promise<SocialMediaAccount> {
    throw new Error("Social media features not available in memory storage");
  }

  async deleteSocialMediaAccount(id: number): Promise<void> {
    // No-op in memory storage
  }

  // Social Media Goal methods
  async createSocialMediaGoal(
    goal: InsertSocialMediaGoal,
  ): Promise<SocialMediaGoal> {
    throw new Error("Social media features not available in memory storage");
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
    throw new Error("Social media features not available in memory storage");
  }

  async deleteSocialMediaGoal(id: number): Promise<void> {
    // No-op in memory storage
  }

  // Social Media Brand Profile methods
  async createSocialMediaBrandProfile(
    profile: InsertSocialMediaBrandProfile,
  ): Promise<SocialMediaBrandProfile> {
    throw new Error("Social media features not available in memory storage");
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
    throw new Error("Social media features not available in memory storage");
  }

  async deleteSocialMediaBrandProfile(id: number): Promise<void> {
    // No-op in memory storage
  }

  // Social Media Post methods
  async createSocialMediaPost(
    post: InsertSocialMediaPost,
  ): Promise<SocialMediaPost> {
    throw new Error("Social media features not available in memory storage");
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
    throw new Error("Social media features not available in memory storage");
  }

  async deleteSocialMediaPost(id: number): Promise<void> {
    // No-op in memory storage
  }

  async getScheduledPosts(userId: string): Promise<SocialMediaPost[]> {
    return [];
  }

  // Social Media Post Metrics methods
  async createSocialMediaPostMetrics(
    metrics: InsertSocialMediaPostMetrics,
  ): Promise<SocialMediaPostMetrics> {
    throw new Error("Social media features not available in memory storage");
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
    throw new Error("Social media features not available in memory storage");
  }

  // Social Media Content Template methods
  async createSocialMediaContentTemplate(
    template: InsertSocialMediaContentTemplate,
  ): Promise<SocialMediaContentTemplate> {
    throw new Error("Social media features not available in memory storage");
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
    throw new Error("Social media features not available in memory storage");
  }

  async deleteSocialMediaContentTemplate(id: number): Promise<void> {
    // No-op in memory storage
  }

  // AI Agent methods
  async createAiAgent(agent: InsertAiAgent): Promise<AiAgent> {
    // Create a default AI agent for demo purposes
    const aiAgent = {
      id: 1,
      name: agent.name,
      description: agent.description,
      agentType: agent.agentType,
      capabilities: agent.capabilities,
      instructions: agent.instructions,
      model: agent.model || "gpt-4o",
      temperature: agent.temperature || 70,
      maxTokens: agent.maxTokens || 2000,
      isActive: agent.isActive ?? true,
      isPublic: agent.isPublic ?? false,
      createdBy: agent.createdBy,
      projectId: agent.projectId,
      avatar: agent.avatar || "🤖",
      color: agent.color || "#3b82f6",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return aiAgent as any;
  }

  async getAiAgents(userId: string): Promise<AiAgent[]> {
    // Return demo AI agents
    return [
      {
        id: 1,
        name: "Task Planner",
        description: "Helps break down complex tasks into manageable steps",
        agentType: "planning",
        capabilities: ["task_management", "project_planning"],
        instructions: "Break down tasks into smaller, actionable items",
        model: "gpt-4o",
        temperature: 70,
        maxTokens: 2000,
        isActive: true,
        isPublic: false,
        createdBy: userId,
        projectId: null,
        avatar: "📋",
        color: "#3b82f6",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        name: "Content Creator",
        description: "AI assistant for content creation and copywriting",
        agentType: "content",
        capabilities: ["content_creation", "copywriting"],
        instructions: "Create engaging and helpful content",
        model: "gpt-4o",
        temperature: 80,
        maxTokens: 2000,
        isActive: true,
        isPublic: false,
        createdBy: userId,
        projectId: null,
        avatar: "✍️",
        color: "#f59e0b",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  async getAiAgent(id: number): Promise<AiAgent | undefined> {
    const agents = await this.getAiAgents("demo-user");
    return agents.find((agent) => agent.id === id);
  }

  async updateAiAgent(id: number, agent: Partial<AiAgent>): Promise<AiAgent> {
    const existingAgent = await this.getAiAgent(id);
    if (!existingAgent) {
      throw new Error("Agent not found");
    }
    return { ...existingAgent, ...agent, updatedAt: new Date() } as AiAgent;
  }

  async deleteAiAgent(id: number): Promise<void> {
    // No-op in memory storage
  }

  async getAiAgentsForProject(projectId: number): Promise<AiAgent[]> {
    return [];
  }

  // Task Priority Score methods
  async getTaskPriorityScore(
    taskId: number,
  ): Promise<TaskPriorityScore | undefined> {
    // Return mock data for memory storage
    return undefined;
  }

  async getTaskPriorityScores(taskIds: number[]): Promise<TaskPriorityScore[]> {
    // Return empty array for memory storage
    return [];
  }

  async createTaskPriorityScore(
    score: InsertTaskPriorityScore,
  ): Promise<TaskPriorityScore> {
    // Return mock created score
    return {
      id: crypto.randomInt(0, 1_000_000_000),
      taskId: score.taskId,
      priorityScore: score.priorityScore,
      roiLevel: score.roiLevel || "medium",
      effortLevel: score.effortLevel || "medium",
      urgencyLevel: score.urgencyLevel || "medium",
      strategicFit: score.strategicFit || "medium",
      recommendation: score.recommendation || "",
      confidence: score.confidence || 75,
      weightingProfile: score.weightingProfile || "balanced",
      analysisData: score.analysisData || {},
      generatedBy: score.generatedBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateTaskPriorityScore(
    taskId: number,
    score: Partial<TaskPriorityScore>,
  ): Promise<TaskPriorityScore> {
    // Return mock updated score
    return {
      id: crypto.randomInt(0, 1_000_000_000),
      taskId: taskId,
      priorityScore: score.priorityScore || 50,
      roiLevel: score.roiLevel || "medium",
      effortLevel: score.effortLevel || "medium",
      urgencyLevel: score.urgencyLevel || "medium",
      strategicFit: score.strategicFit || "medium",
      recommendation: score.recommendation || "",
      confidence: score.confidence || 75,
      weightingProfile: score.weightingProfile || "balanced",
      analysisData: score.analysisData || {},
      generatedBy: score.generatedBy || "system",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // Budget Estimate methods
  async createBudgetEstimate(
    estimate: InsertBudgetEstimate,
  ): Promise<BudgetEstimate> {
    return {
      id: crypto.randomInt(0, 1_000_000_000),
      ...estimate,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getBudgetEstimate(id: number): Promise<BudgetEstimate | undefined> {
    // Return mock data for MemStorage
    return undefined;
  }

  async getBudgetEstimates(userId: string): Promise<BudgetEstimate[]> {
    return [];
  }

  async updateBudgetEstimate(
    id: number,
    estimate: Partial<BudgetEstimate>,
  ): Promise<BudgetEstimate> {
    return {
      id,
      projectId: estimate.projectId || null,
      name: estimate.name || "Budget Estimate",
      description: estimate.description || "",
      status: estimate.status || "draft",
      totalAmount: estimate.totalAmount || 0,
      currency: estimate.currency || "USD",
      clientName: estimate.clientName || "",
      clientEmail: estimate.clientEmail || "",
      clientCompany: estimate.clientCompany || "",
      validUntil: estimate.validUntil || null,
      terms: estimate.terms || "",
      notes: estimate.notes || "",
      createdBy: estimate.createdBy || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as BudgetEstimate;
  }

  async deleteBudgetEstimate(id: number): Promise<void> {
    return;
  }

  // Budget Line Item methods
  async createBudgetLineItem(
    item: InsertBudgetLineItem,
  ): Promise<BudgetLineItem> {
    return {
      id: crypto.randomInt(0, 1_000_000_000),
      ...item,
    };
  }

  async getBudgetLineItems(budgetId: number): Promise<BudgetLineItem[]> {
    return [];
  }

  async updateBudgetLineItem(
    id: number,
    item: Partial<BudgetLineItem>,
  ): Promise<BudgetLineItem> {
    return {
      id,
      budgetId: item.budgetId || 0,
      taskId: item.taskId || null,
      category: item.category || "",
      description: item.description || "",
      quantity: item.quantity || 1,
      rate: item.rate || 0,
      hours: item.hours || 0,
      totalAmount: item.totalAmount || 0,
      role: item.role || "",
      position: item.position || 0,
    } as BudgetLineItem;
  }

  async deleteBudgetLineItem(id: number): Promise<void> {
    return;
  }

  // Task Comment methods (stub implementations for MemStorage)
  async getTaskComments(taskId: number): Promise<TaskComment[]> {
    return [];
  }

  async createTaskComment(comment: InsertTaskComment): Promise<TaskComment> {
    return {
      id: crypto.randomInt(0, 1_000_000_000),
      taskId: comment.taskId,
      userId: comment.userId,
      content: comment.content,
      parentCommentId: comment.parentCommentId || null,
      isEdited: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateTaskComment(id: number, comment: Partial<TaskComment>): Promise<TaskComment> {
    return {
      id,
      taskId: comment.taskId || 0,
      userId: comment.userId || "",
      content: comment.content || "",
      parentCommentId: comment.parentCommentId || null,
      isEdited: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async deleteTaskComment(id: number): Promise<void> {
    return;
  }

  // Task Attachment methods (stub implementations for MemStorage)
  async getTaskAttachments(taskId: number): Promise<TaskAttachment[]> {
    return [];
  }

  async createTaskAttachment(attachment: InsertTaskAttachment): Promise<TaskAttachment> {
    return {
      id: crypto.randomInt(0, 1_000_000_000),
      taskId: attachment.taskId,
      userId: attachment.userId,
      filename: attachment.filename,
      originalName: attachment.originalName,
      fileType: attachment.fileType,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      uploadPath: attachment.uploadPath,
      createdAt: new Date(),
    };
  }

  async deleteTaskAttachment(id: number): Promise<void> {
    return;
  }

  async getEvidenceByInsightType(userId: string, insightType?: string): Promise<EvidenceItem[]> {
    return [];
  }
}

import { DatabaseStorage } from "./database-storage";

// Use DatabaseStorage with PostgreSQL database
export const storage = new DatabaseStorage();
