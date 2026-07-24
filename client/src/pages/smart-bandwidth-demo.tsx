import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, TrendingUp, Users, Clock, DollarSign, ArrowRight, Bot, User, Star } from "lucide-react";
import { Link } from "wouter";

// Demo data for the Smart Bandwidth feature
const demoTeamMembers = [
  {
    id: "1",
    name: "Sarah Chen",
    role: "Frontend Developer",
    capacity: 35,
    maxCapacity: 40,
    availability: 87.5,
    performance: 94,
    hourlyRate: 85,
    skills: ["React", "TypeScript", "UI/UX"],
    timezone: "PST • 9AM-6PM",
    currentTasks: 4,
    completedTasks: 28,
    avgTaskTime: "2.3 days"
  },
  {
    id: "2", 
    name: "Mike Rodriguez",
    role: "Tech Lead",
    capacity: 38,
    maxCapacity: 40,
    availability: 95,
    performance: 91,
    hourlyRate: 95,
    skills: ["Node.js", "PostgreSQL", "API Design"],
    timezone: "EST • 8AM-5PM", 
    currentTasks: 3,
    completedTasks: 42,
    avgTaskTime: "1.8 days"
  },
  {
    id: "3",
    name: "Emma Thompson", 
    role: "UX Designer",
    capacity: 20,
    maxCapacity: 35,
    availability: 57.1,
    performance: 88,
    hourlyRate: 75,
    skills: ["Figma", "User Research", "Prototyping"],
    timezone: "GMT • 10AM-7PM",
    currentTasks: 2,
    completedTasks: 19,
    avgTaskTime: "3.1 days"
  },
  {
    id: "4",
    name: "AI Assistant",
    role: "AI Worker", 
    capacity: 45,
    maxCapacity: 168,
    availability: 73.2,
    performance: 82,
    hourlyRate: 15,
    skills: ["Content Creation", "Data Analysis", "Code Generation"],
    timezone: "24/7 Available",
    currentTasks: 8,
    completedTasks: 156,
    avgTaskTime: "0.5 days"
  }
];

const demoTasks = [
  {
    id: "1",
    title: "Design new user onboarding flow",
    complexity: "Medium",
    priority: "High",
    estimatedHours: 16,
    skills: ["UI/UX", "Figma", "User Research"],
    status: "unassigned",
    project: "Mobile App Redesign"
  },
  {
    id: "2", 
    title: "Implement payment integration API",
    complexity: "High",
    priority: "High", 
    estimatedHours: 24,
    skills: ["Node.js", "API Design", "PostgreSQL"],
    status: "unassigned",
    project: "E-commerce Platform"
  },
  {
    id: "3",
    title: "Create marketing landing page copy",
    complexity: "Low",
    priority: "Medium",
    estimatedHours: 4,
    skills: ["Content Creation", "Marketing"],
    status: "unassigned", 
    project: "Marketing Campaign"
  },
  {
    id: "4",
    title: "Optimize database queries",
    complexity: "Medium",
    priority: "Medium",
    estimatedHours: 8,
    skills: ["PostgreSQL", "Performance"],
    status: "unassigned",
    project: "Performance Optimization"
  }
];

const demoRecommendations = [
  {
    taskId: "1",
    taskTitle: "Design new user onboarding flow",
    type: "human",
    assignee: "Emma Thompson",
    confidence: 92,
    reasoning: "Perfect skill match for UX/UI work with strong design portfolio",
    costSaving: 0,
    estimatedCompletion: "3 days"
  },
  {
    taskId: "2",
    taskTitle: "Implement payment integration API", 
    type: "human",
    assignee: "Mike Rodriguez",
    confidence: 95,
    reasoning: "Tech lead with extensive API development experience",
    costSaving: 0,
    estimatedCompletion: "2 days"
  },
  {
    taskId: "3",
    taskTitle: "Create marketing landing page copy",
    type: "ai",
    assignee: "AI Assistant",
    confidence: 88,
    reasoning: "AI excels at content creation tasks with faster turnaround",
    costSaving: 240,
    estimatedCompletion: "4 hours"
  },
  {
    taskId: "4",
    taskTitle: "Optimize database queries",
    type: "human", 
    assignee: "Mike Rodriguez",
    confidence: 89,
    reasoning: "Database expertise required for complex optimization",
    costSaving: 0,
    estimatedCompletion: "1 day"
  }
];

const demoCapacityAlerts = [
  {
    type: "overload",
    severity: "high",
    member: "Mike Rodriguez",
    message: "Mike is at 95% capacity with 3 high-priority tasks",
    suggestion: "Consider redistributing tasks or extending deadlines"
  },
  {
    type: "underutilized", 
    severity: "medium",
    member: "Emma Thompson",
    message: "Emma has 43% available capacity this week",
    suggestion: "Assign additional UX tasks or cross-training opportunities"
  },
  {
    type: "skill_gap",
    severity: "low", 
    member: "Team",
    message: "No team members available for React Native development",
    suggestion: "Consider hiring specialist or AI assistance for mobile tasks"
  }
];

