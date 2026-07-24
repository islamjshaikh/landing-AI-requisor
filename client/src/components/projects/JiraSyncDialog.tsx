import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  AlertCircle,
  RefreshCcw,
  Plus,
  ExternalLink,
  Loader2,
  Upload,
  Download,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

interface JiraSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectName: string;
}

interface JiraIntegration {
  id: number;
  provider: string;
  isConnected: boolean;
  additionalData?: {
    cloudId?: string;
    projects?: Array<{ id: string; key: string; name: string }>;
    issueTypes?: Array<{ id: string; name: string }>;
    statuses?: Array<{ id: string; name: string; statusCategory: string }>;
  };
}

export function JiraSyncDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: JiraSyncDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [selectedJiraProject, setSelectedJiraProject] = useState("");

  // Create issue form state
  const [issueName, setIssueName] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [issueType, setIssueType] = useState("Task");
  const [issuePriority, setIssuePriority] = useState("medium");
  const [issueDueDate, setIssueDueDate] = useState<Date | undefined>(undefined);
  const [issueAssignee, setIssueAssignee] = useState("");
  const [issueStatus, setIssueStatus] = useState("todo");
  const [parentIssueKey, setParentIssueKey] = useState("");

  // Check if JIRA is connected
  const { data: integrations = [], isLoading: integrationsLoading } = useQuery({
    queryKey: ["/api/integrations"],
    enabled: open,
  });

  const jiraIntegration = integrations.find(
    (i: JiraIntegration) => i.provider === "jira",
  ) as JiraIntegration | undefined;
  const isConnected = jiraIntegration?.isConnected || false;

  // Handle OAuth connection
  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await fetch("/api/integrations/auth/jira");
      if (!response.ok) {
        throw new Error("Failed to get authorization URL");
      }

      const data = await response.json();
      if (data.authUrl) {
        const authWindow = window.open(
          data.authUrl,
          "oauth",
          "width=600,height=700,scrollbars=yes,resizable=yes",
        );

        const checkClosed = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkClosed);
            queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
            setConnecting(false);
          }
        }, 1000);
      } else {
        throw new Error("No authorization URL received");
      }
    } catch (error) {
      console.error("OAuth connection error:", error);
      toast({
        title: "Connection failed",
        description:
          error instanceof Error ? error.message : "Failed to connect to JIRA",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  // Pull tasks from JIRA
  const pullTasksMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(
        `/api/integrations/projects/${projectId}/pull-tasks`,
        {
          method: "POST",
        },
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "tasks"],
      });
      toast({
        title: "Tasks synced",
        description: `Successfully imported ${data.tasks?.length || 0} tasks from JIRA`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync tasks from JIRA",
        variant: "destructive",
      });
    },
  });

  // Push project to JIRA
  const pushProjectMutation = useMutation({
    mutationFn: async () => {
      if (!jiraIntegration?.id) {
        throw new Error(
          "JIRA integration not found. Please reconnect to JIRA.",
        );
      }
      if (!selectedJiraProject) {
        throw new Error("Please select a Jira project");
      }
      return await apiRequest(`/api/integrations/projects/${projectId}/push`, {
        method: "POST",
        body: JSON.stringify({
          integrationId: jiraIntegration.id,
          jiraProjectKey: selectedJiraProject,
        }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({
        title: "Issues created",
        description: data.message || "Successfully created issues in JIRA",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Creation failed",
        description: error.message || "Failed to create issues in JIRA",
        variant: "destructive",
      });
    },
  });

  // Create individual issue in JIRA
  const createIssueMutation = useMutation({
    mutationFn: async () => {
      const taskData = {
        name: issueName,
        description: issueDescription,
        projectId: projectId,
        issueType: issueType,
        priority: issuePriority,
        status: issueStatus,
        dueDate: issueDueDate?.toISOString(),
        assignee: issueAssignee || undefined,
        parentIssueKey: parentIssueKey || undefined,
      };

      return await apiRequest("/api/integrations/tasks/create-jira-issue", {
        method: "POST",
        body: JSON.stringify(taskData),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "tasks"],
      });
      toast({
        title: "Issue created",
        description: `Successfully created ${issueType} in JIRA`,
      });
      // Reset form
      setIssueName("");
      setIssueDescription("");
      setIssueType("Task");
      setIssuePriority("medium");
      setIssueDueDate(undefined);
      setIssueAssignee("");
      setIssueStatus("todo");
      setParentIssueKey("");
    },
    onError: (error: any) => {
      toast({
        title: "Creation failed",
        description: error.message || "Failed to create issue in JIRA",
        variant: "destructive",
      });
    },
  });

  const handleCreateIssue = () => {
    if (!issueName.trim()) {
      toast({
        title: "Validation error",
        description: "Issue name is required",
        variant: "destructive",
      });
      return;
    }
    createIssueMutation.mutate();
  };

  if (integrationsLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">JIRA Integration</DialogTitle>
          <DialogDescription>
            Sync {projectName} with Atlassian JIRA for advanced issue tracking
            and agile project management
          </DialogDescription>
        </DialogHeader>

        {!isConnected ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                JIRA Not Connected
              </CardTitle>
              <CardDescription>
                Connect your JIRA workspace to enable synchronization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">
                  Secure OAuth Connection
                </h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Multi-tenant OAuth integration</li>
                  <li>Connect your personal JIRA workspace</li>
                  <li>No manual API keys required</li>
                  <li>Automatic token refresh</li>
                  <li>Supports multiple JIRA workspaces</li>
                </ul>
              </div>
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full"
                size="lg"
              >
                {connecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening JIRA Authorization...
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Connect to JIRA
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Connected to JIRA
                </CardTitle>
                <CardDescription>
                  Your JIRA workspace is connected and ready for synchronization
                </CardDescription>
              </CardHeader>
            </Card>

            <Tabs defaultValue="sync" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                {/* <TabsTrigger value="create">Create Issue</TabsTrigger> */}
                <TabsTrigger value="project">Project</TabsTrigger>
                <TabsTrigger value="sync">Sync</TabsTrigger>
              </TabsList>

              <TabsContent value="sync" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Import Tasks from JIRA</CardTitle>
                    <CardDescription>
                      Pull issues from JIRA and sync them to this project
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => pullTasksMutation.mutate()}
                      disabled={pullTasksMutation.isPending}
                      className="w-full"
                    >
                      {pullTasksMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Import Tasks from JIRA
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="create" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Create JIRA Issue</CardTitle>
                    <CardDescription>
                      Create Epic, Story, Task, or Sub-Task in JIRA
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="issue-type">Issue Type</Label>
                      <Select value={issueType} onValueChange={setIssueType}>
                        <SelectTrigger
                          id="issue-type"
                          data-testid="select-jira-issue-type"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Epic">Epic</SelectItem>
                          <SelectItem value="Story">Story</SelectItem>
                          <SelectItem value="Task">Task</SelectItem>
                          <SelectItem value="Sub-task">Sub-Task</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="issue-name">Summary *</Label>
                      <Input
                        id="issue-name"
                        placeholder="Enter issue summary"
                        value={issueName}
                        onChange={(e) => setIssueName(e.target.value)}
                        data-testid="input-jira-issue-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="issue-description">Description</Label>
                      <Textarea
                        id="issue-description"
                        placeholder="Enter issue description"
                        value={issueDescription}
                        onChange={(e) => setIssueDescription(e.target.value)}
                        rows={4}
                        data-testid="textarea-jira-issue-description"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="issue-priority">Priority</Label>
                        <Select
                          value={issuePriority}
                          onValueChange={setIssuePriority}
                        >
                          <SelectTrigger
                            id="issue-priority"
                            data-testid="select-jira-priority"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="issue-status">Status</Label>
                        <Select
                          value={issueStatus}
                          onValueChange={setIssueStatus}
                        >
                          <SelectTrigger
                            id="issue-status"
                            data-testid="select-jira-status"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in-progress">
                              In Progress
                            </SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Due Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            data-testid="button-jira-due-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {issueDueDate
                              ? format(issueDueDate, "PPP")
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={issueDueDate}
                            onSelect={setIssueDueDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {issueType === "Sub-task" && (
                      <div className="space-y-2">
                        <Label htmlFor="parent-issue-key">
                          Parent Issue Key
                        </Label>
                        <Input
                          id="parent-issue-key"
                          placeholder="e.g., PROJ-123"
                          value={parentIssueKey}
                          onChange={(e) => setParentIssueKey(e.target.value)}
                          data-testid="input-jira-parent-key"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="issue-assignee">Assignee (Email)</Label>
                      <Input
                        id="issue-assignee"
                        placeholder="assignee@example.com"
                        value={issueAssignee}
                        onChange={(e) => setIssueAssignee(e.target.value)}
                        data-testid="input-jira-assignee"
                      />
                    </div>

                    <Separator />

                    <Button
                      onClick={handleCreateIssue}
                      disabled={createIssueMutation.isPending}
                      className="w-full"
                      data-testid="button-create-jira-issue"
                    >
                      {createIssueMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Create {issueType} in JIRA
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="project" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Push Tasks to JIRA</CardTitle>
                    <CardDescription>
                      Create tasks from this project as issues in an existing
                      JIRA project
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="jira-project-select">
                        Select JIRA Project
                      </Label>
                      <Select
                        value={selectedJiraProject}
                        onValueChange={setSelectedJiraProject}
                      >
                        <SelectTrigger
                          id="jira-project-select"
                          data-testid="select-jira-project"
                        >
                          <SelectValue placeholder="Choose a JIRA project..." />
                        </SelectTrigger>
                        <SelectContent>
                          {jiraIntegration?.additionalData?.projects?.map(
                            (project) => (
                              <SelectItem key={project.key} value={project.key}>
                                {project.name} ({project.key})
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      {jiraIntegration?.additionalData?.projects?.length ===
                        0 && (
                        <p className="text-sm text-muted-foreground">
                          No JIRA projects found. Please create a project in
                          JIRA first.
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={() => pushProjectMutation.mutate()}
                      disabled={
                        pushProjectMutation.isPending || !selectedJiraProject
                      }
                      className="w-full"
                      data-testid="button-push-to-jira"
                    >
                      {pushProjectMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Issues...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Create{" "}
                          {jiraIntegration?.additionalData?.projects?.find(
                            (p) => p.key === selectedJiraProject,
                          )
                            ? `Issues in ${selectedJiraProject}`
                            : "Issues in JIRA"}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
