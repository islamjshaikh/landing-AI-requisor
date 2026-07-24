import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Save, 
  X, 
  Calendar,
  Target,
  Edit2,
  Plus,
  Trash2,
  CheckCircle
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ProjectPlan {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  milestones: Milestone[];
}

interface Milestone {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  tasks: Task[];
}

interface Task {
  id: string;
  name: string;
  description?: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
}

interface ProjectPlannerCanvasProps {
  projectPlan: ProjectPlan;
  onSave: (plan: ProjectPlan) => void;
  onClose: () => void;
}

export function ProjectPlannerCanvas({ projectPlan, onSave, onClose }: ProjectPlannerCanvasProps) {
  const [editMode, setEditMode] = useState(false);
  const [plan, setPlan] = useState<ProjectPlan>(projectPlan);

  const handleUpdateProject = (field: keyof ProjectPlan, value: string) => {
    setPlan(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdateMilestone = (milestoneId: string, field: keyof Milestone, value: string) => {
    setPlan(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => 
        m.id === milestoneId ? { ...m, [field]: value } : m
      )
    }));
  };

  const handleUpdateTask = (milestoneId: string, taskId: string, field: keyof Task, value: any) => {
    setPlan(prev => ({
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

  const handleAddTask = (milestoneId: string) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      name: 'New Task',
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'medium'
    };

    setPlan(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => 
        m.id === milestoneId 
          ? { ...m, tasks: [...m.tasks, newTask] }
          : m
      )
    }));
  };

  const handleDeleteTask = (milestoneId: string, taskId: string) => {
    setPlan(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => 
        m.id === milestoneId 
          ? { ...m, tasks: m.tasks.filter(t => t.id !== taskId) }
          : m
      )
    }));
  };

  const handleSave = () => {
    onSave(plan);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Card className="h-full flex flex-col min-h-[600px]">
      <CardHeader className="pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center">
            <Target className="h-6 w-6 mr-2 text-purple-600" />
            Project Canvas
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditMode(!editMode)}
            >
              <Edit2 className="h-4 w-4 mr-1" />
              {editMode ? 'Done Editing' : 'Edit'}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Save className="h-4 w-4 mr-1" />
              Save to Projects
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-6 py-4 chat-scroll-area">
          {/* Project Details */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm font-medium text-gray-700">Project Name</label>
              {editMode ? (
                <Input
                  value={plan.name}
                  onChange={(e) => handleUpdateProject('name', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <h2 className="text-2xl font-bold mt-1">{plan.name}</h2>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              {editMode ? (
                <Textarea
                  value={plan.description}
                  onChange={(e) => handleUpdateProject('description', e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              ) : (
                <p className="text-gray-600 mt-1">{plan.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Start Date</label>
                {editMode ? (
                  <Input
                    type="date"
                    value={plan.startDate}
                    onChange={(e) => handleUpdateProject('startDate', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="flex items-center mt-1">
                    <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                    <span>{new Date(plan.startDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">End Date</label>
                {editMode ? (
                  <Input
                    type="date"
                    value={plan.endDate}
                    onChange={(e) => handleUpdateProject('endDate', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="flex items-center mt-1">
                    <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                    <span>{new Date(plan.endDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-purple-600" />
              Milestones & Tasks
            </h3>

            {plan.milestones.map((milestone, mIndex) => (
              <div key={milestone.id} className="bg-gray-50 rounded-lg p-4">
                <div className="mb-4">
                  {editMode ? (
                    <div className="space-y-2">
                      <Input
                        value={milestone.name}
                        onChange={(e) => handleUpdateMilestone(milestone.id, 'name', e.target.value)}
                        className="font-semibold"
                      />
                      <Textarea
                        value={milestone.description}
                        onChange={(e) => handleUpdateMilestone(milestone.id, 'description', e.target.value)}
                        rows={2}
                      />
                      <Input
                        type="date"
                        value={milestone.dueDate}
                        onChange={(e) => handleUpdateMilestone(milestone.id, 'dueDate', e.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      <h4 className="font-semibold text-lg">{milestone.name}</h4>
                      <p className="text-gray-600 text-sm mt-1">{milestone.description}</p>
                      <div className="flex items-center mt-2">
                        <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                        <span className="text-sm text-gray-500">
                          Due: {new Date(milestone.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Tasks */}
                <div className="space-y-2">
                  {milestone.tasks.map((task, tIndex) => (
                    <div key={task.id} className="bg-white rounded-lg p-3 border">
                      {editMode ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              value={task.name}
                              onChange={(e) => handleUpdateTask(milestone.id, task.id, 'name', e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTask(milestone.id, task.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              type="date"
                              value={task.dueDate}
                              onChange={(e) => handleUpdateTask(milestone.id, task.id, 'dueDate', e.target.value)}
                              className="flex-1"
                            />
                            <Select
                              value={task.priority}
                              onValueChange={(value) => handleUpdateTask(milestone.id, task.id, 'priority', value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium">{task.name}</h5>
                            <div className="flex items-center gap-2 mt-1">
                              <Calendar className="h-3 w-3 text-gray-500" />
                              <span className="text-xs text-gray-500">
                                {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}

                  {editMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddTask(milestone.id)}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Task
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}