export default function SmartBandwidthDemo() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const totalCapacity = demoTeamMembers.reduce((sum, member) => sum + member.capacity, 0);
  const totalMaxCapacity = demoTeamMembers.reduce((sum, member) => sum + member.maxCapacity, 0);
  const aiSuitableTasks = demoTasks.filter(task => 
    task.complexity === "Low" || task.skills.some(skill => 
      ["Content Creation", "Data Analysis", "Code Generation"].includes(skill)
    )
  ).length;
  const potentialSavings = demoRecommendations
    .filter(rec => rec.type === "ai")
    .reduce((sum, rec) => sum + rec.costSaving, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Smart Bandwidth Demo</h1>
          <p className="text-muted-foreground mt-1">
            Experience AI-powered task allocation and capacity planning
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Demo Mode
          </Badge>
          <Link href="/smart-bandwidth">
            <Button variant="outline" className="gap-2">
              Go to Live Version <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Tutorial Banner */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <Star className="w-5 h-5" />
            How Smart Bandwidth Works
          </CardTitle>
          <CardDescription className="text-blue-700">
            This demo shows how our AI analyzes your team's capacity, skills, and performance to optimize task assignments and identify cost-saving opportunities.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">Capacity Dashboard</TabsTrigger>
          <TabsTrigger value="assignments">Smart Assignments</TabsTrigger>
          <TabsTrigger value="assistant">AI Assistant</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{demoTeamMembers.length}</div>
                <p className="text-xs text-muted-foreground">
                  Including 1 AI worker
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Capacity</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCapacity}h</div>
                <p className="text-xs text-muted-foreground">
                  Out of {totalMaxCapacity}h total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI-Suitable Tasks</CardTitle>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{aiSuitableTasks}</div>
                <p className="text-xs text-muted-foreground">
                  Ready for automation
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Potential AI Savings</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${potentialSavings}</div>
                <p className="text-xs text-muted-foreground">
                  Per sprint cycle
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Capacity Alerts */}
          {demoCapacityAlerts.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Capacity Alerts</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {demoCapacityAlerts.map((alert, index) => (
                  <Card key={index} className={`border-l-4 ${
                    alert.severity === 'high' ? 'border-l-red-500 bg-red-50/50' :
                    alert.severity === 'medium' ? 'border-l-yellow-500 bg-yellow-50/50' :
                    'border-l-blue-500 bg-blue-50/50'
                  }`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className={`w-4 h-4 ${
                          alert.severity === 'high' ? 'text-red-500' :
                          alert.severity === 'medium' ? 'text-yellow-500' :
                          'text-blue-500'
                        }`} />
                        <CardTitle className="text-sm">{alert.member}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
                      <p className="text-xs font-medium">{alert.suggestion}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Team Capacity Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Team Capacity Overview</CardTitle>
              <CardDescription>Current workload and availability by team member</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {demoTeamMembers.map((member) => (
                  <div key={member.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{member.capacity}h / {member.maxCapacity}h</p>
                        <p className="text-xs text-muted-foreground">
                          {member.availability.toFixed(1)}% available
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Capacity</span>
                        <span>{member.capacity}h / {member.maxCapacity}h</span>
                      </div>
                      <Progress value={(member.capacity / member.maxCapacity) * 100} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Skills</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {member.skills.slice(0, 3).map(skill => (
                            <Badge key={skill} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {member.skills.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{member.skills.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Performance</p>
                        <div className="mt-1">
                          <span className="font-medium">{member.performance}%</span>
                          <span className="text-muted-foreground ml-2">
                            ${member.hourlyRate}/hr
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Current Tasks</p>
                        <p className="font-medium">{member.currentTasks}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Completed</p>
                        <p className="font-medium">{member.completedTasks}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Time</p>
                        <p className="font-medium">{member.avgTaskTime}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Smart Task Assignments</h3>
              <p className="text-sm text-muted-foreground">
                AI-powered recommendations for optimal task allocation
              </p>
            </div>
            <Button className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Auto-Assign All Tasks
            </Button>
          </div>

          <div className="grid gap-4">
            {demoRecommendations.map((rec) => (
              <Card key={rec.taskId} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{rec.taskTitle}</h4>
                      <Badge variant={rec.type === 'ai' ? 'default' : 'secondary'}>
                        {rec.type === 'ai' ? 'AI Recommended' : 'Human Required'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        {rec.type === 'ai' ? (
                          <Bot className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                        <span>{rec.assignee}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        <span>{rec.confidence}% confidence</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{rec.estimatedCompletion}</span>
                      </div>
                      {rec.costSaving > 0 && (
                        <div className="flex items-center gap-1 text-green-600">
                          <DollarSign className="w-4 h-4" />
                          <span>Save ${rec.costSaving}</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
                  </div>
                  
                  <Button size="sm" variant="outline">
                    Assign
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="assistant" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Assistant for Bandwidth Planning</CardTitle>
              <CardDescription>
                Ask questions about capacity, get insights, and receive automated recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-3">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">Example Questions You Can Ask:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• "Who has the most available capacity this week?"</li>
                      <li>• "Which tasks can be automated to save costs?"</li>
                      <li>• "Is anyone overloaded and needs help?"</li>
                      <li>• "What's our team's skill coverage?"</li>
                    </ul>
                  </div>
                  
                  <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-blue-900 mb-1">Demo Analysis:</p>
                    <p className="text-sm text-blue-800">
                      Based on current capacity, Mike Rodriguez is at 95% utilization and may need task redistribution. 
                      Emma Thompson has 43% available capacity and could take on additional UX work. 
                      The AI Assistant can handle content creation tasks, potentially saving $240 per sprint.
                    </p>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    In the live version, this AI assistant connects to your real project data and can execute actions like creating tasks, assigning team members, and updating project timelines.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}