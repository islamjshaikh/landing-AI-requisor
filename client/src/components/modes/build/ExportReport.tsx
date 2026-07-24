/**
 * ExportReport — stub. Original referenced from main but never committed.
 * Renders a minimal modal that downloads the candidates as JSON.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ExportReportProps {
  candidates: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportReport({ candidates, open, onOpenChange }: ExportReportProps) {
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(candidates ?? [], null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feature-candidates-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="export-report-dialog">
        <DialogHeader>
          <DialogTitle>Export feature candidates</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {candidates?.length ?? 0} candidate
          {candidates?.length === 1 ? "" : "s"} ready to export as JSON.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={downloadJson} disabled={!candidates?.length}>
            <Download className="h-4 w-4 mr-1" /> Download JSON
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
