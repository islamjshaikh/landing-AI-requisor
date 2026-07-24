import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import type { EvidenceItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Brain,
  Plus,
  AlertTriangle,
  Lightbulb,
  GitBranch,
  HelpCircle,
  Sparkles,
  Trash2,
  Pencil,
  Upload,
  Loader2,
  Check,
  FileJson,
  Flame,
} from "lucide-react";

const INSIGHT_TYPES = [
  { key: "all", label: "All", icon: Brain },
  { key: "problem", label: "Problems", icon: AlertTriangle },
  { key: "feature", label: "Features", icon: Sparkles },
  { key: "decision", label: "Decisions", icon: GitBranch },
  { key: "insight", label: "Insights", icon: Lightbulb },
  { key: "question", label: "Questions", icon: HelpCircle },
] as const;

const SOURCE_OPTIONS = [
  { value: "chatgpt", label: "ChatGPT" },
  { value: "claude", label: "Claude" },
  { value: "meeting", label: "Meeting Notes" },
  { value: "manual", label: "Manual / Other" },
];

const INSIGHT_COLORS: Record<string, string> = {
  problem: "bg-red-50 border-red-200 text-red-800",
  feature: "bg-blue-50 border-blue-200 text-blue-800",
  decision: "bg-green-50 border-green-200 text-green-800",
  insight: "bg-amber-50 border-amber-200 text-amber-800",
  question: "bg-purple-50 border-purple-200 text-purple-800",
};

const INSIGHT_BADGE_COLORS: Record<string, string> = {
  problem: "bg-red-100 text-red-700",
  feature: "bg-blue-100 text-blue-700",
  decision: "bg-green-100 text-green-700",
  insight: "bg-amber-100 text-amber-700",
  question: "bg-purple-100 text-purple-700",
};

interface ParseBreakdown {
  problems: number;
  features: number;
  decisions: number;
  insights: number;
  questions: number;
}

