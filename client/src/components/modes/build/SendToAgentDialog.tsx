/**
 * SendToAgentDialog — stub. Original referenced from main but never
 * committed. Accepts any props and renders a placeholder dialog so the
 * build succeeds.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SendToAgentDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  candidates?: any[];
  candidate?: any;
  [key: string]: any;
}

export function SendToAgentDialog({
  open,
  onOpenChange,
  candidates,
  candidate,
}: SendToAgentDialogProps) {
  const count = candidates?.length ?? (candidate ? 1 : 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="send-to-agent-dialog">
        <DialogHeader>
          <DialogTitle>Send to agent</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Sending {count} item{count === 1 ? "" : "s"} to a coding agent.
        </p>
        <p className="text-xs text-muted-foreground">
          This dialog is a stub — the production component was not committed
          to the repository.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
