import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserInvitations } from '@/lib/api';
import { UserInvitations } from '@/components/projects/UserInvitations';
import { TeamInviteForm } from '@/components/team/TeamInviteForm';
import { Helmet } from '../components/shared/Helmet';
import { PageHeader } from '../components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Mail, Plus, MessageSquare } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';

export default function Team() {
  // Fetch user invitations
  const { data: invitations = [], isLoading: isLoadingInvitations } = useQuery({
    queryKey: ['/api/invitations'],
    queryFn: () => getUserInvitations(),
  });

  // Fetch projects for the invitation form
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();
  
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Helmet 
        title="Team Collaboration" 
        description="Manage your project team members and invitations" 
      />
      
      <PageHeader
        title="Team Collaboration"
        description="Invite team members and manage project collaborations"
        icon={<Users className="h-6 w-6" />}
      />
      
      <Tabs defaultValue="invite" className="mt-8">
        <TabsList className="grid w-full md:w-auto grid-cols-2 mb-6">
          <TabsTrigger value="invite" className="flex items-center">
            <Plus className="mr-2 h-4 w-4" />
            <span>Invite Members</span>
          </TabsTrigger>
          <TabsTrigger value="invitations" className="flex items-center">
            <Mail className="mr-2 h-4 w-4" />
            <span>Your Invitations</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="invite" className="mt-0">
          <div className="grid gap-8 md:grid-cols-2">
            <TeamInviteForm 
              projects={projects} 
              isLoadingProjects={isLoadingProjects} 
            />
            
            <div className="space-y-6">
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageSquare className="mr-2 h-5 w-5 text-primary" />
                    Team Chat
                  </CardTitle>
                  <CardDescription>
                    Communicate with your team members in real-time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 border rounded-md p-6 flex flex-col items-center justify-center text-center">
                    <div className="bg-primary/10 text-primary rounded-full p-3 mb-3">
                      <MessageSquare className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Team Chat Coming Soon</h3>
                    <p className="text-slate-600 max-w-xs">
                      Real-time messaging features will be available in the next update. You'll be able to communicate with your team directly within projects.
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
                <CardHeader>
                  <CardTitle className="text-blue-700">How Team Collaboration Works</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <h3 className="text-md font-medium text-blue-800">Invite Team Members:</h3>
                    <ol className="space-y-2 text-slate-700 list-decimal pl-5">
                      <li className="pl-1">Enter your team member's email address</li>
                      <li className="pl-1">Select which project to add them to</li>
                      <li className="pl-1">Choose their permission level:
                        <ul className="pl-5 mt-1 space-y-1">
                          <li className="text-sm list-disc"><span className="font-medium">Viewer:</span> Can only view projects and tasks</li>
                          <li className="text-sm list-disc"><span className="font-medium">Editor:</span> Can create and edit tasks</li>
                          <li className="text-sm list-disc"><span className="font-medium">Owner:</span> Full access, including member management</li>
                        </ul>
                      </li>
                      <li className="pl-1">They'll receive an email invitation to join</li>
                    </ol>
                    
                    <h3 className="text-md font-medium text-blue-800 pt-2">After They Join:</h3>
                    <ul className="space-y-2 text-slate-700">
                      <li className="flex items-start">
                        <div className="bg-blue-100 rounded-full p-1 text-blue-700 mr-2 mt-0.5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <span>Assign them tasks within the shared project</span>
                      </li>
                      <li className="flex items-start">
                        <div className="bg-blue-100 rounded-full p-1 text-blue-700 mr-2 mt-0.5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <span>Track progress together in real-time</span>
                      </li>
                      <li className="flex items-start">
                        <div className="bg-blue-100 rounded-full p-1 text-blue-700 mr-2 mt-0.5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <span>Collaborate on planning and execution</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="invitations" className="mt-0">
          {/* Project Invitations Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="mr-2 h-5 w-5 text-primary" />
                Your Project Invitations
              </CardTitle>
              <CardDescription>
                View and respond to invitations from other team members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserInvitations 
                invitations={invitations} 
                isLoading={isLoadingInvitations} 
              />
              
              {invitations.length === 0 && !isLoadingInvitations && (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <div className="bg-gray-100 text-gray-400 rounded-full p-4 mb-3">
                    <Mail className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No Pending Invitations</h3>
                  <p className="text-slate-600 max-w-md">
                    When someone invites you to collaborate on a project, the invitation will appear here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Project Member Management Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5 text-primary" />
                Manage Existing Teams
              </CardTitle>
              <CardDescription>
                View and manage team members for the projects you own
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">
                You can view and manage team members for projects where you have owner permissions.
              </p>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <h4 className="font-medium text-slate-800 mb-2">View Team Members</h4>
                  <p className="text-slate-600 text-sm mb-3">
                    Access the detailed view of any project to see all team members and their roles.
                  </p>
                  <a href="/projects" className="text-primary hover:underline text-sm inline-flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                    </svg>
                    Go to Projects
                  </a>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <h4 className="font-medium text-slate-800 mb-2">Assign Tasks</h4>
                  <p className="text-slate-600 text-sm mb-3">
                    Once team members have joined, you can assign tasks and track their progress.
                  </p>
                  <a href="/projects" className="text-primary hover:underline text-sm inline-flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                    </svg>
                    Manage Tasks
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}