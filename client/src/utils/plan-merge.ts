/**
 * Client-side utilities for merging project plans
 * Provides fallback when server doesn't properly merge updates
 */

/**
 * Structured diff metadata that explicitly describes what changed
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
}

/**
 * Deep merge two project plans on the client side
 * Used as a fallback when the LLM returns a complete new plan instead of a properly merged one
 * @param diffMetadata - Optional structured diff describing what changed (if provided by AI)
 */
export function mergePlansClient(
  existingPlan: any,
  updatedPlan: any,
  diffMetadata?: ProjectDiff
): MergeResult {
  if (!existingPlan) {
    // No existing plan to merge with
    return {
      mergedPlan: ensureIds(updatedPlan),
      preservedIds: false,
    };
  }

  if (!updatedPlan) {
    // Nothing to merge
    return {
      mergedPlan: existingPlan,
      preservedIds: true,
    };
  }

  // Log diff metadata if provided
  if (diffMetadata) {
    console.log('📋 Diff metadata received:', JSON.stringify(diffMetadata, null, 2));
    
    // If there are removed milestones, this is likely a combine/merge operation
    // We need to respect the AI's decision and NOT add them back
    if (diffMetadata.milestones?.removed && diffMetadata.milestones.removed.length > 0) {
      console.log(`🔄 COMBINE/MERGE detected: ${diffMetadata.milestones.removed.length} milestone(s) marked for removal`);
      console.log(`   Removed milestones: ${diffMetadata.milestones.removed.join(', ')}`);
    }
  }

  // Check if this looks like a properly merged plan (has preserved IDs)
  // Require at least 70% of both milestone AND task IDs to be preserved
  const checkExistingMilestones = existingPlan.milestones || [];
  const checkUpdatedMilestones = updatedPlan.milestones || [];
  
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
      console.log(`📍 Milestone "${m.name}" is intentionally removed - excluding from preservation check`);
    }
    return !isRemoved;
  });
  
  if (adjustedExistingMilestones.length > 0 || checkExistingMilestones.length > 0) {
    // Check milestone ID preservation (against adjusted count)
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
    
    let taskPreservationRate = 1.0; // Default to 100% if no tasks exist
    let preservedTaskCount = 0;
    
    if (allExistingTasks.length > 0) {
      const existingTaskIds = new Set(allExistingTasks.map((t: any) => t.id));
      const preservedTasks = allUpdatedTasks.filter((t: any) => 
        t.id && existingTaskIds.has(t.id)
      );
      preservedTaskCount = preservedTasks.length;
      taskPreservationRate = preservedTaskCount / allExistingTasks.length;
      
      // Guard against NaN (e.g., if updated plan has empty task arrays)
      if (isNaN(taskPreservationRate)) {
        console.warn('⚠️ Task preservation rate is NaN - treating as 0%');
        taskPreservationRate = 0;
      }
    }
    
    const threshold = 0.7; // Require 70% ID preservation for both milestones and tasks
    
    console.log(`📊 ID Preservation Check (adjusted for intentional removals):`);
    console.log(`  Original milestones: ${checkExistingMilestones.length}, After removing combined: ${adjustedExistingMilestones.length}`);
    console.log(`  Milestones: ${preservedMilestones.length}/${baseCount} (${(milestonePreservationRate * 100).toFixed(0)}%)`);
    console.log(`  Tasks: ${preservedTaskCount}/${allExistingTasks.length} (${allExistingTasks.length === 0 ? 'N/A' : (taskPreservationRate * 100).toFixed(0) + '%'})`);
    
    // Guard against NaN in milestone preservation as well
    if (isNaN(milestonePreservationRate)) {
      console.warn('⚠️ Milestone preservation rate is NaN - forcing fallback');
      // Force fallback by continuing to merge code below
    } else if (milestonePreservationRate >= threshold && taskPreservationRate >= threshold) {
      // Good enough - server did a proper merge
      const taskDisplay = allExistingTasks.length === 0 ? 'N/A' : (taskPreservationRate * 100).toFixed(0) + '%';
      console.log(`✅ Server preserved IDs (M: ${(milestonePreservationRate * 100).toFixed(0)}%, T: ${taskDisplay}, threshold: ${(threshold * 100)}%)`);
      return {
        mergedPlan: updatedPlan,
        preservedIds: true,
      };
    }
    
    // Too many IDs lost - need client-side merge fallback
    const milestonePercent = isNaN(milestonePreservationRate) ? 'NaN' : (milestonePreservationRate * 100).toFixed(0) + '%';
    const taskPercent = allExistingTasks.length === 0 ? 'N/A' : (isNaN(taskPreservationRate) ? 'NaN' : (taskPreservationRate * 100).toFixed(0) + '%');
    console.warn(`⚠️ ID preservation below threshold (M: ${milestonePercent}, T: ${taskPercent}, need: ${(threshold * 100)}%). Performing client-side merge...`);
  }

  const mergedPlan = {
    ...existingPlan,
    // Update top-level fields
    name: updatedPlan.name || existingPlan.name,
    description: updatedPlan.description || existingPlan.description,
    startDate: updatedPlan.startDate || existingPlan.startDate,
    endDate: updatedPlan.endDate || existingPlan.endDate,
  };

  // Merge milestones
  const existingMilestones = existingPlan.milestones || [];
  const updatedMilestones = updatedPlan.milestones || [];

  // Create lookup maps by name (since IDs weren't preserved)
  const existingByName = new Map(
    existingMilestones.map((m: any) => [m.name?.toLowerCase(), m])
  );

  const mergedMilestones: any[] = [];
  const processedNames = new Set<string>();

  // Process updated milestones
  for (const updatedMilestone of updatedMilestones) {
    const nameLower = updatedMilestone.name?.toLowerCase();
    const existingMilestone: any = nameLower ? existingByName.get(nameLower) : null;

    if (existingMilestone) {
      // Found matching milestone by name - preserve ID and merge
      mergedMilestones.push({
        ...existingMilestone,
        ...updatedMilestone,
        id: existingMilestone.id,
        tasks: mergeTasks(existingMilestone.tasks || [], updatedMilestone.tasks || [], diffMetadata),
      });
      if (nameLower) processedNames.add(nameLower);
    } else {
      // New milestone - generate ID if missing
      mergedMilestones.push({
        ...updatedMilestone,
        id: updatedMilestone.id || generateId(),
        tasks: ensureTaskIds(updatedMilestone.tasks || []),
      });
    }
  }

  // Add existing milestones that weren't in the update
  // BUT: respect diff metadata if provided - don't re-add explicitly removed items
  const removedSet = new Set(diffMetadata?.milestones?.removed || []);
  
  for (const existingMilestone of existingMilestones) {
    const nameLower = existingMilestone.name?.toLowerCase();
    if (nameLower && !processedNames.has(nameLower)) {
      // Check if this milestone should be removed based on diff metadata
      const shouldRemove = diffMetadata && (
        removedSet.has(existingMilestone.id) || 
        removedSet.has(existingMilestone.name) ||
        removedSet.has(nameLower)
      );
      
      if (!shouldRemove) {
        // Safe to preserve this milestone
        mergedMilestones.push(existingMilestone);
      } else {
        // Explicitly removed by diff metadata
        console.log(`✅ Client-side merge: Skipping removed milestone "${existingMilestone.name}"`);
      }
    }
  }

  mergedPlan.milestones = mergedMilestones;

  // Return false for preservedIds since server did not preserve them
  // The client performed a name-based fallback merge
  return {
    mergedPlan,
    preservedIds: false,
    warning: 'LLM did not preserve IDs. Client performed name-based merge as fallback.',
  };
}

