import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Clock, CheckCircle, AlertCircle, TrendingUp, FolderOpen, Users, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useWebSocket } from "@/hooks/useWebSocket";
import { updateProjectLastOpened } from "@/lib/projectUtils";

import type { Project, Task } from "@shared/schema";

function DashboardContent() {
  // Temporarily disable WebSocket to prevent 4500 errors
  // useWebSocket(true);

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
  });

  // Calculate metrics
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const isValidDate = (d: any) => {
    if (!d) return false;
    const date = new Date(d);
    return !isNaN(date.getTime());
  };
  const overdueTasks = tasks.filter(t => {
    if (!isValidDate(t.dueDate)) return false;
    return new Date(t.dueDate!) < new Date() && t.status !== 'done';
  }).length;
  const upcomingTasks = tasks.filter(t => {
    if (!isValidDate(t.dueDate)) return false;
    const dueDate = new Date(t.dueDate!);
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return dueDate >= today && dueDate <= nextWeek && t.status !== 'done';
  }).length;

  const recentProjects = projects.slice(0, 4);

  if (projectsLoading || tasksLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-8 bg-slate-200 rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600">Overview of your projects and tasks</p>
        </div>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
          <Link href="/create-project">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Active Projects</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-emerald-600">{activeProjects}</span>
              <FolderOpen className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Completed Tasks</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-green-600">{completedTasks}</span>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Overdue Tasks</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-red-600">{overdueTasks}</span>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Due This Week</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-orange-600">{upcomingTasks}</span>
              <Clock className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Projects */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-emerald-600" />
              Recent Projects
            </CardTitle>
            <CardDescription>Your most recently updated projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentProjects.length > 0 ? (
                recentProjects.map((project) => {
                  const projectTasks = tasks.filter(t => t.projectId === project.id);
                  const completedCount = projectTasks.filter(t => t.status === 'completed').length;
                  const progress = projectTasks.length > 0 ? (completedCount / projectTasks.length) * 100 : 0;

                  return (
                    <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex-1">
                        <Link 
                          href={`/projects/${project.id}`}
                          onClick={() => updateProjectLastOpened(project.id)}
                        >
                          <h4 className="font-medium text-slate-900 hover:text-emerald-600 transition-colors">
                            {project.name}
                          </h4>
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {project.status}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {completedCount}/{projectTasks.length} tasks
                          </span>
                        </div>
                        <Progress value={progress} className="mt-2 h-2" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6">
                  <FolderOpen className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-500">No projects yet</p>
                  <Button asChild variant="outline" size="sm" className="mt-2">
                    <Link href="/create-project">Create your first project</Link>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
              Upcoming Tasks
            </CardTitle>
            <CardDescription>Tasks due in the next 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingTasks > 0 ? (
                tasks
                  .filter(t => {
                    if (!isValidDate(t.dueDate)) return false;
                    const dueDate = new Date(t.dueDate!);
                    const today = new Date();
                    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                    return dueDate >= today && dueDate <= nextWeek && t.status !== 'completed';
                  })
                  .slice(0, 5)
                  .map((task) => {
                    const project = projects.find(p => p.id === task.projectId);
                    const daysUntilDue = Math.ceil((new Date(task.dueDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <h5 className="font-medium text-slate-900">{task.name}</h5>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {project?.name}
                            </Badge>
                            <span className={`text-xs ${daysUntilDue <= 1 ? 'text-red-600' : daysUntilDue <= 3 ? 'text-orange-600' : 'text-slate-500'}`}>
                              {daysUntilDue === 0 ? 'Due today' : daysUntilDue === 1 ? 'Due tomorrow' : `Due in ${daysUntilDue} days`}
                            </span>
                          </div>
                        </div>
                        <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}>
                          {task.priority}
                        </Badge>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-6">
                  <Calendar className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-500">No upcoming tasks</p>
                  <p className="text-xs text-slate-400">Tasks due in the next week will appear here</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="flex h-full">
        <div className="flex-1">
          <DashboardContent />
        </div>
      </div>
    </AppLayout>
  );
}