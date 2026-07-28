import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plug,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Play,
  CheckCircle2,
  ArrowRight,
  Activity,
  Unplug,
  CalendarClock,
  MessageSquare,
  FileText,
  TrendingUp,
  Radio,
  Link as LinkIcon,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface ApiToken {
  id: number;
  name: string;
  last4: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  origin: string;
}

interface Readiness {
  counts: {
    meetings: number;
    meetingsWithTranscript: number;
    conversations: number;
    themes: number;
    tracedQuotes: number;
    intelligenceDocuments: number;
    customerTiers: number;
  };
  hasAnything: boolean;
  highlights: {
    topThemeTitle: string | null;
    topCompany: string | null;
    latestMeetingSubject: string | null;
  };
}

interface ActivityData {
  recent: Array<{
    id: number;
    toolName: string;
    tokenName: string | null;
    createdAt: string;
  }>;
  topTools: Array<{ toolName: string; count: number }>;
}

const TOOL_GROUPS = [
  {
    group: "Meetings",
    icon: MessageSquare,
    tint: "text-sky-600 dark:text-sky-400",
    tools: [
      { name: "list_meetings", blurb: "Zoom, Meet and Teams in one feed." },
      { name: "get_meeting", blurb: "One meeting's details and attendees." },
      { name: "get_meeting_transcript", blurb: "Read a transcript, in pages." },
      { name: "list_conversations", blurb: "Pasted notes and audio transcriptions." },
      { name: "search_meetings", blurb: "Search everything that was said." },
    ],
  },
  {
    group: "Meeting minutes",
    icon: FileText,
    tint: "text-amber-600 dark:text-amber-400",
    tools: [
      { name: "get_intelligence_document", blurb: "Decisions, actions, owners, risks." },
      { name: "list_intelligence_documents", blurb: "Every processed transcript." },
      { name: "get_batch_summary", blurb: "Roll up many meetings at once." },
      { name: "list_intelligence_batches", blurb: "Bulk processing runs." },
    ],
  },
  {
    group: "Themes",
    icon: TrendingUp,
    tint: "text-violet-600 dark:text-violet-400",
    tools: [
      { name: "list_themes", blurb: "What customers keep raising, ranked." },
      { name: "get_theme", blurb: "One theme, with tier and source breakdowns." },
      { name: "get_theme_mentions", blurb: "The verbatim quotes behind a theme." },
      { name: "get_theme_source_transcript", blurb: "Verify any quote in context." },
      { name: "list_customer_tiers", blurb: "Which accounts count for more." },
    ],
  },
] as const;

function formatDate(value: string | null): string {
  if (!value) return "never";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "unknown" : d.toLocaleDateString();
}

