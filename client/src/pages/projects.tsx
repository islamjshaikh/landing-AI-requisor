import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ProjectContextHorizontal } from "@/components/ui/project-context-horizontal";
import type { Project } from "@shared/schema";

import { Plus, LogIn } from "lucide-react";
import { Link } from "wouter";

export default function Projects() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  return (
    <div className="min-h-full flex flex-col">
      <div className="flex-shrink-0 p-6 border-b bg-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
            <p className="text-slate-600 mt-1">
              Manage and track your project portfolio
            </p>
          </div>
          <div className="flex gap-3 flex-col sm:flex-row w-full sm:w-auto">
            <Button
              variant="outline"
              asChild
              className="border-emerald-200 hover:bg-emerald-50"
            >
              <Link href="/create-project">
                <Plus className="h-4 w-4 mr-2" />
                Create Manually
              </Link>
            </Button>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
              <Link href="/">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 mr-2"
                >
                  <path d="M12 2a5 5 0 0 0-5 5v14a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5Z"></path>
                  <path d="M8 14.5a6 6 0 0 1 12 0"></path>
                  <path d="M10 10a4 4 0 0 1 8 0"></path>
                </svg>
                Create with AI
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Project Context - Compact Layout */}
      <div className="flex-shrink-0 p-6 bg-slate-50 border-b">
        <ProjectContextHorizontal />
      </div>

      {/* Scrollable Projects Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Loading state for auth check */}
          {authLoading && (
            <div className="col-span-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <p className="text-slate-500">Checking authentication...</p>
            </div>
          )}

          {/* Not authenticated state */}
          {!authLoading && !isAuthenticated && (
            <div className="col-span-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <LogIn className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Login Required
              </h3>
              <p className="text-slate-500 mb-6">
                Please log in to view your projects
              </p>
              <div className="flex gap-3 justify-center">
                <Button asChild>
                  <a href="/api/login">Log In</a>
                </Button>
                <Button asChild variant="outline">
                  <a href="/api/login">Sign Up</a>
                </Button>
              </div>
            </div>
          )}

          {/* Authenticated states */}
          {!authLoading && isAuthenticated && (
            <>
              {isLoading &&
                Array(6)
                  .fill(0)
                  .map((_, index) => <CardSkeleton key={index} />)}

              {!isLoading && projects.length === 0 && (
                <div className="col-span-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                  <p className="text-slate-500">
                    No projects found. Create one to get started!
                  </p>
                </div>
              )}

              {!isLoading &&
                projects.map((project, index) => {
                  const isNewProject = index === 0 && project.aiGenerated;
                  return (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      isNew={isNewProject}
                    />
                  );
                })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
