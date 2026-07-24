import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface JiraCredentialsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function JiraCredentialsDialog({
  isOpen,
  onClose,
  onSuccess,
}: JiraCredentialsDialogProps) {
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const { toast } = useToast();

  const updateCredentialsMutation = useMutation({
    mutationFn: async (credentials: { email: string; apiToken: string }) => {
      // First get the current integration
      const response = await fetch('/api/jira/integration', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch integration');
      }
      
      const integration = await response.json();

      if (!integration) {
        throw new Error("No JIRA integration found");
      }

      // Update with new credentials
      return apiRequest("/api/jira/integration", {
        method: "POST",
        body: {
          jiraUrl: integration.jiraUrl,
          email: credentials.email,
          apiToken: credentials.apiToken,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "JIRA credentials updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jira/integration"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jira/projects"] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update credentials",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !apiToken) {
      toast({
        title: "Error",
        description: "Please enter both email and API token",
        variant: "destructive",
      });
      return;
    }
    updateCredentialsMutation.mutate({ email, apiToken });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update JIRA Credentials</DialogTitle>
          <DialogDescription>
            Your JIRA API token has expired. Please enter new credentials to continue.
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            You can generate a new API token at:{" "}
            <a
              href="https://id.atlassian.com/manage-profile/security/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              Atlassian API Tokens
            </a>
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your-email@example.com"
              required
            />
          </div>

          <div>
            <Label htmlFor="apiToken">API Token</Label>
            <div className="relative">
              <Input
                id="apiToken"
                type={showToken ? "text" : "password"}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Enter your JIRA API token"
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateCredentialsMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateCredentialsMutation.isPending}>
              {updateCredentialsMutation.isPending ? "Updating..." : "Update Credentials"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}