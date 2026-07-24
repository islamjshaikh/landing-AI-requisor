import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Briefcase
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
  tasks: Task[];
  performance: number; // 0-100 score
}

interface Task {
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
}

interface AIRecommendation {
  taskId: string;
  type: 'human' | 'ai';
  assignee?: string;
  confidence: number;
  reasoning: string;
}

const mockTeamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    role: 'Frontend Developer',
    avatar: '👩‍💻',
    skills: ['React', 'TypeScript', 'UI/UX'],
    capacity: 40,
    allocated: 32,
    availability: 20,
    performance: 92,
    tasks: []
  },
  {
    id: '2',
    name: 'Mike Rodriguez',
    role: 'Backend Developer',
    avatar: '👨‍💻',
    skills: ['Node.js', 'PostgreSQL', 'API Design'],
    capacity: 40,
    allocated: 38,
    availability: 5,
    performance: 88,
    tasks: []
  },
  {
    id: '3',
    name: 'Emma Thompson',
    role: 'Product Manager',
    avatar: '👩‍💼',
    skills: ['Strategy', 'Requirements', 'Analytics'],
    capacity: 40,
    allocated: 25,
    availability: 37.5,
    performance: 95,
    tasks: []
  },
  {
    id: '4',
    name: 'David Kim',
    role: 'Designer',
    avatar: '🎨',
    skills: ['Figma', 'Branding', 'User Research'],
    capacity: 40,
    allocated: 20,
    availability: 50,
    performance: 90,
    tasks: []
  }
];

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Implement user authentication',
    description: 'Build secure login and registration system',
    estimatedHours: 16,
    complexity: 'high',
    skills: ['React', 'Node.js', 'Security'],
    status: 'unassigned',
    aiSuitable: false,
    deadline: '2025-07-10',
    priority: 'high'
  },
  {
    id: '2',
    title: 'Write project documentation',
    description: 'Create comprehensive API documentation',
    estimatedHours: 8,
    complexity: 'medium',
    skills: ['Writing', 'Technical Documentation'],
    status: 'unassigned',
    aiSuitable: true,
    deadline: '2025-07-08',
    priority: 'medium'
  },
  {
    id: '3',
    title: 'Design onboarding flow',
    description: 'Create user-friendly onboarding wireframes',
    estimatedHours: 12,
    complexity: 'medium',
    skills: ['Figma', 'User Research', 'UI/UX'],
    status: 'unassigned',
    aiSuitable: false,
    deadline: '2025-07-12',
    priority: 'high'
  },
  {
    id: '4',
    title: 'Generate marketing copy',
    description: 'Write compelling product descriptions and headlines',
    estimatedHours: 6,
    complexity: 'low',
    skills: ['Copywriting', 'Marketing'],
    status: 'unassigned',
    aiSuitable: true,
    deadline: '2025-07-06',
    priority: 'medium'
  }
];

