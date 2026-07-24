import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProjectMembers,
  getUserByUsername,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember
} from '@/lib/api';
import { ProjectRole } from '@shared/schema';
import { ProjectInvitations } from './ProjectInvitations';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Plus, Check, X, Edit, Trash2 } from 'lucide-react';

interface ProjectMembersProps {
  projectId: number;
}

type ProjectMember = {
  id: number;
  projectId: number;
  userId: string;
  role: string;
  addedAt: Date;
  user?: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string;
  };
};

export function ProjectMembers({ projectId }: ProjectMembersProps) {
  const [usernameInput, setUsernameInput] = useState('');
  const [roleInput, setRoleInput] = useState(ProjectRole.VIEWER);
  const [searchError, setSearchError] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<ProjectMember | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<ProjectMember | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: [`/api/projects/${projectId}/members`],
    queryFn: () => getProjectMembers(projectId),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ projectId, userId, role }: { projectId: number; userId: string; role: string }) => {
      return addProjectMember(projectId, userId, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/members`] });
      toast({
        title: 'Team member added',
        description: 'The user has been added to the project.',
      });
      // Reset form
      setUsernameInput('');
      setRoleInput(ProjectRole.VIEWER);
      setFoundUser(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to add member',
        description: error.message || 'Something went wrong while adding the member.',
        variant: 'destructive',
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ projectId, userId, role }: { projectId: number; userId: string; role: string }) => {
      return updateProjectMemberRole(projectId, userId, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/members`] });
      toast({
        title: 'Role updated',
        description: 'The member\'s role has been updated successfully.',
      });
      setMemberToEdit(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update role',
        description: error.message || 'Something went wrong while updating the role.',
        variant: 'destructive',
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ projectId, userId }: { projectId: number; userId: string }) => {
      return removeProjectMember(projectId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/members`] });
      toast({
        title: 'Member removed',
        description: 'The member has been removed from the project.',
      });
      setMemberToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to remove member',
        description: error.message || 'Something went wrong while removing the member.',
        variant: 'destructive',
      });
    },
  });

  const handleSearchUser = async () => {
    if (!usernameInput.trim()) {
      setSearchError('Please enter a username');
      return;
    }

    setSearchingUser(true);
    setSearchError('');
    setFoundUser(null);

    try {
      const user = await getUserByUsername(usernameInput);
      if (user) {
        setFoundUser(user);
      } else {
        setSearchError('User not found');
      }
    } catch (error: any) {
      setSearchError(error.message || 'Error searching for user');
    } finally {
      setSearchingUser(false);
    }
  };

  const handleAddMember = () => {
    if (!foundUser) return;

    // Check if user is already a member
    const existingMember = members.find(member => member.userId === foundUser.id);
    if (existingMember) {
      toast({
        title: 'User already a member',
        description: `${foundUser.username} is already a member of this project.`,
        variant: 'destructive',
      });
      return;
    }

    addMemberMutation.mutate({
      projectId,
      userId: foundUser.id,
      role: roleInput
    });
  };

  const startEditingRole = (member: ProjectMember) => {
    setMemberToEdit(member);
  };

  const openDeleteDialog = (member: ProjectMember) => {
    setMemberToDelete(member);
  };

  const getUserInitials = (member: any) => {
    // Check for enriched data from backend
    if (member.userFirstName && member.userLastName) {
      return `${member.userFirstName[0]}${member.userLastName[0]}`.toUpperCase();
    }
    // Fallback to nested user object
    if (member.user?.firstName && member.user?.lastName) {
      return `${member.user.firstName[0]}${member.user.lastName[0]}`.toUpperCase();
    }
    const username = member.userUsername || member.user?.username;
    return username?.[0]?.toUpperCase() || 'U';
  };

  const getDisplayName = (member: any) => {
    // Check for enriched data from backend
    if (member.userFirstName && member.userLastName) {
      return `${member.userFirstName} ${member.userLastName}`;
    }
    // Fallback to nested user object
    if (member.user?.firstName && member.user?.lastName) {
      return `${member.user.firstName} ${member.user.lastName}`;
    }
    return member.userUsername || member.user?.username || member.userEmail || member.userId;
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case ProjectRole.OWNER:
        return 'bg-violet-100 text-violet-800';
      case ProjectRole.EDITOR:
        return 'bg-blue-100 text-blue-800';
      case ProjectRole.VIEWER:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Manage access to this project for other users. Add team members and assign appropriate roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border rounded-md p-4 bg-slate-50">
              <h3 className="text-sm font-medium mb-3">Add new team member</h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-5">
                  <Label htmlFor="username">Username</Label>
                  <div className="mt-1.5 relative">
                    <Input
                      id="username"
                      placeholder="Enter username"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                    />
                  </div>
                  {searchError && <p className="text-sm text-red-500 mt-1">{searchError}</p>}
                </div>
                
                <div className="md:col-span-3">
                  <Label htmlFor="role">Role</Label>
                  <Select value={roleInput} onValueChange={setRoleInput}>
                    <SelectTrigger id="role" className="mt-1.5">
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
                    variant="outline"
                    onClick={handleSearchUser}
                    disabled={searchingUser}
                    className="w-full"
                  >
                    {searchingUser ? 'Searching...' : 'Search'}
                  </Button>
                </div>
                
                <div className="md:col-span-2">
                  <Button
                    type="button"
                    onClick={handleAddMember}
                    disabled={!foundUser || addMemberMutation.isPending}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>
              
              {foundUser && (
                <div className="mt-4 p-3 border border-green-200 rounded-md bg-green-50 flex items-center justify-between">
                  <div className="flex items-center">
                    <Avatar className="h-8 w-8 mr-2">
                      <AvatarImage src={foundUser.profileImageUrl} alt={foundUser.username} />
                      <AvatarFallback>{foundUser.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{foundUser.firstName} {foundUser.lastName}</p>
                      <p className="text-xs text-gray-500">@{foundUser.username}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFoundUser(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">Loading members...</TableCell>
                    </TableRow>
                  ) : members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">No members found for this project.</TableCell>
                    </TableRow>
                  ) : (
                    members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Avatar className="h-8 w-8 mr-2">
                              <AvatarImage 
                                src={member.user?.profileImageUrl} 
                                alt={getDisplayName(member)} 
                              />
                              <AvatarFallback>{getUserInitials(member)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{getDisplayName(member)}</span>
                          </div>
                        </TableCell>
                        <TableCell>@{member.userUsername || member.user?.username || '-'}</TableCell>
                        <TableCell>
                          {memberToEdit?.id === member.id ? (
                            <div className="flex items-center gap-1">
                              <Select 
                                defaultValue={member.role} 
                                onValueChange={(value) => {
                                  updateRoleMutation.mutate({
                                    projectId,
                                    userId: member.userId,
                                    role: value
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 w-32">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={ProjectRole.OWNER}>Owner</SelectItem>
                                  <SelectItem value={ProjectRole.EDITOR}>Editor</SelectItem>
                                  <SelectItem value={ProjectRole.VIEWER}>Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setMemberToEdit(null)}
                                className="h-8 w-8"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(member.role)}`}>
                                {member.role}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.addedAt && new Date(member.addedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => startEditingRole(member)}
                            className="h-8 w-8 mr-1"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
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
                                <AlertDialogTitle>Remove team member</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove this member from the project? 
                                  They will lose access to all project resources.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  className="bg-red-500 hover:bg-red-600"
                                  onClick={() => {
                                    removeMemberMutation.mutate({
                                      projectId,
                                      userId: member.userId
                                    });
                                  }}
                                >
                                  Remove
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
            
            <div className="bg-slate-50 rounded-md p-4 border">
              <h3 className="text-sm font-medium mb-2">About roles and permissions</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start">
                  <span className="inline-flex items-center justify-center rounded-md mr-2 px-2 py-1 text-xs font-medium bg-violet-100 text-violet-800">Owner</span>
                  <span>Full control including adding/removing members and deleting the project</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-flex items-center justify-center rounded-md mr-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800">Editor</span>
                  <span>Can edit project details and tasks, but cannot manage team members</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-flex items-center justify-center rounded-md mr-2 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">Viewer</span>
                  <span>Read-only access to the project and its tasks</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Project Invitations Section */}
      <ProjectInvitations projectId={projectId} />
    </div>
  );
}