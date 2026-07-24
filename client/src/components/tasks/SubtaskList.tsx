import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, Circle, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Task {
  id: number;
  name: string;
  status: string;
  isCompleted: boolean;
  assigneeId?: string;
  dueDate?: string;
  priority?: string;
  isSubtask: boolean;
  parentTaskId?: number;
  completedSubtasks: number;
  totalSubtasks: number;
  progress: number;
}

interface SubtaskListProps {
  parentTask: Task;
  projectId: number;
}

export function SubtaskList({ parentTask, projectId }: SubtaskListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newSubtaskName, setNewSubtaskName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch subtasks
  const { data: subtasks = [], isLoading } = useQuery({
    queryKey: [`/api/tasks/${parentTask.id}/subtasks`],
    enabled: isExpanded
  });

  // Create subtask mutation
  const createSubtaskMutation = useMutation({
    mutationFn: async (subtaskData: { name: string }) => {
      const response = await fetch(`/api/tasks/${parentTask.id}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subtaskData)
      });
      if (!response.ok) throw new Error('Failed to create subtask');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${parentTask.id}/subtasks`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
      setNewSubtaskName("");
      setIsAdding(false);
      toast({
        title: "Subtask created",
        description: "The subtask has been added successfully."
      });
    },
    onError: () => {
      toast({
        title: "Error creating subtask",
        description: "There was a problem creating the subtask.",
        variant: "destructive"
      });
    }
  });

  // Update subtask status mutation
  const updateSubtaskMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/subtasks/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to update subtask');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${parentTask.id}/subtasks`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
      toast({
        title: "Subtask updated",
        description: "The subtask status has been updated."
      });
    },
    onError: () => {
      toast({
        title: "Error updating subtask",
        description: "There was a problem updating the subtask.",
        variant: "destructive"
      });
    }
  });

  const handleCreateSubtask = () => {
    if (newSubtaskName.trim()) {
      createSubtaskMutation.mutate({ name: newSubtaskName.trim() });
    }
  };

  const handleToggleSubtask = (subtask: Task) => {
    const newStatus = subtask.status === 'done' ? 'todo' : 'done';
    updateSubtaskMutation.mutate({ id: subtask.id, status: newStatus });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateSubtask();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewSubtaskName("");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="px-4 py-2 bg-gray-50 border-l-4 border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium p-0 h-auto hover:bg-transparent"
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="text-muted-foreground">
            Subtasks {parentTask.totalSubtasks > 0 && `(${parentTask.completedSubtasks}/${parentTask.totalSubtasks})`}
          </span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 text-xs h-auto p-1 hover:bg-gray-200"
        >
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </div>

      {/* Compact progress bar */}
      {parentTask.totalSubtasks > 0 && (
        <div className="mb-3">
          <Progress value={parentTask.progress} className="h-1" />
        </div>
      )}

      {/* Quick add subtask input */}
      {isAdding && (
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Subtask name..."
            value={newSubtaskName}
            onChange={(e) => setNewSubtaskName(e.target.value)}
            onKeyDown={handleKeyPress}
            className="flex-1 h-8 text-sm"
            autoFocus
          />
          <Button
            size="sm"
            onClick={handleCreateSubtask}
            disabled={!newSubtaskName.trim() || createSubtaskMutation.isPending}
            className="h-8 px-3 text-xs"
          >
            Add
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsAdding(false);
              setNewSubtaskName("");
            }}
            className="h-8 px-2 text-xs"
          >
            ×
          </Button>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-1">
          {isLoading ? (
            <div className="text-xs text-muted-foreground py-2">Loading...</div>
          ) : subtasks.length === 0 && !isAdding ? (
            <div className="text-xs text-muted-foreground py-2">
              No subtasks yet
            </div>
          ) : (
            <div className="space-y-1">
              {subtasks.map((subtask: Task) => (
                <div
                  key={subtask.id}
                  className={cn(
                    "flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-100 transition-colors text-sm",
                    subtask.status === 'done' && "opacity-60"
                  )}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleSubtask(subtask)}
                    className="h-6 w-6 p-0 hover:bg-gray-200"
                    disabled={updateSubtaskMutation.isPending}
                  >
                    {subtask.status === 'done' ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Circle className="h-3 w-3 text-gray-400" />
                    )}
                  </Button>
                  
                  <span className={cn(
                    "flex-1 text-sm",
                    subtask.status === 'done' && "line-through text-muted-foreground"
                  )}>
                    {subtask.name}
                  </span>
                  
                  {subtask.status === 'done' && (
                    <Badge variant="secondary" className="text-xs px-1 py-0">
                      Done
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}