import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  TrendingUp,
  Search,
  Sparkles,
  Loader2,
  Download,
  Pencil,
  Trash2,
  GitMerge,
  ExternalLink,
  Building2,
  Clock,
  Layers,
  Settings2,
  FileText,
  X,
} from "lucide-react";
import { SourceTranscriptPane } from "@/components/meetings/IntelligenceDocumentView";

interface ThemeMention {
  id: number;
  themeId: number;
  quote: string;
  speaker: string | null;
  company: string | null;
  customerTier: string;
  weight: number;
  confidence: number | null;
  sourceType: string;
  sourceId: number | null;
  sourceLabel: string;
  timestampSeconds: number | null;
  timestampLabel: string | null;
  recordingUrl: string | null;
  deepLink: string | null;
}

interface ThemeSummary {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  mentionCount: number;
  distinctSourceCount: number;
  weightedScore: number;
  sourceBreakdown: Record<string, number>;
  tierBreakdown: Record<string, number>;
  companies: string[];
  avgConfidence: number | null;
  lastSeenAt: string | null;
  sampleMention: ThemeMention | null;
}

interface ThemeDetail extends ThemeSummary {
  mentions: ThemeMention[];
}

interface CustomerTier {
  id: number;
  company: string;
  tier: string;
  weight: number;
}

const SOURCE_LABELS: Record<string, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  teams: "Teams",
  conversation: "Conversation",
  slack: "Slack",
  support: "Support Ticket",
  evidence: "Evidence",
  note: "Note",
  transcript: "Transcript",
};

function formatLastSeen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const TIER_OPTIONS = [
  { value: "enterprise", label: "Enterprise", weight: 3 },
  { value: "mid_market", label: "Mid-Market", weight: 2 },
  { value: "smb", label: "SMB", weight: 1 },
  { value: "standard", label: "Standard", weight: 1 },
];

