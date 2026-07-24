import { useState, useEffect } from 'react';
import { Task } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { getProjectTasks } from '@/lib/api';
import { TaskList } from './TaskList';
import { TaskRecommendationsSidebar } from './TaskRecommendationsSidebar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TaskDetailsWithRecommendationsProps {
  projectId: number;
}

export function TaskDetailsWithRecommendations({ projectId }: TaskDetailsWithRecommendationsProps) {
  // Track which task is selected for recommendations
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Fetch tasks for this project
  const { data: tasks = [], isSuccess } = useQuery({
    queryKey: ['/api/projects', projectId, 'tasks'],
    queryFn: () => getProjectTasks(projectId),
  });
  
  // Automatically select the first task when tasks are loaded
  useEffect(() => {
    if (isSuccess && tasks.length > 0 && !selectedTask) {
      setSelectedTask(tasks[0]);
    }
  }, [isSuccess, tasks, selectedTask]);
  
  // Handle task selection for recommendations
  const handleTaskSelect = (task: Task) => {
    setSelectedTask(task);
  };
  
  return (
    <ResizablePanelGroup 
      direction="horizontal" 
      className="min-h-[600px] rounded-lg border"
    >
      <ResizablePanel defaultSize={66} minSize={40}>
        <div className="h-full p-6">
          <h3 className="text-lg font-medium mb-4">Project Tasks</h3>
          <TaskList 
            projectId={projectId} 
            onTaskSelect={handleTaskSelect} 
            selectedTaskId={selectedTask?.id}
          />
        </div>
      </ResizablePanel>
      
      <ResizableHandle withHandle />
      
      <ResizablePanel defaultSize={34} minSize={30}>
        <TaskRecommendationsSidebar 
          task={selectedTask} 
          onClose={() => setSelectedTask(null)}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
