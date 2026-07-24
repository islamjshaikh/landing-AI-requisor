import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  Target, 
  Save,
  Edit,
  X
} from 'lucide-react';
import { safeFormatDate } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface ProjectPlan {
  name: string;
  description: string;
  timeline: {
    startDate: string;
    endDate: string;
  };
  milestones: Array<{
    name: string;
    description: string;
    dueDate: string;
    priority: string;
  }>;
  tasks: Array<{
    name: string;
    description: string;
    dueDate: string;
    priority: string;
    assignee?: string;
  }>;
}

interface ProjectPlanCanvasProps {
  plan: ProjectPlan;
  isEditable?: boolean;
  onPlanUpdate?: (plan: ProjectPlan) => void;
}

export function ProjectPlanCanvas({ plan, isEditable = false, onPlanUpdate }: ProjectPlanCanvasProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editablePlan, setEditablePlan] = useState(plan);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const saveProjectMutation = useMutation({
    mutationFn: async (projectPlan: ProjectPlan) => {
      const response = await fetch('/api/projects/from-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: projectPlan }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save project');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Project Created!",
        description: `${data.project.name} has been successfully created and saved.`,
      });
      
      // Invalidate projects cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      
      // Navigate to projects page after a short delay
      setTimeout(() => {
        navigate('/projects');
      }, 1500);
    },
    onError: (error) => {
      console.error('Save project error:', error);
      toast({
        title: "Error",
        description: "Failed to save project. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSaveToRequisor = () => {
    setIsSaving(true);
    saveProjectMutation.mutate(editablePlan);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditablePlan(plan);
  };

  const handleSaveChanges = () => {
    setIsEditing(false);
    if (onPlanUpdate) {
      onPlanUpdate(editablePlan);
    }
    toast({
      title: "Changes Saved",
      description: "Project plan has been updated.",
    });
  };

  const currentPlan = isEditing ? editablePlan : plan;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {isEditing ? (
              <input
                value={editablePlan.name}
                onChange={(e) => setEditablePlan({...editablePlan, name: e.target.value})}
                className="text-2xl font-bold border-b border-slate-300 bg-transparent focus:outline-none focus:border-blue-500 w-full"
              />
            ) : (
              <CardTitle className="text-2xl font-bold">{currentPlan.name}</CardTitle>
            )}
          </div>
          
          <div className="flex gap-2">
            {isEditable && !isEditing && (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            
            {isEditing && (
              <>
                <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveChanges}>
                  <Save className="h-4 w-4 mr-1" />
                  Save Changes
                </Button>
              </>
            )}
            
            {!isEditing && (
              <Button 
                onClick={handleSaveToRequisor}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save to Requisor'}
              </Button>
            )}
          </div>
        </div>
        
        <div className="text-slate-600 mt-2">
          {isEditing ? (
            <textarea
              value={editablePlan.description}
              onChange={(e) => setEditablePlan({...editablePlan, description: e.target.value})}
              className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              rows={3}
            />
          ) : (
            <p>{currentPlan.description}</p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Timeline */}
        {currentPlan.timeline && (
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
            <Calendar className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium">Timeline</p>
              <p className="text-sm text-slate-600">
                {safeFormatDate(currentPlan.timeline.startDate, 'MMM d, yyyy')} - {safeFormatDate(currentPlan.timeline.endDate, 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        )}

        {/* Milestones */}
        {currentPlan.milestones && currentPlan.milestones.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center">
              <Target className="h-5 w-5 mr-2 text-green-600" />
              Milestones
            </h3>
            <div className="space-y-3">
              {currentPlan.milestones.map((milestone, index) => (
                <div key={index} className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{milestone.name}</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant={milestone.priority === 'high' ? 'destructive' : 
                        milestone.priority === 'medium' ? 'default' : 'secondary'}>
                        {milestone.priority}
                      </Badge>
                      <div className="flex items-center text-sm text-slate-600">
                        <Clock className="h-4 w-4 mr-1" />
                        {safeFormatDate(milestone.dueDate, 'MMM d')}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">{milestone.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Tasks */}
        {currentPlan.tasks && currentPlan.tasks.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-blue-600" />
              Tasks ({currentPlan.tasks.length})
            </h3>
            <div className="space-y-2">
              {currentPlan.tasks.map((task, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <div className="flex-1">
                    <p className="font-medium">{task.name}</p>
                    {task.description && (
                      <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={task.priority === 'high' ? 'destructive' : 
                      task.priority === 'medium' ? 'default' : 'secondary'}>
                      {task.priority}
                    </Badge>
                    {task.dueDate && (
                      <div className="flex items-center text-sm text-slate-600">
                        <Clock className="h-4 w-4 mr-1" />
                        {safeFormatDate(task.dueDate, 'MMM d')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save Button (bottom) */}
        {!isEditing && (
          <div className="pt-4 border-t">
            <Button 
              onClick={handleSaveToRequisor}
              disabled={isSaving}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              <Save className="h-5 w-5 mr-2" />
              {isSaving ? 'Creating Project...' : 'Save to Requisor'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}