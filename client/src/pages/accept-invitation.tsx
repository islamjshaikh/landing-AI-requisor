import React, { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { acceptInvitation } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Check, X, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/spinner';

export default function AcceptInvitation() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get('token');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: (token: string) => acceptInvitation(token),
    onSuccess: () => {
      setSuccess(true);
      // Show success message for 3 seconds before redirecting
      setTimeout(() => {
        setLocation('/projects');
      }, 3000);
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to accept invitation. The invitation may have expired or already been accepted.');
    }
  });
  
  // Auto-accept the invitation once authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && token && !success && !error) {
      acceptMutation.mutate(token);
    }
  }, [token, isAuthenticated, authLoading, success, error]);
  
  // If authentication is still loading, show loading state
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }
  
  // If not authenticated, show redirect to login
  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="h-5 w-5 mr-2 text-primary" />
              Project Invitation
            </CardTitle>
            <CardDescription>
              Please log in to accept this invitation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">
              You need to sign in to your Requisor account to accept this invitation.
              Once you're signed in, you'll be automatically added to the project.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => window.location.reload()}>
              Sign in to continue
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="h-5 w-5 mr-2 text-primary" />
            Project Invitation
          </CardTitle>
          <CardDescription>
            {acceptMutation.isPending 
              ? 'Processing your invitation...' 
              : success 
                ? 'Invitation accepted!' 
                : 'Accept invitation to collaborate'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {acceptMutation.isPending && (
            <div className="flex flex-col items-center p-6 space-y-4">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-slate-600">
                Processing your invitation. Please wait...
              </p>
            </div>
          )}
          
          {error && (
            <Alert variant="destructive" className="mb-4">
              <X className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <div className="flex flex-col items-center p-6 space-y-4">
              <div className="bg-green-100 p-3 rounded-full">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-slate-600 text-center">
                You have successfully joined the project! You will be redirected to the projects page in a moment.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          {!success && !acceptMutation.isPending && (
            <>
              <Button variant="outline" onClick={() => setLocation('/')}>
                Cancel
              </Button>
              <Button 
                onClick={() => token && acceptMutation.mutate(token)} 
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Accept Invitation
              </Button>
            </>
          )}
          
          {success && (
            <Button onClick={() => setLocation('/projects')}>
              Go to Projects
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}