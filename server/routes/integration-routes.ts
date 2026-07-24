import { Router } from "express";
import { IntegrationProvider } from "@shared/integrations";
import { createIntegrationService } from "../services/integration";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { config } from "../config/environment";
import { z } from "zod";

const router = Router();

// Get all user integrations
router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.dbUserId || req.user.claims?.sub || req.user.id;
    const integrations = await storage.getAllIntegrations();
    
    // Filter to only show the user's integrations
    const userIntegrations = integrations.filter(integration => integration.userId === userId);
    
    res.json(userIntegrations);
  } catch (error) {
    console.error("Error fetching integrations:", error);
    res.status(500).json({ message: "Failed to fetch integrations" });
  }
});

// Get a specific integration
router.get("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const integrationId = parseInt(req.params.id);
    const integration = await storage.getIntegration(integrationId);
    const userId = req.user.dbUserId || req.user.claims?.sub || req.user.id;
    
    if (!integration) {
      return res.status(404).json({ message: "Integration not found" });
    }
    
    // Check if user has access to this integration
    if (integration.userId !== userId) {
      return res.status(403).json({ message: "You don't have access to this integration" });
    }
    
    res.json(integration);
  } catch (error) {
    console.error("Error fetching integration:", error);
    res.status(500).json({ message: "Failed to fetch integration" });
  }
});

// Get OAuth URL for a provider
router.get("/auth/:provider", isAuthenticated, async (req: any, res) => {
  try {
    const provider = req.params.provider.toLowerCase();
    const userId = req.user.dbUserId || req.user.claims?.sub || req.user.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User ID not found in session" });
    }
    
    // Validate provider
    if (!Object.values(IntegrationProvider).includes(provider as IntegrationProvider)) {
      return res.status(400).json({ message: "Invalid integration provider" });
    }
    
    // Create service instance
    const service = createIntegrationService(userId, provider as IntegrationProvider);
    
    // Get auth URL
    const authUrl = service.getAuthUrl();
    
    console.log(`[JIRA OAuth] Generated auth URL for user ${userId}:`, authUrl);
    
    res.json({ authUrl });
  } catch (error: any) {
    console.error("Error generating auth URL:", error);
    res.status(500).json({ message: error.message || "Failed to generate auth URL" });
  }
});

// Handle OAuth callback (no auth required - this is called by the OAuth provider)
router.get("/oauth/:provider", async (req: any, res) => {
  try {
    const provider = req.params.provider.toLowerCase();
    const { code, state } = req.query;
    
    console.log(`[OAuth Callback] Provider: ${provider}, Code: ${code ? 'present' : 'missing'}, State: ${state || 'MISSING'}`);
    console.log(`[OAuth Callback] Full query params:`, req.query);
    
    if (!code) {
      console.log('[OAuth Callback] Missing code, redirecting with error');
      return res.redirect("/integrations?success=false&error=missing_code");
    }
    
    // Validate that state parameter is present (contains user ID)
    if (!state) {
      console.log('[OAuth Callback] Missing state parameter, redirecting with error');
      return res.redirect("/integrations?success=false&error=missing_state");
    }
    
    // Create service instance using the user ID from state
    const service = createIntegrationService(state as string, provider as IntegrationProvider);
    
    // Handle OAuth callback - use same backend URL as in getAuthUrl
    const redirectUri = `${config.urls.backend}/api/integrations/oauth/${provider}`;
    const success = await service.handleOAuthCallback(code as string, redirectUri);
    
    if (success) {
      // Redirect to integrations page
      res.redirect("/integrations?success=true");
    } else {
      res.redirect("/integrations?success=false");
    }
  } catch (error) {
    console.error("Error handling OAuth callback:", error);
    res.redirect("/integrations?success=false");
  }
});

// Get available workspaces/boards from an integration
router.get("/:id/workspaces", isAuthenticated, async (req: any, res) => {
  try {
    const integrationId = parseInt(req.params.id);
    const integration = await storage.getIntegration(integrationId);
    
    if (!integration) {
      return res.status(404).json({ message: "Integration not found" });
    }
    
    // Check if user has access to this integration
    if (integration.userId !== req.user.id) {
      return res.status(403).json({ message: "You don't have access to this integration" });
    }
    
    // Create service instance
    const service = createIntegrationService(req.user.id, integration.provider as IntegrationProvider);
    await service.initialize();
    
    // Get workspaces
    const workspaces = await service.getWorkspaces();
    
    res.json(workspaces);
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    res.status(500).json({ message: "Failed to fetch workspaces" });
  }
});

