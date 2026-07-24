import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  Sparkles,
  FileText,
  Code,
  Download,
  Copy,
  Loader2,
  CheckCircle,
  AlertCircle,
  Layers,
  Target,
  Calendar,
  Users,
  Database,
  Shield,
  Package,
  GitBranch,
  TestTube,
  Server,
  Send,
  Settings,
  MessageSquare,
  Lightbulb,
  Zap,
  Building,
  Store,
  Heart,
  GraduationCap,
  Bot,
  Globe,
  Gamepad2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProjectPlannerCanvasV2 } from "@/components/project-planner/ProjectPlannerCanvasV2";
import { format } from "date-fns";

// Canvas-compatible interfaces
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

interface CanvasProjectPlan {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  milestones: Milestone[];
}

interface ProjectPlan {
  canvasPlan: CanvasProjectPlan;
  overview: string;
  modules: string[];
  techStack: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    devops?: string[];
  };
  qaStrategy: string;
  apiRequirements: string[];
  databaseSchema: string;
  timeline: {
    phase: string;
    duration: string;
    deliverables: string[];
  }[];
  roles: {
    role: string;
    responsibilities: string[];
  }[];
  risks: string[];
  deliverables: string[];
  rawMarkdown: string;
  metadata: {
    domain: string;
    outputType: string;
    depth: string;
    confidence: number;
    suggestions?: string[];
  };
}

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  projectPlan?: ProjectPlan;
}

// Domain icons mapping
const domainIcons: Record<string, any> = {
  "e-commerce": Store,
  fintech: Building,
  healthcare: Heart,
  education: GraduationCap,
  saas: Zap,
  social: MessageSquare,
  "ai-ml": Bot,
  general: Globe,
  gaming: Gamepad2,
};

// Quick prompt templates
const promptTemplates = [
  {
    category: "Web Development",
    prompts: [
      "Build a modern e-commerce platform with React and Node.js",
      "Create a SaaS dashboard for analytics with real-time updates",
      "Develop a social media app with video sharing capabilities",
    ],
  },
  {
    category: "Mobile Apps",
    prompts: [
      "Create a fitness tracking app with AI coaching",
      "Build a food delivery app like UberEats",
      "Develop a language learning app with gamification",
    ],
  },
  {
    category: "Enterprise",
    prompts: [
      "Build an ERP system for manufacturing companies",
      "Create a CRM platform for sales teams",
      "Develop an HR management system with payroll",
    ],
  },
  {
    category: "AI/ML Projects",
    prompts: [
      "Build a computer vision system for quality control",
      "Create an NLP chatbot for customer support",
      "Develop a recommendation engine for e-commerce",
    ],
  },
];

