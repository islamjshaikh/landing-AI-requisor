import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle,
  AlertCircle,
  ExternalLink,
  TestTube,
  Settings,
  Globe,
  FileText,
  Users,
  Bug,
  Loader2,
} from "lucide-react";

interface Integration {
  name: string;
  description: string;
  icon: any;
  status: "connected" | "not_configured" | "error" | "oauth_available";
  testEndpoint?: string;
  connectEndpoint?: string;
  setupInstructions: string[];
  envVars?: string[];
  testResult?: any;
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  const integrations: Integration[] = [
    // {
    //   name: "Smartsheet",
    //   description: "Import and sync project data with Smartsheet for advanced spreadsheet-based project management",
    //   icon: Globe,
    //   status: 'connected',
    //   testEndpoint: '/api/smartsheet/sheets',
    //   envVars: ['SMARTSHEET_ACCESS_TOKEN'],
    //   setupInstructions: [
    //     "Go to Smartsheet Account Center",
    //     "Navigate to Apps & Integrations > API Access",
    //     "Generate a new access token",
    //     "Copy the token to SMARTSHEET_ACCESS_TOKEN in .env",
    //     "Restart the application to apply changes"
    //   ]
    // },
    // {
    //   name: "Asana",
    //   description: "Connect with Asana workspaces and projects for team collaboration and task management",
    //   icon: Users,
    //   status: 'connected',
    //   testEndpoint: '/api/asana/workspaces',
    //   envVars: ['ASANA_ACCESS_TOKEN'],
    //   setupInstructions: [
    //     "Go to Asana Developer Console (app.asana.com/0/developer-console)",
    //     "Click 'Create new token'",
    //     "Give it a name like 'Project Management Platform'",
    //     "Copy the token to ASANA_ACCESS_TOKEN in .env",
    //     "Restart the application to apply changes"
    //   ]
    // },
    {
      name: "JIRA",
      description:
        "Integrate with Atlassian JIRA for advanced issue tracking and agile project management",
      icon: Bug,
      status: "oauth_available",
      testEndpoint: "/api/jira/integration",
      connectEndpoint: "/api/integrations/auth/jira",
      setupInstructions: [
        "Multi-tenant OAuth integration available",
        "Each user can connect their own JIRA workspace",
        "Click 'Connect' to authorize access to your JIRA instance",
        "No manual API keys required - secure OAuth flow",
        "Supports multiple JIRA workspaces per application",
        "Automatic token refresh for uninterrupted access",
      ],
    },
    // {
    //   name: "Google Docs",
    //   description: "Create and sync project documentation with Google Docs for collaborative editing",
    //   icon: FileText,
    //   status: 'not_configured',
    //   testEndpoint: '/api/googledocs/documents',
    //   envVars: ['GOOGLE_ACCESS_TOKEN'],
    //   setupInstructions: [
    //     "Go to Google Cloud Console (console.cloud.google.com)",
    //     "Enable Google Docs API and Google Drive API",
    //     "Create OAuth 2.0 credentials or Service Account",
    //     "Generate access token with documents and drive scopes",
    //     "Set GOOGLE_ACCESS_TOKEN in .env",
    //     "Restart the application to apply changes"
    //   ]
    // }
  ];

  // Test integration connectivity
  const testIntegration = useMutation({
    mutationFn: async (integration: Integration) => {
      if (!integration.testEndpoint) {
        throw new Error("No test endpoint configured");
      }
      return await apiRequest(integration.testEndpoint);
    },
    onSuccess: (data, integration) => {
      setTestResults((prev) => ({
        ...prev,
        [integration.name]: {
          success: true,
          data: Array.isArray(data) ? data.slice(0, 3) : data,
          message: `Successfully connected to ${integration.name}`,
        },
      }));
      toast({
        title: `${integration.name} connection successful`,
        description: `Found ${Array.isArray(data) ? data.length : "available"} items`,
      });
      setTesting(null);
    },
    onError: (error: any, integration) => {
      setTestResults((prev) => ({
        ...prev,
        [integration.name]: {
          success: false,
          error: error.message,
          message: `Failed to connect to ${integration.name}`,
        },
      }));
      toast({
        title: `${integration.name} connection failed`,
        description: error.message || "Please check your credentials",
        variant: "destructive",
      });
      setTesting(null);
    },
  });

