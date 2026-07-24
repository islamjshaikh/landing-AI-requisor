import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTask, NewTask } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

// Milestone creation schema
const milestoneFormSchema = z.object({
  name: z.string().min(3, { message: 'Milestone name must be at least 3 characters' }),
  description: z.string().optional(),
  dueDate: z.date().optional(),
  priority: z.string().optional().default('medium'),
});

type MilestoneFormValues = z.infer<typeof milestoneFormSchema>;

interface MilestoneCreatorProps {
  projectId: number;
  onMilestoneCreated?: () => void;
}

export default function MilestoneCreator({ projectId, onMilestoneCreated }: MilestoneCreatorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize form with default values
  const form = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneFormSchema),
    defaultValues: {
      name: '',
      description: '',
      priority: 'medium',
    },
  });

  // Create milestone mutation (implemented as a high-level task with no parent)
  const createMilestoneMutation = useMutation({
    mutationFn: (values: MilestoneFormValues) => {
      // Ensure we're sending the correct data structure that matches the schema
      const newTask: NewTask = {
        name: values.name,
        description: values.description || '',
        dueDate: values.dueDate || undefined, // Don't send null
        priority: values.priority || 'medium',
        projectId: projectId,
        status: 'todo',
        isCompleted: false,
        // For milestones, we don't set a parent task
        parentTaskId: null,
        // Add additional optional fields
        source: 'manual',
      };
      console.log('Sending milestone data:', newTask);
      return createTask(newTask);
    },
    onSuccess: () => {
      toast({
        title: 'Milestone created!',
        description: 'Your milestone has been created successfully.',
      });
      
      // Reset the form
      form.reset();
      
      // Refresh tasks list
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
      
      // Call the callback if provided
      if (onMilestoneCreated) {
        onMilestoneCreated();
      }
    },
    onError: (error) => {
      toast({
        title: 'Error creating milestone',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
      console.error('Error creating milestone:', error);
    },
  });

  const onSubmit = (values: MilestoneFormValues) => {
    createMilestoneMutation.mutate(values);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Add Project Milestone</CardTitle>
        <CardDescription>Create a major milestone for tracking project progress.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Milestone Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Phase 1 Completion" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe what will be accomplished in this milestone..." 
                      className="min-h-[100px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="w-full md:w-auto"
              disabled={createMilestoneMutation.isPending}
            >
              {createMilestoneMutation.isPending ? (
                <span>Creating milestone...</span>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" /> Add Milestone
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}