export default function BrainPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<EvidenceItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data: groupedInsights, isLoading } = useQuery<Record<string, EvidenceItem[]>>({
    queryKey: ["/api/context/insights", "grouped"],
    queryFn: async () => {
      const res = await fetch("/api/context/insights?grouped=true");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/evidence/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/context/insights"] });
      toast({ title: "Insight deleted" });
      setDeleteConfirmId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, title, content }: { id: number; title: string; content: string }) => {
      await apiRequest(`/api/evidence/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, content }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/context/insights"] });
      toast({ title: "Insight updated" });
      setEditItem(null);
    },
  });

  const getItemsForTab = useCallback((): EvidenceItem[] => {
    if (!groupedInsights) return [];
    if (activeTab === "all") {
      return Object.values(groupedInsights).flat().sort(
        (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      );
    }
    return groupedInsights[activeTab] || [];
  }, [groupedInsights, activeTab]);

  const totalCount = groupedInsights
    ? Object.values(groupedInsights).reduce((sum, arr) => sum + arr.length, 0)
    : 0;

  return (
    <div className="flex flex-col h-full p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="h-6 w-6 text-teal-600" />
            Context Brain
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} structured insights powering your AI responses
          </p>
        </div>
        <Button onClick={() => setAddModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Context
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          {INSIGHT_TYPES.map(({ key, label, icon: Icon }) => {
            const count = key === "all" ? totalCount : (groupedInsights?.[key]?.length || 0);
            return (
              <TabsTrigger key={key} value={key} className="gap-1.5">
                <Icon className="h-4 w-4" />
                {label}
                {count > 0 && (
                  <span className="ml-1 text-xs bg-gray-200 text-gray-700 rounded-full px-1.5 py-0.5">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {INSIGHT_TYPES.map(({ key }) => (
          <TabsContent key={key} value={key}>
            <InsightGrid
              items={getItemsForTab()}
              isLoading={isLoading}
              onEdit={setEditItem}
              onDelete={setDeleteConfirmId}
            />
          </TabsContent>
        ))}
      </Tabs>

      <AddContextModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/context/insights"] });
        }}
      />

      {editItem && (
        <EditInsightDialog
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={(title, content) =>
            updateMutation.mutate({ id: editItem.id, title, content })
          }
          isPending={updateMutation.isPending}
        />
      )}

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this insight?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InsightGrid({
  items,
  isLoading,
  onEdit,
  onDelete,
}: {
  items: EvidenceItem[];
  isLoading: boolean;
  onEdit: (item: EvidenceItem) => void;
  onDelete: (id: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <Brain className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No insights yet. Add context to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <InsightCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function InsightCard({
  item,
  onEdit,
  onDelete,
}: {
  item: EvidenceItem;
  onEdit: (item: EvidenceItem) => void;
  onDelete: (id: number) => void;
}) {
  const type = item.insightType || "insight";
  const colorClass = INSIGHT_COLORS[type] || INSIGHT_COLORS.insight;
  const badgeClass = INSIGHT_BADGE_COLORS[type] || INSIGHT_BADGE_COLORS.insight;

  return (
    <Card className={`border ${colorClass} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-medium text-sm leading-tight line-clamp-2">{item.title}</h3>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => onEdit(item)}
              className="p-1 hover:bg-black/5 rounded"
              aria-label="Edit insight"
            >
              <Pencil className="h-3.5 w-3.5 text-gray-500" />
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="p-1 hover:bg-black/5 rounded"
              aria-label="Delete insight"
            >
              <Trash2 className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-600 line-clamp-3 mb-3">{item.content}</p>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={`text-xs ${badgeClass}`}>
            {type}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {item.source}
          </Badge>
          {(item.mentionCount ?? 1) > 1 && (
            <Badge
              variant="secondary"
              className={`text-xs gap-1 ${
                (item.mentionCount ?? 1) >= 3
                  ? "bg-orange-100 text-orange-700 border-orange-200"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <Flame className="h-3 w-3" />
              {item.mentionCount}x
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EditInsightDialog({
  item,
  onClose,
  onSave,
  isPending,
}: {
  item: EvidenceItem;
  onClose: () => void;
  onSave: (title: string, content: string) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Insight</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Content"
            rows={5}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(title, content)} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddContextModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"paste" | "chatgpt">("paste");
  const [text, setText] = useState("");
  const [source, setSource] = useState("manual");
  const [result, setResult] = useState<ParseBreakdown | null>(null);

  const [chatgptFile, setChatgptFile] = useState<File | null>(null);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; messageCount: number; date: string }>>([]);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
  const [chatgptStep, setChatgptStep] = useState<"upload" | "select" | "processing" | "done">("upload");
  const [chatgptResult, setChatgptResult] = useState<{ totalStored: number } | null>(null);

  const parseMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/context/parse", {
        method: "POST",
        body: JSON.stringify({ text, source }),
      });
    },
    onSuccess: (data: { breakdown: ParseBreakdown; storedCount: number }) => {
      setResult(data.breakdown);
      onSuccess();
    },
    onError: () => {
      toast({ title: "Failed to parse context", variant: "destructive" });
    },
  });

  const listConversationsMutation = useMutation({
    mutationFn: async () => {
      if (!chatgptFile) throw new Error("No file");
      const formData = new FormData();
      formData.append("file", chatgptFile);
      formData.append("action", "list");
      const res = await fetch("/api/context/import-chatgpt", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data: { conversations: typeof conversations }) => {
      setConversations(data.conversations);
      setChatgptStep("select");
    },
    onError: () => {
      toast({ title: "Failed to parse ChatGPT export", variant: "destructive" });
    },
  });

  const processConversationsMutation = useMutation({
    mutationFn: async () => {
      if (!chatgptFile) throw new Error("No file");
      setChatgptStep("processing");
      const formData = new FormData();
      formData.append("file", chatgptFile);
      formData.append("action", "process");
      formData.append("conversationIds", JSON.stringify(Array.from(selectedConvIds)));
      const res = await fetch("/api/context/import-chatgpt", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data: { totalStored: number }) => {
      setChatgptResult(data);
      setChatgptStep("done");
      onSuccess();
    },
    onError: () => {
      toast({ title: "Failed to process conversations", variant: "destructive" });
      setChatgptStep("select");
    },
  });

  const resetState = () => {
    setText("");
    setSource("manual");
    setResult(null);
    setMode("paste");
    setChatgptFile(null);
    setConversations([]);
    setSelectedConvIds(new Set());
    setChatgptStep("upload");
    setChatgptResult(null);
  };

  const handleClose = (v: boolean) => {
    if (!v) resetState();
    onOpenChange(v);
  };

  const totalInsights = result
    ? result.problems + result.features + result.decisions + result.insights + result.questions
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-teal-600" />
            Add Context
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant={mode === "paste" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("paste"); resetState(); }}
          >
            Paste Text
          </Button>
          <Button
            variant={mode === "chatgpt" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("chatgpt"); resetState(); setMode("chatgpt"); }}
            className="gap-1.5"
          >
            <FileJson className="h-4 w-4" />
            ChatGPT Export
          </Button>
        </div>

        {mode === "paste" && !result && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Source</label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Paste conversation, notes, or feedback
              </label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste a ChatGPT conversation, Claude chat, meeting notes, user feedback, or any product-related text..."
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button
                onClick={() => parseMutation.mutate()}
                disabled={!text.trim() || parseMutation.isPending}
                className="gap-2"
              >
                {parseMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Extract Insights
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === "paste" && result && (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {totalInsights} insights extracted
              </h3>
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {result.problems > 0 && <Badge className="bg-red-100 text-red-700">{result.problems} Problems</Badge>}
                {result.features > 0 && <Badge className="bg-blue-100 text-blue-700">{result.features} Features</Badge>}
                {result.decisions > 0 && <Badge className="bg-green-100 text-green-700">{result.decisions} Decisions</Badge>}
                {result.insights > 0 && <Badge className="bg-amber-100 text-amber-700">{result.insights} Insights</Badge>}
                {result.questions > 0 && <Badge className="bg-purple-100 text-purple-700">{result.questions} Questions</Badge>}
              </div>
            </div>
            <Button onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}

        {mode === "chatgpt" && chatgptStep === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-2">
                Upload your <code>conversations.json</code> or the full ZIP from ChatGPT data export
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Go to ChatGPT → Settings → Data Controls → Export Data
              </p>
              <input
                type="file"
                accept=".json,.zip,application/json,application/zip"
                onChange={(e) => setChatgptFile(e.target.files?.[0] || null)}
                className="hidden"
                id="chatgpt-upload"
              />
              <label htmlFor="chatgpt-upload">
                <Button variant="outline" asChild>
                  <span>Choose File</span>
                </Button>
              </label>
              {chatgptFile && (
                <p className="mt-2 text-sm text-teal-600">{chatgptFile.name}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button
                onClick={() => listConversationsMutation.mutate()}
                disabled={!chatgptFile || listConversationsMutation.isPending}
                className="gap-2"
              >
                {listConversationsMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Reading...</>
                ) : (
                  "Load Conversations"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === "chatgpt" && chatgptStep === "select" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Select conversations to extract insights from ({conversations.length} found):
            </p>
            <ScrollArea className="h-64 border rounded-md">
              <div className="p-2 space-y-1">
                {conversations.map((conv) => (
                  <label
                    key={conv.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedConvIds.has(conv.id)}
                      onChange={(e) => {
                        const next = new Set(selectedConvIds);
                        if (e.target.checked) next.add(conv.id);
                        else next.delete(conv.id);
                        setSelectedConvIds(next);
                      }}
                      className="rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-gray-400">{conv.date} · {conv.messageCount} messages</p>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChatgptStep("upload")}>Back</Button>
              <Button
                onClick={() => processConversationsMutation.mutate()}
                disabled={selectedConvIds.size === 0}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Extract from {selectedConvIds.size} conversations
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === "chatgpt" && chatgptStep === "processing" && (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600 mx-auto mb-4" />
            <p className="text-sm text-gray-600">
              Analyzing {selectedConvIds.size} conversations with AI...
            </p>
            <p className="text-xs text-gray-400 mt-1">This may take a minute</p>
          </div>
        )}

        {mode === "chatgpt" && chatgptStep === "done" && chatgptResult && (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {chatgptResult.totalStored} insights extracted
              </h3>
              <p className="text-sm text-gray-500">
                from {selectedConvIds.size} ChatGPT conversations
              </p>
            </div>
            <Button onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
