import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle2, Circle, Clock } from 'lucide-react';
import { safeFormatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Task {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  estimatedHours?: number;
}

interface Milestone {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  tasks: Task[];
}

interface ProjectCanvasProps {
  projectData: {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    milestones: Milestone[];
  };
  onSave?: (projectData: any) => void;
  className?: string;
}

export function ProjectCanvas({ projectData: initialData, onSave, className = '' }: ProjectCanvasProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [projectData, setProjectData] = useState(initialData);

  const handleSave = () => {
    setIsEditing(false);
    if (onSave) {
      onSave(projectData);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setProjectData(initialData);
  };

  const updateProject = (field: string, value: string) => {
    setProjectData(prev => ({ ...prev, [field]: value }));
  };

  const updateMilestone = (milestoneId: string, field: string, value: string) => {
    setProjectData(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => 
        m.id === milestoneId ? { ...m, [field]: value } : m
      )
    }));
  };

  const updateTask = (milestoneId: string, taskId: string, field: string, value: any) => {
    setProjectData(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => 
        m.id === milestoneId 
          ? {
              ...m,
              tasks: m.tasks.map(t => 
                t.id === taskId ? { ...t, [field]: value } : t
              )
            }
          : m
      )
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className={`bg-white shadow-sm ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {isEditing ? (
              <Input
                value={projectData.name}
                onChange={(e) => updateProject('name', e.target.value)}
                className="text-xl font-semibold mb-2"
                placeholder="Project Name"
              />
            ) : (
              <CardTitle className="text-xl">{projectData.name}</CardTitle>
            )}
            {isEditing ? (
              <Textarea
                value={projectData.description}
                onChange={(e) => updateProject('description', e.target.value)}
                className="text-sm text-muted-foreground resize-none"
                rows={2}
                placeholder="Project Description"
              />
            ) : (
              <CardDescription className="mt-1">{projectData.description}</CardDescription>
            )}
          </div>
          <div className="ml-4">
            {isEditing ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>Save Changes</Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {isEditing ? (
              <input
                type="date"
                value={projectData.startDate}
                onChange={(e) => updateProject('startDate', e.target.value)}
                className="border rounded px-1"
              />
            ) : (
              <span>{safeFormatDate(projectData.startDate, 'MMM d, yyyy')}</span>
            )}
            <span>-</span>
            {isEditing ? (
              <input
                type="date"
                value={projectData.endDate}
                onChange={(e) => updateProject('endDate', e.target.value)}
                className="border rounded px-1"
              />
            ) : (
              <span>{safeFormatDate(projectData.endDate, 'MMM d, yyyy')}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{projectData.milestones.length} milestones</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {projectData.milestones.map((milestone) => (
          <div key={milestone.id} className="border rounded-lg p-4 bg-gray-50">
            <div className="mb-3">
              {isEditing ? (
                <Input
                  value={milestone.name}
                  onChange={(e) => updateMilestone(milestone.id, 'name', e.target.value)}
                  className="font-semibold mb-1"
                  placeholder="Milestone Name"
                />
              ) : (
                <h4 className="font-semibold text-base">{milestone.name}</h4>
              )}
              {isEditing ? (
                <Textarea
                  value={milestone.description}
                  onChange={(e) => updateMilestone(milestone.id, 'description', e.target.value)}
                  className="text-sm text-muted-foreground resize-none"
                  rows={1}
                  placeholder="Milestone Description"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{milestone.description}</p>
              )}
              <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {isEditing ? (
                  <input
                    type="date"
                    value={milestone.dueDate}
                    onChange={(e) => updateMilestone(milestone.id, 'dueDate', e.target.value)}
                    className="border rounded px-1"
                  />
                ) : (
                  <span>{safeFormatDate(milestone.dueDate, 'MMM d, yyyy')}</span>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              {milestone.tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 pl-4 py-2 border-l-2 border-gray-200">
                  <Circle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    {isEditing ? (
                      <Input
                        value={task.name}
                        onChange={(e) => updateTask(milestone.id, task.id, 'name', e.target.value)}
                        className="font-medium text-sm mb-1"
                        placeholder="Task Name"
                      />
                    ) : (
                      <div className="font-medium text-sm">{task.name}</div>
                    )}
                    {isEditing ? (
                      <Textarea
                        value={task.description}
                        onChange={(e) => updateTask(milestone.id, task.id, 'description', e.target.value)}
                        className="text-xs text-muted-foreground resize-none"
                        rows={1}
                        placeholder="Task Description"
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground">{task.description}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {isEditing ? (
                        <Select
                          value={task.priority}
                          onValueChange={(value) => updateTask(milestone.id, task.id, 'priority', value)}
                        >
                          <SelectTrigger className="h-6 text-xs w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={`text-xs px-2 py-0 ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {isEditing ? (
                          <input
                            type="date"
                            value={task.dueDate}
                            onChange={(e) => updateTask(milestone.id, task.id, 'dueDate', e.target.value)}
                            className="border rounded px-1"
                          />
                        ) : (
                          <>Due {safeFormatDate(task.dueDate, 'MMM d')}</>
                        )}
                      </span>
                      {task.estimatedHours && (
                        <span className="text-xs text-muted-foreground">
                          {isEditing ? (
                            <input
                              type="number"
                              value={task.estimatedHours}
                              onChange={(e) => updateTask(milestone.id, task.id, 'estimatedHours', parseInt(e.target.value))}
                              className="border rounded px-1 w-12"
                              min="1"
                            />
                          ) : (
                            task.estimatedHours
                          )} hrs
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {onSave && !isEditing && (
          <Button onClick={handleSave} className="w-full mt-4">
            Save to Requisor
          </Button>
        )}
      </CardContent>
    </Card>
  );
}