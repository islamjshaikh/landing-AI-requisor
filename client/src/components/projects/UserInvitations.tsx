import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { acceptInvitation } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProjectRole } from '@shared/schema';
import { Mail, Check, Users, Clock } from 'lucide-react';

interface UserInvitationsProps {
  invitations: any[];
  isLoading?: boolean;
}

export function UserInvitations({ invitations = [], isLoading = false }: UserInvitationsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const acceptInvitationMutation = useMutation({
    mutationFn: (token: string) => {
      return acceptInvitation(token);
    },
    onSuccess: () => {
      // Invalidate both invitations query and projects query
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      
      toast({
        title: 'Invitation accepted',
        description: 'You have successfully joined the project.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to accept invitation',
        description: error.message || 'Something went wrong while accepting the invitation.',
        variant: 'destructive',
      });
    },
  });

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
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

  // Separate invitations by status
  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');
  const pastInvitations = invitations.filter(inv => inv.status !== 'pending');
  
  // Always render the component, even when there are no invitations
  // This ensures the user can see the history of invitations

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Project Invitations</CardTitle>
        <CardDescription>
          Manage your project collaboration invitations
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Pending Invitations Section */}
        <h3 className="text-lg font-medium mb-4">Pending Invitations</h3>
        
        <div className="relative overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Invited By</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Invited On</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading invitations...</TableCell>
                </TableRow>
              ) : pendingInvitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">You have no pending project invitations.</TableCell>
                </TableRow>
              ) : (
                pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-blue-500" />
                        <span className="font-medium">{invitation.projectName || `Project #${invitation.projectId}`}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-gray-500" />
                        <span>{invitation.invitedByName || invitation.invitedBy}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(invitation.role)}`}>
                        {invitation.role}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(invitation.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1 text-gray-500" />
                        <span>{formatDate(invitation.expiresAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600 border-green-200 hover:border-green-300 hover:bg-green-50"
                        onClick={() => acceptInvitationMutation.mutate(invitation.token)}
                        disabled={acceptInvitationMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Past Invitations Section */}
        <h3 className="text-lg font-medium mb-4">Invitation History</h3>
        
        <div className="relative overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Invited By</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Loading invitation history...</TableCell>
                </TableRow>
              ) : pastInvitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">You have no past invitations.</TableCell>
                </TableRow>
              ) : (
                pastInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-blue-500" />
                        <span className="font-medium">{invitation.projectName || `Project #${invitation.projectId}`}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-gray-500" />
                        <span>{invitation.invitedByName || invitation.invitedBy}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(invitation.role)}`}>
                        {invitation.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        invitation.status === 'accepted' 
                          ? 'bg-green-100 text-green-800' 
                          : invitation.status === 'expired'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {invitation.status === 'accepted' 
                          ? 'Accepted' 
                          : invitation.status === 'expired'
                          ? 'Expired'
                          : 'Rejected'}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(invitation.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}