export default function BandwidthPlannerPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(mockTeamMembers);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'tasks' | 'ai-assistant'>('dashboard');

  const getAvailabilityColor = (availability: number) => {
    if (availability >= 30) return 'text-green-600 bg-green-100';
    if (availability >= 15) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'bg-green-100 text-green-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'high': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-700';
      case 'medium': return 'bg-blue-100 text-blue-700';
      case 'high': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const generateAIRecommendations = async () => {
    setIsGeneratingRecommendations(true);
    
    // Simulate AI analysis
    setTimeout(() => {
      const recommendations: AIRecommendation[] = [
        {
          taskId: '1',
          type: 'human',
          assignee: '2',
          confidence: 85,
          reasoning: 'Mike has strong Node.js skills and security experience'
        },
        {
          taskId: '2',
          type: 'ai',
          confidence: 95,
          reasoning: 'AI can efficiently generate technical documentation'
        },
        {
          taskId: '3',
          type: 'human',
          assignee: '4',
          confidence: 90,
          reasoning: 'David has excellent design skills and availability'
        },
        {
          taskId: '4',
          type: 'ai',
          confidence: 88,
          reasoning: 'AI excels at marketing copy generation'
        }
      ];
      
      setAiRecommendations(recommendations);
      setIsGeneratingRecommendations(false);
    }, 2000);
  };

  const assignTask = (taskId: string, assigneeId?: string) => {
    setTasks(tasks.map(task => 
      task.id === taskId 
        ? { ...task, status: 'assigned', assignedTo: assigneeId }
        : task
    ));

    if (assigneeId) {
      setTeamMembers(teamMembers.map(member => 
        member.id === assigneeId 
          ? { 
              ...member, 
              allocated: member.allocated + (tasks.find(t => t.id === taskId)?.estimatedHours || 0),
              availability: ((member.capacity - member.allocated - (tasks.find(t => t.id === taskId)?.estimatedHours || 0)) / member.capacity) * 100
            }
          : member
      ));
    }
  };

  const filteredTeamMembers = selectedFilter === 'all' 
    ? teamMembers 
    : teamMembers.filter(member => member.role.toLowerCase().includes(selectedFilter.toLowerCase()));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Bandwidth & Task Allocation
              </h1>
              <p className="text-xl text-gray-600">
                AI-powered resource planning and smart task assignment
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                onClick={generateAIRecommendations}
                disabled={isGeneratingRecommendations}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {isGeneratingRecommendations ? (
                  <>
                    <Activity className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    Get AI Recommendations
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-4 mb-8">
          {[
            { id: 'dashboard', label: 'Team Dashboard', icon: BarChart3 },
            { id: 'tasks', label: 'Task Management', icon: Target },
            { id: 'ai-assistant', label: 'AI Assistant', icon: Bot }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeView === tab.id ? "default" : "outline"}
                onClick={() => setActiveView(tab.id as 'dashboard' | 'tasks' | 'ai-assistant')}
                className={`flex items-center space-x-2 ${
                  activeView === tab.id 
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600' 
                    : 'hover:bg-blue-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </Button>
            );
          })}
        </div>

        {/* Team Dashboard View */}
        {activeView === 'dashboard' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Total Team</p>
                      <p className="text-2xl font-bold">{teamMembers.length}</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm">Available</p>
                      <p className="text-2xl font-bold">
                        {teamMembers.filter(m => m.availability >= 20).length}
                      </p>
                    </div>
                    <UserCheck className="h-8 w-8 text-green-200" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-sm">Overloaded</p>
                      <p className="text-2xl font-bold">
                        {teamMembers.filter(m => m.availability < 10).length}
                      </p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-200" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm">Unassigned Tasks</p>
                      <p className="text-2xl font-bold">
                        {tasks.filter(t => t.status === 'unassigned').length}
                      </p>
                    </div>
                    <Timer className="h-8 w-8 text-purple-200" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-4 mb-6">
              <Filter className="h-5 w-5 text-gray-500" />
              <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="developer">Developers</SelectItem>
                  <SelectItem value="designer">Designers</SelectItem>
                  <SelectItem value="manager">Managers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Team Members Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {filteredTeamMembers.map((member) => (
                <Card key={member.id} className="hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-3xl">{member.avatar}</div>
                        <div>
                          <CardTitle className="text-lg">{member.name}</CardTitle>
                          <CardDescription>{member.role}</CardDescription>
                        </div>
                      </div>
                      <Badge className={`${getAvailabilityColor(member.availability)} font-semibold`}>
                        {member.availability.toFixed(0)}% available
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    {/* Capacity Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Capacity</span>
                        <span>{member.allocated}h / {member.capacity}h</span>
                      </div>
                      <Progress 
                        value={(member.allocated / member.capacity) * 100} 
                        className="h-2"
                      />
                    </div>

                    {/* Skills */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Skills</h4>
                      <div className="flex flex-wrap gap-1">
                        {member.skills.map((skill, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Performance */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-600">Performance</span>
                      </div>
                      <Badge variant="outline" className="font-semibold">
                        {member.performance}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Task Management View */}
        {activeView === 'tasks' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Unassigned Tasks */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Timer className="mr-2 h-5 w-5" />
                    Unassigned Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {tasks.filter(task => task.status === 'unassigned').map((task) => (
                      <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-900">{task.title}</h4>
                          <div className="flex items-center space-x-2">
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                            <Badge className={getComplexityColor(task.complexity)}>
                              {task.complexity}
                            </Badge>
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>{task.estimatedHours}h</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4" />
                              <span>{task.deadline}</span>
                            </div>
                            {task.aiSuitable && (
                              <div className="flex items-center space-x-1 text-purple-600">
                                <Bot className="h-4 w-4" />
                                <span>AI-suitable</span>
                              </div>
                            )}
                          </div>
                          
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-1" />
                            Assign
                          </Button>
                        </div>

                        {/* Skills Required */}
                        <div className="mt-3">
                          <div className="flex flex-wrap gap-1">
                            {task.skills.map((skill, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Brain className="mr-2 h-5 w-5" />
                    AI Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {aiRecommendations.length === 0 ? (
                    <div className="text-center py-8">
                      <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">
                        Click "Get AI Recommendations" to analyze tasks and team capacity
                      </p>
                      <Button 
                        onClick={generateAIRecommendations}
                        disabled={isGeneratingRecommendations}
                        className="bg-gradient-to-r from-purple-600 to-blue-600"
                      >
                        <Lightbulb className="mr-2 h-4 w-4" />
                        Analyze Now
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {aiRecommendations.map((rec) => {
                        const task = tasks.find(t => t.id === rec.taskId);
                        const assignee = rec.assignee ? teamMembers.find(m => m.id === rec.assignee) : null;
                        
                        return (
                          <div key={rec.taskId} className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-purple-50">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold text-gray-900">{task?.title}</h4>
                              <Badge className="bg-purple-100 text-purple-700">
                                {rec.confidence}% confidence
                              </Badge>
                            </div>
                            
                            <div className="flex items-center space-x-2 mb-2">
                              {rec.type === 'ai' ? (
                                <div className="flex items-center space-x-2 text-purple-600">
                                  <Bot className="h-4 w-4" />
                                  <span className="font-medium">AI Agent Recommended</span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2 text-blue-600">
                                  <User className="h-4 w-4" />
                                  <span className="font-medium">
                                    Assign to {assignee?.name}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-3">{rec.reasoning}</p>
                            
                            <div className="flex justify-end space-x-2">
                              <Button size="sm" variant="outline">
                                <Edit3 className="h-4 w-4 mr-1" />
                                Override
                              </Button>
                              <Button 
                                size="sm" 
                                onClick={() => assignTask(rec.taskId, rec.assignee)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Accept
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* AI Assistant View */}
        {activeView === 'ai-assistant' && (
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-2xl">
                  <Bot className="mr-3 h-6 w-6" />
                  AI Resource Planning Assistant
                </CardTitle>
                <CardDescription>
                  Ask me anything about team capacity, task assignment, or resource planning
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* AI Capabilities */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <PieChart className="mr-2 h-4 w-4 text-blue-600" />
                      Capacity Analysis
                    </h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• "Who has time for a 10-hour design task?"</li>
                      <li>• "Show me availability for next week"</li>
                      <li>• "Who's overloaded this sprint?"</li>
                    </ul>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <Target className="mr-2 h-4 w-4 text-green-600" />
                      Smart Assignment
                    </h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• "Assign all unassigned tasks this sprint"</li>
                      <li>• "What tasks can AI handle?"</li>
                      <li>• "Rebalance this week's workload"</li>
                    </ul>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <Brain className="mr-2 h-4 w-4 text-purple-600" />
                      AI Automation
                    </h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• "Draft project specification"</li>
                      <li>• "Create kickoff email template"</li>
                      <li>• "Generate status report"</li>
                    </ul>
                  </div>
                  
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <TrendingUp className="mr-2 h-4 w-4 text-orange-600" />
                      Planning & Forecasting
                    </h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• "Forecast capacity for next 2 weeks"</li>
                      <li>• "Do we need more frontend hours?"</li>
                      <li>• "Suggest timeline adjustments"</li>
                    </ul>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center">
                    <Zap className="mr-2 h-4 w-4" />
                    Quick Actions
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button variant="outline" className="justify-start h-auto p-4">
                      <div className="text-left">
                        <div className="font-medium">Auto-assign this sprint</div>
                        <div className="text-sm text-gray-500">Let AI assign all unassigned tasks</div>
                      </div>
                    </Button>
                    
                    <Button variant="outline" className="justify-start h-auto p-4">
                      <div className="text-left">
                        <div className="font-medium">Capacity forecast</div>
                        <div className="text-sm text-gray-500">Generate 2-week capacity report</div>
                      </div>
                    </Button>
                    
                    <Button variant="outline" className="justify-start h-auto p-4">
                      <div className="text-left">
                        <div className="font-medium">Rebalance workload</div>
                        <div className="text-sm text-gray-500">Redistribute overallocated tasks</div>
                      </div>
                    </Button>
                    
                    <Button variant="outline" className="justify-start h-auto p-4">
                      <div className="text-left">
                        <div className="font-medium">AI task analysis</div>
                        <div className="text-sm text-gray-500">Find tasks suitable for AI automation</div>
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Chat Interface Placeholder */}
                <div className="mt-8 border-t pt-6">
                  <div className="bg-gray-50 rounded-lg p-4 mb-4 text-center">
                    <Coffee className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">
                      Chat interface coming soon! This will integrate with the main AI agent for natural language resource planning.
                    </p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Input 
                      placeholder="Ask me about team capacity, task assignment, or resource planning..."
                      className="flex-1"
                      disabled
                    />
                    <Button disabled>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}