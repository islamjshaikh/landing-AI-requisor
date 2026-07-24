import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  createProjectInvitation,
  getProjectMembers,
  getProjectInvitations,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ProjectRole } from "@shared/schema";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, Users } from "lucide-react";

// Create schema for the form
const inviteFormSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  projectId: z.string({ required_error: "Please select a project" }),
  role: z
    .string()
    .refine((val) => Object.values(ProjectRole).includes(val as ProjectRole), {
      message: "Please select a valid role",
    }),
});

type InviteFormValues = z.infer<typeof inviteFormSchema>;

interface TeamInviteFormProps {
  projects: any[];
  isLoadingProjects: boolean;
}

export function TeamInviteForm({
  projects = [],
  isLoadingProjects = false,
}: TeamInviteFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create form
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
      projectId: "",
      role: ProjectRole.VIEWER,
    },
  });

  // Get selected project ID from form
  const selectedProjectId = form.watch("projectId");

  // Fetch project members when a project is selected
  const { data: projectMembers = [] } = useQuery({
    queryKey: [`/api/projects/${selectedProjectId}/members`],
    queryFn: () => getProjectMembers(parseInt(selectedProjectId)),
    enabled: !!selectedProjectId && !isNaN(parseInt(selectedProjectId)),
  });

  // Fetch project invitations when a project is selected
  const { data: projectInvitations = [] } = useQuery({
    queryKey: [`/api/projects/${selectedProjectId}/invitations`],
    queryFn: () => getProjectInvitations(parseInt(selectedProjectId)),
    enabled: !!selectedProjectId && !isNaN(parseInt(selectedProjectId)),
  });

  // Create invitation mutation
  const inviteMutation = useMutation({
    mutationFn: async (values: InviteFormValues) => {
      console.log("Sending invitation with values:", values);

      const emailToCheck = values.email.toLowerCase();

      // Check if email is already a member
      const existingMember = projectMembers.find(
        (member: any) => member.userEmail?.toLowerCase() === emailToCheck,
      );

      if (existingMember) {
        throw new Error(`${values.email} is already a member of this project.`);
      }

      // Check if email already has a pending invitation
      const existingInvitation = projectInvitations.find(
        (invitation: any) =>
          invitation.email?.toLowerCase() === emailToCheck &&
          invitation.status === "pending",
      );

      if (existingInvitation) {
        throw new Error(
          `${values.email} already has a pending invitation to this project.`,
        );
      }

      return createProjectInvitation(parseInt(values.projectId), {
        email: values.email,
        role: values.role as ProjectRole,
      });
    },
    onSuccess: () => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      // Invalidate project members and invitations for the selected project
      if (selectedProjectId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/projects/${selectedProjectId}/members`],
        });
        queryClient.invalidateQueries({
          queryKey: [`/api/projects/${selectedProjectId}/invitations`],
        });
      }

      toast({
        title: "Invitation sent!",
        description: "Your team member has been invited to the project.",
      });

      // Reset only email field, keep projectId and role
      form.reset({
        email: "",
        projectId: selectedProjectId, // Preserve the selected project
        role: form.getValues("role"), // Preserve the selected role
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send invitation",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  function onSubmit(values: InviteFormValues) {
    inviteMutation.mutate(values);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Mail className="mr-2 h-5 w-5 text-primary" />
          Invite Team Members
        </CardTitle>
        <CardDescription>
          Send invitations to collaborate on your projects. Team members will
          receive an email with instructions to join.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input placeholder="colleague@example.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter the email address of the person you want to invite.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoadingProjects || projects.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingProjects ? (
                        <SelectItem value="loading" disabled>
                          Loading projects...
                        </SelectItem>
                      ) : projects.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No projects found
                        </SelectItem>
                      ) : (
                        projects.map((project) => (
                          <SelectItem
                            key={project.id}
                            value={project.id.toString()}
                          >
                            {project.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the project you want to invite this person to.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ProjectRole.VIEWER}>
                        Viewer (can view only)
                      </SelectItem>
                      <SelectItem value={ProjectRole.EDITOR}>
                        Editor (can edit tasks)
                      </SelectItem>
                      <SelectItem value={ProjectRole.OWNER}>
                        Owner (full access)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose what level of access they'll have to the project.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending
                  ? "Sending invitation..."
                  : "Send invitation"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
