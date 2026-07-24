import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjectTasks, updateTask, deleteTask } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ProjectTask } from '@/types';
import type { Task } from '@shared/schema';
import { format } from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  Edit,
  Trash2,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  CalendarDays,
  Flag,
} from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import MilestoneCreator from './MilestoneCreator';
import TaskCreator from './TaskCreator';

// Using ProjectTask type from the shared types

interface ProjectTaskManagerProps {
  projectId: number;
}

export default function ProjectTaskManager({ projectId }: ProjectTaskManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for the selected task/milestone and dialogs
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState<boolean>(false);
  const [showAddMilestoneDialog, setShowAddMilestoneDialog] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [taskToDelete, setTaskToDelete] = useState<ProjectTask | null>(null);
  const [expandedMilestones, setExpandedMilestones] = useState<number[]>([]);

  // Fetch tasks for this project
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: [`/api/projects/${projectId}/tasks`],
  });

  // Toggle completed status mutation
  const toggleCompletedMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      return updateTask(id, { isCompleted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
    },
    onError: () => {
      toast({
        title: 'Error updating task',
        description: 'There was a problem updating the task status.',
        variant: 'destructive',
      });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => {
      return deleteTask(taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      toast({
        title: 'Item deleted',
        description: 'The item has been deleted successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error deleting item',
        description: 'There was a problem deleting the item.',
        variant: 'destructive',
      });
    },
  });

  // Handle toggle task completion
  const handleToggleCompleted = (task: ProjectTask) => {
    toggleCompletedMutation.mutate({
      id: task.id,
      isCompleted: !task.isCompleted,
    });
  };

  // Handle delete task confirmation
  const handleConfirmDelete = () => {
    if (taskToDelete) {
      deleteTaskMutation.mutate(taskToDelete.id);
    }
  };

  // Toggle milestone expansion
  const toggleMilestoneExpansion = (milestoneId: number) => {
    if (expandedMilestones.includes(milestoneId)) {
      setExpandedMilestones(expandedMilestones.filter(id => id !== milestoneId));
    } else {
      setExpandedMilestones([...expandedMilestones, milestoneId]);
    }
  };

  // For now, we don't have actual milestones - just treat all tasks as regular tasks
  // This prevents the React error #130 that was caused by undefined milestone data
  const milestones: ProjectTask[] = []; // Empty array until milestone feature is properly implemented
  const subtasks: ProjectTask[] = []; // Empty array for now
  const standaloneTasks = Array.isArray(tasks) ? tasks : [];

  // Get tasks for a specific milestone
  const getTasksForMilestone = (milestoneId: number) => {
    return subtasks.filter((task: ProjectTask) => task.parentTaskId === milestoneId);
  };


  // Priority badge component
  const PriorityBadge = ({ priority }: { priority: string }) => {
    const bgColor = 
      priority === 'high' ? 'bg-red-100 text-red-800' :
      priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
      'bg-blue-100 text-blue-800';
    
    return (
      <Badge className={`${bgColor} font-normal`}>
        <Flag className="h-3 w-3 mr-1" />
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const bgColor = 
      status === 'done' ? 'bg-green-100 text-green-800' :
      status === 'in-progress' ? 'bg-purple-100 text-purple-800' :
      'bg-slate-100 text-slate-800';
    
    return (
      <Badge className={`${bgColor} font-normal`}>
        {status === 'todo' ? 'To Do' : 
         status === 'in-progress' ? 'In Progress' : 
         'Done'}
      </Badge>
    );
  };

  // Render a task row
  const renderTaskRow = (task: ProjectTask, isMilestone: boolean = false) => {
    const taskTasks = isMilestone ? getTasksForMilestone(task.id) : [];
    const isExpanded = expandedMilestones.includes(task.id);
    
    return (
      <div className="border rounded-lg mb-3 overflow-hidden" key={task.id}>
        <div className={`p-4 flex items-start gap-3 ${isMilestone ? 'bg-slate-50' : 'bg-white'}`}>
          {/* Checkbox or expander */}
          <div className="pt-0.5">
            {isMilestone && taskTasks.length > 0 ? (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0" 
                onClick={() => toggleMilestoneExpansion(task.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-slate-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-slate-500" />
                )}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => handleToggleCompleted(task)}
              >
                {task.isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300" />
                )}
              </Button>
            )}
          </div>
          
          {/* Task details */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <h3 className={`font-medium ${task.isCompleted ? 'line-through text-slate-500' : ''}`}>
                {task.name}
              </h3>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                {task.dueDate && (
                  <Badge className="bg-slate-100 text-slate-800 font-normal">
                    <CalendarDays className="h-3 w-3 mr-1" />
                    {format(new Date(task.dueDate), 'MMM d')}
                  </Badge>
                )}
              </div>
            </div>
            
            {task.description && (
              <p className="text-sm text-slate-600 mb-3">{task.description}</p>
            )}
            
            {/* Task actions */}
            <div className="flex justify-end gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-slate-600 hover:text-slate-900"
                onClick={() => {
                  // We would add edit logic here in a real implementation
                  toast({
                    title: "Edit task",
                    description: "Task editing functionality would open here.",
                  });
                }}
              >
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-red-600 hover:text-red-800"
                onClick={() => {
                  setTaskToDelete(task);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
              
              {isMilestone && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 text-blue-600 hover:text-blue-800"
                  onClick={() => {
                    setSelectedTaskId(task.id);
                    setShowAddTaskDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Task
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* Sub-tasks if this is a milestone */}
        {isMilestone && isExpanded && taskTasks.length > 0 && (
          <div className="pl-10 pr-4 pb-4 bg-white border-t">
            <div className="pt-3 space-y-2">
              {taskTasks.map((subtask: ProjectTask) => (
                renderTaskRow(subtask)
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <div className="py-4">Loading tasks...</div>;
  }

  if (error) {
    return <div className="py-4 text-red-500">Error loading tasks</div>;
  }

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button 
          variant="default" 
          onClick={() => setShowAddMilestoneDialog(true)}
        >
          <Plus className="h-4 w-4 mr-2" /> Add Milestone
        </Button>
        <Button 
          variant="outline" 
          onClick={() => {
            setSelectedTaskId(null);
            setShowAddTaskDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> Add Task
        </Button>
      </div>

      {/* Task Lists */}
      <div className="space-y-6">
        {/* Milestones with subtasks */}
        {milestones.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Milestones</CardTitle>
              <CardDescription>Major deliverables and phases of your project</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {milestones.map((milestone: ProjectTask) => (
                  renderTaskRow(milestone, true)
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Regular tasks (not part of a milestone) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Tasks</CardTitle>
            <CardDescription>Project tasks</CardDescription>
          </CardHeader>
          <CardContent>
            {standaloneTasks.length > 0 ? (
              <div className="space-y-2">
                {standaloneTasks.map((task: ProjectTask) => (
                  renderTaskRow(task)
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500">
                <p>No standalone tasks yet.</p>
                <Button 
                  variant="link" 
                  onClick={() => {
                    setSelectedTaskId(null);
                    setShowAddTaskDialog(true);
                  }}
                >
                  Add your first task
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Task Dialog */}
      <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
            <DialogDescription>
              {selectedTaskId 
                ? "Add a task to this milestone"
                : "Create a new standalone task"}
            </DialogDescription>
          </DialogHeader>
          <TaskCreator 
            projectId={projectId}
            parentTaskId={selectedTaskId}
            onTaskCreated={() => setShowAddTaskDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Add Milestone Dialog */}
      <Dialog open={showAddMilestoneDialog} onOpenChange={setShowAddMilestoneDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Project Milestone</DialogTitle>
            <DialogDescription>
              Create a major milestone to track project progress
            </DialogDescription>
          </DialogHeader>
          <MilestoneCreator 
            projectId={projectId}
            onMilestoneCreated={() => setShowAddMilestoneDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {taskToDelete?.parentTaskId === null 
                ? "This will delete the milestone and all associated tasks. This action cannot be undone." 
                : "This will delete the task. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleteTaskMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}