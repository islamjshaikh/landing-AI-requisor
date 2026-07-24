/**
 * PromptPills — stub. Original referenced from main but never committed.
 * Renders a few default prompt suggestions per mode.
 */

import { Button } from "@/components/ui/button";

interface PromptPillsProps {
  mode: "build" | "plan";
  onSelect: (text: string) => void;
  isVisible?: boolean;
}

const BUILD_PROMPTS = [
  "Analyse the latest customer interviews for feature signals",
  "Identify the top 3 product opportunities from recent meetings",
  "Summarise the last sprint's discussion points",
];
const PLAN_PROMPTS = [
  "Generate a project plan from the discovery notes",
  "Break the next milestone into 2-week sprints",
  "Identify risks for the current roadmap",
];

export function PromptPills({ mode, onSelect, isVisible = true }: PromptPillsProps) {
  if (!isVisible) return null;
  const prompts = mode === "plan" ? PLAN_PROMPTS : BUILD_PROMPTS;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="prompt-pills">
      {prompts.map((p) => (
        <Button
          key={p}
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => onSelect(p)}
        >
          {p}
        </Button>
      ))}
    </div>
  );
}
