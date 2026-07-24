/**
 * PriorityMatrix — stub. Original referenced from main but never committed.
 * Renders a minimal placeholder card listing candidates so the page still
 * functions.
 */

interface PriorityMatrixProps {
  candidates: any[];
}

export function PriorityMatrix({ candidates }: PriorityMatrixProps) {
  if (!candidates?.length) return null;
  return (
    <div className="border rounded-md p-3 bg-muted/20" data-testid="priority-matrix">
      <div className="text-xs font-medium mb-2 text-muted-foreground">
        Priority overview ({candidates.length})
      </div>
      <div className="text-xs text-muted-foreground">
        Matrix view pending — the original component was not committed to the
        repo. Candidates are still listed below.
      </div>
    </div>
  );
}
