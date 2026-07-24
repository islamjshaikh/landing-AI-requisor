import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Calendar, 
  Target, 
  CheckSquare, 
  Clock,
  Save,
  Sparkles,
  Edit3,
  Check,
  X
} from 'lucide-react';
import { format } from 'date-fns';

interface ProjectPlan {
  name: string;
  description: string;
  timeline: string;
  milestones: Milestone[];
  tasks: TaskPlan[];
}

interface Milestone {
  name: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
}

interface TaskPlan {
  name: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  estimatedHours?: number;
  milestone?: string;
}

interface ProjectCanvasProps {
  projectPlan: ProjectPlan;
  onSave: (updatedPlan: ProjectPlan) => void;
  onEdit?: () => void;
  className?: string;
}

export function ProjectCanvas({ projectPlan, onSave, onEdit, className }: ProjectCanvasProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPlan, setEditedPlan] = useState<ProjectPlan>(projectPlan);

  const handleEdit = () => {
    setIsEditing(true);
    setEditedPlan(projectPlan);
  };

  const handleSave = () => {
    onSave(editedPlan);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedPlan(projectPlan);
    setIsEditing(false);
  };

  const updateMilestone = (index: number, field: keyof Milestone, value: string) => {
    const updatedMilestones = [...editedPlan.milestones];
    updatedMilestones[index] = { ...updatedMilestones[index], [field]: value };
    setEditedPlan({ ...editedPlan, milestones: updatedMilestones });
  };

  const updateTask = (index: number, field: keyof TaskPlan, value: string | number) => {
    const updatedTasks = [...editedPlan.tasks];
    updatedTasks[index] = { ...updatedTasks[index], [field]: value };
    setEditedPlan({ ...editedPlan, tasks: updatedTasks });
  };

  const currentPlan = isEditing ? editedPlan : projectPlan;
  const priorityColors = {
    low: 'bg-slate-100 text-slate-700 border-slate-200',
    medium: 'bg-orange-100 text-orange-700 border-orange-200',
    high: 'bg-red-100 text-red-700 border-red-200'
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  return (
    <div className={`bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            {isEditing ? (
              <Input
                value={editedPlan.name}
                onChange={(e) => setEditedPlan({ ...editedPlan, name: e.target.value })}
                className="text-xl font-semibold mb-1"
              />
            ) : (
              <h2 className="text-xl font-semibold text-slate-900">{currentPlan.name}</h2>
            )}
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              AI Generated Project Plan
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button 
                onClick={handleCancel}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={handleEdit}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Edit3 className="h-4 w-4" />
                Edit
              </Button>
              <Button 
                onClick={() => onSave(currentPlan)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save to Requisor
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Project Description */}
      <Card className="mb-6 border-none shadow-sm bg-white/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Project Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              value={editedPlan.description}
              onChange={(e) => setEditedPlan({ ...editedPlan, description: e.target.value })}
              className="min-h-[80px] text-slate-700"
              placeholder="Project description..."
            />
          ) : (
            <p className="text-slate-700 leading-relaxed">{currentPlan.description}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-600">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {isEditing ? (
                <Input
                  value={editedPlan.timeline}
                  onChange={(e) => setEditedPlan({ ...editedPlan, timeline: e.target.value })}
                  className="h-6 text-sm w-24"
                  placeholder="Timeline"
                />
              ) : (
                <span>Timeline: {currentPlan.timeline}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Target className="w-4 h-4" />
              <span>{currentPlan.milestones.length} Milestones</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckSquare className="w-4 h-4" />
              <span>{currentPlan.tasks.length} Tasks</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      {currentPlan.milestones.length > 0 && (
        <Card className="mb-6 border-none shadow-sm bg-white/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {currentPlan.milestones.map((milestone, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-slate-200">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      {isEditing ? (
                        <Input
                          value={editedPlan.milestones[index]?.name || ''}
                          onChange={(e) => updateMilestone(index, 'name', e.target.value)}
                          className="font-medium text-slate-900 flex-1 mr-2"
                        />
                      ) : (
                        <h4 className="font-medium text-slate-900">{milestone.name}</h4>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={priorityColors[milestone.priority]}>
                          {milestone.priority}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Calendar className="w-3 h-3" />
                          {isEditing ? (
                            <Input
                              type="date"
                              value={editedPlan.milestones[index]?.dueDate || ''}
                              onChange={(e) => updateMilestone(index, 'dueDate', e.target.value)}
                              className="h-6 text-xs w-32"
                            />
                          ) : (
                            <span>{formatDate(milestone.dueDate)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600">{milestone.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks */}
      {currentPlan.tasks.length > 0 && (
        <Card className="border-none shadow-sm bg-white/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-green-600" />
              Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {currentPlan.tasks.map((task, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-slate-200">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      {isEditing ? (
                        <Input
                          value={editedPlan.tasks[index]?.name || ''}
                          onChange={(e) => updateTask(index, 'name', e.target.value)}
                          className="font-medium text-slate-900 flex-1 mr-2"
                        />
                      ) : (
                        <h4 className="font-medium text-slate-900">{task.name}</h4>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={priorityColors[task.priority]}>
                          {task.priority}
                        </Badge>
                        {task.estimatedHours && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editedPlan.tasks[index]?.estimatedHours || ''}
                                onChange={(e) => updateTask(index, 'estimatedHours', parseInt(e.target.value) || 0)}
                                className="h-5 text-xs w-12"
                                min="0"
                              />
                            ) : (
                              <span>{task.estimatedHours}h</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Calendar className="w-3 h-3" />
                          {isEditing ? (
                            <Input
                              type="date"
                              value={editedPlan.tasks[index]?.dueDate || ''}
                              onChange={(e) => updateTask(index, 'dueDate', e.target.value)}
                              className="h-6 text-xs w-32"
                            />
                          ) : (
                            <span>{formatDate(task.dueDate)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isEditing ? (
                      <Textarea
                        value={editedPlan.tasks[index]?.description || ''}
                        onChange={(e) => updateTask(index, 'description', e.target.value)}
                        className="text-sm text-slate-600 mt-1 min-h-[60px]"
                        placeholder="Task description..."
                      />
                    ) : (
                      <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                    )}
                    {task.milestone && (
                      <div className="flex items-center gap-1 mt-2">
                        <Target className="w-3 h-3 text-purple-500" />
                        {isEditing ? (
                          <Input
                            value={editedPlan.tasks[index]?.milestone || ''}
                            onChange={(e) => updateTask(index, 'milestone', e.target.value)}
                            className="text-xs text-purple-600 font-medium h-5 w-32"
                            placeholder="Milestone"
                          />
                        ) : (
                          <span className="text-xs text-purple-600 font-medium">{task.milestone}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}