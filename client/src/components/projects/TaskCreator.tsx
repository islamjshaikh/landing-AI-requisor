import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  createTask,
  getProjectTasks,
  getProjectMembers,
  NewTask,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Plus, User } from "lucide-react";
import { format } from "date-fns";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Task creation schema
const taskFormSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Task name must be at least 2 characters" }),
  description: z.string().optional(),
  dueDate: z.date().optional(),
  priority: z.string().optional().default("medium"),
  status: z.string().optional().default("todo"),
  parentTaskId: z.number().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskCreatorProps {
  projectId: number;
  parentTaskId?: number | null;
  defaultStatus?: string;
  onTaskCreated?: () => void;
  showParentTaskSelector?: boolean;
}

export default function TaskCreator({
  projectId,
  parentTaskId = null,
  defaultStatus = "todo",
  onTaskCreated,
  showParentTaskSelector = false,
}: TaskCreatorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch tasks for parent task selection
  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/tasks`],
    enabled: showParentTaskSelector,
  });

  // Fetch project members for assignee selection
  const { data: projectMembers = [] } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/members`],
    queryFn: () => getProjectMembers(projectId),
  });

  // Initialize form with default values
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: "",
      description: "",
      priority: "medium",
      status: defaultStatus,
      parentTaskId: parentTaskId,
      assigneeId: null,
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: (values: TaskFormValues) => {
      // Ensure we're sending the correct data structure that matches the schema
      const newTask: NewTask = {
        name: values.name,
        description: values.description || "",
        dueDate: values.dueDate ? values.dueDate.toISOString() : undefined, // Format date properly
        priority: values.priority || "medium",
        status: values.status || "todo",
        isCompleted: values.status === "done", // Set completed based on status
        projectId: projectId,
        parentTaskId: values.parentTaskId || null,
        assigneeId: values.assigneeId || null,
        source: "manual",
      };
      console.log("Sending task data:", JSON.stringify(newTask));
      return createTask(newTask);
    },
    onSuccess: () => {
      toast({
        title: "Task created!",
        description: "Your task has been created successfully.",
      });

      // Reset the form
      form.reset({
        name: "",
        description: "",
        priority: "medium",
        status: defaultStatus,
        parentTaskId: parentTaskId,
        assigneeId: null,
      });

      // Refresh tasks list
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/tasks`],
      });

      // Call the callback if provided
      if (onTaskCreated) {
        onTaskCreated();
      }
    },
    onError: (error: any) => {
      console.error("Error creating task:", error);

      // Check if it's an authentication error
      if (
        error?.isAuthError ||
        error?.status === 401 ||
        error?.message?.includes("authenticated") ||
        error?.message?.includes("log in")
      ) {
        toast({
          title: "Authentication Required",
          description: "Please log in to create tasks.",
          variant: "destructive",
        });
        // Redirect to login after a short delay
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1500);
      } else {
        toast({
          title: "Error creating task",
          description:
            error?.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (values: TaskFormValues) => {
    createTaskMutation.mutate(values);
  };

  // Get potential parent tasks (excluding tasks with this task as ancestor to prevent cycles)
  const potentialParentTasks = tasks.filter(
    (task) =>
      (parentTaskId === null || task.id !== parentTaskId) && !task.parentTaskId, // Only top-level tasks can be parents (for simplicity)
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Add New Task</CardTitle>
        <CardDescription>
          Create a task{" "}
          {parentTaskId ? "for this milestone" : "for your project"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Create wireframes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what needs to be done..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "unassigned" ? null : value)
                      }
                      value={field.value || "unassigned"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-assignee">
                          <SelectValue placeholder="Select team member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem
                          value="unassigned"
                          data-testid="assignee-option-unassigned"
                        >
                          Unassigned
                        </SelectItem>
                        {projectMembers.map((member: any) => (
                          <SelectItem
                            key={member.userId}
                            value={member.userId}
                            data-testid={`assignee-option-${member.userId}`}
                          >
                            {member.userFirstName && member.userLastName
                              ? `${member.userFirstName} ${member.userLastName}`
                              : member.userUsername ||
                                member.userEmail ||
                                "Unknown User"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Optionally assign this task to a team member.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {showParentTaskSelector && (
              <FormField
                control={form.control}
                name="parentTaskId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Milestone (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value ? parseInt(value) : null)
                      }
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a parent milestone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None (Top-level task)</SelectItem>
                        {potentialParentTasks.map((task: any) => (
                          <SelectItem key={task.id} value={task.id.toString()}>
                            {task.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Tasks can be standalone or part of a milestone.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button
              type="submit"
              className="w-full md:w-auto"
              disabled={createTaskMutation.isPending}
            >
              {createTaskMutation.isPending ? (
                <span>Creating task...</span>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" /> Create Task
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
