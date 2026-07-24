import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowUp, ArrowDown, ArrowRight, Clock, Target, TrendingUp, Users, Zap, Brain, ChevronRight, BarChart3, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Sample tasks data
const sampleTasks = [
  {
    id: 1,
    name: "Launch Marketing Campaign",
    description: "Execute Q1 marketing campaign across all channels",
    status: "todo",
    priority: "high",
    dueDate: "2025-02-15",
    assignee: "Marketing Team",
    department: "Marketing",
    estimatedHours: 120,
    dependencies: ["Brand Guidelines Update", "Budget Approval"]
  },
  {
    id: 2,
    name: "Fix Critical Security Bug",
    description: "Patch authentication vulnerability in production",
    status: "in_progress",
    priority: "critical",
    dueDate: "2025-01-10",
    assignee: "Security Team",
    department: "Engineering",
    estimatedHours: 8,
    dependencies: []
  },
  {
    id: 3,
    name: "Customer Database Migration",
    description: "Migrate customer data to new CRM system",
    status: "todo",
    priority: "medium",
    dueDate: "2025-03-01",
    assignee: "Data Team",
    department: "IT",
    estimatedHours: 80,
    dependencies: ["CRM Setup", "Data Backup"]
  },
  {
    id: 4,
    name: "Q1 Financial Report",
    description: "Prepare and submit Q1 financial statements",
    status: "todo",
    priority: "high",
    dueDate: "2025-01-31",
    assignee: "Finance Team",
    department: "Finance",
    estimatedHours: 40,
    dependencies: ["Sales Data Collection"]
  },
  {
    id: 5,
    name: "Employee Onboarding System",
    description: "Implement automated onboarding workflow",
    status: "todo",
    priority: "low",
    dueDate: "2025-04-01",
    assignee: "HR Team",
    department: "HR",
    estimatedHours: 60,
    dependencies: ["IT Access Setup"]
  },
  {
    id: 6,
    name: "Product Feature Release",
    description: "Deploy new AI-powered analytics dashboard",
    status: "in_progress",
    priority: "high",
    dueDate: "2025-01-25",
    assignee: "Product Team",
    department: "Product",
    estimatedHours: 200,
    dependencies: ["API Development", "UI Testing"]
  }
];

interface PrioritizedTask {
  id: number;
  name: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  assignee: string;
  department: string;
  estimatedHours: number;
  dependencies: string[];
  priorityScore: number;
  roiLevel: 'high' | 'medium' | 'low';
  effortLevel: 'high' | 'medium' | 'low';
  urgencyLevel: 'high' | 'medium' | 'low';
  strategicFit: 'high' | 'medium' | 'low';
  recommendation: string;
  confidence: number;
}

