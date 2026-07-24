import { AIProjectPlan } from "@/types";
import IntegrationProvider from "@/types/integration";

// Define the types needed for API requests
/**
 * Interface for creating a new task that matches the server schema
 * @see server/schema.ts for the full definition
 */
export interface NewTask {
  name: string;
  description?: string;
  dueDate?: string; // ISO string format for dates
  priority?: string;
  status?: string;
  isCompleted?: boolean;
  projectId: number;
  parentTaskId?: number | null;
  assigneeId?: string | null;
  source?: string;
  externalId?: string;
}

export interface NewProject {
  name: string;
  description?: string;
  dueDate?: string; // ISO string format for dates
  status?: string;
  progress?: number;
  totalTasks?: number;
  completedTasks?: number;
  icon?: string;
  iconBg?: string;
  source?: string;
  aiGenerated?: boolean;
}

const API_BASE_URL = "/api";

// Generic fetch wrapper with error handling
async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T | null> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Include cookies for authentication
    ...options,
  });

  if (!response.ok) {
    // Handle authentication errors specially
    if (response.status === 401) {
      // Create a proper error for 401 so components can handle it
      const authError: any = new Error("Not authenticated - Please log in");
      authError.status = 401;
      authError.isAuthError = true;
      throw authError;
    }

    // Try to get error response as JSON first
    const contentType = response.headers.get("content-type");
    let errorMessage = "An error occurred";
    let errorDetails = null;

    try {
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
        errorDetails = errorData.details || null;
      } else {
        // If not JSON, get text content for debugging
        const text = await response.text();
        console.error("Non-JSON error response:", text);
        errorMessage = `Server error (${response.status})`;
      }
    } catch (e) {
      console.error("Error parsing error response:", e);
    }

    const error: any = new Error(errorMessage);
    error.status = response.status;
    error.details = errorDetails;

    console.error(`API Error (${response.status}):`, error.message);
    throw error;
  }
  // Handle responses with no content (like 204 No Content)
  if (
    response.status === 204 ||
    !response.headers.get("content-type")?.includes("application/json")
  ) {
    return null;
  }

  return response.json();
}

// User API functions
export async function getUserByUsername(username: string) {
  return fetchApi(`/users/username/${username}`);
}

export async function getCurrentUser() {
  return fetchApi("/auth/user");
}

// Project API functions
export async function getProjects() {
  return fetchApi("/projects");
}

export async function getProject(id: number) {
  console.log("API: Fetching project with ID:", id);
  const result = await fetchApi(`/projects/${id}`);
  console.log("API: Project fetch result:", result);
  return result;
}

export async function createProject(project: NewProject) {
  console.log("API: Creating project with data:", JSON.stringify(project));

  // Add a log to track what's happening with the request
  try {
    const result = await fetchApi("/projects", {
      method: "POST",
      body: JSON.stringify(project),
    });
    console.log(
      "API: Project creation successful, received:",
      JSON.stringify(result),
    );
    return result;
  } catch (error) {
    console.error("API: Project creation failed:", error);
    throw error;
  }
}

export async function updateProject(id: number, project: Partial<NewProject>) {
  // Helper function to safely convert date to ISO string
  const safeToISOString = (value: any): string | undefined => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    try {
      // If it's already a Date object
      if (value instanceof Date) {
        return !isNaN(value.getTime()) ? value.toISOString() : undefined;
      }

      // If it's a string or any other value, try to convert to Date
      const dateObj = new Date(value);
      return !isNaN(dateObj.getTime()) ? dateObj.toISOString() : undefined;
    } catch (e) {
      console.warn("Failed to convert date value:", value, e);
      return undefined;
    }
  };

  // Clean the project data to handle dates properly
  const cleanProject = { ...project };
  if ("dueDate" in project) {
    cleanProject.dueDate = safeToISOString(project.dueDate);
  }

  console.log(
    "Sending project update with data:",
    JSON.stringify(cleanProject),
  );

  try {
    return await fetchApi(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(cleanProject),
    });
  } catch (error) {
    console.error("Error updating project:", error);
    throw error;
  }
}

export async function deleteProject(id: number) {
  return fetchApi(`/projects/${id}`, {
    method: "DELETE",
  });
}

// Task API functions
export async function getTasks(projectId: number) {
  return fetchApi(`/projects/${projectId}/tasks`);
}

export async function getProjectTasks(projectId: number) {
  return fetchApi(`/projects/${projectId}/tasks`);
}

export async function getTask(id: number) {
  return fetchApi(`/tasks/${id}`);
}

export async function createTask(task: NewTask) {
  console.log("API: Creating task with data:", JSON.stringify(task));

  try {
    const result = await fetchApi("/tasks", {
      method: "POST",
      body: JSON.stringify(task),
    });
    console.log(
      "API: Task creation successful, received:",
      JSON.stringify(result),
    );
    return result;
  } catch (error) {
    console.error("API: Task creation failed:", error);
    throw error;
  }
}

