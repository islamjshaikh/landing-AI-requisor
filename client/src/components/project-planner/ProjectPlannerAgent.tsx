import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Send,
  Sparkles,
  Loader2,
  Calendar,
  Target,
  Zap,
  Rocket,
  Upload,
  FileText,
  X,
  Download,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ProjectPlannerCanvas } from "./ProjectPlannerCanvas";
import { useDropzone } from "react-dropzone";
import { apiRequest } from "@/lib/queryClient";

// Component for rotating loading text
function RotatingLoadingText() {
  const loadingMessages = [
    "Thinking AI Agent",
    "Ideas to plans",
    "Planning with intelligence",
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-sm text-gray-600">
      {loadingMessages[currentIndex]}
    </span>
  );
}

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  projectPlan?: ProjectPlan;
  attachments?: FileAttachment[];
}

interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

interface ProjectPlan {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  milestones: Milestone[];
}

interface Milestone {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  tasks: Task[];
}

interface Task {
  id: string;
  name: string;
  description?: string;
  dueDate: string;
  priority: "low" | "medium" | "high";
}

// Reasoning Process Types
interface ReasoningStep {
  step: "intent" | "domain" | "format" | "depth" | "response";
  value: string;
  timestamp: Date;
}

interface ProcessingContext {
  intent: string;
  domain: string;
  format: string;
  depth: string;
  reasoning: ReasoningStep[];
}

interface ActiveProjectContext {
  projectId?: string;
  planData: ProjectPlan;
  isActive: boolean;
  metadata?: {
    domain: string;
    originalPrompt: string;
    createdAt: Date;
  };
}

