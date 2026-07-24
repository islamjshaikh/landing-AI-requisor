import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Users, 
  Brain, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  User, 
  Bot, 
  Calendar, 
  BarChart3,
  Filter,
  Plus,
  Zap,
  UserPlus,
  Target,
  ArrowRight,
  Settings,
  TrendingUp,
  Activity,
  Lightbulb,
  Timer,
  UserCheck,
  Shuffle,
  PlayCircle,
  PieChart,
  Search,
  Eye,
  Edit3,
  Coffee,
  Briefcase,
  Sparkles,
  ChevronRight,
  ArrowUpDown,
  Star,
  Loader2,
  Send,
  MessageSquare,
  DollarSign,
  TrendingDown
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  skills: string[];
  capacity: number; // hours per week
  allocated: number; // currently allocated hours
  availability: number; // percentage available
  tasks: SmartTask[];
  performance: number; // 0-100 score
  hourlyRate: number; // for cost calculations
  timezone: string;
  workingHours: string;
}

interface SmartTask {
  id: string;
  title: string;
  description: string;
  estimatedHours: number;
  complexity: 'low' | 'medium' | 'high';
  skills: string[];
  status: 'unassigned' | 'assigned' | 'in-progress' | 'completed';
  assignedTo?: string;
  aiSuitable: boolean;
  deadline: string;
  priority: 'low' | 'medium' | 'high';
  projectId?: string;
  dependencies: string[];
  aiConfidence?: number; // 0-100 for AI task completion confidence
  humanRequired?: boolean; // Tasks that specifically need human touch
}

interface SmartRecommendation {
  taskId: string;
  type: 'human' | 'ai' | 'hybrid';
  assignee?: string;
  confidence: number;
  reasoning: string;
  estimatedCompletion: string;
  costSavings?: number;
  alternativeOptions: Array<{
    type: 'human' | 'ai';
    assignee?: string;
    confidence: number;
    pros: string[];
    cons: string[];
  }>;
}

interface CapacityAlert {
  type: 'overload' | 'underutilized' | 'skill_gap' | 'deadline_risk';
  severity: 'low' | 'medium' | 'high';
  memberId?: string;
  message: string;
  suggestedAction: string;
}

// Mock data - enhanced with more realistic scenarios
const mockTeamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    role: 'Senior Frontend Developer',
    avatar: '👩‍💻',
    skills: ['React', 'TypeScript', 'UI/UX', 'Testing', 'Performance'],
    capacity: 40,
    allocated: 35,
    availability: 12.5,
    performance: 94,
    hourlyRate: 85,
    timezone: 'PST',
    workingHours: '9AM-6PM',
    tasks: []
  },
  {
    id: '2',
    name: 'Mike Rodriguez',
    role: 'Backend Lead',
    avatar: '👨‍💻',
    skills: ['Node.js', 'PostgreSQL', 'API Design', 'DevOps', 'Security'],
    capacity: 40,
    allocated: 38,
    availability: 5,
    performance: 91,
    hourlyRate: 95,
    timezone: 'EST',
    workingHours: '8AM-5PM',
    tasks: []
  },
  {
    id: '3',
    name: 'Emma Thompson',
    role: 'UX Designer',
    avatar: '🎨',
    skills: ['Figma', 'User Research', 'Prototyping', 'Design Systems'],
    capacity: 35,
    allocated: 20,
    availability: 42.8,
    performance: 88,
    hourlyRate: 75,
    timezone: 'GMT',
    workingHours: '10AM-7PM',
    tasks: []
  },
  {
    id: '4',
    name: 'AI Assistant',
    role: 'AI Worker',
    avatar: '🤖',
    skills: ['Content Creation', 'Data Analysis', 'Code Generation', 'Documentation', 'Testing'],
    capacity: 168, // 24/7 availability
    allocated: 45,
    availability: 73.2,
    performance: 82,
    hourlyRate: 15, // Much lower cost
    timezone: 'UTC',
    workingHours: '24/7',
    tasks: []
  }
];

