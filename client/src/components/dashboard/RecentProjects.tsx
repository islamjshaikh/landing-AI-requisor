import { Link } from "wouter";
import { Project } from "@shared/schema";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";

interface RecentProjectsProps {
  projects?: Project[];
  isLoading?: boolean;
}

export function RecentProjects({
  projects,
  isLoading = false,
}: RecentProjectsProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Recent Projects
        </h2>
        <Link href="/projects">
          <a className="text-sm text-secondary hover:text-secondary/80 flex items-center">
            View all <ChevronRight className="h-4 w-4 ml-1" />
          </a>
        </Link>
      </div>

      <div className="space-y-4">
        {isLoading && (
          <>
            <CardSkeleton height={120} />
            <CardSkeleton height={120} />
            <CardSkeleton height={120} />
          </>
        )}

        {!isLoading && (!projects || projects.length === 0) && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-slate-500">
              No projects found. Create one using the AI assistant above!
            </p>
          </div>
        )}

        {!isLoading &&
          projects &&
          projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}

        {/* Fallback example projects if needed */}
        {/* {!isLoading && (!projects || projects.length === 0) && (
          <>
            <ProjectCard
              project={{
                id: 0,
                name: "Website Redesign",
                dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                progress: 45,
                totalTasks: 25,
                completedTasks: 12,
                icon: "globe",
                iconBg: "blue",
                aiGenerated: true
              } as Project}
            />
            <ProjectCard
              project={{
                id: 1,
                name: "Mobile App Development",
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                progress: 25,
                totalTasks: 40,
                completedTasks: 10,
                icon: "smartphone",
                iconBg: "green",
                aiGenerated: true
              } as Project}
            />
            <ProjectCard
              project={{
                id: 2,
                name: "Data Analytics Dashboard",
                dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
                progress: 15,
                totalTasks: 35,
                completedTasks: 5,
                icon: "pie-chart",
                iconBg: "purple",
                aiGenerated: false
              } as Project}
            />
          </>
        )} */}
      </div>
    </div>
  );
}
