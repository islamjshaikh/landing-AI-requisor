import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle,
  User,
  Send,
  Loader2,
  AlertCircle,
  Edit2,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  skills: string[];
  capacity: number;
  hourlyRate: number;
  isActive: boolean;
}

interface TeamInvitation {
  id: number;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  expiresAt: string;
}

import EnhancedTeamView from './EnhancedTeamView';
import TeamAIAssistant from './TeamAIAssistant';

export default function TeamManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    role: 'developer',
    skills: '',
    capacity: 40,
    hourlyRate: 100
  });
  
  const [isInviting, setIsInviting] = useState(false);
  const [invitation, setInvitation] = useState({
    email: '',
    role: 'viewer',
    message: ''
  });

  // Fetch team members
  const { data: teamMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['/api/smart-bandwidth/team-members'],
    enabled: !!user
  });

  // Fetch invitations
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ['/api/invitations'],
    enabled: !!user
  });

  // Create team member mutation
  const createMemberMutation = useMutation({
    mutationFn: (data: typeof newMember) => 
      apiRequest('/api/smart-bandwidth/team-members', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          skills: data.skills.split(',').map(s => s.trim()).filter(Boolean),
          isActive: true
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/smart-bandwidth/team-members'] });
      setIsAddingMember(false);
      setNewMember({
        name: '',
        email: '',
        role: 'developer',
        skills: '',
        capacity: 40,
        hourlyRate: 100
      });
      toast({
        title: "Team member added",
        description: "The team member has been successfully added.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding team member",
        description: error.message || "Failed to add team member",
        variant: "destructive",
      });
    }
  });

  // Send invitation mutation
  const sendInvitationMutation = useMutation({
    mutationFn: (data: typeof invitation) => 
      apiRequest('/api/invitations', {
        method: 'POST',
        body: JSON.stringify({
          email: data.email,
          role: data.role,
          projectId: 1 // For now, using a default project ID
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
      setIsInviting(false);
      setInvitation({
        email: '',
        role: 'viewer',
        message: ''
      });
      toast({
        title: "Invitation sent",
        description: "The invitation has been sent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error sending invitation",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    }
  });

  // Delete team member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/smart-bandwidth/team-members/${id}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/smart-bandwidth/team-members'] });
      toast({
        title: "Team member removed",
        description: "The team member has been removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error removing team member",
        description: error.message || "Failed to remove team member",
        variant: "destructive",
      });
    }
  });

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/invitations/${id}/resend`, {
        method: 'POST'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
      toast({
        title: "Invitation resent",
        description: "The invitation has been resent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error resending invitation",
        description: error.message || "Failed to resend invitation",
        variant: "destructive",
      });
    }
  });

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/invitations/${id}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error cancelling invitation",
        description: error.message || "Failed to cancel invitation",
        variant: "destructive",
      });
    }
  });

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Authentication Required
            </CardTitle>
            <CardDescription>
              Please log in to manage your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="w-full"
            >
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Team Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your team members and invitations
          </p>
        </div>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="members">Team Members</TabsTrigger>
          <TabsTrigger value="ai-assistant">AI Assistant</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="legacy">Legacy View</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <EnhancedTeamView />
        </TabsContent>

        <TabsContent value="ai-assistant" className="space-y-4">
          <TeamAIAssistant />
        </TabsContent>

        <TabsContent value="legacy" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    Manage your team members and their capacity
                  </CardDescription>
                </div>
                <Dialog open={isAddingMember} onOpenChange={setIsAddingMember}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Team Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Team Member</DialogTitle>
                      <DialogDescription>
                        Add a new member to your team
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={newMember.name}
                          onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newMember.email}
                          onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                          placeholder="john@example.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={newMember.role}
                          onValueChange={(value) => setNewMember({ ...newMember, role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="developer">Developer</SelectItem>
                            <SelectItem value="designer">Designer</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="analyst">Analyst</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="skills">Skills (comma-separated)</Label>
                        <Input
                          id="skills"
                          value={newMember.skills}
                          onChange={(e) => setNewMember({ ...newMember, skills: e.target.value })}
                          placeholder="React, TypeScript, Node.js"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="capacity">Capacity (hours/week)</Label>
                          <Input
                            id="capacity"
                            type="number"
                            value={newMember.capacity}
                            onChange={(e) => setNewMember({ ...newMember, capacity: parseInt(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                          <Input
                            id="hourlyRate"
                            type="number"
                            value={newMember.hourlyRate}
                            onChange={(e) => setNewMember({ ...newMember, hourlyRate: parseInt(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddingMember(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => createMemberMutation.mutate(newMember)}
                        disabled={!newMember.name || !newMember.email || createMemberMutation.isPending}
                      >
                        {createMemberMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Add Member
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No team members yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add your first team member to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {teamMembers.map((member: TeamMember) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-muted-foreground">{member.email}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary">{member.role}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {member.capacity}h/week • ${member.hourlyRate}/h
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMemberMutation.mutate(member.id)}
                          disabled={deleteMemberMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Invitations</CardTitle>
                  <CardDescription>
                    Invite new members to join your team
                  </CardDescription>
                </div>
                <Dialog open={isInviting} onOpenChange={setIsInviting}>
                  <DialogTrigger asChild>
                    <Button>
                      <Send className="h-4 w-4 mr-2" />
                      Send Invitation
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Send Team Invitation</DialogTitle>
                      <DialogDescription>
                        Invite someone to join your team
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="invite-email">Email Address</Label>
                        <Input
                          id="invite-email"
                          type="email"
                          value={invitation.email}
                          onChange={(e) => setInvitation({ ...invitation, email: e.target.value })}
                          placeholder="colleague@example.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="invite-role">Role</Label>
                        <Select
                          value={invitation.role}
                          onValueChange={(value) => setInvitation({ ...invitation, role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="owner">Owner</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="invite-message">Message (optional)</Label>
                        <Textarea
                          id="invite-message"
                          value={invitation.message}
                          onChange={(e) => setInvitation({ ...invitation, message: e.target.value })}
                          placeholder="Hi, I'd like to invite you to join our team..."
                          rows={4}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsInviting(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => sendInvitationMutation.mutate(invitation)}
                        disabled={!invitation.email || sendInvitationMutation.isPending}
                      >
                        {sendInvitationMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Send Invitation
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {invitationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No invitations sent</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Send invitations to grow your team
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {invitations.map((invite: TeamInvitation) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          invite.status === 'pending' ? 'bg-amber-100' :
                          invite.status === 'accepted' ? 'bg-green-100' :
                          'bg-red-100'
                        }`}>
                          {invite.status === 'pending' ? (
                            <Clock className="h-5 w-5 text-amber-600" />
                          ) : invite.status === 'accepted' ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{invite.email}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary">{invite.role}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {invite.status === 'pending' ? 'Pending' :
                               invite.status === 'accepted' ? 'Accepted' :
                               'Expired'}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Sent {new Date(invite.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {invite.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resendInvitationMutation.mutate(invite.id)}
                              disabled={resendInvitationMutation.isPending}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelInvitationMutation.mutate(invite.id)}
                              disabled={cancelInvitationMutation.isPending}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}