const mockTasks: SmartTask[] = [
  {
    id: '1',
    title: 'Design System Component Library',
    description: 'Create reusable React components following design system guidelines',
    estimatedHours: 16,
    complexity: 'high',
    skills: ['React', 'TypeScript', 'Design Systems'],
    status: 'unassigned',
    aiSuitable: false,
    deadline: '2025-07-15',
    priority: 'high',
    dependencies: [],
    humanRequired: true
  },
  {
    id: '2',
    title: 'API Documentation Generation',
    description: 'Generate comprehensive API documentation from code comments',
    estimatedHours: 8,
    complexity: 'low',
    skills: ['Documentation', 'API Design'],
    status: 'unassigned',
    aiSuitable: true,
    deadline: '2025-07-10',
    priority: 'medium',
    dependencies: [],
    aiConfidence: 95
  },
  {
    id: '3',
    title: 'User Testing Analysis',
    description: 'Analyze user testing results and extract actionable insights',
    estimatedHours: 12,
    complexity: 'medium',
    skills: ['User Research', 'Data Analysis'],
    status: 'unassigned',
    aiSuitable: true,
    deadline: '2025-07-12',
    priority: 'high',
    dependencies: [],
    aiConfidence: 88
  },
  {
    id: '4',
    title: 'Database Optimization',
    description: 'Optimize PostgreSQL queries and improve performance',
    estimatedHours: 20,
    complexity: 'high',
    skills: ['PostgreSQL', 'Performance', 'Backend'],
    status: 'unassigned',
    aiSuitable: false,
    deadline: '2025-07-20',
    priority: 'medium',
    dependencies: [],
    humanRequired: true
  },
  {
    id: '5',
    title: 'Unit Test Generation',
    description: 'Generate comprehensive unit tests for existing components',
    estimatedHours: 10,
    complexity: 'medium',
    skills: ['Testing', 'JavaScript', 'React'],
    status: 'unassigned',
    aiSuitable: true,
    deadline: '2025-07-18',
    priority: 'low',
    dependencies: ['1'],
    aiConfidence: 92
  }
];

// Form schema for adding team member
const addTeamMemberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.string().min(2, "Role is required"),
  skills: z.string().min(2, "At least one skill is required"),
  capacity: z.number().min(1).max(60),
  hourlyRate: z.number().min(1),
  department: z.string().optional(),
  bio: z.string().optional(),
});

type AddTeamMemberForm = z.infer<typeof addTeamMemberSchema>;

