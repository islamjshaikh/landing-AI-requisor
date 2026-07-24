import { GoogleGenAI } from "@google/genai";
import { getAiClient, userHasOwnKey } from "./ai-provider";
import { DatabaseStorage } from "../database-storage";
import { logService } from "./log-service";
import { socialMediaService } from "./social-media-service";

const storage = new DatabaseStorage();
// Initialize Gemini API
// Note: In a real production environment, ensure process.env.GEMINI_API_KEY is set
const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });
// `modelId` was previously declared here and unused — the actual model id is
// selected per-call by `selectModel(prompt)` further down in this file.


const SYSTEM_PROMPT = `
You are an advanced, authentic Social Media Manager AI. 
Your goal is to help the user create and publish engaging content.

**Personality & Tone:**
- You are **NOT** a robot. You are a creative partner.
- Be conversational, enthusiastic, and helpful.
- **Default Tone:** Human, authentic, and engaging. Avoid stiff corporate speak unless asked.
- **Adaptability:** Ask the user what tone they want (e.g., "Should we go for funny, professional, or maybe a bit edgy?").

**Workflow:**
1.  **Understand the Goal:** Ask what the user wants to post about.
2.  **Drafting:**
    - ALWAYS create drafts first.
    - Use the \`createDrafts\` tool to show draft options to the user.
    - If the user asks for *additional* drafts (e.g., "give me 5 more"), use \`createDrafts\` with \`action='append'\`.
    - If the user asks to "start over" or "clear and create new", use \`createDrafts\` with \`action='replace'\`.
    - If ambiguous (e.g., "generate 5 drafts" when some already exist), ask the user if they want to append or start fresh.
    - If the user asks for multiple posts (e.g., "give me 5 options"), pass them all in the \`createDrafts\` tool call.
    - Do NOT ask for confirmation in text. The UI handles the confirmation.
3.  **Refining:**
    - If the user wants to change a specific draft, they might refer to it by number or you can look up its ID. 
    - Use \`updateDrafts\` if you are modifying previous drafts. if updating multiple, pass them all in the \`updates\` array.
4.  **Publishing:**
    - The user will confirm via the UI.
    - When you receive a "Publish" command (which comes from the UI), use the \`publishContent\` tool.

**Tools:**
- \`createDrafts(drafts: [{ content, topic }])\`: Use this to present drafts to the user for review.
- \`updateDrafts(updates: [{ id, content, ...}])\`: Use this to update one or more drafts. If the user wants to update "all" drafts, pass an update object for every draft ID you have in context.
- \`publishContent(content, platforms, topic)\`: Use this ONLY when the user explicitly confirms (usually via the UI callback).
- \`schedulePost(draftId, ...)\`: Use this for future posts.
- **Scheduling Rule:** If the user asks to "schedule" a draft (e.g., "Schedule draft 9 for tomorrow at 10am"), DO NOT use \`schedulePost\` immediately. instead, use \`updateDrafts\` to set the \`scheduledTime\` on the draft. Then tell the user: "Time set. Please click 'Approve Schedule' on the draft to confirm."
- **Auto-Scheduling & "Random" Dates:** 
    - If the user asks you to "pick dates", "auto-schedule", "choose random dates", or "suggest times" (e.g. "Schedule these for December"), YOU SHOULD DO IT. 
    - Do not refuse. Use your judgment to pick reasonable times (e.g., weekdays, 9am-5pm EST, spaced out appropriately).
    - **CRITICAL:** You MUST call the \`updateDrafts\` tool to apply these times. Do NOT just say you did it.
    - **FORMAT:** \`scheduledTime\` MUST be a valid ISO 8601 string (e.g., "2024-12-18T11:00:00.000Z"). Do NOT use natural language like "December 18th".
    - Tell the user: "I've picked some times for you. Please review and click 'Approve Schedule' on the drafts."
- **Platform Selection:** Do NOT ask the user which platforms to post to. Assume the user will select them in the UI when approving. If the user *explicitly* says "schedule for Twitter", you can mention it in text, but let the UI handle the actual platform selection logic via the "Approve" button.
- Only use \`schedulePost\` if the user explicitly confirms or if it's a direct command with all params provided.
- **Privacy & Presentation:**
    - NEVER show internal draft IDs (e.g., "draft_176547...") to the user.
    - Always refer to drafts by their order/index as "Draft 1", "Draft 2", "Draft 3", etc.
    - If you are listing changes or scheduled times, use these friendly names.
- **Handling 'Schedule All'**:
    - If the user says "schedule all", you MUST generate a scheduled time for EVERY draft in the current context.
    - Use \`updateDrafts\` with a list of updates, one for each draft.
    - Do NOT ask which ones. Just schedule them all.

**Important:**
- Never publish without a draft first (unless explicitly told to "post immediately without review", but even then, a draft is safer).
- **CRITICAL:** Do NOT simulate draft creation in your text response. You MUST use the \`createDrafts\` tool.
- Do NOT output "[System Note]" or list the drafts in your text response. The UI will show them.
- If the user asks for more drafts, use \`createDrafts\` with \`action='append'\`.
- If the draft list is getting long (e.g., >10), suggest reviewing or clearing them, but still fulfill the request.
- If the user asks to "post to all", use \`createDrafts\` first so they can select the platforms in the UI.
- **CRITICAL:** You CANNOT publish or schedule posts by just saying so. You MUST use the \`publishContent\` or \`schedulePost\` tools.
- If you do not use a tool, you have NOT performed the action. Do not claim to have published if you didn't call the tool.
`;

