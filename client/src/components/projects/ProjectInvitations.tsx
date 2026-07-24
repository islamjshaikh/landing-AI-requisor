import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProjectInvitations,
  createProjectInvitation,
  deleteProjectInvitation,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ProjectRole,
  ProjectInvitation as ProjectInvitationType,
} from "@shared/schema";
import { Mail, Plus, Trash2, Clock } from "lucide-react";

interface ProjectInvitationsProps {
  projectId: number;
}

export function ProjectInvitations({ projectId }: ProjectInvitationsProps) {
  const [emailInput, setEmailInput] = useState("");
  const [roleInput, setRoleInput] = useState(ProjectRole.VIEWER);
  const [invitationToDelete, setInvitationToDelete] =
    useState<ProjectInvitationType | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: [`/api/projects/${projectId}/invitations`],
    queryFn: () => getProjectInvitations(projectId),
  });

  const createInvitationMutation = useMutation({
    mutationFn: (invitation: { email: string; role: string }) => {
      return createProjectInvitation(projectId, invitation);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/invitations`],
      });
      toast({
        title: "Invitation sent",
        description: "The invitation has been sent to the email address.",
      });
      // Reset form
      setEmailInput("");
      setRoleInput(ProjectRole.VIEWER);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send invitation",
        description:
          error.message || "Something went wrong while sending the invitation.",
        variant: "destructive",
      });
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: (invitationId: number) => {
      return deleteProjectInvitation(projectId, invitationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/invitations`],
      });
      toast({
        title: "Invitation deleted",
        description: "The invitation has been deleted successfully.",
      });
      setInvitationToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete invitation",
        description:
          error.message ||
          "Something went wrong while deleting the invitation.",
        variant: "destructive",
      });
    },
  });

  const handleSendInvitation = () => {
    if (!emailInput.trim()) {
      toast({
        title: "Email required",
        description: "Please enter an email address to send an invitation.",
        variant: "destructive",
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    // Check if the email is already invited
    const existingInvitation = invitations.find(
      (inv) => inv.email === emailInput,
    );
    if (existingInvitation) {
      toast({
        title: "Already invited",
        description: "This email has already been invited to the project.",
        variant: "destructive",
      });
      return;
    }

    createInvitationMutation.mutate({
      email: emailInput,
      role: roleInput,
    });
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case ProjectRole.OWNER:
        return "bg-violet-100 text-violet-800";
      case ProjectRole.EDITOR:
        return "bg-blue-100 text-blue-800";
      case ProjectRole.VIEWER:
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "accepted":
        return "bg-green-100 text-green-800";
      case "expired":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Invitations</CardTitle>
          <CardDescription>
            Invite team members via email. They'll receive an email with a link
            to join this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border rounded-md p-4 bg-slate-50">
              <h3 className="text-sm font-medium mb-3">Send invitation</h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-7">
                  <Label htmlFor="email">Email address</Label>
                  <div className="mt-1.5 relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter email address"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                    />
                  </div>
                </div>

                <div className="md:col-span-3">
                  <Label htmlFor="invitation-role">Role</Label>
                  <Select value={roleInput} onValueChange={setRoleInput}>
                    <SelectTrigger id="invitation-role" className="mt-1.5">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ProjectRole.OWNER}>Owner</SelectItem>
                      <SelectItem value={ProjectRole.EDITOR}>Editor</SelectItem>
                      <SelectItem value={ProjectRole.VIEWER}>Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Button
                    type="button"
                    onClick={handleSendInvitation}
                    disabled={createInvitationMutation.isPending}
                    className="w-full"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
              </div>
            </div>

            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Invited On</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Loading invitations...
                      </TableCell>
                    </TableRow>
                  ) : invitations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No invitations sent for this project.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Mail className="h-4 w-4 mr-2 text-gray-500" />
                            <span>{invitation.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(invitation.status)}`}
                          >
                            {invitation.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(invitation.role)}`}
                          >
                            {invitation.role}
                          </span>
                        </TableCell>
                        <TableCell>
                          {formatDate(invitation.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1 text-gray-500" />
                            <span>{formatDate(invitation.expiresAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete invitation
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this
                                  invitation? The invited user will no longer be
                                  able to accept it.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-500 hover:bg-red-600"
                                  onClick={() => {
                                    deleteInvitationMutation.mutate(
                                      invitation.id,
                                    );
                                  }}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
