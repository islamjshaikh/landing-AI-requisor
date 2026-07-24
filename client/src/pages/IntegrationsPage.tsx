import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  ExternalLink,
  LogIn,
  RefreshCw,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Integration } from "@shared/schema";
import { IntegrationProvider } from "@shared/integrations";

// Component for displaying provider information
const ProviderInfo = ({
  provider,
  isConnected,
}: {
  provider: IntegrationProvider;
  isConnected: boolean;
}) => {
  const getProviderInfo = (provider: IntegrationProvider) => {
    switch (provider) {
      case IntegrationProvider.SMARTSHEET:
        return {
          name: "Smartsheet",
          description: "Sync your sheets, tasks, and timelines with Smartsheet",
          color: "bg-blue-100 text-blue-800",
        };
      case IntegrationProvider.ASANA:
        return {
          name: "Asana",
          description: "Connect your Asana workspaces and projects",
          color: "bg-orange-100 text-orange-800",
        };
      case IntegrationProvider.MONDAY:
        return {
          name: "Monday.com",
          description: "Integrate with Monday.com boards and items",
          color: "bg-indigo-100 text-indigo-800",
        };
      case IntegrationProvider.JIRA:
        return {
          name: "Jira",
          description: "Sync with Atlassian Jira projects and issues",
          color: "bg-blue-100 text-blue-800",
        };
      default:
        return {
          name: provider,
          description: "Connect with external platform",
          color: "bg-gray-100 text-gray-800",
        };
    }
  };

  const info = getProviderInfo(provider);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">{info.name}</h3>
        <Badge
          variant="outline"
          className={
            isConnected
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }
        >
          {isConnected ? "Connected" : "Not Connected"}
        </Badge>
      </div>
      <p className="text-sm text-gray-500">{info.description}</p>
    </div>
  );
};

// Component for a single integration card
const IntegrationCard = ({ integration }: { integration: Integration }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPulling, setIsPulling] = useState(false);

  // Mutation for deleting an integration
  const deleteIntegrationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/integrations/${integration.id}`, {
        method: "DELETE",
      } as any);
    },
    onSuccess: () => {
      toast({
        title: "Integration deleted",
        description: "The integration has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete integration. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting integration:", error);
    },
  });

  // Mutation for pulling projects
  const pullProjectsMutation = useMutation({
    mutationFn: async () => {
      setIsPulling(true);
      return apiRequest(`/api/integrations/${integration.id}/pull-projects`, {
        method: "POST",
      } as any);
    },
    onSuccess: (data) => {
      toast({
        title: "Projects imported",
        description: `Successfully imported ${data.projects?.length || 0} projects.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsPulling(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to import projects. Please try again.",
        variant: "destructive",
      });
      console.error("Error importing projects:", error);
      setIsPulling(false);
    },
  });

  const handlePullProjects = () => {
    pullProjectsMutation.mutate();
  };

  const handleDeleteIntegration = () => {
    deleteIntegrationMutation.mutate();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <ProviderInfo
          provider={integration.provider as IntegrationProvider}
          isConnected={integration.isConnected}
        />
      </CardHeader>
      <CardContent>
        <div className="text-sm space-y-2">
          {integration.lastSynced && (
            <div className="flex items-center gap-2 text-gray-500">
              <Clock size={16} />
              <span>
                Last synced: {new Date(integration.lastSynced).toLocaleString()}
              </span>
            </div>
          )}
          {integration.workspaceId && (
            <div className="flex items-center gap-2 text-gray-500">
              <span>Workspace ID: {integration.workspaceId}</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between gap-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePullProjects}
            disabled={!integration.isConnected || isPulling}
          >
            {isPulling ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Import Projects
              </>
            )}
          </Button>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-red-500">
              <Trash2 className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will disconnect your integration with{" "}
                {integration.provider}. You can reconnect it later if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteIntegration}>
                Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
};

// Component for connecting a new integration
const ConnectIntegrationCard = ({
  provider,
}: {
  provider: IntegrationProvider;
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Get the authentication URL for the provider
  const getAuthUrl = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest(`/api/integrations/auth/${provider}`, {
        method: "GET",
      } as any);
      window.location.href = response.authUrl;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate authentication URL. Please try again.",
        variant: "destructive",
      });
      console.error("Error getting auth URL:", error);
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <ProviderInfo provider={provider} isConnected={false} />
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500">
          Connect your account to sync projects and tasks between Requisor and{" "}
          {provider}.
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={getAuthUrl} disabled={isLoading}>
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-4 w-4" />
              Connect
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

// Main Integrations Page
const IntegrationsPage = () => {
  const { toast } = useToast();

  // Query to get all integrations
  const {
    data: integrations,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/integrations"],
    queryFn: async () => {
      return apiRequest("/api/integrations") as any;
    },
  });

  if (error) {
    toast({
      title: "Error",
      description: "Failed to load integrations. Please refresh the page.",
      variant: "destructive",
    });
  }

  // Get list of providers that are not yet connected
  const getUnconnectedProviders = () => {
    const connectedProviders = (integrations || []).map(
      (integration: Integration) => integration.provider,
    );

    return Object.values(IntegrationProvider).filter(
      (provider) => !connectedProviders.includes(provider),
    );
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-gray-500">
            Connect Requisor with your favorite project management tools
          </p>
        </div>
        <Link href="/projects">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p>Loading integrations...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Connected Integrations */}
          {integrations && integrations.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Connected Platforms
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {integrations.map((integration: Integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Available Integrations */}
          {getUnconnectedProviders().length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 p-6">
                Available Platforms
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {getUnconnectedProviders().map((provider) => (
                  <ConnectIntegrationCard key={provider} provider={provider} />
                ))}
              </div>
            </div>
          )}

          {/* Informational Section */}
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mt-8">
            <h3 className="text-lg font-semibold mb-2">About Integrations</h3>
            <p className="text-sm text-gray-600 mb-4">
              Integrations allow you to sync your projects and tasks between
              Requisor and external project management platforms. You can:
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>Import projects and tasks from external platforms</li>
              <li>Push Requisor tasks to connected platforms</li>
              <li>Keep your project data in sync across multiple tools</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationsPage;
