import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  CardTitle,
  CardDescription,
  CardHeader,
  CardContent,
  Card,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  getProject,
  pullTasksFromProvider,
  getProjectTasks,
  updateProject,
  deleteProject,
  processNLPTaskCommand,
} from "@/lib/api";
import { ProjectMembers } from "@/components/projects/ProjectMembers";
import { IntegrationProvider } from "@/types";
import { format } from "date-fns";
import {
  FolderOpen,
  Calendar,
  BarChart2,
  RefreshCcw,
  Plus,
  ListTodo,
  Kanban,
  ToggleLeft,
  Cpu,
  Check,
  X,
  Edit,
  Trash2,
  Milestone,
} from "lucide-react";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskDetailsWithRecommendations } from "@/components/tasks/TaskDetailsWithRecommendations";
import { TaskListEnhanced } from "@/components/tasks/TaskListEnhanced";
import { CollapsibleAIRecommendations } from "@/components/tasks/CollapsibleAIRecommendations";
import { MilestonesTab } from "@/components/projects/MilestonesTab";
import { TimelineCalendar } from "@/components/projects/TimelineCalendar";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { SyncActions } from "@/components/tasks/SyncActions";
import { ProjectAnalysis } from "@/components/projects/ProjectAnalysis";
import { Input } from "@/components/ui/input";
import { Project } from "@shared/schema";
import TaskCreator from "@/components/projects/TaskCreator";
// import MilestoneCreator from "@/components/projects/MilestoneCreator";
import { EnhancedTaskList } from "@/components/projects/EnhancedTaskList";
import { FloatingProjectAssistant } from "@/components/FloatingProjectAssistant";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MilestoneCreator from "@/components/projects/MilestoneCreator";

interface EditableProjectNameProps {
  project: Project;
  onUpdate: (newName: string) => void;
}
interface MilestonesTabProps {
  projectId: number;
}

