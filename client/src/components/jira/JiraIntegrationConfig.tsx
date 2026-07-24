import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Settings, 
  Eye, 
  EyeOff,
  ExternalLink
} from 'lucide-react';

export function JiraIntegrationConfig() {
  const { toast } = useToast();
  const [showToken, setShowToken] = useState(false);
  const [formData, setFormData] = useState({
    jiraUrl: '',
    email: '',
    apiToken: ''
  });

  // Fetch existing integration
  const { data: integration, isLoading } = useQuery({
    queryKey: ['/api/jira/integration'],
    enabled: true
  });

  // Update form when integration data is loaded
  useEffect(() => {
    if (integration) {
      setFormData({
        jiraUrl: integration.jiraUrl || '',
        email: integration.email || '',
        apiToken: integration.apiToken ? '********' : '' // Mask existing token
      });
    }
  }, [integration]);

  // Test connection mutation
  const testConnection = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/jira/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Connection test failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connection successful!",
        description: `Connected to ${data.siteName || 'Jira'}. Found ${data.projectCount || 0} projects.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Failed to connect to Jira",
        variant: "destructive"
      });
    }
  });

  // Save integration mutation
  const saveIntegration = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/jira/integration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save integration');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jira/integration'] });
      toast({
        title: "Integration saved!",
        description: "Your Jira integration has been configured successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save integration",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.jiraUrl || !formData.email || !formData.apiToken) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    // Validate Jira URL format
    if (!formData.jiraUrl.includes('atlassian.net')) {
      toast({
        title: "Invalid Jira URL",
        description: "Please enter a valid Jira Cloud URL (e.g., https://yourcompany.atlassian.net)",
        variant: "destructive"
      });
      return;
    }

    // Test connection first
    const testResult = await testConnection.mutateAsync();
    if (testResult) {
      // If test passes, save the integration
      saveIntegration.mutate();
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch('/api/jira/integration', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }
      
      setFormData({ jiraUrl: '', email: '', apiToken: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/jira/integration'] });
      
      toast({
        title: "Disconnected",
        description: "Your Jira integration has been removed.",
      });
    } catch (error) {
      toast({
        title: "Disconnect failed",
        description: "Failed to disconnect from Jira",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Jira Integration
            </CardTitle>
            <CardDescription>
              Connect your Jira workspace to export agile plans directly
            </CardDescription>
          </div>
          {integration?.isActive && (
            <Badge className="bg-green-100 text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jiraUrl">Jira Site URL</Label>
            <Input
              id="jiraUrl"
              type="url"
              placeholder="https://yourcompany.atlassian.net"
              value={formData.jiraUrl}
              onChange={(e) => setFormData({ ...formData, jiraUrl: e.target.value })}
              required
            />
            <p className="text-xs text-gray-500">Your Atlassian site URL</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your-email@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <p className="text-xs text-gray-500">Email associated with your Jira account</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiToken">API Token</Label>
            <div className="relative">
              <Input
                id="apiToken"
                type={showToken ? "text" : "password"}
                placeholder={integration?.isActive ? "Enter new token to update" : "Your Jira API token"}
                value={formData.apiToken}
                onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                required={!integration?.isActive}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              <a 
                href="https://id.atlassian.com/manage-profile/security/api-tokens" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                Generate API token
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              type="submit" 
              disabled={testConnection.isPending || saveIntegration.isPending}
            >
              {testConnection.isPending || saveIntegration.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {testConnection.isPending ? 'Testing...' : 'Saving...'}
                </>
              ) : (
                integration?.isActive ? 'Update Connection' : 'Connect to Jira'
              )}
            </Button>
            
            {integration?.isActive && (
              <Button 
                type="button"
                variant="outline"
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}