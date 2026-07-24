import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EvidenceItem } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search,
  Plus,
  Trash2,
  Tag,
  FileText,
  MessageSquare,
  Upload,
  Database,
  StickyNote,
  Filter,
  X,
  Loader2,
  Edit3,
  Archive,
  ChevronDown,
  BarChart3,
  Sparkles,
  Table,
  Flame,
} from "lucide-react";

const SOURCE_OPTIONS = [
  { value: "all", label: "All Sources", icon: Archive },
  { value: "note", label: "Notes", icon: StickyNote },
  { value: "transcript", label: "Transcripts", icon: MessageSquare },
  { value: "file", label: "Files", icon: FileText },
  { value: "usage-data", label: "Usage Data", icon: Database },
];

const SOURCE_COLORS: Record<string, string> = {
  note: "bg-blue-100 text-blue-700 border-blue-200",
  transcript: "bg-emerald-100 text-emerald-700 border-emerald-200",
  file: "bg-amber-100 text-amber-700 border-amber-200",
  "usage-data": "bg-purple-100 text-purple-700 border-purple-200",
};

function EvidencePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<EvidenceItem | null>(null);
  const [editingTags, setEditingTags] = useState<EvidenceItem | null>(null);
  const [newTagInput, setNewTagInput] = useState("");
  const [newNote, setNewNote] = useState({ title: "", content: "", tags: "" });
  const [activeTab, setActiveTab] = useState("library");
  const [usageDataInput, setUsageDataInput] = useState("");
  const [usageDataTitle, setUsageDataTitle] = useState("");
  const [usageDataFormat, setUsageDataFormat] = useState<"csv" | "json">("csv");
  const [usageAnalysis, setUsageAnalysis] = useState<string | null>(null);

  const { data: evidenceItems = [], isLoading } = useQuery<EvidenceItem[]>({
    queryKey: ["/api/evidence", sourceFilter, tagFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sourceFilter && sourceFilter !== "all") params.set("source", sourceFilter);
      if (tagFilter) params.set("tags", tagFilter);
      const res = await fetch(`/api/evidence?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch evidence");
      return res.json();
    },
  });

  const { data: searchResponse } = useQuery<{ items: EvidenceItem[]; searchMode: "semantic" | "keyword" | "none" }>({
    queryKey: ["/api/evidence/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return { items: [], searchMode: "none" as const };
      const res = await fetch(`/api/evidence/search?q=${encodeURIComponent(searchQuery)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: searchQuery.trim().length > 0,
  });
  const searchResults = searchResponse?.items;
  const searchMode = searchResponse?.searchMode;

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; source: string; tags: string[] }) => {
      return apiRequest("/api/evidence", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evidence"] });
      setShowAddDialog(false);
      setNewNote({ title: "", content: "", tags: "" });
      toast({ title: "Evidence added", description: "Note saved to your Evidence Library." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create evidence item.", variant: "destructive" });
    },
  });

  const updateTagsMutation = useMutation({
    mutationFn: async ({ id, tags }: { id: number; tags: string[] }) => {
      return apiRequest(`/api/evidence/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ tags }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evidence"] });
      setEditingTags(null);
      setNewTagInput("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/evidence/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evidence"] });
      toast({ title: "Deleted", description: "Evidence item removed." });
    },
  });

  const displayItems = searchQuery.trim() ? (searchResults || []) : evidenceItems;

  const allTags = Array.from(new Set(evidenceItems.flatMap((item) => item.tags || [])));

  const handleAddTag = (item: EvidenceItem) => {
    if (!newTagInput.trim()) return;
    const updatedTags = [...(item.tags || []), newTagInput.trim()];
    updateTagsMutation.mutate({ id: item.id, tags: updatedTags });
    setNewTagInput("");
  };

  const usageImportMutation = useMutation({
    mutationFn: async () => {
      let dataToSend: any = usageDataInput;
      if (usageDataFormat === "json") {
        dataToSend = JSON.parse(usageDataInput);
      }
      return apiRequest("/api/evidence/usage-import", {
        method: "POST",
        body: JSON.stringify({
          data: dataToSend,
          title: usageDataTitle || undefined,
          format: usageDataFormat,
        }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/evidence"] });
      setUsageAnalysis(data.summary);
      toast({
        title: "Usage data analyzed",
        description: `Imported ${data.rowCount} rows and generated AI insights.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import usage data.",
        variant: "destructive",
      });
    },
  });

  const handleRemoveTag = (item: EvidenceItem, tagToRemove: string) => {
    const updatedTags = (item.tags || []).filter((t) => t !== tagToRemove);
    updateTagsMutation.mutate({ id: item.id, tags: updatedTags });
  };

  const parsedPreview = (() => {
    if (!usageDataInput.trim()) return null;
    try {
      if (usageDataFormat === "json") {
        const parsed = JSON.parse(usageDataInput);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        return { headers: Object.keys(items[0] || {}), rows: items.slice(0, 5) };
      } else {
        const lines = usageDataInput.split("\n").filter((l) => l.trim());
        if (lines.length < 2) return null;
        const headers = lines[0].split(",").map((h) => h.trim());
        const rows = lines.slice(1, 6).map((line) => {
          const values = line.split(",").map((v) => v.trim());
          const row: any = {};
          headers.forEach((h, i) => { row[h] = values[i] || ""; });
          return row;
        });
        return { headers, rows };
      }
    } catch {
      return null;
    }
  })();

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evidence Library</h1>
          <p className="text-sm text-gray-500 mt-1">
            All your research artifacts — transcripts, notes, uploaded files, and usage data
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setActiveTab("usage-import")} variant="outline" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Import Usage Data
          </Button>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4" />
            Add Note
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mb-4 w-fit">
          <TabsTrigger value="library" className="gap-2">
            <Archive className="h-4 w-4" />
            Library
          </TabsTrigger>
          <TabsTrigger value="usage-import" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Import Usage Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usage-import" className="flex-1 min-h-0">
          <div className="grid md:grid-cols-2 gap-6 h-full">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Title (optional)</label>
                <Input
                  value={usageDataTitle}
                  onChange={(e) => setUsageDataTitle(e.target.value)}
                  placeholder="e.g., Weekly Feature Usage Report"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={usageDataFormat === "csv" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUsageDataFormat("csv")}
                  className="gap-1"
                >
                  <Table className="h-3.5 w-3.5" />
                  CSV
                </Button>
                <Button
                  variant={usageDataFormat === "json" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUsageDataFormat("json")}
                  className="gap-1"
                >
                  {"{ }"}
                  JSON
                </Button>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Paste your data</label>
                <Textarea
                  value={usageDataInput}
                  onChange={(e) => setUsageDataInput(e.target.value)}
                  placeholder={usageDataFormat === "csv"
                    ? "feature_name,usage_count,user_segment,date\nDashboard,1250,enterprise,2025-01-15\nReports,340,smb,2025-01-15\nAPI Access,89,enterprise,2025-01-15"
                    : '[{"feature": "Dashboard", "usage_count": 1250, "segment": "enterprise"}]'}
                  rows={10}
                  className="font-mono text-xs"
                />
              </div>

              {parsedPreview && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 flex items-center gap-2">
                    <Table className="h-3.5 w-3.5" />
                    Preview ({parsedPreview.rows.length} rows shown)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-gray-50/50">
                          {parsedPreview.headers.map((h) => (
                            <th key={h} className="px-3 py-1.5 text-left font-medium text-gray-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedPreview.rows.map((row, i) => (
                          <tr key={i} className="border-b last:border-0">
                            {parsedPreview.headers.map((h) => (
                              <td key={h} className="px-3 py-1.5 text-gray-700">{String(row[h] || "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <Button
                onClick={() => usageImportMutation.mutate()}
                disabled={!usageDataInput.trim() || usageImportMutation.isPending}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {usageImportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {usageImportMutation.isPending ? "Analyzing with AI..." : "Analyze & Import"}
              </Button>
            </div>

            <div>
              {usageAnalysis ? (
                <Card className="h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <h3 className="font-semibold text-sm text-gray-900">AI Analysis</h3>
                    </div>
                    <ScrollArea className="h-[400px]">
                      <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-xs">
                        {usageAnalysis}
                      </div>
                    </ScrollArea>
                    <div className="mt-4 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => {
                          setUsageAnalysis(null);
                          setUsageDataInput("");
                          setUsageDataTitle("");
                          setActiveTab("library");
                        }}
                      >
                        <Archive className="h-3.5 w-3.5" />
                        View in Evidence Library
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full flex items-center justify-center border-dashed">
                  <CardContent className="text-center p-8">
                    <BarChart3 className="h-12 w-12 text-purple-200 mx-auto mb-4" />
                    <h3 className="text-base font-medium text-gray-500 mb-2">AI-Powered Analysis</h3>
                    <p className="text-xs text-gray-400 max-w-xs mx-auto">
                      Paste your product usage data (CSV or JSON) and our AI will identify patterns, underused features, drop-off points, and growth opportunities.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="library" className="flex-1 min-h-0 flex flex-col">

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search evidence..."
            className="pl-9"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        {searchQuery.trim() && searchMode === "keyword" && (
          <Badge
            variant="outline"
            className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700"
            data-testid="badge-keyword-search-mode"
          >
            Keyword search only — semantic search unavailable
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              {SOURCE_OPTIONS.find((s) => s.value === sourceFilter)?.label || "All Sources"}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {SOURCE_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt.value} onClick={() => setSourceFilter(opt.value)}>
                <opt.icon className="h-4 w-4 mr-2" />
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {allTags.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Tag className="h-4 w-4" />
                {tagFilter || "All Tags"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setTagFilter("")}>All Tags</DropdownMenuItem>
              {allTags.map((tag) => (
                <DropdownMenuItem key={tag} onClick={() => setTagFilter(tag)}>
                  {tag}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {(sourceFilter !== "all" || tagFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSourceFilter("all"); setTagFilter(""); }}
            className="text-gray-500"
          >
            <X className="h-3 w-3 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>

      <div className="text-xs text-gray-400 mb-3">
        {displayItems.length} item{displayItems.length !== 1 ? "s" : ""}
        {searchQuery && " matching search"}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading evidence...</span>
        </div>
      ) : displayItems.length === 0 ? (
        <Card className="flex-1 flex items-center justify-center border-dashed">
          <CardContent className="text-center p-8">
            <Archive className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-2">No evidence items yet</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-4">
              Add notes manually, import meeting transcripts, upload files, or analyze usage data to build your evidence library.
            </p>
            <Button onClick={() => setShowAddDialog(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add your first note
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {displayItems.map((item) => {
              const SourceIcon = SOURCE_OPTIONS.find((s) => s.value === item.source)?.icon || FileText;
              const colorClass = SOURCE_COLORS[item.source] || "bg-gray-100 text-gray-700 border-gray-200";

              return (
                <Card key={item.id} className="group hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colorClass}`}>
                          <SourceIcon className="h-3 w-3 mr-1" />
                          {item.source}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingTags(item)}
                          className="p-1 rounded hover:bg-gray-100"
                          title="Edit tags"
                        >
                          <Tag className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="p-1 rounded hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-medium text-sm text-gray-900 mb-1 line-clamp-1">{item.title}</h4>
                    <p className="text-xs text-gray-500 line-clamp-3 mb-3">{item.content}</p>

                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {item.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-gray-400">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                      </div>
                      {(item.mentionCount ?? 1) > 1 && (
                        <Badge
                          variant="secondary"
                          className={`text-[10px] gap-0.5 px-1.5 py-0 ${
                            (item.mentionCount ?? 1) >= 3
                              ? "bg-orange-100 text-orange-700 border-orange-200"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          <Flame className="h-2.5 w-2.5" />
                          {item.mentionCount}x mentioned
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
        </TabsContent>
      </Tabs>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Evidence Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Title</label>
              <Input
                value={newNote.title}
                onChange={(e) => setNewNote((n) => ({ ...n, title: e.target.value }))}
                placeholder="e.g., Customer interview with Acme Corp"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Content</label>
              <Textarea
                value={newNote.content}
                onChange={(e) => setNewNote((n) => ({ ...n, content: e.target.value }))}
                placeholder="Paste transcript, notes, or observations..."
                rows={6}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Tags (comma-separated)</label>
              <Input
                value={newNote.tags}
                onChange={(e) => setNewNote((n) => ({ ...n, tags: e.target.value }))}
                placeholder="e.g., customer-feedback, onboarding, pain-point"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({
                title: newNote.title,
                content: newNote.content,
                source: "note",
                tags: newNote.tags.split(",").map((t) => t.trim()).filter(Boolean),
              })}
              disabled={!newNote.title.trim() || !newNote.content.trim() || createMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTags} onOpenChange={(open) => { if (!open) { setEditingTags(null); setNewTagInput(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Tags — {editingTags?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {editingTags?.tags && editingTags.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {editingTags.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                    {tag}
                    <button onClick={() => handleRemoveTag(editingTags, tag)} className="ml-0.5 hover:text-red-600">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="Add a tag..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editingTags) {
                    e.preventDefault();
                    handleAddTag(editingTags);
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => editingTags && handleAddTag(editingTags)}
                disabled={!newTagInput.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EvidencePage;
