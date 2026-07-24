import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import TaskDetails from "./TaskDetails";
import { Loader2 } from "lucide-react";

interface TaskDetailModalProps {
  taskId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdate?: () => void;
}

export default function TaskDetailModal({ taskId, open, onOpenChange, onTaskUpdate }: TaskDetailModalProps) {
  // Fetch task details
  const { data: task, isLoading, error } = useQuery({
    queryKey: ['/api/tasks', taskId],
    enabled: !!taskId && open
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Task Details</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading task details...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-destructive">Failed to load task details</p>
            </div>
          ) : task && taskId ? (
            <TaskDetails 
              taskId={taskId} 
              task={task} 
              onTaskUpdate={onTaskUpdate}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No task selected</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}