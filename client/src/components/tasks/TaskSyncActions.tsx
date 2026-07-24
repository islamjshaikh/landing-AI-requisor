import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  syncTaskWithProvider,
  syncTaskStatus,
  pullTasksFromProvider,
} from "@/lib/api";
import IntegrationProvider from "@/types/integration";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Cpu,
  ArrowDownUp,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Check,
  AlertCircle,
} from "lucide-react";

interface TaskSyncActionsProps {
  taskId: number;
  projectId: number;
  currentStatus: string;
  source?: string;
  externalId?: string;
}

export function TaskSyncActions({
  taskId,
  projectId,
  currentStatus,
  source,
  externalId,
}: TaskSyncActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isStatusSyncDialogOpen, setIsStatusSyncDialogOpen] = useState(false);
  const [statusToSync, setStatusToSync] = useState("");

  // Mutation for syncing a task with an external provider
  const syncTaskMutation = useMutation({
    mutationFn: ({ provider }: { provider: IntegrationProvider }) => {
      return syncTaskWithProvider(taskId, provider);
    },
    onSuccess: (data) => {
      toast({
        title: "Task synchronized",
        description:
          data.message ||
          "Task was successfully synchronized with external provider",
      });
      // Invalidate the tasks cache to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "tasks"],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description:
          error.message || "Failed to synchronize task with external provider",
        variant: "destructive",
      });
    },
  });

  // Mutation for syncing task status
  const syncStatusMutation = useMutation({
    mutationFn: ({ status }: { status: string }) => {
      return syncTaskStatus(taskId, status, IntegrationProvider.Smartsheet);
    },
    onSuccess: (data) => {
      toast({
        title: "Status synchronized",
        description:
          data.message || "Task status was successfully synchronized",
      });
      // Invalidate the tasks cache to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "tasks"],
      });
      setIsStatusSyncDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Status sync failed",
        description: error.message || "Failed to synchronize task status",
        variant: "destructive",
      });
    },
  });

  // Mutation for pulling tasks from an external provider
  const pullTasksMutation = useMutation({
    mutationFn: ({ provider }: { provider: IntegrationProvider }) => {
      return pullTasksFromProvider(projectId, provider);
    },
    onSuccess: (data) => {
      const tasksCount = data.details?.tasks?.length || 0;
      toast({
        title: "Tasks pulled",
        description:
          data.message ||
          `Successfully pulled ${tasksCount} tasks from provider`,
      });
      // Invalidate the tasks cache to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "tasks"],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Pull failed",
        description:
          error.message || "Failed to pull tasks from external provider",
        variant: "destructive",
      });
    },
  });

  const handleSyncWithProvider = (provider: IntegrationProvider) => {
    syncTaskMutation.mutate({ provider });
  };

  const handleStatusSync = (status: string) => {
    setStatusToSync(status);
    setIsStatusSyncDialogOpen(true);
  };

  const confirmStatusSync = () => {
    syncStatusMutation.mutate({ status: statusToSync });
  };

  const handlePullTasks = (provider: IntegrationProvider) => {
    pullTasksMutation.mutate({ provider });
  };

  // If task is already from an external source, show sync status button
  const isExternalTask = !!source && !!externalId;

  return (
    <div className="flex items-center">
      {isExternalTask ? (
        // Task is from an external source, show source info and status sync
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1 bg-slate-100 py-1 px-2 rounded-md">
            <Cpu className="h-3 w-3" />
            {source}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ArrowDownUp className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sync Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleStatusSync("todo")}>
                <ArrowDown className="mr-2 h-4 w-4" /> Mark as To Do
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusSync("in-progress")}>
                <ArrowUp className="mr-2 h-4 w-4" /> Mark as In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusSync("done")}>
                <Check className="mr-2 h-4 w-4" /> Mark as Done
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        // Task is not yet synced, show options to sync with providers
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sync Options</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* <DropdownMenuItem
              onClick={() =>
                handleSyncWithProvider(IntegrationProvider.Smartsheet)
              }
            >
              Sync with Smartsheet
            </DropdownMenuItem> */}
            <DropdownMenuItem
              onClick={() => handleSyncWithProvider(IntegrationProvider.Jira)}
            >
              Sync with Jira
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleSyncWithProvider(IntegrationProvider.Asana)}
            >
              Sync with Asana
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                handleSyncWithProvider(IntegrationProvider.GoogleDocs)
              }
            >
              Sync with Google Docs
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleSyncWithProvider(IntegrationProvider.Monday)}
            >
              Sync with Monday.com
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Pull Tasks</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handlePullTasks(IntegrationProvider.Smartsheet)}
            >
              Pull from Smartsheet
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handlePullTasks(IntegrationProvider.Jira)}
            >
              Pull from Jira
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Status Sync Confirmation Dialog */}
      <AlertDialog
        open={isStatusSyncDialogOpen}
        onOpenChange={setIsStatusSyncDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Synchronize Task Status</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the task status in both Requisor and the external
              system.
              <br />
              <br />
              Current status: <strong>{currentStatus}</strong>
              <br />
              New status: <strong>{statusToSync}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusSync}>
              {syncStatusMutation.isPending ? "Syncing..." : "Sync Status"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
