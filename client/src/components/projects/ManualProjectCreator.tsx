import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "@/lib/api";
import { NewProject } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { CalendarIcon, Plus } from "lucide-react";
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

// Project creation schema
const projectFormSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Project name must be at least 3 characters" }),
  description: z.string().optional(),
  dueDate: z.date().optional(),
  icon: z.string().optional(),
  iconBg: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export default function ManualProjectCreator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Initialize form with default values
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      icon: "folder-open",
      iconBg: "blue",
    },
    mode: "onBlur", // Validate fields when the user moves away from them
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: (values: ProjectFormValues) => {
      // Ensure we're sending the correct data structure that matches the schema
      const projectData = {
        name: values.name.trim(), // Ensure name is trimmed
        description: values.description?.trim() || "", // Trim description if it exists
        dueDate: values.dueDate ? values.dueDate.toISOString() : undefined, // Format date properly
        icon: values.icon || "folder-open",
        iconBg: values.iconBg || "blue",
        status: "active",
        progress: 0,
        totalTasks: 0,
        completedTasks: 0,
        source: "manual",
        aiGenerated: false,
      };

      // Log the actual data being sent to the API
      console.log(
        "Component: Sending project data to API:",
        JSON.stringify(projectData),
      );

      // Add a try/catch for better debugging at component level
      try {
        const result = createProject(projectData);
        return result;
      } catch (error) {
        console.error("Component: Error creating project:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Project created!",
        description: "Your project has been created successfully.",
      });

      // Refresh projects list
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });

      // Navigate to the project details page
      navigate(`/project/${data.id}`);
    },
    onError: (error: any) => {
      console.error("Error creating project:", error);

      // Show a more detailed error message if available
      const errorMessage =
        error?.message ||
        error?.response?.data?.message ||
        error?.response?.data?.details ||
        "Something went wrong. Please try again.";

      toast({
        title: "Error creating project",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Available icon colors
  const iconColors = [
    { name: "Blue", value: "blue" },
    { name: "Green", value: "green" },
    { name: "Purple", value: "purple" },
    { name: "Red", value: "red" },
    { name: "Yellow", value: "yellow" },
    { name: "Slate", value: "slate" },
  ];

  // Available icons (use Lucide icon names)
  const icons = [
    { name: "Folder", value: "folder-open" },
    { name: "Briefcase", value: "briefcase" },
    { name: "Calendar", value: "calendar" },
    { name: "Code", value: "code" },
    { name: "Package", value: "package" },
    { name: "Star", value: "star" },
  ];

  const onSubmit = (values: ProjectFormValues) => {
    // Log the form values being submitted
    console.log("Form values being submitted:", values);

    // Ensure name is properly set
    if (!values.name || values.name.trim() === "") {
      toast({
        title: "Project name required",
        description: "Please enter a name for your project.",
        variant: "destructive",
      });
      return;
    }

    // Proceed with project creation
    try {
      console.log("Submitting project with values:", JSON.stringify(values));
      createProjectMutation.mutate(values);
    } catch (error) {
      console.error("Error in form submission:", error);
      toast({
        title: "Submission error",
        description:
          "There was a problem creating your project. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="flex-1 flex flex-col min-w-0 lg:w-1/2 min-h-0 overflow-hidden">
      <CardHeader>
        <CardTitle>Create a New Project</CardTitle>
        <CardDescription>
          Fill out the details to create a new project manually.
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
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My New Project" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter a descriptive name for your project.
                  </FormDescription>
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
                      placeholder="Describe your project in detail..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Provide details about the project scope, goals, and
                    objectives.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Due Date (optional)</FormLabel>
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
                  <FormDescription>
                    Select when this project is due to be completed.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Icon</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an icon" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {icons.map((icon) => (
                          <SelectItem key={icon.value} value={icon.value}>
                            {icon.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose an icon for your project.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="iconBg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon Color</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a color" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {iconColors.map((color) => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center">
                              <div
                                className={`w-4 h-4 rounded-full bg-${color.value}-500 mr-2`}
                              ></div>
                              {color.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose a color for your project icon.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="w-full md:w-auto"
              disabled={createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? (
                <span>Creating project...</span>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" /> Create Project
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