export async function updateTask(id: number, task: Partial<NewTask>) {
  // Create a clean task object with only the fields we want to update
  const cleanTask: Record<string, any> = {};

  // Only include fields that are actually set
  if (task.name !== undefined) cleanTask.name = task.name;
  if (task.description !== undefined) cleanTask.description = task.description;
  if (task.priority !== undefined) cleanTask.priority = task.priority;
  if (task.status !== undefined) cleanTask.status = task.status;
  if (task.isCompleted !== undefined) cleanTask.isCompleted = task.isCompleted;
  if (task.assigneeId !== undefined) cleanTask.assigneeId = task.assigneeId;

  // Helper function to safely convert date to date-only string (YYYY-MM-DD)
  // This prevents timezone shift issues when converting dates
  const safeToDateString = (value: any): string | undefined => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    try {
      // If it's already a string in YYYY-MM-DD format, return as-is
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }

      // If it's a Date object or a date string, extract the date portion
      let dateObj: Date;
      if (value instanceof Date) {
        dateObj = value;
      } else {
        dateObj = new Date(value);
      }

      if (isNaN(dateObj.getTime())) {
        return undefined;
      }

      // Use local date components to avoid timezone shift
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) {
      console.warn("Failed to convert date value:", value, e);
      return undefined;
    }
  };

  // Special handling for dueDate
  if ("dueDate" in task) {
    cleanTask.dueDate = safeToDateString(task.dueDate);
  }

  // Special handling for startDate
  if ("startDate" in task) {
    cleanTask.startDate = safeToDateString((task as any).startDate);
  }

  console.log("Sending task update with data:", JSON.stringify(cleanTask));

  try {
    return await fetchApi(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(cleanTask),
    });
  } catch (error) {
    console.error("Error updating task:", error);
    throw error;
  }
}

export async function deleteTask(id: number) {
  return fetchApi(`/tasks/${id}`, {
    method: "DELETE",
  });
}

// NLP Task Updater - processes natural language commands
export async function processNLPTaskCommand(
  command: string,
  projectId: number,
) {
  return fetchApi("/tasks/nlp-update", {
    method: "POST",
    body: JSON.stringify({ command, projectId }),
  });
}

// AI Project planning
export async function generateProjectPlan(idea: string) {
  return fetchApi("/ai/generate-plan", {
    method: "POST",
    body: JSON.stringify({ idea }),
  });
}

export async function createProjectFromPlan(plan: AIProjectPlan) {
  return fetchApi("/projects/from-plan", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

// Integration exports
export async function exportToIntegration(
  plan: AIProjectPlan,
  provider: IntegrationProvider,
) {
  return fetchApi(`/integrations/export/${provider}`, {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

// AI analysis functions
export async function analyzeTask(taskId: number) {
  return fetchApi(`/tasks/${taskId}/analyze`, {
    method: "POST",
  });
}

export async function deepProjectAnalysis(projectId: number) {
  return fetchApi(`/projects/${projectId}/deep-analysis`, {
    method: "GET",
  });
}

export async function getToolRecommendations(taskId: number) {
  // Add cache busting parameter to prevent 304 Not Modified responses
  const timestamp = new Date().getTime();
  return fetchApi(`/tasks/${taskId}/tools?t=${timestamp}`, {
    method: "GET",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function updateToolStatus(
  taskId: number,
  toolId: number,
  status: string,
) {
  return fetchApi(`/tasks/${taskId}/tools/${toolId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// Task synchronization functions
export async function syncTaskWithProvider(
  taskId: number,
  provider: IntegrationProvider,
) {
  return fetchApi(`/tasks/${taskId}/sync/${provider}`, {
    method: "POST",
  });
}

export async function syncTaskStatus(
  taskId: number,
  externalId: string,
  provider: IntegrationProvider,
) {
  return fetchApi(`/tasks/${taskId}/sync-status/${provider}`, {
    method: "POST",
    body: JSON.stringify({ externalId }),
  });
}

export async function pullTasksFromProvider(
  projectId: number,
  provider: IntegrationProvider,
) {
  return fetchApi(`/projects/${projectId}/pull-tasks/${provider}`, {
    method: "POST",
  });
}

// Team collaboration functions
export async function inviteTeamMember(
  projectId: number,
  email: string,
  role: string,
) {
  return fetchApi("/invitations", {
    method: "POST",
    body: JSON.stringify({ projectId, email, role }),
  });
}

export async function createProjectInvitation(
  projectId: number,
  invitation: { email: string; role: string },
) {
  return fetchApi("/invitations", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      email: invitation.email,
      role: invitation.role,
    }),
  });
}

export async function getProjectMembers(projectId: number) {
  return fetchApi(`/projects/${projectId}/members`);
}

export async function addProjectMember(
  projectId: number,
  userId: string,
  role: string,
) {
  return fetchApi(`/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId, role }),
  });
}

export async function removeProjectMember(projectId: number, userId: string) {
  return fetchApi(`/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function updateProjectMemberRole(
  projectId: number,
  userId: string,
  role: string,
) {
  return fetchApi(`/projects/${projectId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function getTeamInvitations(projectId: number) {
  return fetchApi(`/projects/${projectId}/invitations`);
}

export async function getProjectInvitations(projectId: number) {
  return fetchApi(`/projects/${projectId}/invitations`);
}

export async function getUserInvitations() {
  return fetchApi(`/invitations`);
}

export async function acceptInvitation(token: string) {
  return fetchApi(`/invitations/${token}/accept`, {
    method: "POST",
  });
}

export async function deleteInvitation(id: number) {
  return fetchApi(`/invitations/${id}`, {
    method: "DELETE",
  });
}

export async function deleteProjectInvitation(
  projectId: number,
  invitationId: number,
) {
  return fetchApi(`/projects/${projectId}/invitations/${invitationId}`, {
    method: "DELETE",
  });
}