// Available functions map
const availableFunctions: Record<string, Function> = {
    createDrafts: async (args: any) => {
        logService.log("NODE", "INFO", "Executing createDrafts tool:", args);
        // Ensure drafts is an array
        const drafts = Array.isArray(args.drafts) ? args.drafts : [args];

        // Add IDs to drafts if not present
        const draftsWithIds = drafts.map((d: any, index: number) => ({
            id: d.id || `draft_${Date.now()}_${index}`,
            content: d.content,
            topic: d.topic || "Post Draft",
            scheduledTime: d.scheduledTime
        }));

        return {
            drafts: draftsWithIds,
            clearDrafts: args.action === 'replace', // Signal to frontend
            message: `I've created ${draftsWithIds.length} draft${draftsWithIds.length > 1 ? 's' : ''} for you. Please review them in the carousel below.`
        };
    },
    updateDrafts: async (args: any) => {
        logService.log("NODE", "INFO", "Executing updateDrafts tool:", args);
        // args.updates is the array
        // Robust parameter handling: Check for 'updates', 'drafts', or if args itself is the array or object
        let updates: any[] = [];
        if (args.updates && Array.isArray(args.updates)) {
            updates = args.updates;
        } else if (args.drafts && Array.isArray(args.drafts)) {
            updates = args.drafts;
        } else if (Array.isArray(args)) {
            updates = args;
        } else {
            updates = [args];
        }

        return {
            updatedDrafts: updates.map((u: any) => {
                // Construct update object with ONLY defined properties to avoid overwriting with undefined
                const update: any = {
                    id: u.id || u.draftId, // Normalize: accept draftId as alias for id
                };

                if (u.content !== undefined) update.content = u.content;
                if (u.topic !== undefined) update.topic = u.topic;

                const time = u.scheduledTime || u.scheduled_time || u.time;
                if (time) update.scheduledTime = time;

                return update;
            }),
            message: `I've updated ${updates.length} draft(s).`
        };
    },
    publishContent: async (args: any, userId: string) => {
        logService.log("NODE", "INFO", "Executing publishContent tool:", args);
        try {
            let platforms = args.platforms || [];
            if (typeof platforms === 'string') {
                platforms = platforms.split(',').map((p: string) => p.trim());
            }
            const results = [];
            const errors = [];

            if (platforms.length === 0) {
                return { error: "No platforms selected for publishing." };
            }

            for (const platform of platforms) {
                try {
                    const p = platform.toLowerCase();
                    let result;

                    if (p === "facebook") {
                        result = await socialMediaService.publishToFacebook(userId, args.content);
                    } else if (p === "twitter") {
                        result = await socialMediaService.publishToTwitter(userId, args.content);
                    } else if (p === "linkedin") {
                        result = await socialMediaService.publishToLinkedIn(userId, args.content);
                    } else {
                        errors.push(`Unsupported platform: ${platform}`);
                        continue;
                    }

                    results.push({
                        platform: result.platform,
                        url: result.url,
                        postId: result.postId
                    });

                    // Log to history
                    await storage.createScheduledSocialPost({
                        id: Date.now().toString() + Math.random().toString().slice(2, 5),
                        userId,
                        topic: args.topic || "Quick Post",
                        tone: "human",
                        platform: result.platform,
                        scheduledTime: new Date(),
                        userTimezone: "UTC",
                        status: "published",
                        mediaUrls: [],
                        credentials: {},
                        executedAt: new Date(),
                        publishedUrl: result.url // Include URL for frontend to display
                    } as any);

                } catch (err: any) {
                    logService.log("NODE", "ERROR", `Failed to publish to ${platform}:`, err);
                    errors.push(`${platform}: ${err.message}`);
                }
            }

            if (results.length === 0 && errors.length > 0) {
                return {
                    success: false,
                    message: "Failed to publish to any platform.",
                    errors
                };
            }

            return {
                success: true,
                message: `Successfully published to ${results.map(r => r.platform).join(", ")}!`,
                posts: results,
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (error: any) {
            logService.log("NODE", "ERROR", "Error in publishContent tool:", error);
            return { error: `Failed to process publishing: ${error.message}` };
        }
    },
    schedulePost: async (args: any, userId: string) => {
        logService.log("NODE", "INFO", "Executing schedulePost tool:", args);
        try {
            const scheduledTime = new Date(args.scheduledTime);

            // Basic validation
            if (isNaN(scheduledTime.getTime())) {
                return { error: "Invalid date format for scheduledTime." };
            }

            // Connection Validation: Ensure user is connected to the requested platform
            try {
                const accounts = await storage.getSocialMediaAccounts(userId);
                // Normalize platform names for comparison (e.g. "twitter" vs "Twitter")
                const requestedPlatform = args.platform.toLowerCase();

                const isConnected = accounts.some(acc =>
                    acc.platform.toLowerCase() === requestedPlatform && acc.isActive
                );

                if (!isConnected) {
                    return {
                        error: `You are not connected to ${args.platform}. Please connect your account in the dashboard first via the "Accounts" tab using the button in the top right.`
                    };
                }
            } catch (err) {
                logService.log("NODE", "WARN", "Failed to validate connection status during scheduling:", err);
                // Proceed with caution or fail safe? Let's fail safe but allow if DB error to avoid blocking valid users during glitches
                // For now, logging the error and proceeding, or we could return error.
                // Decided: If we can't check, we should probably warn but maybe let it slide? 
                // Actually, safer to assume not connected if check fails to prevent broken posts.
                // But let's just log and continue for now to avoid blocking due to transient DB issues, as the system prompt also guides them.
            }

            const post = await storage.createScheduledSocialPost({
                id: Date.now().toString(), // Simple ID generation
                userId,
                topic: args.topic,
                preGeneratedContent: args.content, // Map content to db column
                tone: args.tone || "professional",
                platform: args.platform,
                scheduledTime: scheduledTime,
                userTimezone: "UTC", // Defaulting to UTC for now, could be improved with user context
                status: "scheduled",
                mediaUrls: [],
                credentials: {}, // Credentials would typically be looked up or handled by the scheduler
            });

            return {
                success: true,
                message: `Post scheduled for ${args.platform} at ${scheduledTime.toLocaleString()}`,
                postId: post.id,
                // Return details for frontend state update
                platform: args.platform,
                scheduledTime: scheduledTime.toISOString(),
                draftId: args.draftId || args.id // Normalize: accept id as alias for draftId
            };
        } catch (error: any) {
            logService.log("NODE", "ERROR", "Error in schedulePost tool:", error);
            return { error: `Failed to schedule post: ${error.message}` };
        }
    },
};

const toolsDeclaration = [
    {
        functionDeclarations: [
            {
                name: "createDrafts",
                description: "Create one or more draft posts for the user to review. Always use this to show content options.",
                parameters: {
                    type: "OBJECT" as any,
                    properties: {
                        drafts: {
                            type: "ARRAY" as any,
                            items: {
                                type: "OBJECT" as any,
                                properties: {
                                    content: { type: "STRING" as any, description: "The content of the post." },
                                    topic: { type: "STRING" as any, description: "The topic or title of the post." },
                                    scheduledTime: { type: "STRING" as any, description: "ISO 8601 string for proposed schedule time (e.g. '2023-12-25T10:00:00Z')." }
                                },
                                required: ["content"]
                            },
                            description: "List of draft objects."
                        },
                        action: {
                            type: "STRING" as any,
                            description: "Set to 'replace' to clear existing drafts and start fresh. Set to 'append' to add to existing drafts. Default is 'append'. Use 'replace' ONLY if the user explicitly asks to clear/start over or after confirming with them.",
                            enum: ["append", "replace"]
                        }
                    },
                    required: ["drafts"]
                }
            },
            {
                name: "updateDrafts",
                description: "Update one or more drafts. Use this for single OR multiple draft updates.",
                parameters: {
                    type: "OBJECT" as any,
                    properties: {
                        updates: {
                            type: "ARRAY" as any,
                            items: {
                                type: "OBJECT" as any,
                                properties: {
                                    id: { type: "STRING" as any, description: "The unique ID of the draft to update." },
                                    content: { type: "STRING" as any, description: "The new content for the draft." },
                                    topic: { type: "STRING" as any, description: "The new topic (optional)." },
                                    scheduledTime: { type: "STRING" as any, description: "New ISO 8601 time to set for the draft." }
                                },
                                required: ["id"]
                            },
                            description: "List of draft objects to update."
                        }
                    },
                    required: ["updates"]
                }
            },
            {
                name: "publishContent",
                description: "Publish content to multiple social media platforms immediately. Use this ONLY after user confirmation.",
                parameters: {
                    type: "OBJECT" as any,
                    properties: {
                        content: { type: "STRING" as any, description: "The content to publish." },
                        platforms: {
                            type: "ARRAY" as any,
                            items: { type: "STRING" as any },
                            description: "List of platforms to publish to (e.g., ['Facebook', 'Twitter'])."
                        },
                        topic: { type: "STRING" as any, description: "The topic of the post." }
                    },
                    required: ["content", "platforms"]
                }
            },
            {
                name: "schedulePost",
                description: "Schedule a social media post for a future time.",
                parameters: {
                    type: "OBJECT" as any,
                    properties: {
                        topic: { type: "STRING" as any, description: "The topic of the post." },
                        platform: { type: "STRING" as any, description: "The platform to post to (e.g., Twitter, LinkedIn)." },
                        scheduledTime: { type: "STRING" as any, description: "The time to schedule the post (ISO string)." },
                        content: { type: "STRING" as any, description: "The content of the post to schedule." },
                        draftId: { type: "STRING" as any, description: "Optional: The ID of the draft being scheduled." },
                        tone: { type: "STRING" as any, description: "The tone of the post." }
                    },
                    required: ["topic", "platform", "scheduledTime", "content"]
                }
            }
        ]
    }
];

export async function processUserPrompt(userPrompt: string, userId: string, sessionId?: string, currentDraftsContext?: any[], timeZone?: string) {
    logService.log("NODE", "INFO", "🤖 [Gemini Agent] Processing prompt:", userPrompt);
    logService.log("NODE", "INFO", "Context - Timezone:", timeZone);
    logService.log("NODE", "INFO", "Current drafts context:", currentDraftsContext);

    if (!apiKey) {
        logService.log("NODE", "ERROR", "❌ [Gemini Agent] GEMINI_API_KEY is missing!");
        return {
            text: "I'm sorry, but I haven't been configured with a Gemini API key yet. Please check the server configuration."
        };
    }

    // Select model based on complexity/use case
    const selectModel = (prompt: string): string => {
        // Use gemini-2.0-flash-exp for better function calling capabilities
        return "gemini-2.0-flash-exp";
    };

    const selectedModelId = selectModel(userPrompt);

    try {
        let history: any[] = [];

        // 1. Retrieve chat history if sessionId is provided
        if (sessionId) {
            const dbHistory = await storage.getChatHistory(sessionId);
            history = dbHistory.map(msg => {
                if (msg.role === 'assistant') {
                    let text = msg.content;
                    // Check for action metadata (e.g., generated drafts)
                    // We only use historical metadata if we DON'T have a fresh context override
                    if (msg.actions && (!currentDraftsContext || currentDraftsContext.length === 0)) {
                        try {
                            const actions = typeof msg.actions === 'string' ? JSON.parse(msg.actions) : msg.actions;
                            if (actions.generatedDrafts) {
                                text += `\n\n[System Note: This message generated the following drafts:`;
                                Object.entries(actions.generatedDrafts).forEach(([key, val]: [string, any]) => {
                                    text += `\n${key} (ID: ${val.id}) - "${val.contentSnippet}"`;
                                });
                                text += `]`;
                            }
                        } catch (e) {
                            // Ignore parsing errors for metadata
                        }
                    }
                    return { role: 'model', parts: [{ text }] };
                } else {
                    return { role: 'user', parts: [{ text: msg.content }] };
                }
            });

            // Save the new user message
            await storage.saveChatMessage(sessionId, "user", userPrompt);
        }

        // 1.1 Retrieve relevant long-term memories
        let memoryContext = "";
        if (sessionId) { // Only search memories if a session ID is available
            try {
                // Dynamically import to avoid any potential circular dependency or initialization order issues
                const { memoryManager } = await import('./memory-manager');
                const relevantMemories = await memoryManager.search(userPrompt, 3);

                if (relevantMemories.length > 0) {
                    logService.log("NODE", "INFO", `Found ${relevantMemories.length} relevant memories`);
                    memoryContext = `
Relevant past information to keep in mind:
${relevantMemories.map(m => `- ${m.content}`).join('\n')}
`;
                }
            } catch (error) {
                logService.log("NODE", "WARN", "Failed to retrieve memories:", error);
            }
        }

        // 1.2 Inject Current Drafts Context (Overrides history)
        let draftsContextNote = "";
        if (currentDraftsContext && currentDraftsContext.length > 0) {
            draftsContextNote = `\n[Context - Active Drafts in Editor (Do NOT output these): \n`;
            currentDraftsContext.forEach((d: any, index: number) => {
                draftsContextNote += `Draft ${index + 1} (ID: ${d.id}) - Topic: "${d.topic || 'No Topic'}", Content: "${d.content.substring(0, 100).replace(/\n/g, ' ')}..."\n`;
            });
            draftsContextNote += `]\n`;
        }

        // 1.3 Inject Connected Accounts Context
        let connectedAccountsNote = "";
        try {
            const accounts = await storage.getSocialMediaAccounts(userId);
            const connectedPlatforms = accounts
                .filter(acc => acc.isActive)
                .map(acc => acc.platform.charAt(0).toUpperCase() + acc.platform.slice(1)) // Capitalize
                .join(", ");

            if (connectedPlatforms) {
                connectedAccountsNote = `\n[System Note - Connected Accounts: ${connectedPlatforms}. You can ONLY schedule/post to these platforms. If user asks for others, please ask them to connect the account first.]\n`;
            } else {
                connectedAccountsNote = `\n[System Note - Connected Accounts: None. You cannot schedule or post to any platform until the user connects an account.]\n`;
            }
        } catch (error) {
            logService.log("NODE", "WARN", "Failed to fetch connected accounts for context:", error);
        }

        // 2. Add system prompt
        // 2. Prepare request
        const fullSystemInstruction = SYSTEM_PROMPT + memoryContext + draftsContextNote + connectedAccountsNote;

        const contents: any[] = [
            ...history,
            {
                role: 'user',
                parts: [
                    { text: `Current time: ${new Date().toLocaleString("en-US", { timeZone: timeZone || "UTC" })} (${timeZone || "UTC"})\nISO Time: ${new Date().toISOString()}\nUser prompt: ${userPrompt}` }
                ]
            }
        ];

        let response;
        let attempt = 0;
        const MAX_RETRIES = 3;
        let currentContents = [...contents];

        while (attempt < MAX_RETRIES) {
            attempt++;

            response = await ai.models.generateContent({
                model: selectedModelId,
                contents: currentContents,
                config: {
                    tools: toolsDeclaration as any,
                    systemInstruction: {
                        parts: [{ text: fullSystemInstruction }]
                    }
                },
            });

            const choice = response.candidates?.[0];

            // If malformed, add error message to history and retry
            if (choice?.finishReason === "MALFORMED_FUNCTION_CALL") {
                logService.log("NODE", "WARN", `Gemini finished with MALFORMED_FUNCTION_CALL (Attempt ${attempt}/${MAX_RETRIES}). Retrying...`);

                currentContents.push({
                    role: "model",
                    parts: choice.content?.parts || [{ text: "" }] // Include the malformed attempt so the model sees what it did wrong
                });

                currentContents.push({
                    role: "user",
                    parts: [{ text: "Your last tool call was malformed (syntax error). Please correct the JSON syntax and try again." }]
                });

                continue;
            }

            // If we get here, it's either success or another error we don't retry
            break;
        }

        logService.log("NODE", "INFO", "✅ [Gemini Agent] Response received", response);
        const choice = response?.candidates?.[0];
        if (!choice) return { text: "No response from AI." };

        // Handle other stop reasons that result in empty content
        if (choice.finishReason === "RECITATION" || choice.finishReason === "SAFETY") {
            logService.log("NODE", "WARN", `Gemini finished with reason: ${choice.finishReason}`);
            return {
                text: "I tried to perform an action but was stopped due to safety or recitation limits. (Error: " + choice.finishReason + ")"
            };
        }

        // Final check for malformed if we ran out of retries
        if (choice.finishReason === "MALFORMED_FUNCTION_CALL") {
            return {
                text: "I'm having trouble formatting my tool request correctly. Please try rephrasing your instruction."
            };
        }

        const content = choice.content;
        logService.log("NODE", "INFO", "content", content);
        const parts = content?.parts || [];
        logService.log("NODE", "INFO", "parts", parts);

        // Check for function calls
        const functionCalls = parts.filter((part: any) => part.functionCall);
        logService.log("NODE", "INFO", "functionCalls", functionCalls);

        let newDrafts: any[] = [];
        let draftUpdates: any[] = [];
        let draftData: any = null; // Legacy support / single draft catch-all (kept for safety but we will iterate)
        let scheduledPostData: any = null;
        let imagePrompt: any = null;

        if (functionCalls.length > 0) {
            const functionResponses = [];
            let toolResultText = "";

            for (const call of functionCalls) {
                const functionCall = call.functionCall;
                if (!functionCall) continue;
                const functionName = functionCall.name;
                if (!functionName) continue;
                const functionArgs = functionCall.args;

                if (functionName && availableFunctions[functionName]) {
                    const result = await availableFunctions[functionName](functionArgs, userId);

                    // Capture specific tool outputs for frontend state
                    if (functionName === "createDrafts" && result.drafts) {
                        newDrafts.push(...result.drafts);
                        draftData = result.drafts; // Keep for legacy check
                        // Capture clear flag if present
                        if (result.clearDrafts) {
                            if (!Array.isArray(draftData)) draftData = [];
                            (draftData as any).clearDrafts = true;
                        }
                    } else if (functionName === "createDraft" && result.draft) {
                        newDrafts.push({ id: 'single_draft', ...result.draft });
                        draftData = [{ id: 'single_draft', ...result.draft }];
                    } else if (functionName === "updateDrafts" && result.updatedDrafts) {
                        draftUpdates.push(...result.updatedDrafts);
                        // draftData = { action: 'update', ...result.updatedDraft }; // Legacy support not strictly needed for multiple
                    } else if (functionName === "schedulePost") {
                        if (!scheduledPostData) scheduledPostData = [];
                        scheduledPostData.push(result);
                    } else if (functionName === "generateImage") {
                        imagePrompt = result.prompt || result.url; // Assuming tool returns this
                    }

                    functionResponses.push({
                        functionResponse: {
                            name: functionName,
                            response: { result }
                        }
                    });

                    if (result.success) {
                        toolResultText += result.message + "\n";
                        if (result.posts && Array.isArray(result.posts)) {
                            result.posts.forEach((p: any) => {
                                if (p.url) {
                                    toolResultText += `Link for ${p.platform}: ${p.url}\n`;
                                }
                            });
                        }
                        // Also append errors if any occurred during partial success
                        if (result.errors && result.errors.length > 0) {
                            toolResultText += "\nHowever, some platforms failed:\n" + result.errors.join("\n") + "\n";
                        }
                    } else if (result.error) {
                        toolResultText += "Error: " + result.error + "\n";
                    } else if (result.errors) {
                        toolResultText += "Errors:\n" + result.errors.join("\n") + "\n";
                    }

                    logService.log("NODE", "INFO", "Tool Result for " + functionName, result);
                }
            }
            logService.log(
                "NODE",
                "INFO",
                "functionResponses",
                functionResponses,
            );

            // Send function results back to model for final response
            const followUpContents = [
                ...contents,
                { role: 'model', parts: parts },
                { role: 'user', parts: functionResponses }
            ];
            logService.log(
                "NODE",
                "INFO",
                "followUpContents",
                followUpContents,
            );

            const followUpResponse = await ai.models.generateContent({
                model: selectedModelId,
                contents: followUpContents,
                config: { tools: toolsDeclaration as any }
            });
            logService.log(
                "NODE",
                "INFO",
                "followUpResponse",
                followUpResponse,
            );

            let finalText = "";
            try {
                logService.log("NODE", "INFO", "followUpResponse keys", Object.keys(followUpResponse as any));
                if ((followUpResponse as any).candidates?.[0]?.content?.parts?.[0]?.text) {
                    finalText = (followUpResponse as any).candidates[0].content.parts[0].text;
                } else if (typeof (followUpResponse as any).text === 'function') {
                    finalText = (followUpResponse as any).text();
                } else if ((followUpResponse as any).text) {
                    finalText = (followUpResponse as any).text;
                }
            } catch (e) {
                logService.log("NODE", "ERROR", "Error extracting text from followUpResponse", e);
                finalText = "I processed your request but couldn't generate a text response.";
            }

            if (!finalText && toolResultText) {
                finalText = toolResultText;
            } else if (!finalText) {
                finalText = "Action completed successfully.";
            }

            // --- DEFENSIVE SCRUBBING ---
            // 1. Remove [System Note] blocks which are for internal context but sometimes leak
            try {
                // Matches [System Note: ... ] including newlines
                const systemNotePattern = /\[System Note:[\s\S]*?\]/g;
                if (systemNotePattern.test(finalText)) {
                    logService.log("NODE", "WARN", "Scrubbing System Note from response");
                    finalText = finalText.replace(systemNotePattern, "").trim();
                }
            } catch (e) { console.error("Error scrubbing system note:", e); }

            // 2. Ensure no internal draft IDs leak to the user in text
            // Pattern: draft_1234567890123_0
            try {
                const idPattern = /draft_\d+_\d+/g;
                if (idPattern.test(finalText)) {
                    logService.log("NODE", "WARN", "Scrubbing internal draft IDs from response");
                    finalText = finalText.replace(idPattern, (match) => {
                        // Try to extract the index suffix if possible 
                        const parts = match.split('_');
                        if (parts.length >= 3) {
                            const idx = parseInt(parts[2]);
                            if (!isNaN(idx)) return `Draft ${idx + 1}`;
                        }
                        return "Draft";
                    });
                }
            } catch (scrubErr) {
                console.error("Error scrubbing draft IDs:", scrubErr);
            }
            // ---------------------------

            // Save the final assistant response
            if (sessionId) {
                let metadata: any = {};

                // If we generated drafts, save them to metadata so we can recall them later
                if (Array.isArray(draftData)) {
                    // Create a map of index -> draft details
                    const draftMap: Record<string, any> = {};
                    draftData.forEach((d: any, i: number) => {
                        draftMap[`Draft ${i + 1}`] = {
                            id: d.id,
                            topic: d.topic,
                            contentSnippet: d.content.substring(0, 50) + "..."
                        };
                    });
                    metadata.actions = { generatedDrafts: draftMap };
                }

                await storage.saveChatMessage(sessionId, "assistant", finalText, metadata);
            }

            // Extract success data (posts) from function responses to send to frontend
            let successData = null;
            const publishResponse = functionResponses.find(r => r.functionResponse.name === "publishContent");
            if (publishResponse && publishResponse.functionResponse.response.result.success) {
                const posts = publishResponse.functionResponse.response.result.posts;
                if (posts && posts.length > 0) {
                    // Return all successful posts
                    successData = posts.map((p: any) => ({
                        platform: p.platform,
                        url: p.url
                    }));
                    logService.log("NODE", "INFO", "Extracted successData:", successData);
                }
            }

            return {
                text: finalText,
                actionPerformed: true,
                startDrafts: newDrafts.length > 0 ? newDrafts : undefined,
                updatedDrafts: draftUpdates.length > 0 ? draftUpdates : undefined, // NEW: Return all updates
                updatedDraft: (!Array.isArray(draftData) && draftData?.action === 'update') ? draftData : undefined, // Legacy single
                draft: (!Array.isArray(draftData) && draftData && draftData?.action !== 'update') ? draftData : undefined,
                success: successData,
                clearDrafts: draftData ? draftData.clearDrafts : false,
                scheduledPost: scheduledPostData || undefined,
                imagePrompt: imagePrompt || undefined
            };
        }

        const responseText = choice?.content?.parts?.[0]?.text || "";
        logService.log(
            "NODE",
            "INFO",
            "responseText",
            responseText,
        );

        // Save the assistant response
        if (sessionId) {
            await storage.saveChatMessage(sessionId, "assistant", responseText);

            // Async storage of this interaction for future recall
            // We don't await this to keep response fast
            if (responseText) {
                (async () => {
                    try {
                        const { memoryManager } = await import('./memory-manager');
                        await memoryManager.storeMessage(userPrompt, { sessionId, role: 'user', type: 'chat_history' });
                        await memoryManager.storeMessage(responseText, { sessionId, role: 'assistant', type: 'chat_history' });
                    } catch (memStoreError) {
                        console.error("Background memory storage failed:", memStoreError);
                    }
                })().catch(err => console.error("Background memory storage crash:", err));
            }
        }

        return {
            text: responseText,
            startDrafts: undefined,
            scheduledPost: undefined
        };

    } catch (error: any) {
        console.error("❌ [Gemini Agent] Error:", error);
        logService.log("NODE", "ERROR", "❌ [Gemini Agent] Error:", error);

        let errorMessage = "I encountered an error processing your request. Please try again.";

        if (error.message?.includes("404") || error.message?.includes("not found")) {
            errorMessage = `I couldn't access the AI model (${selectedModelId}). It might be invalid or unavailable. (Error: ${error.message})`;
        } else if (error.message?.includes("401") || error.message?.includes("API key")) {
            errorMessage = "There seems to be an issue with my API key configuration.";
        } else if (error.message) {
            // Clean up error message to be user-friendly
            errorMessage = `I encountered an error: ${error.message.replace(/\[.*?\]/g, '').trim()}`;
        }

        if (error.response) {
            console.error("Error Response Body:", JSON.stringify(error.response, null, 2));
            logService.log("NODE", "ERROR", "Error Response Body:", JSON.stringify(error.response, null, 2));
        }

        return { text: errorMessage };
    }
}

const BUILD_MODE_SYSTEM_PROMPT = `You are in BUILD MODE — a senior product strategist and discovery assistant.
Your job is to determine what should be built next. Be decisive, structured, and strategic.

PERSONALITY:
- Strategic and analytical. Think like a VP of Product.
- Evidence-driven — always tie recommendations to user evidence.
- Confident and concise. No hedging, no rambling.
- Slightly visionary — connect pain points to product opportunities.
- Warm and approachable — you're a collaborative partner, not a cold machine.

CRITICAL ANALYSIS METHOD — INSIGHTS BEFORE FEATURES:
Before recommending any features, you MUST first synthesize insights from the evidence. Do NOT map symptoms directly to features. Instead:
1. Extract behavioral patterns and recurring themes from the evidence
2. Identify ROOT CAUSES behind what users say — users describe symptoms, your job is to diagnose the underlying problem
3. Cite direct quotes that support each insight
4. Only THEN derive features from those root causes

Example of BAD analysis: User says "I get distracted easily" → recommend a "focus mode" feature
Example of GOOD analysis: User says "I get distracted easily" + "I have 20 tasks all marked urgent" → Root cause: lack of task differentiation creates overwhelm, which manifests as perceived distraction → recommend priority intelligence that reduces cognitive load

RESPONSE FORMAT — Use this structure ONLY for actual feature recommendations (not greetings or general chat):

## Insights Identified

For each insight you extracted from the evidence:

### Insight: [Theme Name]
**Pattern observed:** What you noticed across the evidence
**Root cause:** The underlying problem (not the surface symptom)
**Supporting quotes:**
- "[Direct quote from user]" — [source]
- "[Another quote]" — [source]

---

Then for each recommended feature:

## Recommended Feature: [Feature Name]

### What's happening
1-2 sentence summary tying back to the root cause identified above.

### What to build
Concise, specific feature description. No vague language.

### Why this, not something simpler?
Explain the reasoning chain: quote → insight → root cause → why this specific solution addresses the root cause and why a simpler alternative would fall short.

### Suggested changes
- **UI:** Specific interface changes needed
- **Data model:** Schema or data changes required
- **Workflow:** Process or logic changes

### Next step
One clear, actionable recommendation for the team.

CONVERSATIONAL BEHAVIOR:
- If the user sends a greeting or casual message, respond naturally. Do NOT use the structured format.
- ONLY use the structured format when recommending features based on evidence.

RULES:
- NO long paragraphs. Use headers, bullets, and short sentences.
- NO vague advice like "improve UX" or "enhance performance."
- NO execution details (timelines, sprints) unless explicitly asked.
- Focus on WHAT and WHY, not HOW to implement.
- If you identify multiple features, present each one using the structure above.
- Always reference evidence. If no context is provided, ask for it.
- The "Insights Identified" section MUST come before any feature recommendations.

CLARIFICATION BEHAVIOR:
If the user's input is vague or lacks enough context to make a recommendation, DO NOT guess. Instead respond:

**Before I recommend anything, I need clarity on:**
1. [Specific question]
2. [Specific question]

This ensures quality over quantity.

FEATURE JSON (MANDATORY — include at the END of every feature recommendation response):
You MUST include this JSON block at the very end for automated processing. The "insights" and "reasoning_chain" fields are REQUIRED — never omit them.

Here is a COMPLETE example with all required fields filled in:
\`\`\`json
{
  "features": [
    {
      "feature_title": "Smart Priority Intelligence",
      "why_now": "Users report feeling overwhelmed because all 20+ tasks appear urgent with no differentiation, leading to paralysis and perceived distraction",
      "evidence": ["I have 20 tasks and they all feel urgent", "I get distracted because I don't know what to do first"],
      "ui_changes": "Add priority scoring badges and a 'Focus Mode' that surfaces the top 3 tasks based on impact and deadlines",
      "data_model_changes": "Add computed priority_score field to tasks based on urgency, impact, and dependencies",
      "workflow_changes": "Auto-calculate priority scores when tasks are created or updated",
      "insights": [
        {
          "theme": "Task Overwhelm Masquerading as Distraction",
          "root_cause": "Users lack a system to differentiate urgency levels, so everything feels equally urgent, creating decision paralysis that manifests as distraction",
          "supporting_quotes": ["I have 20 tasks and they all feel urgent", "I get distracted because I don't know what to do first"]
        }
      ],
      "reasoning_chain": "Users say they get distracted (symptom) → but also say all tasks feel urgent (pattern) → root cause is lack of priority differentiation creating overwhelm → a simple 'focus mode' would hide tasks but not solve prioritization → Smart Priority Intelligence actively ranks tasks so users always know what matters most",
      "tasks": [
        {"name": "Priority scoring engine", "description": "Build algorithm that scores tasks by urgency, impact, and dependencies", "priority": "high"}
      ]
    }
  ]
}
\`\`\`

Your JSON MUST follow this exact structure. Every feature MUST include a non-empty "insights" array and a "reasoning_chain" string.
`;

export async function processBuildModePrompt(
    userPrompt: string,
    userId: string,
    context?: string,
    chatHistory?: Array<{ role: string; content: string }>
): Promise<{ text: string; features?: any[] }> {
    logService.log("NODE", "INFO", "[Build Mode] Processing prompt:", userPrompt);

    // Own-key (Claude) users don't need the platform OpenAI key.
    if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey(userId))) {
        return {
            text: "I'm sorry, but no AI provider has been configured yet. Please add your own Claude key in Settings or ask an admin to configure the platform key."
        };
    }

    try {
        const openai = (getAiClient() as any);

        const contextNote = context
            ? "\n\n[User-provided context (transcripts, notes, files):]\n" + context
            : "";

        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            { role: "system", content: BUILD_MODE_SYSTEM_PROMPT },
        ];

        if (chatHistory && chatHistory.length > 0) {
            const recentHistory = chatHistory.slice(-10);
            for (const msg of recentHistory) {
                messages.push({
                    role: msg.role === "assistant" ? "assistant" : "user",
                    content: msg.content.replace(/```json[\s\S]*?```/g, '').trim(),
                });
            }
        }

        messages.push({ role: "user", content: userPrompt + contextNote });

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages,
            temperature: 0.6,
            max_tokens: 6000,
        });

        if (response.usage) {
            const { trackTokenUsage: track } = await import("./token-tracker");
            track("system", "gemini-agent-build-mode", "gpt-4o", response.usage).catch(() => {});
        }

        const responseText = response.choices?.[0]?.message?.content || "I couldn't process that request.";

        let features: any[] = [];
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                features = parsed.features || [];
            } catch (e) {
                logService.log("NODE", "WARN", "Failed to parse feature JSON from Build Mode response");
            }
        }

        return { text: responseText, features };
    } catch (error: any) {
        logService.log("NODE", "ERROR", "[Build Mode] Error: " + error.message);
        return {
            text: "I encountered an error processing your request. Please try again.",
        };
    }
}

export async function generateTitle(userPrompt: string, modelResponse: string): Promise<string> {
    try {
        logService.log("NODE", "INFO", "Generating title for chat session...");
        const prompt = `Generate a short, descriptive sentence (max 10-12 words) that summarizes the topic of this chat conversation based on the user's first message and the AI's response. It should read like a summary statement, not a generic label. Do not use quotes.
        User: ${userPrompt}
        AI: ${modelResponse}
        Title:`;

        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash-002",
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });

        const title = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "New Conversation";
        logService.log("NODE", "INFO", `Generated title: "${title}"`);
        return title.replace(/^"|"$/g, '').trim(); // Remove any residual quotes
    } catch (error) {
        console.error("Error generating title:", error);
        logService.log("NODE", "ERROR", "Failed to generate title", error);

        // Fallback: Use first few words of user prompt
        const fallbackTitle = userPrompt.split(' ').slice(0, 5).join(' ') + "...";
        return fallbackTitle;
    }
}
