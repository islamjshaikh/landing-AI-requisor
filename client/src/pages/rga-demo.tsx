import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkles, TrendingUp, AlertCircle, BarChart3, Target, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Demo data for illustration
const demoTasks = [
  { id: 1, name: 'Follow up with potential investor', project: 'Fundraising', assignee: 'Sarah Chen', priority: 'high', category: 'rga', impact: 95 },
  { id: 2, name: 'Update company blog', project: 'Marketing', assignee: 'Mike Johnson', priority: 'low', category: 'non-rga', impact: 20 },
  { id: 3, name: 'Customer demo with Enterprise client', project: 'Sales', assignee: 'Sarah Chen', priority: 'high', category: 'rga', impact: 90 },
  { id: 4, name: 'Team building event planning', project: 'HR', assignee: 'Lisa Park', priority: 'medium', category: 'non-rga', impact: 15 },
  { id: 5, name: 'Develop new pricing strategy', project: 'Product', assignee: 'John Davis', priority: 'high', category: 'strategic', impact: 85 },
  { id: 6, name: 'Close deal with Fortune 500 client', project: 'Sales', assignee: 'Sarah Chen', priority: 'high', category: 'rga', impact: 100 },
  { id: 7, name: 'Refactor authentication system', project: 'Engineering', assignee: 'Mike Johnson', priority: 'medium', category: 'strategic', impact: 60 },
  { id: 8, name: 'Write technical documentation', project: 'Engineering', assignee: 'Lisa Park', priority: 'low', category: 'non-rga', impact: 25 },
];

const demoInsights = [
  "Sarah Chen is spending 80% of her time on RGA tasks - excellent focus on revenue generation!",
  "Your team is currently at 65% RGA allocation. Consider delegating non-RGA tasks to increase this to 70%+",
  "3 high-impact RGA tasks are pending. Completing these could increase monthly revenue by $45K",
  "Mike Johnson has capacity for more RGA tasks. Consider reassigning 'Update company blog' to free up time"
];

export default function RgaDemo() {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'rga' | 'non-rga' | 'strategic'>('all');
  const [isClassifying, setIsClassifying] = useState(false);
  const [showAIInsights, setShowAIInsights] = useState(false);

  const filteredTasks = selectedCategory === 'all' 
    ? demoTasks 
    : demoTasks.filter(task => task.category === selectedCategory);

  const rgaTasks = demoTasks.filter(t => t.category === 'rga').length;
  const totalTasks = demoTasks.length;
  const rgaPercentage = Math.round((rgaTasks / totalTasks) * 100);

  const handleAutoClassify = () => {
    setIsClassifying(true);
    setTimeout(() => {
      setIsClassifying(false);
      setShowAIInsights(true);
    }, 2000);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'rga': return 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
      case 'non-rga': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'strategic': return 'bg-purple-500/10 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'rga': return <CheckCircle2 className="h-3 w-3" />;
      case 'non-rga': return <XCircle className="h-3 w-3" />;
      case 'strategic': return <AlertTriangle className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Demo Banner */}
      <Card className="mb-6 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <CardTitle>RGA Assistant Demo</CardTitle>
          </div>
          <CardDescription>
            This is a demonstration of how the RGA (Revenue-Generating Activities) Assistant helps startups prioritize tasks for maximum growth
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">RGA Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rgaPercentage}%</div>
            <Progress value={rgaPercentage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">of total tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">RGA Tasks</CardTitle>
              <Target className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rgaTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">revenue-generating</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Strategic Tasks</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demoTasks.filter(t => t.category === 'strategic').length}</div>
            <p className="text-xs text-muted-foreground mt-1">long-term growth</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Time Saved</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12h</div>
            <p className="text-xs text-muted-foreground mt-1">this week with AI</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">Task Analysis</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="planning">Weekly Planning</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Task Classification</CardTitle>
                  <CardDescription>AI automatically categorizes your tasks based on revenue impact</CardDescription>
                </div>
                <Button 
                  onClick={handleAutoClassify}
                  disabled={isClassifying}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600"
                >
                  {isClassifying ? (
                    <>
                      <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                      Classifying...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Auto-Classify Tasks
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Category Filter */}
              <div className="flex gap-2 mb-4">
                {['all', 'rga', 'non-rga', 'strategic'].map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category as any)}
                    className={selectedCategory === category ? 'bg-emerald-600' : ''}
                  >
                    {category === 'all' ? 'All Tasks' : category.toUpperCase()}
                  </Button>
                ))}
              </div>

              {/* Task List */}
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-medium">{task.name}</h4>
                        <Badge className={cn("gap-1", getCategoryColor(task.category))}>
                          {getCategoryIcon(task.category)}
                          {task.category.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{task.project}</span>
                        <span>•</span>
                        <span>{task.assignee}</span>
                        <span>•</span>
                        <span className="capitalize">{task.priority} priority</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">Impact Score</div>
                      <div className="text-2xl font-bold text-emerald-600">{task.impact}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI-Powered Insights</CardTitle>
              <CardDescription>Smart recommendations to optimize your revenue-generating activities</CardDescription>
            </CardHeader>
            <CardContent>
              {showAIInsights ? (
                <div className="space-y-4">
                  {demoInsights.map((insight, index) => (
                    <div key={index} className="flex gap-3 p-4 bg-emerald-50 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm">{insight}</p>
                    </div>
                  ))}
                  
                  <div className="mt-6 p-4 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-lg">
                    <h4 className="font-medium mb-2">Recommended Actions:</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Prioritize "Close deal with Fortune 500 client" - highest revenue impact
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Delegate "Team building event planning" to free up Sarah's time for RGA tasks
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Schedule strategic tasks for next sprint to maintain long-term growth
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-muted-foreground">Click "Auto-Classify Tasks" to generate AI insights</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planning" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly RGA Planning</CardTitle>
              <CardDescription>AI-optimized schedule focusing on revenue-generating activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Team Member RGA Allocation */}
                <div className="space-y-3">
                  <h4 className="font-medium mb-3">Team RGA Allocation</h4>
                  {['Sarah Chen', 'Mike Johnson', 'Lisa Park', 'John Davis'].map((member) => {
                    const memberTasks = demoTasks.filter(t => t.assignee === member);
                    const memberRga = memberTasks.filter(t => t.category === 'rga').length;
                    const percentage = memberTasks.length > 0 ? Math.round((memberRga / memberTasks.length) * 100) : 0;
                    
                    return (
                      <div key={member} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center text-sm font-medium">
                            {member.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-medium">{member}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={percentage} className="w-32" />
                          <span className="text-sm font-medium w-12 text-right">{percentage}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Weekly Focus */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-3">This Week's Focus</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-sm font-medium text-emerald-600 mb-2">Top RGA Priorities</h5>
                      <ul className="space-y-1 text-sm">
                        <li>• Close Fortune 500 deal (Sarah)</li>
                        <li>• Investor follow-up (Sarah)</li>
                        <li>• Enterprise client demo (Sarah)</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-purple-600 mb-2">Strategic Initiatives</h5>
                      <ul className="space-y-1 text-sm">
                        <li>• New pricing strategy (John)</li>
                        <li>• Auth system refactor (Mike)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}