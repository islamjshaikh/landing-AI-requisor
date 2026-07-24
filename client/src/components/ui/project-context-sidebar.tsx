import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface ProjectContextSidebarProps {
  onActionClick: (prompt: string) => void;
  className?: string;
}

export function ProjectContextSidebar({ onActionClick, className }: ProjectContextSidebarProps) {
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
      prompt: 'Create a new project for building a mobile app',
      color: 'text-emerald-600'
    },
    {
      icon: FolderOpen,
      label: 'Show All Projects',
      prompt: 'Show me all my current projects and their status',
      color: 'text-blue-600'
    },
    {
      icon: Clock,
      label: 'Overdue Tasks',
      prompt: 'What tasks are overdue across all my projects?',
      color: 'text-red-600'
    },
    {
      icon: BarChart3,
      label: 'Project Analysis',
      prompt: 'Analyze the health of my current projects',
      color: 'text-purple-600'
    }
  ];

  if (projectsLoading || tasksLoading) {
    return (
      <div className={cn("w-80 border-l bg-slate-50/50", className)}>
        <div className="p-4 space-y-4">
          <div className="animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-80 border-l bg-slate-50/50 flex flex-col", className)}>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Project Context Header */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen className="h-4 w-4 text-slate-600" />
              <h3 className="font-semibold text-slate-800">Project Context</h3>
            </div>
            <p className="text-sm text-slate-600">AI assistance with full project visibility</p>
          </div>

          <Separator />

          {/* Project Overview */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-700">Overview</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white p-3 rounded-lg border">
                <div className="text-lg font-bold text-emerald-600">{activeProjects}</div>
                <div className="text-xs text-slate-600">Active Projects</div>
              </div>
              
              <div className="bg-white p-3 rounded-lg border">
                <div className="text-lg font-bold text-orange-600">{upcomingTasks}</div>
                <div className="text-xs text-slate-600">Due This Week</div>
              </div>
            </div>

            {overdueTasks > 0 && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">
                    {overdueTasks} Overdue Task{overdueTasks > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Quick Actions */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-700">Quick Actions</h4>
            
            <div className="space-y-2">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={() => onActionClick(action.prompt)}
                  className="w-full justify-start h-auto p-3 text-left hover:bg-white"
                >
                  <action.icon className={cn("h-4 w-4 mr-3", action.color)} />
                  <span className="text-sm text-slate-700">{action.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Recent Projects */}
          {projects.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-700">Recent Projects</h4>
                
                <div className="space-y-2">
                  {projects.slice(0, 3).map((project) => {
                    const projectTasks = tasks.filter(t => t.projectId === project.id);
                    const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
                    const progress = projectTasks.length > 0 ? (completedTasks / projectTasks.length) * 100 : 0;
                    
                    return (
                      <Button
                        key={project.id}
                        variant="ghost"
                        size="sm"
                        onClick={() => onActionClick(`Tell me about the ${project.name} project`)}
                        className="w-full justify-start h-auto p-3 text-left hover:bg-white"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-800 truncate">
                            {project.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {Math.round(progress)}%
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {completedTasks}/{projectTasks.length} tasks
                            </span>
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}