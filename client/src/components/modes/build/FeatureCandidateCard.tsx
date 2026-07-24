/**
 * FeatureCandidateCard — production rendering of a Build-mode feature
 * candidate.
 *
 * Each card shows:
 *   • Title with status icon (candidate / approved / dismissed)
 *   • WHY NOW — the rationale, surfaced prominently
 *   • EVIDENCE — verbatim quotes from source material. When a quote has a
 *     matching `evidenceRefs[i]` entry with a transcript_id, the quote
 *     becomes a clickable link that opens the source meeting transcript
 *     in a new tab. This is the traceability the original screenshot was
 *     missing.
 *   • Implementation details — three sub-cards (UI Changes / Data Model /
 *     Workflow) plus a task counter
 *   • TASKS — bulleted list of subtasks attached to this feature
 *   • Action footer — "Send to Coding Agent" + "Refine" buttons (the
 *     latter opens any future refinement flow; left as a callback)
 *
 * Evidence-link contract: when `evidenceRefs[i]` exists and has a
 * `transcriptId`, the quote at `evidence[i]` is rendered as
 * `<a href="/meetings?transcriptId=...">`. Clicking it deep-links into
 * the Meeting Intelligence tab and opens the source transcript.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Lightbulb,
  FileText,
  Sparkles,
  Code2,
  Database,
  Workflow,
  ListChecks,
  ExternalLink,
  Quote,
  Check,
  X,
  Trash2,
  Send,
  Loader2,
} from "lucide-react";

interface EvidenceRef {
  quote: string;
  transcriptId?: string | null;
  documentId?: number | null;
  sourceLabel?: string | null;
  meetingTitle?: string | null;
}

interface FeatureCandidate {
  id: number | string;
  featureTitle?: string;
  whyNow?: string | null;
  evidence?: string[] | null;
  evidenceRefs?: EvidenceRef[] | null;
  uiChanges?: string | null;
  dataModelChanges?: string | null;
  workflowChanges?: string | null;
  tasks?:
    | Array<{ name?: string; description?: string; priority?: string } | string>
    | null;
  status?: "candidate" | "approved" | "dismissed" | string;
  reasoningChain?: string | null;
  insights?: any[] | null;
}

interface FeatureCandidateCardProps {
  candidate: FeatureCandidate;
  onApprove?: (id: string | number) => void;
  onDelete?: (id: string | number) => void;
  onSendToAgent?: (candidate: FeatureCandidate) => void;
  onRefine?: (candidate: FeatureCandidate) => void;
  isApproving?: boolean;
  projectName?: string;
  projectDescription?: string;
  selectable?: boolean;
  selected?: boolean;
  onSelectionChange?: (id: string | number, checked: boolean) => void;
}

/**
 * For evidence quote `i`, find the ref that backs it. Preferred match is by
 * exact-quote, since the prompt requires evidence[i] and evidence_refs[i]
 * to share strings. Falls back to index-pairing if the strings drifted.
 */
function findRefForQuote(
  quote: string,
  index: number,
  refs: EvidenceRef[] | null | undefined,
): EvidenceRef | null {
  if (!Array.isArray(refs) || refs.length === 0) return null;
  const byQuote = refs.find((r) => r?.quote === quote);
  if (byQuote) return byQuote;
  return refs[index] || null;
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "approved") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-300">
        <Check className="h-3 w-3 mr-1" /> Approved
      </Badge>
    );
  }
  if (status === "dismissed") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <X className="h-3 w-3 mr-1" /> Dismissed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-300 text-amber-700">
      Candidate
    </Badge>
  );
}

