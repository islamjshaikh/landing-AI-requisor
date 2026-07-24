import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText, Hash, Layers, PenTool, Settings2, Sparkles } from 'lucide-react';

export default function JiraAgent() {
  const tools = [
    {
      title: 'User Story Writer',
      description: 'Transform feature ideas into well-structured user stories with AI-generated acceptance criteria',
      icon: PenTool,
      route: '/jira-story-writer',
      color: 'from-blue-500 to-indigo-600',
      features: ['AI-powered story generation', 'Acceptance criteria', 'INVEST principles', 'Export to JIRA']
    },
    {
      title: 'Story Point Estimator',
      description: 'Get AI-driven story point estimates based on complexity, risk, and effort analysis',
      icon: Hash,
      route: '/jira-story-estimator',
      color: 'from-purple-500 to-pink-600',
      features: ['Complexity analysis', 'Confidence scoring', 'Team velocity', 'Historical data']
    },
    {
      title: 'Backlog Generator',
      description: 'Generate complete product backlogs from high-level features with prioritized user stories',
      icon: Layers,
      route: '/jira-backlog-generator',
      color: 'from-green-500 to-teal-600',
      features: ['Bulk story creation', 'ROI prioritization', 'Epic grouping', 'Sprint planning']
    },
    {
      title: 'JIRA Integration',
      description: 'Configure your JIRA connection for seamless bidirectional sync',
      icon: Settings2,
      route: '/jira-settings',
      color: 'from-orange-500 to-red-600',
      features: ['Secure API connection', 'Two-way sync', 'Field mapping', 'Sync history']
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            <span>AI-Powered Agile Tools</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            JIRA Agile Assistant
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Streamline your agile workflow with AI-powered story writing, estimation, and backlog management
          </p>
        </div>

        {/* Tool Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card key={tool.route} className="hover:shadow-xl transition-all duration-300 overflow-hidden group">
                <div className={`h-2 bg-gradient-to-r ${tool.color}`} />
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg bg-gradient-to-r ${tool.color} text-white`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <Link href={tool.route}>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        Open
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <CardTitle className="text-xl mt-4">{tool.title}</CardTitle>
                  <CardDescription className="text-base">
                    {tool.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Key Features:</p>
                    <ul className="space-y-1">
                      {tool.features.map((feature, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-center">
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Section */}
        <div className="mt-12 text-center">
          <Card className="max-w-2xl mx-auto bg-white/50 backdrop-blur">
            <CardContent className="py-6">
              <h3 className="text-lg font-semibold mb-2">How it works</h3>
              <p className="text-gray-600">
                Each tool works independently to help you create better user stories and manage your backlog. 
                When you're ready, connect your JIRA instance to sync your work seamlessly.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}