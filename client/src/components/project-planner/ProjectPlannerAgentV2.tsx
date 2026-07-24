import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { mergePlansClient } from "@/utils/plan-merge";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import {
  Brain,
  Send,
  Loader2,
  Rocket,
  Target,
  Calendar,
  Upload,
  FileText,
  X,
  MessageSquare,
  Plus,
  History,
  Settings,
  Bookmark,
  Archive,
  Users,
  BarChart3,
  Clock,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Quote,
  Search,
  ArrowRight,
} from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ProjectPlannerCanvasV2 } from "./ProjectPlannerCanvasV2";
import { useDropzone } from "react-dropzone";
import { safeFormatDate } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { ModeToggle, type AppMode } from "@/components/modes/build/ModeToggle";
import { FeatureCandidateCard } from "@/components/modes/build/FeatureCandidateCard";
import { PriorityMatrix } from "@/components/modes/build/PriorityMatrix";
import { PromptPills } from "@/components/modes/build/PromptPills";
import { ExportReport } from "@/components/modes/build/ExportReport";
import { SendToAgentDialog } from "@/components/modes/build/SendToAgentDialog";
import { Code2 } from "lucide-react";
import { ConversationSelector, getConversationContextText } from "@/components/meetings/ConversationSelector";
import type { Conversation, EvidenceItem } from "@shared/schema";
import { Library, Check } from "lucide-react";

interface FeatureInsight {
  theme: string;
  root_cause: string;
  supporting_quotes: string[];
}

interface BuildFeature {
  feature_title: string;
  why_now: string;
  evidence: string[];
  ui_changes?: string;
  data_model_changes?: string;
  workflow_changes?: string;
  insights?: FeatureInsight[];
  reasoning_chain?: string;
  tasks?: Array<{ name: string; description: string; priority: string }>;
}

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  projectPlan?: ProjectPlan;
  attachments?: FileAttachment[];
  clarifications?: string[];
  suggestions?: string[];
  sessionId?: string;
  buildFeatures?: BuildFeature[];
}

interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
}

interface Task {
  id: string;
  name: string;
  description?: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  status?: string;
  assignee?: string;
}

interface Milestone {
  id: string;
  name: string;
  description?: string;
  dueDate: string;
  tasks: Task[];
}

interface ProjectPlan {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  milestones: Milestone[];
}

interface PromptSuggestion {
  icon: any;
  text: string;
  color: string;
}

