import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import IntegrationProvider from "@/types/integration";
import { queryClient } from "@/lib/queryClient";

export default function ImportData() {
  const { toast } = useToast();
  const [importing, setImporting] = useState<IntegrationProvider | null>(null);

  // Mutation to import data from a provider
  const importData = useMutation({
    mutationFn: async (provider: IntegrationProvider) => {
      const res = await apiRequest("POST", `/api/import/${provider}`, {});
      return res.json();
    },
    onSuccess: (_data, provider) => {
      toast({
        title: "Data imported successfully",
        description: `Data from ${provider} has been imported.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      setImporting(null);
    },
    onError: (error, provider) => {
      toast({
        title: `Failed to import data from ${provider}`,
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      setImporting(null);
    },
  });

  const handleImport = (provider: IntegrationProvider) => {
    setImporting(provider);
    importData.mutate(provider);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Import Data</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ImportCard
          title="Smartsheet"
          description="Import projects, tasks, and resources from Smartsheet"
          provider={IntegrationProvider.Smartsheet}
          isConnected={true}
          isLoading={importing === IntegrationProvider.Smartsheet}
          onImport={handleImport}
        />
        
        <ImportCard
          title="Jira"
          description="Import issues, epics, and sprints from Jira"
          provider={IntegrationProvider.Jira}
          isConnected={false}
          isLoading={importing === IntegrationProvider.Jira}
          onImport={handleImport}
        />
        
        <ImportCard
          title="Asana"
          description="Import tasks, projects, and sections from Asana"
          provider={IntegrationProvider.Asana}
          isConnected={false}
          isLoading={importing === IntegrationProvider.Asana}
          onImport={handleImport}
        />
        
        <ImportCard
          title="Google Docs"
          description="Import documents and content from Google Docs"
          provider={IntegrationProvider.GoogleDocs}
          isConnected={false}
          isLoading={importing === IntegrationProvider.GoogleDocs}
          onImport={handleImport}
        />
        
        <ImportCard
          title="Monday.com"
          description="Import boards, items, and updates from Monday.com"
          provider={IntegrationProvider.Monday}
          isConnected={false}
          isLoading={importing === IntegrationProvider.Monday}
          onImport={handleImport}
        />
      </div>
    </div>
  );
}

interface ImportCardProps {
  title: string;
  description: string;
  provider: IntegrationProvider;
  isConnected: boolean;
  isLoading: boolean;
  onImport: (provider: IntegrationProvider) => void;
}

function ImportCard({
  title,
  description,
  provider,
  isConnected,
  isLoading,
  onImport,
}: ImportCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center">
          <div>
            {isConnected ? (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                Connected
              </span>
            ) : (
              <span className="text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded-full">
                Not Connected
              </span>
            )}
          </div>
          <Button
            variant={isConnected ? "default" : "outline"}
            size="sm"
            onClick={() => onImport(provider)}
            disabled={isLoading || !isConnected}
          >
            {isLoading ? "Importing..." : isConnected ? "Import Data" : "Connect"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