export function ProjectPlannerAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      content:
        "Welcome! I'm your AI Project Planner with transparent reasoning and incremental updates. I follow a clear process: [Intent Detected] ➤ [Domain] ➤ [Format] ➤ [Depth] ➤ [Response]. Once I create a project plan, you can add features like 'social login integration' and I'll update the existing plan rather than starting over. Toggle 'Show AI Reasoning' to see my decision process!",
      role: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [showCanvas, setShowCanvas] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<ProjectPlan | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<FileAttachment[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [currentReasoning, setCurrentReasoning] =
    useState<ProcessingContext | null>(null);
  const [showReasoningSteps, setShowReasoningSteps] = useState(false);
  const [activeProjectContext, setActiveProjectContext] =
    useState<ActiveProjectContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Pill-style prompt suggestions
  const promptSuggestions = [
    {
      icon: Rocket,
      text: "AI-Powered Customer Support System Development",
      color: "text-purple-600 bg-purple-50",
    },
    {
      icon: Zap,
      text: "Full Rebranding Project: Visual Identity, UI, and Marketing Assets",
      color: "text-blue-600 bg-blue-50",
    },
    {
      icon: Target,
      text: "360° Digital Marketing Campaign for Product Launch",
      color: "text-green-600 bg-green-50",
    },
    {
      icon: Calendar,
      text: "Multi-Phase Corporate Website Redesign & Deployment",
      color: "text-orange-600 bg-orange-50",
    },
    {
      icon: Upload,
      text: "Upload project docs",
      color: "text-indigo-600 bg-indigo-50",
    },
  ];

  // Dropzone configuration
  const onDrop = async (acceptedFiles: File[]) => {
    setIsProcessingFiles(true);

    const newFiles: FileAttachment[] = acceptedFiles.map((file) => ({
      id: `file_${Date.now()}_${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.type,
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    // Process files
    await processUploadedFiles(acceptedFiles);

    setIsProcessingFiles(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
      "text/plain": [".txt"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    maxSize: 20 * 1024 * 1024, // 20MB limit
  });

  // Transparent Reasoning Process Functions
  const detectIntent = (input: string): string => {
    const lowercaseInput = input.toLowerCase();
    if (/plan|project|schedule|timeline|roadmap/i.test(input))
      return "project_planning";
    if (/marketing|campaign|promotion|brand|advertis/i.test(input))
      return "marketing_strategy";
    if (/develop|code|build|software|app|system/i.test(input))
      return "software_development";
    if (/design|ui|ux|interface|visual/i.test(input)) return "design_strategy";
    if (/research|analysis|study|investigate/i.test(input))
      return "research_planning";
    if (/event|launch|meeting|conference/i.test(input)) return "event_planning";
    return "general_planning";
  };

  const mapIntentToDomain = (intent: string): string => {
    const domainMap: Record<string, string> = {
      project_planning: "project_management",
      marketing_strategy: "digital_marketing",
      software_development: "technology",
      design_strategy: "creative_design",
      research_planning: "research_analysis",
      event_planning: "event_management",
      general_planning: "general",
    };
    return domainMap[intent] || "general";
  };

  const determineFormat = (input: string, domain: string): string => {
    if (/canvas|board|visual/i.test(input)) return "canvas_view";
    if (/table|grid|spreadsheet/i.test(input)) return "table_format";
    if (/gantt|timeline|schedule/i.test(input)) return "timeline_view";
    if (/list|bullet|points/i.test(input)) return "bullet_points";

    // Domain-based defaults
    switch (domain) {
      case "project_management":
        return "timeline_view";
      case "digital_marketing":
        return "canvas_view";
      case "technology":
        return "milestone_plan";
      case "creative_design":
        return "canvas_view";
      default:
        return "structured_plan";
    }
  };

  const decideDepth = (input: string, intent: string): string => {
    if (/brief|quick|summary|overview/i.test(input)) return "brief";
    if (/detailed|comprehensive|full|thorough|complete/i.test(input))
      return "detailed";
    if (/deep|exhaustive|extensive|in-depth/i.test(input)) return "exhaustive";

    // Intent-based defaults
    if (intent.includes("research") || intent.includes("analysis"))
      return "detailed";
    return "standard";
  };

  const createReasoningStep = (
    step: ReasoningStep["step"],
    value: string,
  ): ReasoningStep => ({
    step,
    value,
    timestamp: new Date(),
  });

  // Project Context Management Functions
  const initializeProjectContext = (
    planData: ProjectPlan,
    originalPrompt: string,
    domain: string,
  ): ActiveProjectContext => ({
    planData,
    isActive: true,
    metadata: {
      domain,
      originalPrompt,
      createdAt: new Date(),
    },
  });

  const updateProjectContext = (updatedPlan: ProjectPlan): void => {
    if (activeProjectContext) {
      setActiveProjectContext({
        ...activeProjectContext,
        planData: updatedPlan,
      });
    }
  };

  const clearProjectContext = (): void => {
    setActiveProjectContext(null);
  };

  const isProjectUpdateRequest = (input: string): boolean => {
    // If there's no active project, it can't be an update
    if (!activeProjectContext?.isActive) {
      return false;
    }

    const updateKeywords = [
      "add",
      "include",
      "integrate",
      "also",
      "update",
      "modify",
      "change",
      "append",
      "extend",
      "enhance",
      "improve",
      "plus",
      "additional",
      "more",
      "extra",
      "further",
      "another",
      "with",
      "and",
    ];

    const hasUpdateKeyword = updateKeywords.some((keyword) =>
      input.toLowerCase().includes(keyword),
    );

    // Check if it's a short, incremental request (likely an update)
    const isShortRequest = input.trim().split(" ").length < 15;

    // Check if the input doesn't contain typical new project indicators
    const newProjectKeywords = [
      "create a project",
      "new project",
      "project for",
      "build a",
      "develop a",
      "make a",
      "design a",
      "planning a",
      "starting a",
    ];

    const isNewProjectRequest = newProjectKeywords.some((phrase) =>
      input.toLowerCase().includes(phrase),
    );

    // It's likely an update if:
    // 1. It has update keywords, OR
    // 2. It's a short request and doesn't seem like a new project
    return hasUpdateKeyword || (isShortRequest && !isNewProjectRequest);
  };

  const processUserMessage = async (userInput: string): Promise<void> => {
    try {
      setIsProcessingFiles(true);

      // Use the new streamlined handlePrompt function
      await handlePrompt(userInput);
    } catch (error) {
      console.error("Processing error:", error);
      toast({
        title: "Error",
        description: "Failed to process request",
        variant: "destructive",
      });
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // State to store processed file content for combining with user input
  const [fileContext, setFileContext] = useState<string | null>(null);

  // Process uploaded files - stores context for combining with user input
  const processUploadedFiles = async (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch("/api/ai/process-files", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process files");
      }

      const data = await response.json();

      // Store the file context for combining with user text input
      const extractedContext = data.generatedPrompt || data.summary || data.fileContent || "";
      setFileContext(extractedContext);

      // Add message prompting user to provide additional context
      const fileMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        content:
          `I've analyzed the uploaded files. ${data.summary || "I found relevant project information."}\n\nPlease describe what you'd like to do with this content, or type "generate plan" to create a project plan from the files.`,
        role: "assistant",
        timestamp: new Date(),
        attachments: uploadedFiles,
      };

      setMessages((prev) => [...prev, fileMessage]);

      // If a complete project plan was extracted directly, show it
      if (data.projectPlan) {
        setCurrentPlan(data.projectPlan);
        setShowCanvas(true);
      }
      // No longer auto-generate - wait for user input to combine with file context
    } catch (error) {
      toast({
        title: "Failed to process files",
        description: "There was an error analyzing your uploaded files.",
        variant: "destructive",
      });
    }
  };

  // Save project plan to database
  const saveProjectPlan = async (projectId: string, planData: any) => {
    try {
      await apiRequest(`/api/projects`, {
        method: "POST",
        body: JSON.stringify({
          id: projectId,
          name: planData.name,
          description: planData.description,
          startDate: planData.startDate,
          endDate: planData.endDate,
          milestones: planData.milestones,
          status: "active",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      console.log("💾 Project saved to database:", projectId);
      
      // Invalidate project queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "milestones"] });
    } catch (error) {
      console.error("Failed to save project:", error);
    }
  };

  // Generate new project plan using AI chat endpoint
  const generateProjectPlan = async (prompt: string) => {
    // Combine user input with file context if available
    let combinedMessage = prompt;
    if (fileContext) {
      // Check if user just wants to generate from files
      const isGenerateFromFiles = prompt.toLowerCase().includes("generate plan") || 
                                   prompt.toLowerCase().includes("create plan from");
      
      if (isGenerateFromFiles) {
        combinedMessage = `Based on the following file content, create a comprehensive project plan:\n\n${fileContext}`;
      } else {
        // Combine user's specific request with file context
        combinedMessage = `User Request: ${prompt}\n\nContext from uploaded files:\n${fileContext}\n\nPlease create a project plan that incorporates both the user's request and the file content.`;
      }
      
      // Clear file context after using it
      setFileContext(null);
    }

    const response = await apiRequest("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        message: combinedMessage,
        sessionId: "temp-session",
        attachments: uploadedFiles,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    // If it's a direct canvas response, return the projectCanvas
    if (response.isDirectCanvas && response.projectCanvas) {
      return response.projectCanvas;
    }

    // Otherwise return the full response (for backwards compatibility)
    return response.projectCanvas || response;
  };

  // Update existing project plan using AI chat endpoint
  const updateProjectPlan = async (existingPlan: any, prompt: string) => {
    const updateMessage = `Update my existing project plan with: ${prompt}

EXISTING PROJECT:
Name: ${existingPlan.name}
Description: ${existingPlan.description}
Start Date: ${existingPlan.startDate}
End Date: ${existingPlan.endDate}

CURRENT MILESTONES & TASKS:
${existingPlan.milestones
  .map(
    (milestone: any) => `
${milestone.name} (Due: ${milestone.dueDate})
- Description: ${milestone.description}
- Tasks: ${milestone.tasks.map((task: any) => `• ${task.name} (${task.priority})`).join("\n  ")}
`,
  )
  .join("")}

INSTRUCTIONS:
- Keep ALL existing milestones and tasks that are still relevant
- Add new milestones/tasks for the requested feature: "${prompt}"
- Integrate the new features seamlessly into the existing project structure
- Maintain the same project timeline and structure format
- Return the COMPLETE updated project with both existing and new content`;

    const response = await apiRequest("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        message: updateMessage,
        sessionId: "temp-session",
        attachments: uploadedFiles,
        existingProject: existingPlan, // Send full project context
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    // If it's a direct canvas response, return the projectCanvas
    if (response.isDirectCanvas && response.projectCanvas) {
      return response.projectCanvas;
    }

    // Otherwise return the full response (for backwards compatibility)
    return response.projectCanvas || response;
  };

  // Main prompt handler following the specified pattern
  const handlePrompt = async (prompt: string) => {
    try {
      const hasActiveProject = activeProjectContext?.isActive && currentPlan;

      console.log("🚀 HandlePrompt called:", {
        prompt,
        hasActiveProject,
        activeProjectName: activeProjectContext?.planData?.name,
        currentPlanExists: !!currentPlan,
        showCanvas,
      });

      // Check if user explicitly wants to start a new project
      const isExplicitNewProject =
        prompt.toLowerCase().includes("new project") ||
        prompt.toLowerCase().includes("create a project") ||
        prompt.toLowerCase().includes("start fresh");

      if (!hasActiveProject || isExplicitNewProject) {
        // Create new plan
        console.log("🆕 Creating new project plan");
        const newPlan = await generateProjectPlan(prompt);

        // Set as active project and display in canvas
        const newContext = initializeProjectContext(
          newPlan,
          prompt,
          currentReasoning?.domain || "general",
        );
        setActiveProjectContext(newContext);
        setCurrentPlan(newPlan);
        setShowCanvas(true);

        console.log("✅ Active project context set:", newContext);
        console.log("✅ Current plan set:", newPlan);
        console.log("✅ Show canvas set to:", true);

        // Auto-save to database
        const projectId = (newPlan as any).id || Date.now().toString();
        await saveProjectPlan(projectId, newPlan);
      } else {
        // Update existing plan - ANY input when there's an active project is treated as an update
        console.log("📝 Updating existing project plan with input:", prompt);
        console.log("📝 Existing plan:", activeProjectContext.planData?.name);
        const existingPlan = activeProjectContext.planData;
        const updatedPlan = await updateProjectPlan(existingPlan, prompt);

        // Update active project and refresh canvas
        updateProjectContext(updatedPlan);
        setCurrentPlan(updatedPlan);
        setShowCanvas(true);

        console.log("✅ Project updated successfully");

        // Auto-save to database
        const projectId = (existingPlan as any).id || Date.now().toString();
        await saveProjectPlan(projectId, updatedPlan);
      }
    } catch (error) {
      console.error("HandlePrompt error:", error);
      toast({
        title: "Error",
        description: "Failed to process project request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async (text?: string) => {
    const message = text || input.trim();
    if (!message || isProcessingFiles) return;

    setInput("");

    console.log("📝 Message received:", message);
    console.log("🔍 Current active context:", {
      hasActive: activeProjectContext?.isActive,
      projectName: activeProjectContext?.planData?.name,
      contextExists: !!activeProjectContext,
    });

    // Use handlePrompt instead of processUserMessage to maintain active project context
    await handlePrompt(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSaveProject = async (projectData: ProjectPlan) => {
    try {
      // Transform the project data to match the API format
      const projectPayload = {
        plan: {
          name: projectData.name,
          description: projectData.description,
          timeline: {
            startDate: projectData.startDate,
            endDate: projectData.endDate,
          },
          tasks: [] as any[],
          milestones: projectData.milestones,
        },
      };

      // Extract all tasks from milestones
      if (projectData.milestones) {
        projectData.milestones.forEach((milestone) => {
          if (milestone.tasks) {
            milestone.tasks.forEach((task) => {
              projectPayload.plan.tasks.push({
                name: task.name,
                description: task.description,
                dueDate: task.dueDate,
                priority: task.priority,
              });
            });
          }
        });
      }

      const response = await fetch("/api/projects/from-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(projectPayload),
      });

      if (!response.ok) {
        throw new Error("Failed to save project");
      }

      const result = await response.json();

      // Invalidate all project-related queries including milestones
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (result?.project?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", result.project.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", result.project.id, "milestones"] });
      }

      toast({
        title: "Project created!",
        description: `${projectData.name} has been saved successfully.`,
      });

      // Clear project context after successful save
      clearProjectContext();
      setShowCanvas(false);
      setCurrentPlan(null);

      setLocation("/projects");
    } catch (error) {
      console.error("Error saving project:", error);
      toast({
        title: "Error",
        description: "Failed to save project. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-full">
      {/* Chat Panel */}
      <div
        className={`${showCanvas ? "w-1/2" : "w-full max-w-4xl mx-auto"} transition-all duration-300`}
      >
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <Brain className="h-6 w-6 mr-2 text-purple-600" />
              AI Project Planner
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0">
            {/* Prompt Suggestions */}
            <div className="px-6 pb-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {promptSuggestions.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    className={`rounded-full text-xs font-medium ${prompt.color} hover:opacity-80 transition-opacity`}
                    onClick={() => {
                      if (prompt.text === "Upload project docs") {
                        // Trigger file upload
                        const fileInput = document.querySelector(
                          'input[type="file"]',
                        ) as HTMLInputElement;
                        if (fileInput) fileInput.click();
                      } else {
                        handleSendMessage(prompt.text);
                      }
                    }}
                  >
                    <prompt.icon className="h-3 w-3 mr-1" />
                    {prompt.text}
                  </Button>
                ))}
              </div>

              {/* Project Context & Reasoning Controls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReasoningSteps(!showReasoningSteps)}
                    className="text-xs"
                  >
                    {showReasoningSteps ? (
                      <EyeOff className="h-3 w-3 mr-1" />
                    ) : (
                      <Eye className="h-3 w-3 mr-1" />
                    )}
                    {showReasoningSteps ? "Hide" : "Show"} AI Reasoning
                  </Button>

                  {currentReasoning && (
                    <Badge variant="secondary" className="text-xs">
                      <Brain className="h-3 w-3 mr-1" />
                      Transparent AI Process
                    </Badge>
                  )}
                </div>

                {/* Active Project Context Indicator */}
                {activeProjectContext?.isActive && (
                  <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center text-xs text-green-800">
                      <Target className="h-3 w-3 mr-1" />
                      <span className="font-medium">Active Project:</span>
                      <span className="ml-1 truncate max-w-32">
                        {activeProjectContext.planData.name}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        clearProjectContext();
                        toast({
                          title: "Project context cleared",
                          description:
                            "Next input will create a new project plan",
                        });
                      }}
                      className="h-6 w-6 p-0 text-green-600 hover:text-green-800"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Reasoning Steps Display */}
              {showReasoningSteps && currentReasoning && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border">
                  <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                    <Brain className="h-4 w-4 mr-1" />
                    AI Reasoning Process
                  </h4>
                  <div className="space-y-2">
                    {currentReasoning.reasoning.map((step, index) => (
                      <div
                        key={index}
                        className="flex items-center text-xs text-blue-800"
                      >
                        <div className="w-2 h-2 bg-blue-400 rounded-full mr-2" />
                        <span className="font-medium capitalize">
                          {step.step}:
                        </span>
                        <ArrowRight className="h-3 w-3 mx-1" />
                        <span>{step.value.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-4 pb-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>

                      {/* Display attachments */}
                      {message.attachments &&
                        message.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {message.attachments.map((file) => (
                              <div
                                key={file.id}
                                className="flex items-center gap-2 text-xs opacity-80"
                              >
                                <FileText className="h-3 w-3" />
                                <span>{file.name}</span>
                                <span>
                                  ({(file.size / 1024).toFixed(1)} KB)
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                      {message.projectPlan && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Project plan ready
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isProcessingFiles && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <RotatingLoadingText />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* File Upload Zone */}
            {uploadedFiles.length > 0 && (
              <div className="border-t px-4 py-2 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-600">
                    {uploadedFiles.length} file
                    {uploadedFiles.length > 1 ? "s" : ""} attached
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUploadedFiles([])}
                    className="text-xs"
                  >
                    Clear all
                  </Button>
                </div>
                <div className="mt-1 space-y-1">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between text-xs bg-white rounded px-2 py-1"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3 text-gray-400" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setUploadedFiles((prev) =>
                            prev.filter((f) => f.id !== file.id),
                          )
                        }
                        className="h-5 w-5 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="border-t p-4">
              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`mb-3 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-purple-400 bg-purple-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input {...getInputProps()} />
                {isProcessingFiles ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing files...
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">
                    <Upload className="h-4 w-4 mx-auto mb-1" />
                    {isDragActive
                      ? "Drop files here"
                      : "Drag & drop files or click to upload"}
                    <div className="text-xs text-gray-400 mt-1">
                      PDF, DOCX, Excel, CSV, TXT, Images (Max 20MB)
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Describe your project idea or ask about uploaded files..."
                  className="min-h-[60px] resize-none"
                  rows={2}
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || isProcessingFiles}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Canvas */}
      {showCanvas && currentPlan && (
        <div className="w-1/2 p-4">
          <ProjectPlannerCanvas
            projectPlan={currentPlan}
            onSave={handleSaveProject}
            onClose={() => {
              setShowCanvas(false);
              setCurrentPlan(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
