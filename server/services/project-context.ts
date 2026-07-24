import { db } from "../db";
import { projects, tasks, projectMembers } from "@shared/schema";
import { eq, and, gte, lte, isNull, desc, asc } from "drizzle-orm";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  isBefore,
} from "date-fns";

export interface ProjectSummary {
  id: number;
  name: string;
  status: string;
  progress: number;
  dueDate?: Date;
  createdAt?: Date;
  updatedAt?: Date | null;
  lastOpenedAt?: Date | null;
  taskCount: number;
  completedTasks: number;
  overdueTasks: number;
}

export interface TaskSummary {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate?: Date;
  assignedTo?: string;
  projectId: number;
  projectName: string;
  isOverdue: boolean;
}

export interface ProjectContextData {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  upcomingDeadlines: TaskSummary[];
  recentProjects: ProjectSummary[];
  unassignedTasks: TaskSummary[];
}

export class ProjectContextService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async getAllProjects(): Promise<ProjectSummary[]> {
    try {
      const userProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        progress: projects.progress,
        dueDate: projects.dueDate,

        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,         
        lastOpenedAt: projects.lastOpenedAt,   
      })
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, this.userId))
      .orderBy(desc(projects.createdAt)); // this order is fine; we'll re-sort later by activity


      const projectSummaries: ProjectSummary[] = [];

      for (const project of userProjects) {
        const projectTasks = await db
          .select()
          .from(tasks)
          .where(eq(tasks.projectId, project.id));

        const completedTasks = projectTasks.filter(
          (task) => task.status === "completed",
        ).length;
        const overdueTasks = projectTasks.filter(
          (task) =>
            task.dueDate &&
            isBefore(task.dueDate, new Date()) &&
            task.status !== "completed",
        ).length;

        projectSummaries.push({
          ...project,
          status: project.status || "active",
          progress: project.progress || 0,
          taskCount: projectTasks.length,
          completedTasks,
          overdueTasks,
        });
      }

      return projectSummaries;
    } catch (error) {
      console.error("Error fetching projects:", error);
      return [];
    }
  }

  async getOverdueTasks(): Promise<TaskSummary[]> {
    try {
      const now = new Date();
      const overdueTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          priority: tasks.priority,
          dueDate: tasks.dueDate,
          assignedTo: tasks.assignedTo,
          projectId: tasks.projectId,
          projectName: projects.name,
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
        .where(
          and(
            eq(projectMembers.userId, this.userId),
            lte(tasks.dueDate, now),
            eq(tasks.status, "active"),
          ),
        )
        .orderBy(asc(tasks.dueDate));

      return overdueTasks.map((task) => ({
        ...task,
        isOverdue: true,
      }));
    } catch (error) {
      console.error("Error fetching overdue tasks:", error);
      return [];
    }
  }

  async getUpcomingDeadlines(days: number = 7): Promise<TaskSummary[]> {
    try {
      const now = new Date();
      const futureDate = addDays(now, days);

      const upcomingTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          priority: tasks.priority,
          dueDate: tasks.dueDate,
          assignedTo: tasks.assignedTo,
          projectId: tasks.projectId,
          projectName: projects.name,
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
        .where(
          and(
            eq(projectMembers.userId, this.userId),
            gte(tasks.dueDate, now),
            lte(tasks.dueDate, futureDate),
            eq(tasks.status, "active"),
          ),
        )
        .orderBy(asc(tasks.dueDate));

      return upcomingTasks.map((task) => ({
        ...task,
        isOverdue: false,
      }));
    } catch (error) {
      console.error("Error fetching upcoming deadlines:", error);
      return [];
    }
  }

  async getUnassignedTasks(): Promise<TaskSummary[]> {
    try {
      const unassignedTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          priority: tasks.priority,
          dueDate: tasks.dueDate,
          assignedTo: tasks.assignedTo,
          projectId: tasks.projectId,
          projectName: projects.name,
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
        .where(
          and(
            eq(projectMembers.userId, this.userId),
            isNull(tasks.assignedTo),
            eq(tasks.status, "active"),
          ),
        )
        .orderBy(desc(tasks.createdAt));

      return unassignedTasks.map((task) => ({
        ...task,
        isOverdue: task.dueDate ? isBefore(task.dueDate, new Date()) : false,
      }));
    } catch (error) {
      console.error("Error fetching unassigned tasks:", error);
      return [];
    }
  }

  async getMilestonesForMonth(
    month: string,
    year?: number,
  ): Promise<TaskSummary[]> {
    try {
      const currentYear = year || new Date().getFullYear();
      const monthIndex = new Date(`${month} 1, ${currentYear}`).getMonth();
      const startDate = startOfMonth(new Date(currentYear, monthIndex));
      const endDate = endOfMonth(new Date(currentYear, monthIndex));

      const monthlyTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          priority: tasks.priority,
          dueDate: tasks.dueDate,
          assignedTo: tasks.assignedTo,
          projectId: tasks.projectId,
          projectName: projects.name,
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
        .where(
          and(
            eq(projectMembers.userId, this.userId),
            gte(tasks.dueDate, startDate),
            lte(tasks.dueDate, endDate),
            eq(tasks.priority, "high"), // Consider high priority tasks as milestones
          ),
        )
        .orderBy(asc(tasks.dueDate));

      return monthlyTasks.map((task) => ({
        ...task,
        isOverdue: task.dueDate ? isBefore(task.dueDate, new Date()) : false,
      }));
    } catch (error) {
      console.error("Error fetching monthly milestones:", error);
      return [];
    }
  }

  async getProjectContextData(): Promise<ProjectContextData> {
    try {
      const allProjects = await this.getAllProjects();
      const overdueTasks = await this.getOverdueTasks();
      const upcomingDeadlines = await this.getUpcomingDeadlines();
      const unassignedTasks = await this.getUnassignedTasks();

      const totalTasks = allProjects.reduce(
        (sum, project) => sum + project.taskCount,
        0,
      );
      const completedTasks = allProjects.reduce(
        (sum, project) => sum + project.completedTasks,
        0,
      );

      const recentScore = (p: ProjectSummary) =>
        new Date(
          p.lastOpenedAt ?? p.updatedAt ?? p.createdAt ?? 0
        ).getTime();

      const recentTop3 = allProjects
        .slice()
        .sort((a, b) => recentScore(b) - recentScore(a))
        .slice(0, 3);


      return {
        totalProjects: allProjects.length,
        activeProjects: allProjects.filter((p) => p.status === "active").length,
        completedProjects: allProjects.filter((p) => p.status === "completed")
          .length,
        totalTasks,
        completedTasks,
        overdueTasks: overdueTasks.length,
        upcomingDeadlines,
        recentProjects: recentTop3, // was: allProjects.slice(0, 5)

        unassignedTasks,
      };
    } catch (error) {
      console.error("Error fetching project context data:", error);
      return {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        totalTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
        upcomingDeadlines: [],
        recentProjects: [],
        unassignedTasks: [],
      };
    }
  }

  async assignTasksToUser(
    taskIds: number[],
    assigneeId: string,
  ): Promise<boolean> {
    try {
      for (const taskId of taskIds) {
        await db
          .update(tasks)
          .set({ assignedTo: assigneeId })
          .where(eq(tasks.id, taskId));
      }
      return true;
    } catch (error) {
      console.error("Error assigning tasks:", error);
      return false;
    }
  }

  async rescheduleOverdueTasks(projectId?: number): Promise<boolean> {
    try {
      const now = new Date();
      const newDueDate = addDays(now, 7); // Reschedule to next week

      const whereCondition = projectId
        ? and(
            eq(tasks.projectId, projectId),
            lte(tasks.dueDate, now),
            eq(tasks.status, "active"),
          )
        : and(lte(tasks.dueDate, now), eq(tasks.status, "active"));

      await db.update(tasks).set({ dueDate: newDueDate }).where(whereCondition);

      return true;
    } catch (error) {
      console.error("Error rescheduling overdue tasks:", error);
      return false;
    }
  }
}
