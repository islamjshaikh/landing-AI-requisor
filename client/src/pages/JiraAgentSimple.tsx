import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  FolderOpen,
  Hash,
  Info,
  Layers,
  Loader2,
  PenTool,
  Plus,
  Save,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { Link, useLocation } from "wouter";

interface GeneratedStory {
  title: string;
  story: string;
  acceptanceCriteria: string[];
  priority?: string;
  type?: string;
}

interface StoryEstimate {
  storyPoints: number;
  confidence: number;
  complexity: string;
  effort: string;
  risk: string;
  reasoning: string;
}

interface BacklogItem {
  title: string;
  userStory: string;
  acceptanceCriteria: string[];
  priority: string;
  storyPoints?: number;
  selected: boolean;
}

export default function JiraAgentSimple() {
  const [activeTab, setActiveTab] = useState("story-writer");
  const { toast } = useToast();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link href="/ai-agents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to AI Agents
              </Button>
            </Link>
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                  <Sparkles className="h-4 w-4 mr-1 inline" />
                  AI-Powered
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">
                Agile Story Generator
              </h1>
              <p className="text-gray-600">
                Generate user stories, estimate points, and create backlogs - no
                login required
              </p>
            </div>
          </div>
        </div>

        {/* Information Alert */}
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900 flex items-center justify-between">
            <span>
              <strong>Standalone Mode:</strong> This tool generates agile
              content and exports to JSON files for manual JIRA import. For
              direct JIRA push capabilities, configure JIRA integration and use
              the full JIRA tools.
            </span>
            <Button size="sm" variant="outline" asChild className="ml-4">
              <Link href="/jira-setup-guide">Setup JIRA Integration</Link>
            </Button>
          </AlertDescription>
        </Alert>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="story-writer">
              <PenTool className="h-4 w-4 mr-2" />
              Story Writer
            </TabsTrigger>
            <TabsTrigger value="estimator">
              <Hash className="h-4 w-4 mr-2" />
              Point Estimator
            </TabsTrigger>
            <TabsTrigger value="backlog">
              <Layers className="h-4 w-4 mr-2" />
              Backlog Generator
            </TabsTrigger>
          </TabsList>

          <TabsContent value="story-writer">
            <StoryWriter />
          </TabsContent>

          <TabsContent value="estimator">
            <PointEstimator />
          </TabsContent>

          <TabsContent value="backlog">
            <BacklogGenerator navigate={navigate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Story Writer Component
function StoryWriter() {
  const [featureIdea, setFeatureIdea] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [businessValue, setBusinessValue] = useState("");
  const [generatedStory, setGeneratedStory] = useState<GeneratedStory | null>(
    null,
  );
  const { toast } = useToast();

  const generateStory = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/jira/stories/write", "POST", data),
    onSuccess: (data) => {
      setGeneratedStory(data);
      toast({
        title: "Story Generated Successfully",
        description: "Your user story is ready!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate story",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!featureIdea.trim()) {
      toast({
        title: "Feature Idea Required",
        description: "Please enter a feature idea",
        variant: "destructive",
      });
      return;
    }

    generateStory.mutate({
      title: featureIdea,
      targetUser: targetUser || "general user",
      businessValue: businessValue || "improve user experience",
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Story copied successfully",
    });
  };

  const exportAsMarkdown = () => {
    if (!generatedStory) return;

    const markdown = `# ${generatedStory.title}

## User Story
${generatedStory.story}

## Acceptance Criteria
${generatedStory.acceptanceCriteria.map((ac, i) => `${i + 1}. ${ac}`).join("\n")}

---
Generated by Requisor Agile Story Generator`;

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${generatedStory.title.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PenTool className="h-5 w-5 mr-2" />
            Create User Story
          </CardTitle>
          <CardDescription>
            Describe your feature and let AI generate a complete user story
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="feature-idea">Feature Idea *</Label>
            <Input
              id="feature-idea"
              value={featureIdea}
              onChange={(e) => setFeatureIdea(e.target.value)}
              placeholder="e.g., Add dark mode to the application"
            />
          </div>

          <div>
            <Label htmlFor="target-user">Target User (Optional)</Label>
            <Input
              id="target-user"
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              placeholder="e.g., power users, mobile users, administrators"
            />
          </div>

          <div>
            <Label htmlFor="business-value">Business Value (Optional)</Label>
            <Textarea
              id="business-value"
              value={businessValue}
              onChange={(e) => setBusinessValue(e.target.value)}
              placeholder="Why is this feature important?"
              rows={3}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateStory.isPending}
            className="w-full"
          >
            {generateStory.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate User Story
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Story */}
      {generatedStory && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <CheckCircle2 className="h-5 w-5 mr-2 text-green-600" />
                Generated Story
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      `${generatedStory.title}\n\n${generatedStory.story}\n\nAcceptance Criteria:\n${generatedStory.acceptanceCriteria.join("\n")}`,
                    )
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={exportAsMarkdown}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">
                {generatedStory.title}
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {generatedStory.story}
              </p>
            </div>

            <div>
              <h4 className="font-medium mb-2">Acceptance Criteria:</h4>
              <ul className="space-y-2">
                {generatedStory.acceptanceCriteria.map((criteria, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{criteria}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Point Estimator Component
function PointEstimator() {
  const [storyTitle, setStoryTitle] = useState("");
  const [storyDescription, setStoryDescription] = useState("");
  const [technicalDetails, setTechnicalDetails] = useState("");
  const [estimate, setEstimate] = useState<StoryEstimate | null>(null);
  const { toast } = useToast();

  const estimatePoints = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/jira/stories/estimate", "POST", data),
    onSuccess: (data) => {
      setEstimate(data);
      toast({
        title: "Estimation Complete",
        description: `Estimated at ${data.storyPoints} story points`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Estimation Failed",
        description: error.message || "Failed to estimate story points",
        variant: "destructive",
      });
    },
  });

  const handleEstimate = () => {
    if (!storyTitle.trim() || !storyDescription.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both title and description",
        variant: "destructive",
      });
      return;
    }

    estimatePoints.mutate({
      title: storyTitle,
      description: storyDescription,
      technicalDetails,
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600";
    if (confidence >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Hash className="h-5 w-5 mr-2" />
            Estimate Story Points
          </CardTitle>
          <CardDescription>
            Provide story details for AI-powered point estimation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="story-title">Story Title *</Label>
            <Input
              id="story-title"
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
              placeholder="e.g., Implement user authentication"
            />
          </div>

          <div>
            <Label htmlFor="story-desc">Story Description *</Label>
            <Textarea
              id="story-desc"
              value={storyDescription}
              onChange={(e) => setStoryDescription(e.target.value)}
              placeholder="Describe what needs to be done..."
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="tech-details">Technical Details (Optional)</Label>
            <Textarea
              id="tech-details"
              value={technicalDetails}
              onChange={(e) => setTechnicalDetails(e.target.value)}
              placeholder="Any technical considerations, dependencies, or risks..."
              rows={3}
            />
          </div>

          <Button
            onClick={handleEstimate}
            disabled={estimatePoints.isPending}
            className="w-full"
          >
            {estimatePoints.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Estimating...
              </>
            ) : (
              <>
                <Target className="h-4 w-4 mr-2" />
                Estimate Points
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Estimation Result */}
      {estimate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Target className="h-5 w-5 mr-2 text-blue-600" />
                Estimation Result
              </span>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {estimate.storyPoints} Points
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Complexity</p>
                <p className="font-semibold">{estimate.complexity}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Effort</p>
                <p className="font-semibold">{estimate.effort}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Risk</p>
                <p className="font-semibold">{estimate.risk}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">Confidence Level</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full"
                    style={{ width: `${estimate.confidence}%` }}
                  />
                </div>
                <span
                  className={`font-semibold ${getConfidenceColor(estimate.confidence)}`}
                >
                  {estimate.confidence}%
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-2">AI Reasoning</p>
              <p className="text-gray-700 text-sm leading-relaxed">
                {estimate.reasoning}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Backlog Generator Component
function BacklogGenerator({ navigate }: { navigate: (path: string) => void }) {
  const [featureDescription, setFeatureDescription] = useState("");
  const [projectContext, setProjectContext] = useState("");
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([]);
  const { toast } = useToast();

  const generateBacklog = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/jira/backlog/generate", "POST", data),
    onSuccess: (data) => {
      setBacklogItems(
        data.stories.map((story: any) => ({
          ...story,
          selected: true,
        })),
      );
      toast({
        title: "Backlog Generated",
        description: `Created ${data.stories.length} user stories`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate backlog",
        variant: "destructive",
      });
    },
  });

  const saveAsProject = useMutation({
    mutationFn: (data: any) => apiRequest("/api/projects", "POST", data),
    onSuccess: (project) => {
      toast({
        title: "Project Created",
        description: "Backlog saved as a new Requisor project",
      });
      // Navigate to the project
      navigate(`/project/${project.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save as project",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!featureDescription.trim()) {
      toast({
        title: "Feature Required",
        description: "Please describe the feature or module",
        variant: "destructive",
      });
      return;
    }

    generateBacklog.mutate({
      feature: featureDescription,
      context: projectContext,
    });
  };

  const toggleItemSelection = (index: number) => {
    setBacklogItems((items) =>
      items.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item,
      ),
    );
  };

  const exportSelectedAsJIRA = () => {
    const selected = backlogItems.filter((item) => item.selected);
    if (selected.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one story to export",
        variant: "destructive",
      });
      return;
    }

    const jiraFormat = selected.map((item) => ({
      summary: item.title,
      description: `${item.userStory}\n\nAcceptance Criteria:\n${item.acceptanceCriteria.map((ac, i) => `${i + 1}. ${ac}`).join("\n")}`,
      issuetype: { name: "Story" },
      priority: { name: item.priority },
      customfield_10016: item.storyPoints, // Story points field
    }));

    const blob = new Blob([JSON.stringify(jiraFormat, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jira-import.json";
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description:
        "JIRA import file downloaded. For direct JIRA push, set up JIRA integration in AI Agents hub.",
      action: (
        <Button variant="outline" size="sm" asChild>
          <Link href="/jira">View Full JIRA Tools</Link>
        </Button>
      ),
    });
  };

  const saveSelectedAsProject = () => {
    const selected = backlogItems.filter((item) => item.selected);
    if (selected.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one story to save",
        variant: "destructive",
      });
      return;
    }

    const projectName = featureDescription.split(" ").slice(0, 5).join(" ");
    const tasks = selected.map((item, index) => ({
      name: item.title,
      description: `${item.userStory}\n\nAcceptance Criteria:\n${item.acceptanceCriteria.join("\n")}`,
      priority: item.priority,
      status: "todo",
      position: index,
    }));

    saveAsProject.mutate({
      name: projectName,
      description: `Generated backlog for: ${featureDescription}`,
      tasks,
      aiGenerated: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Layers className="h-5 w-5 mr-2" />
            Generate Product Backlog
          </CardTitle>
          <CardDescription>
            Describe a feature and get a complete backlog of user stories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="feature-desc">Feature/Module Description *</Label>
            <Textarea
              id="feature-desc"
              value={featureDescription}
              onChange={(e) => setFeatureDescription(e.target.value)}
              placeholder="e.g., E-commerce checkout system with payment processing and order management"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="project-context">Project Context (Optional)</Label>
            <Textarea
              id="project-context"
              value={projectContext}
              onChange={(e) => setProjectContext(e.target.value)}
              placeholder="Target audience, technical constraints, business goals..."
              rows={3}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateBacklog.isPending}
            className="w-full"
          >
            {generateBacklog.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Backlog...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Backlog
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Backlog */}
      {backlogItems.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Generated Backlog (
              {backlogItems.filter((item) => item.selected).length} of{" "}
              {backlogItems.length} selected)
            </h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={exportSelectedAsJIRA}
                disabled={!backlogItems.some((item) => item.selected)}
              >
                <Download className="h-4 w-4 mr-2" />
                Export to JIRA
              </Button>
              <Button
                onClick={saveSelectedAsProject}
                disabled={
                  !backlogItems.some((item) => item.selected) ||
                  saveAsProject.isPending
                }
              >
                {saveAsProject.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Save as Project
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {backlogItems.map((item, index) => (
              <Card key={index} className={item.selected ? "" : "opacity-60"}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleItemSelection(index)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant={
                              item.priority === "high"
                                ? "destructive"
                                : item.priority === "medium"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {item.priority}
                          </Badge>
                          {item.storyPoints && (
                            <Badge variant="outline">
                              {item.storyPoints} points
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-3">{item.userStory}</p>
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Acceptance Criteria:
                    </p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {item.acceptanceCriteria.map((criteria, i) => (
                        <li key={i} className="flex items-start">
                          <CheckCircle2 className="h-3 w-3 text-green-600 mr-1 mt-0.5 flex-shrink-0" />
                          {criteria}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
