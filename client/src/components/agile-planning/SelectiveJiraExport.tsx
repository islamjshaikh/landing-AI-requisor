import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2 } from 'lucide-react';

interface Story {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  storyPoints?: number;
}

interface Epic {
  id: string;
  name: string;
  description?: string;
  stories: Story[];
}

interface SelectiveJiraExportProps {
  plan: {
    initiative: {
      name: string;
      epics: Epic[];
    };
  };
  credentialId: number; // The Jira integration ID
}

export function SelectiveJiraExport({ plan, credentialId }: SelectiveJiraExportProps) {
  const { toast } = useToast();
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Get all stories from all epics
  const allStories = plan.initiative.epics.flatMap(epic => 
    epic.stories.map(story => ({ ...story, epicName: epic.name }))
  );

  const handleStoryToggle = (storyId: string, checked: boolean) => {
    if (checked) {
      setSelectedStoryIds(prev => [...prev, storyId]);
    } else {
      setSelectedStoryIds(prev => prev.filter(id => id !== storyId));
    }
  };

  const handleSelectAll = () => {
    if (selectedStoryIds.length === allStories.length) {
      setSelectedStoryIds([]);
    } else {
      setSelectedStoryIds(allStories.map(story => story.id));
    }
  };

  const handleExport = async () => {
    if (selectedStoryIds.length === 0) {
      toast({
        title: "No stories selected",
        description: "Please select at least one story to export",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);

    try {
      // Call the new API route
      const response = await fetch(`/api/jira/export/${credentialId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          plan, // the full initiative/epic/story data
          selectedStoryIds // array of story IDs you want to export
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }

      const result = await response.json();

      toast({
        title: "Export successful!",
        description: `Created ${result.epicsCreated} epics and ${result.storiesCreated} stories in Jira`,
      });

      // Reset selections after successful export
      setSelectedStoryIds([]);

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export to Jira",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Select Stories to Export</span>
          <Badge variant="outline">
            {selectedStoryIds.length} of {allStories.length} selected
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={handleSelectAll}
            size="sm"
          >
            {selectedStoryIds.length === allStories.length ? 'Deselect All' : 'Select All'}
          </Button>
          
          <Button 
            onClick={handleExport}
            disabled={selectedStoryIds.length === 0 || isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Export Selected to Jira
              </>
            )}
          </Button>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {plan.initiative.epics.map(epic => (
            <div key={epic.id} className="border rounded-lg p-4">
              <h4 className="font-semibold text-lg mb-2">{epic.name}</h4>
              <div className="space-y-2">
                {epic.stories.map(story => (
                  <div key={story.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded">
                    <Checkbox
                      checked={selectedStoryIds.includes(story.id)}
                      onCheckedChange={(checked) => handleStoryToggle(story.id, !!checked)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{story.title}</span>
                        {story.priority && (
                          <Badge 
                            variant={story.priority === 'high' ? 'destructive' : 
                                   story.priority === 'medium' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {story.priority}
                          </Badge>
                        )}
                        {story.storyPoints && (
                          <Badge variant="outline" className="text-xs">
                            {story.storyPoints} pts
                          </Badge>
                        )}
                      </div>
                      {story.description && (
                        <p className="text-sm text-gray-600 mt-1">{story.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {selectedStoryIds.length > 0 && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>{selectedStoryIds.length} stories selected for export</strong>
              <br />
              These will be created as tasks in your Jira project, with epics created as needed.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}