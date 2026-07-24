import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Loader2,
  Sparkles,
  Send,
  X,
  MessageSquare,
  FileText,
} from "lucide-react";

export interface MeetingSearchResult {
  sourceType: string;
  sourceId: string | number;
  sourceLabel: string;
  snippet: string;
  similarity: number | null;
}

export interface MeetingCitation {
  index: number;
  sourceType: string;
  sourceId: string | number;
  sourceLabel: string;
  snippet: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: MeetingCitation[];
}

const SOURCE_LABELS: Record<string, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  teams: "Teams",
  conversation: "Conversation",
  intelligence: "Intelligence",
};

function sourceBadge(type: string): string {
  return SOURCE_LABELS[type] || type;
}

interface Props {
  onOpenResult: (
    sourceType: string,
    sourceId: string | number,
    snippet?: string,
  ) => void;
}

export default function MeetingsSearchAssistant({ onOpenResult }: Props) {
  // ── Search bar state ──────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const searchQuery = useQuery<{
    results: MeetingSearchResult[];
    searchMode: "semantic" | "keyword" | "none";
  }>({
    queryKey: ["/api/meetings/search", debouncedQuery],
    queryFn: async () =>
      apiRequest(`/api/meetings/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2,
  });

  const results = searchQuery.data?.results || [];
  const searchMode = searchQuery.data?.searchMode;
  const showResults = debouncedQuery.length >= 2;

  // Group passages by their source meeting for a cleaner result list.
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { sourceType: string; sourceId: string | number; sourceLabel: string; passages: MeetingSearchResult[] }
    >();
    for (const r of results) {
      const key = `${r.sourceType}:${r.sourceId}`;
      if (!map.has(key)) {
        map.set(key, {
          sourceType: r.sourceType,
          sourceId: r.sourceId,
          sourceLabel: r.sourceLabel,
          passages: [],
        });
      }
      map.get(key)!.passages.push(r);
    }
    return Array.from(map.values());
  }, [results]);

  // ── Ask AI chat state ─────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  const sendQuestion = async () => {
    const question = chatInput.trim();
    if (!question || streaming) return;
    setChatError(null);
    setChatInput("");
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "", citations: [] },
    ]);
    setStreaming(true);

    try {
      const res = await fetch("/api/meetings/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question, history }),
      });

      if (!res.ok) {
        let msg = "The assistant is unavailable right now.";
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Streaming is not supported by this browser.");
      const decoder = new TextDecoder();
      let buffer = "";

      const applyEvent = (evt: any) => {
        if (evt.type === "citations") {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") last.citations = evt.citations || [];
            return next;
          });
        } else if (evt.type === "content") {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") last.content += evt.content;
            return next;
          });
        } else if (evt.type === "error") {
          setChatError(evt.content || "The assistant hit an error.");
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            applyEvent(JSON.parse(line.slice(5).trim()));
          } catch {}
        }
      }
    } catch (err: any) {
      setChatError(err?.message || "Failed to reach the assistant.");
      // Remove the empty assistant placeholder if nothing streamed in.
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && !last.content) next.pop();
        return next;
      });
    } finally {
      setStreaming(false);
    }
  };

  // Only render the citation chips the answer actually references.
  const citedChips = (msg: ChatMessage): MeetingCitation[] => {
    if (!msg.citations?.length) return [];
    const referenced = new Set<number>();
    const re = /\[(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(msg.content)) !== null) referenced.add(parseInt(m[1], 10));
    const cited = msg.citations.filter((c) => referenced.has(c.index));
    return cited.length > 0 ? cited : msg.citations;
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search all meetings, transcripts, and conversations…"
            className="pl-9 pr-8"
            data-testid="input-meetings-search"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="button-clear-meetings-search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant="default"
          onClick={() => setChatOpen(true)}
          data-testid="button-ask-ai-meetings"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Ask AI
        </Button>
      </div>

      {showResults && (
        <Card data-testid="card-meetings-search-results">
          <CardContent className="p-4">
            {searchQuery.isLoading ? (
              <div className="flex items-center text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Searching…
              </div>
            ) : searchQuery.isError ? (
              <p className="text-sm text-destructive py-2" data-testid="text-search-error">
                Search failed. Please try again.
              </p>
            ) : grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2" data-testid="text-search-empty">
                No meetings match "{debouncedQuery}". Try a different phrase.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {grouped.length} meeting{grouped.length !== 1 ? "s" : ""} matched
                  </span>
                  {searchMode === "keyword" && (
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700 text-xs"
                      data-testid="badge-meetings-keyword-mode"
                    >
                      Keyword search only — semantic search unavailable
                    </Badge>
                  )}
                </div>
                <ScrollArea className="max-h-80">
                  <div className="space-y-2 pr-3">
                    {grouped.map((g) => (
                      <button
                        key={`${g.sourceType}:${g.sourceId}`}
                        type="button"
                        onClick={() =>
                          onOpenResult(
                            g.sourceType,
                            g.sourceId,
                            g.passages[0]?.snippet,
                          )
                        }
                        className="w-full text-left rounded-md border p-3 hover-elevate"
                        data-testid={`result-meeting-${g.sourceType}-${g.sourceId}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">
                            {g.sourceLabel}
                          </span>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {sourceBadge(g.sourceType)}
                          </Badge>
                        </div>
                        {g.passages.slice(0, 2).map((p, i) => (
                          <p
                            key={i}
                            className="text-xs text-muted-foreground line-clamp-2 mt-1"
                          >
                            {p.snippet}
                          </p>
                        ))}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Ask AI about your meetings
            </DialogTitle>
            <DialogDescription>
              Answers are grounded only in your imported meeting content, with
              citations back to the source.
            </DialogDescription>
          </DialogHeader>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto space-y-4 py-2 min-h-[240px]"
            data-testid="panel-meetings-chat"
          >
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-10">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Ask something like "What did the Ministry say about document
                volumes?"
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-lg px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap"
                      : "bg-muted rounded-lg px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap"
                  }
                  data-testid={`message-${msg.role}-${i}`}
                >
                  {msg.content ||
                    (msg.role === "assistant" && streaming && i === messages.length - 1 ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      msg.content
                    ))}
                  {msg.role === "assistant" && citedChips(msg).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/50">
                      {citedChips(msg).map((c) => (
                        <button
                          key={c.index}
                          type="button"
                          onClick={() => {
                            setChatOpen(false);
                            onOpenResult(c.sourceType, c.sourceId, c.snippet);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs hover-elevate"
                          title={c.snippet}
                          data-testid={`chip-citation-${i}-${c.index}`}
                        >
                          <span className="font-mono">[{c.index}]</span>
                          <span className="truncate max-w-[160px]">{c.sourceLabel}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatError && (
              <p className="text-sm text-destructive" data-testid="text-chat-error">
                {chatError}
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion();
            }}
            className="flex gap-2 pt-2 border-t"
          >
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask a question about your meetings…"
              disabled={streaming}
              data-testid="input-meetings-chat"
            />
            <Button
              type="submit"
              disabled={streaming || !chatInput.trim()}
              data-testid="button-send-meetings-chat"
            >
              {streaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