/** Relative time — the activity feed reads better as "2 minutes ago". */
function timeAgo(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─────────────────────────────────────────────────────────────────────────

export default function ConnectPage() {
  const { toast } = useToast();

  // Two-step token flow: name dialog → reveal dialog.
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("never");
  const [newToken, setNewToken] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [previewTool, setPreviewTool] = useState("list_themes");
  const [preview, setPreview] = useState<string | null>(null);

  const { data: tokenData, isLoading: tokensLoading } = useQuery<{ tokens: ApiToken[] }>({
    queryKey: ["/api/mcp/tokens"],
    refetchInterval: 15000,
  });
  const { data: readiness } = useQuery<Readiness>({ queryKey: ["/api/mcp/readiness"] });
  const { data: activity } = useQuery<ActivityData>({
    queryKey: ["/api/mcp/activity"],
    refetchInterval: 15000,
  });

  const allTokens = tokenData?.tokens ?? [];
  const oauthApps = allTokens.filter((t) => t.origin === "oauth");
  const tokens = allTokens.filter((t) => t.origin !== "oauth");
  const hasToken = allTokens.length > 0;
  const everUsed = allTokens.some((t) => !!t.lastUsedAt);
  const stage: "no-token" | "awaiting" | "connected" = !hasToken
    ? "no-token"
    : everUsed
      ? "connected"
      : "awaiting";

  const serverUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/mcp`;
  const tokenForSnippets = newToken ?? "<YOUR_TOKEN>";

  const createMutation = useMutation({
    mutationFn: (body: { name: string; expiresInDays?: number }) =>
      apiRequest("/api/mcp/tokens", {
        method: "POST",
        body: JSON.stringify(body),
      }) as Promise<{ token: string }>,
    onSuccess: (res) => {
      setNameDialogOpen(false);
      setNewToken(res.token);
      setName("");
      queryClient.invalidateQueries({ queryKey: ["/api/mcp/tokens"] });
    },
    onError: (err: any) =>
      toast({
        title: "Could not create token",
        description: err?.message || "Please try again.",
        variant: "destructive",
      }),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/mcp/tokens/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcp/tokens"] });
      toast({ title: "Token revoked", description: "That client can no longer read your data." });
    },
  });

  const previewMutation = useMutation({
    mutationFn: (tool: string) =>
      apiRequest("/api/mcp/preview", {
        method: "POST",
        body: JSON.stringify({ tool, arguments: { limit: 3 } }),
      }) as Promise<{ result: unknown }>,
    onSuccess: (res) => setPreview(JSON.stringify(res.result, null, 2)),
    onError: () => setPreview("Preview failed — check the server logs."),
  });

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Select and copy manually.", variant: "destructive" });
    }
  }

  const snippets = useMemo(
    () => ({
      claudeCode: `claude mcp add --transport http requisor ${serverUrl} \\
  --header "Authorization: Bearer ${tokenForSnippets}"`,
      claudeDesktop: `{
  "mcpServers": {
    "requisor": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "${serverUrl}",
        "--header", "Authorization:\${AUTH}",
        "--transport", "http-only"
      ],
      "env": { "AUTH": "Bearer ${tokenForSnippets}" }
    }
  }
}`,
      cursor: `{
  "mcpServers": {
    "requisor": {
      "url": "${serverUrl}",
      "headers": { "Authorization": "Bearer ${tokenForSnippets}" }
    }
  }
}`,
      generic: `POST ${serverUrl}
