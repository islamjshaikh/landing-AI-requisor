import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Target,
  Sparkles,
  TrendingUp,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  ArrowUpDown,
  Brain,
  Loader2,
  Save,
  RefreshCw,
  Settings,
  BarChart3,
  Info,
  ChevronUp,
  ChevronDown,
  Zap,
  Shield,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

interface Task {
  id: number;
  name: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  projectId?: number;
  createdAt?: string;
  progress?: number;
  assigneeId?: string;
  due_date?: string;  // Database uses snake_case
  created_at?: string;  // Database uses snake_case
}

interface PrioritizedTask extends Task {
  priorityScore: number;
  roiLevel: 'high' | 'medium' | 'low';
  effortLevel: 'high' | 'medium' | 'low';
  urgencyLevel: 'high' | 'medium' | 'low';
  strategicFit: 'high' | 'medium' | 'low';
  recommendation: string;
  confidence: number;
}

interface Project {
  id: number;
  name: string;
  description?: string;
}

interface WeightingProfile {
  roiWeight: number;
  effortWeight: number;
  urgencyWeight: number;
  strategicWeight: number;
  dependencyWeight: number;
}

const PRESET_PROFILES: Record<string, WeightingProfile> = {
  balanced: { roiWeight: 20, effortWeight: 20, urgencyWeight: 20, strategicWeight: 20, dependencyWeight: 20 },
  speedFocused: { roiWeight: 10, effortWeight: 35, urgencyWeight: 30, strategicWeight: 10, dependencyWeight: 15 },
  roiFocused: { roiWeight: 40, effortWeight: 15, urgencyWeight: 15, strategicWeight: 20, dependencyWeight: 10 },
  urgentFirst: { roiWeight: 15, effortWeight: 15, urgencyWeight: 40, strategicWeight: 15, dependencyWeight: 15 },
  strategic: { roiWeight: 20, effortWeight: 15, urgencyWeight: 15, strategicWeight: 35, dependencyWeight: 15 }
};