// Add Team Member Dialog Component
function AddTeamMemberDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<AddTeamMemberForm>({
    resolver: zodResolver(addTeamMemberSchema),
    defaultValues: {
      name: '',
      email: '',
      role: '',
      skills: '',
      capacity: 40,
      hourlyRate: 75,
      department: '',
      bio: '',
    },
  });

  const createTeamMemberMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/smart-bandwidth/team-members', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/smart-bandwidth/team-members'] });
      toast({
        title: "Team member added",
        description: "The team member has been added successfully.",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error adding team member",
        description: error.message || "Failed to add team member",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddTeamMemberForm) => {
    // Convert skills string to array
    const skills = data.skills.split(',').map(skill => skill.trim()).filter(Boolean);
    
    const teamMemberData = {
      ...data,
      skills,
      avatar: '👤', // Default avatar
      performance: 90, // Default performance
      timezone: 'UTC', // Default timezone
      workingHours: '9:00-17:00', // Default working hours
      isActive: true,
    };
    
    createTeamMemberMutation.mutate(teamMemberData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Team Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Add a new team member to track their bandwidth and capacity.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="john@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Input placeholder="Senior Developer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input placeholder="Engineering" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="skills"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Skills</FormLabel>
                  <FormControl>
                    <Input placeholder="React, TypeScript, Node.js (comma separated)" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter skills separated by commas
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weekly Capacity (hours)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="40" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hourlyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly Rate ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="75" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio (optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Brief description of experience and expertise..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTeamMemberMutation.isPending}>
                {createTeamMemberMutation.isPending ? 'Adding...' : 'Add Team Member'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function SmartBandwidthPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([]);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [activeView, setActiveView] = useState<'dashboard' | 'assignments' | 'ai-assistant'>('dashboard');
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Fetch team members from API
  const { data: apiTeamMembers = [], isLoading: teamMembersLoading } = useQuery({
    queryKey: ['/api/smart-bandwidth/team-members'],
    enabled: !!user,
  });

  // Use real data if available, show empty state otherwise
  const teamMembers = apiTeamMembers.length > 0 ? apiTeamMembers : [];

  // Fetch capacity alerts from API
  const { data: capacityAlerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['/api/smart-bandwidth/capacity-alerts'],
    enabled: !!user,
  });

  // Fetch projects and tasks for the user
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
    enabled: !!user,
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['/api/tasks'],
    enabled: !!user,
  });

  // Convert tasks to SmartTask format and filter by user's projects
  const tasks: SmartTask[] = allTasks
    .filter(task => projects.some(project => project.id === task.projectId))
    .map(task => ({
      id: task.id.toString(),
      title: task.name,
      description: task.description || '',
      estimatedHours: 8, // Default estimated hours
      complexity: (task.priority === 'high' ? 'high' : task.priority === 'low' ? 'low' : 'medium') as 'low' | 'medium' | 'high',
      skills: [], // Will be populated by AI analysis
      status: (task.status === 'done' ? 'completed' : task.status === 'in-progress' ? 'in-progress' : 'unassigned') as 'unassigned' | 'assigned' | 'in-progress' | 'completed',
      assignedTo: task.assigneeId || undefined,
      aiSuitable: task.name.toLowerCase().includes('document') || task.name.toLowerCase().includes('analysis'),
      deadline: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: (task.priority || 'medium') as 'low' | 'medium' | 'high',
      projectId: task.projectId?.toString(),
      dependencies: [],
      aiConfidence: task.name.toLowerCase().includes('document') ? 95 : 60,
      humanRequired: task.priority === 'high'
    }));

  // Mutation for generating smart assignments
  const generateAssignmentsMutation = useMutation({
    mutationFn: () => apiRequest('/api/smart-bandwidth/generate-assignments', { method: 'POST' }),
    onSuccess: (data) => {
      setRecommendations(data.map((assignment: any) => ({
        taskId: assignment.taskId.toString(),
        type: assignment.recommendation.type,
        assignee: assignment.recommendation.assignee,
        confidence: assignment.recommendation.confidence,
        reasoning: assignment.recommendation.reasoning,
        estimatedCompletion: assignment.recommendation.estimatedCompletion,
        costSavings: assignment.recommendation.costSavings,
        alternativeOptions: assignment.alternativeOptions
      })));
      setIsGeneratingRecommendations(false);
      toast({
        title: "Smart assignments generated",
        description: `Generated ${data.length} intelligent task assignments.`,
      });
    },
    onError: (error) => {
      console.error('Error generating assignments:', error);
      setIsGeneratingRecommendations(false);
      toast({
        title: "Error generating assignments",
        description: "Failed to generate smart assignments. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Generate capacity alerts from team members data
  const generatedAlerts: CapacityAlert[] = teamMembers
    .filter(member => member.id !== '4') // Skip AI worker
    .flatMap(member => {
      const alerts = [];
      
      if ((member.availability || 0) < 10) {
        alerts.push({
          type: 'overload',
          severity: 'high',
          memberId: member.id.toString(),
          message: `${member.name} is overallocated (${member.availability || 0}% available)`,
          suggestedAction: 'Redistribute tasks or extend deadlines'
        });
      } else if ((member.availability || 0) > 40) {
        alerts.push({
          type: 'underutilized',
          severity: 'medium',
          memberId: member.id.toString(),
          message: `${member.name} has high availability (${member.availability || 0}% available)`,
          suggestedAction: 'Assign additional tasks or reduce capacity allocation'
        });
      }
      
      return alerts;
    });

  // Check for deadline risks
  const urgentTasks = tasks.filter(task => {
    const deadline = new Date(task.deadline);
    const daysUntilDeadline = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilDeadline <= 7 && task.status === 'unassigned';
  });

  if (urgentTasks.length > 0) {
    generatedAlerts.push({
      type: 'deadline_risk',
      severity: 'high',
      message: `${urgentTasks.length} urgent tasks need assignment within 7 days`,
      suggestedAction: 'Prioritize assignment or use AI assistance'
    });
  }

  // Combine API alerts with generated alerts
  const allCapacityAlerts = [...capacityAlerts, ...generatedAlerts];

  // Generate AI-powered smart recommendations
  const generateSmartRecommendations = async () => {
    if (tasks.length === 0) {
      toast({
        title: "No tasks available",
        description: "Create some tasks in your projects first to generate smart assignments.",
        variant: "destructive",
      });
      return;
    }
    
    if (teamMembers.length === 0) {
      toast({
        title: "No team members found",
        description: "Add team members to your projects or create dedicated team members to generate assignments.",
      });
      return;
    }
    
    setIsGeneratingRecommendations(true);
    generateAssignmentsMutation.mutate();
  };

  // Auto-assign all tasks using AI recommendations
  const autoAssignAllTasks = () => {
    toast({
      title: "Auto-Assignment Complete",
      description: `Assigned ${recommendations.length} tasks based on AI recommendations`,
    });
  };

  // Handle AI chat
  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    
    setIsChatLoading(true);
    const userMessage = chatInput;
    setChatInput('');
    
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // Simulate AI response
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    let aiResponse = '';
    
    // Pattern matching for common queries
    if (userMessage.toLowerCase().includes('overload') || userMessage.toLowerCase().includes('capacity')) {
      const overloadedMembers = teamMembers.filter(m => m.availability < 15 && m.id !== '4');
      aiResponse = `I found ${overloadedMembers.length} team members with high workload: ${overloadedMembers.map(m => `${m.name} (${m.availability}% available)`).join(', ')}. I recommend redistributing tasks or extending deadlines.`;
    } else if (userMessage.toLowerCase().includes('ai tasks') || userMessage.toLowerCase().includes('automate')) {
      const aiSuitableTasks = tasks.filter(t => t.aiSuitable && t.status === 'unassigned');
      aiResponse = `Found ${aiSuitableTasks.length} tasks suitable for AI automation: ${aiSuitableTasks.map(t => t.title).join(', ')}. These could save approximately $${aiSuitableTasks.reduce((sum, t) => sum + (t.estimatedHours * 60), 0)} in labor costs.`;
    } else if (userMessage.toLowerCase().includes('deadline') || userMessage.toLowerCase().includes('urgent')) {
      const urgentTasks = tasks.filter(task => {
        const deadline = new Date(task.deadline);
        const daysUntilDeadline = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysUntilDeadline <= 7;
      });
      aiResponse = `${urgentTasks.length} tasks have deadlines within 7 days: ${urgentTasks.map(t => `${t.title} (${t.deadline})`).join(', ')}. Priority assignment recommended.`;
    } else {
      aiResponse = `I can help you with bandwidth analysis, task assignments, and capacity planning. Try asking about "overloaded team members", "AI-suitable tasks", or "upcoming deadlines".`;
    }
    
    setChatMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    setIsChatLoading(false);
  };

  // Get availability color coding
  const getAvailabilityColor = (availability: number) => {
    if (availability >= 30) return 'text-green-600 bg-green-100';
    if (availability >= 15) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  // Get complexity color coding
  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'bg-green-100 text-green-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'high': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Get priority color coding
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-700';
      case 'medium': return 'bg-blue-100 text-blue-700';
      case 'high': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Filter team members
  const filteredMembers = teamMembers.filter(member => 
    selectedFilter === 'all' || 
    member.role.toLowerCase().includes(selectedFilter.toLowerCase()) ||
    member.skills.some(skill => skill.toLowerCase().includes(selectedFilter.toLowerCase()))
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Sparkles className="h-6 w-6 text-blue-600" />
              Smart Bandwidth+
            </CardTitle>
            <CardDescription>
              Please sign in to access the intelligent bandwidth management system
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="w-full">
              <a href="/api/login">Sign In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <div className="h-10 w-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                Smart Bandwidth+
              </h1>
              <p className="text-xl text-gray-600">
                AI-powered resource planning with intelligent task allocation
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/smart-bandwidth-demo">
                <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                  <Eye className="mr-2 h-4 w-4" />
                  View Demo
                </Button>
              </Link>
              <Button 
                onClick={generateSmartRecommendations}
                disabled={isGeneratingRecommendations}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {isGeneratingRecommendations ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    Generate Smart Recommendations
                  </>
                )}
              </Button>
              {recommendations.length > 0 && (
                <Button 
                  onClick={autoAssignAllTasks}
                  variant="outline"
                  className="border-green-200 text-green-700 hover:bg-green-50"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Auto-Assign All
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Capacity Alerts */}
        {allCapacityAlerts.length > 0 && (
          <div className="mb-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allCapacityAlerts.map((alert, index) => (
                <Card key={index} className={`border-l-4 ${
                  alert.severity === 'high' ? 'border-l-red-500 bg-red-50/50' :
                  alert.severity === 'medium' ? 'border-l-yellow-500 bg-yellow-50/50' :
                  'border-l-blue-500 bg-blue-50/50'
                }`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                        alert.severity === 'high' ? 'text-red-500' :
                        alert.severity === 'medium' ? 'text-yellow-500' :
                        'text-blue-500'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{alert.suggestedAction}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeView} onValueChange={(value) => setActiveView(value as any)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Capacity Dashboard
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Smart Assignments
            </TabsTrigger>
            <TabsTrigger value="ai-assistant" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              AI Assistant
            </TabsTrigger>
          </TabsList>

          {/* Capacity Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Team Overview Stats */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Users className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold">{teamMembers.filter(m => m.id !== '4').length}</p>
                      <p className="text-xs text-muted-foreground">Team Members</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">
                        {teamMembers.reduce((sum, m) => sum + (m.capacity - m.allocated), 0)}h
                      </p>
                      <p className="text-xs text-muted-foreground">Available Capacity</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Bot className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="text-2xl font-bold">{tasks.filter(t => t.aiSuitable).length}</p>
                      <p className="text-xs text-muted-foreground">AI-Suitable Tasks</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-8 w-8 text-emerald-600" />
                    <div>
                      <p className="text-2xl font-bold">
                        ${tasks.filter(t => t.aiSuitable).reduce((sum, t) => sum + (t.estimatedHours * 60), 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Potential AI Savings</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Team Member Cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Team Capacity Overview</h3>
                <div className="flex items-center space-x-2">
                  <AddTeamMemberDialog />
                  <Filter className="h-4 w-4 text-gray-500" />
                  <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by role or skill" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Members</SelectItem>
                      <SelectItem value="developer">Developers</SelectItem>
                      <SelectItem value="designer">Designers</SelectItem>
                      <SelectItem value="react">React Skills</SelectItem>
                      <SelectItem value="ai">AI Workers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredMembers.length === 0 && apiTeamMembers.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="text-center py-12">
                    <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Team Members Yet</h3>
                    <p className="text-gray-600 mb-4">
                      Add your team members to start tracking bandwidth and capacity.
                    </p>
                    <AddTeamMemberDialog />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredMembers.map((member) => (
                  <Card key={member.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{member.avatar}</div>
                        <div className="flex-1">
                          <CardTitle className="text-base">{member.name}</CardTitle>
                          <CardDescription className="text-sm">{member.role}</CardDescription>
                        </div>
                        <Badge className={getAvailabilityColor(member.availability)}>
                          {member.availability}% free
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Capacity Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Capacity</span>
                          <span>{member.allocated}h / {member.capacity}h</span>
                        </div>
                        <Progress 
                          value={(member.allocated / member.capacity) * 100} 
                          className="h-2"
                        />
                      </div>

                      {/* Skills */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {member.skills.slice(0, 3).map((skill) => (
                            <Badge key={skill} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {member.skills.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{member.skills.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Performance & Rate */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Performance</p>
                          <div className="flex items-center space-x-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            <span className="font-medium">{member.performance}%</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Rate</p>
                          <p className="font-medium">${member.hourlyRate}/hr</p>
                        </div>
                      </div>

                      {member.id !== '4' && (
                        <div className="text-xs text-muted-foreground">
                          <p>{member.timezone} • {member.workingHours}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Smart Assignments */}
          <TabsContent value="assignments" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Unassigned Tasks */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Unassigned Tasks ({tasks.filter(t => t.status === 'unassigned').length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      {tasks.filter(t => t.status === 'unassigned').map((task) => (
                        <div key={task.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{task.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className={getPriorityColor(task.priority)}>
                                {task.priority}
                              </Badge>
                              {task.aiSuitable && (
                                <Badge variant="outline" className="text-purple-600 border-purple-200">
                                  <Bot className="h-3 w-3 mr-1" />
                                  AI-Ready
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-4">
                              <span className="flex items-center space-x-1">
                                <Clock className="h-3 w-3" />
                                <span>{task.estimatedHours}h</span>
                              </span>
                              <Badge className={getComplexityColor(task.complexity)}>
                                {task.complexity}
                              </Badge>
                            </div>
                            <span className="text-muted-foreground">{task.deadline}</span>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {task.skills.map((skill) => (
                              <Badge key={skill} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* AI Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Smart Recommendations ({recommendations.length})
                  </CardTitle>
                  <CardDescription>
                    AI-powered assignment suggestions with cost analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    {recommendations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Generate recommendations to see smart assignment suggestions</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {recommendations.map((rec) => {
                          const task = tasks.find(t => t.id === rec.taskId);
                          if (!task) return null;
                          
                          return (
                            <div key={rec.taskId} className="border rounded-lg p-4 space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium">{task.title}</h4>
                                  <p className="text-sm text-muted-foreground mt-1">{rec.reasoning}</p>
                                </div>
                                <Badge 
                                  className={rec.type === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}
                                >
                                  {rec.type === 'ai' ? 'AI Assignment' : 'Human Assignment'}
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center space-x-4">
                                  <span className="flex items-center space-x-1">
                                    <Target className="h-3 w-3" />
                                    <span>{rec.confidence}% confidence</span>
                                  </span>
                                  {rec.costSavings && (
                                    <span className="flex items-center space-x-1 text-green-600">
                                      <DollarSign className="h-3 w-3" />
                                      <span>${rec.costSavings} saved</span>
                                    </span>
                                  )}
                                </div>
                                <span className="text-muted-foreground">
                                  Est: {new Date(rec.estimatedCompletion).toLocaleDateString()}
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="text-sm">
                                  <span className="font-medium">
                                    {rec.type === 'ai' ? 'AI Assistant' : rec.assignee}
                                  </span>
                                </div>
                                <div className="flex space-x-2">
                                  <Button size="sm" variant="outline">
                                    View Details
                                  </Button>
                                  <Button size="sm">
                                    Accept
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AI Assistant */}
          <TabsContent value="ai-assistant" className="space-y-6">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Bandwidth Planning Assistant
                </CardTitle>
                <CardDescription>
                  Ask questions about capacity, task assignments, and resource optimization
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Chat Messages */}
                <ScrollArea className="flex-1 mb-4">
                  <div className="space-y-4">
                    {chatMessages.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="mb-4">Ask me about your team's bandwidth and task assignments</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setChatInput("Which team members are overloaded?")}
                          >
                            Check overloaded members
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setChatInput("What tasks can AI handle?")}
                          >
                            Find AI-suitable tasks
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setChatInput("Show upcoming deadlines")}
                          >
                            Check urgent deadlines
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {chatMessages.map((message, index) => (
                      <div 
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                          className={`max-w-[80%] p-3 rounded-lg ${
                            message.role === 'user' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                        </div>
                      </div>
                    ))}
                    
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 p-3 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Analyzing...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Chat Input */}
                <div className="flex space-x-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about capacity, assignments, or deadlines..."
                    onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                    disabled={isChatLoading}
                  />
                  <Button 
                    onClick={handleChatSubmit}
                    disabled={!chatInput.trim() || isChatLoading}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}