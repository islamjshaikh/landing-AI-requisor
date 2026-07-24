import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AIProjectPlan } from "@/types";
import IntegrationProvider from "@/types/integration";
import {
  generateProjectPlan,
  createProjectFromPlan,
  exportToIntegration,
} from "@/lib/api";
import {
  Bot,
  Sparkles,
  Loader2,
  CheckCircle,
  Download,
  ExternalLink,
  ChevronLeft,
  Edit,
  Trash,
  Plus,
  Save,
  Calendar,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SiJira, SiAsana, SiNotion } from "react-icons/si";
import { useLocation } from "wouter";

// Step identifiers - simplified workflow with fewer steps
enum ProjectCreationStep {
  INPUT = 0,
  PROCESSING = 1,
  REVIEW = 2,
  EXPORT = 3,
}

// Define a type for export destinations
type ExportDestination = IntegrationProvider | "requisor_only";

export function AIProjectCreator() {
  const [currentStep, setCurrentStep] = useState<ProjectCreationStep>(
    ProjectCreationStep.INPUT,
  );
  const [projectIdea, setProjectIdea] = useState("");
  const [projectPlan, setProjectPlan] = useState<AIProjectPlan | null>(null);
  const [exportTarget, setExportTarget] =
    useState<ExportDestination>("requisor_only");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { showUpgrade } = useUpgradeModal();

  // State for editing mode
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
  const [editingMilestoneIndex, setEditingMilestoneIndex] = useState<
    number | null
  >(null);
  const [taskFormData, setTaskFormData] = useState<{
    name: string;
    description: string;
    dueDate: string;
    priority: string;
  }>({ name: "", description: "", dueDate: "", priority: "medium" });
  const [milestoneFormData, setMilestoneFormData] = useState<{
    name: string;
    description: string;
    dueDate: string;
  }>({ name: "", description: "", dueDate: "" });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    type: "task" | "milestone";
    index: number;
  } | null>(null);

  // Mutation for creating a new project via AI
  const createProject = useMutation({
    mutationFn: async (idea: string) => {
      return await generateProjectPlan(idea);
    },
    onSuccess: (data) => {
      setProjectPlan(data);
      setCurrentStep(ProjectCreationStep.REVIEW);
      toast({
        title: "Project plan generated!",
        description: "Review the project details and save when ready.",
      });
    },
    onError: (error) => {
      setCurrentStep(ProjectCreationStep.INPUT);
      toast({
        title: "Failed to generate project plan",
        description:
          error.message || "There was an error processing your idea.",
        variant: "destructive",
      });
    },
  });

  // Mutation for saving the project to our database
  const saveProject = useMutation({
    mutationFn: async (plan: AIProjectPlan) => {
      return await createProjectFromPlan(plan);
    },
    onSuccess: (response) => {
      toast({
        title: "Project saved successfully!",
        description:
          "Your new project has been created with all tasks and milestones.",
      });

      // Reset state
      setProjectIdea("");
      setProjectPlan(null);
      setCurrentStep(ProjectCreationStep.INPUT);
      setExportTarget("requisor_only");

      // Refresh queries to update UI
      queryClient.invalidateQueries({ queryKey: ["/api/projects/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });

      // Navigate to the project details page
      // The API response structure is { success: true, project: newProject, message: "..." }
      if (response && response.project && response.project.id) {
        setLocation(`/projects/${response.project.id}`);
      }
    },
    onError: (error) => {
      if (error.message?.includes("403")) {
        showUpgrade("project_limit");
        return;
      }

      toast({
        title: "Failed to save project",
        description: error.message || "There was an error saving your project.",
        variant: "destructive",
      });
    },
  });

  // Mutation for exporting the project to an external tool
  const exportProject = useMutation({
    mutationFn: async ({
      plan,
      provider,
    }: {
      plan: AIProjectPlan;
      provider: IntegrationProvider;
    }) => {
      return await exportToIntegration(plan, provider);
    },
    onSuccess: (response) => {
      toast({
        title: "Project exported successfully!",
        description: `Your project has been exported to ${exportTarget}.`,
      });

      // Reset state
      setProjectIdea("");
      setProjectPlan(null);
      setCurrentStep(ProjectCreationStep.INPUT);
      setExportTarget("requisor_only");

      // Refresh queries to update UI
      queryClient.invalidateQueries({ queryKey: ["/api/projects/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });

      // Navigate to the project details page
      // Check if we have project details
      if (
        response &&
        response.exportDetails &&
        response.exportDetails.projectId
      ) {
        setLocation(`/projects/${response.exportDetails.projectId}`);
      }
    },
    onError: (error) => {
      toast({
        title: "Export failed",
        description:
          error.message || `There was an error exporting to ${exportTarget}.`,
        variant: "destructive",
      });
    },
  });

  // Submit the initial project idea to generate a plan
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check if project idea is empty
    if (!projectIdea.trim()) {
      toast({
        title: "Failed to generate project plan",
        description:
          "Project idea is required. Please describe your project idea.",
        variant: "destructive",
      });
      return;
    }

    // Start processing
    setCurrentStep(ProjectCreationStep.PROCESSING);

    // Call the API with the idea - simplified approach
    createProject.mutate(projectIdea);
  };

  // Save or export the generated project plan
  const handleSaveProject = () => {
    if (!projectPlan) return;

    if (exportTarget && exportTarget !== "requisor_only") {
      setCurrentStep(ProjectCreationStep.EXPORT);
      exportProject.mutate({
        plan: projectPlan,
        provider: exportTarget as IntegrationProvider,
      });
    } else {
      saveProject.mutate(projectPlan);
    }
  };

  // Navigate back to the input step
  const handleBack = () => {
    if (currentStep === ProjectCreationStep.REVIEW) {
      setCurrentStep(ProjectCreationStep.INPUT);
    }
  };

  // Handler functions for editing/deleting tasks and milestones
  const startEditingTask = (index: number) => {
    if (!projectPlan) return;
    const task = projectPlan.tasks[index];
    setTaskFormData({
      name: task.name,
      description: task.description || "",
      dueDate: task.dueDate || "",
      priority: task.priority || "medium",
    });
    setEditingTaskIndex(index);
  };

  const startEditingMilestone = (index: number) => {
    if (!projectPlan) return;
    const milestone = projectPlan.milestones[index];
    setMilestoneFormData({
      name: milestone.name,
      description: milestone.description || "",
      dueDate: milestone.dueDate,
    });
    setEditingMilestoneIndex(index);
  };

  const saveTaskEdit = () => {
    if (!projectPlan || editingTaskIndex === null) return;

    const updatedTasks = [...projectPlan.tasks];
    updatedTasks[editingTaskIndex] = {
      ...updatedTasks[editingTaskIndex],
      name: taskFormData.name,
      description: taskFormData.description,
      dueDate: taskFormData.dueDate,
      priority: taskFormData.priority,
    };

    setProjectPlan({
      ...projectPlan,
      tasks: updatedTasks,
    });

    setEditingTaskIndex(null);
    toast({
      title: "Task updated",
      description: "Your changes have been saved.",
    });
  };

  const saveMilestoneEdit = () => {
    if (!projectPlan || editingMilestoneIndex === null) return;

    const updatedMilestones = [...projectPlan.milestones];
    updatedMilestones[editingMilestoneIndex] = {
      ...updatedMilestones[editingMilestoneIndex],
      name: milestoneFormData.name,
      description: milestoneFormData.description,
      dueDate: milestoneFormData.dueDate,
    };

    setProjectPlan({
      ...projectPlan,
      milestones: updatedMilestones,
    });

    setEditingMilestoneIndex(null);
    toast({
      title: "Milestone updated",
      description: "Your changes have been saved.",
    });
  };

  const cancelEdit = () => {
    setEditingTaskIndex(null);
    setEditingMilestoneIndex(null);
  };

  const confirmDelete = () => {
    if (!projectPlan || !itemToDelete) return;

    if (itemToDelete.type === "task") {
      const updatedTasks = projectPlan.tasks.filter(
        (_, index) => index !== itemToDelete.index,
      );
      setProjectPlan({
        ...projectPlan,
        tasks: updatedTasks,
      });
      toast({
        title: "Task deleted",
        description: "The task has been removed from the plan.",
      });
    } else {
      const updatedMilestones = projectPlan.milestones.filter(
        (_, index) => index !== itemToDelete.index,
      );
      setProjectPlan({
        ...projectPlan,
        milestones: updatedMilestones,
      });
      toast({
        title: "Milestone deleted",
        description: "The milestone has been removed from the plan.",
      });
    }

    setDeleteConfirmOpen(false);
    setItemToDelete(null);
  };

  const startDeleteProcess = (type: "task" | "milestone", index: number) => {
    setItemToDelete({ type, index });
    setDeleteConfirmOpen(true);
  };

  const addNewTask = () => {
    if (!projectPlan) return;

    const newTask = {
      name: "New Task",
      description: "",
      dueDate: projectPlan?.timeline?.endDate || "",
      priority: "medium",
    };

    setProjectPlan({
      ...projectPlan,
      tasks: [...(projectPlan?.tasks || []), newTask],
    });

    // Start editing the new task
    startEditingTask((projectPlan?.tasks || []).length);
  };

  const addNewMilestone = () => {
    if (!projectPlan) return;

    const newMilestone = {
      name: "New Milestone",
      description: "",
      dueDate: projectPlan?.timeline?.endDate || "",
    };

    setProjectPlan({
      ...projectPlan,
      milestones: [...(projectPlan?.milestones || []), newMilestone],
    });

    // Start editing the new milestone
    startEditingMilestone(projectPlan.milestones.length);
  };

  // Helper to render the appropriate icon for each integration provider
  const renderIntegrationIcon = (provider: string) => {
    switch (provider) {
      case IntegrationProvider.Jira:
        return <SiJira className="h-5 w-5" />;
      case IntegrationProvider.Asana:
        return <SiAsana className="h-5 w-5" />;
      case IntegrationProvider.Monday:
        return <SiNotion className="h-5 w-5" />;
      default:
        return <SiNotion className="h-5 w-5" />;
    }
  };

  // Render the input step for collecting the project idea
  const renderInputStep = () => (
    <div className="relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-10">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/30 blur-2xl"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-amber-400/30 blur-2xl"></div>
      </div>

      <div className="relative z-10 p-2">
        {/* Header with AI Icon */}
        <div className="flex items-center mb-5 gap-3">
          <div className="bg-primary/10 p-3 rounded-lg">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Let's create something amazing!
            </h2>
            <p className="text-slate-600 text-sm">
              I'll transform your idea into a structured project plan in
              seconds.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Enhanced textarea with subtle gradient border */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-amber-400/30 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <Textarea
              placeholder="Describe your project idea, paste a spec, or even a Slack thread..."
              className="relative bg-white w-full min-h-[130px] p-5 text-base border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              value={projectIdea}
              onChange={(e) => setProjectIdea(e.target.value)}
            />
          </div>

          {/* Examples and suggestions */}
          <div className="px-2 text-xs text-slate-500 flex flex-wrap gap-2">
            <span>Examples:</span>
            <button
              type="button"
              onClick={() =>
                setProjectIdea(
                  "Create a website redesign project with new branding",
                )
              }
              className="text-primary underline-offset-2 hover:underline"
            >
              Website redesign
            </button>
            <button
              type="button"
              onClick={() =>
                setProjectIdea(
                  "Mobile app development project with user authentication",
                )
              }
              className="text-primary underline-offset-2 hover:underline"
            >
              Mobile app
            </button>
            <button
              type="button"
              onClick={() =>
                setProjectIdea("Marketing campaign for new product launch")
              }
              className="text-primary underline-offset-2 hover:underline"
            >
              Marketing campaign
            </button>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg shadow-md transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              disabled={!projectIdea.trim()}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Project Plan
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  // Render loading spinner during processing
  const renderProcessingStep = () => (
    <div className="py-10 flex flex-col items-center justify-center text-center">
      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
      <h3 className="text-xl font-bold text-slate-800 mb-2">
        Analyzing your project idea...
      </h3>
      <p className="text-slate-600 max-w-md">
        I'm creating a comprehensive project plan with tasks, milestones, and
        timelines based on your input.
      </p>
    </div>
  );

  // Render the review screen for viewing and saving the generated plan
  const renderReviewStep = () => {
    if (!projectPlan) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleBack}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-bold text-slate-800">
              Project Plan Review
            </h2>
          </div>
          <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none">
            <CheckCircle className="h-3.5 w-3.5 mr-1" />
            AI Generated
          </Badge>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {projectPlan.name}
                </h3>
                <p className="text-slate-600 mt-1">{projectPlan.description}</p>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-800">
                    Key Milestones
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={addNewMilestone}
                    className="h-7 px-2 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Milestone
                  </Button>
                </div>
                <ul className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                  {projectPlan.milestones?.map((milestone, index) => (
                    <li
                      key={index}
                      className="flex flex-col gap-1 bg-slate-50 p-3 rounded-lg"
                    >
                      {editingMilestoneIndex === index ? (
                        <div className="space-y-2 p-1">
                          <Input
                            value={milestoneFormData.name}
                            onChange={(e) =>
                              setMilestoneFormData({
                                ...milestoneFormData,
                                name: e.target.value,
                              })
                            }
                            placeholder="Milestone name"
                            className="text-sm"
                          />
                          <Textarea
                            value={milestoneFormData.description}
                            onChange={(e) =>
                              setMilestoneFormData({
                                ...milestoneFormData,
                                description: e.target.value,
                              })
                            }
                            placeholder="Description"
                            className="text-xs min-h-[60px]"
                          />
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-slate-500" />
                            <Input
                              type="date"
                              value={milestoneFormData.dueDate.split("T")[0]}
                              onChange={(e) =>
                                setMilestoneFormData({
                                  ...milestoneFormData,
                                  dueDate: e.target.value,
                                })
                              }
                              className="text-xs h-7 px-2"
                            />
                          </div>
                          <div className="flex justify-end gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEdit}
                              className="h-7 px-2 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={saveMilestoneEdit}
                              className="h-7 px-2 text-xs"
                            >
                              <Save className="h-3.5 w-3.5 mr-1" />
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                              </div>
                              <span className="text-sm font-medium text-slate-800">
                                {milestone.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditingMilestone(index)}
                                className="h-6 w-6 p-0"
                              >
                                <Edit className="h-3.5 w-3.5 text-slate-500 hover:text-primary" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  startDeleteProcess("milestone", index)
                                }
                                className="h-6 w-6 p-0"
                              >
                                <Trash className="h-3.5 w-3.5 text-slate-500 hover:text-red-500" />
                              </Button>
                            </div>
                          </div>
                          {milestone.description && (
                            <p className="text-xs text-slate-600 ml-7">
                              {milestone.description}
                            </p>
                          )}
                          <div className="text-xs text-slate-500 ml-7">
                            Due: {milestone.dueDate}
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-800">
                    Key Tasks
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={addNewTask}
                    className="h-7 px-2 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Task
                  </Button>
                </div>
                <ul className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {projectPlan.tasks?.map((task, index) => (
                    <li
                      key={index}
                      className="flex flex-col gap-1 bg-slate-50 p-3 rounded-lg"
                    >
                      {editingTaskIndex === index ? (
                        <div className="space-y-2 p-1">
                          <Input
                            value={taskFormData.name}
                            onChange={(e) =>
                              setTaskFormData({
                                ...taskFormData,
                                name: e.target.value,
                              })
                            }
                            placeholder="Task name"
                            className="text-sm"
                          />
                          <Textarea
                            value={taskFormData.description}
                            onChange={(e) =>
                              setTaskFormData({
                                ...taskFormData,
                                description: e.target.value,
                              })
                            }
                            placeholder="Description"
                            className="text-xs min-h-[60px]"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                              <Calendar className="h-3.5 w-3.5 text-slate-500" />
                              <Input
                                type="date"
                                value={taskFormData.dueDate.split("T")[0]}
                                onChange={(e) =>
                                  setTaskFormData({
                                    ...taskFormData,
                                    dueDate: e.target.value,
                                  })
                                }
                                className="text-xs h-7 px-2"
                              />
                            </div>
                            <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                              <Tag className="h-3.5 w-3.5 text-slate-500" />
                              <Select
                                value={taskFormData.priority}
                                onValueChange={(value) =>
                                  setTaskFormData({
                                    ...taskFormData,
                                    priority: value,
                                  })
                                }
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">
                                    Low Priority
                                  </SelectItem>
                                  <SelectItem value="medium">
                                    Medium Priority
                                  </SelectItem>
                                  <SelectItem value="high">
                                    High Priority
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEdit}
                              className="h-7 px-2 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={saveTaskEdit}
                              className="h-7 px-2 text-xs"
                            >
                              <Save className="h-3.5 w-3.5 mr-1" />
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                              </div>
                              <span className="text-sm font-medium text-slate-800">
                                {task.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditingTask(index)}
                                className="h-6 w-6 p-0"
                              >
                                <Edit className="h-3.5 w-3.5 text-slate-500 hover:text-primary" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  startDeleteProcess("task", index)
                                }
                                className="h-6 w-6 p-0"
                              >
                                <Trash className="h-3.5 w-3.5 text-slate-500 hover:text-red-500" />
                              </Button>
                            </div>
                          </div>
                          {task.description && (
                            <p className="text-xs text-slate-600 ml-7">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 ml-7 text-xs">
                            <span className="text-slate-500">
                              Due: {task.dueDate}
                            </span>
                            {task.priority && (
                              <span
                                className={`px-1.5 py-0.5 rounded ${task.priority === "high" ? "bg-red-100 text-red-700" : task.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}
                              >
                                {task.priority.charAt(0).toUpperCase() +
                                  task.priority.slice(1)}{" "}
                                priority
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Select
            value={exportTarget}
            onValueChange={(value) =>
              setExportTarget(value as ExportDestination)
            }
          >
            <SelectTrigger className="w-full sm:w-[250px]">
              <SelectValue placeholder="Save to Requisor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="requisor_only">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  <span>Save to Requisor</span>
                </div>
              </SelectItem>
              <SelectItem value={IntegrationProvider.Jira}>
                <div className="flex items-center gap-2">
                  <SiJira className="h-4 w-4 text-blue-500" />
                  <span>Export to Jira</span>
                </div>
              </SelectItem>
              <SelectItem value={IntegrationProvider.Asana}>
                <div className="flex items-center gap-2">
                  <SiAsana className="h-4 w-4 text-red-500" />
                  <span>Export to Asana</span>
                </div>
              </SelectItem>
              <SelectItem value={IntegrationProvider.Monday}>
                <div className="flex items-center gap-2">
                  <SiNotion className="h-4 w-4 text-black" />
                  <span>Export to Monday</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="w-full sm:w-auto bg-primary hover:bg-primary/90"
            onClick={handleSaveProject}
          >
            {exportTarget === "requisor_only" ? (
              <>
                <Download className="mr-2 h-4 w-4" />
                Save Project
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                Export to {exportTarget}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  // Render exporting feedback
  const renderExportStep = () => (
    <div className="py-10 flex flex-col items-center justify-center text-center">
      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
      <h3 className="text-xl font-bold text-slate-800 mb-2">
        Exporting your project to {exportTarget}...
      </h3>
      <p className="text-slate-600 max-w-md">
        Please wait while we connect to {exportTarget} and export your project
        data.
      </p>
    </div>
  );

  // Delete confirmation dialog
  const renderDeleteConfirmDialog = () => (
    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the {itemToDelete?.type}. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setItemToDelete(null)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDelete}
            className="bg-red-500 hover:bg-red-600"
          >
            <Trash className="h-4 w-4 mr-2" />
            Delete {itemToDelete?.type}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Main rendering logic based on current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case ProjectCreationStep.INPUT:
        return renderInputStep();
      case ProjectCreationStep.PROCESSING:
        return renderProcessingStep();
      case ProjectCreationStep.REVIEW:
        return renderReviewStep();
      case ProjectCreationStep.EXPORT:
        return renderExportStep();
      default:
        return renderInputStep();
    }
  };

  return (
    <>
      {renderCurrentStep()}
      {renderDeleteConfirmDialog()}
    </>
  );
}
