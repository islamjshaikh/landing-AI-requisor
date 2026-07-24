import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  Hash,
  Layers,
  Loader2,
  Save,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import { Link } from "wouter";

export default function JiraBacklogGenerator() {
  const [featureDescription, setFeatureDescription] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [generatedStories, setGeneratedStories] = useState<any[]>([]);
  const [savedStories, setSavedStories] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [showJiraDialog, setShowJiraDialog] = useState(false);
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [selectedStoryIds, setSelectedStoryIds] = useState<number[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
  });

  // Check JIRA integration status
  const { data: integration } = useQuery({
    queryKey: ["/api/jira/integration"],
  });

  // Fetch JIRA projects
  const { data: jiraProjects = [] } = useQuery({
    queryKey: ["/api/jira/projects"],
    enabled: !!integration?.isActive,
  });

  // Generate backlog mutation
  const generateBacklog = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/jira/backlog/generate", "POST", data),
    onSuccess: (data) => {
      setGeneratedStories(data.stories || []);
      setSavedStories([]);
      setSelectedStoryIds([]);
      toast({
        title: "Backlog Generated",
        description: `Created ${data.stories?.length || 0} user stories for your feature.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate backlog.",
        variant: "destructive",
      });
    },
  });

  // Save stories mutation
  const saveStories = useMutation({
    mutationFn: async (stories: any[]) => {
      const savedResults = [];
      for (const story of stories) {
        const result = await apiRequest("/api/jira/stories", "POST", {
          projectId: parseInt(selectedProject),
          ...story,
        });
        savedResults.push(result);
      }
      return savedResults;
    },
    onSuccess: (data) => {
      setSavedStories(data);
      toast({
        title: "Stories Saved",
        description: `${data.length} stories have been added to your project backlog.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save stories.",
        variant: "destructive",
      });
    },
  });

  // Push to JIRA mutation
  const pushToJira = useMutation({
    mutationFn: async (storyIds: number[]) => {
      const results = [];
      for (const storyId of storyIds) {
        const result = await apiRequest(
          `/api/jira/sync/push/${storyId}`,
          "POST",
          { projectKey: jiraProjectKey },
        );
        results.push(result);
      }
      return results;
    },
    onSuccess: (data) => {
      toast({
        title: "Pushed to JIRA",
        description: `${data.length} stories have been pushed to JIRA.`,
      });
      setShowJiraDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/jira/stories"] });
    },
    onError: (error: any) => {
      toast({
        title: "Push Failed",
        description: error.message || "Failed to push stories to JIRA.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!featureDescription.trim()) {
      toast({
        title: "Feature Required",
        description: "Please describe the feature or module.",
        variant: "destructive",
      });
      return;
    }

    generateBacklog.mutate({
      feature: featureDescription,
      context: additionalContext,
      projectId: selectedProject ? parseInt(selectedProject) : undefined,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-700";
      case "high":
        return "bg-orange-100 text-orange-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      case "low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getPointsColor = (points: number) => {
    if (points <= 3) return "bg-green-100 text-green-700";
    if (points <= 8) return "bg-yellow-100 text-yellow-700";
    return "bg-orange-100 text-orange-700";
  };

  const totalPoints = generatedStories.reduce(
    (sum, story) => sum + (story.storyPoints || 0),
    0,
  );

  const handleSaveAll = () => {
    if (!selectedProject || generatedStories.length === 0) {
      toast({
        title: "Project Required",
        description: "Please select a project to save stories.",
        variant: "destructive",
      });
      return;
    }
    saveStories.mutate(generatedStories);
  };

  const handlePushToJira = () => {
    if (savedStories.length === 0) {
      // Save first, then push
      handleSaveAll();
      return;
    }

    // Select all stories by default
    setSelectedStoryIds(savedStories.map((s) => s.id));
    setShowJiraDialog(true);
  };

  const confirmPushToJira = () => {
    if (!jiraProjectKey || selectedStoryIds.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select a JIRA project and at least one story.",
        variant: "destructive",
      });
      return;
    }
    pushToJira.mutate(selectedStoryIds);
  };

  const toggleStorySelection = (storyId: number) => {
    setSelectedStoryIds((prev) =>
      prev.includes(storyId)
        ? prev.filter((id) => id !== storyId)
        : [...prev, storyId],
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-teal-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/jira-agent">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to JIRA Tools
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Backlog Generator
            </h1>
            <p className="text-gray-600 mt-2">
              Generate complete product backlogs from high-level features
            </p>
          </div>
        </div>

        {/* Input Section */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Feature Description</CardTitle>
              <CardDescription>
                Describe a feature or module and AI will generate a complete
                backlog with prioritized stories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="feature">Feature/Module*</Label>
                <Textarea
                  id="feature"
                  placeholder="e.g., E-commerce checkout process with payment integration, user authentication system, reporting dashboard..."
                  value={featureDescription}
                  onChange={(e) => setFeatureDescription(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="context">Additional Context (Optional)</Label>
                <Textarea
                  id="context"
                  placeholder="Specific requirements, constraints, technical considerations, target users..."
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="project">Save to Project (Optional)</Label>
                  <select
                    id="project"
                    className="w-full px-3 py-2 border rounded-md"
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                  >
                    <option value="">Don't save to project</option>
                    {projects.map((project: any) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={
                    generateBacklog.isPending || !featureDescription.trim()
                  }
                  className="px-8"
                >
                  {generateBacklog.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Backlog
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generated Stories */}
        {generatedStories.length > 0 && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Stories</p>
                      <p className="text-2xl font-bold">
                        {generatedStories.length}
                      </p>
                    </div>
                    <Layers className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Points</p>
                      <p className="text-2xl font-bold">{totalPoints}</p>
                    </div>
                    <Hash className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Avg. Points</p>
                      <p className="text-2xl font-bold">
                        {(totalPoints / generatedStories.length).toFixed(1)}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Story List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Generated Backlog</CardTitle>
                  <div className="flex items-center gap-3">
                    {savedStories.length > 0 ? (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700"
                      >
                        {savedStories.length} Stories Saved
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-gray-100 text-gray-700"
                      >
                        Not Saved
                      </Badge>
                    )}
                    {selectedProject && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveAll}
                          disabled={
                            saveStories.isPending || savedStories.length > 0
                          }
                        >
                          {saveStories.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save All
                            </>
                          )}
                        </Button>
                        {integration?.isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handlePushToJira}
                            disabled={
                              pushToJira.isPending ||
                              (savedStories.length === 0 &&
                                generatedStories.length === 0)
                            }
                          >
                            {pushToJira.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Pushing...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Push to JIRA
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {generatedStories.map((story, index) => (
                    <Card key={index} className="border-l-4 border-l-green-500">
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <h4 className="font-semibold text-lg flex-1">
                              {story.title}
                            </h4>
                            <div className="flex items-center gap-2">
                              {story.storyPoints && (
                                <Badge
                                  className={getPointsColor(story.storyPoints)}
                                >
                                  <Hash className="w-3 h-3 mr-1" />
                                  {story.storyPoints} pts
                                </Badge>
                              )}
                              <Badge
                                className={getPriorityColor(story.priority)}
                              >
                                {story.priority}
                              </Badge>
                              {story.roiScore && (
                                <Badge
                                  variant="outline"
                                  className="border-purple-300 text-purple-700"
                                >
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                  ROI: {story.roiScore}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <p className="text-gray-700 bg-gray-50 p-3 rounded text-sm">
                            {story.story}
                          </p>

                          {story.acceptanceCriteria &&
                            story.acceptanceCriteria.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-2">
                                  Acceptance Criteria:
                                </p>
                                <ul className="space-y-1">
                                  {story.acceptanceCriteria.map(
                                    (criteria: string, idx: number) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-2 text-sm"
                                      >
                                        <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                                        <span className="text-gray-600">
                                          {criteria}
                                        </span>
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </div>
                            )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {selectedProject && (
                  <Alert className="mt-6 bg-green-50 border-green-200">
                    <Save className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      All stories have been saved to your project backlog. You
                      can now sync them to JIRA from the project page.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* JIRA Push Dialog */}
      <Dialog open={showJiraDialog} onOpenChange={setShowJiraDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Push Stories to JIRA</DialogTitle>
            <DialogDescription>
              Select which stories to push to JIRA and choose the target
              project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* JIRA Project Selection */}
            <div>
              <Label htmlFor="jira-project">JIRA Project</Label>
              <Select value={jiraProjectKey} onValueChange={setJiraProjectKey}>
                <SelectTrigger id="jira-project">
                  <SelectValue placeholder="Select a JIRA project" />
                </SelectTrigger>
                <SelectContent>
                  {jiraProjects?.map((project: any) => (
                    <SelectItem key={project.key} value={project.key}>
                      {project.name} ({project.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Story Selection */}
            <div>
              <Label className="mb-2 block">Select Stories to Push</Label>
              <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
                {savedStories.map((story) => (
                  <div
                    key={story.id}
                    className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded"
                  >
                    <Checkbox
                      checked={selectedStoryIds.includes(story.id)}
                      onCheckedChange={() => toggleStorySelection(story.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{story.title}</p>
                      <p className="text-sm text-gray-600">{story.story}</p>
                      <div className="flex gap-2 mt-1">
                        {story.storyPoints && (
                          <Badge variant="outline" className="text-xs">
                            {story.storyPoints} pts
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-xs ${getPriorityColor(story.priority)}`}
                        >
                          {story.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelectedStoryIds(savedStories.map((s) => s.id))
                }
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedStoryIds([])}
              >
                Deselect All
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJiraDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmPushToJira}
              disabled={
                !jiraProjectKey ||
                selectedStoryIds.length === 0 ||
                pushToJira.isPending
              }
            >
              {pushToJira.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pushing {selectedStoryIds.length} stories...
                </>
              ) : (
                `Push ${selectedStoryIds.length} stories to JIRA`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
