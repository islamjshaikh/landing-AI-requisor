import React, { useState, useMemo } from "react";
import { Task } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { TaskDetailsPanel } from "@/components/tasks/TaskDetailsPanel";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  User,
  Calendar,
  CalendarIcon,
  ArrowRight,
  Edit,
  Save,
  X,
  Flag,
  Sparkles,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { updateTask } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SyncActions } from "../tasks/SyncActions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProjectMember {
  id: number;
  userId: string;
  userEmail: string;
  userFirstName: string;
  userLastName: string;
  userUsername: string;
  role: string;
}

interface KanbanColumnProps {
  title: string;
  tasks: Task[];
  status: string;
  count: number;
  color: string;
  icon: React.ReactNode;
  projectId: number;
  projectMembers: ProjectMember[];
  onDrop: (taskId: number, status: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onOpenTaskDetails: (taskId: number) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  tasks,
  status,
  count,
  color,
  icon,
  projectId,
  projectMembers,
  onDrop,
  onDragOver,
  onOpenTaskDetails,
}) => {
  return (
    <div
      className="flex flex-col h-full min-h-[500px] bg-slate-50 rounded-lg p-4 border border-slate-200"
      onDragOver={onDragOver}
      onDrop={(e) => {
        e.preventDefault();
        const taskId = parseInt(e.dataTransfer.getData("taskId"));
        onDrop(taskId, status);
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center ${color} mr-2`}
          >
            {icon}
          </div>
          <h3 className="font-medium text-slate-800">{title}</h3>
        </div>
        <Badge variant="outline" className="bg-white">
          {count}
        </Badge>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            projectId={projectId}
            projectMembers={projectMembers}
            onOpenTaskDetails={onOpenTaskDetails}
          />
        ))}

        {tasks.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-slate-400">No tasks</p>
          </div>
        )}
      </div>
    </div>
  );
};

interface KanbanCardProps {
  task: Task;
  projectId: number;
  projectMembers: ProjectMember[];
  onOpenTaskDetails: (taskId: number) => void;
}

const KanbanCard: React.FC<KanbanCardProps> = ({
  task,
  projectId,
  projectMembers,
  onOpenTaskDetails,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateTaskMutation = useMutation({
    mutationFn: (taskData: Partial<Task>) => {
      console.log(
        "Kanban updating task:",
        task.id,
        "with data:",
        JSON.stringify(taskData),
      );
      return updateTask(task.id, taskData);
    },
    onSuccess: () => {
      // Refresh tasks after update
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "tasks"],
      });
      toast({
        title: "Task updated",
        description: "Task has been successfully updated",
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      console.error("Update task error:", error);
      toast({
        title: "Failed to update task",
        description:
          error?.message || "An error occurred while updating the task",
        variant: "destructive",
      });
    },
  });

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditedTask({ ...task });
    setIsEditing(true);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Create a basic task object with only the fields we want to update
    const updateData: Record<string, any> = {};

    // Only include fields that are present in the edited task
    if (editedTask.name !== undefined) updateData.name = editedTask.name;
    if (editedTask.description !== undefined)
      updateData.description = editedTask.description;
    if (editedTask.priority !== undefined)
      updateData.priority = editedTask.priority;
    if (editedTask.status !== undefined) updateData.status = editedTask.status;
    if (editedTask.isCompleted !== undefined)
      updateData.isCompleted = editedTask.isCompleted;

    // Special handling for dueDate to avoid conversion issues
    if (editedTask.dueDate === null) {
      updateData.dueDate = null;
    } else if (editedTask.dueDate instanceof Date) {
      // Convert Date object to ISO string
      updateData.dueDate = editedTask.dueDate.toISOString();
    } else if (typeof editedTask.dueDate === "string") {
      // If it's already a string, validate it
      try {
        const testDate = new Date(editedTask.dueDate);
        if (!isNaN(testDate.getTime())) {
          updateData.dueDate = editedTask.dueDate;
        } else {
          updateData.dueDate = null;
        }
      } catch (e) {
        updateData.dueDate = null;
      }
    }

    console.log("Saving task with data:", JSON.stringify(updateData));
    updateTaskMutation.mutate(updateData);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsEditing(false);
  };

  const getPriorityBadge = (priority: string = task.priority || "medium") => {
    switch (priority) {
      case "high":
        return (
          <Badge variant="destructive" className="flex items-center text-xs">
            <AlertCircle className="mr-1 h-3 w-3" />
            High
          </Badge>
        );
      case "medium":
        return (
          <Badge variant="default" className="flex items-center text-xs">
            <Clock className="mr-1 h-3 w-3" />
            Medium
          </Badge>
        );
      case "low":
        return (
          <Badge variant="outline" className="flex items-center text-xs">
            <Circle className="mr-1 h-3 w-3" />
            Low
          </Badge>
        );
      default:
        return null;
    }
  };

  if (isEditing) {
    return (
      <Card className="bg-white shadow border-2 border-primary/20">
        <CardContent className="p-4 space-y-3">
          <Input
            value={editedTask.name || ""}
            onChange={(e) =>
              setEditedTask({ ...editedTask, name: e.target.value })
            }
            className="font-medium"
            placeholder="Task name"
          />

          <Textarea
            value={editedTask.description || ""}
            onChange={(e) =>
              setEditedTask({ ...editedTask, description: e.target.value })
            }
            className="text-sm min-h-[80px]"
            placeholder="Task description"
          />

          <div className="flex items-center justify-between gap-2">
            <Select
              value={editedTask.priority || "medium"}
              onValueChange={(value) =>
                setEditedTask({ ...editedTask, priority: value })
              }
            >
              <SelectTrigger className="h-8 w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                  {editedTask.dueDate
                    ? format(new Date(editedTask.dueDate), "MMM d")
                    : "Due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="single"
                  selected={
                    editedTask.dueDate
                      ? new Date(editedTask.dueDate)
                      : undefined
                  }
                  onSelect={(date) => {
                    if (date) {
                      // Store the actual Date object instead of a formatted string
                      setEditedTask({
                        ...editedTask,
                        dueDate: date,
                      });
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleCancel}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              className="h-8"
              onClick={handleSave}
              disabled={updateTaskMutation.isPending}
            >
              <Save className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow group"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("taskId", task.id.toString());
      }}
    >
      <CardContent className="p-3 relative">
        <div className="absolute top-2 right-2 flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onOpenTaskDetails(task.id);
            }}
            title="Generate AI Subtasks"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleStartEdit}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="font-medium text-slate-800 mb-2 pr-6">{task.name}</div>

        <div className="text-sm text-slate-500 line-clamp-2 mb-3">
          {task.description || "No description"}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            {getPriorityBadge()}

            {task.assigneeId &&
              (() => {
                const assignee = projectMembers.find(
                  (m) => m.userId === task.assigneeId,
                );
                const assigneeName = assignee
                  ? assignee.userFirstName && assignee.userLastName
                    ? `${assignee.userFirstName} ${assignee.userLastName}`
                    : assignee.userUsername || assignee.userEmail
                  : "Unknown";
                const initials =
                  assignee?.userFirstName && assignee?.userLastName
                    ? `${assignee.userFirstName[0]}${assignee.userLastName[0]}`.toUpperCase()
                    : assignee?.userUsername?.[0]?.toUpperCase() || "?";

                return (
                  <div
                    className="flex items-center gap-1"
                    data-testid={`task-assignee-${task.id}`}
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className="text-xs text-slate-600 max-w-[80px] truncate"
                      title={assigneeName}
                    >
                      {assigneeName}
                    </span>
                  </div>
                );
              })()}
          </div>

          {task.dueDate && (
            <div className="text-xs text-slate-500 flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              {format(new Date(task.dueDate), "MMM d")}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface KanbanBoardProps {
  tasks: Task[];
  projectId: number;
  isLoading?: boolean;
}

export function KanbanBoard({
  tasks,
  projectId,
  isLoading = false,
}: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false);

  // Fetch project members for assignee display
  const { data: projectMembers = [] } = useQuery<ProjectMember[]>({
    queryKey: [`/api/projects/${projectId}/members`],
    enabled: !!projectId,
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => {
      return updateTask(id, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/tasks`],
      });
      toast({
        title: "Task updated",
        description: "Task status has been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update task",
        description:
          error.message || "An error occurred while updating the task",
        variant: "destructive",
      });
    },
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (taskId: number, newStatus: string) => {
    updateTaskMutation.mutate({ id: taskId, status: newStatus });
  };

  const handleOpenTaskDetails = (taskId: number) => {
    setSelectedTaskId(taskId);
    setTaskDetailModalOpen(true);
  };

  const groupedTasks = useMemo(() => {
    return {
      todo: tasks.filter((task) => task.status === "todo"),
      "in-progress": tasks.filter((task) => task.status === "in-progress"),
      done: tasks.filter((task) => task.status === "done"),
    };
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <Skeleton className="h-[500px] rounded-lg" />
        <Skeleton className="h-[500px] rounded-lg" />
        <Skeleton className="h-[500px] rounded-lg" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <KanbanColumn
          title="To Do"
          tasks={groupedTasks.todo}
          status="todo"
          count={groupedTasks.todo.length}
          color="bg-slate-100 text-slate-500"
          icon={<Circle className="h-4 w-4" />}
          projectId={projectId}
          projectMembers={projectMembers}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onOpenTaskDetails={handleOpenTaskDetails}
        />

        <KanbanColumn
          title="In Progress"
          tasks={groupedTasks["in-progress"]}
          status="in-progress"
          count={groupedTasks["in-progress"].length}
          color="bg-blue-100 text-blue-500"
          icon={<ArrowRight className="h-4 w-4" />}
          projectId={projectId}
          projectMembers={projectMembers}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onOpenTaskDetails={handleOpenTaskDetails}
        />

        <KanbanColumn
          title="Done"
          tasks={groupedTasks.done}
          status="done"
          count={groupedTasks.done.length}
          color="bg-green-100 text-green-500"
          icon={<CheckCircle2 className="h-4 w-4" />}
          projectId={projectId}
          projectMembers={projectMembers}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onOpenTaskDetails={handleOpenTaskDetails}
        />
      </div>

      {/* Task Detail Panel */}
      {selectedTaskId && taskDetailModalOpen && (
        <TaskDetailsPanel
          task={tasks.find((t) => t.id === selectedTaskId)!}
          projectId={projectId}
          onClose={() => {
            setSelectedTaskId(null);
            setTaskDetailModalOpen(false);
          }}
        />
      )}
    </>
  );
}
