import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  Send,
  Loader2,
  Plus,
  Save,
  Download,
  RefreshCw,
  CheckCircle,
  Rocket,
  Target,
  FileText,
  AlertCircle,
  ChevronRight,
  Edit,
  Trash2,
  GitBranch,
  Sparkles,
  Upload,
  Settings,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { JiraIntegrationSettings } from "@/components/agile-planning/JiraIntegrationSettings";
import { JiraExportModal } from "@/components/agile-planning/JiraExportModal";

interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  storyPoints?: number;
  priority: "high" | "medium" | "low";
  epicId: string;
}

interface Epic {
  id: string;
  name: string;
  description: string;
  stories: UserStory[];
}

interface Initiative {
  id: string;
  name: string;
  description: string;
  epics: Epic[];
}

interface AgilePlan {
  initiative: Initiative;
  createdAt: Date;
}

export default function AgilePlanningPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [currentPlan, setCurrentPlan] = useState<AgilePlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested prompts
  const suggestedPrompts = [
    "Build a notification system with Slack and email channels",
    "Create a customer feedback portal with ratings and reviews",
    "Design an analytics dashboard for tracking user engagement",
    "Implement a payment processing system with subscription support",
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch existing projects for the save functionality
  const { data: projects } = useQuery({
    queryKey: ["/api/projects"],
    enabled: !!user,
  });

  // Generate agile plan mutation
  const generatePlanMutation = useMutation({
    mutationFn: async ({
      prompt,
      currentPlan,
      isRegeneration,
    }: {
      prompt: string;
      currentPlan?: AgilePlan | null;
      isRegeneration?: boolean;
    }) => {
      const response = await fetch("/api/agile-planning/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          currentPlan: currentPlan || undefined,
          isRegeneration: isRegeneration || false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.error === "MISSING_API_KEY") {
          throw new Error(error.message);
        }
        throw new Error(error.message || "Failed to generate plan");
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log(
        "Generated plan data from API:",
        JSON.stringify(data, null, 2),
      );

      console.log("Generated plan response:", data);

      // The API should return { initiative: { ... }, createdAt: Date }
      if (data && data.initiative && data.initiative.epics) {
        setCurrentPlan(data);
        const epicCount = data.initiative.epics.length;
        const storyCount = data.initiative.epics.reduce(
          (sum: number, epic: Epic) => sum + epic.stories.length,
          0,
        );
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `I've created an agile plan for "${data.initiative.name}" with ${epicCount} epics and ${storyCount} user stories.`,
          },
        ]);
        console.log("Plan set successfully with", epicCount, "epics");
      } else {
        console.error("Invalid plan data structure:", data);
        console.error("Missing properties:", {
          hasData: !!data,
          hasInitiative: !!data?.initiative,
          hasEpics: !!data?.initiative?.epics,
          epicsIsArray: Array.isArray(data?.initiative?.epics),
        });
        toast({
          title: "Error",
          description:
            "The generated plan has an invalid structure. Please try again.",
          variant: "destructive",
        });
        // Set a fallback empty plan
        setCurrentPlan(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description:
          error.message || "Failed to generate agile plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Save to Requisor project mutation
  const saveToProjectMutation = useMutation({
    mutationFn: async (plan: AgilePlan) => {
      const response = await fetch("/api/agile-planning/save-to-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!response.ok) {
        throw new Error("Failed to save to project");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Agile plan saved as a Requisor project!",
      });
      setTimeout(() => {
        setLocation(`/projects/${data.projectId}`);
      }, 1000);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save to project. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Export to Jira mutation
  const exportToJiraMutation = useMutation({
    mutationFn: async (plan: AgilePlan) => {
      const response = await fetch("/api/agile-planning/export-jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!response.ok) {
        throw new Error("Failed to export to Jira");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Download the JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agile-plan-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Agile plan exported for Jira import!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to export to Jira. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsGenerating(true);

    try {
      // Check if user is asking to regenerate or refine the existing plan
      const regenerationKeywords = [
        "regenerate",
        "generate again",
        "redo",
        "remake",
        "recreate",
        "not like this",
        "try again",
        "different version",
        "improve",
        "enhance",
        "refine",
        "more detail",
        "better",
        "change",
      ];

      const isRegeneration =
        currentPlan &&
        regenerationKeywords.some((keyword) =>
          userMessage.toLowerCase().includes(keyword),
        );

      await generatePlanMutation.mutateAsync({
        prompt: userMessage,
        currentPlan: isRegeneration ? currentPlan : undefined,
        isRegeneration: !!isRegeneration,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    setChatInput(prompt);
  };

  const handleEditStory = (storyId: string, updates: Partial<UserStory>) => {
    if (!currentPlan) return;

    const updatedPlan = {
      ...currentPlan,
      initiative: {
        ...currentPlan.initiative,
        epics: currentPlan.initiative.epics.map((epic) => ({
          ...epic,
          stories: epic.stories.map((story) =>
            story.id === storyId ? { ...story, ...updates } : story,
          ),
        })),
      },
    };

    setCurrentPlan(updatedPlan);
    setEditingStoryId(null);
  };

  const handleDeleteStory = (epicId: string, storyId: string) => {
    if (!currentPlan) return;

    const updatedPlan = {
      ...currentPlan,
      initiative: {
        ...currentPlan.initiative,
        epics: currentPlan.initiative.epics.map((epic) =>
          epic.id === epicId
            ? {
                ...epic,
                stories: epic.stories.filter((story) => story.id !== storyId),
              }
            : epic,
        ),
      },
    };

    setCurrentPlan(updatedPlan);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600 bg-red-100";
      case "medium":
        return "text-yellow-600 bg-yellow-100";
      case "low":
        return "text-green-600 bg-green-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Authentication Required
              </h2>
              <p className="text-gray-600 mb-4">
                Please log in to use the Agile Planning Agent.
              </p>
              <Button onClick={() => (window.location.href = "/api/login")}>
                Log In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Rocket className="h-8 w-8 text-violet-500" />
          Agile Planning Agent
        </h1>
        <p className="text-gray-600">
          Transform your ideas into structured agile plans with initiatives,
          epics, and user stories
        </p>
      </div>

      <Tabs defaultValue="planning" className="space-y-6">
        <TabsList>
          <TabsTrigger value="planning" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Planning Assistant
          </TabsTrigger>
          {/* <TabsTrigger value="existing-projects" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Export Existing Projects
          </TabsTrigger> */}
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planning">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chat Interface */}
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-500" />
                  Planning Assistant
                </CardTitle>
                <CardDescription>
                  Tell me what you want to build, and I'll create a structured
                  agile plan
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Messages */}
                <div className="flex-1 mb-4 overflow-hidden">
                  <ScrollArea className="h-full pr-4 chat-scroll-area">
                    <div className="space-y-4">
                      {messages.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-gray-500 mb-4">
                            Start by describing your project idea...
                          </p>
                          <div className="grid grid-cols-1 gap-2">
                            {suggestedPrompts.map((prompt, index) => (
                              <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                className="text-left justify-start text-xs"
                                onClick={() => handlePromptClick(prompt)}
                              >
                                <ChevronRight className="h-3 w-3 mr-1" />
                                {prompt}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        messages.map((message, index) => (
                          <div
                            key={index}
                            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-lg px-4 py-2 break-words overflow-wrap-anywhere ${
                                message.role === "user"
                                  ? "bg-violet-500 text-white"
                                  : "bg-gray-100 text-gray-900"
                              }`}
                            >
                              <div className="whitespace-pre-wrap chat-message">
                                {message.content}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      {isGenerating && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 rounded-lg px-4 py-2 flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-gray-600">
                              Generating agile plan...
                            </span>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Describe what you want to build..."
                    disabled={isGenerating}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={isGenerating || !chatInput.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Plan Display */}
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-violet-500" />
                      Agile Plan
                    </CardTitle>
                    <CardDescription>
                      Review and edit your generated plan
                    </CardDescription>
                  </div>
                  {currentPlan && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!user) {
                            toast({
                              title: "Authentication Required",
                              description:
                                "Please log in to save projects to Requisor.",
                              variant: "destructive",
                            });
                            window.location.href = "/api/login";
                            return;
                          }
                          saveToProjectMutation.mutate(currentPlan);
                        }}
                        disabled={saveToProjectMutation.isPending}
                      >
                        {saveToProjectMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Save className="h-4 w-4 mr-1" />
                        )}
                        Save to Project
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          console.log(
                            "Export button clicked - currentPlan:",
                            currentPlan,
                          );
                          console.log(
                            "Export button - epics count:",
                            currentPlan?.initiative?.epics?.length || 0,
                          );
                          console.log(
                            "Export button - user authenticated:",
                            !!user,
                          );

                          if (!user) {
                            toast({
                              title: "Authentication Required",
                              description:
                                "Please log in to export to Jira. You'll be redirected to login.",
                              variant: "destructive",
                            });
                            window.location.href = "/api/login";
                            return;
                          }

                          setShowExportModal(true);
                        }}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Export to Jira
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                {currentPlan ? (
                  <ScrollArea className="h-full pr-4">
                    <div className="space-y-6">
                      {/* Initiative */}
                      <div className="bg-violet-50 rounded-lg p-4">
                        <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                          <Rocket className="h-5 w-5 text-violet-600" />
                          Initiative: {currentPlan.initiative.name}
                        </h3>
                        <p className="text-gray-600">
                          {currentPlan.initiative.description}
                        </p>
                      </div>

                      {/* Epics and Stories */}
                      <div className="space-y-4">
                        {currentPlan.initiative.epics.map((epic) => (
                          <Collapsible key={epic.id} defaultOpen>
                            <CollapsibleTrigger className="w-full">
                              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between hover:bg-gray-100 transition-colors">
                                <div className="flex items-center gap-2">
                                  <GitBranch className="h-4 w-4 text-gray-600" />
                                  <h4 className="font-medium">{epic.name}</h4>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {epic.stories.length} stories
                                  </Badge>
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                              <div className="pl-6 space-y-2">
                                <p className="text-sm text-gray-600 mb-3">
                                  {epic.description}
                                </p>
                                {epic.stories.map((story) => (
                                  <div
                                    key={story.id}
                                    className="bg-white rounded-lg border p-3 space-y-2"
                                  >
                                    {editingStoryId === story.id ? (
                                      // Edit mode
                                      <div className="space-y-2">
                                        <Input
                                          value={story.title}
                                          onChange={(e) =>
                                            handleEditStory(story.id, {
                                              title: e.target.value,
                                            })
                                          }
                                          className="font-medium"
                                        />
                                        <Textarea
                                          value={story.description}
                                          onChange={(e) =>
                                            handleEditStory(story.id, {
                                              description: e.target.value,
                                            })
                                          }
                                          rows={3}
                                        />
                                        <div className="flex gap-2">
                                          <Select
                                            value={story.priority}
                                            onValueChange={(
                                              value: "high" | "medium" | "low",
                                            ) =>
                                              handleEditStory(story.id, {
                                                priority: value,
                                              })
                                            }
                                          >
                                            <SelectTrigger className="w-32">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="high">
                                                High
                                              </SelectItem>
                                              <SelectItem value="medium">
                                                Medium
                                              </SelectItem>
                                              <SelectItem value="low">
                                                Low
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                          <Input
                                            type="number"
                                            value={story.storyPoints || ""}
                                            onChange={(e) =>
                                              handleEditStory(story.id, {
                                                storyPoints:
                                                  parseInt(e.target.value) ||
                                                  undefined,
                                              })
                                            }
                                            placeholder="Points"
                                            className="w-20"
                                          />
                                          <Button
                                            size="sm"
                                            onClick={() =>
                                              setEditingStoryId(null)
                                            }
                                          >
                                            <CheckCircle className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      // View mode
                                      <>
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1">
                                            <h5 className="font-medium text-sm">
                                              {story.title}
                                            </h5>
                                            <p className="text-sm text-gray-600 mt-1">
                                              {story.description}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2 ml-4">
                                            <Badge
                                              className={`text-xs ${getPriorityColor(story.priority)}`}
                                            >
                                              {story.priority}
                                            </Badge>
                                            {story.storyPoints && (
                                              <Badge
                                                variant="outline"
                                                className="text-xs"
                                              >
                                                {story.storyPoints} pts
                                              </Badge>
                                            )}
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() =>
                                                setEditingStoryId(story.id)
                                              }
                                            >
                                              <Edit className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() =>
                                                handleDeleteStory(
                                                  epic.id,
                                                  story.id,
                                                )
                                              }
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                        {story.acceptanceCriteria.length >
                                          0 && (
                                          <div className="mt-2">
                                            <p className="text-xs font-medium text-gray-500 mb-1">
                                              Acceptance Criteria:
                                            </p>
                                            <ul className="text-xs text-gray-600 space-y-0.5">
                                              {story.acceptanceCriteria.map(
                                                (criteria, index) => (
                                                  <li
                                                    key={index}
                                                    className="flex items-start"
                                                  >
                                                    <CheckCircle className="h-3 w-3 text-green-500 mr-1 mt-0.5 flex-shrink-0" />
                                                    {criteria}
                                                  </li>
                                                ),
                                              )}
                                            </ul>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No plan generated yet</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Start by describing your project in the chat
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="existing-projects">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-violet-500" />
                Export Existing Projects to JIRA
              </CardTitle>
              <CardDescription>
                Select an existing Requisor project to export to JIRA. Projects
                created from agile planning are displayed first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Project List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects && projects.length > 0 ? (
                    // Sort projects: agile-planning source first
                    [...projects]
                      .sort((a, b) => {
                        if (
                          a.source === "agile-planning" &&
                          b.source !== "agile-planning"
                        )
                          return -1;
                        if (
                          a.source !== "agile-planning" &&
                          b.source === "agile-planning"
                        )
                          return 1;
                        return 0;
                      })
                      .map((project: any) => (
                        <Card
                          key={project.id}
                          className="cursor-pointer hover:border-violet-500 transition-colors"
                          onClick={async () => {
                            // Load project and convert to agile plan format
                            const projectTasks = await fetch(
                              `/api/projects/${project.id}/tasks`,
                            ).then((r) => r.json());

                            // Convert tasks to agile plan format
                            const epics: any[] = [];
                            const epicMap = new Map<string, any>();

                            // Group tasks by epic (using a simple heuristic or task name)
                            projectTasks.forEach((task: any) => {
                              const epicName = task.category || "General";

                              if (!epicMap.has(epicName)) {
                                epicMap.set(epicName, {
                                  id: `epic-${epicMap.size + 1}`,
                                  name: epicName,
                                  description: `Tasks related to ${epicName}`,
                                  stories: [],
                                });
                              }

                              epicMap.get(epicName).stories.push({
                                id: `story-${task.id}`,
                                title: task.name,
                                description: task.description || "",
                                acceptanceCriteria: [],
                                storyPoints: task.storyPoints || undefined,
                                priority: task.priority || "medium",
                                epicId: epicMap.get(epicName).id,
                              });
                            });

                            epicMap.forEach((epic) => epics.push(epic));

                            // Create agile plan format
                            const plan: AgilePlan = {
                              initiative: {
                                id: `initiative-${project.id}`,
                                name: project.name,
                                description: project.description || "",
                                epics: epics,
                              },
                              createdAt: new Date(),
                            };

                            setCurrentPlan(plan);
                            setShowExportModal(true);
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${project.iconBg || "gray"}-100`}
                                >
                                  <Target className="h-5 w-5 text-${project.iconBg || 'gray'}-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-sm">
                                    {project.name}
                                  </h3>
                                  {project.source === "agile-planning" && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs mt-1"
                                    >
                                      <Sparkles className="h-3 w-3 mr-1" />
                                      Agile Plan
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                              {project.description || "No description"}
                            </p>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{project.totalTasks || 0} tasks</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                Export
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                  ) : (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>
                        No projects found. Create a project using the Planning
                        Assistant first.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <JiraIntegrationSettings />
        </TabsContent>
      </Tabs>

      {/* Export Modal */}
      {currentPlan && (
        <JiraExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          plan={currentPlan}
        />
      )}
    </div>
  );
}