// Set workspace for an integration
router.post("/:id/workspace", isAuthenticated, async (req: any, res) => {
  try {
    const integrationId = parseInt(req.params.id);
    const { workspaceId } = req.body;
    
    if (!workspaceId) {
      return res.status(400).json({ message: "Workspace ID is required" });
    }
    
    const integration = await storage.getIntegration(integrationId);
    
    if (!integration) {
      return res.status(404).json({ message: "Integration not found" });
    }
    
    // Check if user has access to this integration
    if (integration.userId !== req.user.id) {
      return res.status(403).json({ message: "You don't have access to this integration" });
    }
    
    // Update integration
    const updatedIntegration = await storage.updateIntegration(integrationId, {
      workspaceId,
    });
    
    res.json(updatedIntegration);
  } catch (error) {
    console.error("Error setting workspace:", error);
    res.status(500).json({ message: "Failed to set workspace" });
  }
});

// Pull projects from integration
router.post("/:id/pull-projects", isAuthenticated, async (req: any, res) => {
  try {
    const integrationId = parseInt(req.params.id);
    const integration = await storage.getIntegration(integrationId);
    
    if (!integration) {
      return res.status(404).json({ message: "Integration not found" });
    }
    
    // Check if user has access to this integration
    if (integration.userId !== req.user.id) {
      return res.status(403).json({ message: "You don't have access to this integration" });
    }
    
    // Create service instance
    const service = createIntegrationService(req.user.id, integration.provider as IntegrationProvider);
    await service.initialize();
    
    // Pull projects
    const result = await service.pullProjects();
    
    if (result.success) {
      // Save projects to database
      const savedProjects = [];
      for (const projectData of result.data) {
        // Check if project already exists
        const existingProjects = await storage.getProjectsForUser(req.user.id);
        const existing = existingProjects.find(p => 
          p.externalId === projectData.externalId && p.source === projectData.source
        );
        
        if (existing) {
          // Update existing project
          const updated = await storage.updateProject(existing.id, {
            name: projectData.name,
            description: projectData.description,
            lastSynced: new Date(),
          });
          savedProjects.push(updated);
        } else {
          // Check project creation limits before creating imported project
          console.log("Checking project creation limits for imported project:", req.user.id);
          const limitCheck = await storage.canUserCreateProject(req.user.id);
          console.log("Project limit check result for import:", limitCheck);
          
          if (!limitCheck.allowed) {
            console.log("Project creation from import blocked:", limitCheck.reason);
            return res.status(403).json({
              message: "Project creation limit reached",
              reason: limitCheck.reason,
              current: limitCheck.current,
              max: limitCheck.max,
              suggestion: "Please upgrade your plan to create more projects."
            });
          }

          // Create new project
          const project = await storage.createProject({
            name: projectData.name,
            description: projectData.description || "",
            ownerId: req.user.id,
            externalId: projectData.externalId,
            source: projectData.source,
            sourceData: projectData.sourceData,
          });
          savedProjects.push(project);
          
          // Add user as project owner
          await storage.addProjectMember({
            projectId: project.id,
            userId: req.user.id,
            role: "owner",
          });
        }
      }
      
      res.json({
        success: true,
        message: `Imported ${savedProjects.length} projects`,
        projects: savedProjects,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error("Error pulling projects:", error);
    res.status(500).json({ message: "Failed to pull projects" });
  }
});

// Push a project to integration
router.post("/projects/:projectId/push", isAuthenticated, async (req: any, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { integrationId } = req.body;
    
    if (!integrationId) {
      return res.status(400).json({ message: "Integration ID is required" });
    }
    
    // Check if user has access to the project
    const isAuthorized = await storage.isUserAuthorized(projectId, req.user.id);
    if (!isAuthorized) {
      return res.status(403).json({ message: "You don't have access to this project" });
    }
    
    // Get project and integration
    const project = await storage.getProject(projectId);
    const integration = await storage.getIntegration(parseInt(integrationId));
    
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    if (!integration) {
      return res.status(404).json({ message: "Integration not found" });
    }
    
    // Check if user has access to this integration
    if (integration.userId !== req.user.id) {
      return res.status(403).json({ message: "You don't have access to this integration" });
    }
    
    // Create service instance
    const service = createIntegrationService(req.user.id, integration.provider as IntegrationProvider);
    await service.initialize();
    
    // Push project
    const result = await service.pushProject({
      name: project.name,
      description: project.description,
      externalId: project.externalId || "",
      dueDate: project.dueDate,
    });
    
    if (result.success && result.data) {
      // Update project with external ID
      const updatedProject = await storage.updateProject(projectId, {
        externalId: result.data.externalId,
        source: integration.provider,
        lastSynced: new Date(),
      });
      
      res.json({
        success: true,
        message: `Successfully pushed project to ${integration.provider}`,
        project: updatedProject,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error("Error pushing project:", error);
    res.status(500).json({ message: "Failed to push project" });
  }
});

// Pull tasks from integration for a project
router.post("/projects/:projectId/pull-tasks", isAuthenticated, async (req: any, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    // Check if user has access to the project
    const isAuthorized = await storage.isUserAuthorized(projectId, req.user.id);
    if (!isAuthorized) {
      return res.status(403).json({ message: "You don't have access to this project" });
    }
    
    // Get project
    const project = await storage.getProject(projectId);
    
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    if (!project.source || !project.externalId) {
      return res.status(400).json({ message: "Project is not linked to an external source" });
    }
    
    // Get integration for this source
    const integrations = await storage.getAllIntegrations();
    const integration = integrations.find(
      i => i.userId === req.user.id && i.provider === project.source
    );
    
    if (!integration) {
      return res.status(404).json({ message: "Integration not found for this project source" });
    }
    
    // Create service instance
    const service = createIntegrationService(req.user.id, integration.provider as IntegrationProvider);
    await service.initialize();
    
    // Pull tasks
    const result = await service.pullTasks(projectId, project.externalId);
    
    if (result.success) {
      // Save tasks to database
      const savedTasks = [];
      for (const taskData of result.data) {
        // Check if task already exists
        const existingTasks = await storage.getTasksByProjectId(projectId);
        const existing = existingTasks.find(t => 
          t.externalId === taskData.externalId && t.source === taskData.source
        );
        
        if (existing) {
          // Update existing task
          const updated = await storage.updateTask(existing.id, {
            name: taskData.name,
            description: taskData.description,
            status: taskData.status,
            dueDate: taskData.dueDate,
            priority: taskData.priority,
            lastSynced: new Date(),
          });
          savedTasks.push(updated);
        } else {
          // Create new task
          const task = await storage.createTask({
            name: taskData.name,
            description: taskData.description || "",
            projectId,
            status: taskData.status || "todo",
            dueDate: taskData.dueDate,
            priority: taskData.priority || "medium",
            externalId: taskData.externalId,
            source: taskData.source,
            sourceData: taskData.sourceData,
          });
          savedTasks.push(task);
        }
      }
      
      res.json({
        success: true,
        message: `Imported ${savedTasks.length} tasks`,
        tasks: savedTasks,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error("Error pulling tasks:", error);
    res.status(500).json({ message: "Failed to pull tasks" });
  }
});

// Push a task to integration
router.post("/tasks/:taskId/push", isAuthenticated, async (req: any, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const { integrationId } = req.body;
    
    if (!integrationId) {
      return res.status(400).json({ message: "Integration ID is required" });
    }
    
    // Get task
    const task = await storage.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    // Check if user has access to the project
    const isAuthorized = await storage.isUserAuthorized(task.projectId, req.user.id);
    if (!isAuthorized) {
      return res.status(403).json({ message: "You don't have access to this task's project" });
    }
    
    // Get integration
    const integration = await storage.getIntegration(parseInt(integrationId));
    
    if (!integration) {
      return res.status(404).json({ message: "Integration not found" });
    }
    
    // Check if user has access to this integration
    if (integration.userId !== req.user.id) {
      return res.status(403).json({ message: "You don't have access to this integration" });
    }
    
    // Create service instance
    const service = createIntegrationService(req.user.id, integration.provider as IntegrationProvider);
    await service.initialize();
    
    // Push task
    const result = await service.pushTask({
      name: task.name,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate,
      priority: task.priority,
      projectId: task.projectId,
      externalId: task.externalId,
    });
    
    if (result.success && result.data) {
      // Update task with external ID
      const updatedTask = await storage.updateTask(taskId, {
        externalId: result.data.externalId,
        source: integration.provider,
        lastSynced: new Date(),
      });
      
      res.json({
        success: true,
        message: `Successfully pushed task to ${integration.provider}`,
        task: updatedTask,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error("Error pushing task:", error);
    res.status(500).json({ message: "Failed to push task" });
  }
});

// Delete an integration
router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const integrationId = parseInt(req.params.id);
    const integration = await storage.getIntegration(integrationId);
    
    if (!integration) {
      return res.status(404).json({ message: "Integration not found" });
    }
    
    // Check if user has access to this integration
    if (integration.userId !== req.user.id) {
      return res.status(403).json({ message: "You don't have access to this integration" });
    }
    
    // Delete integration
    await storage.deleteIntegration(integrationId);
    
    res.json({ message: "Integration deleted successfully" });
  } catch (error) {
    console.error("Error deleting integration:", error);
    res.status(500).json({ message: "Failed to delete integration" });
  }
});

export default router;