export default function PrioritisorDemo() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [prioritizedTasks, setPrioritizedTasks] = useState<PrioritizedTask[]>([]);
  const [weightingProfile, setWeightingProfile] = useState({
    roiWeight: 20,
    effortWeight: 20,
    urgencyWeight: 20,
    strategicWeight: 20,
    dependencyWeight: 20
  });

  const analyzeTasksDemo = () => {
    setIsAnalyzing(true);
    
    // Simulate API call delay
    setTimeout(() => {
      // Mock AI analysis results
      const analyzed: PrioritizedTask[] = [
        {
          ...sampleTasks[1], // Security Bug
          priorityScore: 10,
          roiLevel: 'high',
          effortLevel: 'low',
          urgencyLevel: 'high',
          strategicFit: 'high',
          recommendation: "🚨 IMMEDIATE ACTION REQUIRED - Security vulnerability poses significant risk. Allocate top resources immediately.",
          confidence: 98
        },
        {
          ...sampleTasks[5], // Product Feature
          priorityScore: 8.5,
          roiLevel: 'high',
          effortLevel: 'high',
          urgencyLevel: 'high',
          strategicFit: 'high',
          recommendation: "Schedule for current sprint - High customer impact and revenue potential. Consider parallel workstreams.",
          confidence: 92
        },
        {
          ...sampleTasks[3], // Financial Report
          priorityScore: 7.8,
          roiLevel: 'medium',
          effortLevel: 'medium',
          urgencyLevel: 'high',
          strategicFit: 'high',
          recommendation: "Time-sensitive compliance requirement. Start immediately after security fix.",
          confidence: 95
        },
        {
          ...sampleTasks[0], // Marketing Campaign
          priorityScore: 6.5,
          roiLevel: 'high',
          effortLevel: 'high',
          urgencyLevel: 'medium',
          strategicFit: 'high',
          recommendation: "Important but can be phased. Consider starting prep work while completing urgent items.",
          confidence: 88
        },
        {
          ...sampleTasks[2], // Database Migration
          priorityScore: 5.2,
          roiLevel: 'medium',
          effortLevel: 'high',
          urgencyLevel: 'low',
          strategicFit: 'medium',
          recommendation: "Schedule for Q2. Plan thoroughly to minimize disruption. Consider breaking into smaller phases.",
          confidence: 85
        },
        {
          ...sampleTasks[4], // Onboarding System
          priorityScore: 3.8,
          roiLevel: 'low',
          effortLevel: 'medium',
          urgencyLevel: 'low',
          strategicFit: 'low',
          recommendation: "Defer to next quarter. Current manual process is sufficient. Revisit when hiring volume increases.",
          confidence: 82
        }
      ];
      
      setPrioritizedTasks(analyzed);
      setAnalyzed(true);
      setIsAnalyzing(false);
    }, 2000);
  };

  const resetDemo = () => {
    setAnalyzed(false);
    setPrioritizedTasks([]);
  };

  const getLevelColor = (level: string) => {
    switch(level) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getPriorityBadgeColor = (score: number) => {
    if (score >= 8) return 'bg-red-500 text-white';
    if (score >= 6) return 'bg-orange-500 text-white';
    if (score >= 4) return 'bg-yellow-500 text-white';
    return 'bg-green-500 text-white';
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white">
            <Brain className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Prioritisor Agent Demo</h1>
            <p className="text-muted-foreground">AI-Powered Task Prioritization Engine</p>
          </div>
        </div>
        
        <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200 dark:border-purple-800">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                  This is a demonstration of the Prioritisor Agent's capabilities
                </p>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  The agent analyzes tasks across multiple dimensions (ROI, effort, urgency, strategic fit) to provide intelligent prioritization recommendations. 
                  In production, it connects with your real project data and uses OpenAI GPT-4 for analysis.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!analyzed ? (
        <>
          {/* Weighting Configuration */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Slider className="h-5 w-5" />
                Prioritization Weights
              </CardTitle>
              <CardDescription>
                Adjust how the AI weighs different factors when prioritizing tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      ROI Impact
                    </label>
                    <span className="text-sm font-bold">{weightingProfile.roiWeight}%</span>
                  </div>
                  <Slider
                    value={[weightingProfile.roiWeight]}
                    onValueChange={(v) => setWeightingProfile({...weightingProfile, roiWeight: v[0]})}
                    max={40}
                    min={10}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      Effort Required
                    </label>
                    <span className="text-sm font-bold">{weightingProfile.effortWeight}%</span>
                  </div>
                  <Slider
                    value={[weightingProfile.effortWeight]}
                    onValueChange={(v) => setWeightingProfile({...weightingProfile, effortWeight: v[0]})}
                    max={40}
                    min={10}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4 text-red-500" />
                      Urgency Level
                    </label>
                    <span className="text-sm font-bold">{weightingProfile.urgencyWeight}%</span>
                  </div>
                  <Slider
                    value={[weightingProfile.urgencyWeight]}
                    onValueChange={(v) => setWeightingProfile({...weightingProfile, urgencyWeight: v[0]})}
                    max={40}
                    min={10}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-500" />
                      Strategic Fit
                    </label>
                    <span className="text-sm font-bold">{weightingProfile.strategicWeight}%</span>
                  </div>
                  <Slider
                    value={[weightingProfile.strategicWeight]}
                    onValueChange={(v) => setWeightingProfile({...weightingProfile, strategicWeight: v[0]})}
                    max={40}
                    min={10}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-500" />
                      Dependencies
                    </label>
                    <span className="text-sm font-bold">{weightingProfile.dependencyWeight}%</span>
                  </div>
                  <Slider
                    value={[weightingProfile.dependencyWeight]}
                    onValueChange={(v) => setWeightingProfile({...weightingProfile, dependencyWeight: v[0]})}
                    max={40}
                    min={10}
                    step={5}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sample Tasks */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Sample Tasks to Analyze</CardTitle>
              <CardDescription>
                These tasks represent a typical project backlog across different departments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sampleTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: task.id * 0.1 }}
                  >
                    <Card className="h-full">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-sm">{task.name}</h3>
                          <Badge variant={
                            task.priority === 'critical' ? 'destructive' :
                            task.priority === 'high' ? 'default' :
                            task.priority === 'medium' ? 'secondary' :
                            'outline'
                          }>
                            {task.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{task.description}</p>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {task.dueDate}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {task.department}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Analyze Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={analyzeTasksDemo}
              disabled={isAnalyzing}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Analyzing Tasks with AI...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-5 w-5" />
                  Analyze Tasks with AI
                </>
              )}
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Analysis Results */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    AI Prioritization Results
                  </CardTitle>
                  <CardDescription>
                    Tasks ranked by AI-calculated priority scores
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={resetDemo}>
                  Reset Demo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="ranked" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="ranked">Ranked View</TabsTrigger>
                  <TabsTrigger value="detailed">Detailed Analysis</TabsTrigger>
                </TabsList>

                <TabsContent value="ranked" className="space-y-4 mt-6">
                  <AnimatePresence>
                    {prioritizedTasks.map((task, index) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className={index === 0 ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20' : ''}>
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0">
                                <div className={`text-2xl font-bold ${index === 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                  #{index + 1}
                                </div>
                              </div>
                              
                              <div className="flex-grow space-y-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h3 className="font-semibold text-lg">{task.name}</h3>
                                    <p className="text-sm text-muted-foreground">{task.description}</p>
                                  </div>
                                  <div className="text-right">
                                    <div className={`text-3xl font-bold ${getPriorityBadgeColor(task.priorityScore).replace('bg-', 'text-').replace(' text-white', '')}`}>
                                      {task.priorityScore}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Priority Score</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-6 text-sm">
                                  <div className="flex items-center gap-1">
                                    <TrendingUp className="h-4 w-4" />
                                    <span>ROI: <span className={getLevelColor(task.roiLevel)}>{task.roiLevel}</span></span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Zap className="h-4 w-4" />
                                    <span>Effort: <span className={getLevelColor(task.effortLevel)}>{task.effortLevel}</span></span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    <span>Urgency: <span className={getLevelColor(task.urgencyLevel)}>{task.urgencyLevel}</span></span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Target className="h-4 w-4" />
                                    <span>Strategic: <span className={getLevelColor(task.strategicFit)}>{task.strategicFit}</span></span>
                                  </div>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
                                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                                    AI Recommendation
                                  </p>
                                  <p className="text-sm text-blue-700 dark:text-blue-300">
                                    {task.recommendation}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span>{task.department}</span>
                                    <span>•</span>
                                    <span>{task.estimatedHours}h estimated</span>
                                    <span>•</span>
                                    <span>Due: {task.dueDate}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Confidence:</span>
                                    <Progress value={task.confidence} className="w-20 h-2" />
                                    <span className="text-xs font-medium">{task.confidence}%</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="detailed" className="mt-6">
                  <div className="space-y-6">
                    {/* Priority Distribution Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Priority Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">Critical (8-10)</span>
                            <div className="flex items-center gap-2">
                              <div className="w-32 bg-gray-200 rounded-full h-2">
                                <div className="bg-red-500 h-2 rounded-full" style={{width: '33%'}}></div>
                              </div>
                              <span className="text-muted-foreground">2 tasks</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">High (6-8)</span>
                            <div className="flex items-center gap-2">
                              <div className="w-32 bg-gray-200 rounded-full h-2">
                                <div className="bg-orange-500 h-2 rounded-full" style={{width: '33%'}}></div>
                              </div>
                              <span className="text-muted-foreground">2 tasks</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">Medium (4-6)</span>
                            <div className="flex items-center gap-2">
                              <div className="w-32 bg-gray-200 rounded-full h-2">
                                <div className="bg-yellow-500 h-2 rounded-full" style={{width: '17%'}}></div>
                              </div>
                              <span className="text-muted-foreground">1 task</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">Low (0-4)</span>
                            <div className="flex items-center gap-2">
                              <div className="w-32 bg-gray-200 rounded-full h-2">
                                <div className="bg-green-500 h-2 rounded-full" style={{width: '17%'}}></div>
                              </div>
                              <span className="text-muted-foreground">1 task</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Department Workload */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Department Workload Analysis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {['Engineering', 'Product', 'Finance', 'Marketing', 'IT', 'HR'].map((dept) => {
                            const deptTasks = prioritizedTasks.filter(t => t.department === `${dept} Team`);
                            const avgPriority = deptTasks.length > 0 
                              ? deptTasks.reduce((sum, t) => sum + t.priorityScore, 0) / deptTasks.length 
                              : 0;
                            
                            return (
                              <div key={dept} className="text-center p-3 border rounded-lg">
                                <p className="text-sm font-medium">{dept}</p>
                                <p className="text-2xl font-bold mt-1">{deptTasks.length}</p>
                                <p className="text-xs text-muted-foreground">
                                  {avgPriority > 0 ? `Avg: ${avgPriority.toFixed(1)}` : 'No tasks'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Key Insights */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">AI-Generated Insights</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-green-500 mt-0.5" />
                          <p className="text-sm">
                            <span className="font-medium">Resource Allocation:</span> Security and Product teams need immediate attention with critical tasks requiring 208 combined hours.
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-yellow-500 mt-0.5" />
                          <p className="text-sm">
                            <span className="font-medium">Risk Assessment:</span> The security vulnerability represents the highest risk and should be addressed within 24 hours.
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5" />
                          <p className="text-sm">
                            <span className="font-medium">Strategic Alignment:</span> 67% of high-priority tasks directly support Q1 business objectives.
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-purple-500 mt-0.5" />
                          <p className="text-sm">
                            <span className="font-medium">Optimization Opportunity:</span> Consider deferring the onboarding system to free up 60 hours for critical initiatives.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}