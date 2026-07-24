import { apiRequest } from "./queryClient";
import { AIProjectPlan } from "@/types";

// Function to generate a project plan from an idea
export async function generateProjectPlan(idea: string): Promise<AIProjectPlan> {
  const res = await apiRequest("POST", "/api/ai/generate-plan", { idea });
  return res.json();
}

// Function to detect bottlenecks in existing projects
export async function detectBottlenecks(): Promise<any> {
  const res = await apiRequest("POST", "/api/ai/detect-bottlenecks", {});
  return res.json();
}

// Function to generate an action plan for project issues
export async function generateActionPlan(): Promise<any> {
  const res = await apiRequest("POST", "/api/ai/action-plan", {});
  return res.json();
}

// Function to optimize project timeline
export async function optimizeTimeline(projectId: number): Promise<any> {
  const res = await apiRequest("POST", `/api/ai/optimize-timeline/${projectId}`, {});
  return res.json();
}