export function ProjectPlannerAgentV2() {
  const getWelcomeMessage = (mode: AppMode): ChatMessage => ({
    id: "welcome",
    content: mode === "build"
      ? "Ready to discover what to build next. Paste a meeting transcript, upload feedback files, or describe what you're hearing from users — I'll identify the most impactful features to ship."
      : "Ready to plan your project. Describe your idea or upload requirements — I'll create a structured, actionable plan with milestones and tasks.",
    role: "assistant",
    timestamp: new Date(),
  });

  const [messages, setMessages] = useState<ChatMessage[]>([getWelcomeMessage("plan")]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<ProjectPlan | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<FileAttachment[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [fileContext, setFileContext] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeView, setActiveView] = useState<
    "chat" | "history" | "templates" | "analytics" | "settings" | "saved"
  >("chat");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState("");
  const [projectToSave, setProjectToSave] = useState<ProjectPlan | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(
    "Analyzing your project requirements...",
  );
  const [appMode, setAppMode] = useState<AppMode>("plan");
  const [isTyping, setIsTyping] = useState(false);
  const [brainContextCount, setBrainContextCount] = useState(0);
  const [useContextBrain, setUseContextBrain] = useState(true);
  const [recentlyApprovedProjectId, setRecentlyApprovedProjectId] = useState<number | null>(null);
  const [postApprovalCandidate, setPostApprovalCandidate] = useState<{
    id: number;
    featureTitle: string;
    status: string;
    whyNow?: string | null;
    evidence?: string[] | null;
    uiChanges?: string | null;
    dataModelChanges?: string | null;
    workflowChanges?: string | null;
    tasks?: Array<{ name?: string; title?: string; description?: string; priority?: string }>;
  } | null>(null);
  const [postApprovalAgentDialogOpen, setPostApprovalAgentDialogOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { showUpgrade } = useUpgradeModal();

  // Query for fetching chat sessions
  const {
    data: chatSessions,
    isLoading: sessionsLoading,
    refetch: refetchSessions,
    error: sessionsError,
  } = useQuery({
    queryKey: ["/api/ai/chat-sessions"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/ai/chat-sessions", {
          credentials: "include",
        });
        if (!response.ok) {
          if (response.status === 401) return [];
          throw new Error("Failed to fetch chat sessions");
        }
        return response.json();
      } catch (error) {
        console.warn(
          "Failed to fetch chat sessions, returning empty array:",
          error,
        );
        return [];
      }
    },
    retry: false,
  });

  // Auto-restore session persistence on component mount
  useEffect(() => {
    const autoRestoreSession = async () => {
      const savedSessionId = localStorage.getItem("last-agent-session-id");
      if (chatSessions && chatSessions.length > 0 && !sessionId) {
        const sessionToRestore =
          (savedSessionId &&
            (chatSessions as any[]).find(
              (s: any) => s.sessionId === savedSessionId,
            )) ||
          chatSessions[0];

        if (sessionToRestore) {
          await loadChatHistory(sessionToRestore.sessionId);
          localStorage.setItem(
            "last-agent-session-id",
            sessionToRestore.sessionId,
          );
          toast({
            title: "Chat History Restored",
            description:
              "Your previous conversation has been automatically restored.",
            duration: 3000,
          });
        }
      }
    };
    if (!sessionsLoading && !loadingHistory) autoRestoreSession();
  }, [chatSessions, sessionsLoading, sessionId, loadingHistory]);

  // Predefined quick prompt suggestions (kept for future use)
  const [promptSuggestions] = useState<PromptSuggestion[]>([
    {
      icon: FileText,
      text: "Analyze client RFP document",
      color: "text-emerald-600",
    },
    {
      icon: Users,
      text: "Extract stakeholder requirements",
      color: "text-blue-600",
    },
    {
      icon: Target,
      text: "Create enterprise implementation plan",
      color: "text-purple-600",
    },
    {
      icon: BarChart3,
      text: "Process compliance documentation",
      color: "text-orange-600",
    },
  ]);

  // Load chat history for a specific session
  const loadChatHistory = async (sessionIdToLoad: string) => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/ai/chat-history/${sessionIdToLoad}`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Authentication Required",
            description: "Please log in to access chat history",
            variant: "destructive",
          });
          return;
        }
        throw new Error("Failed to load chat history");
      }

      const history = await response.json();
      const historyMessages: ChatMessage[] = history.map((msg: any) => ({
        id: msg.id.toString(),
        content: msg.content,
        role: msg.role,
        timestamp: new Date(msg.timestamp),
        projectPlan: msg.projectCanvas,
        suggestions: msg.suggestions,
        clarifications: msg.clarifications,
      }));

      setMessages([
        {
          id: "welcome",
          content: appMode === "build"
            ? "Welcome back! Here's your previous Build Mode conversation."
            : "Welcome back! Here's your previous Plan Mode conversation.",
          role: "assistant",
          timestamp: new Date(),
        },
        ...historyMessages,
      ]);
      setSessionId(sessionIdToLoad);
      localStorage.setItem("last-agent-session-id", sessionIdToLoad);

      const lastMessage = historyMessages[historyMessages.length - 1];
      if (lastMessage?.projectPlan) setCurrentPlan(lastMessage.projectPlan);
    } catch (error) {
      console.error("Error loading chat history:", error);
      toast({
        title: "Error",
        description: "Failed to load chat history",
        variant: "destructive",
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  // Start a new chat session
  const startNewChat = async () => {
    try {
      const response = await fetch("/api/ai/chat-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setSessionId(null);
          setMessages([getWelcomeMessage(appMode)]);
          setCurrentPlan(null);
          setUploadedFiles([]);
          return;
        }
        throw new Error("Failed to create new session");
      }

      const result = await response.json();
      setSessionId(result.sessionId);
      setMessages([getWelcomeMessage(appMode)]);
      setCurrentPlan(null);
      setUploadedFiles([]);
      setRecentlyApprovedProjectId(null);
      setPostApprovalCandidate(null);
      setPostApprovalAgentDialogOpen(false);
      setBuildSessionCandidateIds([]);
      setShowBuildHistory(false);
      setBatchSelectionMode(false);
      setSelectedCandidateIds([]);
      setSelectedConversationIds([]);
      setSelectedEvidenceIds([]);
      localStorage.setItem("last-agent-session-id", result.sessionId);
      refetchSessions();
    } catch (error) {
      console.error("Error creating new session:", error);
      toast({
        title: "Error",
        description: "Failed to start new chat",
        variant: "destructive",
      });
    }
  };

  // Handle file drops/uploads - stores context for combining with user input
  const onDrop = async (acceptedFiles: File[]) => {
    setIsProcessingFiles(true);

    const newFiles: FileAttachment[] = acceptedFiles.map((file) => ({
      id: `file_${Date.now()}_${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.type,
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    const formData = new FormData();
    acceptedFiles.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/ai/process-files", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to process files");

      const result = await response.json();
      
      // Store the file context for combining with user text input
      const extractedContext = result.generatedPrompt || result.summary || result.fileContent || "";
      setFileContext(extractedContext);

      const fileMessage: ChatMessage = {
        id: Date.now().toString(),
        content:
          `I've analyzed the uploaded files. ${result.summary || "I found relevant project information."}\n\nPlease describe what you'd like to do with this content, or type "generate plan" to create a project plan from the files.`,
        role: "assistant",
        timestamp: new Date(),
        projectPlan: result.projectCanvas || result.projectPlan,
      };

      setMessages((prev) => [...prev, fileMessage]);
      
      // Only set plan if a complete one was extracted directly
      if (result.projectCanvas || result.projectPlan) {
        setCurrentPlan(result.projectCanvas || result.projectPlan);
      }

      // Auto-save uploaded files as evidence items
      for (const file of acceptedFiles) {
        try {
          await fetch("/api/evidence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              title: file.name,
              content: extractedContext.slice(0, 5000) || `Uploaded file: ${file.name}`,
              source: "file",
              tags: ["auto-imported"],
              metadata: { fileName: file.name, fileSize: file.size, fileType: file.type },
            }),
          });
        } catch (e) {
          console.warn("Failed to auto-save evidence for file:", file.name, e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/evidence"] });
    } catch (error) {
      console.error("Error processing files:", error);
      toast({
        title: "Error",
        description: "Failed to process files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingFiles(false);
    }
  };

  // ⬇️ UPDATED: expose `open`, use noClick/noKeyboard, keep 100MB cap
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-powerpoint": [".ppt"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        [".pptx"],
      "application/rtf": [".rtf"],
      "text/rtf": [".rtf"],
      "application/json": [".json"],
      "text/xml": [".xml"],
      "application/xml": [".xml"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    disabled: isProcessingFiles,
    noClick: true,
    noKeyboard: true,
    onDropRejected: (rejections) => {
      const tooBig = rejections.find((r) =>
        r.errors.some((e) => e.code === "file-too-large"),
      );
      if (tooBig) {
        toast({
          title: "File too large",
          description: "Each file must be 100MB or smaller.",
          variant: "destructive",
        });
      }
    },
  });

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Update canvas when projectPlan arrives
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.projectPlan && lastMessage.role === "assistant") {
      setCurrentPlan(lastMessage.projectPlan);
    } else {
      const lastAssistantWithPlan = messages
        .filter((m) => m.role === "assistant" && m.projectPlan)
        .pop();
      if (lastAssistantWithPlan?.projectPlan)
        setCurrentPlan(lastAssistantWithPlan.projectPlan);
    }
  }, [messages]);

  // Persist session in localStorage
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("requisor_current_session", sessionId);
      const sessionData = {
        sessionId,
        messages: messages.slice(0, 50),
        currentPlan,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(
        `requisor_session_${sessionId}`,
        JSON.stringify(sessionData),
      );
    }
  }, [sessionId, messages, currentPlan]);

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem("requisor_current_session");
    if (savedSessionId && !sessionId) {
      const sessionDataStr = localStorage.getItem(
        `requisor_session_${savedSessionId}`,
      );
      if (sessionDataStr) {
        try {
          const sessionData = JSON.parse(sessionDataStr);
          const lastUpdated = new Date(sessionData.lastUpdated);
          const hoursSinceUpdate =
            (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
          if (hoursSinceUpdate < 24) {
            setSessionId(sessionData.sessionId);
            setMessages(
              sessionData.messages.map((m: any) => ({
                ...m,
                timestamp: new Date(m.timestamp),
              })),
            );
            if (sessionData.currentPlan)
              setCurrentPlan(sessionData.currentPlan);
          } else {
            localStorage.removeItem("requisor_current_session");
            localStorage.removeItem(`requisor_session_${savedSessionId}`);
          }
        } catch (e) {
          console.error("Error loading saved session:", e);
        }
      }
    }
  }, []);

  const generateProjectPlan = useMutation({
    mutationFn: async ({
      message,
      isUpdate,
      currentPlan: existingPlan,
    }: {
      message: string;
      isUpdate: boolean;
      currentPlan: ProjectPlan | null;
    }) => {
      try {
        let currentSessionId = sessionId;
        if (!currentSessionId) {
          try {
            const sessionResponse = await fetch("/api/ai/chat-sessions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({}),
            });
            if (sessionResponse.ok) {
              const sessionResult = await sessionResponse.json();
              currentSessionId = sessionResult.sessionId;
              setSessionId(currentSessionId);
              if (currentSessionId)
                localStorage.setItem("last-agent-session-id", currentSessionId);
            }
          } catch (error) {
            console.warn(
              "Failed to create session, continuing in demo mode:",
              error,
            );
          }
        }

        const msgId = `stream-plan-${Date.now()}`;
        setStreamingMessageId(msgId);
        setMessages((prev) => [...prev, {
          id: msgId,
          content: "",
          role: "assistant" as const,
          timestamp: new Date(),
        }]);

        const response = await fetch("/api/ai/chat-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            message,
            sessionId: currentSessionId,
            attachments: uploadedFiles,
            existingProject: isUpdate ? existingPlan : undefined,
            useContextBrain,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = "Failed to generate project plan";
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let planData: any = null;
        let receivedSessionId: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "text") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === msgId ? { ...m, content: m.content + event.content } : m
                  )
                );
              } else if (event.type === "status") {
                setLoadingMessage(event.content || "Processing...");
              } else if (event.type === "session") {
                receivedSessionId = event.sessionId;
                setSessionId(event.sessionId);
                localStorage.setItem("last-agent-session-id", event.sessionId);
              } else if (event.type === "context_brain") {
                setBrainContextCount(event.count || 0);
              } else if (event.type === "plan") {
                planData = event.data;
              } else if (event.type === "done") {
                if (event.sessionId) {
                  receivedSessionId = event.sessionId;
                  setSessionId(event.sessionId);
                  localStorage.setItem("last-agent-session-id", event.sessionId);
                }
              } else if (event.type === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === msgId ? { ...m, content: event.content || "An error occurred." } : m
                  )
                );
              }
            } catch {}
          }
        }

        setStreamingMessageId(null);
        return { planData, isUpdate, existingPlan, msgId, sessionId: receivedSessionId };
      } catch (error) {
        setStreamingMessageId(null);
        console.error("Fetch error in generateProjectPlan:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      const { planData, isUpdate: wasUpdate, existingPlan, msgId } = data;

      let projectPlan = planData?.projectCanvas || null;

      if (projectPlan && wasUpdate && existingPlan) {
        const diffMetadata = planData?.diff;
        const mergeResult = mergePlansClient(existingPlan, projectPlan, diffMetadata);
        if (mergeResult.warning) {
          toast({
            title: "Plan Merged (Client Fallback)",
            description: mergeResult.warning,
            duration: 5000,
          });
        }
        projectPlan = mergeResult.mergedPlan;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                projectPlan,
                clarifications: planData?.clarifications,
                suggestions: planData?.suggestions,
                sessionId: data.sessionId || undefined,
              }
            : m
        )
      );

      setIsTyping(false);
      if (projectPlan) setCurrentPlan(projectPlan);
      setUploadedFiles([]);
      
      // Invalidate project queries to refresh UI when milestones are updated
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error) => {
      setIsTyping(false);
      setStreamingMessageId(null);
      console.error("Error generating project plan:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate project plan",
        variant: "destructive",
      });
    },
  });

  const [buildSessionCandidateIds, setBuildSessionCandidateIds] = useState<number[]>([]);
  const [showBuildHistory, setShowBuildHistory] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState<number[]>([]);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<number[]>([]);
  const [showEvidencePicker, setShowEvidencePicker] = useState(false);
  const [showExportReport, setShowExportReport] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
  const [showBatchAgentDialog, setShowBatchAgentDialog] = useState(false);
  const [batchSelectionMode, setBatchSelectionMode] = useState(false);

  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        if (appMode === "build") {
          if (batchSelectionMode && selectedCandidateIds.length > 0) {
            setShowBatchAgentDialog(true);
          } else {
            setBatchSelectionMode(true);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [appMode, batchSelectionMode, selectedCandidateIds]);

  const { data: allConversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: featureCandidates = [] } = useQuery({
    queryKey: ["/api/feature-candidates"],
    enabled: appMode === "build" && (showBuildHistory || buildSessionCandidateIds.length > 0),
  });

  const { data: allEvidenceItems = [] } = useQuery<EvidenceItem[]>({
    queryKey: ["/api/evidence"],
  });

  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [expandedInsights, setExpandedInsights] = useState<Record<string, boolean>>({});

  const buildChatMutation = useMutation({
    mutationFn: async (message: string) => {
      const convContextText = getConversationContextText(allConversations, selectedConversationIds);
      const evidenceContextText = selectedEvidenceIds.length > 0
        ? allEvidenceItems
            .filter((e) => selectedEvidenceIds.includes(e.id))
            .map((e) => `[Evidence: ${e.title}] (source: ${e.source})\n${e.content}`)
            .join("\n\n---\n\n")
        : undefined;
      const recentHistory = messages
        .filter((m) => m.id !== "welcome")
        .slice(-10)
        .map((m) => ({
          role: m.role,
          content: m.content.replace(/```json[\s\S]*?```/g, '').trim(),
        }));
      const contextParts = [convContextText, evidenceContextText].filter(Boolean).join("\n\n---\n\n");

      const msgId = `stream-${Date.now()}`;
      setStreamingMessageId(msgId);
      setMessages((prev) => [...prev, {
        id: msgId,
        content: "",
        role: "assistant" as const,
        timestamp: new Date(),
      }]);

      const response = await fetch("/api/ai/build-chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message,
          context: contextParts || undefined,
          chatHistory: recentHistory,
          useContextBrain,
        }),
      });

      if (!response.ok) throw new Error("Failed to start streaming");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let features: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId ? { ...m, content: m.content + event.content } : m
                )
              );
            } else if (event.type === "features") {
              features = event.data || [];
              if (process.env.NODE_ENV !== 'production') {
                console.log("[Build Mode] Features received:", features.length, features.map((f: BuildFeature) => ({
                  title: f.feature_title,
                  hasInsights: !!(f.insights && f.insights.length > 0),
                  hasReasoning: !!f.reasoning_chain,
                })));
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId ? { ...m, buildFeatures: features } : m
                )
              );
            } else if (event.type === "context_brain") {
              setBrainContextCount(event.count || 0);
            } else if (event.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId ? { ...m, content: event.content || "An error occurred." } : m
                )
              );
            }
          } catch {}
        }
      }

      setStreamingMessageId(null);
      return { features };
    },
    onSuccess: (data: any) => {
      setIsTyping(false);
      if (data?.features && data.features.length > 0) {
        saveBuildFeatures(data.features);
      }
    },
    onError: (error: any) => {
      setIsTyping(false);
      setStreamingMessageId(null);
      toast({
        title: "Error",
        description: error.message || "Failed to process build request",
        variant: "destructive",
      });
    },
  });

  const saveBuildFeatures = async (features: any[]) => {
    const newIds: number[] = [];
    let savedAny = false;
    for (const feature of features) {
      try {
        // Normalise evidence_refs (LLM snake_case) → evidenceRefs (column).
        // Each ref pairs a quote with a transcript_id so the card can render
        // a clickable link back to the source transcript.
        const evidenceRefs = Array.isArray(feature.evidence_refs)
          ? feature.evidence_refs
              .filter((r: any) => r && typeof r.quote === "string")
              .map((r: any) => ({
                quote: r.quote,
                transcriptId: r.transcript_id ?? r.transcriptId ?? null,
                documentId: r.document_id ?? r.documentId ?? null,
                sourceLabel: r.source_label ?? r.sourceLabel ?? null,
                meetingTitle: r.meeting_title ?? r.meetingTitle ?? null,
              }))
          : [];
        const result = await apiRequest("/api/feature-candidates", {
          method: "POST",
          body: JSON.stringify({
            featureTitle: feature.feature_title,
            whyNow: feature.why_now,
            evidence: feature.evidence || [],
            evidenceRefs,
            uiChanges: feature.ui_changes,
            dataModelChanges: feature.data_model_changes,
            workflowChanges: feature.workflow_changes,
            tasks: feature.tasks || [],
            sourceContext: "chat",
            insights: feature.insights || [],
            reasoningChain: feature.reasoning_chain || "",
          }),
        });
        savedAny = true;
        if (result && result.id) {
          newIds.push(result.id);
        }
      } catch (e) {
        console.error("Failed to save feature candidate:", e);
      }
    }
    if (newIds.length > 0) {
      setBuildSessionCandidateIds((prev) => [...prev, ...newIds]);
    } else if (savedAny) {
      setShowBuildHistory(true);
    }
    queryClient.invalidateQueries({ queryKey: ["/api/feature-candidates"] });
  };

  const approveFeatureMutation = useMutation({
    mutationFn: async (id: number) => {
      const result = await apiRequest(`/api/feature-candidates/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      }) as { candidate: { id: number; featureTitle: string; status: string; whyNow?: string; evidence?: string[]; uiChanges?: string; dataModelChanges?: string; workflowChanges?: string; tasks?: Array<{ name?: string; title?: string; description?: string; priority?: string }> }; project: { id: number; name: string } };
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/feature-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });

      const projectId = data.project?.id;
      const projectName = data.project?.name || "your new project";
      const candidate = data.candidate;

      const candidateTasks = Array.isArray(candidate?.tasks) ? candidate.tasks : [];
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 30);
      const approvedPlan: ProjectPlan = {
        name: projectName,
        description: candidate?.whyNow || projectName,
        startDate: today.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        milestones: [{
          id: "milestone-1",
          name: "Implementation",
          description: `Tasks for ${projectName}`,
          dueDate: endDate.toISOString().split("T")[0],
          tasks: candidateTasks.map((t, i) => ({
            id: `task-${i + 1}`,
            name: t.name || t.title || `Task ${i + 1}`,
            description: t.description || "",
            dueDate: endDate.toISOString().split("T")[0],
            priority: (t.priority || "medium") as "high" | "medium" | "low",
            status: "todo",
          })),
        }],
      };
      setCurrentPlan(approvedPlan);
      setAppMode("plan");

      const nextStepMessage: ChatMessage = {
        id: `approved-${Date.now()}-${projectId || 0}`,
        content: `Feature approved and loaded into the project canvas as **${projectName}**. Here's what you can do next:\n\n` +
          `- **Send to a coding agent** to start implementation\n` +
          `- **View the project** to see tasks and milestones\n` +
          `- **Continue discovering** more features by switching back to Build mode`,
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, nextStepMessage]);

      if (projectId) {
        setRecentlyApprovedProjectId(projectId);
      }

      if (candidate) {
        setPostApprovalCandidate(candidate);
        setPostApprovalAgentDialogOpen(true);
      }

      toast({
        title: "Feature approved!",
        description: `Project "${projectName}" loaded into canvas. Choose a coding agent to start building.`,
      });
    },
  });

  const deleteFeatureMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/feature-candidates/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feature-candidates"] });
    },
  });

  // Cycle through loading messages while generating
  useEffect(() => {
    if (!generateProjectPlan.isPending) {
      setLoadingMessage("Analyzing your project requirements...");
      return;
    }

    const messages = [
      "Analyzing your project requirements...",
      "Identifying key milestones and deliverables...",
      "Breaking down tasks and dependencies...",
      "Estimating timelines and resource needs...",
      "Structuring your project plan...",
      "Finalizing recommendations and next steps...",
    ];

    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % messages.length;
      setLoadingMessage(messages[currentIndex]);
    }, 2000); // Change message every 2 seconds

    return () => clearInterval(interval);
  }, [generateProjectPlan.isPending]);

  const generateSessionTitle = useCallback(async (userMessage: string, sid: string) => {
    try {
      await fetch(`/api/ai/chat-sessions/${sid}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: userMessage }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/chat-sessions"] });
    } catch (e) {
      console.error("Failed to update session title:", e);
    }
  }, [queryClient]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    try {
      const budgetRes = await fetch("/api/tokens/budget");
      if (budgetRes.ok) {
        const budgetData = await budgetRes.json();
        if (!budgetData.allowed) {
          showUpgrade("token_limit");
          return;
        }
      }
    } catch {}

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: message,
      role: "user",
      timestamp: new Date(),
      attachments: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setUploadedFiles([]);

    const isFirstMessage = messages.length <= 1 && messages[0]?.id === "welcome";
    if (isFirstMessage && sessionId) {
      generateSessionTitle(message, sessionId);
    }

    setIsTyping(true);
    setBrainContextCount(0);
    if (appMode === "build") {
      buildChatMutation.mutate(message);
      return;
    }

    // Combine user input with file context and conversation context if available
    let combinedMessage = message;
    if (fileContext) {
      const isGenerateFromFiles = message.toLowerCase().includes("generate plan") || 
                                   message.toLowerCase().includes("create plan from");
      
      if (isGenerateFromFiles) {
        combinedMessage = `Based on the following file content, create a comprehensive project plan:\n\n${fileContext}`;
      } else {
        combinedMessage = `User Request: ${message}\n\nContext from uploaded files:\n${fileContext}\n\nPlease create a project plan that incorporates both the user's request and the file content.`;
      }
      
      setFileContext(null);
    }

    const convContext = getConversationContextText(allConversations, selectedConversationIds);
    if (convContext) {
      combinedMessage = `${combinedMessage}\n\nContext from meetings/conversations:\n${convContext}`;
    }

    if (selectedEvidenceIds.length > 0) {
      const evidenceContext = allEvidenceItems
        .filter((e) => selectedEvidenceIds.includes(e.id))
        .map((e) => `[Evidence: ${e.title}] (source: ${e.source})\n${e.content}`)
        .join("\n\n---\n\n");
      if (evidenceContext) {
        combinedMessage = `${combinedMessage}\n\nContext from Evidence Library:\n${evidenceContext}`;
      }
    }

    const isUpdate = currentPlan !== null;
    generateProjectPlan.mutate({ message: combinedMessage, isUpdate, currentPlan });
  };

  const handleSaveProject = async (projectData: ProjectPlan) => {
    // Show custom dialog instead of browser prompt
    setProjectToSave(projectData);
    setProjectNameInput(projectData.name || "");
    setShowSaveDialog(true);
  };

  const handleConfirmSave = async () => {
    if (!projectToSave || !projectNameInput.trim()) return;

    setShowSaveDialog(false);

    try {
      const projectPayload = {
        plan: {
          name: projectNameInput.trim(),
          description: projectToSave.description,
          timeline: {
            startDate: projectToSave.startDate,
            endDate: projectToSave.endDate,
          },
          tasks: [] as any[],
          milestones: projectToSave.milestones,
          tags: ["AI_Plan"],
        },
      };

      const response = await fetch("/api/projects/from-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(projectPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
      }

      const data = await response.json();
      console.log("Project creation response:", data);
      // Invalidate all project-related queries including milestones
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (data?.project?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", data.project.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", data.project.id, "milestones"] });
      }

      toast({
        title: "Project created!",
        description: `${projectNameInput.trim()} has been saved successfully. Starting a new chat session...`,
      });

      startNewChat();
      if (data && data.project && data.project.id) {
        console.log("Navigating to project:", data.project.id);
        setTimeout(() => {
          setLocation(`/project/${data.project.id}`);
        }, 5000); // Small delay to ensure toast is shown
      } else {
        console.log("No project ID found in response:", data);
      }

      // Reset dialog state
      setProjectToSave(null);
      setProjectNameInput("");
    } catch (error) {
      // Reset dialog state on error too
      setProjectToSave(null);
      setProjectNameInput("");
      console.error("Error saving project:", error);
      let errorMessage = "Failed to save project. Please try again.";
      let errorTitle = "Error";

      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes("403") || errMsg.includes("limit")) {
        showUpgrade("project_limit");
        return;
      }

      if (error instanceof Error && error.message) {
        try {
          const errorData = JSON.parse(error.message);
          if (errorData.details) errorMessage = errorData.details;
          else if (errorData.message) errorMessage = errorData.message;
        } catch {
          errorMessage = error.message;
        }
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Sidebar nav data (unchanged)
  const navigationSections = [
    {
      title: "Planning",
      items: [
        {
          id: "chat",
          icon: MessageSquare,
          label: "AI Chat",
          description: "Project planning assistant",
          badge: "Active",
        },
        {
          id: "templates",
          icon: Bookmark,
          label: "Templates",
          description: "Quick start templates",
          count: 4,
        },
      ],
    },
    {
      title: "Management",
      items: [
        {
          id: "history",
          icon: History,
          label: "History",
          description: "Previous conversations",
          count: chatSessions?.length || 0,
        },
        {
          id: "saved",
          icon: Archive,
          label: "Saved Plans",
          description: "Draft project plans",
        },
      ],
    },
    {
      title: "Insights",
      items: [
        {
          id: "analytics",
          icon: BarChart3,
          label: "Analytics",
          description: "Usage insights",
        },
        {
          id: "settings",
          icon: Settings,
          label: "Settings",
          description: "Preferences",
        },
      ],
    },
  ];

  const renderActiveView = () => {
    switch (activeView) {
      case "history":
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Chat History</h3>
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading sessions...</span>
              </div>
            ) : chatSessions && chatSessions.length > 0 ? (
              <div className="space-y-2">
                {(chatSessions as any[]).map((session: any) => (
                  <div
                    key={session.sessionId}
                    className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      loadChatHistory(session.sessionId);
                      setActiveView("chat");
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">
                        {session.title && session.title !== "New Conversation"
                          ? session.title
                          : `Session ${session.sessionId?.slice?.(0, 8) || ""}`}
                      </span>
                      <span className="text-xs text-gray-500">
                        {safeFormatDate(
                          session.updatedAt || session.createdAt,
                          "MMM d, h:mm a",
                          "No date"
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {session.last_message || "No messages yet"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No chat history yet
              </p>
            )}
          </div>
        );
      case "templates":
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Project Templates</h3>
            <div className="grid gap-4">
              {[
                {
                  name: "Product Launch",
                  icon: Rocket,
                  description: "Complete product launch project",
                },
                {
                  name: "Marketing Campaign",
                  icon: Target,
                  description: "90-day marketing campaign",
                },
                {
                  name: "Website Redesign",
                  icon: Brain,
                  description: "Website redesign project",
                },
                {
                  name: "Team Onboarding",
                  icon: Users,
                  description: "Employee onboarding process",
                },
              ].map((template, idx) => (
                <Card
                  key={idx}
                  className="p-4 hover:shadow-md cursor-pointer"
                  onClick={() => {
                    setInput(
                      `Plan a ${template.name.toLowerCase()} project with detailed milestones and tasks`,
                    );
                    setActiveView("chat");
                  }}
                >
                  <div className="flex items-center gap-3">
                    <template.icon className="h-8 w-8 text-purple-600" />
                    <div>
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-gray-600">
                        {template.description}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      case "analytics":
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Usage Analytics</h3>
            <div className="grid gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Total Projects Created
                  </span>
                  <span className="text-2xl font-bold text-purple-600">
                    {chatSessions?.length || 0}
                  </span>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">AI Conversations</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {chatSessions?.length || 0}
                  </span>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Files Processed</span>
                  <span className="text-2xl font-bold text-green-600">-</span>
                </div>
              </Card>
            </div>
          </div>
        );
      case "saved":
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Saved Project Plans</h3>
            <div className="space-y-3">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">E-commerce Platform Launch</h4>
                  <Badge variant="secondary">Draft</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  6 milestones, 24 tasks
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    Load
                  </Button>
                  <Button size="sm" variant="ghost">
                    Delete
                  </Button>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Marketing Campaign Q1</h4>
                  <Badge variant="secondary">Draft</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  4 milestones, 18 tasks
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    Load
                  </Button>
                  <Button size="sm" variant="ghost">
                    Delete
                  </Button>
                </div>
              </Card>
              <div className="text-center py-8 text-gray-500">
                <Archive className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No more saved plans</p>
              </div>
            </div>
          </div>
        );
      case "settings":
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Agent Settings</h3>
            <div className="space-y-4">
              <Card className="p-4">
                <h4 className="font-medium mb-2">AI Response Style</h4>
                <p className="text-sm text-gray-600 mb-3">
                  How detailed should the AI responses be?
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="style" defaultChecked />
                    <span className="text-sm">Detailed (Recommended)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="style" />
                    <span className="text-sm">Concise</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="style" />
                    <span className="text-sm">Expert</span>
                  </label>
                </div>
              </Card>
              <Card className="p-4">
                <h4 className="font-medium mb-2">Auto-save Projects</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Automatically save generated project plans
                </p>
                <label className="flex items-center gap-2">
                  <input type="checkbox" />
                  <span className="text-sm">Enable auto-save</span>
                </label>
              </Card>
              <Card className="p-4">
                <h4 className="font-medium mb-2">
                  Enterprise Document Processing
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  AI-powered analysis of large client requirement documents
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">File size limit:</span>
                    <span className="font-medium text-purple-600">100MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Supported formats:</span>
                    <span className="font-medium">15+ types</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Processing model:</span>
                    <span className="font-medium">GPT-4o</span>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500 bg-purple-50 p-2 rounded">
                  🎯 Optimized for RFPs, technical specs, compliance docs, and
                  multi-stakeholder requirements
                </div>
              </Card>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col lg:flex-row items-stretch gap-6 max-w-full overflow-hidden">
      {/* Chat Interface */}
      <Card className="flex-1 flex flex-col min-w-0 lg:w-1/2 min-h-0 overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Brain className={`h-6 w-6 ${appMode === "build" ? "text-orange-500" : "text-purple-600"}`} />
              <h2 className="text-xl font-semibold">
                {appMode === "build" ? "Product Discovery" : "AI Project Planner"}
              </h2>
              <Badge variant="secondary">
                {sessionId ? "Session Active" : "New Session"}
              </Badge>
              {sessionId && (
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-600"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  Persistent
                </Badge>
              )}
              {currentPlan && (
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-200 bg-green-50"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                  Plan Loaded
                </Badge>
              )}
            </div>

            {/* New Chat + Chat History */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={startNewChat}
              >
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <History className="h-4 w-4" />
                    History
                  </Button>
                </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Recent Conversations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sessionsLoading ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Loading sessions...
                  </div>
                ) : sessionsError ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Unable to load history
                  </div>
                ) : chatSessions && chatSessions.length > 0 ? (
                  (chatSessions as any[]).slice(0, 5).map((session: any) => (
                    <DropdownMenuItem
                      key={session.sessionId}
                      onClick={() =>
                        loadChatHistory(session.sessionId)
                      }
                      className="cursor-pointer"
                      disabled={loadingHistory}
                    >
                      <History className="h-4 w-4 mr-2" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          {session.title && session.title !== "New Conversation"
                            ? session.title
                            : `Session ${session.sessionId?.slice?.(0, 8) || ""}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {safeFormatDate(
                            session.updatedAt || session.createdAt,
                            "MMM d, h:mm a",
                            "No date"
                          )}
                        </p>
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No previous conversations
                  </div>
                )}
              </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {appMode === "build"
              ? "Analyze usage & feedback to discover what to build next"
              : "Enterprise-grade document analysis for client requirements up to 100MB"}
          </p>

          {/* Context Status Bar */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="outline" className={appMode === "build" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}>
              {appMode === "build" ? (
                <><Rocket className="h-3 w-3 mr-1" /> Build Mode</>
              ) : (
                <><Target className="h-3 w-3 mr-1" /> Plan Mode</>
              )}
            </Badge>
            {selectedConversationIds.length > 0 && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                <MessageSquare className="h-3 w-3 mr-1" />
                {selectedConversationIds.length} meeting{selectedConversationIds.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {selectedEvidenceIds.length > 0 && (
              <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                <Library className="h-3 w-3 mr-1" />
                {selectedEvidenceIds.length} evidence
              </Badge>
            )}
            {uploadedFiles.length > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                <FileText className="h-3 w-3 mr-1" />
                {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {currentPlan && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1" />
                Plan Active
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 p-6">
          <div className="space-y-4">
            {messages.map((message, messageIndex) => {
              const isUser = message.role === "user";
              const isAssistant = message.role === "assistant";
              const isWelcome = message.id === "welcome";
              const isLastMessage = messageIndex === messages.length - 1;
              const cleanContent = isAssistant
                ? (message.content
                    .replace(/```json[\s\S]*?```/g, '')
                    .replace(/^\s*\n/gm, '')
                    .trim() || message.content)
                : message.content;

              const showPills = isAssistant && isLastMessage && !input.trim() && !generateProjectPlan.isPending && !buildChatMutation.isPending;

              return (
                <div key={message.id}>
                  <div
                    className={`flex ${isUser ? "justify-end" : "justify-start"} animate-in fade-in-0 slide-in-from-bottom-2 duration-300`}
                  >
                    {isAssistant && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center mr-2 mt-1">
                        <Brain className="h-3.5 w-3.5 text-emerald-700" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl ${
                        isUser
                          ? "bg-gray-900 text-white px-4 py-3"
                          : "bg-white border border-gray-200 shadow-sm px-5 py-4"
                      }`}
                    >
                      {isUser ? (
                        <div className="text-sm whitespace-pre-wrap">{cleanContent}</div>
                      ) : (
                        <div className="text-sm prose prose-sm prose-gray max-w-none [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-2 [&>h2]:text-gray-900 [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mt-2 [&>h3]:mb-1 [&>h3]:text-gray-800 [&>p]:text-sm [&>p]:text-gray-700 [&>p]:mb-2 [&>p]:leading-relaxed [&>ul]:text-sm [&>ul]:text-gray-700 [&>ul]:mb-2 [&>ul]:space-y-1 [&>ol]:text-sm [&>ol]:text-gray-700 [&>ol]:mb-2 [&_strong]:text-gray-900 [&>hr]:my-3">
                          <ReactMarkdown>{cleanContent}</ReactMarkdown>
                        </div>
                      )}

                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                          {message.attachments.map((file) => (
                            <div key={file.id} className="flex items-center gap-2 text-xs opacity-60">
                              <FileText className="h-3 w-3" />
                              <span>{file.name}</span>
                              <span>({(file.size / 1024).toFixed(1)}KB)</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {message.clarifications && message.clarifications.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-medium">To create a better plan, could you tell me:</p>
                          {message.clarifications.map((clarification, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="text-xs">•</span>
                              <span className="text-xs">{clarification}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {message.buildFeatures && message.buildFeatures.length > 0 && isLastMessage && !generateProjectPlan.isPending && !buildChatMutation.isPending && (
                        <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Rocket className="h-4 w-4 text-indigo-600" />
                            <span className="text-xs font-semibold text-indigo-800">What's next?</span>
                          </div>
                          <p className="text-xs text-indigo-700 leading-relaxed">
                            Review the {message.buildFeatures.length} feature{message.buildFeatures.length !== 1 ? "s" : ""} in the right panel. You can <strong>refine</strong> specs, <strong>approve</strong> to create a project, or <strong>send directly to a coding agent</strong>.
                          </p>
                        </div>
                      )}

                      {message.id.startsWith("approved-") && (() => {
                        const parts = message.id.split("-");
                        const msgProjectId = parts.length >= 3 ? parseInt(parts[parts.length - 1]) : null;
                        const targetProjectId = msgProjectId && !isNaN(msgProjectId) && msgProjectId > 0 ? msgProjectId : recentlyApprovedProjectId;
                        if (!targetProjectId) return null;
                        return (
                          <div className="mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => setLocation(`/project/${targetProjectId}?openChat=1`)}
                            >
                              <ArrowRight className="h-3 w-3 mr-1" />
                              Open Project
                            </Button>
                          </div>
                        );
                      })()}

                      {message.buildFeatures && message.buildFeatures.length > 0 && (
                        <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
                          {message.buildFeatures.map((feature, fIdx) => {
                            const hasInsights = feature.insights && feature.insights.length > 0;
                            const hasReasoning = !!feature.reasoning_chain;
                            if (!hasInsights && !hasReasoning) return null;
                            const toggleKey = `${message.id}-${fIdx}`;
                            const isExpanded = expandedInsights[toggleKey] || false;
                            return (
                              <div key={fIdx} className="rounded-lg border border-amber-200 bg-amber-50/50 overflow-hidden">
                                <button
                                  onClick={() => setExpandedInsights(prev => ({ ...prev, [toggleKey]: !isExpanded }))}
                                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-amber-100/50 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <Search className="h-3.5 w-3.5 text-amber-600" />
                                    <span className="text-xs font-medium text-amber-800">
                                      Why this recommendation? — {feature.feature_title}
                                    </span>
                                  </div>
                                  {isExpanded ? (
                                    <ChevronUp className="h-3.5 w-3.5 text-amber-600" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 text-amber-600" />
                                  )}
                                </button>
                                {isExpanded && (
                                  <div className="px-3 pb-3 space-y-3">
                                    {hasInsights && feature.insights!.map((insight, iIdx) => (
                                      <div key={iIdx} className="rounded-md bg-white border border-amber-100 p-3 space-y-2">
                                        <div className="flex items-center gap-1.5">
                                          <Lightbulb className="h-3 w-3 text-amber-500" />
                                          <span className="text-xs font-semibold text-gray-800">{insight.theme}</span>
                                        </div>
                                        <div className="text-xs text-gray-700">
                                          <span className="font-medium text-gray-900">Root cause: </span>
                                          {insight.root_cause}
                                        </div>
                                        {insight.supporting_quotes && insight.supporting_quotes.length > 0 && (
                                          <div className="space-y-1.5 pl-2 border-l-2 border-amber-200">
                                            {insight.supporting_quotes.map((q, qIdx) => (
                                              <div key={qIdx} className="flex items-start gap-1.5">
                                                <Quote className="h-3 w-3 text-amber-400 flex-shrink-0 mt-0.5" />
                                                <span className="text-xs text-gray-600 italic">"{q}"</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {hasReasoning && (
                                      <div className="rounded-md bg-white border border-amber-100 p-3">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                          <Target className="h-3 w-3 text-amber-500" />
                                          <span className="text-xs font-semibold text-gray-800">Reasoning Chain</span>
                                        </div>
                                        <p className="text-xs text-gray-700 leading-relaxed">{feature.reasoning_chain}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className={`text-xs mt-2 ${isUser ? "opacity-40" : "text-gray-400"}`}>
                        {safeFormatDate(message.timestamp, "h:mm a", "")}
                      </div>
                    </div>
                  </div>

                  {showPills && (
                    <div className={`mt-3 ${isWelcome ? "ml-9" : "ml-9"}`} data-tour="prompt-pills">
                      <PromptPills
                        mode={appMode}
                        onSelect={(text) => {
                          setInput(text);
                        }}
                        isVisible={showPills}
                        variant={isWelcome ? "welcome" : "inline"}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {(generateProjectPlan.isPending || buildChatMutation.isPending) && (
              <div className="flex justify-start animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center mr-2 mt-1">
                  <Brain className="h-3.5 w-3.5 text-emerald-700" />
                </div>
                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl px-5 py-4 max-w-[85%]">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-sm text-gray-500">
                      {appMode === "build" ? "Thinking..." : "Thinking..."}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input & attachments */}
        <div className="p-4 border-t">
          <div className="space-y-0">
            <input {...getInputProps()} style={{ display: "none" }} />

            {/* Conversation & Evidence context selectors */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <ConversationSelector
                selectedIds={selectedConversationIds}
                onSelectionChange={setSelectedConversationIds}
              />

              {allEvidenceItems.length > 0 && (
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEvidencePicker(!showEvidencePicker)}
                    className={`gap-1.5 text-xs h-8 ${selectedEvidenceIds.length > 0 ? "border-violet-300 bg-violet-50 text-violet-700" : ""}`}
                  >
                    <Library className="h-3.5 w-3.5" />
                    Evidence
                    {selectedEvidenceIds.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-violet-200 text-violet-800">
                        {selectedEvidenceIds.length}
                      </Badge>
                    )}
                  </Button>
                  {showEvidencePicker && (
                    <div className="absolute bottom-full left-0 mb-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-auto">
                      <div className="p-2 border-b border-gray-100">
                        <span className="text-xs font-medium text-gray-500">Attach evidence as context</span>
                      </div>
                      <div className="p-1">
                        {allEvidenceItems.map((item) => {
                          const isSelected = selectedEvidenceIds.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setSelectedEvidenceIds((prev) =>
                                  isSelected ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                                );
                              }}
                              className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-start gap-2 hover:bg-gray-50 ${isSelected ? "bg-violet-50" : ""}`}
                            >
                              <div className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${isSelected ? "bg-violet-500 border-violet-500" : "border-gray-300"}`}>
                                {isSelected && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-gray-800 truncate">{item.title}</div>
                                <div className="text-gray-400 truncate">{item.content.slice(0, 60)}...</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="p-2 border-t border-gray-100 flex justify-end">
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowEvidencePicker(false)}>
                          Done
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Attached conversations indicator */}
            {selectedConversationIds.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">
                  {selectedConversationIds.length} meeting{selectedConversationIds.length !== 1 ? 's' : ''} attached
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedConversationIds([])}
                  className="ml-auto p-0.5 rounded hover:bg-emerald-100 transition-colors"
                  title="Remove all attached meetings"
                >
                  <X className="h-3 w-3 text-emerald-500" />
                </button>
              </div>
            )}

            {/* Attached evidence indicator */}
            {selectedEvidenceIds.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-violet-50 border border-violet-200 rounded-lg">
                <Library className="h-3.5 w-3.5 text-violet-600" />
                <span className="text-xs font-medium text-violet-700">
                  {selectedEvidenceIds.length} evidence item{selectedEvidenceIds.length !== 1 ? 's' : ''} attached
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedEvidenceIds([])}
                  className="ml-auto p-0.5 rounded hover:bg-violet-100 transition-colors"
                  title="Remove all attached evidence"
                >
                  <X className="h-3 w-3 text-violet-500" />
                </button>
              </div>
            )}

            {/* Textarea */}
            <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:border-gray-300 focus-within:ring-1 focus-within:ring-gray-200">
              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 pt-3">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 max-w-[200px] group"
                    >
                      <FileText className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="flex-shrink-0 ml-0.5 p-0.5 rounded hover:bg-gray-200 transition-colors"
                      >
                        <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div data-tour="chat-input">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(input);
                  }
                }}
                placeholder={appMode === "build" ? "Ask about your product..." : "Describe your project idea..."}
                rows={2}
                className="border-0 focus-visible:ring-0 shadow-none resize-none px-4 py-3 text-sm"
                disabled={generateProjectPlan.isPending || buildChatMutation.isPending}
              />
              </div>

              {brainContextCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 border-t border-teal-100 bg-teal-50/60 text-xs text-teal-700">
                  <Brain className="h-3 w-3" />
                  Using {brainContextCount} context insight{brainContextCount !== 1 ? "s" : ""}
                </div>
              )}

              {/* Toolbar below textarea */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-1">
                  {/* Attach button */}
                  <button
                    type="button"
                    onClick={() => open()}
                    disabled={isProcessingFiles || generateProjectPlan.isPending || buildChatMutation.isPending}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-50"
                    title="Attach files (100MB max)"
                  >
                    <Upload className="h-4 w-4" />
                  </button>

                  <div className="w-px h-4 bg-gray-200 mx-1" />

                  <button
                    type="button"
                    onClick={() => setUseContextBrain((v) => !v)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm transition-colors ${
                      useContextBrain
                        ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                        : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    }`}
                    title={useContextBrain ? "Context Brain: ON — click to disable" : "Context Brain: OFF — click to enable"}
                  >
                    <Brain className="h-4 w-4" />
                    {!useContextBrain && <span className="text-xs">Off</span>}
                  </button>

                  <div className="w-px h-4 bg-gray-200 mx-1" />

                  <div data-tour="mode-toggle">
                  <ModeToggle mode={appMode} onModeChange={(newMode) => {
                    setAppMode(newMode);
                    if (messages.length <= 1 && messages[0]?.id === "welcome") {
                      setMessages([getWelcomeMessage(newMode)]);
                    }
                  }} />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 hidden sm:inline">
                    Shift + Return for new line
                  </span>
                  <button
                    onClick={() => handleSendMessage(input)}
                    disabled={!input.trim() || generateProjectPlan.isPending || buildChatMutation.isPending}
                    className="h-8 w-8 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  >
                    {(generateProjectPlan.isPending || buildChatMutation.isPending) ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <Send className="h-3.5 w-3.5 text-white" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center mt-2">
              Requisor can make mistakes. Consider checking important information.
            </p>
          </div>
        </div>
      </Card>

      {/* Right Panel - Project Canvas or Feature Candidates */}
      <div className="flex-1 min-w-0 flex flex-col lg:w-1/2 min-h-0 overflow-hidden" data-tour="canvas-panel">
        {appMode === "build" ? (
          (() => {
            const hasBuildSession = buildSessionCandidateIds.length > 0 || showBuildHistory;
            const displayCandidates = showBuildHistory
              ? (featureCandidates as any[])
              : (featureCandidates as any[]).filter((c: any) => buildSessionCandidateIds.includes(c.id));

            if (!hasBuildSession) {
              return (
                <Card className="h-full flex items-center justify-center min-h-[400px] border-dashed">
                  <CardContent className="text-center p-6">
                    <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
                      <Lightbulb className="h-7 w-7 text-slate-300" />
                    </div>
                    <h3 className="text-base font-medium text-slate-500 mb-2">
                      Feature Candidates
                    </h3>
                    <p className="text-sm text-slate-400 max-w-xs mx-auto mb-5">
                      Discovered features will appear here as you analyze transcripts and feedback with the AI.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-slate-500 border-slate-200"
                      onClick={() => setShowBuildHistory(true)}
                    >
                      <History className="h-3 w-3 mr-1.5" />
                      View Past Discoveries
                    </Button>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card className="h-full flex flex-col min-h-[400px]">
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold">
                        {showBuildHistory ? "All Candidates" : "Session Discoveries"}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">
                        {displayCandidates.filter((c: any) => c.status !== "approved").length} pending
                      </Badge>
                      {displayCandidates.length > 1 && (
                        <Button
                          variant={batchSelectionMode ? "default" : "outline"}
                          size="sm"
                          className={`h-7 text-xs gap-1.5 ${batchSelectionMode ? "bg-indigo-500 hover:bg-indigo-600 text-white" : "text-indigo-600 border-indigo-200 hover:bg-indigo-50"}`}
                          onClick={() => {
                            setBatchSelectionMode(!batchSelectionMode);
                            if (batchSelectionMode) setSelectedCandidateIds([]);
                          }}
                        >
                          <Code2 className="h-3 w-3" />
                          {batchSelectionMode ? "Cancel" : "Batch Send"}
                        </Button>
                      )}
                      {displayCandidates.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                          onClick={() => setShowExportReport(true)}
                        >
                          <FileText className="h-3 w-3" />
                          Export
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-400">
                      {showBuildHistory ? "Showing all past discoveries" : "Features found this session"}
                    </p>
                    {showBuildHistory ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-slate-400 hover:text-slate-600"
                        onClick={() => setShowBuildHistory(false)}
                      >
                        <X className="h-3 w-3 mr-0.5" />
                        Close
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-slate-400 hover:text-slate-600"
                        onClick={() => setShowBuildHistory(true)}
                      >
                        <History className="h-3 w-3 mr-0.5" />
                        History
                      </Button>
                    )}
                  </div>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-4 space-y-3">
                    {displayCandidates.length > 0 && (
                      <PriorityMatrix candidates={displayCandidates} />
                    )}
                    {displayCandidates.length === 0 ? (
                      <div className="text-center py-12">
                        <Lightbulb className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                        <h4 className="text-sm font-medium text-gray-500 mb-1">
                          {showBuildHistory ? "No features discovered yet" : "No features found this session"}
                        </h4>
                        <p className="text-xs text-gray-400 max-w-xs mx-auto">
                          Ask the AI to analyze your product, user feedback, or meeting notes to discover feature opportunities.
                        </p>
                      </div>
                    ) : (
                      <>
                        {batchSelectionMode && selectedCandidateIds.length > 0 && (
                          <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-lg mb-2">
                            <span className="text-sm font-medium text-indigo-700">
                              {selectedCandidateIds.length} feature{selectedCandidateIds.length !== 1 ? "s" : ""} selected
                            </span>
                            <Button
                              size="sm"
                              onClick={() => setShowBatchAgentDialog(true)}
                              className="bg-indigo-500 hover:bg-indigo-600 text-white h-7 text-xs"
                            >
                              <Code2 className="h-3 w-3 mr-1" />
                              Send to Agent
                            </Button>
                          </div>
                        )}
                        {displayCandidates.map((candidate: any) => (
                          <FeatureCandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            onApprove={(id) => approveFeatureMutation.mutate(id)}
                            onDelete={(id) => deleteFeatureMutation.mutate(id)}
                            isApproving={approveFeatureMutation.isPending}
                            projectName={currentPlan?.name || "My Project"}
                            projectDescription={currentPlan?.description}
                            selectable={batchSelectionMode && candidate.status === "approved"}
                            selected={selectedCandidateIds.includes(candidate.id)}
                            onSelectionChange={(id, checked) => {
                              setSelectedCandidateIds((prev) =>
                                checked ? [...prev, id] : prev.filter((cid) => cid !== id)
                              );
                            }}
                          />
                        ))}
                      </>
                    )}
                  </div>
                </ScrollArea>
                <ExportReport
                  candidates={displayCandidates}
                  open={showExportReport}
                  onOpenChange={setShowExportReport}
                />
                {showBatchAgentDialog && selectedCandidateIds.length > 0 && (() => {
                  const batchCandidates = displayCandidates.filter((c: any) =>
                    selectedCandidateIds.includes(c.id)
                  );
                  return (
                    <SendToAgentDialog
                      open={showBatchAgentDialog}
                      onOpenChange={(open) => {
                        setShowBatchAgentDialog(open);
                        if (!open) {
                          setBatchSelectionMode(false);
                          setSelectedCandidateIds([]);
                        }
                      }}
                      candidate={batchCandidates[0]}
                      candidates={batchCandidates}
                      isBatch={true}
                      projectName={currentPlan?.name || "My Project"}
                      projectDescription={currentPlan?.description}
                    />
                  );
                })()}
              </Card>
            );
          })()
        ) : currentPlan ? (
          <ProjectPlannerCanvasV2
            projectPlan={currentPlan}
            onSave={handleSaveProject}
            onUpdate={setCurrentPlan}
          />
        ) : (
          <Card className="h-full flex items-center justify-center min-h-[400px]">
            <CardContent className="text-center p-6 lg:p-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Project Canvas
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                Your AI-generated project plan will appear here. Start by
                describing your project or uploading requirement documents.
              </p>
              <div className="mt-4 text-xs text-gray-400">
                Current plan state: {currentPlan ? "Available" : "None"}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Custom Save Project Dialog */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Project</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a name for your project to save it to your projects list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={projectNameInput}
              onChange={(e) => setProjectNameInput(e.target.value)}
              placeholder="Project name..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && projectNameInput.trim()) {
                  handleConfirmSave();
                }
              }}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowSaveDialog(false);
                setProjectToSave(null);
                setProjectNameInput("");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSave}
              disabled={!projectNameInput.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Save Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {postApprovalCandidate && (
        <SendToAgentDialog
          open={postApprovalAgentDialogOpen}
          onOpenChange={(open) => {
            setPostApprovalAgentDialogOpen(open);
            if (!open) {
              setPostApprovalCandidate(null);
            }
          }}
          candidate={postApprovalCandidate}
          projectName={currentPlan?.name || postApprovalCandidate?.featureTitle || "My Project"}
          projectDescription={currentPlan?.description || postApprovalCandidate?.whyNow}
        />
      )}
    </div>
  );
}
