import OpenAI from "openai";
import { getAiClient } from "./services/ai-provider";
import { trackTokenUsage } from "./services/token-tracker";
import { Task, InsertTask } from "@shared/schema";
import { IStorage } from "./storage";

const openai = (getAiClient() as any);

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ProjectAssistantContext {
  projectId: number;
  projectName: string;
  message?: string;
  conversationHistory?: ChatMessage[];
}

type Priority = "low" | "medium" | "high" | "urgent";

export async function handleProjectAssistantMessage(
  context: ProjectAssistantContext,
  storage: IStorage,
): Promise<{
  response: string;
  actionsPerformed?: boolean;
  suggestedPrompts?: string[];
}> {
  // ---- 1) Load fresh project data ----
  const tasks: Task[] = await storage.getTasksByProjectId(context.projectId);
  const now = Date.now();
  const toMs = (d?: any) => (d ? new Date(d).getTime() : Number.NaN);

  const unassignedTasks = tasks.filter((t) => !t.assigneeId);
  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  };
  const overdueTasks = tasks.filter(
    (t) =>
      t.dueDate &&
      !Number.isNaN(toMs(t.dueDate)) &&
      toMs(t.dueDate) < now &&
      t.status !== "done",
  );

  // A tiny "directory" we can expand later
  const teamDirectory: Array<{ id: string; name: string; email?: string }> = [
    { id: "user1", name: "Alex Chen", email: "alex@example.com" },
    { id: "user2", name: "Sarah Johnson", email: "sarah@example.com" },
    { id: "user3", name: "Mike Davis", email: "mike@example.com" },
  ];

  const systemPrompt = `You are an intelligent virtual assistant managing the "${context.projectName}" project. Act like a helpful human project manager who understands natural language and takes action proactively.

Your capabilities:
- Create, delete, update, and modify any task
- Show project status, progress, and health
- List overdue tasks and upcoming deadlines
- Assign or reassign tasks to team members
- Update task priorities, statuses, and due dates
- Answer questions about the project
- Provide insights and recommendations

How to behave:
- Understand natural language requests without requiring exact formats
- When the user says "create a task", "add a task", "make a task" - you know they want to create a task
- When they say "delete that task", "remove the task", "get rid of it" - you know they want to delete
- When they say "what's the status?", "how are we doing?", "project update?" - call get_status_snapshot
- When they say "show overdue tasks", "what's late?", "overdue items?" - call list_overdue
- When they ask to assign tasks, distribute work, or reassign - use the assign_task tool
- Be conversational and friendly, like talking to a helpful colleague
- If you need more information, ask clear questions
- After taking actions, confirm what you did and offer next steps
- Use bullet points for clarity, but speak naturally

Remember: You're not just answering questions - you're actively managing this project. Take action when appropriate!`;

  // ---- 2) Define tools the model can call ----
  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "create_task",
        description: "Create a new task in the current project",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Short task name/title" },
            description: { type: "string" },
            dueDate: {
              type: "string",
              description: "ISO date (YYYY-MM-DD) or full ISO timestamp",
              nullable: true,
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
              nullable: true,
            },
            assigneeName: {
              type: "string",
              description: "Team member full name",
              nullable: true,
            },
            assigneeId: {
              type: "string",
              description: "Team member id",
              nullable: true,
            },
          },
          required: ["name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_task",
        description: "Delete a task from the project",
        parameters: {
          type: "object",
          properties: {
            taskId: { type: "number", description: "ID of the task to delete" },
          },
          required: ["taskId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "assign_task",
        description: "Assign a task to a team member",
        parameters: {
          type: "object",
          properties: {
            taskId: { type: "number" },
            assigneeName: { type: "string", nullable: true },
            assigneeId: { type: "string", nullable: true },
          },
          required: ["taskId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_task",
        description: "Update a task's fields",
        parameters: {
          type: "object",
          properties: {
            taskId: { type: "number" },
            title: { type: "string", nullable: true },
            description: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["todo", "in_progress", "done"],
              nullable: true,
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
              nullable: true,
            },
            dueDate: { type: "string", nullable: true },
            assigneeId: { type: "string", nullable: true },
          },
          required: ["taskId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_status_snapshot",
        description: "Return a snapshot summary of the project",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "list_overdue",
        description: "List currently overdue tasks",
        parameters: { type: "object", properties: {} },
      },
    },
  ];

  // ---- 3) Local executors for each tool ----
  const toolExecutors: Record<
    string,
    (args: any) => Promise<{ ok: boolean; data?: any; message?: string }>
  > = {
    create_task: async (args) => {
      const { name, description, dueDate, priority, assigneeId, assigneeName } =
        args || {};
      let finalAssigneeId: string | undefined;

      if (assigneeId) finalAssigneeId = assigneeId;
      else if (assigneeName) {
        const found = teamDirectory.find(
          (m) => m.name.toLowerCase() === String(assigneeName).toLowerCase(),
        );
        if (found) finalAssigneeId = found.id;
      }

      const taskData: InsertTask = {
        name,
        projectId: context.projectId,
        status: "todo",
        priority: (priority as Priority) || "medium",
        description: description || "",
        dueDate: dueDate ? new Date(dueDate) : undefined,
        assigneeId: finalAssigneeId,
      };

      const created = await storage.createTask(taskData);
      return { ok: true, data: created };
    },

    delete_task: async (args) => {
      const { taskId } = args || {};
      if (!taskId) return { ok: false, message: "Task ID is required" };

      const task = await storage.getTask(Number(taskId));
      if (!task) {
        return { ok: false, message: "Task not found or already deleted" };
      }

      if (task.projectId !== context.projectId) {
        return {
          ok: false,
          message: "Cannot delete tasks from other projects",
        };
      }

      try {
        await storage.deleteTask(Number(taskId));
        return { ok: true, message: "Task deleted successfully" };
      } catch (error: any) {
        return { ok: false, message: "Failed to delete task" };
      }
    },

    assign_task: async (args) => {
      const { taskId, assigneeId, assigneeName } = args || {};
      let finalAssigneeId: string | undefined = assigneeId;
      if (!finalAssigneeId && assigneeName) {
        const found = teamDirectory.find(
          (m) => m.name.toLowerCase() === String(assigneeName).toLowerCase(),
        );
        if (found) finalAssigneeId = found.id;
      }
      if (!finalAssigneeId) return { ok: false, message: "Assignee not found" };

      const updated = await storage.updateTask(taskId, {
        assigneeId: finalAssigneeId,
      });
      return { ok: true, data: updated };
    },

    update_task: async (args) => {
      const { taskId, title, name, ...patch } = args || {};
      // Handle both 'title' and 'name' fields for flexibility
      const taskName = name || title;
      const updates: any = { ...patch };
      if (taskName) updates.name = taskName;

      const updated = await storage.updateTask(taskId, updates);
      return { ok: true, data: updated };
    },

    get_status_snapshot: async () => {
      return {
        ok: true,
        data: {
          totals: tasksByStatus,
          unassigned: unassignedTasks.length,
          overdue: overdueTasks.length,
          total: tasks.length,
        },
      };
    },

    list_overdue: async () => {
      const list = overdueTasks
        .map((t) => ({
          id: (t as any).id,
          title: t.name,
          dueDate: t.dueDate,
          status: t.status,
        }))
        .sort(
          (a, b) =>
            new Date(a.dueDate as any).getTime() -
            new Date(b.dueDate as any).getTime(),
        );
      return { ok: true, data: list };
    },
  };

  // ---- 4) Chat+tools loop ----
  const systemMessage = {
    role: "system" as const,
    content: `${systemPrompt}

Current Project Snapshot:
- Total tasks: ${tasks.length}
- Unassigned: ${unassignedTasks.length}
- Status breakdown: ${tasksByStatus.todo} todo, ${tasksByStatus.in_progress} in progress, ${tasksByStatus.done} done
- Overdue tasks: ${overdueTasks.length}

When the user greets you or asks "what can you do?", suggest natural actions like:
• "What's the project status?" or "How are we doing?"
• "Show me overdue tasks" or "What's late?"
• "Create a new task for [description]"
• "Assign tasks to the team" or "Distribute unassigned work"
• "Delete completed tasks" or "Clean up the task list"
• "Update task priorities" or "Change due dates"

Speak naturally and take action when appropriate. You're a proactive assistant, not just a question-answering bot!
`,
  };

  let messages: OpenAI.Chat.Completions.CreateChatCompletionRequestMessage[];

  if (context.conversationHistory && context.conversationHistory.length > 0) {
    messages = [
      systemMessage,
      ...context.conversationHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];
  } else if (context.message) {
    messages = [
      systemMessage,
      { role: "user" as const, content: context.message },
    ];
  } else {
    throw new Error("Either message or conversationHistory must be provided");
  }

  let actionsPerformed = false;

  // Up to 3 tool rounds should be enough for these intents
  for (let i = 0; i < 3; i++) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.4,
      max_tokens: 700,
    });

    if (completion.usage) {
      trackTokenUsage("system", "project-ai-assistant", "gpt-4o", completion.usage).catch(() => {});
    }

    const choice = completion.choices[0];
    if (!choice) break;

    const toolCalls = choice.message?.tool_calls;
    const content = choice.message?.content ?? "";

    // If the model just answered text with no tool calls, we're done
    if (!toolCalls || toolCalls.length === 0) {
      messages.push({ role: "assistant", content });
      break;
    }

    // Execute each tool call
    messages.push({
      role: "assistant",
      content,
      tool_calls: toolCalls as any,
    } as any);

    for (const call of toolCalls) {
      const { name, arguments: rawArgs } = call.function;
      const args = safeParseJSON(rawArgs);

      let result = { ok: false, data: null as any, message: "Unknown tool" };
      try {
        const exec = toolExecutors[name];
        if (!exec) {
          result = {
            ok: false,
            data: null,
            message: `No executor for ${name}`,
          };
        } else {
          const r = await exec(args);
          result = r as any;
          if (r.ok) actionsPerformed = true;
        }
      } catch (e: any) {
        result = { ok: false, data: null, message: e?.message || String(e) };
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      } as any);
    }

    // Continue the loop so the model can use the tool results to craft the final answer
  }

  // ---- 5) Final completion to produce user-facing response (optional) ----
  const final = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0.4,
    max_tokens: 500,
  });

  if (final.usage) {
    trackTokenUsage("system", "project-ai-assistant-final", "gpt-4o", final.usage).catch(() => {});
  }

  const finalText =
    final.choices?.[0]?.message?.content ||
    "Done. What else can I help you with?";

  // ---- 6) Suggested follow-ups ----
  const suggestedPrompts: string[] = [];

  // Natural, conversational prompts
  const naturalPrompts = [
    "What's the project status?",
    "Show me overdue tasks",
    "Create a new task",
    "How are we doing?",
    "Assign tasks to the team",
  ];

  // Context-aware suggestions
  if (unassignedTasks.length > 0) {
    suggestedPrompts.push(
      `Assign the ${unassignedTasks.length} unassigned tasks`,
    );
  }
  if (overdueTasks.length > 0) {
    suggestedPrompts.push("What tasks are overdue?");
  }
  if (tasks.filter((t) => t.status === "done").length > 0) {
    suggestedPrompts.push("Delete completed tasks");
  }
  if (tasksByStatus.in_progress > 5) {
    suggestedPrompts.push("Show tasks in progress");
  }

  // Fill remaining slots with natural prompts
  while (suggestedPrompts.length < 5) {
    const prompt = naturalPrompts.shift();
    if (prompt && !suggestedPrompts.includes(prompt)) {
      suggestedPrompts.push(prompt);
    } else {
      break;
    }
  }

  return { response: finalText, actionsPerformed, suggestedPrompts };
}

// ---- helpers ----
function safeParseJSON(s: string | null | undefined) {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
