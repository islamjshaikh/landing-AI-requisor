import { queryClient } from "@/lib/queryClient";

/**
 * Updates the lastOpenedAt timestamp for a project when it's accessed
 */
export async function updateProjectLastOpened(projectId: number): Promise<void> {
  try {
    const response = await fetch(`/api/projects/${projectId}/opened`, {
      method: 'PATCH',
      credentials: 'include',
    });

    if (!response.ok) {
      console.warn(`Failed to update lastOpenedAt for project ${projectId}`);
      return;
    }

    // Invalidate projects cache to ensure fresh data
    await queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
  } catch (error) {
    console.warn(`Error updating lastOpenedAt for project ${projectId}:`, error);
  }
}