/**
 * Merge task arrays by name
 * @param diffMetadata - Optional structured diff describing what changed
 */
function mergeTasks(existingTasks: any[], updatedTasks: any[], diffMetadata?: ProjectDiff): any[] {
  const existingByName = new Map(
    existingTasks.map((t: any) => [t.name?.toLowerCase(), t])
  );

  const mergedTasks: any[] = [];
  const processedNames = new Set<string>();

  // Process updated tasks
  for (const updatedTask of updatedTasks) {
    const nameLower = updatedTask.name?.toLowerCase();
    const existingTask: any = nameLower ? existingByName.get(nameLower) : null;

    if (existingTask) {
      // Merge with existing task, preserve ID
      mergedTasks.push({
        ...existingTask,
        ...updatedTask,
        id: existingTask.id,
      });
      if (nameLower) processedNames.add(nameLower);
    } else {
      // New task
      mergedTasks.push({
        ...updatedTask,
        id: updatedTask.id || generateId(),
      });
    }
  }

  // Add existing tasks that weren't in the update
  // BUT: respect diff metadata if provided - don't re-add explicitly removed tasks
  const removedTaskSet = new Set(diffMetadata?.tasks?.removed || []);
  
  for (const existingTask of existingTasks) {
    const nameLower = existingTask.name?.toLowerCase();
    if (nameLower && !processedNames.has(nameLower)) {
      // Check if this task should be removed based on diff metadata
      const shouldRemove = diffMetadata && (
        removedTaskSet.has(existingTask.id) || 
        removedTaskSet.has(existingTask.name) ||
        removedTaskSet.has(nameLower)
      );
      
      if (!shouldRemove) {
        // Safe to preserve this task
        mergedTasks.push(existingTask);
      } else {
        // Explicitly removed by diff metadata
        console.log(`✅ Client-side merge: Skipping removed task "${existingTask.name}"`);
      }
    }
  }

  return mergedTasks;
}

/**
 * Ensure all items have IDs
 */
function ensureIds(plan: any): any {
  if (!plan) return plan;

  const safePlan = plan as any;
  
  return {
    ...safePlan,
    milestones: safePlan.milestones?.map((m: any) => ({
      ...m,
      id: m?.id || generateId(),
      tasks: ensureTaskIds(m?.tasks || []),
    })) || [],
  };
}

/**
 * Ensure all tasks have IDs
 */
function ensureTaskIds(tasks: any[]): any[] {
  return tasks.map((t: any) => ({
    ...t,
    id: t.id || generateId(),
  }));
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
