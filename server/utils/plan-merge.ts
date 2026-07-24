/**
 * Server-side utilities for merging project plans
 * Provides robust plan merging with ID preservation and change tracking
 */

export interface ProjectDiff {
  milestones?: {
    added?: string[];
    updated?: string[];
    removed?: string[];
  };
  tasks?: {
    added?: string[];
    updated?: string[];
    removed?: string[];
  };
}

export interface MergeResult {
  mergedPlan: any;
  preservedIds: boolean;
  warning?: string;
  changes: {
    added: string[];
    updated: string[];
    removed: string[];
  };
}

/**
 * Merge two project plans on the server side
 * @param existingPlan - The current project plan
 * @param updatedPlan - The new/updated plan from AI
 * @param strategy - 'preserve_ids' to maintain existing IDs, 'replace' to use new IDs
 * @param diffMetadata - Optional structured diff describing what changed
 */
export function mergePlans(
  existingPlan: any,
  updatedPlan: any,
  strategy: 'preserve_ids' | 'replace' = 'preserve_ids',
  diffMetadata?: ProjectDiff
): MergeResult {
  const changes = {
    added: [] as string[],
    updated: [] as string[],
    removed: [] as string[],
  };

  if (!existingPlan) {
    return {
      mergedPlan: ensureIds(updatedPlan),
      preservedIds: false,
      changes,
    };
  }

  if (!updatedPlan) {
    return {
      mergedPlan: existingPlan,
      preservedIds: true,
      changes,
    };
  }

  if (strategy === 'replace') {
    return {
      mergedPlan: ensureIds(updatedPlan),
      preservedIds: false,
      changes,
    };
  }

  const checkExistingMilestones = existingPlan.milestones || [];
  const checkUpdatedMilestones = updatedPlan.milestones || [];
  
  // Log diff metadata if provided
  if (diffMetadata) {
    console.log('📋 Server: Diff metadata received:', JSON.stringify(diffMetadata, null, 2));
    
    if (diffMetadata.milestones?.removed && diffMetadata.milestones.removed.length > 0) {
      console.log(`🔄 Server: COMBINE/MERGE detected: ${diffMetadata.milestones.removed.length} milestone(s) marked for removal`);
      console.log(`   Removed milestones: ${diffMetadata.milestones.removed.join(', ')}`);
    }
  }

  // IMPORTANT: If diffMetadata indicates milestones were removed (combine operation),
  // adjust the threshold calculation to account for intentional removals
  const removedMilestoneNames = new Set(
    (diffMetadata?.milestones?.removed || []).map((name: string) => name.toLowerCase())
  );
  
  // Filter out intentionally removed milestones from the existing count for preservation check
  const adjustedExistingMilestones = checkExistingMilestones.filter((m: any) => {
    const nameLower = m.name?.toLowerCase();
    const isRemoved = removedMilestoneNames.has(nameLower) || 
                      removedMilestoneNames.has(m.id) ||
                      removedMilestoneNames.has(m.name);
    if (isRemoved) {
      console.log(`📍 Server: Milestone "${m.name}" is intentionally removed - excluding from preservation check`);
    }
    return !isRemoved;
  });

  if (adjustedExistingMilestones.length > 0 || checkExistingMilestones.length > 0) {
    const existingMilestoneIds = new Set(adjustedExistingMilestones.map((m: any) => m.id));
    const preservedMilestones = checkUpdatedMilestones.filter((m: any) => 
      m.id && existingMilestoneIds.has(m.id)
    );
    
    // Use adjusted count for preservation rate if we have intentional removals
    const baseCount = adjustedExistingMilestones.length > 0 ? adjustedExistingMilestones.length : 1;
    const milestonePreservationRate = preservedMilestones.length / baseCount;
    
    // Check task ID preservation across all milestones (excluding removed milestones' tasks)
    const allExistingTasks = adjustedExistingMilestones.flatMap((m: any) => m.tasks || []);
    const allUpdatedTasks = checkUpdatedMilestones.flatMap((m: any) => m.tasks || []);
    
    let taskPreservationRate = 1.0;
    let preservedTaskCount = 0;
    
    if (allExistingTasks.length > 0) {
      const existingTaskIds = new Set(allExistingTasks.map((t: any) => t.id));
      const preservedTasks = allUpdatedTasks.filter((t: any) => 
        t.id && existingTaskIds.has(t.id)
      );
      preservedTaskCount = preservedTasks.length;
      taskPreservationRate = preservedTaskCount / allExistingTasks.length;
      
      if (isNaN(taskPreservationRate)) {
        taskPreservationRate = 0;
      }
    }
    
    const threshold = 0.7;
    
    console.log(`📊 Server ID Preservation Check (adjusted for intentional removals):`);
    console.log(`  Original milestones: ${checkExistingMilestones.length}, After removing combined: ${adjustedExistingMilestones.length}`);
    console.log(`  Milestones: ${preservedMilestones.length}/${baseCount} (${(milestonePreservationRate * 100).toFixed(0)}%)`);
    console.log(`  Tasks: ${preservedTaskCount}/${allExistingTasks.length} (${allExistingTasks.length === 0 ? 'N/A' : (taskPreservationRate * 100).toFixed(0) + '%'})`);
    
    if (!isNaN(milestonePreservationRate) && milestonePreservationRate >= threshold && taskPreservationRate >= threshold) {
      console.log(`✅ Server: IDs preserved above threshold`);
      return {
        mergedPlan: updatedPlan,
        preservedIds: true,
        changes,
      };
    }
    
    console.warn(`⚠️ Server: ID preservation below threshold. Performing server-side merge...`);
  }

  const mergedPlan = {
    ...existingPlan,
    name: updatedPlan.name || existingPlan.name,
    description: updatedPlan.description || existingPlan.description,
    startDate: updatedPlan.startDate || existingPlan.startDate,
    endDate: updatedPlan.endDate || existingPlan.endDate,
  };

  const existingMilestones = existingPlan.milestones || [];
  const updatedMilestones = updatedPlan.milestones || [];

  const existingByName = new Map(
    existingMilestones.map((m: any) => [m.name?.toLowerCase(), m])
  );

  const mergedMilestones: any[] = [];
  const processedNames = new Set<string>();

  for (const updatedMilestone of updatedMilestones) {
    const nameLower = updatedMilestone.name?.toLowerCase();
    const existingMilestone: any = nameLower ? existingByName.get(nameLower) : null;

    if (existingMilestone) {
      mergedMilestones.push({
        ...existingMilestone,
        ...updatedMilestone,
        id: existingMilestone.id,
        tasks: mergeTasks(existingMilestone.tasks || [], updatedMilestone.tasks || [], diffMetadata, changes),
      });
      if (nameLower) processedNames.add(nameLower);
      changes.updated.push(existingMilestone.name || existingMilestone.id);
    } else {
      mergedMilestones.push({
        ...updatedMilestone,
        id: updatedMilestone.id || generateId(),
        tasks: ensureTaskIds(updatedMilestone.tasks || []),
      });
      changes.added.push(updatedMilestone.name || updatedMilestone.id);
    }
  }

  const removedSet = new Set(diffMetadata?.milestones?.removed || []);
  
  for (const existingMilestone of existingMilestones) {
    const nameLower = existingMilestone.name?.toLowerCase();
    if (nameLower && !processedNames.has(nameLower)) {
      const shouldRemove = diffMetadata && (
        removedSet.has(existingMilestone.id) || 
        removedSet.has(existingMilestone.name) ||
        removedSet.has(nameLower)
      );
      
      if (!shouldRemove) {
        mergedMilestones.push(existingMilestone);
      } else {
        changes.removed.push(existingMilestone.name || existingMilestone.id);
        console.log(`✅ Server merge: Removed milestone "${existingMilestone.name}"`);
      }
    }
  }

  mergedPlan.milestones = mergedMilestones;

  return {
    mergedPlan,
    preservedIds: false,
    warning: 'Server performed name-based merge as fallback.',
    changes,
  };
}

