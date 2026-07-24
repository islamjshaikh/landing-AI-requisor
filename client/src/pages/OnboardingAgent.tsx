import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { 
  UserPlus, 
  Calendar, 
  Clock, 
  Users, 
  FileText, 
  Mail, 
  CheckCircle, 
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Play,
  Brain,
  Sparkles,
  Target,
  MessageSquare,
  BookOpen,
  Settings,
  Eye
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface OnboardingPlan {
  id: number;
  name: string;
  description: string;
  type: 'employee' | 'client' | 'contractor';
  role: string;
  duration: number;
  status: 'draft' | 'active' | 'archived';
  isTemplate: boolean;
  createdAt: string;
  steps?: OnboardingStep[];
}

interface OnboardingStep {
  id: number;
  planId: number;
  title: string;
  description: string;
  category: 'welcome' | 'tools' | 'culture' | 'tasks' | 'goals' | 'feedback';
  dayNumber: number;
  order: number;
  assignedTo: 'ai' | 'manager' | 'buddy' | 'hr';
  isRequired: boolean;
  estimatedTime: number;
  resources: any[];
  completionCriteria: string;
}

interface OnboardingInstance {
  id: number;
  planId: number;
  onboardeeName: string;
  onboardeeEmail: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'paused';
  completionRate: number;
  currentDay: number;
  startDate: string;
  expectedEndDate: string;
}

const categoryIcons = {
  welcome: MessageSquare,
  tools: Settings,
  culture: Users,
  tasks: Target,
  goals: Sparkles,
  feedback: BookOpen
};

const categoryColors = {
  welcome: 'bg-blue-100 text-blue-800',
  tools: 'bg-purple-100 text-purple-800',
  culture: 'bg-green-100 text-green-800',
  tasks: 'bg-orange-100 text-orange-800',
  goals: 'bg-yellow-100 text-yellow-800',
  feedback: 'bg-pink-100 text-pink-800'
};

const assignedToColors = {
  ai: 'bg-blue-100 text-blue-800',
  manager: 'bg-green-100 text-green-800',
  buddy: 'bg-purple-100 text-purple-800',
  hr: 'bg-orange-100 text-orange-800'
};

export default function OnboardingAgent() {
  const [activeTab, setActiveTab] = useState("plans");
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showWelcomeEmailGenerator, setShowWelcomeEmailGenerator] = useState(false);
  const [showQuizGenerator, setShowQuizGenerator] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<OnboardingPlan | null>(null);
  const [newPlanData, setNewPlanData] = useState({
    type: 'employee' as 'employee' | 'client' | 'contractor',
    role: '',
    department: '',
    duration: 7,
    tools: '',
    documents: '',
    culture: '',
    customRequirements: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch onboarding plans
  const { data: plans = [], isLoading: plansLoading } = useQuery<OnboardingPlan[]>({
    queryKey: ["/api/onboarding/plans"],
    enabled: activeTab === "plans"
  });

  // Fetch onboarding instances
  const { data: instances = [], isLoading: instancesLoading } = useQuery<OnboardingInstance[]>({
    queryKey: ["/api/onboarding/instances"],
    enabled: activeTab === "instances"
  });

  // Generate onboarding plan mutation
  const generatePlanMutation = useMutation({
    mutationFn: async (planData: any) => {
      console.log("Making API request with data:", planData);
      return apiRequest("/api/onboarding/generate-plan", {
        method: "POST",
        body: planData
      });
    },
    onSuccess: (data) => {
      console.log("Plan generated successfully:", data);
      toast({
        title: "Plan Generated",
        description: "AI has created your onboarding plan successfully!"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/plans"] });
      setShowCreatePlan(false);
      setSelectedPlan(data);
      
      // Reset form data
      setNewPlanData({
        type: 'employee',
        role: '',
        department: '',
        duration: 7,
        tools: '',
        documents: '',
        culture: '',
        customRequirements: ''
      });
    },
    onError: (error: any) => {
      console.error("Plan generation error:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to generate onboarding plan";
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  // Generate welcome email mutation
  const generateWelcomeEmailMutation = useMutation({
    mutationFn: async (emailData: any) => {
      return apiRequest("/api/onboarding/generate-welcome-email", {
        method: "POST",
        body: emailData
      });
    }
  });

  // Generate quiz mutation
  const generateQuizMutation = useMutation({
    mutationFn: async (quizData: any) => {
      return apiRequest("/api/onboarding/generate-quiz", {
        method: "POST",
        body: quizData
      });
    }
  });

  const handleGeneratePlan = () => {
    console.log("Form data before validation:", newPlanData);
    
    // More thorough validation
    const trimmedRole = newPlanData.role?.trim();
    if (!newPlanData.type || !trimmedRole || !newPlanData.duration || newPlanData.duration < 1) {
      toast({
        title: "Missing Information",
        description: `Please fill in all required fields. Missing: ${[
          !newPlanData.type && "type",
          !trimmedRole && "role", 
          (!newPlanData.duration || newPlanData.duration < 1) && "duration"
        ].filter(Boolean).join(", ")}`,
        variant: "destructive"
      });
      return;
    }

    const planRequest = {
      type: newPlanData.type,
      role: trimmedRole,
      department: newPlanData.department?.trim() || "",
      duration: newPlanData.duration,
      tools: newPlanData.tools ? newPlanData.tools.split(',').map(t => t.trim()).filter(t => t) : [],
      documents: newPlanData.documents ? newPlanData.documents.split(',').map(d => d.trim()).filter(d => d) : [],
      culture: newPlanData.culture ? newPlanData.culture.split(',').map(c => c.trim()).filter(c => c) : [],
      customRequirements: newPlanData.customRequirements?.trim() || ""
    };

    console.log("Sending plan request:", planRequest);
    generatePlanMutation.mutate(planRequest);
  };

  const PlanCard = ({ plan }: { plan: OnboardingPlan }) => (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedPlan(plan)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{plan.name}</CardTitle>
          <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
            {plan.status}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2">{plan.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span className="flex items-center gap-1">
            <UserPlus className="h-4 w-4" />
            {plan.type} • {plan.role}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {plan.duration} days
          </span>
        </div>
        {plan.steps && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{plan.steps.length} steps</span>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex gap-1">
              {Array.from(new Set(plan.steps.map(s => s.category))).slice(0, 3).map(category => {
                const Icon = categoryIcons[category as keyof typeof categoryIcons];
                return <Icon key={category} className="h-3 w-3" />;
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const InstanceCard = ({ instance }: { instance: OnboardingInstance }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{instance.onboardeeName}</CardTitle>
          <Badge variant={instance.status === 'completed' ? 'default' : 'secondary'}>
            {instance.status.replace('_', ' ')}
          </Badge>
        </div>
        <CardDescription>{instance.onboardeeEmail}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Progress</span>
            <span>{instance.completionRate}%</span>
          </div>
          <Progress value={instance.completionRate} className="h-2" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Day {instance.currentDay}</span>
            <span>Started {new Date(instance.startDate).toLocaleDateString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <UserPlus className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Onboarding Agent</h1>
              <p className="text-gray-600">Create intelligent onboarding experiences with AI assistance</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
            <TabsTrigger value="plans" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="instances" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Sessions
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Tools
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Onboarding Plans</h2>
              <Button onClick={() => setShowCreatePlan(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Plan
              </Button>
            </div>

            {plansLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-full mt-2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : plans.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No onboarding plans yet</h3>
                <p className="text-gray-500 mb-6">Create your first AI-powered onboarding plan to get started</p>
                <Button onClick={() => setShowCreatePlan(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Plan
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Instances Tab */}
          <TabsContent value="instances" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Active Onboarding Sessions</h2>
              <Button variant="outline">
                <Play className="h-4 w-4 mr-2" />
                Start New Session
              </Button>
            </div>

            {instancesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-full mt-2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-2 bg-gray-200 rounded w-full"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : instances.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {instances.map((instance) => (
                  <InstanceCard key={instance.id} instance={instance} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No active onboarding sessions</h3>
                <p className="text-gray-500 mb-6">Start onboarding new team members with your created plans</p>
                <Button variant="outline">
                  <Play className="h-4 w-4 mr-2" />
                  Start New Session
                </Button>
              </div>
            )}
          </TabsContent>

          {/* AI Tools Tab */}
          <TabsContent value="tools" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">AI Co-Pilot Tools</h2>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                3 Tools Available
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-blue-200" onClick={() => setShowWelcomeEmailGenerator(true)}>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Mail className="h-5 w-5 text-blue-600" />
                    </div>
                    <Badge variant="outline" className="text-xs">AI Powered</Badge>
                  </div>
                  <CardTitle className="text-lg">Welcome Email Generator</CardTitle>
                  <CardDescription className="text-sm">
                    Generate personalized welcome emails for new team members with AI assistance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full">
                    Generate Email
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-purple-200" onClick={() => setShowQuizGenerator(true)}>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <BookOpen className="h-5 w-5 text-purple-600" />
                    </div>
                    <Badge variant="outline" className="text-xs">Interactive</Badge>
                  </div>
                  <CardTitle className="text-lg">Quiz Generator</CardTitle>
                  <CardDescription className="text-sm">
                    Create interactive quizzes to test understanding of company culture and procedures
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full">
                    Create Quiz
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-yellow-200">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Sparkles className="h-5 w-5 text-yellow-600" />
                    </div>
                    <Badge variant="outline" className="text-xs">Smart</Badge>
                  </div>
                  <CardTitle className="text-lg">Plan Optimizer</CardTitle>
                  <CardDescription className="text-sm">
                    Get AI suggestions to improve your onboarding plans and optimize the experience
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full">
                    Optimize Plans
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mt-8">
              <div className="flex items-center gap-3 mb-3">
                <Brain className="h-6 w-6 text-blue-600" />
                <h3 className="text-lg font-medium">AI Co-Pilot Features</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Our AI co-pilot tools help you create engaging onboarding experiences with minimal effort. 
                Each tool is powered by advanced AI to generate content that's personalized and effective.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Personalized content generation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Role-specific customization</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Continuous improvement suggestions</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <h2 className="text-2xl font-semibold">Onboarding Analytics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
                  <div className="text-2xl font-bold">{plans.filter((p) => p.status === 'active').length}</div>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                  <div className="text-2xl font-bold">
                    {instances.length > 0 
                      ? Math.round(instances.reduce((acc, inst) => acc + inst.completionRate, 0) / instances.length)
                      : 0}%
                  </div>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                  <div className="text-2xl font-bold">{instances.filter((i) => i.status === 'in_progress').length}</div>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Avg. Duration</CardTitle>
                  <div className="text-2xl font-bold">
                    {plans.length > 0 
                      ? Math.round(plans.reduce((acc, plan) => acc + plan.duration, 0) / plans.length)
                      : 0} days
                  </div>
                </CardHeader>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Plan Dialog */}
        <Dialog open={showCreatePlan} onOpenChange={setShowCreatePlan}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-4">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                </div>
                Create AI-Powered Onboarding Plan
              </DialogTitle>
              <DialogDescription className="text-base">
                Tell our AI about your onboarding needs and we'll create a comprehensive, personalized plan with detailed steps and timeline.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="type" className="text-sm font-medium">Onboarding Type *</Label>
                    <Select value={newPlanData.type} onValueChange={(value: any) => setNewPlanData({...newPlanData, type: value})}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">👥 Employee</SelectItem>
                        <SelectItem value="client">🤝 Client</SelectItem>
                        <SelectItem value="contractor">💼 Contractor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="duration" className="text-sm font-medium">Duration (days) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={newPlanData.duration}
                      onChange={(e) => setNewPlanData({...newPlanData, duration: parseInt(e.target.value) || 7})}
                      min="1"
                      max="90"
                      className="mt-1"
                      placeholder="7"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="role" className="text-sm font-medium">Role/Position *</Label>
                    <Input
                      id="role"
                      value={newPlanData.role}
                      onChange={(e) => setNewPlanData({...newPlanData, role: e.target.value})}
                      placeholder="e.g., Software Engineer"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="department" className="text-sm font-medium">Department</Label>
                  <Input
                    id="department"
                    value={newPlanData.department}
                    onChange={(e) => setNewPlanData({...newPlanData, department: e.target.value})}
                    placeholder="e.g., Engineering, Marketing, Sales"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Tools & Resources */}
              <div className="bg-purple-50 rounded-lg p-4 space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Tools & Resources
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="tools" className="text-sm font-medium">Tools & Software</Label>
                    <Input
                      id="tools"
                      value={newPlanData.tools}
                      onChange={(e) => setNewPlanData({...newPlanData, tools: e.target.value})}
                      placeholder="e.g., Slack, GitHub, Figma, Google Workspace"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Separate multiple items with commas</p>
                  </div>
                  
                  <div>
                    <Label htmlFor="documents" className="text-sm font-medium">Key Documents</Label>
                    <Input
                      id="documents"
                      value={newPlanData.documents}
                      onChange={(e) => setNewPlanData({...newPlanData, documents: e.target.value})}
                      placeholder="e.g., Employee Handbook, Style Guide, Code of Conduct"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Important documents they should review</p>
                  </div>
                </div>
              </div>

              {/* Company Culture */}
              <div className="bg-green-50 rounded-lg p-4 space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Company Culture
                </h3>
                <div>
                  <Label htmlFor="culture" className="text-sm font-medium">Culture Elements</Label>
                  <Input
                    id="culture"
                    value={newPlanData.culture}
                    onChange={(e) => setNewPlanData({...newPlanData, culture: e.target.value})}
                    placeholder="e.g., Collaboration, Innovation, Customer-first, Remote-friendly"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Values, traditions, and cultural aspects to highlight</p>
                </div>
              </div>

              {/* Custom Requirements */}
              <div className="bg-yellow-50 rounded-lg p-4 space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Custom Requirements
                </h3>
                <div>
                  <Label htmlFor="requirements" className="text-sm font-medium">Special Considerations</Label>
                  <Textarea
                    id="requirements"
                    value={newPlanData.customRequirements}
                    onChange={(e) => setNewPlanData({...newPlanData, customRequirements: e.target.value})}
                    placeholder="Any specific requirements, compliance needs, security protocols, or special considerations for this role..."
                    rows={4}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* AI Generation Preview */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">AI Generation Preview</span>
                </div>
                <p className="text-sm text-blue-700">
                  Our AI will create a {newPlanData.duration}-day onboarding plan for a {newPlanData.type} in the {newPlanData.role} position, 
                  including personalized welcome sequences, tool setup guides, and cultural integration activities.
                </p>
              </div>
            </div>
            
            <div className="flex justify-between items-center gap-3 pt-6 border-t">
              <div className="text-sm text-gray-500">
                * Required fields
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCreatePlan(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleGeneratePlan} 
                  disabled={generatePlanMutation.isPending || !newPlanData.type || !newPlanData.role}
                  className="bg-blue-600 hover:bg-blue-700 min-w-[120px]"
                >
                  {generatePlanMutation.isPending ? (
                    <>
                      <Brain className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Plan
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Welcome Email Generator Dialog */}
        <Dialog open={showWelcomeEmailGenerator} onOpenChange={setShowWelcomeEmailGenerator}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Welcome Email</DialogTitle>
              <DialogDescription>
                Create a personalized welcome email for new team members
              </DialogDescription>
            </DialogHeader>
            <div className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto mb-4 text-blue-600" />
              <p className="text-muted-foreground">Welcome email generator coming soon...</p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Quiz Generator Dialog */}
        <Dialog open={showQuizGenerator} onOpenChange={setShowQuizGenerator}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Interactive Quiz</DialogTitle>
              <DialogDescription>
                Create quizzes to test understanding of company culture and procedures
              </DialogDescription>
            </DialogHeader>
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-blue-600" />
              <p className="text-muted-foreground">Quiz generator coming soon...</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}