  const handleOAuthConnect = async (integration: Integration) => {
    setTesting(integration.name);

    try {
      if (!integration.connectEndpoint) {
        throw new Error("No connect endpoint configured");
      }

      const response = await fetch(integration.connectEndpoint, {
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to get authorization URL" }));
        throw new Error(errorData.message || "Failed to get authorization URL");
      }

      const data = await response.json();
      if (data.authUrl) {
        // Open OAuth flow in new window
        const authWindow = window.open(
          data.authUrl,
          "oauth",
          "width=600,height=700,scrollbars=yes,resizable=yes",
        );

        // Monitor for window close or success
        const checkClosed = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkClosed);
            // Refresh integration status
            handleTest(integration);
          }
        }, 1000);
      } else {
        throw new Error("No authorization URL received");
      }
    } catch (error) {
      console.error("OAuth connection error:", error);
      setTestResults((prev) => ({
        ...prev,
        [integration.name]: {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to start OAuth flow",
        },
      }));
    } finally {
      setTesting(null);
    }
  };

  const handleTest = (integration: Integration) => {
    setTesting(integration.name);
    testIntegration.mutate(integration);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return (
          <Badge
            variant="secondary"
            className="bg-green-50 text-green-700 border-green-200"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      case "oauth_available":
        return (
          <Badge
            variant="secondary"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            OAuth Ready
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-slate-600">
            <AlertCircle className="w-3 h-3 mr-1" />
            Not Configured
          </Badge>
        );
    }
  };

  const getDocumentationLinks = (name: string) => {
    const links: Record<string, string> = {
      Smartsheet: "https://smartsheet.redoc.ly/",
      Asana: "https://developers.asana.com/docs",
      JIRA: "https://developer.atlassian.com/cloud/jira/platform/rest/v3/",
      "Google Docs": "https://developers.google.com/docs/api",
    };
    return links[name] || "#";
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Integrations</h1>
        <p className="text-slate-600 mt-2">
          Connect with external tools to enhance your project management
          workflow
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="setup">Setup Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {integrations.map((integration) => {
              const Icon = integration.icon;
              const testResult = testResults[integration.name];

              return (
                <Card key={integration.name} className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Icon className="w-8 h-8 text-blue-600" />
                        <div>
                          <CardTitle className="text-lg">
                            {integration.name}
                          </CardTitle>
                          {getStatusBadge(integration.status)}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(
                            getDocumentationLinks(integration.name),
                            "_blank",
                          )
                        }
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                    <CardDescription className="mt-2">
                      {integration.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm text-slate-700 mb-2">
                        Required Environment Variables:
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {integration.envVars?.length ? (
                          integration.envVars.map((envVar) => (
                            <Badge
                              key={envVar}
                              variant="outline"
                              className="text-xs"
                            >
                              {envVar}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            OAuth - No manual configuration required
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="flex space-x-2">
                      {integration.status === "oauth_available" ? (
                        <Button
                          onClick={() => handleOAuthConnect(integration)}
                          disabled={testing === integration.name}
                          size="sm"
                          className="flex-1"
                        >
                          {testing === integration.name ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Connect
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleTest(integration)}
                          disabled={testing === integration.name}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          {testing === integration.name ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <TestTube className="w-4 h-4 mr-2" />
                              Test Connection
                            </>
                          )}
                        </Button>
                      )}
                    </div>

                    {testResult && (
                      <div
                        className={`p-3 rounded-lg border ${
                          testResult.success
                            ? "bg-green-50 border-green-200"
                            : "bg-red-50 border-red-200"
                        }`}
                      >
                        <p
                          className={`text-sm font-medium ${
                            testResult.success
                              ? "text-green-800"
                              : "text-red-800"
                          }`}
                        >
                          {testResult.message}
                        </p>
                        {testResult.success && testResult.data && (
                          <div className="mt-2 text-xs text-green-600">
                            {Array.isArray(testResult.data)
                              ? `Found ${testResult.data.length} items`
                              : "Connection verified"}
                          </div>
                        )}
                        {!testResult.success && testResult.error && (
                          <div className="mt-2 text-xs text-red-600">
                            {testResult.error}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="setup" className="space-y-6">
          <div className="space-y-8">
            {integrations.map((integration) => {
              const Icon = integration.icon;

              return (
                <Card key={integration.name}>
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <Icon className="w-6 h-6 text-blue-600" />
                      <CardTitle>{integration.name} Setup</CardTitle>
                    </div>
                    <CardDescription>
                      Follow these steps to configure {integration.name}{" "}
                      integration
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium text-slate-800 mb-3">
                        Setup Instructions:
                      </h4>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                        {integration.setupInstructions.map(
                          (instruction, index) => (
                            <li key={index}>{instruction}</li>
                          ),
                        )}
                      </ol>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium text-slate-800 mb-3">
                        Environment Variables:
                      </h4>
                      <div className="space-y-2">
                        {integration.envVars?.length ? (
                          integration.envVars.map((envVar) => (
                            <div
                              key={envVar}
                              className="flex items-center space-x-2"
                            >
                              <Badge
                                variant="outline"
                                className="font-mono text-xs min-w-0"
                              >
                                {envVar}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                Add this to your .env file
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant="secondary"
                              className="font-mono text-xs"
                            >
                              OAuth Integration
                            </Badge>
                            <span className="text-xs text-slate-500">
                              No manual configuration required
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> After updating the .env file,
                        restart the application for changes to take effect.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