function EditableProjectName({ project, onUpdate }: EditableProjectNameProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    if (name.trim() !== "" && name !== project.name) {
      onUpdate(name);
    } else {
      setName(project.name); // Revert if empty or unchanged
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(project.name); // Revert changes
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div className="relative flex items-center">
      {isEditing ? (
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-3xl font-bold px-2 py-1 h-auto"
            placeholder="Project name"
          />
          <div className="flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              className="h-8 w-8 text-green-600"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="h-8 w-8 text-red-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center group">
          <span>{project.name}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleStartEditing}
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ProjectDetails() {
  // Handle both /projects/:id and /project/:id routes
  const [matchProjects, paramsProjects] = useRoute("/projects/:id");
  const [matchProject, paramsProject] = useRoute("/project/:id");

  // Use whichever route matched
  const params = paramsProjects || paramsProject;
  const projectId = params?.id ? parseInt(params.id) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isAddMilestoneModalOpen, setIsAddMilestoneModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);

  console.log("ProjectDetails - params:", params, "projectId:", projectId);

  // Mutation for deleting a project
  const deleteProjectMutation = useMutation({
    mutationFn: (id: number) => {
      return deleteProject(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project deleted",
        description: "The project has been successfully deleted.",
      });
      setLocation("/projects"); // Redirect to projects list
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete the project",
        variant: "destructive",
      });
    },
  });
  const primaryTabs = ["tasks", "overview", "members"];
  const secondaryTabs = ["milestones", "timeline", "analytics"];

  const [activeTab, setActiveTab] = useState("tasks");

  // Mutation for updating project details
  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Project> }) => {
      return updateProject(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({
        title: "Project updated",
        description: "Project details have been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update project details",
        variant: "destructive",
      });
    },
  });

  const {
    data: project,
    isLoading,
    error,
  } = useQuery({
    queryKey: [`/api/projects/${projectId}`],
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
    retry: 0,
    staleTime: 0,
  });

  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: [`/api/projects/${projectId}/tasks`],
    queryFn: () => getProjectTasks(projectId),
    enabled: !!projectId,
  });

  // Mutation for syncing with connected providers
  const syncWithProviderMutation = useMutation({
    mutationFn: ({ provider }: { provider: IntegrationProvider }) => {
      return pullTasksFromProvider(provider, projectId);
    },
    onSuccess: (data) => {
      toast({
        title: "Tasks synchronized",
        description:
          data.message || "Project tasks were successfully synchronized",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "tasks"],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description:
          error.message || "Failed to synchronize with external provider",
        variant: "destructive",
      });
    },
  });

  const handleSyncWithProvider = (provider: IntegrationProvider) => {
    syncWithProviderMutation.mutate({ provider });
  };

  // NLP Task Updater mutation - processes natural language commands and auto-refreshes
  const nlpTaskMutation = useMutation({
    mutationFn: ({ command }: { command: string }) => {
      return processNLPTaskCommand(command, projectId);
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Task updated" : "Command failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });

      if (data.success) {
        // Invalidate tasks query to trigger automatic refresh
        queryClient.invalidateQueries({
          queryKey: [`/api/projects/${projectId}/tasks`],
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Command failed",
        description: error.message || "Failed to process command",
        variant: "destructive",
      });
    },
  });

  const handleNLPCommand = (command: string) => {
    nlpTaskMutation.mutate({ command });
  };

  const getProjectStatus = () => {
    if (!project) return null;

    switch (project.status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "completed":
        return <Badge className="bg-blue-500">Completed</Badge>;
      case "on-hold":
        return <Badge className="bg-yellow-500">On Hold</Badge>;
      default:
        return <Badge>{project.status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-9 w-[100px]" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-1/4 mb-2" />
            <Skeleton className="h-5 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    console.error("Project error details:", error);

    // If it's an authentication error, redirect to login
    if (
      (error as any)?.status === 401 ||
      error.message?.includes("401") ||
      error.message?.includes("Not authenticated")
    ) {
      return (
        <div className="container mx-auto py-6">
          <Card className="p-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">
                Authentication Required
              </h2>
              <p className="text-gray-600 mb-4">
                Please log in to view project details.
              </p>
              <Button onClick={() => (window.location.href = "/api/login")}>
                Log In
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return (
      <div className="container mx-auto py-6">
        <Card className="p-6">
          <div className="text-center text-red-500">
            <h2 className="text-xl font-semibold mb-2">
              Error Loading Project
            </h2>
            <p>Project ID: {projectId}</p>
            <p className="text-sm text-gray-600 mt-2">
              Error: {error?.message || "Unknown error occurred"}
            </p>
            <div className="flex gap-2 justify-center mt-4">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/projects")}
              >
                Back to Projects
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!project && !isLoading) {
    return (
      <div className="container mx-auto py-6">
        <Card className="p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
            <p>Project ID: {projectId}</p>
            <p className="text-gray-600 mb-4">
              The project you're looking for doesn't exist or you don't have
              access to it.
            </p>
            <Button variant="outline" onClick={() => setLocation("/projects")}>
              Back to Projects
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  console.log("Rendering project details for project:", project);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold flex items-center flex-wrap">
              <span
                className={`mr-2 h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center bg-${project?.iconBg || "blue"}-100`}
              >
                <FolderOpen
                  className={`h-5 w-5 sm:h-6 sm:w-6 text-${project?.iconBg || "blue"}-600`}
                />
              </span>

              {project && (
                <EditableProjectName
                  project={project}
                  onUpdate={(updatedName) => {
                    updateProjectMutation.mutate({
                      id: project.id,
                      data: { name: updatedName },
                    });
                  }}
                />
              )}
            </h1>

            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              {project?.source && (
                <span className="mr-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  {project.source === "agile-planning"
                    ? "Created with Agile Planning Agent"
                    : project.source === "manual" && project.aiGenerated
                      ? "Created with Requisor Agent"
                      : project.source === "manual"
                        ? "Created manually"
                        : `From ${project.source}`}
                </span>
              )}
              Created on{" "}
              {project?.createdAt && typeof project.createdAt === "string"
                ? format(new Date(project.createdAt), "MMM d, yyyy")
                : "Unknown"}
              {project?.dueDate && typeof project.dueDate === "string" && (
                <>
                  {" "}
                  · Due by {format(new Date(project.dueDate), "MMM d, yyyy")}
                </>
              )}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 w-full sm:flex-row sm:gap-2 sm:w-auto sm:flex-nowrap">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => {
                if (
                  project &&
                  window.confirm(
                    `Are you sure you want to delete the project "${project.name}"?`,
                  )
                ) {
                  deleteProjectMutation.mutate(project.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setIsAddMilestoneModalOpen(true)}
            >
              <Milestone className="h-4 w-4 mr-1" />
              Milestone
            </Button>

            <Button
              variant="default"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setIsAddTaskModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Task
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* MOBILE */}
          {/* MOBILE */}
          <div className="sm:hidden mb-4">
            <div className="flex items-center gap-2">
              <TabsList className="flex flex-1">
                {primaryTabs.map((tab) => (
                  <TabsTrigger key={tab} value={tab} className="flex-1 text-xs">
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* More dropdown */}
              <select
                value={secondaryTabs.includes(activeTab) ? activeTab : ""}
                onChange={(e) => setActiveTab(e.target.value)}
                className="h-9 rounded-md border bg-white px-2 text-xs"
              >
                <option value="">More</option>
                {secondaryTabs.map((tab) => (
                  <option key={tab} value={tab}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* DESKTOP */}
          <TabsList className="hidden sm:flex mb-6">
            {[
              "tasks",
              "overview",
              "members",
              //  "milestones",
              "timeline",
              "analytics",
            ].map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold">Tasks</h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  {project.completedTasks} of {project.totalTasks} completed
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  {getProjectStatus()}
                  <span className="font-semibold">{project.progress}%</span>
                </div>

                <div className="flex items-center border rounded-md p-1 bg-slate-50">
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                  >
                    <ListTodo className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "kanban" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("kanban")}
                  >
                    <Kanban className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border shadow-sm">
              <div className="p-4 sm:p-6">
                {viewMode === "list" ? (
                  <EnhancedTaskList
                    projectId={projectId}
                    tasks={tasks}
                    onTaskUpdate={() =>
                      queryClient.invalidateQueries({
                        queryKey: [`/api/projects/${projectId}/tasks`],
                      })
                    }
                  />
                ) : (
                  <KanbanBoard
                    projectId={projectId}
                    tasks={tasks}
                    isLoading={isLoadingTasks}
                  />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="overview">
            <Card />
          </TabsContent>

          <TabsContent value="members">
            <ProjectMembers projectId={projectId} />
          </TabsContent>

          <TabsContent value="milestones">
            <MilestonesTab projectId={projectId} />
          </TabsContent>

          <TabsContent value="timeline">
            <TimelineCalendar projectId={projectId} />
          </TabsContent>

          <TabsContent value="analytics">
            <ProjectAnalysis projectId={projectId} />
          </TabsContent>
        </Tabs>
      </div>
      {/* Add Task Modal */}
      <Dialog open={isAddTaskModalOpen} onOpenChange={setIsAddTaskModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
            <DialogDescription>
              Create a new task for your project. Fill in the task details
              below.
            </DialogDescription>
          </DialogHeader>
          <TaskCreator
            projectId={projectId}
            onTaskCreated={() => {
              queryClient.invalidateQueries({
                queryKey: [`/api/projects/${projectId}/tasks`],
              });
              setIsAddTaskModalOpen(false);
              toast({
                title: "Task created",
                description: "New task has been added to your project.",
              });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Add Milestone Modal */}
      <Dialog
        open={isAddMilestoneModalOpen}
        onOpenChange={setIsAddMilestoneModalOpen}
      >
        <DialogContent className="sm:max-w-[600px] p-0">
          <MilestoneCreator
            projectId={projectId}
            onMilestoneCreated={() => {
              setIsAddMilestoneModalOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
      {/* Floating Project Assistant */}

      {project && (
        <FloatingProjectAssistant
          projectId={projectId}
          projectName={project.name}
          onNLPCommand={handleNLPCommand}
          className="bottom-4 right-4 sm:bottom-6 sm:right-6"
        />
      )}
    </div>
  );
}
