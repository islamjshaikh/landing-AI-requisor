import { CardSkeleton } from '@/components/ui/skeleton';
import { ProjectMetrics as ProjectMetricsType } from '@/types';
import {
  ListTodo,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { MetricCard } from '@/components/ui/data-display/MetricCard';

interface ProjectMetricsProps {
  metrics?: ProjectMetricsType;
  isLoading?: boolean;
}

export function ProjectMetrics({ metrics, isLoading = false }: ProjectMetricsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  // Default values if metrics aren't loaded
  const {
    activeProjects = 8,
    onTrackPercentage = 75,
    totalTasks = 189,
    completedTasks = 124,
    completionPercentage = 66,
    atRiskProjects = 2,
    bottlenecks = 3
  } = metrics || {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Active Projects */}
      <MetricCard
        title="Active Projects"
        icon={<ListTodo className="h-5 w-5" />}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-500"
        value={activeProjects}
        progressLabel="On Track"
        progressValue={onTrackPercentage}
        progressColor="bg-blue-500"
      />

      {/* Tasks Completed */}
      <MetricCard
        title="Tasks Completed"
        icon={<CheckCircle className="h-5 w-5" />}
        iconBgColor="bg-green-100" 
        iconColor="text-green-500"
        value={completedTasks}
        valueLabel={`/ ${totalTasks}`}
        progressLabel="Progress"
        progressValue={completionPercentage}
        progressColor="bg-green-500"
      />

      {/* At Risk */}
      <MetricCard
        title="At Risk"
        icon={<AlertTriangle className="h-5 w-5" />}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-500"
        value={atRiskProjects}
        valueLabel="Projects"
        footer={
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">Bottlenecks</span>
            <span className="text-amber-600 font-medium">{bottlenecks} Tasks</span>
          </div>
        }
        alert={
          <div className="mt-2 bg-amber-50 p-2 rounded-md text-amber-800 text-xs flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1 text-amber-600"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            AI has detected timeline conflicts in {atRiskProjects} projects
          </div>
        }
      />
    </div>
  );
}
