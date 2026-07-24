import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnhancedAgileCanvas } from "@/components/agile-planning/EnhancedAgileCanvas";
import { EnhancedPlannerChat } from "@/components/agile-planning/EnhancedPlannerChat";
import { Sparkles, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProjectCanvas {
  initiative: {
    id: string;
    name: string;
    description: string;
    epics: Array<{
      id: string;
      name: string;
      description: string;
      stories: Array<{
        id: string;
        title: string;
        description: string;
        acceptanceCriteria: string[];
        priority: "high" | "medium" | "low";
        storyPoints?: number;
        status?: string;
        dueDate?: string;
      }>;
    }>;
  };
}

export function EnhancedAgilePlanningPage() {
  const [currentCanvas, setCurrentCanvas] = useState<ProjectCanvas | null>(
    null,
  );
  const [lastUpdate, setLastUpdate] = useState<any>(null);
  const { toast } = useToast();

  const handleCanvasUpdate = (newCanvas: ProjectCanvas) => {
    setCurrentCanvas(newCanvas);
    console.log("Canvas updated:", newCanvas);
  };

  const handleActionPerformed = (action: any) => {
    setLastUpdate(action);
    console.log("Action performed:", action);
  };

  const handleUpdateNotification = (message: string) => {
    toast({
      title: "Canvas Updated",
      description: message,
      duration: 3000,
    });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Enhanced Agile Planning Agent
              </h1>
              <p className="text-gray-600">
                Context-aware AI assistant for intelligent agile planning
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto p-6 w-full overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* Chat Panel */}
          <div className="flex flex-col">
            <EnhancedPlannerChat
              canvas={currentCanvas}
              onCanvasUpdate={handleCanvasUpdate}
              onActionPerformed={handleActionPerformed}
            />
          </div>

          {/* Canvas Panel */}
          <div className="flex flex-col">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-violet-500" />
                  Live Project Canvas
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Interactive canvas with real-time updates
                </p>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <div className="h-full overflow-y-auto">
                  <EnhancedAgileCanvas
                    canvas={currentCanvas}
                    onCanvasUpdate={handleCanvasUpdate}
                    onUpdateNotification={handleUpdateNotification}
                    lastUpdate={lastUpdate}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
