import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Calculator, FileText, Mail, Download, DollarSign, Clock, User, Briefcase } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface BudgetEstimation {
  lineItems: EstimatedLineItem[];
  totalAmount: number;
  categorySummary: {
    [category: string]: {
      hours: number;
      amount: number;
    };
  };
}

interface EstimatedLineItem {
  taskId?: number;
  category: string;
  description: string;
  role: string;
  hours: number;
  rate: number;
  totalAmount: number;
}

interface Project {
  id: number;
  name: string;
  description?: string;
}

export default function BudgetAgent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [clientInfo, setClientInfo] = useState({
    name: "",
    email: "",
    company: ""
  });
  const [customRates, setCustomRates] = useState<{[role: string]: number}>({
    developer: 8500,
    designer: 7500,
    manager: 9500,
    qa: 6500,
    copywriter: 5500
  });
  const [estimation, setEstimation] = useState<BudgetEstimation | null>(null);
  const [savedBudgetId, setSavedBudgetId] = useState<number | null>(null);

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated
  });

  // Auto-select first project if only one exists
  React.useEffect(() => {
    if (projects && projects.length === 1 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Generate budget estimation
  const estimateMutation = useMutation({
    mutationFn: async (data: { projectId: number; clientInfo: any; customRates: any }) => {
      return apiRequest("/api/budgets/estimate", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data) => {
      setEstimation(data);
      toast({
        title: "Budget Estimated",
        description: "AI has generated your project budget estimate successfully!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Estimation Failed",
        description: error.message || "Failed to generate budget estimate",
        variant: "destructive"
      });
    }
  });

  // Save budget estimate
  const saveMutation = useMutation({
    mutationFn: async (data: { estimation: BudgetEstimation; projectId: number; clientInfo: any; additionalInfo: any }) => {
      return apiRequest("/api/budgets/save", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data) => {
      setSavedBudgetId(data.budgetId);
      toast({
        title: "Budget Saved",
        description: "Your budget estimate has been saved successfully!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save budget estimate",
        variant: "destructive"
      });
    }
  });

  // Email quote
  const emailMutation = useMutation({
    mutationFn: async (data: { budgetId: number; recipientEmail: string; senderEmail: string }) => {
      return apiRequest(`/api/budgets/${data.budgetId}/email`, {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: data.recipientEmail,
          senderEmail: data.senderEmail
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "Quote Sent",
        description: "Professional quote has been emailed successfully!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Email Failed",
        description: error.message || "Failed to send quote email",
        variant: "destructive"
      });
    }
  });

  const handleEstimate = () => {
    if (!selectedProjectId) {
      toast({
        title: "Project Required",
        description: "Please select a project to estimate",
        variant: "destructive"
      });
      return;
    }

    estimateMutation.mutate({
      projectId: selectedProjectId,
      clientInfo,
      customRates
    });
  };

  const handleSave = () => {
    if (!estimation || !selectedProjectId) return;

    saveMutation.mutate({
      estimation,
      projectId: selectedProjectId,
      clientInfo,
      additionalInfo: {
        description: "AI-generated budget estimate",
        terms: "Payment terms: 50% upfront, 50% on completion. All prices in USD."
      }
    });
  };

  const handleGenerateQuote = () => {
    if (!savedBudgetId) return;
    window.open(`/api/budgets/${savedBudgetId}/quote`, "_blank");
  };

  const handleEmailQuote = () => {
    if (!savedBudgetId || !clientInfo.email) {
      toast({
        title: "Missing Information",
        description: "Please provide client email and save the budget first",
        variant: "destructive"
      });
      return;
    }

    emailMutation.mutate({
      budgetId: savedBudgetId,
      recipientEmail: clientInfo.email,
      senderEmail: "quotes@requisor.ai" // Default sender
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: {[key: string]: string} = {
      developer: "bg-blue-100 text-blue-800",
      designer: "bg-purple-100 text-purple-800",
      manager: "bg-green-100 text-green-800",
      qa: "bg-orange-100 text-orange-800",
      copywriter: "bg-pink-100 text-pink-800"
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Calculator className="mx-auto h-12 w-12 text-blue-600 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Budget & Quote Agent</h2>
          <p className="text-gray-600 mb-6">
            Please log in to access budget estimation and quote generation features
          </p>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="w-full"
            size="lg"
          >
            Log In with Replit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center mb-2">
            <Calculator className="mr-3 h-8 w-8 text-blue-600" />
            AI Budget & Quote Agent
          </h1>
          <p className="text-gray-600">
            Generate accurate project estimates and professional quotes using AI-powered analysis
          </p>
        </div>

        <Tabs defaultValue="estimate" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="estimate" className="flex items-center">
              <Calculator className="mr-2 h-4 w-4" />
              Budget Estimation
            </TabsTrigger>
            <TabsTrigger value="quote" className="flex items-center">
              <FileText className="mr-2 h-4 w-4" />
              Quote Generation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="estimate" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Project Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Briefcase className="mr-2 h-5 w-5" />
                    Project Selection
                  </CardTitle>
                  <CardDescription>
                    Choose the project you want to estimate
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="project">Project</Label>
                    <Select 
                      value={selectedProjectId?.toString() || ""} 
                      onValueChange={(value) => setSelectedProjectId(parseInt(value))}
                      disabled={projectsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={
                          projectsLoading ? "Loading projects..." : 
                          projects.length === 0 ? "No projects available" :
                          "Select a project"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {(projects as Project[]).map((project: Project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Client Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="mr-2 h-5 w-5" />
                    Client Information
                  </CardTitle>
                  <CardDescription>
                    Optional client details for the quote
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input
                      id="clientName"
                      value={clientInfo.name}
                      onChange={(e) => setClientInfo({...clientInfo, name: e.target.value})}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientEmail">Email</Label>
                    <Input
                      id="clientEmail"
                      type="email"
                      value={clientInfo.email}
                      onChange={(e) => setClientInfo({...clientInfo, email: e.target.value})}
                      placeholder="john@company.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientCompany">Company</Label>
                    <Input
                      id="clientCompany"
                      value={clientInfo.company}
                      onChange={(e) => setClientInfo({...clientInfo, company: e.target.value})}
                      placeholder="ACME Corp"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Custom Rates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="mr-2 h-5 w-5" />
                    Hourly Rates
                  </CardTitle>
                  <CardDescription>
                    Customize rates per role (based on Tabal Chocolate data)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(customRates).map(([role, rate]) => (
                    <div key={role}>
                      <Label htmlFor={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</Label>
                      <Input
                        id={role}
                        type="number"
                        value={rate / 100}
                        onChange={(e) => setCustomRates({
                          ...customRates,
                          [role]: parseInt(e.target.value) * 100
                        })}
                        placeholder="85"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Generate Button */}
            <div className="flex justify-center">
              <Button 
                onClick={handleEstimate}
                disabled={!selectedProjectId || estimateMutation.isPending}
                size="lg"
                className="px-8"
              >
                {estimateMutation.isPending ? "Analyzing..." : "Generate AI Estimate"}
              </Button>
            </div>

            {/* Estimation Results */}
            {estimation && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Budget Breakdown</CardTitle>
                    <CardDescription>
                      AI-analyzed task estimates with role assignments
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-200">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-200 px-4 py-2 text-left">Task</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Category</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Role</th>
                            <th className="border border-gray-200 px-4 py-2 text-right">Hours</th>
                            <th className="border border-gray-200 px-4 py-2 text-right">Rate</th>
                            <th className="border border-gray-200 px-4 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {estimation.lineItems.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-200 px-4 py-2">{item.description}</td>
                              <td className="border border-gray-200 px-4 py-2">{item.category}</td>
                              <td className="border border-gray-200 px-4 py-2">
                                <Badge className={getRoleBadgeColor(item.role)}>
                                  {item.role}
                                </Badge>
                              </td>
                              <td className="border border-gray-200 px-4 py-2 text-right">{item.hours}h</td>
                              <td className="border border-gray-200 px-4 py-2 text-right">{formatCurrency(item.rate)}/hr</td>
                              <td className="border border-gray-200 px-4 py-2 text-right font-semibold">
                                {formatCurrency(item.totalAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Category Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(estimation.categorySummary).map(([category, summary]) => (
                    <Card key={category}>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <h3 className="font-semibold text-lg">{category}</h3>
                          <div className="flex items-center justify-center mt-2 text-sm text-gray-600">
                            <Clock className="mr-1 h-4 w-4" />
                            {summary.hours} hours
                          </div>
                          <div className="text-xl font-bold text-blue-600 mt-1">
                            {formatCurrency(summary.amount)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Total */}
                <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                  <CardContent className="p-6 text-center">
                    <h2 className="text-2xl font-bold mb-2">Total Project Cost</h2>
                    <div className="text-4xl font-bold">{formatCurrency(estimation.totalAmount)}</div>
                    <p className="mt-2 opacity-90">Complete project delivery estimate</p>
                  </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-center">
                  <Button 
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    size="lg"
                    className="px-8"
                  >
                    {saveMutation.isPending ? "Saving..." : "Save Budget Estimate"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="quote" className="space-y-6">
            {savedBudgetId ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileText className="mr-2 h-5 w-5" />
                      Professional Quote Generation
                    </CardTitle>
                    <CardDescription>
                      Generate and send professional PDF quotes to clients
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button 
                        onClick={handleGenerateQuote}
                        className="flex items-center justify-center"
                        variant="outline"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Preview Quote
                      </Button>
                      <Button 
                        onClick={handleEmailQuote}
                        disabled={!clientInfo.email || emailMutation.isPending}
                        className="flex items-center justify-center"
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        {emailMutation.isPending ? "Sending..." : "Email Quote"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="rounded-full bg-green-100 p-2 mr-4">
                        <FileText className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-green-800">Budget Saved Successfully</h3>
                        <p className="text-green-600">
                          Your budget estimate has been saved. You can now generate and send professional quotes.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No Budget Saved</h3>
                  <p className="text-gray-500 mb-4">
                    Generate and save a budget estimate first to create professional quotes
                  </p>
                  <Button onClick={() => setSelectedProjectId(null)} variant="outline">
                    Go to Budget Estimation
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}