export default function PrioritisorAgentV2() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  
  // State management
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [weightingProfile, setWeightingProfile] = useState<WeightingProfile>(PRESET_PROFILES.balanced);
  const [selectedProfile, setSelectedProfile] = useState<string>('balanced');
  const [prioritizedTasks, setPrioritizedTasks] = useState<PrioritizedTask[]>([]);
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'urgency' | 'roi'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'matrix' | 'kanban'>('table');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: isAuthenticated,
  });

  // Fetch tasks for the selected project
  const { data: tasksResponse, isLoading: tasksLoading, error: tasksError, refetch: refetchTasks } = useQuery({
    queryKey: selectedProjectId ? ['/api/tasks', 'project', selectedProjectId] : ['/api/tasks'],
    queryFn: async () => {
      if (selectedProjectId) {
        // Fetch tasks for specific project
        const response = await fetch(`/api/tasks?projectId=${selectedProjectId}`, {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch tasks');
        return response.json();
      } else {
        // Fetch all tasks
        const response = await fetch('/api/tasks', {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch tasks');
        return response.json();
      }
    },
    enabled: isAuthenticated,
  });

  // Process tasks data
  const tasks = useMemo(() => {
    if (!tasksResponse) return [];
    // Handle different response formats
    if (Array.isArray(tasksResponse)) {
      return tasksResponse;
    }
    if (tasksResponse.tasks && Array.isArray(tasksResponse.tasks)) {
      return tasksResponse.tasks;
    }
    return [];
  }, [tasksResponse]);

  // Log tasks for debugging
  useEffect(() => {
    console.log('[Prioritisor] Current tasks:', tasks.length, 'for project:', selectedProjectId);
    console.log('[Prioritisor] Sample task:', tasks[0]);
  }, [tasks, selectedProjectId]);

  // Prioritize tasks mutation
  const prioritizeMutation = useMutation({
    mutationFn: async () => {
      setIsAnalyzing(true);
      
      // Debug logging
      console.log('[Prioritisor] Starting analysis with', tasks.length, 'tasks');
      console.log('[Prioritisor] Weighting profile:', weightingProfile);
      
      if (tasks.length === 0) {
        throw new Error('No tasks available to prioritize. Please ensure you have tasks in the selected project.');
      }
      
      const response = await apiRequest('/api/v2/prioritisor/analyze', {
        method: 'POST',
        body: JSON.stringify({
          tasks,
          weightingProfile,
          projectId: selectedProjectId
        })
      });
      console.log('[Prioritisor] Analysis response:', response);
      return response;
    },
    onSuccess: (data) => {
      setPrioritizedTasks(data.prioritizedTasks || []);
      toast({
        title: "✨ Tasks Prioritized Successfully",
        description: `Analyzed ${data.prioritizedTasks?.length || 0} tasks using AI intelligence`,
      });
    },
    onError: (error: any) => {
      console.error('[Prioritisor] Analysis error:', error);
      toast({
        title: "Prioritization Failed",
        description: error.message || "Failed to analyze tasks",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsAnalyzing(false);
    }
  });

  // Save priorities mutation
  const savePrioritiesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/v2/prioritisor/save', {
        method: 'POST',
        body: JSON.stringify({
          prioritizedTasks,
          projectId: selectedProjectId
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "✅ Priorities Saved",
        description: "Task priorities have been updated in the database",
      });
      refetchTasks();
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save priorities",
        variant: "destructive",
      });
    }
  });

  // Sort tasks
  const sortedTasks = [...prioritizedTasks].sort((a, b) => {
    let compareValue = 0;
    
    switch (sortBy) {
      case 'score':
        compareValue = a.priorityScore - b.priorityScore;
        break;
      case 'name':
        compareValue = a.name.localeCompare(b.name);
        break;
      case 'urgency':
        const urgencyOrder = { high: 3, medium: 2, low: 1 };
        compareValue = urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel];
        break;
      case 'roi':
        const roiOrder = { high: 3, medium: 2, low: 1 };
        compareValue = roiOrder[a.roiLevel] - roiOrder[b.roiLevel];
        break;
    }
    
    return sortOrder === 'desc' ? -compareValue : compareValue;
  });

  // Get color based on priority score
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-red-600 bg-red-50 border-red-200';
    if (score >= 6) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (score >= 4) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  // Get level badge color
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Handle profile change
  const handleProfileChange = (profile: string) => {
    setSelectedProfile(profile);
    if (profile in PRESET_PROFILES) {
      setWeightingProfile(PRESET_PROFILES[profile]);
    }
  };

  // Update individual weight
  const updateWeight = (key: keyof WeightingProfile, value: number) => {
    setWeightingProfile(prev => ({ ...prev, [key]: value }));
    setSelectedProfile('custom');
  };

  // Normalize weights to 100%
  const normalizeWeights = () => {
    const total = Object.values(weightingProfile).reduce((sum, val) => sum + val, 0);
    if (total === 0) return;
    
    const normalized: WeightingProfile = {
      roiWeight: Math.round((weightingProfile.roiWeight / total) * 100),
      effortWeight: Math.round((weightingProfile.effortWeight / total) * 100),
      urgencyWeight: Math.round((weightingProfile.urgencyWeight / total) * 100),
      strategicWeight: Math.round((weightingProfile.strategicWeight / total) * 100),
      dependencyWeight: Math.round((weightingProfile.dependencyWeight / total) * 100),
    };
    
    setWeightingProfile(normalized);
  };

  const totalWeight = Object.values(weightingProfile).reduce((sum, val) => sum + val, 0);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Brain className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to use the Prioritisor Agent</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium mb-4"
          >
            <Brain className="h-4 w-4" />
            <span>AI-Powered Task Prioritization Engine</span>
            <Sparkles className="h-4 w-4" />
          </motion.div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            🦕 Prioritisor Agent
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Transform chaos into clarity with intelligent task prioritization based on ROI, effort, urgency, and strategic alignment
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* Project Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Target className="h-5 w-5 mr-2" />
                  Project Selection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select 
                  value={selectedProjectId?.toString() || "all"} 
                  onValueChange={(value) => setSelectedProjectId(value === "all" ? null : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Weighting Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Settings className="h-5 w-5 mr-2" />
                  Priority Weights
                </CardTitle>
                <CardDescription>
                  Adjust how different factors influence prioritization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preset Profiles */}
                <div>
                  <Label>Quick Profiles</Label>
                  <Select value={selectedProfile} onValueChange={handleProfileChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="balanced">⚖️ Balanced</SelectItem>
                      <SelectItem value="speedFocused">⚡ Speed Focused</SelectItem>
                      <SelectItem value="roiFocused">💰 ROI Focused</SelectItem>
                      <SelectItem value="urgentFirst">🔥 Urgent First</SelectItem>
                      <SelectItem value="strategic">🎯 Strategic</SelectItem>
                      <SelectItem value="custom">🎨 Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Weight Sliders */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <Label className="text-sm flex items-center">
                        <DollarSign className="h-3 w-3 mr-1" />
                        ROI Impact
                      </Label>
                      <span className="text-sm font-medium">{weightingProfile.roiWeight}%</span>
                    </div>
                    <Slider
                      value={[weightingProfile.roiWeight]}
                      onValueChange={([value]) => updateWeight('roiWeight', value)}
                      max={100}
                      step={5}
                      className="mb-1"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <Label className="text-sm flex items-center">
                        <Zap className="h-3 w-3 mr-1" />
                        Effort Required
                      </Label>
                      <span className="text-sm font-medium">{weightingProfile.effortWeight}%</span>
                    </div>
                    <Slider
                      value={[weightingProfile.effortWeight]}
                      onValueChange={([value]) => updateWeight('effortWeight', value)}
                      max={100}
                      step={5}
                      className="mb-1"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <Label className="text-sm flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        Urgency
                      </Label>
                      <span className="text-sm font-medium">{weightingProfile.urgencyWeight}%</span>
                    </div>
                    <Slider
                      value={[weightingProfile.urgencyWeight]}
                      onValueChange={([value]) => updateWeight('urgencyWeight', value)}
                      max={100}
                      step={5}
                      className="mb-1"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <Label className="text-sm flex items-center">
                        <Shield className="h-3 w-3 mr-1" />
                        Strategic Fit
                      </Label>
                      <span className="text-sm font-medium">{weightingProfile.strategicWeight}%</span>
                    </div>
                    <Slider
                      value={[weightingProfile.strategicWeight]}
                      onValueChange={([value]) => updateWeight('strategicWeight', value)}
                      max={100}
                      step={5}
                      className="mb-1"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <Label className="text-sm flex items-center">
                        <Activity className="h-3 w-3 mr-1" />
                        Dependencies
                      </Label>
                      <span className="text-sm font-medium">{weightingProfile.dependencyWeight}%</span>
                    </div>
                    <Slider
                      value={[weightingProfile.dependencyWeight]}
                      onValueChange={([value]) => updateWeight('dependencyWeight', value)}
                      max={100}
                      step={5}
                      className="mb-1"
                    />
                  </div>
                </div>

                {/* Total Weight Indicator */}
                <div className="pt-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-600">Total Weight</span>
                    <span className={`text-sm font-medium ${totalWeight === 100 ? 'text-green-600' : 'text-orange-600'}`}>
                      {totalWeight}%
                    </span>
                  </div>
                  <Progress value={totalWeight} max={100} className="h-2" />
                  {totalWeight !== 100 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={normalizeWeights}
                      className="mt-2 w-full"
                    >
                      Normalize to 100%
                    </Button>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={() => prioritizeMutation.mutate()}
                    disabled={isAnalyzing || tasks.length === 0 || totalWeight !== 100}
                    className="flex-1"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 mr-2" />
                        Prioritize Tasks
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Task Stats */}
            {tasks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Tasks</span>
                      <span className="font-medium">{tasks.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Analyzed</span>
                      <span className="font-medium">{prioritizedTasks.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">High Priority</span>
                      <span className="font-medium text-red-600">
                        {prioritizedTasks.filter(t => t.priorityScore >= 8).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Quick Wins</span>
                      <span className="font-medium text-green-600">
                        {prioritizedTasks.filter(t => t.effortLevel === 'low' && t.roiLevel === 'high').length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Panel - Task List */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    Prioritized Tasks
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="table">Table View</SelectItem>
                        <SelectItem value="matrix">ROI Matrix</SelectItem>
                        <SelectItem value="kanban">Kanban</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Sort Options */}
                    <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="score">Score</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="urgency">Urgency</SelectItem>
                        <SelectItem value="roi">ROI</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    >
                      {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>

                    {prioritizedTasks.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => savePrioritiesMutation.mutate()}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {tasksLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                    <span className="ml-2 text-gray-600">Loading tasks...</span>
                  </div>
                ) : tasksError ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Failed to load tasks. Please try again.
                    </AlertDescription>
                  </Alert>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-12">
                    <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">No tasks found</p>
                    <p className="text-sm text-gray-400">
                      {selectedProjectId 
                        ? "This project has no tasks yet"
                        : "Create tasks in your projects to start prioritizing"
                      }
                    </p>
                  </div>
                ) : prioritizedTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <Brain className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">No tasks prioritized yet</p>
                    <p className="text-sm text-gray-400">
                      Click "Prioritize Tasks" to analyze {tasks.length} tasks with AI
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[600px]">
                    {viewMode === 'table' && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8">Score</TableHead>
                            <TableHead>Task</TableHead>
                            <TableHead>ROI</TableHead>
                            <TableHead>Effort</TableHead>
                            <TableHead>Urgency</TableHead>
                            <TableHead>Strategic</TableHead>
                            <TableHead>Recommendation</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <AnimatePresence>
                            {sortedTasks.map((task, index) => (
                              <motion.tr
                                key={task.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="hover:bg-gray-50"
                              >
                                <TableCell>
                                  <div className={`text-center font-bold px-2 py-1 rounded-full border ${getScoreColor(task.priorityScore)}`}>
                                    {task.priorityScore.toFixed(1)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{task.name}</p>
                                    {task.description && (
                                      <p className="text-sm text-gray-500 line-clamp-1">{task.description}</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge className={getLevelColor(task.roiLevel)}>
                                    {task.roiLevel}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={getLevelColor(task.effortLevel)}>
                                    {task.effortLevel}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={getLevelColor(task.urgencyLevel)}>
                                    {task.urgencyLevel}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={getLevelColor(task.strategicFit)}>
                                    {task.strategicFit}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <p className="text-sm text-gray-600 max-w-xs">{task.recommendation}</p>
                                </TableCell>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </TableBody>
                      </Table>
                    )}

                    {viewMode === 'matrix' && (
                      <div className="grid grid-cols-2 gap-4 p-4">
                        <div className="col-span-2 text-center mb-4">
                          <h3 className="text-lg font-semibold">ROI vs Effort Matrix</h3>
                        </div>
                        <div className="border rounded-lg p-4 bg-green-50">
                          <h4 className="font-medium text-green-700 mb-2">🎯 Quick Wins</h4>
                          <p className="text-xs text-gray-600 mb-2">High ROI, Low Effort</p>
                          <div className="space-y-1">
                            {sortedTasks
                              .filter(t => t.roiLevel === 'high' && t.effortLevel === 'low')
                              .map(t => (
                                <div key={t.id} className="text-sm p-1 bg-white rounded">
                                  {t.name}
                                </div>
                              ))}
                          </div>
                        </div>
                        <div className="border rounded-lg p-4 bg-yellow-50">
                          <h4 className="font-medium text-yellow-700 mb-2">💪 Major Projects</h4>
                          <p className="text-xs text-gray-600 mb-2">High ROI, High Effort</p>
                          <div className="space-y-1">
                            {sortedTasks
                              .filter(t => t.roiLevel === 'high' && t.effortLevel === 'high')
                              .map(t => (
                                <div key={t.id} className="text-sm p-1 bg-white rounded">
                                  {t.name}
                                </div>
                              ))}
                          </div>
                        </div>
                        <div className="border rounded-lg p-4 bg-blue-50">
                          <h4 className="font-medium text-blue-700 mb-2">🔄 Fill-ins</h4>
                          <p className="text-xs text-gray-600 mb-2">Low ROI, Low Effort</p>
                          <div className="space-y-1">
                            {sortedTasks
                              .filter(t => t.roiLevel === 'low' && t.effortLevel === 'low')
                              .map(t => (
                                <div key={t.id} className="text-sm p-1 bg-white rounded">
                                  {t.name}
                                </div>
                              ))}
                          </div>
                        </div>
                        <div className="border rounded-lg p-4 bg-red-50">
                          <h4 className="font-medium text-red-700 mb-2">⏸️ Reconsider</h4>
                          <p className="text-xs text-gray-600 mb-2">Low ROI, High Effort</p>
                          <div className="space-y-1">
                            {sortedTasks
                              .filter(t => t.roiLevel === 'low' && t.effortLevel === 'high')
                              .map(t => (
                                <div key={t.id} className="text-sm p-1 bg-white rounded">
                                  {t.name}
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {viewMode === 'kanban' && (
                      <div className="grid grid-cols-3 gap-4 p-4">
                        <div className="bg-red-50 rounded-lg p-4">
                          <h3 className="font-semibold text-red-700 mb-3">🔥 High Priority (8-10)</h3>
                          <div className="space-y-2">
                            {sortedTasks
                              .filter(t => t.priorityScore >= 8)
                              .map(t => (
                                <Card key={t.id} className="p-3">
                                  <div className="flex justify-between items-start mb-2">
                                    <p className="font-medium text-sm">{t.name}</p>
                                    <Badge className="text-xs">{t.priorityScore.toFixed(1)}</Badge>
                                  </div>
                                  <p className="text-xs text-gray-600">{t.recommendation}</p>
                                </Card>
                              ))}
                          </div>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-4">
                          <h3 className="font-semibold text-yellow-700 mb-3">⚡ Medium Priority (5-7)</h3>
                          <div className="space-y-2">
                            {sortedTasks
                              .filter(t => t.priorityScore >= 5 && t.priorityScore < 8)
                              .map(t => (
                                <Card key={t.id} className="p-3">
                                  <div className="flex justify-between items-start mb-2">
                                    <p className="font-medium text-sm">{t.name}</p>
                                    <Badge className="text-xs">{t.priorityScore.toFixed(1)}</Badge>
                                  </div>
                                  <p className="text-xs text-gray-600">{t.recommendation}</p>
                                </Card>
                              ))}
                          </div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4">
                          <h3 className="font-semibold text-green-700 mb-3">📌 Low Priority (1-4)</h3>
                          <div className="space-y-2">
                            {sortedTasks
                              .filter(t => t.priorityScore < 5)
                              .map(t => (
                                <Card key={t.id} className="p-3">
                                  <div className="flex justify-between items-start mb-2">
                                    <p className="font-medium text-sm">{t.name}</p>
                                    <Badge className="text-xs">{t.priorityScore.toFixed(1)}</Badge>
                                  </div>
                                  <p className="text-xs text-gray-600">{t.recommendation}</p>
                                </Card>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}