Authorization: Bearer ${tokenForSnippets}
Content-Type: application/json
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"tools/list"}`,
    }),
    [serverUrl, tokenForSnippets],
  );

  const prompts = useMemo(() => {
    const h = readiness?.highlights;
    const out: string[] = [];
    if (h?.topThemeTitle && h?.topCompany) {
      out.push(`What did ${h.topCompany} say about ${h.topThemeTitle.toLowerCase()}?`);
    } else if (h?.topThemeTitle) {
      out.push(`Show me the quotes behind the "${h.topThemeTitle}" theme.`);
    }
    out.push("What are my top customer themes, and which enterprise accounts raised them?");
    if (h?.latestMeetingSubject) {
      out.push(`Summarise "${h.latestMeetingSubject}" — decisions and action items.`);
    }
    out.push("Which action items from my meetings have no owner assigned?");
    return out;
  }, [readiness]);

  const c = readiness?.counts;

  const CopyBtn = ({ text, k, label }: { text: string; k: string; label?: string }) => (
    <Button type="button" size="sm" variant="outline" onClick={() => copy(text, k)} data-testid={`button-copy-${k}`}>
      {copiedKey === k ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {label && <span className="ml-2">{copiedKey === k ? "Copied" : label}</span>}
    </Button>
  );

  const CodeBlock = ({ text, k }: { text: string; k: string }) => (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 pr-14 text-xs leading-relaxed text-slate-100 shadow-sm">
        {text}
      </pre>
      <button
        type="button"
        onClick={() => copy(text, k)}
        className="absolute right-2 top-2 rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
        aria-label="Copy"
      >
        {copiedKey === k ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20" data-testid="page-connect">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-50 via-white to-sky-50 p-6 dark:from-violet-950/40 dark:via-slate-900 dark:to-sky-950/30">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-violet-600 p-3 shadow-lg shadow-violet-600/25">
            <Plug className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Connect Requisor to your AI
              </h1>
              <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Read-only
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Ask Claude, Cursor or any MCP client about your meetings and customer
              themes &mdash; without copying anything across. Every answer comes back
              with the verbatim quote it came from.
            </p>

            {/* Status pill */}
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur dark:bg-slate-900/70">
              {stage === "connected" ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Connected &mdash; an AI client has read your data
                  </span>
                </>
              ) : stage === "awaiting" ? (
                <>
                  <Radio className="h-3.5 w-3.5 animate-pulse text-amber-500" />
                  <span className="text-amber-700 dark:text-amber-400">
                    Waiting for first connection &mdash; this updates itself
                  </span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">
                    Not connected &mdash; takes about a minute
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Readiness ────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ready to share</CardTitle>
          <CardDescription>
            Exactly what a connected AI could read. Nothing outside this is exposed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!readiness ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking&hellip;
            </div>
          ) : !readiness.hasAnything ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Nothing to share yet</AlertTitle>
              <AlertDescription className="text-sm">
                No meetings, transcripts or themes yet. Connecting would work, but an AI
                would find nothing.{" "}
                <Link href="/meetings" className="font-medium underline">
                  Add a meeting or paste a transcript
                </Link>{" "}
                first.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: "Meetings", value: c?.meetings ?? 0 },
                { label: "With transcript", value: c?.meetingsWithTranscript ?? 0 },
                { label: "Imported notes", value: c?.conversations ?? 0 },
                { label: "Themes", value: c?.themes ?? 0 },
                { label: "Traced quotes", value: c?.tracedQuotes ?? 0 },
                { label: "Meeting minutes", value: c?.intelligenceDocuments ?? 0 },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border bg-gradient-to-b from-white to-slate-50 p-4 transition hover:border-violet-300 hover:shadow-sm dark:from-slate-900 dark:to-slate-900/50"
                  data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                    {s.value}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Connected apps (OAuth) ───────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="h-4 w-4 text-emerald-600" />
            Connected apps
            <Badge variant="secondary" className="ml-1 text-xs">One-click</Badge>
          </CardTitle>
          <CardDescription>
            Apps connected through the browser approval flow. In Claude or Cursor, add a
            custom connector with the server URL below &mdash; you approve access in your
            browser, no token to copy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {oauthApps.length === 0 ? (
            <div className="rounded-xl border bg-gradient-to-b from-violet-50/60 to-transparent p-5 dark:from-violet-950/20">
              {/* The URL — the one thing they need to copy, made prominent */}
              <div className="flex items-center gap-2 rounded-lg border bg-background p-1.5 pl-3 shadow-sm">
                <LinkIcon className="h-4 w-4 shrink-0 text-violet-500" />
                <code className="flex-1 truncate text-sm font-medium">{serverUrl}</code>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => copy(serverUrl, "oauth-url")}
                  className="shrink-0"
                  data-testid="button-copy-oauth-url"
                >
                  {copiedKey === "oauth-url" ? (
                    <>
                      <Check className="mr-1.5 h-4 w-4" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-4 w-4" /> Copy URL
                    </>
                  )}
                </Button>
              </div>

              {/* Three steps, laid out visually rather than as prose */}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { n: 1, icon: Copy, title: "Copy the URL", body: "The server address above." },
                  { n: 2, icon: Plug, title: "Add a connector", body: "In Claude or Cursor, paste it into “Add custom connector.”" },
                  { n: 3, icon: CheckCircle2, title: "Approve", body: "A browser opens — click Approve. No token to copy." },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.n} className="rounded-lg border bg-background/60 p-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                          {s.n}
                        </span>
                        <Icon className="h-4 w-4 text-violet-500" />
                      </div>
                      <p className="mt-2 text-sm font-medium">{s.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.body}</p>
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Radio className="h-3.5 w-3.5 animate-pulse text-amber-500" />
                Once you approve, the app appears here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {oauthApps.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3"
                  data-testid={`row-oauth-${t.id}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${t.lastUsedAt ? "bg-emerald-500" : "bg-amber-400"}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        connected via OAuth
                        <span className="mx-1.5">&bull;</span>
                        {t.lastUsedAt ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            last used {formatDate(t.lastUsedAt)}
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">never used</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:bg-destructive/10"
                    onClick={() => revokeMutation.mutate(t.id)}
                    disabled={revokeMutation.isPending}
                    data-testid={`button-revoke-oauth-${t.id}`}
                  >
                    <Unplug className="mr-1 h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tokens ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Access tokens</CardTitle>
            <CardDescription>
              Manual tokens for scripts, Claude Code, or any client without the one-click
              flow. One per device, revoke individually.
            </CardDescription>
          </div>
          <Button
            type="button"
            onClick={() => {
              setName("");
              setExpiry("never");
              setNameDialogOpen(true);
            }}
            data-testid="button-open-create-token"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create token
          </Button>
        </CardHeader>
        <CardContent>
          {tokensLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading&hellip;
            </div>
          ) : tokens.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm font-medium">No tokens yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create one to connect Claude, Cursor or any MCP client.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tokens.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3 transition hover:border-slate-300 dark:hover:border-slate-700"
                  data-testid={`row-token-${t.id}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        t.lastUsedAt ? "bg-emerald-500" : "bg-amber-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <code>&middot;&middot;&middot;&middot;{t.last4}</code>
                        <span className="mx-1.5">&bull;</span>
                        {t.lastUsedAt ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            last used {formatDate(t.lastUsedAt)}
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">never used</span>
                        )}
                        {t.expiresAt && (
                          <>
                            <span className="mx-1.5">&bull;</span>
                            expires {formatDate(t.expiresAt)}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:bg-destructive/10"
                    onClick={() => revokeMutation.mutate(t.id)}
                    disabled={revokeMutation.isPending}
                    data-testid={`button-revoke-${t.id}`}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Setup ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add Requisor to your AI tool</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2 pt-1">
            <span>Server URL</span>
            <code className="rounded-md bg-muted px-2 py-1 text-xs">{serverUrl}</code>
            <CopyBtn text={serverUrl} k="url" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!newToken && (
            <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
              Snippets show <code className="text-xs">&lt;YOUR_TOKEN&gt;</code> &mdash; create a
              token above and they fill in automatically.
            </p>
          )}

          <Tabs defaultValue="claude-desktop">
            <TabsList className="flex h-auto flex-wrap gap-1">
              <TabsTrigger value="claude-desktop">Claude Desktop</TabsTrigger>
              <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
              <TabsTrigger value="cursor">Cursor</TabsTrigger>
              <TabsTrigger value="generic">Generic HTTP</TabsTrigger>
            </TabsList>

            <TabsContent value="claude-desktop" className="mt-4 space-y-3">
              <ol className="ml-4 list-decimal space-y-1 text-sm text-muted-foreground">
                <li>
                  Needs{" "}
                  <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="underline">
                    Node.js
                  </a>{" "}
                  &mdash; Claude Desktop launches local programs, so it reaches us through a
                  small bridge.
                </li>
                <li>
                  Open <code className="text-xs">%APPDATA%\Claude\claude_desktop_config.json</code>{" "}
                  (Mac: <code className="text-xs">~/Library/Application Support/Claude/</code>).
                </li>
                <li>
                  Paste the snippet. If <code className="text-xs">mcpServers</code> already exists,
                  add just the <code className="text-xs">requisor</code> entry inside it.
                </li>
                <li>Quit Claude Desktop fully from the tray, then reopen.</li>
              </ol>
              <CodeBlock text={snippets.claudeDesktop} k="snip-desktop" />
            </TabsContent>

            <TabsContent value="claude-code" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Speaks HTTP directly &mdash; no bridge needed. Run this in your terminal.
              </p>
              <CodeBlock text={snippets.claudeCode} k="snip-code" />
            </TabsContent>

            <TabsContent value="cursor" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Add to <code className="text-xs">.cursor/mcp.json</code> in your project, or your
                global Cursor MCP settings.
              </p>
              <CodeBlock text={snippets.cursor} k="snip-cursor" />
            </TabsContent>

            <TabsContent value="generic" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Streamable HTTP. The <code className="text-xs">Accept</code> header must list both
                types or the request is rejected with a 406.
              </p>
              <CodeBlock text={snippets.generic} k="snip-generic" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Live preview ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Play className="h-4 w-4 text-violet-600" />
            See what your AI will see
          </CardTitle>
          <CardDescription>
            Run a tool against your real data before connecting anything. Same code path a
            connected client uses &mdash; if it works here, the server is fine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {["list_themes", "list_meetings", "list_customer_tiers", "list_intelligence_documents"].map(
              (t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={previewTool === t ? "default" : "outline"}
                  onClick={() => {
                    setPreviewTool(t);
                    setPreview(null);
                  }}
                  data-testid={`button-preview-tool-${t}`}
                >
                  <code className="text-xs">{t}</code>
                </Button>
              ),
            )}
          </div>
          <Button
            type="button"
            onClick={() => previewMutation.mutate(previewTool)}
            disabled={previewMutation.isPending}
            data-testid="button-run-preview"
          >
            {previewMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Run {previewTool}
          </Button>
          {preview && (
            <pre className="max-h-80 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
              {preview}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* ── Activity ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-emerald-600" />
            What your AI has read
          </CardTitle>
          <CardDescription>
            Every tool a connected client called, newest first. We record the tool name and
            time only &mdash; never the arguments or the data returned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!activity?.recent?.length ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm font-medium">No activity yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Once an AI client reads your data, every call shows up here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activity.topTools.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activity.topTools.map((t) => (
                    <Badge key={t.toolName} variant="secondary" className="font-mono text-xs">
                      {t.toolName} &times;{t.count}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="divide-y rounded-xl border">
                {activity.recent.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    data-testid={`activity-${r.id}`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <code className="truncate text-xs font-medium text-violet-700 dark:text-violet-400">
                        {r.toolName}
                      </code>
                      {r.tokenName && (
                        <span className="truncate text-xs text-muted-foreground">
                          via {r.tokenName}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(r.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Prompts ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-violet-600" />
            Try asking
          </CardTitle>
          <CardDescription>
            Built from your own data, so you can tell immediately whether it worked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {prompts.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm transition hover:border-violet-300 hover:bg-violet-50/40 dark:hover:bg-violet-950/20"
              data-testid={`prompt-${i}`}
            >
              <span className="text-slate-700 dark:text-slate-300">&ldquo;{p}&rdquo;</span>
              <CopyBtn text={p} k={`prompt-${i}`} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Catalogue ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What your AI can do</CardTitle>
          <CardDescription>
            14 read-only tools. Every theme quote traces back to the transcript line it came
            from.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {TOOL_GROUPS.map((g) => {
            const Icon = g.icon;
            return (
              <div key={g.group}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${g.tint}`} />
                  <span className="text-sm font-semibold">{g.group}</span>
                  <span className="text-xs text-muted-foreground">{g.tools.length} tools</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.tools.map((t) => (
                    <div
                      key={t.name}
                      className="rounded-xl border p-3 transition hover:border-slate-300 dark:hover:border-slate-700"
                    >
                      <code className="text-xs font-semibold text-violet-700 dark:text-violet-400">
                        {t.name}
                      </code>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t.blurb}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Security ─────────────────────────────────────────────────── */}
      <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20">
        <CardContent className="flex items-start gap-3 pt-6">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Read-only, and only your data</p>
            <p className="text-muted-foreground">
              Connected tools can read &mdash; never create, edit or delete. Access is scoped to
              your account, so another user&rsquo;s meetings and themes stay invisible even if an
              id is guessed. Tokens are stored hashed, never in plain text, and revoking one takes
              effect immediately.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Disconnect ───────────────────────────────────────────────── */}
      <Card className="border-rose-200 dark:border-rose-900">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Unplug className="h-4 w-4 text-rose-600" />
            Disconnecting
          </CardTitle>
          <CardDescription>
            Two halves: cut off access here, then remove the entry from your AI tool.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900 dark:bg-rose-950/20">
            <p className="font-medium text-rose-900 dark:text-rose-200">
              1. Revoke the token (this is the one that matters)
            </p>
            <p className="mt-1 text-rose-800/80 dark:text-rose-300/80">
              Hit <span className="font-medium">Revoke</span> above. Access stops on the very next
              request &mdash; you do not need to touch the AI tool for your data to be safe. A
              revoked token can never be reactivated; create a new one instead.
            </p>
          </div>

          <div>
            <p className="font-medium">2. Remove it from your AI tool (tidies up the error)</p>
            <p className="mt-1 text-muted-foreground">
              Otherwise the client keeps trying and shows a failed server.
            </p>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Claude Desktop</span> &mdash; delete
                the <code className="text-xs">"requisor"</code> block from{" "}
                <code className="text-xs">claude_desktop_config.json</code>, then fully quit and
                reopen.
              </li>
              <li>
                <span className="font-medium text-foreground">Claude Code</span> &mdash; run{" "}
                <code className="text-xs">claude mcp remove requisor</code>.
              </li>
              <li>
                <span className="font-medium text-foreground">Cursor</span> &mdash; delete the{" "}
                <code className="text-xs">"requisor"</code> entry from{" "}
                <code className="text-xs">.cursor/mcp.json</code>.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        Manage AI provider keys and other preferences in{" "}
        <Link href="/settings" className="inline-flex items-center gap-1 font-medium underline">
          Settings <ArrowRight className="h-3 w-3" />
        </Link>
      </p>

      {/* ── Dialog 1: name it ────────────────────────────────────────── */}
      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-name-token">
          <DialogHeader>
            <DialogTitle>Create an access token</DialogTitle>
            <DialogDescription>
              Name it after the device or app you&rsquo;ll use it from, so you know which one to
              revoke later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="token-name">Token name</Label>
              <Input
                id="token-name"
                placeholder="e.g. Claude Desktop &ndash; work laptop"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim() && !createMutation.isPending) {
                    createMutation.mutate({
                      name: name.trim(),
                      expiresInDays: expiry === "never" ? undefined : Number(expiry),
                    });
                  }
                }}
                data-testid="input-token-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="token-expiry">Expires</Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger id="token-expiry" data-testid="select-token-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">In 30 days</SelectItem>
                  <SelectItem value="90">In 90 days</SelectItem>
                  <SelectItem value="365">In 1 year</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                An expiring token limits the damage if it ever leaks.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setNameDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() =>
                createMutation.mutate({
                  name: name.trim(),
                  expiresInDays: expiry === "never" ? undefined : Number(expiry),
                })
              }
              disabled={!name.trim() || createMutation.isPending}
              data-testid="button-confirm-create-token"
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 2: reveal once ────────────────────────────────────── */}
      <Dialog open={!!newToken} onOpenChange={(open) => !open && setNewToken(null)}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-reveal-token">
          <DialogHeader>
            <DialogTitle>Copy your token now</DialogTitle>
            <DialogDescription>
              This is the only time the full token is shown. If you lose it, revoke it and create
              a new one. It&rsquo;s already filled into the setup snippets on this page.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive" className="border-rose-300 bg-rose-50 dark:bg-rose-950/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Treat this like a password</AlertTitle>
            <AlertDescription>
              Anyone with this token can read your Requisor data.
            </AlertDescription>
          </Alert>

          <div className="flex items-start gap-2">
            <code
              className="flex-1 break-all rounded-lg border bg-muted p-3 font-mono text-sm"
              data-testid="text-new-token"
            >
              {newToken}
            </code>
            <CopyBtn text={newToken ?? ""} k="token" label="Copy" />
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setNewToken(null)}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-token-done"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
