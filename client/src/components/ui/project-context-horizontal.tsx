import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  FolderOpen, 
  Plus, 
  Clock, 
  BarChart3,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Calendar
} from 'lucide-react';
import type { Project, Task } from "@shared/schema";

interface ProjectContextHorizontalProps {
  className?: string;
}

export function ProjectContextHorizontal({ className }: ProjectContextHorizontalProps) {
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
  });

  // Calculate metrics
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const overdueTasks = tasks.filter(t => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < new Date() && t.status !== 'completed';
  }).length;
  const upcomingTasks = tasks.filter(t => {
    if (!t.dueDate) return false;
    const dueDate = new Date(t.dueDate);
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return dueDate >= today && dueDate <= nextWeek && t.status !== 'completed';
  }).length;

  const quickActions = [
    {
      icon: Plus,
      label: 'Create New Project',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 hover:bg-emerald-100'
    },
    {
      icon: FolderOpen,
      label: 'Show All Projects',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100'
    },
    {
      icon: Clock,
      label: 'Overdue Tasks',
      color: 'text-red-600',
      bgColor: 'bg-red-50 hover:bg-red-100'
    },
    {
      icon: BarChart3,
      label: 'Project Analysis',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100'
    }
  ];

  if (projectsLoading || tasksLoading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-32 bg-slate-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className={cn("", className)}>
      <div className="flex items-center gap-2 mb-4">
        <FolderOpen className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold text-slate-900">Project Context</h2>
        <Badge variant="outline" className="ml-auto text-xs">
          AI assistance with full project visibility
        </Badge>
      </div>
      
      <div className="space-y-4">
        {/* Overview Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
            <div className="text-xl font-bold text-emerald-600">{activeProjects}</div>
            <div className="text-sm text-emerald-700">Active Projects</div>
          </div>
          
          <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
            <div className="text-xl font-bold text-orange-600">{upcomingTasks}</div>
            <div className="text-sm text-orange-700">Due This Week</div>
          </div>

          {overdueTasks > 0 && (
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <div className="text-xl font-bold text-red-600">{overdueTasks}</div>
              </div>
              <div className="text-sm text-red-700">Overdue Tasks</div>
            </div>
          )}

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-xl font-bold text-slate-600">{projects.length}</div>
            <div className="text-sm text-slate-700">Total Projects</div>
          </div>
        </div>
      </div>
    </div>
  );
}