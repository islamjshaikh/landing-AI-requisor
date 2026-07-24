import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Calendar, Clock, Target, CheckCircle, AlertCircle, Circle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameMonth, isToday } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TaskDetailsPanel } from '@/components/tasks/TaskDetailsPanel';
import type { Task } from '@shared/schema';

function normalizeStatus(status: string): string {
  if (status === 'in_progress') return 'in-progress';
  return status;
}

interface Milestone {
  id: number;
  name: string;
  dueDate: string | null;
  status: 'not-started' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

interface TimelineCalendarProps {
  projectId: number;
}

export function TimelineCalendar({ projectId }: TimelineCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: rawTasks = [] } = useQuery<Task[]>({
    queryKey: [`/api/projects/${projectId}/tasks`],
  });

  const tasks = useMemo(() =>
    rawTasks.map(t => ({
      ...t,
      status: normalizeStatus(t.status),
    })),
    [rawTasks]
  );

  const selectedTask = useMemo(() =>
    selectedTaskId ? tasks.find(t => t.id === selectedTaskId) ?? null : null,
    [selectedTaskId, tasks]
  );

  const { data: milestones = [] } = useQuery<Milestone[]>({
    queryKey: ['/api/projects', projectId, 'milestones'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/milestones`);
      if (!response.ok) throw new Error('Failed to fetch milestones');
      return response.json();
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus, isCompleted }: { taskId: number; newStatus: string; isCompleted: boolean }) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus, isCompleted }),
      });
      if (!response.ok) throw new Error('Failed to update task');
      return response.json();
    },
    onMutate: async ({ taskId, newStatus, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
      const previousTasks = queryClient.getQueryData<Task[]>([`/api/projects/${projectId}/tasks`]);
      queryClient.setQueryData([`/api/projects/${projectId}/tasks`], (old: Task[] | undefined) =>
        old?.map(t => t.id === taskId ? { ...t, status: newStatus, isCompleted } : t)
      );
      return { previousTasks };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData([`/api/projects/${projectId}/tasks`], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
    },
  });

  const handleToggleDone = useCallback((e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const isDone = normalizeStatus(task.status) === 'done';
    toggleStatusMutation.mutate({
      taskId: task.id,
      newStatus: isDone ? 'todo' : 'done',
      isCompleted: !isDone,
    });
  }, [toggleStatusMutation]);

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTaskId(task.id);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedTaskId(null);
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
  }, [queryClient, projectId]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);
  const paddingDays = Array(startPadding).fill(null);

  const itemsByDate = useMemo(() => {
    const dateMap = new Map<string, { tasks: Task[], milestones: Milestone[] }>();
    
    tasks.forEach(task => {
      if (task.dueDate) {
        const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd');
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, { tasks: [], milestones: [] });
        }
        dateMap.get(dateKey)!.tasks.push(task);
      }
    });

    milestones.forEach(milestone => {
      if (milestone.dueDate) {
        const dateKey = format(new Date(milestone.dueDate), 'yyyy-MM-dd');
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, { tasks: [], milestones: [] });
        }
        dateMap.get(dateKey)!.milestones.push(milestone);
      }
    });

    return dateMap;
  }, [tasks, milestones]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(direction === 'prev' ? subMonths(currentMonth, 1) : addMonths(currentMonth, 1));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case 'done':
      case 'completed':
        return <CheckCircle className="h-3 w-3" />;
      case 'in-progress':
        return <Clock className="h-3 w-3" />;
      default:
        return <AlertCircle className="h-3 w-3" />;
    }
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Timeline Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="font-semibold text-lg min-w-[150px] text-center">
                {format(currentMonth, 'MMMM yyyy')}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
                className="ml-4"
              >
                Today
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-700">
                {day}
              </div>
            ))}
            
            {paddingDays.map((_, index) => (
              <div key={`padding-${index}`} className="bg-white p-2 min-h-[100px]" />
            ))}
            
            {calendarDays.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayItems = itemsByDate.get(dateKey) || { tasks: [], milestones: [] };
              const isCurrentMonth = isSameMonth(day, currentMonth);
              
              return (
                <div
                  key={dateKey}
                  className={cn(
                    'bg-white p-2 min-h-[100px] border-t',
                    !isCurrentMonth && 'bg-gray-50',
                    isToday(day) && 'bg-blue-50'
                  )}
                >
                  <div className={cn(
                    'text-sm font-medium mb-1',
                    isToday(day) ? 'text-blue-600' : 'text-gray-900',
                    !isCurrentMonth && 'text-gray-400'
                  )}>
                    {format(day, 'd')}
                  </div>
                  
                  <div className="space-y-1">
                    {dayItems.milestones.slice(0, 2).map(milestone => (
                      <Tooltip key={`milestone-${milestone.id}`}>
                        <TooltipTrigger asChild>
                          <div className={cn(
                            'text-xs p-1 rounded flex items-center gap-1 cursor-default border',
                            getPriorityColor(milestone.priority)
                          )}>
                            <Target className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{milestone.name}</span>
                            {getStatusIcon(milestone.status)}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div>
                            <p className="font-semibold">{milestone.name}</p>
                            <p className="text-xs">Milestone • {milestone.status}</p>
                            <p className="text-xs">Priority: {milestone.priority}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    
                    {dayItems.tasks.slice(0, 3 - dayItems.milestones.length).map(task => {
                      const status = normalizeStatus(task.status);
                      return (
                        <Tooltip key={`task-${task.id}`}>
                          <TooltipTrigger asChild>
                            <div
                              onClick={() => handleTaskClick(task)}
                              className={cn(
                                'text-xs p-1 rounded flex items-center gap-1 cursor-pointer group transition-colors',
                                status === 'done'
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : status === 'in-progress'
                                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                              )}
                            >
                              <button
                                onClick={(e) => handleToggleDone(e, task)}
                                className="flex-shrink-0 hover:scale-125 transition-transform"
                                title={status === 'done' ? 'Mark as todo' : 'Mark as done'}
                              >
                                {status === 'done' ? (
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Circle className="h-3 w-3 text-gray-400 group-hover:text-gray-600" />
                                )}
                              </button>
                              <span className={cn(
                                'truncate',
                                status === 'done' && 'line-through opacity-70'
                              )}>{task.name}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div>
                              <p className="font-semibold">{task.name}</p>
                              <p className="text-xs">Task • {status}</p>
                              <p className="text-xs">Priority: {task.priority}</p>
                              <p className="text-xs text-blue-600 mt-1">Click to view details</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    
                    {(dayItems.tasks.length + dayItems.milestones.length) > 3 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{(dayItems.tasks.length + dayItems.milestones.length) - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-gray-600" />
              <span>Milestone</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-gray-600" />
              <span>To Do</span>
            </div>
            <div className="flex items-center gap-2 ml-4 text-gray-500">
              <Circle className="h-4 w-4" />
              <span>Click circle to toggle done</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedTask && (
        <TaskDetailsPanel
          task={selectedTask}
          projectId={projectId}
          onClose={handleClosePanel}
        />
      )}
    </TooltipProvider>
  );
}