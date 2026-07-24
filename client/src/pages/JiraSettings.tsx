import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { JiraIntegrationConfig } from '@/components/jira/JiraIntegrationConfig';

export default function JiraSettings() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-red-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/jira-agent">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to JIRA Tools
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">JIRA Integration Settings</h1>
            <p className="text-gray-600 mt-2">Configure your JIRA connection for seamless bidirectional sync</p>
          </div>
        </div>

        {/* Integration Component */}
        <JiraIntegrationConfig />
      </div>
    </div>
  );
}