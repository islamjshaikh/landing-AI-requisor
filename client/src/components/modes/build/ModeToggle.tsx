/**
 * ModeToggle — stub.
 *
 * The original component was referenced by ProjectPlannerAgentV2 but never
 * committed to the repository. This minimal implementation matches the
 * import contract so the build succeeds. Swap with the real component when
 * it lands.
 */

import { Button } from "@/components/ui/button";
import { Hammer, FileText } from "lucide-react";

export type AppMode = "build" | "plan";

interface ModeToggleProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div
      className="inline-flex items-center rounded-md border bg-background"
      data-testid="mode-toggle"
    >
      <Button
        type="button"
        size="sm"
        variant={mode === "build" ? "default" : "ghost"}
        className="h-7 rounded-r-none px-2"
        onClick={() => onModeChange("build")}
        data-testid="mode-toggle-build"
      >
        <Hammer className="h-3.5 w-3.5 mr-1" />
        Build
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === "plan" ? "default" : "ghost"}
        className="h-7 rounded-l-none px-2"
        onClick={() => onModeChange("plan")}
        data-testid="mode-toggle-plan"
      >
        <FileText className="h-3.5 w-3.5 mr-1" />
        Plan
      </Button>
    </div>
  );
}
