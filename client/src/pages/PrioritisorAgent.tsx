import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Target,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Zap,
  Settings,
  RefreshCw,
  ArrowUpDown,
  Filter,
  Download,
  BarChart3,
  Brain,
  Loader2,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

interface Task {
  id: number;
  name: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  projectId?: number;
  createdAt: string;
  priorityScore?: TaskPriorityScore | null;
}

interface TaskPriorityScore {
  id: number;
  taskId: number;
  priorityScore: number;
  roiLevel: string;
  effortLevel: string;
  urgencyLevel: string;
  strategicFit: string;
  recommendation: string;
  confidence: number;
  weightingProfile: string;
  createdAt: string;
  updatedAt: string;
}

interface PriorityWeightingPreference {
  roiWeight: number;
  effortWeight: number;
  urgencyWeight: number;
  strategicWeight: number;
  profileName: string;
}

interface Project {
  id: number;
  name: string;
  description?: string;
}

const WEIGHTING_PROFILES = {
  'speed': { roiWeight: 15, effortWeight: 45, urgencyWeight: 35, strategicWeight: 5, profileName: 'Speed Focused' },
  'roi': { roiWeight: 50, effortWeight: 20, urgencyWeight: 15, strategicWeight: 15, profileName: 'ROI Focused' },
  'balanced': { roiWeight: 25, effortWeight: 25, urgencyWeight: 25, strategicWeight: 25, profileName: 'Balanced' }
};

