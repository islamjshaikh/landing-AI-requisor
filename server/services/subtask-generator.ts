import OpenAI from "openai";
import { getAiClient } from "./ai-provider";
import { storage } from "../storage";
import type { Task } from "@shared/schema";
import { trackTokenUsage, getModelForBudget } from "./token-tracker";

const openai = (getAiClient() as any);

export async function generateSubtasksWithAI(task: Task, userId: string): Promise<Task[]> {
  try {
    // Calculate due dates based on parent task
    const parentDueDate = task.dueDate ? new Date(task.dueDate) : null;
    const today = new Date();
    
    // Generate subtasks using OpenAI
    const subtaskModel = await getModelForBudget(userId, "gpt-4o");
    const completion = await openai.chat.completions.create({
      model: subtaskModel,
      messages: [
        {
          role: "system",
          content: `You are an expert project manager breaking down tasks into subtasks. Generate 3-7 specific, actionable subtasks for the given task. Each subtask should:
- Be clear, specific, and directly related to completing the parent task
- Take between 30 minutes to 4 hours to complete
- Have a logical order and dependencies when applicable
- Cover all aspects needed to complete the parent task

Important: Generate ACTUAL subtask names that make sense for the parent task. For example:
- If parent task is "MSOE Grading and Final Submissions", subtasks might be: "Review all student submissions", "Calculate final grades", "Prepare grade report", "Submit grades to registrar"
- If parent task is "Website Updates and Communication", subtasks might be: "Update homepage content", "Test website functionality", "Draft email announcement", "Send communication to stakeholders"

Return JSON object with this format:
{
  "subtasks": [
    {
      "name": "Specific subtask name that relates to parent task",
      "description": "Brief description of what needs to be done",
      "priority": "high/medium/low based on importance",
      "estimatedHours": 1.5,
      "daysFromNow": 1
    }
  ]
}`
        },
        {
          role: "user",
          content: `Break down this task into meaningful subtasks:
Task: ${task.name}
${task.description ? `Description: ${task.description}` : ''}
Priority: ${task.priority || 'medium'}
${parentDueDate ? `Due Date: ${parentDueDate.toISOString().split('T')[0]}` : ''}

Generate specific subtasks that actually help complete "${task.name}". DO NOT use generic names like "Untitled Task".`
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    if (completion.usage) {
      trackTokenUsage(userId, "subtask-generation", subtaskModel, completion.usage).catch(() => {});
    }

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(response);
    const subtaskList = parsed.subtasks || [];

    // Create subtasks in the database
    const createdSubtasks: Task[] = [];
    
    for (let i = 0; i < subtaskList.length; i++) {
      const subtaskData = subtaskList[i];
      
      // Calculate due date for subtask
      let subtaskDueDate = null;
      if (subtaskData.daysFromNow !== undefined) {
        subtaskDueDate = new Date(today);
        subtaskDueDate.setDate(subtaskDueDate.getDate() + subtaskData.daysFromNow);
        
        // Don't exceed parent due date
        if (parentDueDate && subtaskDueDate > parentDueDate) {
          subtaskDueDate = new Date(parentDueDate);
          subtaskDueDate.setDate(subtaskDueDate.getDate() - (subtaskList.length - i));
        }
      }
      
      const subtask = await storage.createTask({
        name: subtaskData.name || `Step ${i + 1} of ${task.name}`,
        description: subtaskData.description || '',
        projectId: task.projectId,
        parentTaskId: task.id,
        isSubtask: true,
        status: 'todo',
        priority: subtaskData.priority || task.priority || 'medium',
        dueDate: subtaskDueDate,
        assigneeId: task.assigneeId, // Inherit assignee from parent task
        position: i,
        aiGenerated: true
      });
      
      createdSubtasks.push(subtask);
    }

    // Update parent task counts
    if (task.id && createdSubtasks.length > 0) {
      await storage.updateTask(task.id, {
        totalSubtasks: (task.totalSubtasks || 0) + createdSubtasks.length
      });
    }

    return createdSubtasks;
  } catch (error) {
    console.error("Error generating subtasks with AI:", error);
    
    // Fallback: Generate context-aware subtasks based on task name
    let fallbackSubtasks = [];
    
    // Try to generate smarter fallback subtasks based on keywords in task name
    const taskNameLower = task.name.toLowerCase();
    
    if (taskNameLower.includes('grading') || taskNameLower.includes('submission')) {
      fallbackSubtasks = [
        { name: "Review all submissions for completeness", description: "Check that all required documents are submitted" },
        { name: "Evaluate and grade each submission", description: "Apply grading rubric to each submission" },
        { name: "Prepare and submit final grade report", description: "Compile grades and submit to system" }
      ];
    } else if (taskNameLower.includes('website') || taskNameLower.includes('update')) {
      fallbackSubtasks = [
        { name: "Review current website content", description: "Identify areas that need updates" },
        { name: "Update website content and design", description: "Make necessary changes to pages" },
        { name: "Test and publish website changes", description: "Verify changes work correctly and go live" }
      ];
    } else if (taskNameLower.includes('meeting') || taskNameLower.includes('prepare')) {
      fallbackSubtasks = [
        { name: "Create meeting agenda and objectives", description: "Define meeting goals and discussion points" },
        { name: "Prepare presentation materials", description: "Create slides or documents needed" },
        { name: "Send meeting invite and materials", description: "Share agenda with attendees" }
      ];
    } else {
      // Generic fallback
      fallbackSubtasks = [
        { name: `Research and planning for ${task.name}`, description: "Gather requirements and create initial plan" },
        { name: `Implementation of ${task.name}`, description: "Execute the main work" },
        { name: `Testing and review of ${task.name}`, description: "Verify work meets requirements" }
      ];
    }

    const createdSubtasks: Task[] = [];
    const parentDueDate = task.dueDate ? new Date(task.dueDate) : null;
    
    for (let i = 0; i < fallbackSubtasks.length; i++) {
      const subtaskData = fallbackSubtasks[i];
      
      // Calculate due date for subtask
      let subtaskDueDate = null;
      if (parentDueDate) {
        subtaskDueDate = new Date(parentDueDate);
        subtaskDueDate.setDate(subtaskDueDate.getDate() - (fallbackSubtasks.length - i));
      }
      
      const subtask = await storage.createTask({
        name: subtaskData.name,
        description: subtaskData.description,
        projectId: task.projectId,
        parentTaskId: task.id,
        isSubtask: true,
        status: 'todo',
        priority: task.priority || 'medium',
        dueDate: subtaskDueDate,
        assigneeId: task.assigneeId, // Inherit assignee from parent task
        position: i,
        aiGenerated: true
      });
      
      createdSubtasks.push(subtask);
    }

    // Update parent task counts
    if (task.id && createdSubtasks.length > 0) {
      await storage.updateTask(task.id, {
        totalSubtasks: (task.totalSubtasks || 0) + createdSubtasks.length
      });
    }

    return createdSubtasks;
  }
}