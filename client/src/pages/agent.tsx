import React from "react";
import { ProjectPlannerAgentV2 } from "@/components/project-planner/ProjectPlannerAgentV2";

// Content-only component for use within AppLayout
export function AgentPageContent() {
  return (
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Requisor AI Project Planner
          </h1>
          <p className="text-gray-600 mt-1">
            Transform your ideas into structured project plans with AI
            assistance
          </p>
        </div>

        {/* Project Planner Agent */}
        <ProjectPlannerAgentV2 />
      </div>
    </div>
  );
}

// Legacy component kept for backwards compatibility
function AgentPage() {
  return <AgentPageContent />;
}

export default AgentPage;