function mergeTasks(
  existingTasks: any[], 
  updatedTasks: any[], 
  diffMetadata: ProjectDiff | undefined,
  changes: { added: string[]; updated: string[]; removed: string[] }
): any[] {
  const existingByName = new Map(
    existingTasks.map((t: any) => [t.name?.toLowerCase(), t])
  );

  const mergedTasks: any[] = [];
  const processedNames = new Set<string>();

  for (const updatedTask of updatedTasks) {
    const nameLower = updatedTask.name?.toLowerCase();
    const existingTask: any = nameLower ? existingByName.get(nameLower) : null;

    if (existingTask) {
      mergedTasks.push({
        ...existingTask,
        ...updatedTask,
        id: existingTask.id,
      });
      if (nameLower) processedNames.add(nameLower);
    } else {
      mergedTasks.push({
        ...updatedTask,
        id: updatedTask.id || generateId(),
      });
    }
  }

  const removedTaskSet = new Set(diffMetadata?.tasks?.removed || []);
  
  for (const existingTask of existingTasks) {
    const nameLower = existingTask.name?.toLowerCase();
    if (nameLower && !processedNames.has(nameLower)) {
      const shouldRemove = diffMetadata && (
        removedTaskSet.has(existingTask.id) || 
        removedTaskSet.has(existingTask.name) ||
        removedTaskSet.has(nameLower)
      );
      
      if (!shouldRemove) {
        mergedTasks.push(existingTask);
      } else {
        console.log(`✅ Server merge: Removed task "${existingTask.name}"`);
      }
    }
  }

  return mergedTasks;
}

function ensureIds(plan: any): any {
  if (!plan) return plan;

  return {
    ...plan,
    milestones: plan.milestones?.map((m: any) => ({
      ...m,
      id: m?.id || generateId(),
      tasks: ensureTaskIds(m?.tasks || []),
    })) || [],
  };
}

function ensureTaskIds(tasks: any[]): any[] {
  return tasks.map((t: any) => ({
    ...t,
    id: t.id || generateId(),
  }));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
