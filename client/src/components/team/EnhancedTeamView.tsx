import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Users, Search, Filter, Plus, Edit, Trash2, Clock, Briefcase, 
  TrendingUp, AlertCircle, CheckCircle, Brain, Zap, BarChart3,
  Calendar, MapPin, Star, Activity, Target, UserPlus, Settings,
  Mail, Shield, Code, Palette, PenTool, Database, Cloud, GitBranch
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Enhanced team member interface
interface TeamMember {
  id: number;
  userId?: string;
  name: string;
  email?: string;
  role: string;
  avatar?: string;
  skills: string[];
  capacity: number;
  allocated: number;
  availability: number;
  performance: number;
  hourlyRate: number;
  timezone: string;
  workingHours: string;
  bio?: string;
  department?: string;
  isActive: boolean;
  currentProjects?: number;
  completedTasks?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface TaskAssignment {
  id: number;
  taskId: number;
  taskTitle: string;
  projectName: string;
  estimatedHours: number;
  deadline: string;
  priority: string;
  status: string;
}

interface WorkloadData {
  teamMemberId: number;
  weeklyHours: number[];
  projectDistribution: { projectName: string; hours: number }[];
  upcomingDeadlines: { taskTitle: string; deadline: string; hours: number }[];
}

// Role icons mapping
const roleIcons: Record<string, React.ElementType> = {
  'developer': Code,
  'designer': Palette,
  'pm': Briefcase,
  'writer': PenTool,
  'devops': Cloud,
  'qa': CheckCircle,
  'analyst': BarChart3,
  'architect': GitBranch,
  'admin': Shield
};

export default function EnhancedTeamView() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedSkill, setSelectedSkill] = useState('all');
  const [capacityFilter, setCapacityFilter] = useState('all');
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showWorkloadDetails, setShowWorkloadDetails] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  
  // New member form state
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    role: 'developer',
    skills: '',
    capacity: 40,
    hourlyRate: 100,
    timezone: 'UTC',
    workingHours: '9:00-17:00',
    department: '',
    bio: ''
  });

  // Fetch team members with enhanced data
  const { data: teamMembers = [], isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members/enhanced'],
  });

  // Fetch workload data for selected member
  const { data: workloadData, isLoading: workloadLoading } = useQuery<WorkloadData>({
    queryKey: ['/api/team/workload', selectedMember?.id],
    enabled: !!selectedMember
  });

  // Fetch task assignments for selected member
  const { data: taskAssignments = [] } = useQuery<TaskAssignment[]>({
    queryKey: ['/api/team/assignments', selectedMember?.id],
    enabled: !!selectedMember
  });

  // Get all unique skills from team members
  const allSkills = useMemo(() => {
    const skills = new Set<string>();
    teamMembers.forEach(member => {
      member.skills?.forEach(skill => skills.add(skill));
    });
    return Array.from(skills).sort();
  }, [teamMembers]);

  // Filter team members based on search and filters
  const filteredMembers = useMemo(() => {
    return teamMembers.filter(member => {
      // Search filter
      if (searchQuery && !member.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !member.email?.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !member.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()))) {
        return false;
      }

      // Role filter
      if (selectedRole !== 'all' && member.role !== selectedRole) {
        return false;
      }

      // Skill filter
      if (selectedSkill !== 'all' && !member.skills.includes(selectedSkill)) {
        return false;
      }

      // Capacity filter
      if (capacityFilter === 'overloaded' && member.availability >= 20) {
        return false;
      }
      if (capacityFilter === 'underutilized' && member.availability <= 50) {
        return false;
      }
      if (capacityFilter === 'available' && member.availability <= 20) {
        return false;
      }

      return true;
    });
  }, [teamMembers, searchQuery, selectedRole, selectedSkill, capacityFilter]);

  // Create team member mutation
  const createMemberMutation = useMutation({
    mutationFn: (data: typeof newMember) => 
      apiRequest('/api/team/members', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          skills: data.skills.split(',').map(s => s.trim()).filter(Boolean),
          hourlyRate: Math.round(data.hourlyRate * 100), // Convert to cents
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members/enhanced'] });
      setShowAddMember(false);
      resetNewMemberForm();
      toast({
        title: "Team member added",
        description: "Successfully added new team member.",
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

  // Update team member mutation
  const updateMemberMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TeamMember> }) =>
      apiRequest(`/api/team/members/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members/enhanced'] });
      toast({
        title: "Member updated",
        description: "Team member details updated successfully.",
      });
    }
  });

  // Delete team member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/team/members/${id}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members/enhanced'] });
      setSelectedMember(null);
      toast({
        title: "Member removed",
        description: "Team member removed successfully.",
      });
    }
  });

  const resetNewMemberForm = () => {
    setNewMember({
      name: '',
      email: '',
      role: 'developer',
      skills: '',
      capacity: 40,
      hourlyRate: 100,
      timezone: 'UTC',
      workingHours: '9:00-17:00',
      department: '',
      bio: ''
    });
  };

  const getAvailabilityColor = (availability: number) => {
    if (availability < 10) return 'text-red-600 bg-red-50';
    if (availability < 30) return 'text-orange-600 bg-orange-50';
    if (availability < 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getPerformanceIcon = (performance: number) => {
    if (performance >= 90) return <Star className="h-4 w-4 text-yellow-500" />;
    if (performance >= 80) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (performance >= 70) return <Activity className="h-4 w-4 text-blue-500" />;
    return <AlertCircle className="h-4 w-4 text-orange-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Team Members
          </h2>
          <p className="text-muted-foreground">
            Manage your team, track workload, and optimize task assignments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowAiAssistant(true)}
            className="flex items-center gap-2"
          >
            <Brain className="h-4 w-4" />
            AI Assistant
          </Button>
          <Button onClick={() => setShowAddMember(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Filters and search */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="developer">Developer</SelectItem>
                <SelectItem value="designer">Designer</SelectItem>
                <SelectItem value="pm">Project Manager</SelectItem>
                <SelectItem value="qa">QA Engineer</SelectItem>
                <SelectItem value="devops">DevOps</SelectItem>
                <SelectItem value="analyst">Analyst</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedSkill} onValueChange={setSelectedSkill}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by skill" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Skills</SelectItem>
                {allSkills.map(skill => (
                  <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={capacityFilter} onValueChange={setCapacityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by capacity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Capacity</SelectItem>
                <SelectItem value="available">Available (&gt;20%)</SelectItem>
                <SelectItem value="underutilized">Underutilized (&gt;50%)</SelectItem>
                <SelectItem value="overloaded">Overloaded (&lt;20%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Team members grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {membersLoading ? (
          <div className="col-span-full text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading team members...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No team members found matching your filters</p>
          </div>
        ) : (
          filteredMembers.map((member) => (
            <Card key={member.id} className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedMember(member)}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback>
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{member.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        {React.createElement(roleIcons[member.role] || Briefcase, { className: "h-3 w-3" })}
                        {member.role}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {getPerformanceIcon(member.performance)}
                    <span className="text-sm font-medium">{member.performance}%</span>
                  </div>
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {member.skills.slice(0, 3).map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {member.skills.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{member.skills.length - 3}
                    </Badge>
                  )}
                </div>

                {/* Workload bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Workload</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className={cn("font-medium px-2 py-0.5 rounded", getAvailabilityColor(member.availability))}>
                            {member.availability}% available
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{member.allocated}h / {member.capacity}h allocated this week</p>
                          <p className="text-xs text-muted-foreground">{member.currentProjects || 0} active projects</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Progress value={((member.capacity - member.allocated) / member.capacity) * 100} className="h-2" />
                </div>

                {/* Quick info */}
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {member.timezone}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {member.workingHours}
                  </span>
                  <span className="font-medium">${(member.hourlyRate / 100).toFixed(0)}/hr</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Member Dialog */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add a new member to your team
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newMember.role} onValueChange={(value) => setNewMember({ ...newMember, role: value })}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="designer">Designer</SelectItem>
                  <SelectItem value="pm">Project Manager</SelectItem>
                  <SelectItem value="qa">QA Engineer</SelectItem>
                  <SelectItem value="devops">DevOps</SelectItem>
                  <SelectItem value="analyst">Analyst</SelectItem>
                  <SelectItem value="writer">Content Writer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="skills">Skills (comma-separated)</Label>
              <Input
                id="skills"
                value={newMember.skills}
                onChange={(e) => setNewMember({ ...newMember, skills: e.target.value })}
                placeholder="React, TypeScript, Node.js"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="capacity">Capacity (hrs/week)</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={newMember.capacity}
                  onChange={(e) => setNewMember({ ...newMember, capacity: parseInt(e.target.value) || 40 })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  value={newMember.hourlyRate}
                  onChange={(e) => setNewMember({ ...newMember, hourlyRate: parseInt(e.target.value) || 100 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={newMember.timezone} onValueChange={(value) => setNewMember({ ...newMember, timezone: value })}>
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="EST">EST</SelectItem>
                    <SelectItem value="PST">PST</SelectItem>
                    <SelectItem value="GMT">GMT</SelectItem>
                    <SelectItem value="CET">CET</SelectItem>
                    <SelectItem value="JST">JST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="workingHours">Working Hours</Label>
                <Input
                  id="workingHours"
                  value={newMember.workingHours}
                  onChange={(e) => setNewMember({ ...newMember, workingHours: e.target.value })}
                  placeholder="9:00-17:00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMember(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMemberMutation.mutate(newMember)} disabled={createMemberMutation.isPending}>
              {createMemberMutation.isPending ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Details Dialog */}
      {selectedMember && (
        <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedMember.avatar} />
                  <AvatarFallback>
                    {selectedMember.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                {selectedMember.name}
              </DialogTitle>
              <DialogDescription>
                {selectedMember.role} • {selectedMember.email}
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="workload">Workload</TabsTrigger>
                <TabsTrigger value="assignments">Assignments</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedMember.skills.map((skill) => (
                        <Badge key={skill} variant="secondary">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Availability</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Capacity</span>
                        <span className="text-sm font-medium">{selectedMember.capacity}h/week</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Allocated</span>
                        <span className="text-sm font-medium">{selectedMember.allocated}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Available</span>
                        <span className={cn("text-sm font-medium", 
                          selectedMember.availability < 20 ? "text-red-600" : "text-green-600"
                        )}>
                          {selectedMember.availability}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Work Info</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Timezone:</span> {selectedMember.timezone}</p>
                      <p><span className="text-muted-foreground">Hours:</span> {selectedMember.workingHours}</p>
                      <p><span className="text-muted-foreground">Rate:</span> ${(selectedMember.hourlyRate / 100).toFixed(0)}/hr</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Performance</h4>
                    <div className="flex items-center gap-2">
                      <Progress value={selectedMember.performance} className="flex-1" />
                      <span className="text-sm font-medium">{selectedMember.performance}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Based on {selectedMember.completedTasks || 0} completed tasks
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1">
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Target className="h-4 w-4 mr-2" />
                    Assign Task
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Brain className="h-4 w-4 mr-2" />
                    AI Suggest
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="workload">
                {workloadLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Workload visualization coming soon...</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="assignments">
                <div className="space-y-2">
                  {taskAssignments.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">No active assignments</p>
                  ) : (
                    taskAssignments.map((assignment) => (
                      <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{assignment.taskTitle}</p>
                          <p className="text-sm text-muted-foreground">{assignment.projectName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{assignment.estimatedHours}h</p>
                          <p className="text-xs text-muted-foreground">Due {new Date(assignment.deadline).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              <Button variant="destructive" onClick={() => {
                if (confirm('Are you sure you want to remove this team member?')) {
                  deleteMemberMutation.mutate(selectedMember.id);
                }
              }}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Member
              </Button>
              <Button variant="outline" onClick={() => setSelectedMember(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}