export default function AIProjectPlanner() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      content:
        "Hi! I'm your AI Project Planner with enhanced contextual understanding. I can analyze any project idea across various domains and generate comprehensive, actionable project plans. Just describe your project idea, and I'll create a detailed plan with milestones, tasks, and technical recommendations!",
      role: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [outputFormat, setOutputFormat] = useState<
    "structured" | "markdown" | "json"
  >("structured");
  const [depth, setDepth] = useState<"basic" | "detailed" | "comprehensive">(
    "detailed",
  );
  const [currentPlan, setCurrentPlan] = useState<ProjectPlan | null>(null);
  const [activeView, setActiveView] = useState<"chat" | "canvas" | "details">(
    "chat",
  );
  const [showSettings, setShowSettings] = useState(false);
  const [contextInfo, setContextInfo] = useState({
    industry: "",
    teamSize: "",
    budget: "",
    timeline: "",
    techPreferences: [] as string[],
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Generate project plan mutation
  const generatePlanMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await apiRequest("/api/agent/generate-plan", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          outputFormat,
          depth,
          contextInfo:
            contextInfo.industry || contextInfo.teamSize || contextInfo.budget
              ? contextInfo
              : undefined,
        }),
      });
      return response;
    },
    onSuccess: (data) => {
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        content: generatePlanSummary(data.plan),
        role: "assistant",
        timestamp: new Date(),
        projectPlan: data.plan,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setCurrentPlan(data.plan);

      // Auto-switch to canvas view if plan generated
      if (data.plan?.canvasPlan) {
        setActiveView("canvas");
      }

      toast({
        title: "Project Plan Generated!",
        description: "Your AI-powered project plan is ready",
      });
    },
    onError: (error: any) => {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        content: `I encountered an error generating the project plan: ${error.message || "Unknown error"}. Please try again.`,
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);

      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate project plan",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!input.trim() || generatePlanMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content: input,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Generate plan
    generatePlanMutation.mutate(input);
  };

  const handleTemplateClick = (template: string) => {
    setInput(template);
  };

  const generatePlanSummary = (plan: ProjectPlan): string => {
    const domain = domainIcons[plan.metadata.domain]
      ? plan.metadata.domain
      : "general";
    const confidence = Math.round((plan.metadata.confidence || 0.7) * 100);

    let summary = `I've generated a comprehensive project plan for "${plan.canvasPlan.name}".\n\n`;
    summary += `**Domain:** ${domain.charAt(0).toUpperCase() + domain.slice(1)}\n`;
    summary += `**Confidence:** ${confidence}%\n`;
    summary += `**Timeline:** ${plan.canvasPlan.startDate} to ${plan.canvasPlan.endDate}\n`;
    summary += `**Milestones:** ${plan.canvasPlan.milestones.length}\n`;
    summary += `**Total Tasks:** ${plan.canvasPlan.milestones.reduce((acc, m) => acc + m.tasks.length, 0)}\n\n`;

    if (plan.metadata.suggestions?.length) {
      summary += `**Suggestions for improvement:**\n`;
      plan.metadata.suggestions.forEach((suggestion) => {
        summary += `- ${suggestion}\n`;
      });
    }

    summary += `\nSwitch to the **Canvas** tab to see the visual project plan, or check the **Details** tab for comprehensive information.`;

    return summary;
  };

  // Save project mutation
  const saveProjectMutation = useMutation({
    mutationFn: async (plan: CanvasProjectPlan) => {
      // Transform the canvas plan to match the API format
      const projectData = {
        plan: {
          name: plan.name,
          description: plan.description,
          timeline: {
            startDate: plan.startDate,
            endDate: plan.endDate,
          },
          milestones: plan.milestones.map((m) => ({
            name: m.name,
            description: m.description,
            dueDate: m.dueDate,
          })),
          tasks: plan.milestones.flatMap((m) =>
            m.tasks.map((t) => ({
              name: t.name,
              description: t.description,
              dueDate: t.dueDate,
              priority: t.priority,
            })),
          ),
        },
      };

      const response = await apiRequest("/api/projects/from-plan", {
        method: "POST",
        body: JSON.stringify(projectData),
      });
      return response;
    },
    onSuccess: (data) => {
      console.log("Save mutation onSuccess called with data:", data);

      toast({
        title: "Project Saved Successfully!",
        description: `"${currentPlan?.canvasPlan.name}" has been saved to your projects`,
      });

      // Navigate to the project details page FIRST before clearing state
      if (data && data.project && data.project.id) {
        console.log("Navigating to project:", data.project.id);
        setTimeout(() => {
          setLocation(`/project/${data.project.id}`);
        }, 100); // Small delay to ensure toast is shown
      } else {
        console.log("No project ID found in response:", data);
      }

      // Clear the project canvas
      setCurrentPlan(null);
      setActiveView("chat");

      // Add a message to chat
      const successMessage: ChatMessage = {
        id: `success-${Date.now()}`,
        content: `Great! I've successfully saved "${data.project?.name || "your project"}" to your projects. You will be redirected to the project page momentarily.`,
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, successMessage]);

      // Invalidate queries to refresh the project list if needed
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: any) => {
      console.log("Save project mutation error:", error);
      toast({
        title: "Failed to Save Project",
        description:
          error.message || "An error occurred while saving the project",
        variant: "destructive",
      });
    },
  });

  const handleCanvasSave = (updatedPlan: CanvasProjectPlan) => {
    console.log("handleCanvasSave called", updatedPlan);
    if (currentPlan) {
      console.log("Current plan exists, calling mutation");
      // Save to database
      saveProjectMutation.mutate(updatedPlan);
    } else {
      console.log("No current plan available");
    }
  };

  const handleCanvasUpdate = (updatedPlan: CanvasProjectPlan) => {
    if (currentPlan) {
      setCurrentPlan({
        ...currentPlan,
        canvasPlan: updatedPlan,
      });
    }
  };

  const handleExportPlan = (format: "json" | "markdown") => {
    if (!currentPlan) return;

    const content =
      format === "json"
        ? JSON.stringify(currentPlan, null, 2)
        : currentPlan.rawMarkdown;

    const blob = new Blob([content], {
      type: format === "json" ? "application/json" : "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-plan-${new Date().toISOString().split("T")[0]}.${format}`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Plan Exported",
      description: `Project plan exported as ${format.toUpperCase()}`,
    });
  };

  const renderTechStackBadges = (category: string, items?: string[]) => {
    if (!items || items.length === 0) return null;

    return (
      <div className="mb-4">
        <h5 className="text-sm font-medium text-gray-700 mb-2 capitalize">
          {category}
        </h5>
        <div className="flex flex-wrap gap-2">
          {items.map((tech, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {tech}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Modern Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
              {/* <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Requisor AI Project Planner
                </h1>
                <p className="text-sm text-gray-500">
                  Transform your ideas into structured project plans with AI
                  assistance
                </p>
              </div> */}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="secondary" className="px-3 py-1">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Session Active
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              <Sparkles className="h-3 w-3 mr-1" />
              Persistent
            </Badge>
            <Button variant="ghost" size="sm">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat History
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const data = JSON.stringify(messages, null, 2);
                const blob = new Blob([data], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "project-plan.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <Tabs
            value={activeView}
            onValueChange={(v: any) => setActiveView(v)}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Tab Navigation */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger
                  value="chat"
                  className="flex items-center space-x-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Chat</span>
                </TabsTrigger>
                <TabsTrigger
                  value="canvas"
                  className="flex items-center space-x-2"
                  disabled={!currentPlan}
                >
                  <Target className="h-4 w-4" />
                  <span>Canvas</span>
                </TabsTrigger>
                <TabsTrigger
                  value="details"
                  className="flex items-center space-x-2"
                  disabled={!currentPlan}
                >
                  <FileText className="h-4 w-4" />
                  <span>Details</span>
                </TabsTrigger>
              </TabsList>
            </div>
            {/* Chat Tab */}
            <TabsContent value="chat" className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 flex flex-col min-h-0">
                {/* Agent Info Bar */}
                <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <Bot className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          AI Project Planner
                        </h3>
                        <p className="text-sm text-gray-500">
                          Enterprise-grade document analysis for client
                          requirements up to 100MB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 min-h-0 bg-gray-50">
                  <ScrollArea className="h-full">
                    <div className="max-w-4xl mx-auto py-6 px-6">
                      <div className="space-y-6">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className="flex items-start space-x-4"
                          >
                            <div className="flex-shrink-0">
                              {message.role === "user" ? (
                                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                                  <span className="text-white text-sm font-medium">
                                    U
                                  </span>
                                </div>
                              ) : (
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                  <Bot className="h-4 w-4 text-purple-600" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                                <div className="prose prose-sm max-w-none text-gray-900">
                                  <ReactMarkdown>
                                    {message.content}
                                  </ReactMarkdown>
                                </div>
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                                  <div className="text-xs text-gray-500">
                                    {format(message.timestamp, "h:mm a")}
                                  </div>
                                  {message.role === "assistant" && (
                                    <div className="flex items-center space-x-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    </div>
                  </ScrollArea>
                </div>

                {/* Quick Templates */}
                {messages.length === 1 && (
                  <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
                    <div className="max-w-4xl mx-auto">
                      <p className="text-sm font-medium text-gray-700 mb-3">
                        Quick Start Templates:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {promptTemplates.slice(0, 2).map((category) => (
                          <div
                            key={category.category}
                            className="p-3 border border-gray-200 rounded-lg"
                          >
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              {category.category}
                            </p>
                            <div className="space-y-2">
                              {category.prompts
                                .slice(0, 2)
                                .map((prompt, idx) => (
                                  <Button
                                    key={idx}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTemplateClick(prompt)}
                                    className="w-full text-left justify-start h-auto p-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                  >
                                    {prompt.length > 80
                                      ? `${prompt.substring(0, 80)}...`
                                      : prompt}
                                  </Button>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Input Area */}
                <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
                  <div className="max-w-4xl mx-auto">
                    <div className="flex items-end space-x-3">
                      <div className="flex-1">
                        <Textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          placeholder="Create enterprise implementation plan"
                          rows={2}
                          className="resize-none border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        />
                      </div>
                      <Button
                        onClick={handleSendMessage}
                        disabled={
                          !input.trim() || generatePlanMutation.isPending
                        }
                        className="bg-purple-600 hover:bg-purple-700 px-6"
                      >
                        {generatePlanMutation.isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </Button>
                    </div>

                    {/* Generation Settings */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-600">Depth:</span>
                          <Select
                            value={depth}
                            onValueChange={(v: any) => setDepth(v)}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="basic">Basic</SelectItem>
                              <SelectItem value="detailed">Detailed</SelectItem>
                              <SelectItem value="comprehensive">
                                Comprehensive
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {currentPlan && (
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportPlan("markdown")}
                            className="text-xs"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Export MD
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportPlan("json")}
                            className="text-xs"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Export JSON
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Canvas Tab */}
            {currentPlan && (
              <TabsContent
                value="canvas"
                className="flex-1 flex flex-col p-4 h-full"
              >
                <div className="flex-1 min-h-0 overflow-auto">
                  <ProjectPlannerCanvasV2
                    projectPlan={currentPlan.canvasPlan}
                    onSave={handleCanvasSave}
                    onUpdate={handleCanvasUpdate}
                  />
                </div>
              </TabsContent>
            )}

            {/* Details Tab */}
            {currentPlan && (
              <TabsContent value="details" className="flex-1 p-4 overflow-auto">
                <Card>
                  <CardContent className="p-6 space-y-8">
                    {/* Confidence Score & Suggestions */}
                    {currentPlan.metadata.confidence && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Lightbulb className="h-5 w-5 mr-2" />
                          AI Analysis
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-600 mb-2">
                              Confidence Score
                            </p>
                            <div className="flex items-center space-x-3">
                              <Progress
                                value={currentPlan.metadata.confidence * 100}
                                className="flex-1"
                              />
                              <span className="text-sm font-medium">
                                {Math.round(
                                  currentPlan.metadata.confidence * 100,
                                )}
                                %
                              </span>
                            </div>
                          </div>

                          {(currentPlan.metadata.suggestions?.length || 0) >
                            0 && (
                            <Alert>
                              <Lightbulb className="h-4 w-4" />
                              <AlertTitle>
                                Suggestions for Improvement
                              </AlertTitle>
                              <AlertDescription>
                                <ul className="list-disc list-inside space-y-1 mt-2">
                                  {(currentPlan.metadata.suggestions || []).map(
                                    (suggestion, idx) => (
                                      <li key={idx} className="text-sm">
                                        {suggestion}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tech Stack */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <Layers className="h-5 w-5 mr-2" />
                        Technology Stack
                      </h3>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        {renderTechStackBadges(
                          "Frontend",
                          currentPlan.techStack.frontend,
                        )}
                        {renderTechStackBadges(
                          "Backend",
                          currentPlan.techStack.backend,
                        )}
                        {renderTechStackBadges(
                          "Database",
                          currentPlan.techStack.database,
                        )}
                        {renderTechStackBadges(
                          "DevOps",
                          currentPlan.techStack.devops,
                        )}
                      </div>
                    </div>

                    {/* API Requirements */}
                    {currentPlan.apiRequirements?.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Server className="h-5 w-5 mr-2" />
                          API Requirements
                        </h3>
                        <div className="space-y-2">
                          {currentPlan.apiRequirements.map((api, idx) => (
                            <div
                              key={idx}
                              className="flex items-start space-x-2 bg-gray-50 p-3 rounded-lg"
                            >
                              <Code className="h-4 w-4 text-purple-600 mt-0.5" />
                              <span className="text-sm">{api}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Database Schema */}
                    {currentPlan.databaseSchema && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Database className="h-5 w-5 mr-2" />
                          Database Schema
                        </h3>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <pre className="text-sm whitespace-pre-wrap">
                            {currentPlan.databaseSchema}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* QA Strategy */}
                    {currentPlan.qaStrategy && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <TestTube className="h-5 w-5 mr-2" />
                          QA Strategy
                        </h3>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm">{currentPlan.qaStrategy}</p>
                        </div>
                      </div>
                    )}

                    {/* Risks */}
                    {currentPlan.risks?.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Shield className="h-5 w-5 mr-2" />
                          Risk Assessment
                        </h3>
                        <div className="space-y-2">
                          {currentPlan.risks.map((risk, idx) => (
                            <div
                              key={idx}
                              className="flex items-start space-x-2 bg-yellow-50 p-3 rounded-lg"
                            >
                              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                              <span className="text-sm">{risk}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Team Roles */}
                    {currentPlan.roles?.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Users className="h-5 w-5 mr-2" />
                          Team Structure
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {currentPlan.roles.map((role, idx) => (
                            <div
                              key={idx}
                              className="bg-gray-50 p-4 rounded-lg"
                            >
                              <h4 className="font-medium mb-2">{role.role}</h4>
                              <ul className="text-sm text-gray-600 space-y-1">
                                {role.responsibilities.map((resp, rIdx) => (
                                  <li key={rIdx} className="flex items-start">
                                    <span className="mr-2">•</span>
                                    <span>{resp}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