export function FeatureCandidateCard({
  candidate,
  onApprove,
  onDelete,
  onSendToAgent,
  onRefine,
  isApproving,
  selectable,
  selected,
  onSelectionChange,
}: FeatureCandidateCardProps) {
  if (!candidate) return null;

  const evidence = Array.isArray(candidate.evidence) ? candidate.evidence : [];
  const refs = Array.isArray(candidate.evidenceRefs)
    ? candidate.evidenceRefs
    : [];
  const tasks = Array.isArray(candidate.tasks) ? candidate.tasks : [];
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const visibleEvidence = showAllEvidence ? evidence : evidence.slice(0, 3);
  const taskCount = tasks.length;

  return (
    <Card
      className="border-l-4 border-l-amber-400"
      data-testid={`feature-candidate-${candidate.id ?? "unknown"}`}
    >
      <CardContent className="p-4 space-y-3">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          {selectable && (
            <Checkbox
              className="mt-1"
              checked={!!selected}
              onCheckedChange={(v) =>
                onSelectionChange?.(candidate.id, !!v)
              }
              data-testid={`checkbox-candidate-${candidate.id}`}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
                <h3 className="text-base font-semibold truncate">
                  {candidate.featureTitle || "Untitled feature"}
                </h3>
              </div>
              <StatusBadge status={candidate.status} />
            </div>
          </div>
        </div>

        {/* ── WHY NOW ────────────────────────────────────────────── */}
        {candidate.whyNow && (
          <section>
            <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Why now
            </div>
            <p className="text-sm mt-0.5">{candidate.whyNow}</p>
          </section>
        )}

        {/* ── EVIDENCE (with transcript links) ───────────────────── */}
        {evidence.length > 0 && (
          <section data-testid="section-evidence">
            <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Evidence
            </div>
            <ul className="mt-1 space-y-1">
              {visibleEvidence.map((quote, i) => {
                const ref = findRefForQuote(quote, i, refs);
                const hasLink =
                  ref &&
                  (ref.transcriptId || typeof ref.documentId === "number");
                // Deep-link the user back to the Meeting Intelligence tab
                // with the transcript selected. The Meetings page reads
                // ?transcriptId or ?docId on mount and selects accordingly.
                const href = ref
                  ? `/meetings?tab=intelligence` +
                    (ref.transcriptId
                      ? `&transcriptId=${encodeURIComponent(ref.transcriptId)}`
                      : "") +
                    (typeof ref.documentId === "number"
                      ? `&docId=${ref.documentId}`
                      : "")
                  : "";
                return (
                  <li
                    key={i}
                    className="text-sm flex items-start gap-2"
                    data-testid={`evidence-row-${i}`}
                  >
                    <Quote className="h-3 w-3 mt-1 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      {hasLink ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-700 dark:text-emerald-400 hover:underline"
                          title={
                            ref?.meetingTitle ||
                            ref?.sourceLabel ||
                            "Open source transcript"
                          }
                        >
                          "{quote}"
                          <ExternalLink className="inline h-3 w-3 ml-1 -mt-0.5" />
                        </a>
                      ) : (
                        <span>"{quote}"</span>
                      )}
                      {ref && (ref.sourceLabel || ref.meetingTitle) && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          — {ref.meetingTitle || "Transcript"}
                          {ref.sourceLabel ? ` · ${ref.sourceLabel}` : ""}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {evidence.length > 3 && (
              <button
                type="button"
                className="text-xs text-emerald-600 hover:underline mt-1"
                onClick={() => setShowAllEvidence(!showAllEvidence)}
                data-testid="button-toggle-evidence"
              >
                {showAllEvidence
                  ? "Show less"
                  : `Show ${evidence.length - 3} more quote${evidence.length - 3 === 1 ? "" : "s"}`}
              </button>
            )}
          </section>
        )}

        {/* ── Implementation details ─────────────────────────────── */}
        {(candidate.uiChanges ||
          candidate.dataModelChanges ||
          candidate.workflowChanges ||
          taskCount > 0) && (
          <section>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              <span className="font-medium">Implementation details</span>
              <span className="text-[10px]">
                ({[
                  candidate.uiChanges && "UI",
                  candidate.dataModelChanges && "Data",
                  candidate.workflowChanges && "Workflow",
                ]
                  .filter(Boolean)
                  .join(" · ")}{taskCount > 0
                  ? ` · ${taskCount} task${taskCount === 1 ? "" : "s"}`
                  : ""})
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1.5">
              {candidate.uiChanges && (
                <div
                  className="rounded border bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 p-2"
                  data-testid="impl-ui"
                >
                  <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    <Code2 className="h-3 w-3" /> UI Changes
                  </div>
                  <p className="text-xs text-blue-900 dark:text-blue-100 mt-0.5">
                    {candidate.uiChanges}
                  </p>
                </div>
              )}
              {candidate.dataModelChanges && (
                <div
                  className="rounded border bg-purple-50/60 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900 p-2"
                  data-testid="impl-data"
                >
                  <div className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                    <Database className="h-3 w-3" /> Data Model
                  </div>
                  <p className="text-xs text-purple-900 dark:text-purple-100 mt-0.5">
                    {candidate.dataModelChanges}
                  </p>
                </div>
              )}
              {candidate.workflowChanges && (
                <div
                  className="rounded border bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 p-2"
                  data-testid="impl-workflow"
                >
                  <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                    <Workflow className="h-3 w-3" /> Workflow
                  </div>
                  <p className="text-xs text-amber-900 dark:text-amber-100 mt-0.5">
                    {candidate.workflowChanges}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── TASKS ──────────────────────────────────────────────── */}
        {taskCount > 0 && (
          <section>
            <div className="flex items-center gap-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              <ListChecks className="h-3 w-3" /> Tasks ({taskCount})
            </div>
            <ul className="mt-1 space-y-0.5">
              {tasks.map((t, i) => {
                const name =
                  typeof t === "string"
                    ? t
                    : (t?.name ?? t?.description ?? "Task");
                const priority = typeof t === "object" ? t?.priority : undefined;
                return (
                  <li
                    key={i}
                    className="text-sm flex items-center gap-2"
                    data-testid={`task-row-${i}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                    <span className="flex-1">{name}</span>
                    {priority && (
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {priority}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Action footer ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
          {onSendToAgent && (
            <Button
              size="sm"
              onClick={() => onSendToAgent(candidate)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid={`button-send-${candidate.id}`}
            >
              <Send className="h-3.5 w-3.5 mr-1" /> Send to Coding Agent
            </Button>
          )}
          {onRefine && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRefine(candidate)}
              className="text-violet-700 border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30"
              data-testid={`button-refine-${candidate.id}`}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Refine
            </Button>
          )}
          {onApprove && candidate.status !== "approved" && (
            <Button
              size="sm"
              variant="outline"
              disabled={isApproving}
              onClick={() => onApprove(candidate.id)}
              data-testid={`button-approve-${candidate.id}`}
            >
              {isApproving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1" />
              )}
              Approve
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-muted-foreground"
              onClick={() => onDelete(candidate.id)}
              data-testid={`button-delete-${candidate.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
