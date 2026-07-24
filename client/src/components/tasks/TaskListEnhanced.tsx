import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Task } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar, ChevronDown, MoreHorizontal, Search, SortAsc, SortDesc, Brain, Zap, GripVertical } from 'lucide-react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { getProjectTasks, updateTask, createSubtask } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { apiRequest } from '@/lib/queryClient';

interface TaskListEnhancedProps {
  projectId: number;
  onTaskSelect?: (task: Task) => void;
  selectedTaskId?: number;
}

type SortOption = 'priority' | 'dueDate' | 'status' | 'name';
type SortDirection = 'asc' | 'desc';

const priorityOrder = { high: 3, medium: 2, low: 1 };
const statusOrder = { todo: 1, 'in-progress': 2, completed: 3 };

// Sortable Task Card Component
function SortableTaskCard({ 
  task, 
  selectedTaskId,
  onTaskSelect,
  onStatusChange,
  onBreakdown,
  isBreakingDown,
  getPriorityColor,
  getStatusColor,
  getDueDateDisplay
}: {
  task: Task;
  selectedTaskId?: number;
  onTaskSelect?: (task: Task) => void;
  onStatusChange: (taskId: number, status: string) => void;
  onBreakdown: (taskId: number) => void;
  isBreakingDown: boolean;
  getPriorityColor: (priority: string) => string;
  getStatusColor: (status: string) => string;
  getDueDateDisplay: (dueDate: string | null) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(task.id) });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-4 border rounded-lg transition-all hover:shadow-md",
        selectedTaskId === task.id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white",
        isDragging && "opacity-50 shadow-xl"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div {...attributes} {...listeners} className="cursor-move mt-1">
            <GripVertical className="h-5 w-5 text-gray-400" />
          </div>
          
          <Checkbox
            checked={task.status === 'completed'}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={(checked) => {
              onStatusChange(task.id, checked ? 'completed' : 'todo');
            }}
          />
          
          <div 
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => onTaskSelect?.(task)}
          >
            <h4 className={cn(
              "font-medium text-gray-900 truncate",
              task.status === 'completed' && "line-through text-gray-500"
            )}>
              {task.title}
            </h4>
            
            {task.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
            
            <div className="flex items-center gap-2 mt-2">
              <Badge className={cn("text-xs", getPriorityColor(task.priority))}>
                {task.priority}
              </Badge>
              
              <Badge className={cn("text-xs", getStatusColor(task.status))}>
                {task.status.replace('-', ' ')}
              </Badge>
              
              {task.dueDate && (
                <div className="text-xs">
                  {getDueDateDisplay(task.dueDate)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 ml-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onBreakdown(task.id);
            }}
            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            disabled={isBreakingDown}
          >
            <Brain className="h-4 w-4 mr-1" />
            Break Down
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'todo')}>
                Mark as To Do
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'in-progress')}>
                Mark as In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'completed')}>
                Mark as Completed
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onBreakdown(task.id)}
                className="text-purple-600"
              >
                <Zap className="h-4 w-4 mr-2" />
                Break down further
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export function TaskListEnhanced({ projectId, onTaskSelect, selectedTaskId }: TaskListEnhancedProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'tasks'],
    queryFn: () => getProjectTasks(projectId),
  });

  // Break down task mutation (AI-powered subtask creation)
  const breakdownTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const response = await fetch('/api/tasks/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, projectId })
      });
      if (!response.ok) throw new Error('Failed to break down task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
      toast({
        title: "Task broken down",
        description: "AI has created subtasks for better organization"
      });
    },
    onError: () => {
      toast({
        title: "Breakdown failed",
        description: "Could not break down the task",
        variant: "destructive"
      });
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) => updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
    }
  });

  // Reorder tasks mutation
  const reorderTasksMutation = useMutation({
    mutationFn: async (taskIds: number[]) => {
      return apiRequest(`/api/projects/${projectId}/tasks/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ taskIds }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
      toast({
        title: "Tasks reordered",
        description: "Task order has been updated"
      });
    },
    onError: () => {
      toast({
        title: "Reorder failed",
        description: "Could not update task order",
        variant: "destructive"
      });
    }
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
      
      return matchesSearch && matchesStatus && matchesPriority;
    });

    // Sort tasks
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'priority':
          comparison = (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
                      (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
          break;
        case 'dueDate':
          const aDate = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const bDate = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          comparison = aDate - bDate;
          break;
        case 'status':
          comparison = (statusOrder[a.status as keyof typeof statusOrder] || 0) - 
                      (statusOrder[b.status as keyof typeof statusOrder] || 0);
          break;
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
      }
      
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [tasks, searchTerm, sortBy, sortDirection, filterStatus, filterPriority]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'todo': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDueDateDisplay = (dueDate: string | null) => {
    if (!dueDate) return null;
    
    const date = new Date(dueDate);
    const now = new Date();
    
    if (isPast(date) && !isToday(date)) {
      return <span className="text-red-600 font-medium">Overdue ({format(date, 'MMM d')})</span>;
    }
    if (isToday(date)) {
      return <span className="text-orange-600 font-medium">Due today</span>;
    }
    if (isTomorrow(date)) {
      return <span className="text-yellow-600 font-medium">Due tomorrow</span>;
    }
    
    return <span className="text-gray-600">Due {format(date, 'MMM d')}</span>;
  };

  const handleSortChange = (newSortBy: SortOption) => {
    if (sortBy === newSortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('desc');
    }
  };

  const handleStatusChange = (taskId: number, newStatus: string) => {
    updateTaskMutation.mutate({ 
      id: taskId, 
      data: { status: newStatus } 
    });
  };

  const handleBreakdownTask = (taskId: number) => {
    breakdownTaskMutation.mutate(taskId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const taskIds = filteredAndSortedTasks.map(t => t.id);
    const oldIndex = taskIds.indexOf(Number(active.id));
    const newIndex = taskIds.indexOf(Number(over.id));
    
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedIds = arrayMove(taskIds, oldIndex, newIndex);
    reorderTasksMutation.mutate(reorderedIds);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {sortDirection === 'asc' ? <SortAsc className="h-4 w-4 mr-2" /> : <SortDesc className="h-4 w-4 mr-2" />}
                Sort by {sortBy}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleSortChange('priority')}>
                Priority {sortBy === 'priority' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('dueDate')}>
                Due Date {sortBy === 'dueDate' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('status')}>
                Status {sortBy === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('name')}>
                Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tasks List with Drag and Drop */}
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
          {filteredAndSortedTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchTerm || filterStatus !== 'all' || filterPriority !== 'all' 
                ? 'No tasks match your current filters' 
                : 'No tasks found'}
            </div>
          ) : (
            <SortableContext 
              items={filteredAndSortedTasks.map(t => String(t.id))}
              strategy={verticalListSortingStrategy}
            >
              {filteredAndSortedTasks.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  selectedTaskId={selectedTaskId}
                  onTaskSelect={onTaskSelect}
                  onStatusChange={handleStatusChange}
                  onBreakdown={handleBreakdownTask}
                  isBreakingDown={breakdownTaskMutation.isPending}
                  getPriorityColor={getPriorityColor}
                  getStatusColor={getStatusColor}
                  getDueDateDisplay={getDueDateDisplay}
                />
              ))}
            </SortableContext>
          )}
        </div>
      </DndContext>
    </div>
  );
}