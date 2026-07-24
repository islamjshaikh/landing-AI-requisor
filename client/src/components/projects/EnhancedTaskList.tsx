import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Check,
  Circle,
  Clock,
  Calendar as CalendarIcon,
  MoreHorizontal,
  Trash2,
  User,
  AlertCircle,
  Loader2,
  Sparkles,
  GitBranch,
  Bot,
  ExternalLink,
  X,
  Copy,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TaskDetailsPanel } from "@/components/tasks/TaskDetailsPanel";
import { TaskToolRecommendations } from "@/components/tasks/TaskToolRecommendations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Task {
  id: number;
  name: string;
  description: string | null;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: string | null;
  assigneeId: string | null;
  projectId: number;
  createdAt: string;
  totalSubtasks?: number;
  completedSubtasks?: number;
  storyPoints?: number | null;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  workload: number;
  capacity: number;
  skills: string[];
}

interface EnhancedTaskListProps {
  projectId: number;
  tasks: Task[];
  onTaskUpdate: () => void;
}

const statusIcons = { todo: Circle, "in-progress": Clock, done: Check };
const priorityColors = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

export function EnhancedTaskList({
  projectId,
  tasks,
  onTaskUpdate,
}: EnhancedTaskListProps) {
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState(""); // 🔍 NEW
  const [dueSort, setDueSort] = useState<"none" | "asc" | "desc">("none"); // 📅 NEW
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false);
  const [aiToolsModalOpen, setAiToolsModalOpen] = useState(false);
  const [selectedTaskForTools, setSelectedTaskForTools] = useState<
    number | null
  >(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set()); // ✅ for bulk delete

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch project info (to detect agile)
  const { data: project } = useQuery<{ source?: string }>({
    queryKey: [`/api/projects/${projectId}`],
  });
  const isAgileProject = project?.source === "agile-planning";

  // Fetch team members
  const { data: projectMembers = [] } = useQuery({
    queryKey: [`/api/projects/${projectId}/members`],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch project members");
      return res.json();
    },
  });

  const teamMembers: TeamMember[] = projectMembers.map((m: any) => ({
    id: m.userId,
    name:
      m.userFirstName && m.userLastName
        ? `${m.userFirstName} ${m.userLastName}`
        : m.userEmail,
    email: m.userEmail || "",
    workload: 0,
    capacity: 40,
    skills: [],
  }));

  // NEW: quick map for assignee lookup during search
  const assigneeNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const tm of teamMembers) m.set(String(tm.id), tm.name || "");
    return m;
  }, [teamMembers]);

  // --- Mutations ---
  const updateTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      updates,
    }: {
      taskId: number;
      updates: Partial<Task>;
    }) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/tasks`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}`],
      });
      onTaskUpdate();
      setEditingTaskId(null);
      setEditingField(null);
      toast({ title: "Task updated" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/tasks`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}`],
      });
      onTaskUpdate();
      toast({ title: "Task deleted" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      // 🔥 Delete in parallel (NOT sequential)
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/tasks/${id}`, {
            method: "DELETE",
            credentials: "include",
          }),
        ),
      );
    },

    // 🚀 OPTIMISTIC UPDATE
    onMutate: async (ids) => {
      await queryClient.cancelQueries({
        queryKey: [`/api/projects/${projectId}/tasks`],
      });

      const previousTasks = queryClient.getQueryData<any[]>([
        `/api/projects/${projectId}/tasks`,
      ]);

      // Remove tasks immediately from UI
      queryClient.setQueryData(
        [`/api/projects/${projectId}/tasks`],
        (old: any[] | undefined) =>
          old?.filter((task) => !ids.includes(task.id)),
      );

      setSelectedIds(new Set());

      return { previousTasks };
    },

    // 🔙 Rollback if error
    onError: (_err, _ids, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(
          [`/api/projects/${projectId}/tasks`],
          context.previousTasks,
        );
      }

      toast({
        title: "Failed to delete tasks",
        variant: "destructive",
      });
    },

    // 🔄 Sync with server
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/tasks`],
      });

      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}`],
      });

      onTaskUpdate();
    },

    onSuccess: () => {
      toast({ title: "Tasks deleted" });
    },
  });

  // --- Filtering, Searching, Sorting ---
  // CHANGED: Filter + Search + Sort all inside useMemo so it updates per keystroke
  const { filteredTasks, sortedTasks } = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = tasks.filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority)
        return false;

      if (filterAssignee !== "all") {
        if (filterAssignee === "unassigned" && t.assigneeId !== null)
          return false;
        if (filterAssignee !== "unassigned" && t.assigneeId !== filterAssignee)
          return false;
      }

      if (q) {
        const nameMatch = t.name.toLowerCase().includes(q);
        const descMatch = (t.description || "").toLowerCase().includes(q);
        const assigneeName =
          assigneeNameById.get(String(t.assigneeId ?? "")) || "";
        const assigneeMatch = assigneeName.toLowerCase().includes(q);
        if (!nameMatch && !descMatch && !assigneeMatch) return false;
      }

      return true;
    });

    let sorted = filtered;
    if (dueSort !== "none") {
      const toTime = (d: string | null) => (d ? new Date(d).getTime() : NaN);
      sorted = [...filtered].sort((a, b) => {
        const ta = toTime(a.dueDate);
        const tb = toTime(b.dueDate);
        const aValid = Number.isFinite(ta);
        const bValid = Number.isFinite(tb);

        if (!aValid && !bValid) return 0;
        if (!aValid) return dueSort === "asc" ? 1 : -1; // nulls last in asc, first in desc
        if (!bValid) return dueSort === "asc" ? -1 : 1;

        return dueSort === "asc" ? ta - tb : tb - ta;
      });
    }

    // Debug: see it react on each keystroke
    // console.log("[EnhancedTaskList] search=", q, "filtered:", filtered.length);

    return { filteredTasks: filtered, sortedTasks: sorted };
  }, [
    tasks,
    searchQuery,
    filterStatus,
    filterPriority,
    filterAssignee,
    dueSort,
    assigneeNameById,
  ]);

  const visibleIds = sortedTasks.map((t) => t.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    visibleIds.some((id) => selectedIds.has(id)) && !allVisibleSelected;

  const toggleOne = (id: number, checked: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });

  const toggleAllVisible = (checked: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked
        ? visibleIds.forEach((id) => next.add(id))
        : visibleIds.forEach((id) => next.delete(id));
      return next;
    });

  const copyTableToClipboard = () => {
    const headers = ["Status", "Task", "Priority", "Assignee", ...(isAgileProject ? ["Story Points"] : []), "Due Date"];
    const rows = sortedTasks.map((task) => {
      const assigneeName = assigneeNameById.get(String(task.assigneeId ?? "")) || "Unassigned";
      const dueDate = task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "";
      return [
        task.status,
        task.name,
        task.priority,
        assigneeName,
        ...(isAgileProject ? [task.storyPoints?.toString() ?? ""] : []),
        dueDate,
      ];
    });

    const tsv = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");
    navigator.clipboard.writeText(tsv).then(() => {
      toast({ title: "Copied to clipboard", description: "Paste into Excel or Google Sheets" });
    }).catch(() => {
      toast({ title: "Failed to copy", variant: "destructive" });
    });
  };

  // --- Render ---
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All assignees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {teamMembers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tasks (title or description)…"
          className="w-full sm:w-[280px]"
        />

        {searchQuery && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchQuery("")}
            className="w-full sm:w-auto"
          >
            Clear
          </Button>
        )}

        <Select
          value={dueSort}
          onValueChange={(v: "none" | "asc" | "desc") => setDueSort(v)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Sort by due date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No due date sort</SelectItem>
            <SelectItem value="asc">Due date · Oldest first</SelectItem>
            <SelectItem value="desc">Due date · Newest first</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={copyTableToClipboard}
          className="w-full sm:w-auto"
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy to Excel
        </Button>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-md border bg-slate-50">
          <div className="text-sm">
            <span className="font-semibold">{selectedIds.size}</span> selected
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                const ids = Array.from(selectedIds);
                if (window.confirm(`Delete ${ids.length} selected task(s)?`)) {
                  bulkDeleteMutation.mutate(ids);
                }
              }}
            >
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto  border-gray-300">
        <Table className="border-collapse text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]  ">
                <Checkbox
                  checked={
                    allVisibleSelected
                      ? true
                      : someVisibleSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(v) => toggleAllVisible(Boolean(v))}
                />
              </TableHead>
              <TableHead className="w-[40px]">Status</TableHead>
              <TableHead>Task</TableHead>
              <TableHead className="w-[120px]">Priority</TableHead>
              <TableHead className="w-[180px]">Assignee</TableHead>
              {isAgileProject && <TableHead>Story Points</TableHead>}
              <TableHead className="w-[150px]">Due Date</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedTasks.map((task) => {
              const StatusIcon = statusIcons[task.status];
              return (
                <TableRow key={task.id}>
                  <TableCell className="border border-gray-300 px-2 py-1 text-black">
                    <Checkbox
                      checked={selectedIds.has(task.id)}
                      onCheckedChange={(v) => toggleOne(task.id, Boolean(v))}
                    />
                  </TableCell>

                  {/* Status */}
                  <TableCell className="border border-gray-300 px-2 py-1 text-black">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-status-${task.id}`}
                        >
                          <StatusIcon
                            className={cn(
                              "h-4 w-4",
                              task.status === "done" && "text-green-600",
                              task.status === "in-progress" && "text-blue-600",
                              task.status === "todo" && "text-gray-400",
                            )}
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            updateTaskMutation.mutate({
                              taskId: task.id,
                              updates: { status: "todo" },
                            })
                          }
                          data-testid={`status-option-todo-${task.id}`}
                        >
                          <Circle className="h-4 w-4 mr-2 text-gray-400" />
                          To Do
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            updateTaskMutation.mutate({
                              taskId: task.id,
                              updates: { status: "in-progress" },
                            })
                          }
                          data-testid={`status-option-inprogress-${task.id}`}
                        >
                          <Clock className="h-4 w-4 mr-2 text-blue-600" />
                          In Progress
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            updateTaskMutation.mutate({
                              taskId: task.id,
                              updates: { status: "done" },
                            })
                          }
                          data-testid={`status-option-done-${task.id}`}
                        >
                          <Check className="h-4 w-4 mr-2 text-green-600" />
                          Done
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>

                  {/* Name & Desc */}
                  <TableCell className="border border-gray-300 px-2 py-1 text-black">
                    {editingTaskId === task.id && editingField === "name" ? (
                      <Input
                        value={editValues.name || ""}
                        onChange={(e) =>
                          setEditValues({ ...editValues, name: e.target.value })
                        }
                        onBlur={() => {
                          if (editValues.name?.trim()) {
                            updateTaskMutation.mutate({
                              taskId: task.id,
                              updates: { name: editValues.name },
                            });
                          }
                          setEditingTaskId(null);
                          setEditingField(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          } else if (e.key === "Escape") {
                            setEditingTaskId(null);
                            setEditingField(null);
                          }
                        }}
                        autoFocus
                        className="h-8"
                      />
                    ) : (
                      <div
                        className="font-medium cursor-pointer hover:bg-gray-50 rounded px-2 py-1"
                        onClick={() => {
                          setEditingTaskId(task.id);
                          setEditingField("name");
                          setEditValues({ name: task.name });
                        }}
                        data-testid={`task-name-${task.id}`}
                      >
                        {task.name}
                      </div>
                    )}
                    {editingTaskId === task.id &&
                    editingField === "description" ? (
                      <Textarea
                        value={editValues.description || ""}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            description: e.target.value,
                          })
                        }
                        onBlur={() => {
                          updateTaskMutation.mutate({
                            taskId: task.id,
                            updates: {
                              description: editValues.description || "",
                            },
                          });
                          setEditingTaskId(null);
                          setEditingField(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setEditingTaskId(null);
                            setEditingField(null);
                          }
                        }}
                        autoFocus
                        className="mt-1 text-sm"
                        rows={2}
                      />
                    ) : task.description ? (
                      <div
                        className="text-sm text-gray-500 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 mt-1"
                        onClick={() => {
                          setEditingTaskId(task.id);
                          setEditingField("description");
                          setEditValues({
                            description: task.description || "",
                          });
                        }}
                        data-testid={`task-description-${task.id}`}
                      >
                        {task.description}
                      </div>
                    ) : (
                      <div
                        className="text-sm text-gray-400 italic cursor-pointer hover:bg-gray-50 rounded px-2 py-1 mt-1"
                        onClick={() => {
                          setEditingTaskId(task.id);
                          setEditingField("description");
                          setEditValues({ description: "" });
                        }}
                        data-testid={`task-description-${task.id}`}
                      >
                        Click to add description
                      </div>
                    )}
                  </TableCell>

                  {/* Priority */}
                  <TableCell className="border border-gray-300 px-2 py-1 text-black">
                    <Select
                      value={task.priority}
                      onValueChange={(value) => {
                        updateTaskMutation.mutate({
                          taskId: task.id,
                          updates: {
                            priority: value as "low" | "medium" | "high",
                          },
                        });
                      }}
                    >
                      <SelectTrigger className="w-full border-0 shadow-none hover:bg-gray-50">
                        <Badge
                          className={cn(
                            priorityColors[task.priority],
                            "capitalize",
                          )}
                        >
                          {task.priority}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">
                          <div className="flex items-center gap-2">
                            <Badge className={priorityColors.low}>Low</Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value="medium">
                          <div className="flex items-center gap-2">
                            <Badge className={priorityColors.medium}>
                              Medium
                            </Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value="high">
                          <div className="flex items-center gap-2">
                            <Badge className={priorityColors.high}>High</Badge>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Assignee */}
                  <TableCell className="border border-gray-300 px-2 py-1 text-black">
                    <Select
                      value={task.assigneeId || "unassigned"}
                      onValueChange={(value) => {
                        updateTaskMutation.mutate({
                          taskId: task.id,
                          updates: {
                            assigneeId: value === "unassigned" ? null : value,
                          },
                        });
                      }}
                    >
                      <SelectTrigger className="w-full border-0 shadow-none hover:bg-gray-50">
                        <SelectValue>
                          {task.assigneeId
                            ? teamMembers.find((m) => m.id === task.assigneeId)
                                ?.name || "Unknown"
                            : "Unassigned"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Story Points */}
                  {isAgileProject && (
                    <TableCell className="text-center">
                      {task.storyPoints ?? "—"}
                    </TableCell>
                  )}

                  {/* Due Date */}
                  <TableCell className="border border-gray-300 px-2 py-1 text-black">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          className={cn(
                            "w-full justify-start text-left font-normal border-0 shadow-none hover:bg-gray-50",
                            !task.dueDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {task.dueDate
                            ? format(new Date(task.dueDate), "MMM d, yyyy")
                            : "Set date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={
                            task.dueDate ? new Date(task.dueDate) : undefined
                          }
                          onSelect={(date) => {
                            updateTaskMutation.mutate({
                              taskId: task.id,
                              updates: {
                                dueDate: date ? date.toISOString() : null,
                              },
                            });
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="border border-gray-300 px-2 py-1 text-black">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedTaskForTools(task.id);
                          setAiToolsModalOpen(true);
                        }}
                        data-testid={`button-ai-tools-${task.id}`}
                        title="AI Tools"
                      >
                        <Sparkles className="h-4 w-4 text-purple-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedTaskId(task.id);
                          setTaskDetailModalOpen(true);
                        }}
                        data-testid={`button-details-${task.id}`}
                        title="View Details"
                      >
                        <ExternalLink className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTaskMutation.mutate(task.id)}
                        data-testid={`button-delete-${task.id}`}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* AI Tools Modal */}
      <Dialog open={aiToolsModalOpen} onOpenChange={setAiToolsModalOpen}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>AI Tool Recommendations</DialogTitle>
            <DialogDescription>
              Get personalized tool suggestions for this task
            </DialogDescription>
          </DialogHeader>
          {selectedTaskForTools && (
            <div className="flex-1 overflow-hidden">
              <TaskToolRecommendations taskId={selectedTaskForTools} />
            </div>
          )}
        </DialogContent>
      </Dialog>
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
    </div>
  );
}
