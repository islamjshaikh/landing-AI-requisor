import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Task } from "@shared/schema";
import { getProjectTasks, updateTask, deleteTask } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskSyncActions } from "./TaskSyncActions";
import { SubtaskList } from "./SubtaskList";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import {
  CheckCircle2,
  Circle,
  Clock,
  Edit,
  Save,
  X,
  Calendar as CalendarIcon,
  Flag,
  Trash2,
} from "lucide-react";

interface TaskListProps {
  projectId: number;
}

// Safe date formatter that handles various date formats
const formatDate = (dateValue: any): string => {
  if (!dateValue) return "Not set";

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return "Invalid date";
    return format(date, "MMM dd, yyyy");
  } catch (e) {
    console.error("Error formatting date:", e);
    return "Invalid date";
  }
};

// Safe date converter that always returns a valid ISO string or null
const safeConvertToISOString = (dateValue: any): string | null => {
  if (!dateValue) return null;

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch (e) {
    console.warn("Failed to convert date:", e);
    return null;
  }
};

export function TaskList({ projectId }: TaskListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<{
    name: string;
    description: string;
    priority: string;
    status: string;
    dueDate: string; // Always store as ISO string
  } | null>(null);

  // Fetch tasks
  const {
    data: tasks,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/projects", projectId, "tasks"],
    queryFn: () => getProjectTasks(projectId),
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "tasks"],
      });
      toast({
        title: "Task deleted",
        description: "Task has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete task",
        description: error?.message || "There was an error deleting the task",
        variant: "destructive",
      });
    },
  });

  // Update task mutation with proper error handling
  const updateTaskMutation = useMutation({
    mutationFn: (data: { id: number; updates: any }) => {
      console.log("Updating task with safe data:", data.updates);
      return updateTask(data.id, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "tasks"],
      });
      toast({
        title: "Task updated",
        description: "Task has been updated successfully",
      });
      setEditingTaskId(null);
      setEditingData(null);
    },
    onError: (error: any) => {
      console.error("Update task error:", error);
      toast({
        title: "Failed to update task",
        description: error.message || "There was an error updating the task",
        variant: "destructive",
      });
    },
  });

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingData({
      name: task.name || "",
      description: task.description || "",
      priority: task.priority || "medium",
      status: task.status || "todo",
      dueDate: task.dueDate ? safeConvertToISOString(task.dueDate) || "" : "",
    });
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditingData(null);
  };

  const saveTask = () => {
    if (!editingTaskId || !editingData) return;

    // Build update payload with only changed fields
    const updatePayload: any = {
      name: editingData.name,
      description: editingData.description,
      priority: editingData.priority,
      status: editingData.status,
    };

    // Handle due date safely
    if (editingData.dueDate) {
      const isoDate = safeConvertToISOString(editingData.dueDate);
      updatePayload.dueDate = isoDate;
    } else {
      updatePayload.dueDate = null;
    }

    console.log("Final update payload:", updatePayload);

    updateTaskMutation.mutate({
      id: editingTaskId,
      updates: updatePayload,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in-progress":
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return (
          <Badge variant="destructive" className="text-xs">
            <Flag className="mr-1 h-3 w-3" />
            High
          </Badge>
        );
      case "medium":
        return (
          <Badge variant="default" className="text-xs">
            <Clock className="mr-1 h-3 w-3" />
            Medium
          </Badge>
        );
      case "low":
        return (
          <Badge variant="secondary" className="text-xs">
            Low
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            Normal
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          Error loading tasks: {error.message}
        </div>
      </Card>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          No tasks found. Create your first task to get started!
        </div>
      </Card>
    );
  }

  const parentIdsWithChildren = new Set(
    tasks.filter((t) => t.parentTaskId !== null).map((t) => t.parentTaskId)
  );
  const regularTasks = tasks.filter(
    (task) => !parentIdsWithChildren.has(task.id)
  );

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Project Tasks</h3>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Story Points</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regularTasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell>{getStatusIcon(task.status || "todo")}</TableCell>

                <TableCell>
                  {editingTaskId === task.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editingData?.name || ""}
                        onChange={(e) =>
                          setEditingData((prev) =>
                            prev ? { ...prev, name: e.target.value } : null,
                          )
                        }
                        placeholder="Task name"
                        className="font-medium"
                      />
                      <Textarea
                        value={editingData?.description || ""}
                        onChange={(e) =>
                          setEditingData((prev) =>
                            prev
                              ? { ...prev, description: e.target.value }
                              : null,
                          )
                        }
                        placeholder="Task description"
                        className="text-sm"
                        rows={2}
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium">{task.name}</div>
                      <div className="text-sm text-gray-500">
                        {task.description || "No description"}
                      </div>
                    </div>
                  )}
                </TableCell>

                <TableCell>
                  {editingTaskId === task.id ? (
                    <Select
                      value={editingData?.priority || "medium"}
                      onValueChange={(value) =>
                        setEditingData((prev) =>
                          prev ? { ...prev, priority: value } : null,
                        )
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    getPriorityBadge(task.priority || "medium")
                  )}
                </TableCell>

                <TableCell>
                  <div className="text-sm text-center">
                    {task.storyPoints != null ? (
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200"
                      >
                        {task.storyPoints} SP
                      </Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  {editingTaskId === task.id ? (
                    <Input
                      type="date"
                      value={
                        editingData?.dueDate
                          ? editingData.dueDate.split("T")[0]
                          : ""
                      }
                      onChange={(e) => {
                        const dateValue = e.target.value;
                        const isoString = dateValue
                          ? safeConvertToISOString(dateValue) || ""
                          : "";
                        setEditingData((prev) =>
                          prev ? { ...prev, dueDate: isoString } : null,
                        );
                      }}
                      className="w-36"
                    />
                  ) : (
                    <div className="text-sm">{formatDate(task.dueDate)}</div>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  {editingTaskId === task.id ? (
                    <div className="flex justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEditing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveTask}
                        disabled={updateTaskMutation.isPending}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEditing(task)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (window.confirm(`Delete task "${task.name}"?`)) {
                            deleteTaskMutation.mutate(task.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <TaskSyncActions
                        taskId={task.id}
                        projectId={projectId}
                        currentStatus={task.status || "pending"}
                      />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
