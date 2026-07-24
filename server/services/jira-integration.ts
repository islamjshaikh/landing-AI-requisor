// Refactored JiraIntegrationService with improved field handling, epic linking, and dynamic epic name

import axios from "axios";
import { DatabaseStorage } from "../database-storage";
import { JiraIntegration, UserStory } from "@shared/schema";

const storage = new DatabaseStorage();

export class JiraIntegrationService {
  // Generate the basic auth header for Jira
  private getAuthHeader(integration: JiraIntegration): string {
    // Trim email and apiToken to remove any whitespace
    const email = integration.email.trim();
    const apiToken = integration.apiToken.trim();
    const credentials = `${email}:${apiToken}`;
    const encoded = Buffer.from(credentials).toString("base64");
    return `Basic ${encoded}`;
  }

  // Format Jira REST API URL
  private getApiUrl(integration: JiraIntegration, path: string): string {
    let baseUrl = integration.jiraUrl.replace(/\/$/, "");
    // Ensure URL has https:// prefix
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    return `${baseUrl}/rest/api/3${path}`;
  }

  /**
   * Create a Jira issue (Task or Epic)
   * @param integration Jira integration credentials
   * @param story Story or epic object to convert to Jira issue
   * @param projectKey Jira project key
   * @param issueType Either 'Task' or 'Epic'
   * @param epicLinkFieldId Jira's epic link field ID for stories (e.g., 'customfield_10008')
   * @param storyPointsFieldId Jira's story points field ID (e.g., 'customfield_10016')
   */
  async createIssue(
    integration: JiraIntegration,
    story: any,
    projectKey: string,
    issueType: string = "Task",
    epicLinkFieldId?: string,
    storyPointsFieldId?: string,
  ): Promise<any> {
    // Convert plain text description to Atlassian Document Format (ADF)
    const descriptionText = story.story || story.description || "";
    const descriptionADF = descriptionText ? {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: descriptionText
            }
          ]
        }
      ]
    } : undefined;

    const fields: any = {
      project: { key: projectKey },
      summary: story.title,
      description: descriptionADF,
      issuetype: { name: issueType },
    };

    // Note: Priority field is not added because many JIRA projects don't have it configured
    // in their screen schemes. If your JIRA project supports priority, uncomment the line below:
    // fields.priority = { name: this.mapPriorityToJira(story.priority || "medium") };

    // Add story points if available and field ID is known
    if (story.storyPoints && storyPointsFieldId) {
      fields[storyPointsFieldId] = story.storyPoints;
    }

    // Link story to epic if it's a Task and epic info is provided
    if (story.epicId && epicLinkFieldId && issueType === "Task") {
      fields[epicLinkFieldId] = story.epicId;
    }

    // Add acceptance criteria to description if available
    if (story.acceptanceCriteria && Array.isArray(story.acceptanceCriteria) && story.acceptanceCriteria.length > 0) {
      // Append acceptance criteria as a bulleted list to the description
      const acceptanceCriteriaContent = [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Acceptance Criteria:",
              marks: [{ type: "strong" }]
            }
          ]
        },
        {
          type: "bulletList",
          content: story.acceptanceCriteria.map((criterion: string) => ({
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: criterion
                  }
                ]
              }
            ]
          }))
        }
      ];

      // If we have a description, append acceptance criteria to it
      if (descriptionADF) {
        descriptionADF.content.push(...acceptanceCriteriaContent);
      } else {
        // If no description, create ADF with just acceptance criteria
        fields.description = {
          type: "doc",
          version: 1,
          content: acceptanceCriteriaContent
        };
      }
    }

    // Don't set Epic Name field since we're creating Tasks, not Epics
    // (BETA project doesn't support Epic issue type)

    try {
      const response = await axios.post(
        this.getApiUrl(integration, "/issue"),
        { fields },
        {
          headers: {
            Authorization: this.getAuthHeader(integration),
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 30000,
        },
      );

      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        console.error("JIRA API Error Response:", JSON.stringify(error.response.data, null, 2));
        console.error("Request fields sent:", JSON.stringify(fields, null, 2));
        console.error("Issue type attempted:", issueType);

        // Log the actual error details
        if (error.response.data.errors) {
          console.error("Field-specific errors:", JSON.stringify(error.response.data.errors, null, 2));
          // Also log each field error individually
          Object.entries(error.response.data.errors).forEach(([field, message]) => {
            console.error(`Field '${field}' error: ${message}`);
          });
        }
        if (error.response.data.errorMessages) {
          console.error("Error messages:", error.response.data.errorMessages);
        }
      }

      // Check if it's an authentication error
      if (error.response?.status === 401) {
        const authError = new Error("JIRA authentication failed. API token may have expired.");
        (authError as any).code = 'JIRA_AUTH_EXPIRED';
        (authError as any).status = 401;
        throw authError;
      }

      throw error;
    }
  }

  /**
   * Export a full plan (epics + selected stories) to Jira
   */
  async exportPlanToJira(
    credentialId: number,
    plan: any,
    selectedStoryIds: string[],
  ): Promise<any> {
    const integration = await storage.getJiraIntegrationById(credentialId);
    if (!integration?.isActive)
      throw new Error("No active Jira integration found");

    // Ideally fetched from field metadata, but hardcoded fallback below
    const epicLinkFieldId = "customfield_10008";
    const storyPointsFieldId = "customfield_10016";

    // Get project key from the plan - it should be passed from the frontend
    const projectKey = plan.projectKey || "DEFAULT";
    console.log("Exporting to JIRA project:", projectKey);

    // Fetch available issue types for the project
    console.log("Fetching issue types for project:", projectKey);
    let issueTypes: any[] = [];
    try {
      issueTypes = await this.getProjectIssueTypes(integration, projectKey);
      console.log("Raw issue types response:", JSON.stringify(issueTypes, null, 2));
    } catch (error: any) {
      console.error("Failed to fetch issue types:", error.message);
      console.error("Error details:", error.response?.data);
      // Continue with defaults if we can't fetch issue types
      issueTypes = [];
    }

    // Map issue type names to determine what's available
    const issueTypeNames = issueTypes.map((t: any) => t.name.toLowerCase());
    console.log("Available issue type names:", issueTypeNames);

    // Determine issue types to use based on what's available
    let epicIssueType = "Epic";
    let storyIssueType = "Story";

    // Check if Epic issue type exists, otherwise use Story or Task
    if (!issueTypeNames.includes("epic")) {
      if (issueTypeNames.includes("story")) {
        epicIssueType = "Story";
      } else if (issueTypeNames.includes("task")) {
        epicIssueType = "Task";
      } else if (issueTypeNames.includes("issue")) {
        epicIssueType = "Issue";
      } else if (issueTypes.length > 0) {
        // Use the first available issue type if none of the standard ones match
        epicIssueType = issueTypes[0].name;
      }
    }

    // Check if Story issue type exists, otherwise use Task
    if (!issueTypeNames.includes("story")) {
      if (issueTypeNames.includes("task")) {
        storyIssueType = "Task";
      } else if (issueTypeNames.includes("issue")) {
        storyIssueType = "Issue";
      } else if (issueTypes.length > 0) {
        // Use the first available issue type if none of the standard ones match
        storyIssueType = issueTypes[0].name;
      }
    }

    console.log("=== ISSUE TYPE DETECTION COMPLETE ===");
    console.log("Using issue types - Epic:", epicIssueType, "Story:", storyIssueType);
    console.log("Project Key:", projectKey);
    console.log("=====================================");

    const relevantEpics =
      plan?.initiative?.epics?.filter((epic: any) =>
        epic.stories?.some((s: any) => selectedStoryIds.includes(s.id)),
      ) || [];

    const createdItems: any[] = [];
    let epicsCreated = 0;
    let storiesCreated = 0;
    const errors: string[] = [];

    for (const epic of relevantEpics) {
      try {
        // Create the epic using appropriate issue type
        console.log(`\n=== Creating Epic: "${epic.name}" ===`);
        console.log("Issue Type:", epicIssueType);
        console.log("Project Key:", projectKey);

        const epicData = await this.createIssue(
          integration,
          {
            ...epic,
            title: epicIssueType === "Epic" ? epic.name : `[Epic] ${epic.name}`,
          },
          projectKey,
          epicIssueType,
          epicLinkFieldId,
          storyPointsFieldId,
        );

        epicsCreated++;
        createdItems.push({
          type: "epic",
          title: epic.name,
          jiraKey: epicData.key,
        });

        // Create selected stories within the epic
        const stories = epic.stories.filter((s: any) =>
          selectedStoryIds.includes(s.id),
        );

        for (const story of stories) {
          try {
            const storyData = await this.createIssue(
              integration,
              {
                ...story,
                epicId: epicData.key,
              },
              projectKey,
              storyIssueType,
              epicLinkFieldId,
              storyPointsFieldId,
            );
            storiesCreated++;
            createdItems.push({
              type: "story",
              title: story.title,
              jiraKey: storyData.key,
            });
          } catch (err: any) {
            errors.push(`Story \"${story.title}\" failed: ${err.message}`);
          }
        }
      } catch (err: any) {
        console.error(`Failed to create epic "${epic.name}":`);
        console.error("Error:", err.message);
        if (err.response?.data) {
          console.error("JIRA Response:", JSON.stringify(err.response.data, null, 2));
        }
        errors.push(`Failed to create epic "${epic.name}": ${err.message}`);
      }
    }

    return {
      success: true,
      epicsCreated,
      storiesCreated,
      totalItemsCreated: epicsCreated + storiesCreated,
      errors,
      createdItems,
      jiraUrl: `${integration.jiraUrl}/browse/${projectKey}`,
    };
  }

  // Maps internal priority values to Jira priority levels
  private mapPriorityToJira(priority: string): string {
    const map: Record<string, string> = {
      critical: "Highest",
      high: "High",
      medium: "Medium",
      low: "Low",
    };
    return map[priority] || "Medium";
  }

  /**
   * Get available issue types for a project
   */
  async getProjectIssueTypes(integration: JiraIntegration, projectKey: string): Promise<any[]> {
    try {
      console.log("Getting issue types for project:", projectKey);

      const response = await axios.get(
        this.getApiUrl(integration, `/project/${projectKey}`),
        {
          headers: {
            Authorization: this.getAuthHeader(integration),
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          params: {
            expand: "issueTypes"
          },
          timeout: 30000,
        }
      );

      const issueTypes = response.data?.issueTypes || [];
      console.log("Available issue types:", issueTypes.map((t: any) => ({ id: t.id, name: t.name })));

      return issueTypes;
    } catch (error: any) {
      console.error("Error fetching project issue types:", error.message);
      // Return empty array on error to use default fallback
      return [];
    }
  }

  /**
   * Get all projects from JIRA
   */
  async getProjects(integration: JiraIntegration): Promise<any[]> {
    try {
      console.log("Getting projects from JIRA for:", integration.jiraUrl);
      console.log("Using email:", integration.email);
      console.log("API URL:", this.getApiUrl(integration, "/project"));

      const response = await axios.get(
        this.getApiUrl(integration, "/project"),
        {
          headers: {
            Authorization: this.getAuthHeader(integration),
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      console.log("JIRA projects response status:", response.status);
      console.log("JIRA projects count:", response.data?.length || 0);
      console.log("JIRA projects raw data:", JSON.stringify(response.data));

      if (response.data && Array.isArray(response.data)) {
        // Return simplified project objects
        return response.data.map((project: any) => ({
          id: project.id,
          key: project.key,
          name: project.name,
          projectTypeKey: project.projectTypeKey || 'software'
        }));
      }

      return [];
    } catch (error: any) {
      console.error("Error fetching JIRA projects:", error.message);
      console.error("Error details:", error.response?.data);

      // Check if it's an authentication error
      if (error.response?.status === 401) {
        const authError = new Error("JIRA authentication failed. API token may have expired.");
        (authError as any).code = 'JIRA_AUTH_EXPIRED';
        (authError as any).status = 401;
        throw authError;
      }

      // If it's a 404, it might be that the user doesn't have access to any projects
      if (error.response?.status === 404) {
        console.log("No projects found or user doesn't have access");
        return [];
      }

      throw error;
    }
  }

  /**
   * Get project metadata including available issue types
   */
  async getProjectMetadata(integration: JiraIntegration, projectKey: string): Promise<any> {
    try {
      const url = this.getApiUrl(integration, `/project/${projectKey}`);
      const authHeader = this.getAuthHeader(integration);

      console.log("Getting project metadata for:", projectKey);

      const response = await axios.get(url, {
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
      });

      const project = response.data;
      console.log("Project issue types:", project.issueTypes?.map((t: any) => ({ id: t.id, name: t.name, subtask: t.subtask })));

      return {
        key: project.key,
        name: project.name,
        issueTypes: project.issueTypes?.map((type: any) => ({
          id: type.id,
          name: type.name,
          description: type.description,
          subtask: type.subtask,
          iconUrl: type.iconUrl
        })) || []
      };
    } catch (error: any) {
      console.error("Error getting project metadata:", error.message);
      if (error.response?.data) {
        console.error("JIRA API Error:", error.response.data);
      }
      throw error;
    }
  }

  /**
   * Get current user from JIRA
   */
  async getCurrentUser(integration: JiraIntegration): Promise<any> {
    try {
      const url = this.getApiUrl(integration, "/myself");
      const authHeader = this.getAuthHeader(integration);

      console.log("Getting current user from JIRA URL:", url);
      console.log("Using email for auth:", integration.email);

      const response = await axios.get(url, {
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
      });

      console.log("Current JIRA user:", response.data.accountId, response.data.displayName);
      return response.data;
    } catch (error: any) {
      console.error("Error getting current user:", error.message);
      console.error("Error details:", error.response?.data);
      throw new Error("Failed to authenticate with JIRA. Please check your credentials.");
    }
  }

  /**
   * Create a new JIRA project
   */
  async createProject(
    integration: JiraIntegration,
    projectData: {
      name: string;
      key: string;
      description?: string;
      projectTypeKey?: string;
      leadAccountId?: string;
    }
  ): Promise<any> {
    try {
      console.log("Creating JIRA project:", projectData.name);

      // Get current user's account ID if not provided
      let leadAccountId = projectData.leadAccountId;
      if (!leadAccountId) {
        try {
          const currentUser = await this.getCurrentUser(integration);
          leadAccountId = currentUser?.accountId;
          console.log("Using account ID from current user:", leadAccountId);
        } catch (error) {
          console.error("Failed to get current user, proceeding without leadAccountId");
          // Continue without leadAccountId - some JIRA instances allow this
        }
      }

      const requestBody: any = {
        key: projectData.key.toUpperCase().trim(), // JIRA keys are always uppercase and trimmed
        name: projectData.name.trim(),
        description: projectData.description || `Project created by Requisor`,
        projectTypeKey: projectData.projectTypeKey || "software",
      };

      // Only add leadAccountId if we have a valid one
      if (leadAccountId && leadAccountId !== integration.email) {
        requestBody.leadAccountId = leadAccountId;
        requestBody.assigneeType = "PROJECT_LEAD";
      }

      console.log("Create project request body:", requestBody);

      const response = await axios.post(
        this.getApiUrl(integration, "/project"),
        requestBody,
        {
          headers: {
            Authorization: this.getAuthHeader(integration),
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      console.log("JIRA create project response status:", response.status);
      console.log("Created project:", response.data);

      return {
        success: true,
        project: {
          id: response.data.id,
          key: response.data.key,
          name: projectData.name,
          self: response.data.self
        }
      };
    } catch (error: any) {
      console.error("Error creating JIRA project:", error.message);
      console.error("Error details:", error.response?.data);

      // Check if it's an authentication error - throw it so route handler can catch it
      if (error.response?.status === 401) {
        const authError = new Error("JIRA authentication failed. API token may have expired.");
        (authError as any).code = 'JIRA_AUTH_EXPIRED';
        (authError as any).status = 401;
        throw authError;
      }

      // Extract specific error message from JIRA
      let errorMessage = "Failed to create project";
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        errorMessage = Object.values(errors).join(", ");
      } else if (error.response?.data?.errorMessages) {
        errorMessage = error.response.data.errorMessages.join(", ");
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }
}

// Singleton export
export const jiraIntegration = new JiraIntegrationService();

// Export the function directly for easier import
export const exportPlanToJira = (credentialId: number, plan: any, selectedStoryIds: string[]) => 
  jiraIntegration.exportPlanToJira(credentialId, plan, selectedStoryIds);
