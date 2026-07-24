import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IntegrationProvider } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { syncTaskWithProvider, syncTaskStatus, pullTasksFromProvider } from "@/lib/api";
import { 
  RefreshCcw, 
  ExternalLink, 
  ChevronDown, 
  Calendar 
} from "lucide-react";
import { SiJira, SiAsana, SiNotion, SiGoogle } from "react-icons/si";

interface SyncActionsProps {
  taskId?: number;
  projectId: number;
  source?: string;
  externalId?: string;
}

export function SyncActions({
  taskId,
  projectId,
  source,
  externalId,
}: SyncActionsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isStatusSyncDialogOpen, setIsStatusSyncDialogOpen] = useState(false);
  const [statusToSync, setStatusToSync] = useState("");

  // Mutation for syncing a task with an external provider
  const syncTaskMutation = useMutation({
    mutationFn: ({ provider }: { provider: IntegrationProvider }) => {
      if (!taskId) return Promise.resolve({ success: false, message: "No task ID provided" });
      return syncTaskWithProvider(taskId, provider);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Task synced",
          description: data.message || "Task was synchronized with external provider",
        });
      } else {
        toast({
          title: "Sync failed",
          description: data.message || "Failed to sync task with external provider",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync task with external provider",
        variant: "destructive",
      });
    },
  });

  // Mutation for syncing a task's status
  const syncStatusMutation = useMutation({
    mutationFn: ({ status }: { status: string }) => {
      if (!taskId) return Promise.resolve({ success: false, message: "No task ID provided" });
      return syncTaskStatus(taskId, status);
    },
    onSuccess: (data) => {
      setIsStatusSyncDialogOpen(false);
      if (data.success) {
        toast({
          title: "Status synced",
          description: data.message || "Task status was synchronized",
        });
        // Invalidate the tasks cache to refresh the data
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
      } else {
        toast({
          title: "Status sync failed",
          description: data.message || "Failed to sync task status",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setIsStatusSyncDialogOpen(false);
      toast({
        title: "Status sync failed",
        description: error.message || "Failed to sync task status",
        variant: "destructive",
      });
    },
  });

  // Mutation for pulling tasks from an external provider
  const pullTasksMutation = useMutation({
    mutationFn: ({ provider }: { provider: IntegrationProvider }) => {
      return pullTasksFromProvider(provider, projectId);
    },
    onSuccess: (data) => {
      const tasksCount = data.details?.tasks?.length || 0;
      toast({
        title: "Tasks pulled",
        description: data.message || `Successfully pulled ${tasksCount} tasks from provider`,
      });
      // Invalidate the tasks cache to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
    },
    onError: (error: any) => {
      toast({
        title: "Pull failed",
        description: error.message || "Failed to pull tasks from external provider",
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

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "jira":
        return <SiJira className="h-4 w-4" />;
      case "asana":
        return <SiAsana className="h-4 w-4" />;
      case "monday":
        return <SiNotion className="h-4 w-4" />;
      case "google_docs":
        return <SiGoogle className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  // Task-specific actions
  if (taskId) {
    if (isExternalTask) {
      return (
        <>
          <Button
            size="sm"
            variant="outline"
            className="ml-2"
            onClick={() => handleStatusSync("in-progress")}
          >
            <RefreshCcw className="h-4 w-4 mr-1" />
            Sync Status
          </Button>

          <Dialog open={isStatusSyncDialogOpen} onOpenChange={setIsStatusSyncDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sync Task Status</DialogTitle>
                <DialogDescription>
                  This will sync the current task status with the external provider ({source}).
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsStatusSyncDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={confirmStatusSync}>
                  Sync Status
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      );
    }

    // For local-only tasks, offer to push to external providers
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="ml-2">
            <ExternalLink className="h-4 w-4 mr-1" />
            Sync with <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleSyncWithProvider(IntegrationProvider.Jira)}>
            <SiJira className="h-4 w-4 mr-2" /> Jira
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSyncWithProvider(IntegrationProvider.Asana)}>
            <SiAsana className="h-4 w-4 mr-2" /> Asana
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSyncWithProvider(IntegrationProvider.Monday)}>
            <SiNotion className="h-4 w-4 mr-2" /> Monday.com
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Project-wide sync actions
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCcw className="h-4 w-4 mr-1" />
          Sync <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handlePullTasks(IntegrationProvider.Jira)}>
          <SiJira className="h-4 w-4 mr-2" /> Pull from Jira
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handlePullTasks(IntegrationProvider.Asana)}>
          <SiAsana className="h-4 w-4 mr-2" /> Pull from Asana
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handlePullTasks(IntegrationProvider.Monday)}>
          <SiNotion className="h-4 w-4 mr-2" /> Pull from Monday.com
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}