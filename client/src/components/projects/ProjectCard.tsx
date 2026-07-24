import { Project } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "./ProgressBar";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { updateProjectLastOpened } from "@/lib/projectUtils";

import {
  Globe,
  Smartphone,
  PieChart,
  Bot,
  SplitSquareVertical,
  GitBranch,
  Circle,
  AlertTriangle,
  Layers,
  Sparkles,
  Zap,
  ArrowRight,
} from "lucide-react";

interface ProjectCardProps {
  project: Project;
  isNew?: boolean;
}

export function ProjectCard({ project, isNew = false }: ProjectCardProps) {
  const [_, setLocation] = useLocation();
  const daysLeft = project.dueDate
    ? differenceInDays(new Date(project.dueDate), new Date())
    : 0;

  const getIconComponent = () => {
    switch (project.icon) {
      case "globe":
        return <Globe className="h-5 w-5" />;
      case "smartphone":
        return <Smartphone className="h-5 w-5" />;
      case "pie-chart":
        return <PieChart className="h-5 w-5" />;
      default:
        return <Layers className="h-5 w-5" />;
    }
  };

  const getIconColorClass = () => {
    switch (project.iconBg) {
      case "blue":
        return "bg-blue-100 text-blue-500";
      case "green":
        return "bg-green-100 text-green-500";
      case "purple":
        return "bg-purple-100 text-purple-500";
      case "amber":
        return "bg-amber-100 text-amber-500";
      case "red":
        return "bg-red-100 text-red-500";
      default:
        return "bg-blue-100 text-blue-500";
    }
  };

  const getProgressGradient = () => {
    switch (project.iconBg) {
      case "blue":
        return "bg-gradient-to-r from-blue-500 to-blue-600";
      case "green":
        return "bg-gradient-to-r from-green-400 to-green-500";
      case "purple":
        return "bg-gradient-to-r from-purple-400 to-purple-500";
      default:
        return "bg-gradient-to-r from-primary to-primary";
    }
  };

  return (
    <Card
      className={`bg-white rounded-xl shadow-sm border transition-all cursor-pointer hover:shadow-md ${isNew ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"}`}
      onClick={async () => {
        await updateProjectLastOpened(project.id);
        setLocation(`/projects/${project.id}`);
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div
              className={cn(
                "w-10 h-10 rounded-md flex items-center justify-center",
                getIconColorClass(),
              )}
            >
              {getIconComponent()}
            </div>
            <div className="ml-3">
              <h3 className="font-medium text-slate-800">{project.name}</h3>
              <p className="text-xs text-slate-500">
                {project.dueDate ? `Due in ${daysLeft} days` : "No due date"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm text-slate-700">{project.progress}%</span>
            <p className="text-xs text-slate-500">
              {project.completedTasks}/{project.totalTasks} tasks
            </p>
          </div>
        </div>

        <div className="mt-3">
          <ProgressBar
            value={project.progress || 0}
            className={getProgressGradient()}
          />
        </div>

        <div className="mt-3 flex items-center space-x-2 text-xs">
          {project.aiGenerated && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md flex items-center">
              <Bot className="mr-1 h-3 w-3" />
              <span>AI TL</span>
            </span>
          )}

          {/* These would be conditionally rendered based on project attributes */}
          {project.iconBg === "green" && (
            <>
              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md flex items-center">
                <SplitSquareVertical className="mr-1 h-3 w-3" />
                <span>AI SP</span>
              </span>
              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md flex items-center">
                <GitBranch className="mr-1 h-3 w-3" />
                <span>M</span>
              </span>
              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md flex items-center">
                <Circle className="mr-1 h-3 w-3" />
                <span>C</span>
              </span>
            </>
          )}

          {/* {project.iconBg === 'purple' && (
            <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md flex items-center">
              <AlertTriangle className="mr-1 h-3 w-3" />
              <span>Resource bottleneck</span>
            </span>
          )} */}
        </div>
      </CardContent>
    </Card>
  );
}