export default function PrioritisorAgent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [weightingPreferences, setWeightingPreferences] = useState<PriorityWeightingPreference>(WEIGHTING_PROFILES.balanced);
  const [contextInfo, setContextInfo] = useState({
    projectName: '',
    projectDescription: '',
    businessGoals: ''
  });
  const [sortBy, setSortBy] = useState<'priorityScore' | 'name' | 'dueDate' | 'createdAt'>('priorityScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoPrioritize, setAutoPrioritize] = useState(false);
  const [hasPrioritized, setHasPrioritized] = useState(false);

  // Fetch user's projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: isAuthenticated,
  });

  // Fetch tasks for prioritization
  const { data: tasksData, refetch: refetchTasks, isLoading: tasksLoading, error: tasksError } = useQuery({
    queryKey: ['/api/prioritisor/tasks', selectedProjectId],
    queryFn: async () => {
      const url = selectedProjectId 
        ? `/api/prioritisor/tasks?projectId=${selectedProjectId}`
        : '/api/prioritisor/tasks';
      console.log('Fetching tasks from URL:', url);
      console.log('Selected Project ID:', selectedProjectId);
      console.log('Is Authenticated:', isAuthenticated);
      
      const response = await fetch(url, { credentials: 'include' });
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in to view tasks.');
        }
        throw new Error('Failed to fetch tasks');
      }
      
      const data = await response.json();
      console.log('Fetched tasks data:', data);
      console.log('Tasks array:', data.tasks);
      console.log('Tasks count:', data.tasks?.length || 0);
      
      return data;
    },
    enabled: isAuthenticated,
  });

  // Fetch current weighting preferences
  const { data: currentPreferences } = useQuery<PriorityWeightingPreference>({
    queryKey: ['/api/prioritisor/preferences', selectedProjectId],
    queryFn: async () => {
      const url = selectedProjectId 
        ? `/api/prioritisor/preferences?projectId=${selectedProjectId}`
        : '/api/prioritisor/preferences';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch preferences');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Update weighting preferences when fetched
  useEffect(() => {
    if (currentPreferences) {
      setWeightingPreferences(currentPreferences);
    }
  }, [currentPreferences]);

  // Update context info when project changes
  useEffect(() => {
    if (selectedProjectId && projects.length > 0) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (project) {
        setContextInfo({
          projectName: project.name,
          projectDescription: project.description || '',
          businessGoals: ''
        });
      }
    }
  }, [selectedProjectId, projects]);

  // Auto-prioritize when parameters change (if enabled and already prioritized once)
  useEffect(() => {
    if (autoPrioritize && hasPrioritized && tasks.length > 0 && !isAnalyzing) {
      const timeoutId = setTimeout(() => {
        prioritizeMutation.mutate();
      }, 1000); // Debounce for 1 second
      
      return () => clearTimeout(timeoutId);
    }
  }, [weightingPreferences, autoPrioritize, hasPrioritized]);

  // Prioritize tasks mutation
  const prioritizeMutation = useMutation({
    mutationFn: async () => {
      setIsAnalyzing(true);
      const response = await apiRequest('/api/prioritisor/prioritize', {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProjectId,
          weightingProfile: weightingPreferences,
          contextInfo
        })
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "✨ Prioritization Complete",
        description: data.message || `Successfully prioritized ${data.analyses?.length || 0} tasks`,
      });
      setHasPrioritized(true);
      refetchTasks();
      queryClient.invalidateQueries({ queryKey: ['/api/prioritisor/tasks'] });
    },
    onError: (error: any) => {
      toast({
        title: "Prioritization Failed",
        description: error.message || "Failed to prioritize tasks",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsAnalyzing(false);
    }
  });

  // Save preferences mutation
  const savePreferencesMutation = useMutation({
    mutationFn: async (preferences: PriorityWeightingPreference) => {
      return apiRequest('/api/prioritisor/preferences', {
        method: 'POST',
        body: JSON.stringify({
          ...preferences,
          projectId: selectedProjectId
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "Preferences Saved",
        description: "Your prioritization preferences have been saved",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Save",
        description: error.message || "Failed to save preferences",
        variant: "destructive",
      });
    }
  });

  const tasks: Task[] = tasksData?.tasks || [];
  
  // Debug logging for tasks
  useEffect(() => {
    console.log('Tasks data updated:', {
      tasksData,
      tasks,
      tasksLength: tasks.length,
      isAuthenticated,
      selectedProjectId
    });
  }, [tasksData, tasks, isAuthenticated, selectedProjectId]);

  // Filter and sort tasks
  const filteredAndSortedTasks = tasks
    .filter(task => filterStatus === 'all' || task.status === filterStatus)
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'priorityScore':
          aValue = a.priorityScore?.priorityScore || 0;
          bValue = b.priorityScore?.priorityScore || 0;
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'dueDate':
          aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const getPriorityScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600 bg-red-50';
    if (score >= 60) return 'text-orange-600 bg-orange-50';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50';
    if (score >= 20) return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getWeightingTotal = () => {
    return weightingPreferences.roiWeight + 
           weightingPreferences.effortWeight + 
           weightingPreferences.urgencyWeight + 
           weightingPreferences.strategicWeight;
  };

  const handleWeightingProfileChange = (profileKey: string) => {
    if (profileKey in WEIGHTING_PROFILES) {
      setWeightingPreferences(WEIGHTING_PROFILES[profileKey as keyof typeof WEIGHTING_PROFILES]);
    }
  };

  const renderTaskCard = (task: Task) => (
    <motion.div
      key={task.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mb-4"
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">{task.name}</h3>
              {task.description && (
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{task.description}</p>
              )}
              
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="outline" className={`text-xs ${task.priority === 'high' ? 'border-red-200 text-red-700' : task.priority === 'medium' ? 'border-yellow-200 text-yellow-700' : 'border-green-200 text-green-700'}`}>
                  {task.priority} priority
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {task.status}
                </Badge>
                {task.dueDate && (
                  <Badge variant="outline" className="text-xs">
                    Due {new Date(task.dueDate).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>

            {task.priorityScore && (
              <div className="ml-4 text-right">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPriorityScoreColor(task.priorityScore.priorityScore)}`}>
                  <Target className="h-4 w-4 mr-1" />
                  {(task.priorityScore.priorityScore / 10).toFixed(1)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {task.priorityScore.confidence}% confidence
                </div>
              </div>
            )}
          </div>

          {task.priorityScore && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">ROI</div>
                  <Badge className={getLevelBadgeColor(task.priorityScore.roiLevel)}>
                    {task.priorityScore.roiLevel}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Effort</div>
                  <Badge className={getLevelBadgeColor(task.priorityScore.effortLevel)}>
                    {task.priorityScore.effortLevel}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Urgency</div>
                  <Badge className={getLevelBadgeColor(task.priorityScore.urgencyLevel)}>
                    {task.priorityScore.urgencyLevel}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Strategic</div>
                  <Badge className={getLevelBadgeColor(task.priorityScore.strategicFit)}>
                    {task.priorityScore.strategicFit}
                  </Badge>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start">
                  <Brain className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-blue-700 mb-1">AI Recommendation</div>
                    <p className="text-sm text-blue-800">{task.priorityScore.recommendation}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Target className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to use the Prioritisor agent</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            <span>AI-Powered Task Prioritization</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Prioritisor Agent
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Leverage AI to intelligently prioritize your tasks based on ROI, effort, urgency, and strategic alignment
          </p>
        </div>

        <Tabs defaultValue="prioritize" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3">
            <TabsTrigger value="prioritize">Prioritize Tasks</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="analytics" className="hidden lg:flex">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="prioritize" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Controls */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Settings className="h-5 w-5 mr-2" />
                      Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Project Selection */}
                    <div>
                      <Label htmlFor="project-select">Project (Optional)</Label>
                      <Select 
                        value={selectedProjectId?.toString() || "all"} 
                        onValueChange={(value) => setSelectedProjectId(value === "all" ? null : parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Projects" />
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
                    </div>

                    {/* Quick Weighting Profiles */}
                    <div>
                      <Label>Quick Profiles</Label>
                      <div className="grid grid-cols-1 gap-2 mt-2">
                        {Object.entries(WEIGHTING_PROFILES).map(([key, profile]) => (
                          <Button
                            key={key}
                            variant={weightingPreferences.profileName === profile.profileName ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleWeightingProfileChange(key)}
                            className="justify-start"
                          >
                            {profile.profileName}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Context Information */}
                    <div>
                      <Label htmlFor="business-goals">Business Goals (Optional)</Label>
                      <Textarea
                        id="business-goals"
                        placeholder="Describe your current business priorities..."
                        value={contextInfo.businessGoals}
                        onChange={(e) => setContextInfo(prev => ({ ...prev, businessGoals: e.target.value }))}
                        rows={3}
                      />
                    </div>

                    {/* Auto-prioritize Toggle */}
                    <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        <Label htmlFor="auto-prioritize" className="cursor-pointer font-medium text-blue-900">
                          Dynamic Updates
                        </Label>
                      </div>
                      <Switch
                        id="auto-prioritize"
                        checked={autoPrioritize}
                        onCheckedChange={setAutoPrioritize}
                        disabled={!hasPrioritized}
                      />
                    </div>
                    {autoPrioritize && (
                      <p className="text-xs text-blue-600 -mt-2">
                        Tasks will re-prioritize automatically when you change parameters
                      </p>
                    )}

                    {/* Analyze Button */}
                    <Button 
                      onClick={() => {
                        console.log('Button clicked - tasks:', tasks, 'length:', tasks.length);
                        prioritizeMutation.mutate();
                      }} 
                      disabled={isAnalyzing || tasks.length === 0 || tasksLoading}
                      className="w-full"
                      size="lg"
                    >
                      {tasksLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading Tasks...
                        </>
                      ) : isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing Tasks...
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4 mr-2" />
                          Prioritize with AI {tasks.length === 0 ? '(No tasks found)' : `(${tasks.length} tasks)`}
                        </>
                      )}
                    </Button>
                    
                    {/* Show helpful message when no tasks or not authenticated */}
                    {!isAuthenticated && (
                      <Alert className="mt-4 border-amber-200 bg-amber-50">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800">
                          Please log in to use the Prioritisor Agent. You need to be authenticated to access your tasks and projects.
                        </AlertDescription>
                      </Alert>
                    )}
                    {isAuthenticated && !tasksLoading && tasks.length === 0 && (
                      <Alert className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No tasks found. {selectedProjectId ? 'This project has no tasks.' : 'Create tasks in your projects to start prioritizing.'}
                        </AlertDescription>
                      </Alert>
                    )}
                    {tasksError && (
                      <Alert className="mt-4 border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                          Error loading tasks: {tasksError.message}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Task Statistics */}
                {tasks.length > 0 && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-sm">Task Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Tasks</span>
                          <span className="font-medium">{tasks.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Analyzed</span>
                          <span className="font-medium">{tasks.filter(t => t.priorityScore).length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">High Priority</span>
                          <span className="font-medium">{tasks.filter(t => t.priorityScore && t.priorityScore.priorityScore >= 80).length}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Task List */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center">
                        <Target className="h-5 w-5 mr-2" />
                        Prioritized Tasks
                      </CardTitle>
                      
                      <div className="flex items-center space-x-2">
                        {/* Filter */}
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in-progress">In Progress</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Sort */}
                        <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="priorityScore">Priority Score</SelectItem>
                            <SelectItem value="name">Name</SelectItem>
                            <SelectItem value="dueDate">Due Date</SelectItem>
                            <SelectItem value="createdAt">Created</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        >
                          {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {tasksLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        <span className="ml-2 text-gray-600">Loading tasks...</span>
                      </div>
                    ) : filteredAndSortedTasks.length === 0 ? (
                      <div className="text-center py-12">
                        <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 mb-2">No tasks found</p>
                        <p className="text-sm text-gray-400">
                          {tasks.length === 0 
                            ? "Create some tasks to get started with prioritization"
                            : "Try adjusting your filters"
                          }
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[600px]">
                        <AnimatePresence>
                          {filteredAndSortedTasks.map(renderTaskCard)}
                        </AnimatePresence>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Prioritization Settings</CardTitle>
                <CardDescription>
                  Adjust how the AI weighs different factors when prioritizing your tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* ROI Weight */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>ROI Impact Weight</Label>
                    <span className="text-sm font-medium">{weightingPreferences.roiWeight}%</span>
                  </div>
                  <Slider
                    value={[weightingPreferences.roiWeight]}
                    onValueChange={([value]) => setWeightingPreferences(prev => ({ ...prev, roiWeight: value, profileName: 'Custom' }))}
                    max={100}
                    step={5}
                    className="mb-2"
                  />
                  <p className="text-xs text-gray-500">How much to prioritize tasks with high business value and revenue impact</p>
                </div>

                {/* Effort Weight */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Effort Required Weight</Label>
                    <span className="text-sm font-medium">{weightingPreferences.effortWeight}%</span>
                  </div>
                  <Slider
                    value={[weightingPreferences.effortWeight]}
                    onValueChange={([value]) => setWeightingPreferences(prev => ({ ...prev, effortWeight: value, profileName: 'Custom' }))}
                    max={100}
                    step={5}
                    className="mb-2"
                  />
                  <p className="text-xs text-gray-500">How much to favor tasks that require less time and effort</p>
                </div>

                {/* Urgency Weight */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Urgency Weight</Label>
                    <span className="text-sm font-medium">{weightingPreferences.urgencyWeight}%</span>
                  </div>
                  <Slider
                    value={[weightingPreferences.urgencyWeight]}
                    onValueChange={([value]) => setWeightingPreferences(prev => ({ ...prev, urgencyWeight: value, profileName: 'Custom' }))}
                    max={100}
                    step={5}
                    className="mb-2"
                  />
                  <p className="text-xs text-gray-500">How much to prioritize tasks with tight deadlines and time sensitivity</p>
                </div>

                {/* Strategic Weight */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Strategic Alignment Weight</Label>
                    <span className="text-sm font-medium">{weightingPreferences.strategicWeight}%</span>
                  </div>
                  <Slider
                    value={[weightingPreferences.strategicWeight]}
                    onValueChange={([value]) => setWeightingPreferences(prev => ({ ...prev, strategicWeight: value, profileName: 'Custom' }))}
                    max={100}
                    step={5}
                    className="mb-2"
                  />
                  <p className="text-xs text-gray-500">How much to prioritize tasks aligned with long-term business goals</p>
                </div>

                {/* Weight Total Warning */}
                {getWeightingTotal() !== 100 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Weights should total 100%. Current total: {getWeightingTotal()}%
                    </AlertDescription>
                  </Alert>
                )}

                {/* Save Button */}
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => savePreferencesMutation.mutate(weightingPreferences)}
                    disabled={getWeightingTotal() !== 100 || savePreferencesMutation.isPending}
                  >
                    {savePreferencesMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Settings className="h-4 w-4 mr-2" />
                        Save Preferences
                      </>
                    )}
                  </Button>
                  
                  <Button variant="outline" onClick={() => setWeightingPreferences(WEIGHTING_PROFILES.balanced)}>
                    Reset to Balanced
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Task Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Priority Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Critical (9-10)</span>
                      <Badge className="bg-red-100 text-red-700">{tasks.filter(t => t.priorityScore && t.priorityScore.priorityScore >= 90).length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">High (7-8)</span>
                      <Badge className="bg-orange-100 text-orange-700">{tasks.filter(t => t.priorityScore && t.priorityScore.priorityScore >= 70 && t.priorityScore.priorityScore < 90).length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Medium (5-6)</span>
                      <Badge className="bg-yellow-100 text-yellow-700">{tasks.filter(t => t.priorityScore && t.priorityScore.priorityScore >= 50 && t.priorityScore.priorityScore < 70).length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Low (1-4)</span>
                      <Badge className="bg-green-100 text-green-700">{tasks.filter(t => t.priorityScore && t.priorityScore.priorityScore < 50).length}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ROI Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">ROI Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">High ROI</span>
                      <Badge className="bg-green-100 text-green-700">{tasks.filter(t => t.priorityScore?.roiLevel === 'high').length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Medium ROI</span>
                      <Badge className="bg-yellow-100 text-yellow-700">{tasks.filter(t => t.priorityScore?.roiLevel === 'medium').length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Low ROI</span>
                      <Badge className="bg-red-100 text-red-700">{tasks.filter(t => t.priorityScore?.roiLevel === 'low').length}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Effort Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Effort Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Low Effort</span>
                      <Badge className="bg-green-100 text-green-700">{tasks.filter(t => t.priorityScore?.effortLevel === 'low').length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Medium Effort</span>
                      <Badge className="bg-yellow-100 text-yellow-700">{tasks.filter(t => t.priorityScore?.effortLevel === 'medium').length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">High Effort</span>
                      <Badge className="bg-red-100 text-red-700">{tasks.filter(t => t.priorityScore?.effortLevel === 'high').length}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}