const TIER_COLORS: Record<string, string> = {
  enterprise:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  mid_market:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  smb: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  standard: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function sourceLabel(type: string): string {
  return SOURCE_LABELS[type] || type;
}

function tierLabel(tier: string): string {
  return TIER_OPTIONS.find((t) => t.value === tier)?.label || tier;
}

export default function ThemesPage() {
  const queryClient = useQueryClient();
  const [, params] = useRoute("/themes/:id");

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(
    params?.id ? parseInt(params.id, 10) : null,
  );
  const [renaming, setRenaming] = useState<ThemeSummary | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [merging, setMerging] = useState<ThemeSummary | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [tiersOpen, setTiersOpen] = useState(false);
  const [newTierCompany, setNewTierCompany] = useState("");
  const [newTierValue, setNewTierValue] = useState("enterprise");
  const [transcriptView, setTranscriptView] = useState<{
    text: string;
    label: string;
    quote: string;
  } | null>(null);
  const [transcriptLoadingId, setTranscriptLoadingId] = useState<number | null>(null);

  const themesQuery = useQuery<{ themes: ThemeSummary[]; searchMode?: "semantic" | "keyword" }>({
    queryKey: ["/api/themes", query],
    queryFn: async () => {
      const url = query
        ? `/api/themes?q=${encodeURIComponent(query)}`
        : "/api/themes";
      return apiRequest(url);
    },
  });

  const detailQuery = useQuery<ThemeDetail>({
    queryKey: ["/api/themes", selectedId],
    queryFn: async () => apiRequest(`/api/themes/${selectedId}`),
    enabled: selectedId != null,
  });

  const tiersQuery = useQuery<CustomerTier[]>({
    queryKey: ["/api/customer-tiers"],
    enabled: tiersOpen,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/api/themes/analyze", { method: "POST" }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/themes"] });
      if (data.segmentsScanned === 0) {
        toast({
          title: "No content to analyze",
          description:
            "Import meetings, transcripts, or evidence first, then run the analysis again.",
        });
      } else {
        toast({
          title: "Analysis complete",
          description: `Scanned ${data.segmentsScanned} statements across ${data.sourcesScanned} sources. ${data.themesCreated} new themes, ${data.mentionsAdded} mentions added.`,
        });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Analysis failed",
        description: err?.message || "Could not analyze themes.",
        variant: "destructive",
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) =>
      apiRequest(`/api/themes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/themes"] });
      setRenaming(null);
      toast({ title: "Theme renamed" });
    },
    onError: (err: any) =>
      toast({
        title: "Rename failed",
        description: err?.message,
        variant: "destructive",
      }),
  });

  const mergeMutation = useMutation({
    mutationFn: async ({
      sourceId,
      targetId,
    }: {
      sourceId: number;
      targetId: number;
    }) =>
      apiRequest(`/api/themes/${sourceId}/merge`, {
        method: "POST",
        body: JSON.stringify({ targetId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/themes"] });
      setMerging(null);
      setMergeTargetId("");
      toast({ title: "Themes merged" });
    },
    onError: (err: any) =>
      toast({
        title: "Merge failed",
        description: err?.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest(`/api/themes/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/themes"] });
      setDeletingId(null);
      if (selectedId === id) setSelectedId(null);
      toast({ title: "Theme deleted" });
    },
    onError: (err: any) =>
      toast({
        title: "Delete failed",
        description: err?.message,
        variant: "destructive",
      }),
  });

  const addTierMutation = useMutation({
    mutationFn: async () => {
      const weight =
        TIER_OPTIONS.find((t) => t.value === newTierValue)?.weight || 1;
      return apiRequest("/api/customer-tiers", {
        method: "POST",
        body: JSON.stringify({
          company: newTierCompany,
          tier: newTierValue,
          weight,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-tiers"] });
      setNewTierCompany("");
      toast({
        title: "Customer tier saved",
        description: "Re-run analysis to apply weighting to rankings.",
      });
    },
    onError: (err: any) =>
      toast({
        title: "Could not save tier",
        description: err?.message,
        variant: "destructive",
      }),
  });

  const deleteTierMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest(`/api/customer-tiers/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/customer-tiers"] }),
  });

  const themes = themesQuery.data?.themes || [];
  const themeSearchMode = themesQuery.data?.searchMode;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput.trim());
  };

  const handleExport = (id: number, format: "markdown" | "json") => {
    window.open(`/api/themes/${id}/export?format=${format}`, "_blank");
  };

  // Open the raw source transcript for a mention (no recording available) and
  // jump to / highlight the exact quote.
  const openTranscript = async (m: ThemeMention) => {
    if (m.sourceId == null) return;
    setTranscriptLoadingId(m.id);
    try {
      const data = await apiRequest(
        `/api/theme-source-transcript?sourceType=${encodeURIComponent(
          m.sourceType,
        )}&sourceId=${m.sourceId}`,
      );
      setTranscriptView({
        text: data.transcriptText,
        label: data.sourceLabel,
        quote: m.quote,
      });
    } catch (err: any) {
      toast({
        title: "Transcript not available",
        description:
          err?.message || "The original source text isn't attached to this mention.",
        variant: "destructive",
      });
    } finally {
      setTranscriptLoadingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1
              className="text-2xl font-semibold"
              data-testid="text-page-title"
            >
              Theme Finder
            </h1>
            <Badge variant="secondary">AI</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Recurring themes traced across every meeting, transcript, and note —
            weighted by customer importance, with real quotes and deep links.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setTiersOpen(true)}
            data-testid="button-manage-tiers"
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Customer tiers
          </Button>
          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            data-testid="button-analyze"
          >
            {analyzeMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {analyzeMutation.isPending ? "Analyzing…" : "Analyze content"}
          </Button>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search themes in plain language (e.g. 'checkbox detection', 'onboarding confusion')"
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Button type="submit" variant="secondary" data-testid="button-search">
          Search
        </Button>
        {query && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearchInput("");
              setQuery("");
            }}
            data-testid="button-clear-search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {query && themeSearchMode === "keyword" && (
        <div className="mb-4">
          <Badge
            variant="outline"
            className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700"
            data-testid="badge-keyword-search-mode"
          >
            Keyword search only — semantic search unavailable
          </Badge>
        </div>
      )}

      {/* Theme list */}
      {themesQuery.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading themes…
        </div>
      ) : themes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-medium mb-1">
              {query ? "No themes match your search" : "No themes yet"}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {query
                ? "Try a broader phrase, or clear the search."
                : "Run an analysis to cluster your imported conversations into recurring themes."}
            </p>
            {!query && (
              <Button
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                data-testid="button-analyze-empty"
              >
                {analyzeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Analyze content
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {themes.map((theme) => (
            <Card
              key={theme.id}
              className="hover-elevate cursor-pointer"
              onClick={() => setSelectedId(theme.id)}
              data-testid={`card-theme-${theme.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className="font-medium truncate"
                        data-testid={`text-theme-title-${theme.id}`}
                      >
                        {theme.title}
                      </h3>
                      {theme.category && (
                        <Badge variant="outline" className="text-xs">
                          {theme.category}
                        </Badge>
                      )}
                    </div>
                    {theme.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {theme.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Badge
                        variant="secondary"
                        data-testid={`badge-mentions-${theme.id}`}
                      >
                        {theme.mentionCount} mentions
                      </Badge>
                      <Badge variant="secondary">
                        {theme.distinctSourceCount} sources
                      </Badge>
                      {Object.entries(theme.sourceBreakdown).map(
                        ([src, count]) => (
                          <Badge
                            key={src}
                            variant="outline"
                            className="text-xs"
                          >
                            {sourceLabel(src)}: {count}
                          </Badge>
                        ),
                      )}
                      {theme.companies.slice(0, 3).map((c) => (
                        <Badge
                          key={c}
                          variant="outline"
                          className="text-xs gap-1"
                        >
                          <Building2 className="h-3 w-3" />
                          {c}
                        </Badge>
                      ))}
                      {typeof theme.avgConfidence === "number" && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(theme.avgConfidence * 100)}% confidence
                        </Badge>
                      )}
                      {formatLastSeen(theme.lastSeenAt) && (
                        <Badge
                          variant="outline"
                          className="text-xs gap-1"
                          data-testid={`badge-last-seen-${theme.id}`}
                        >
                          <Clock className="h-3 w-3" />
                          Last seen {formatLastSeen(theme.lastSeenAt)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className="text-2xl font-semibold text-primary"
                      data-testid={`text-score-${theme.id}`}
                    >
                      {theme.weightedScore}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      weighted score
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Theme detail dialog */}
      <Dialog
        open={selectedId != null}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          {detailQuery.isLoading || !detailQuery.data ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4 pr-6">
                  <div>
                    <DialogTitle data-testid="text-detail-title">
                      {detailQuery.data.title}
                    </DialogTitle>
                    {detailQuery.data.description && (
                      <DialogDescription className="mt-1">
                        {detailQuery.data.description}
                      </DialogDescription>
                    )}
                  </div>
                </div>
              </DialogHeader>

              {/* Stats + actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">
                  {detailQuery.data.mentionCount} mentions
                </Badge>
                <Badge variant="secondary">
                  {detailQuery.data.distinctSourceCount} sources
                </Badge>
                <Badge variant="secondary">
                  score {detailQuery.data.weightedScore}
                </Badge>
                {Object.entries(detailQuery.data.tierBreakdown).map(
                  ([tier, count]) => (
                    <Badge
                      key={tier}
                      className={`text-xs ${TIER_COLORS[tier] || ""}`}
                    >
                      {tierLabel(tier)}: {count}
                    </Badge>
                  ),
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport(detailQuery.data!.id, "markdown")}
                  data-testid="button-export-md"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export (Markdown)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport(detailQuery.data!.id, "json")}
                  data-testid="button-export-json"
                >
                  <Download className="h-4 w-4 mr-2" />
                  JSON
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRenaming(detailQuery.data!);
                    setRenameTitle(detailQuery.data!.title);
                  }}
                  data-testid="button-rename"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Rename
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMerging(detailQuery.data!)}
                  data-testid="button-merge"
                >
                  <GitMerge className="h-4 w-4 mr-2" />
                  Merge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeletingId(detailQuery.data!.id)}
                  data-testid="button-delete"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>

              {/* Mentions */}
              <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
                <div className="space-y-3 py-2">
                  {detailQuery.data.mentions.map((m) => (
                    <div
                      key={m.id}
                      className="border rounded-md p-3"
                      data-testid={`mention-${m.id}`}
                    >
                      <blockquote className="border-l-2 border-primary/40 pl-3 text-sm italic">
                        “{m.quote}”
                      </blockquote>
                      <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-muted-foreground">
                        {m.speaker && (
                          <span className="font-medium text-foreground">
                            {m.speaker}
                          </span>
                        )}
                        {m.company && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {m.company}
                          </span>
                        )}
                        <Badge
                          className={`text-xs ${TIER_COLORS[m.customerTier] || ""}`}
                        >
                          {tierLabel(m.customerTier)}
                        </Badge>
                        {typeof m.confidence === "number" && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(m.confidence * 100)}%
                          </Badge>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {sourceLabel(m.sourceType)} · {m.sourceLabel}
                        </span>
                        {m.timestampLabel && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {m.timestampLabel}
                          </span>
                        )}
                        {m.deepLink ? (
                          <a
                            href={m.deepLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                            data-testid={`link-deeplink-${m.id}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open at timestamp
                          </a>
                        ) : m.sourceId != null ? (
                          <button
                            type="button"
                            onClick={() => openTranscript(m)}
                            disabled={transcriptLoadingId === m.id}
                            className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
                            data-testid={`link-transcript-${m.id}`}
                          >
                            {transcriptLoadingId === m.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <FileText className="h-3 w-3" />
                            )}
                            View in transcript
                          </button>
                        ) : (
                          <span className="italic">no source link</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Source transcript viewer — jumps to and highlights the mention quote */}
      <Dialog
        open={transcriptView != null}
        onOpenChange={(open) => !open && setTranscriptView(null)}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Source transcript
            </DialogTitle>
            {transcriptView && (
              <DialogDescription className="truncate">
                Jumping to the quote in “{transcriptView.label}”
              </DialogDescription>
            )}
          </DialogHeader>
          {transcriptView && (
            <SourceTranscriptPane
              transcriptText={transcriptView.text}
              jumpToQuote={transcriptView.quote}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog
        open={renaming != null}
        onOpenChange={(open) => !open && setRenaming(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename theme</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            data-testid="input-rename"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                renaming &&
                renameMutation.mutate({
                  id: renaming.id,
                  title: renameTitle.trim(),
                })
              }
              disabled={!renameTitle.trim() || renameMutation.isPending}
              data-testid="button-save-rename"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge dialog */}
      <Dialog
        open={merging != null}
        onOpenChange={(open) => !open && setMerging(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge theme</DialogTitle>
            <DialogDescription>
              Move all mentions from “{merging?.title}” into another theme. The
              original theme is then removed.
            </DialogDescription>
          </DialogHeader>
          <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
            <SelectTrigger data-testid="select-merge-target">
              <SelectValue placeholder="Select target theme" />
            </SelectTrigger>
            <SelectContent>
              {themes
                .filter((t) => t.id !== merging?.id)
                .map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMerging(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                merging &&
                mergeTargetId &&
                mergeMutation.mutate({
                  sourceId: merging.id,
                  targetId: parseInt(mergeTargetId, 10),
                })
              }
              disabled={!mergeTargetId || mergeMutation.isPending}
              data-testid="button-confirm-merge"
            >
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={deletingId != null}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this theme?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the theme and all of its traced mentions. Your
              original source content is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer tiers dialog */}
      <Dialog open={tiersOpen} onOpenChange={setTiersOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Customer importance tiers</DialogTitle>
            <DialogDescription>
              Assign companies to tiers so their mentions carry more weight in
              theme ranking. Re-run analysis after changes to apply.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Company</Label>
              <Input
                value={newTierCompany}
                onChange={(e) => setNewTierCompany(e.target.value)}
                placeholder="Acme"
                data-testid="input-tier-company"
              />
            </div>
            <div className="w-40">
              <Label className="text-xs">Tier</Label>
              <Select value={newTierValue} onValueChange={setNewTierValue}>
                <SelectTrigger data-testid="select-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} (×{t.weight})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => addTierMutation.mutate()}
              disabled={!newTierCompany.trim() || addTierMutation.isPending}
              data-testid="button-add-tier"
            >
              Add
            </Button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {(tiersQuery.data || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No custom tiers yet. Unlisted companies default to Standard (×1).
              </p>
            ) : (
              (tiersQuery.data || []).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border rounded-md px-3 py-2"
                  data-testid={`tier-row-${t.id}`}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{t.company}</span>
                    <Badge className={`text-xs ${TIER_COLORS[t.tier] || ""}`}>
                      {tierLabel(t.tier)} ×{t.weight}
                    </Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteTierMutation.mutate(t.id)}
                    data-testid={`button-delete-tier-${t.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
