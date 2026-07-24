import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  Zap,
  BarChart3,
  Brain,
  Sparkles,
  RefreshCw,
  Download,
  Filter,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Edit2,
  FileDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Define color palette for charts
const COLORS = {
  rga: '#10b981', // green
  nonRga: '#3b82f6', // blue
  strategic: '#8b5cf6' // purple
};

interface Task {
  id: number;
  name: string;
  description: string | null;
  projectId: number;
  projectName?: string;
  assigneeId: string | null;
  assigneeName?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string | null;
  rgaCategory?: string | null;
  rgaConfidence?: number;
  rgaReasoning?: string;
}

interface RgaSettings {
  id: number;
  mode: 'pre-funding' | 'post-funding';
  targetRgaPercentage: number;
  revenueChannel?: string;
  nextMilestone?: string;
  weeklyCustomerHours: number;
}

export default function RgaAssistantEnhanced() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [autoClassifyEnabled, setAutoClassifyEnabled] = useState(true);
  const [showOnlyUncategorized, setShowOnlyUncategorized] = useState(false);

  // Fetch user settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['/api/rga/settings'],
    queryFn: async () => {
      const response = await apiRequest<RgaSettings>('/api/rga/settings');
      return response;
    }
  });

  // Fetch all projects
  const { data: projects } = useQuery({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const response = await apiRequest<any[]>('/api/projects');
      return response;
    }
  });

  // Fetch tasks with RGA categories
  const { data: tasks, isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['/api/rga/tasks'],
    queryFn: async () => {
      const response = await apiRequest<Task[]>('/api/rga/tasks');
      console.log('RGA Tasks fetched:', response);
      return response;
    }
  });

  // Filter tasks based on selections (moved up to be used in mutations)
  const filteredTasks = tasks?.filter(task => {
    const projectMatch = selectedProject === 'all' || task.projectId?.toString() === selectedProject;
    const assigneeMatch = selectedAssignee === 'all' || 
      (selectedAssignee === 'unassigned' && !task.assigneeId) ||
      (selectedAssignee !== 'unassigned' && task.assigneeId === selectedAssignee);
    const categoryMatch = !showOnlyUncategorized || !task.rgaCategory;
    return projectMatch && assigneeMatch && categoryMatch;
  }) || [];

  // Mutation to categorize task
  const categorizeTaskMutation = useMutation({
    mutationFn: async ({ taskId, category }: { taskId: number; category: string }) => {
      return apiRequest(`/api/rga/tasks/${taskId}/categorize`, {
        method: 'POST',
        body: JSON.stringify({ category })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rga/tasks'] });
      toast({
        title: "Task categorized",
        description: "Task has been successfully categorized"
      });
    }
  });

  // Mutation to auto-classify all tasks using AI
  const autoClassifyMutation = useMutation({
    mutationFn: async () => {
      const tasksToClassify = filteredTasks.filter(t => !t.rgaCategory);
      console.log('Tasks to classify:', tasksToClassify);
      return apiRequest('/api/rga/ai/auto-classify', {
        method: 'POST',
        body: JSON.stringify({ tasks: tasksToClassify })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rga/tasks'] });
      toast({
        title: "Tasks classified",
        description: "AI has successfully classified all uncategorized tasks"
      });
    },
    onError: (error) => {
      console.error('Error classifying tasks:', error);
      toast({
        title: "Classification failed",
        description: "Failed to classify tasks. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Generate AI recommendations
  const generateRecommendationsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/rga/ai/recommendations', {
        method: 'POST'
      });
    }
  });

  // Update settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<RgaSettings>) => {
      return apiRequest('/api/rga/settings', {
        method: 'PUT',
        body: JSON.stringify(newSettings)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rga/settings'] });
      toast({
        title: "Settings updated",
        description: "Your RGA settings have been saved"
      });
    }
  });

  // Export RGA report
  const exportReport = () => {
    const data = {
      settings,
      tasks: filteredTasks,
      metrics: {
        rgaPercentage,
        nonRgaPercentage,
        strategicPercentage,
        totalTasks: filteredTasks.length,
        byProject: projectBreakdown,
        byAssignee: assigneeBreakdown
      },
      recommendations: generateRecommendationsMutation.data
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rga-report-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const autoClassifyTasks = () => {
    autoClassifyMutation.mutate();
  };
  
  // Debug logging
  useEffect(() => {
    console.log('Selected project:', selectedProject);
    console.log('All tasks:', tasks?.length);
    console.log('Filtered tasks:', filteredTasks.length);
    console.log('Uncategorized tasks:', filteredTasks.filter(t => !t.rgaCategory).length);
  }, [selectedProject, tasks, filteredTasks]);

  // Calculate metrics
  const rgaTasks = filteredTasks.filter(t => t.rgaCategory === 'rga');
  const nonRgaTasks = filteredTasks.filter(t => t.rgaCategory === 'non-rga');
  const strategicTasks = filteredTasks.filter(t => t.rgaCategory === 'strategic');
  const uncategorizedTasks = filteredTasks.filter(t => !t.rgaCategory);
  
  const totalCategorized = rgaTasks.length + nonRgaTasks.length + strategicTasks.length;
  const rgaPercentage = totalCategorized > 0 ? (rgaTasks.length / totalCategorized) * 100 : 0;
  const nonRgaPercentage = totalCategorized > 0 ? (nonRgaTasks.length / totalCategorized) * 100 : 0;
  const strategicPercentage = totalCategorized > 0 ? (strategicTasks.length / totalCategorized) * 100 : 0;

  // Prepare chart data
  const pieData = [
    { name: 'RGA', value: rgaTasks.length, percentage: rgaPercentage },
    { name: 'Non-RGA', value: nonRgaTasks.length, percentage: nonRgaPercentage },
    { name: 'Strategic', value: strategicTasks.length, percentage: strategicPercentage }
  ].filter(d => d.value > 0);

  // Calculate project breakdown
  const projectBreakdown = projects?.map(project => {
    const projectTasks = filteredTasks.filter(t => t.projectId === project.id);
    const projectRga = projectTasks.filter(t => t.rgaCategory === 'rga').length;
    const projectTotal = projectTasks.filter(t => t.rgaCategory).length;
    return {
      name: project.name,
      total: projectTotal,
      rga: projectRga,
      percentage: projectTotal > 0 ? (projectRga / projectTotal) * 100 : 0
    };
  }).filter(p => p.total > 0) || [];

  // Calculate assignee breakdown (including unassigned)
  const assigneeBreakdown = Array.from(new Set(filteredTasks.map(t => t.assigneeId || 'unassigned')))
    .map(assigneeId => {
      const assigneeTasks = filteredTasks.filter(t => 
        assigneeId === 'unassigned' ? !t.assigneeId : t.assigneeId === assigneeId
      );
      const assigneeRga = assigneeTasks.filter(t => t.rgaCategory === 'rga').length;
      const assigneeTotal = assigneeTasks.filter(t => t.rgaCategory).length;
      return {
        id: assigneeId,
        name: assigneeId === 'unassigned' ? 'Unassigned' : (assigneeTasks[0]?.assigneeName || 'Unknown'),
        total: assigneeTotal,
        rga: assigneeRga,
        percentage: assigneeTotal > 0 ? (assigneeRga / assigneeTotal) * 100 : 0
      };
    }).filter(a => a.total > 0);

  const targetPercentage = settings?.targetRgaPercentage || 40;
  const isLoading = settingsLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading RGA data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-lg text-white">
              <TrendingUp className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">RGA Assistant</h1>
              <p className="text-gray-600">Optimize your Revenue-Generating Activities</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => refetchTasks()}
              disabled={tasksLoading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", tasksLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={exportReport}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Project</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects?.map(project => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assignee</Label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {tasks && Array.from(new Set(tasks.map(t => t.assigneeId)))
                    .filter(Boolean)
                    .map(assigneeId => {
                      const task = tasks.find(t => t.assigneeId === assigneeId);
                      return (
                        <SelectItem key={assigneeId} value={assigneeId}>
                          {task?.assigneeName || assigneeId}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant={showOnlyUncategorized ? "default" : "outline"}
                onClick={() => setShowOnlyUncategorized(!showOnlyUncategorized)}
                className="w-full"
              >
                <Filter className="h-4 w-4 mr-2" />
                {showOnlyUncategorized ? "Showing Uncategorized" : "Show All"}
              </Button>
            </div>
            <div className="flex items-end">
              <Button
                onClick={autoClassifyTasks}
                disabled={autoClassifyMutation.isPending || uncategorizedTasks.length === 0}
                className="w-full"
              >
                <Brain className="h-4 w-4 mr-2" />
                Auto-Classify ({uncategorizedTasks.length})
              </Button>
            </div>
          </div>
        </Card>

        {/* RGA Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Current RGA %</span>
              <TrendingUp className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-3xl font-bold mb-2">{rgaPercentage.toFixed(0)}%</div>
            <Progress value={rgaPercentage} className="h-2" />
            <div className="flex items-center mt-2 text-sm">
              {rgaPercentage >= targetPercentage ? (
                <>
                  <ArrowUp className="h-3 w-3 text-green-600 mr-1" />
                  <span className="text-green-600">On target</span>
                </>
              ) : (
                <>
                  <ArrowDown className="h-3 w-3 text-red-600 mr-1" />
                  <span className="text-red-600">{(targetPercentage - rgaPercentage).toFixed(0)}% below target</span>
                </>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Target RGA %</span>
              <Target className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-3xl font-bold mb-2">{targetPercentage}%</div>
            <div className="text-sm text-gray-600">
              {settings?.mode === 'pre-funding' ? 'Pre-funding mode' : 'Post-funding mode'}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Weekly Hours</span>
              <Clock className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-3xl font-bold mb-2">{settings?.weeklyCustomerHours || 40}</div>
            <div className="text-sm text-gray-600">Tracked this week</div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">RGA Tasks</span>
              <DollarSign className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-3xl font-bold mb-2">{rgaTasks.length}</div>
            <div className="text-sm text-gray-600">Revenue-generating</div>
          </Card>
        </div>

        {/* Alert if below target */}
        {rgaPercentage < targetPercentage && totalCategorized > 0 && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              Your RGA percentage is {(targetPercentage - rgaPercentage).toFixed(0)}% below target. 
              Consider prioritizing more customer-facing activities or reassigning non-critical tasks.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="categorize">Categorize Tasks</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="planning">Weekly Planning</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Task Distribution</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage.toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={
                            entry.name === 'RGA' ? COLORS.rga :
                            entry.name === 'Non-RGA' ? COLORS.nonRga :
                            COLORS.strategic
                          } 
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  No categorized tasks yet
                </div>
              )}
            </Card>

            {/* Project Breakdown */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">RGA by Project</h3>
              {projectBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={projectBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="percentage" fill={COLORS.rga} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  No project data available
                </div>
              )}
            </Card>
          </div>

          {/* Team Performance */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Team RGA Performance</h3>
            <div className="space-y-3">
              {assigneeBreakdown.map(assignee => (
                <div key={assignee.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium">{assignee.name}</p>
                      <p className="text-sm text-gray-600">{assignee.total} tasks</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">{assignee.percentage.toFixed(0)}% RGA</p>
                      <p className="text-sm text-gray-600">{assignee.rga} revenue tasks</p>
                    </div>
                    <Progress value={assignee.percentage} className="w-24" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Categorize Tasks Tab */}
        <TabsContent value="categorize" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Task Categorization</h2>
              <Badge variant="outline">{uncategorizedTasks.length} uncategorized</Badge>
            </div>

            {uncategorizedTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>All tasks are categorized!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {uncategorizedTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{task.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {task.projectName}
                        </Badge>
                        {task.priority === 'urgent' && (
                          <Badge variant="destructive" className="text-xs">Urgent</Badge>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {task.assigneeName || 'Unassigned'}
                        </span>
                        {task.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.dueDate), 'MMM d')}
                          </span>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {task.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => categorizeTaskMutation.mutate({ taskId: task.id, category: 'rga' })}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        RGA
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => categorizeTaskMutation.mutate({ taskId: task.id, category: 'non-rga' })}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Users className="h-4 w-4 mr-1" />
                        Non-RGA
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => categorizeTaskMutation.mutate({ taskId: task.id, category: 'strategic' })}
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        Strategic
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Categorized Tasks Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 border-green-200 bg-green-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-green-800">RGA Tasks</h3>
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-green-700 mb-2">{rgaTasks.length}</div>
              <p className="text-sm text-green-600 mb-4">Direct revenue generation</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {rgaTasks.map((task) => (
                  <div key={task.id} className="text-sm text-green-700 flex items-center justify-between">
                    <span className="truncate">• {task.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => categorizeTaskMutation.mutate({ taskId: task.id, category: '' })}
                      className="h-6 w-6 p-0 hover:bg-green-100"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 border-blue-200 bg-blue-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-blue-800">Non-RGA Tasks</h3>
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-blue-700 mb-2">{nonRgaTasks.length}</div>
              <p className="text-sm text-blue-600 mb-4">Support & operations</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {nonRgaTasks.map((task) => (
                  <div key={task.id} className="text-sm text-blue-700 flex items-center justify-between">
                    <span className="truncate">• {task.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => categorizeTaskMutation.mutate({ taskId: task.id, category: '' })}
                      className="h-6 w-6 p-0 hover:bg-blue-100"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 border-purple-200 bg-purple-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-purple-800">Strategic Tasks</h3>
                <Zap className="h-5 w-5 text-purple-600" />
              </div>
              <div className="text-3xl font-bold text-purple-700 mb-2">{strategicTasks.length}</div>
              <p className="text-sm text-purple-600 mb-4">Long-term growth</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {strategicTasks.map((task) => (
                  <div key={task.id} className="text-sm text-purple-700 flex items-center justify-between">
                    <span className="truncate">• {task.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => categorizeTaskMutation.mutate({ taskId: task.id, category: '' })}
                      className="h-6 w-6 p-0 hover:bg-purple-100"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Brain className="h-6 w-6 text-purple-600" />
                <h2 className="text-xl font-semibold">AI-Powered Insights</h2>
              </div>
              <Button
                onClick={() => generateRecommendationsMutation.mutate()}
                disabled={generateRecommendationsMutation.isPending}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Insights
              </Button>
            </div>

            {generateRecommendationsMutation.data ? (
              <div className="space-y-4">
                {generateRecommendationsMutation.data.recommendations?.map((rec: any, index: number) => (
                  <div key={index} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-lg">{rec.title}</h3>
                      <div className="flex gap-2">
                        <Badge variant={rec.impact === 'High' ? 'default' : 'secondary'}>
                          {rec.impact} Impact
                        </Badge>
                        <Badge variant={rec.effort === 'Low' ? 'outline' : 'secondary'}>
                          {rec.effort} Effort
                        </Badge>
                      </div>
                    </div>
                    <p className="text-gray-600">{rec.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Click "Generate Insights" to get AI recommendations</p>
                <p className="text-sm mt-2">Based on your current task distribution and RGA goals</p>
              </div>
            )}
          </Card>

          {/* Task Reassignment Suggestions */}
          {rgaPercentage < targetPercentage && nonRgaTasks.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="h-6 w-6 text-orange-600" />
                <h3 className="text-lg font-semibold">Suggested Task Reassignments</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Consider reassigning or automating these non-RGA tasks to focus more on revenue generation:
              </p>
              <div className="space-y-2">
                {nonRgaTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{task.name}</p>
                      <p className="text-sm text-gray-600">{task.projectName}</p>
                    </div>
                    <Badge variant="outline">Consider automating</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Weekly Planning Tab */}
        <TabsContent value="planning" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Weekly RGA Planning</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Monday-Wednesday */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-700">Early Week Focus</h3>
                <div className="space-y-3">
                  {rgaTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').slice(0, 3).map(task => (
                    <div key={task.id} className="p-3 border-l-4 border-green-500 bg-green-50 rounded-r-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{task.name}</p>
                          <p className="text-sm text-gray-600">{task.projectName}</p>
                        </div>
                        <Badge variant={task.priority === 'urgent' ? 'destructive' : 'default'}>
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Thursday-Friday */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-700">End Week Priorities</h3>
                <div className="space-y-3">
                  {strategicTasks.slice(0, 3).map(task => (
                    <div key={task.id} className="p-3 border-l-4 border-purple-500 bg-purple-50 rounded-r-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{task.name}</p>
                          <p className="text-sm text-gray-600">{task.projectName}</p>
                        </div>
                        <Badge variant="secondary">Strategic</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Time Allocation Recommendation */}
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-3">Recommended Time Allocation</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(targetPercentage)}%
                  </div>
                  <p className="text-sm text-gray-600">RGA Activities</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round((100 - targetPercentage) * 0.6)}%
                  </div>
                  <p className="text-sm text-gray-600">Operations</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round((100 - targetPercentage) * 0.4)}%
                  </div>
                  <p className="text-sm text-gray-600">Strategic</p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">RGA Settings</h2>
            
            <div className="space-y-6">
              <div>
                <Label>Startup Mode</Label>
                <Select 
                  value={settings?.mode} 
                  onValueChange={(value: 'pre-funding' | 'post-funding') => 
                    updateSettingsMutation.mutate({ mode: value })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre-funding">Pre-Funding (Focus on customer discovery)</SelectItem>
                    <SelectItem value="post-funding">Post-Funding (Scale revenue operations)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Target RGA Percentage</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Input
                    type="number"
                    value={settings?.targetRgaPercentage}
                    onChange={(e) => updateSettingsMutation.mutate({ 
                      targetRgaPercentage: parseInt(e.target.value) 
                    })}
                    className="w-24"
                    min="0"
                    max="100"
                  />
                  <span className="text-gray-600">% of time on revenue activities</span>
                </div>
              </div>

              <div>
                <Label>Weekly Customer Hours Goal</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Input
                    type="number"
                    value={settings?.weeklyCustomerHours}
                    onChange={(e) => updateSettingsMutation.mutate({ 
                      weeklyCustomerHours: parseInt(e.target.value) 
                    })}
                    className="w-24"
                    min="0"
                    max="80"
                  />
                  <span className="text-gray-600">hours per week</span>
                </div>
              </div>

              <div>
                <Label>Primary Revenue Channel</Label>
                <Input
                  value={settings?.revenueChannel || ''}
                  onChange={(e) => updateSettingsMutation.mutate({ 
                    revenueChannel: e.target.value 
                  })}
                  placeholder="e.g., SaaS subscriptions, consulting, marketplace"
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Next Major Milestone</Label>
                <Input
                  type="date"
                  value={settings?.nextMilestone ? format(new Date(settings.nextMilestone), 'yyyy-MM-dd') : ''}
                  onChange={(e) => updateSettingsMutation.mutate({ 
                    nextMilestone: e.target.value 
                  })}
                  className="mt-2"
                />
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}