import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, ExternalLink, Info, Key, Link2, Mail, Shield } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';

export default function JiraSetupGuide() {
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Text copied to clipboard'
    });
  };

  const steps = [
    {
      title: 'Create Atlassian Account',
      icon: Mail,
      description: 'Sign up for an Atlassian account if you don\'t have one'
    },
    {
      title: 'Generate API Token',
      icon: Key,
      description: 'Create a secure API token for authentication'
    },
    {
      title: 'Configure Integration',
      icon: Link2,
      description: 'Connect Requisor to your JIRA instance'
    },
    {
      title: 'Test Connection',
      icon: CheckCircle2,
      description: 'Verify everything is working correctly'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/ai-agents">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to AI Agents
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">JIRA Integration Setup Guide</h1>
            <p className="text-gray-600 mt-2">Follow these steps to enable direct JIRA push capabilities</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  currentStep > index + 1 ? 'bg-green-600 text-white' : 
                  currentStep === index + 1 ? 'bg-blue-600 text-white' : 
                  'bg-gray-200 text-gray-500'
                }`}>
                  {currentStep > index + 1 ? <CheckCircle2 className="w-5 h-5" /> : (index + 1)}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-full h-1 mx-2 ${
                    currentStep > index + 1 ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <p className="text-sm font-medium">{step.title}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                Step 1: Create or Verify Atlassian Account
              </CardTitle>
              <CardDescription>
                You'll need an Atlassian account to access JIRA and generate API tokens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  If you already have a JIRA account, you can skip to Step 2.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">1. Visit Atlassian Signup</h3>
                  <Button asChild variant="outline">
                    <a href="https://www.atlassian.com/try/cloud/signup" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Create Atlassian Account
                    </a>
                  </Button>
                </div>

                <div>
                  <h3 className="font-medium mb-2">2. Choose JIRA Software</h3>
                  <p className="text-sm text-gray-600">
                    During signup, select "JIRA Software" as your product. You can start with a free trial.
                  </p>
                </div>

                <div>
                  <h3 className="font-medium mb-2">3. Note Your JIRA URL</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    After setup, your JIRA URL will look like:
                  </p>
                  <div className="bg-gray-100 p-3 rounded-lg font-mono text-sm flex items-center justify-between">
                    <span>https://your-domain.atlassian.net</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard('https://your-domain.atlassian.net')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Key className="w-5 h-5 mr-2" />
                Step 2: Generate API Token
              </CardTitle>
              <CardDescription>
                Create a secure API token to authenticate Requisor with JIRA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-yellow-200 bg-yellow-50">
                <Shield className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-900">
                  <strong>Security Note:</strong> API tokens are like passwords. Keep them secure and never share them publicly.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">1. Access API Token Page</h3>
                  <Button asChild variant="outline">
                    <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Go to API Tokens
                    </a>
                  </Button>
                </div>

                <div>
                  <h3 className="font-medium mb-2">2. Create New Token</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Click "Create API token" and give it a descriptive name:
                  </p>
                  <div className="bg-gray-100 p-3 rounded-lg font-mono text-sm flex items-center justify-between">
                    <span>Requisor JIRA Integration</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard('Requisor JIRA Integration')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">3. Copy Your Token</h3>
                  <p className="text-sm text-gray-600">
                    After creation, copy the token immediately. You won't be able to see it again!
                  </p>
                  <Alert className="mt-2">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Store your token securely. You'll need it in the next step.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Link2 className="w-5 h-5 mr-2" />
                Step 3: Configure Integration in Requisor
              </CardTitle>
              <CardDescription>
                Connect your JIRA instance to Requisor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Required Information</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    You'll need these three pieces of information:
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Badge className="mr-2">1</Badge>
                      <span className="font-medium">JIRA URL</span>
                      <span className="text-gray-500 ml-2">(e.g., https://your-domain.atlassian.net)</span>
                    </div>
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Badge className="mr-2">2</Badge>
                      <span className="font-medium">Email Address</span>
                      <span className="text-gray-500 ml-2">(your JIRA account email)</span>
                    </div>
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Badge className="mr-2">3</Badge>
                      <span className="font-medium">API Token</span>
                      <span className="text-gray-500 ml-2">(from Step 2)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Configure Integration</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Go to the JIRA settings page and enter your credentials:
                  </p>
                  <Button asChild>
                    <Link href="/jira-settings">
                      <Shield className="w-4 h-4 mr-2" />
                      Configure JIRA Integration
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
                Step 4: Test Your Connection
              </CardTitle>
              <CardDescription>
                Verify that everything is working correctly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  Once configured, you'll be able to push stories directly to JIRA!
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Test Features</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Try these features to ensure everything works:
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-start p-3 bg-gray-50 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 mr-2 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium">Story Writer</p>
                        <p className="text-sm text-gray-600">Generate a story and push it to JIRA</p>
                      </div>
                    </div>
                    <div className="flex items-start p-3 bg-gray-50 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 mr-2 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium">Backlog Generator</p>
                        <p className="text-sm text-gray-600">Create a backlog and sync to JIRA</p>
                      </div>
                    </div>
                    <div className="flex items-start p-3 bg-gray-50 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 mr-2 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium">Point Estimator</p>
                        <p className="text-sm text-gray-600">Estimate stories and update in JIRA</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="font-medium mb-2">Ready to Use!</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Your JIRA integration is complete. Start using the full JIRA tools:
                  </p>
                  <Button asChild>
                    <Link href="/jira">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Go to JIRA Tools
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <Button
            onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
            disabled={currentStep === 4}
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}