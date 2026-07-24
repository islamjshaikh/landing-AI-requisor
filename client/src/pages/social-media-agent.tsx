// Force rebuild: resolving stale import error
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import axios from "axios";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, addDays, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, isSameMonth, addWeeks, subWeeks, isSameYear } from "date-fns";
import {
  Upload, X, CheckCircle, Check, ExternalLink, Instagram, Paperclip, Calendar as CalendarIcon, Edit, Trash2, Send, Eye, Layout, PenTool, Settings, Loader2, Search,
  Filter,
  MoreVertical,
  CheckCircle2,
  Clock, // Added Clock import
  Sparkles, AlertCircle, Edit2, Sliders, RefreshCw, MessageSquare, Plus, Sidebar, ChevronLeft, ChevronRight
} from "lucide-react";
import { FaTwitter, FaFacebook, FaLinkedin } from "react-icons/fa";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TypeAnimation } from "react-type-animation";
import { useAuth } from "@/hooks/useAuth.tsx";

/* ========================
   CONFIG
======================== */
const API_BASE = "/api";
const SITE_BASE = window.location.origin;

const ENABLE_MEDIA_UPLOAD = true;

/* ========================
   TYPES
======================== */
type ConnectedMap = Record<string, boolean>;


/* ========================
   HELPERS
======================== */
// --- robust parser for any nesting + handles string responses ---
function extractFinalContent(apiPayload: any, platform: string) {
  // Support raw string payloads (e.g., content-type text/plain)
  const payload =
    typeof apiPayload === "string"
      ? (() => {
        try {
          return JSON.parse(apiPayload);
        } catch {
          return {}; // not JSON, bail gracefully
        }
      })()
      : apiPayload;

  // Handle nested results
  const deep = payload?.result?.result ?? payload?.result ?? payload;

  // Handle new external CrewAI service response format
  if (deep?.output) return { content: deep.output, tasks: [] };

  if (typeof deep === "string") {
    return { content: deep, tasks: [] };
  }

  const raw: string = deep?.raw ?? "";
  const tasks: any[] = Array.isArray(deep?.tasks_output)
    ? deep.tasks_output
    : [];

  // Prefer Tone Adjuster; else last task with raw; else top-level raw
  const toneAdjuster = tasks.find(
    (t) => (t?.agent || "").toLowerCase() === "tone adjuster",
  );
  let content: string =
    toneAdjuster?.raw ??
    [...tasks].reverse().find((t) => typeof t?.raw === "string" && t.raw.trim())
      ?.raw ??
    raw ??
    "";

  // Platform-specific post-processing
  if (platform === "Mastodon" && content.length > 500) {
    content = content.slice(0, 497) + "...";
  }
  if (platform === "Twitter" && content.length > 280) {
    content = content.slice(0, 277) + "...";
  }

  return { content, tasks };
}

// --- Smart Content Extractor ---
function extractPostContent(text: string): string {
  if (!text) return "";

  // 1. Try to extract content between quotes if it looks like a post
  const quoteMatch = text.match(/"([^"]{15,})"/);
  if (quoteMatch && quoteMatch[1]) {
    return quoteMatch[1];
  }

  // 2. Try to extract after "Subject:" or "Title:"
  const subjectMatch = text.match(/^(?:Subject:|Title:)\s*(.+)$/m);
  if (subjectMatch && subjectMatch[1]) {
    return text.replace(/^(?:Subject:|Title:).+$/m, '').trim();
  }

  // 3. Try to strip common conversational prefixes
  const conversationalPrefixes = [
    "Here's a draft:", "Here is a draft:", "Here is the draft:",
    "Draft:", "Here's a draft for", "Here is a draft for"
  ];

  for (const prefix of conversationalPrefixes) {
    const idx = text.toLowerCase().indexOf(prefix.toLowerCase());
    if (idx !== -1) {
      // Return everything after the prefix (and potentially a newline)
      let content = text.substring(idx + prefix.length).trim();
      // Remove leading colon if present (e.g. "Here's a draft: ...")
      if (content.startsWith(":")) content = content.substring(1).trim();
      return content;
    }
  }

  // 4. Fallback: Return the whole text if no clear structure found
  return text.trim();
}

function isLikelyPost(text: string): boolean {
  if (!text) return false;

  // 1. Check for hashtags (strong indicator)
  if (/#\w+/.test(text)) return true;

  // 2. Check for quoted blocks (often used for drafts)
  // Must be reasonably long to avoid quoting single words
  if (/"[^"]{15,}"/.test(text)) return true;

  // 3. Check for specific draft indicators like "Subject:" or "Title:" (common for LinkedIn/Email)
  if (/^(Subject:|Title:)/m.test(text)) return true;

  // 4. Check for conversational draft indicators (Relaxed logic)
  const lower = text.toLowerCase();
  if (lower.includes("here's a draft") ||
    lower.includes("here is a draft") ||
    lower.includes("here is the draft") ||
    lower.includes("draft for") ||
    lower.includes("create a draft") ||
    lower.includes("created a draft")) {
    return true;
  }

  return false;
}

/* ========================
   MAIN COMPONENT
======================== */
/* ========================
   CALENDAR COMPONENT
   ======================== */
const SocialCalendar = ({ posts, onPostUpdate }: { posts: any[], onPostUpdate: () => void }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [editedContent, setEditedContent] = useState(""); // Initialized to empty string as 'draft' is not in scope
  const [isDayDetailsOpen, setIsDayDetailsOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dayDetailsDate, setDayDetailsDate] = useState<Date | null>(null);

  const next = () => {
    if (view === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const prev = () => {
    if (view === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const jumpToToday = () => setCurrentDate(new Date());

  const getCalendarDays = () => {
    try {
      if (view === 'month') {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        return eachDayOfInterval({ start: startDate, end: endDate });
      } else {
        // Week view
        const startDate = startOfWeek(currentDate);
        const endDate = endOfWeek(currentDate);
        return eachDayOfInterval({ start: startDate, end: endDate });
      }
    } catch (e) {
      console.error("Error generating calendar days:", e);
      const now = new Date();
      return eachDayOfInterval({
        start: startOfWeek(now),
        end: endOfWeek(now),
      });
    }
  };

  const calendarDays = getCalendarDays();

  const safeDate = (dateStr: any) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const safeFormat = (date: any, fmt: string) => {
    try {
      return format(date, fmt);
    } catch (e) {
      return "";
    }
  };

  const getPlatformDotColor = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case "twitter": return "bg-sky-500";
      case "facebook": return "bg-blue-600";
      case "linkedin": return "bg-indigo-600";
      case "mastodon": return "bg-purple-600";
      default: return "bg-slate-500";
    }
  };

  const handlePostClick = (post: any) => {
    setSelectedPost(post);
    setIsDialogOpen(true);
  };

  const handleShowMoreClick = (date: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    setDayDetailsDate(date);
    setIsDayDetailsOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedPost) return;
    if (!confirm("Are you sure you want to delete this scheduled post?")) return;

    try {
      await axios.delete(`${API_BASE}/schedule/${selectedPost.id}`);
      onPostUpdate();
      setIsDialogOpen(false);
      // Also close day details if open and this was the last post (optional, but good UX)
    } catch (error) {
      console.error("Failed to delete post:", error);
      alert("Failed to delete post.");
    }
  };

  // Header Title Logic
  const headerTitle = useMemo(() => {
    if (view === 'month') {
      return safeFormat(currentDate, "MMMM yyyy");
    } else {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      // If same month: "Jan 1 - 7, 2024"
      // If diff month: "Jan 29 - Feb 4, 2024"
      // If diff year: "Dec 30, 2023 - Jan 5, 2024"
      if (isSameMonth(start, end)) {
        return `${safeFormat(start, "MMM d")} - ${safeFormat(end, "d, yyyy")}`;
      } else if (isSameYear(start, end)) {
        return `${safeFormat(start, "MMM d")} - ${safeFormat(end, "MMM d, yyyy")}`;
      } else {
        return `${safeFormat(start, "MMM d, yyyy")} - ${safeFormat(end, "MMM d, yyyy")}`;
      }
    }
  }, [currentDate, view]);


  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mt-8">
      {/* Header / Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Content Calendar</h2>
        </div>

        <div className="flex items-center gap-3 bg-gray-50/50 p-1.5 rounded-xl border border-gray-100">
          <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${view === 'month' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Month
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${view === 'week' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Week
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200 mx-1"></div>

          <div className="flex items-center gap-2">
            <button onClick={prev} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-gray-600 transition-all border border-transparent hover:border-gray-200">
              <span className="sr-only">Previous</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <button onClick={jumpToToday} className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
              Today
            </button>
            <span className="text-sm font-semibold text-gray-900 min-w-[140px] text-center">
              {headerTitle}
            </span>
            <button onClick={next} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-gray-600 transition-all border border-transparent hover:border-gray-200">
              <span className="sr-only">Next</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className={`grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200 shadow-inner`}>
        {/* Day Headers */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="bg-gray-50/80 backdrop-blur-sm p-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {day}
          </div>
        ))}

        {/* Calendar Cells */}
        {calendarDays.map((day, idx) => {
          const dayPosts = posts.filter((post) => {
            const d = safeDate(post.scheduledTime || post.executedAt);
            return d && isSameDay(d, day);
          });
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          // Truncation Logic
          const MAX_VISIBLE_POSTS = view === 'month' ? 3 : 10; // Show more in week view
          const visiblePosts = dayPosts.slice(0, MAX_VISIBLE_POSTS);
          const hiddenCount = dayPosts.length - MAX_VISIBLE_POSTS;

          return (
            <div
              key={idx}
              className={`
                bg-white p-2 transition-all relative group
                ${view === 'month' ? 'min-h-[120px]' : 'min-h-[300px]'}
                ${!isCurrentMonth && view === 'month' ? "bg-gray-50/50" : ""}
                ${isToday ? "bg-blue-50/30" : "hover:bg-gray-50/30"}
              `}
            >
              {isToday && <div className="absolute top-0 right-0 w-0 h-0 border-l-[12px] border-l-transparent border-t-[12px] border-t-blue-500/50"></div>}

              <div className={`text-xs font-semibold mb-2 flex justify-between items-center ${isToday ? "text-blue-600" : !isCurrentMonth && view === 'month' ? "text-gray-300" : "text-gray-500"}`}>
                <span className={`w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-blue-600 text-white shadow-md shadow-blue-200" : ""}`}>
                  {safeFormat(day, "d")}
                </span>
                {dayPosts.length > 0 && <span className="text-[9px] font-normal text-gray-300">{dayPosts.length} posts</span>}
              </div>

              <div className="space-y-1.5">
                {visiblePosts.map((post, pIdx) => (
                  <div
                    key={pIdx}
                    onClick={() => handlePostClick(post)}
                    className={`
                      text-[10px] p-1.5 rounded-md border flex items-center gap-1.5 cursor-pointer transition-all shadow-sm hover:shadow-md hover:scale-[1.02] hover:z-10 bg-white
                      ${post.status === 'published' ? 'border-green-100 bg-green-50/20' : 'border-gray-100'}
                    `}
                    title={`${post.platform}: ${post.topic}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getPlatformDotColor(post.platform)}`}></div>
                    <span className="truncate font-medium text-gray-700 leading-tight">{post.topic || "Untitled"}</span>
                  </div>
                ))}

                {hiddenCount > 0 && (
                  <button
                    onClick={(e) => handleShowMoreClick(day, e)}
                    className="w-full text-[10px] font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-700 py-1 rounded-sm transition-colors flex items-center justify-center gap-1"
                  >
                    <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                    <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                    <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                    <span className="ml-1">+{hiddenCount} more</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Post Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-xl border-gray-200 shadow-2xl">
          <DialogHeader className="border-b border-gray-100 pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              {selectedPost && (
                <div className={`p-2 rounded-lg ${getPlatformColor(selectedPost.platform)}`}>
                  {getPlatformIcon(selectedPost.platform)}
                </div>
              )}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                {selectedPost?.status === 'published' ? 'Published Post' : 'Scheduled Post'}
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedPost && (
            <div className="space-y-5 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Time</span>
                <span className="col-span-3 font-medium text-gray-700 font-mono text-sm">
                  {(() => {
                    const d = safeDate(selectedPost.scheduledTime || selectedPost.executedAt);
                    return d ? format(d, "PPP 'at' p") : "Invalid Date";
                  })()}
                </span>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Topic</span>
                <span className="col-span-3 text-sm font-medium text-gray-900">
                  {selectedPost.topic}
                </span>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Content</span>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-600 leading-relaxed max-h-[200px] overflow-y-auto">
                  {selectedPost.content || selectedPost.preGeneratedContent || selectedPost.result || selectedPost.text || selectedPost.message || "No content available."}
                </div>
              </div>

              {selectedPost.status === 'published' && selectedPost.url && (
                <div className="flex justify-end">
                  <a href={selectedPost.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    View Live Post <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="sm:justify-between border-t border-gray-100 pt-4">
            {selectedPost?.status !== 'published' ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 border-none shadow-none"
              >
                <Trash2 size={14} />
                Cancel Post
              </Button>
            ) : (
              <div></div> // Spacer
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsDialogOpen(false)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day Details Dialog (For "+ More") */}
      <Dialog open={isDayDetailsOpen} onOpenChange={setIsDayDetailsOpen}>
        <DialogContent className="sm:max-w-lg bg-white/95 backdrop-blur-xl border-gray-200 shadow-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="border-b border-gray-100 pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl text-gray-800">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <CalendarIcon size={20} />
              </div>
              {dayDetailsDate && safeFormat(dayDetailsDate, "EEEE, MMMM do, yyyy")}
              <span className="text-sm font-normal text-gray-400 ml-auto">
                {dayDetailsDate && posts.filter(p => isSameDay(safeDate(p.scheduledTime || p.executedAt)!, dayDetailsDate)).length} posts
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-3">
            {dayDetailsDate && posts
              .filter(post => {
                const d = safeDate(post.scheduledTime || post.executedAt);
                return d && isSameDay(d, dayDetailsDate);
              })
              .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
              .map((post, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setIsDayDetailsOpen(false); // Close list
                    handlePostClick(post); // Open single post detail
                  }}
                  className="p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer group flex gap-3 items-start"
                >
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${getPlatformDotColor(post.platform)}`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-gray-800 text-sm truncate">{post.topic || "Untitled"}</h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {post.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {post.content || post.preGeneratedContent || "No preview"}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">
                        <Clock size={10} />
                        {safeFormat(new Date(post.scheduledTime), "h:mm a")}
                      </span>
                      {getPlatformIcon(post.platform)}
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
          <DialogFooter className="border-t border-gray-100 pt-4">
            <Button
              variant="secondary"
              onClick={() => setIsDayDetailsOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ========================
   MAIN COMPONENT
   ======================== */
// Inline Draft Card Component
interface InlineDraftCardProps {
  draft: Draft;
  index: number;
  connectedAccounts: ConnectedMap;
  onConfirm: (finalContent: string, selectedPlatforms: string[], mediaFiles: File[]) => void;
  onSchedule: (finalContent: string, scheduleData: { platform: string, time: string }[], mediaFiles: File[], draftId?: string, topic?: string) => void;
  onUpdate: (id: string, updates: any) => void;
  onDelete?: (index: number) => void;
  onCancel: () => void;
  isPublished?: boolean;
}

const InlineDraftCard = ({ draft, index, onUpdate, onDelete, onSchedule, connectedAccounts, onConfirm, onCancel, isPublished }: InlineDraftCardProps) => {
  const [mediaFiles, setMediaFiles] = useState<File[]>([]); // Restored state
  const [localDraftContent, setLocalDraftContent] = useState(draft.content || "");


  // Initialize with currently connected accounts
  const [platforms, setPlatforms] = useState<Record<string, boolean>>({
    facebook: !!connectedAccounts.facebook,
    twitter: !!connectedAccounts.twitter,
    linkedin: !!connectedAccounts.linkedin,
    mastodon: !!connectedAccounts.mastodon
  });

  const [pickerTime, setPickerTime] = useState("");
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null); // Track which platform shows tooltip

  // Sync content when initialContent changes (e.g. AI generates new draft)
  useEffect(() => {
    setLocalDraftContent(draft.content);
  }, [draft.content]);

  // REMOVED: Auto-select effect that was overriding user choice
  // Platforms are now initialized once, preserving user toggles.

  // Sync scheduled time if present
  useEffect(() => {
    if (draft.scheduledTime) {
      setPickerTime(new Date(draft.scheduledTime).toISOString().slice(0, 16));
    }
  }, [draft.scheduledTime]);

  const handlePlatformChange = (platform: keyof typeof platforms) => {
    // Prevent selecting unconnected platforms
    const isConnected =
      platform === 'twitter' ? connectedAccounts.twitter :
        platform === 'facebook' ? connectedAccounts.facebook :
          platform === 'linkedin' ? connectedAccounts.linkedin :
            platform === 'mastodon' ? connectedAccounts.mastodon : false;

    if (!isConnected) {
      // Show tooltip for this specific platform
      setActiveTooltip(platform);
      // Auto-hide after 3 seconds
      setTimeout(() => setActiveTooltip(null), 3000);
      return;
    }

    setPlatforms((prev) => ({ ...prev, [platform]: !prev[platform] }));
  };

  const handleScheduleAction = () => {
    // Collect all schedule data from draft.scheduledTime and active platforms
    if (!draft.scheduledTime) {
      alert("Please schedule a time using the calendar button first.");
      return;
    }

    const activePlatforms = Object.keys(platforms).filter(p => platforms[p as keyof typeof platforms]);
    const scheduleData = activePlatforms.map(p => ({
      platform: p.charAt(0).toUpperCase() + p.slice(1),
      time: draft.scheduledTime!
    }));

    if (scheduleData.length === 0) {
      alert("Please select at least one platform.");
      return;
    }

    // Call onSchedule directly
    onSchedule(localDraftContent, scheduleData, mediaFiles, draft.id, draft.topic);
  };
  const handleConfirm = () => {
    const selectedPlatforms = Object.entries(platforms)
      .filter(([_, selected]) => selected)
      .map(([platform]) => platform === 'twitter' ? 'Twitter' : platform === 'facebook' ? 'Facebook' : platform === 'linkedin' ? 'LinkedIn' : 'Mastodon');

    if (selectedPlatforms.length === 0) {
      alert("Please select at least one platform.");
      return;
    }
    // Pass mediaFiles if any
    onConfirm(localDraftContent, selectedPlatforms, mediaFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const valid = files.filter((f) => {
      const okType = f.type.startsWith("image/");
      const okSize = f.size <= 5 * 1024 * 1024; // 5MB limit
      return okType && okSize;
    });

    if (valid.length !== files.length) {
      alert("Some files were rejected. Accepted: images only. Max 5MB each.");
    }

    setMediaFiles((prev) => [...prev, ...valid]);
    e.currentTarget.value = "";
  };

  const removeMedia = (idx: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className={`w-full min-w-full max-w-none bg-white/80 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-[0_8px_32px_rgba(37,99,235,0.08)] my-6 ring-1 ring-blue-900/5`}>
      <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-slate-50/80 p-4 border-b border-blue-100/50 flex flex-col gap-3 relative overflow-hidden">
        {/* Futuristic Glow Effect */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-500/5 to-transparent pointer-events-none"></div>

        <div className="flex items-center gap-3 z-10">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            <div className="absolute top-0 left-0 w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping opacity-20"></div>
          </div>
          <h3 className="text-blue-600 font-bold text-sm tracking-[0.15em] uppercase drop-shadow-sm">
            Draft Generated
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-blue-600/80 font-mono border border-blue-200/50 rounded-full px-3 py-1 bg-white/60 w-fit z-10 shadow-sm">
            {draft.topic ? `TOPIC: ${draft.topic.toUpperCase()}` : 'NEW POST'}
          </div>
          {draft.scheduledTime && !isNaN(new Date(draft.scheduledTime).getTime()) ? (
            <div className="text-xs text-orange-600/80 font-mono border border-orange-200/50 rounded-full px-3 py-1 bg-white/60 w-fit z-10 shadow-sm flex items-center gap-1">
              <CalendarIcon size={12} />
              {new Date(draft.scheduledTime).toLocaleString()}
            </div>
          ) : (
            <div className="text-xs text-slate-500/80 font-mono border border-slate-200/50 rounded-full px-3 py-1 bg-white/60 w-fit z-10 shadow-sm flex items-center gap-1">
              <CalendarIcon size={12} />
              NOT SCHEDULED
            </div>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(index)}
              className="p-1.5 rounded-full bg-white/60 hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors border border-transparent hover:border-red-100 z-10"
              title="Delete draft"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold ml-1">Content</label>
            <span className="text-[10px] text-slate-400 italic">Feel free to edit the content directly</span>
          </div>
          <textarea
            value={localDraftContent}
            onChange={(e) => {
              setLocalDraftContent(e.target.value);
              onUpdate(draft.id, { content: e.target.value });
            }}
            disabled={isPublished}
            className={`w-full bg-slate-50/50 border border-slate-200 rounded-xl p-5 text-slate-700 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all resize-y min-h-[400px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent shadow-inner ${isPublished ? 'opacity-70 cursor-not-allowed' : ''}`}
            placeholder="Edit your content here..."
          />

          {/* Media Attachments */}
          <div className="flex flex-wrap gap-2 mt-2">
            {mediaFiles.map((file, idx) => (
              <div key={idx} className="relative group">
                <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shadow-sm">
                  <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                </div>
                <button
                  onClick={() => removeMedia(idx)}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <X size={10} />
                </button>
              </div>
            ))}

            <label className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 border-dashed rounded-lg cursor-pointer transition-all group">
              <Upload size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-slate-600">Add Image</span>
              <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleFileSelect} multiple />
            </label>
            <span className="text-[10px] text-slate-400 self-center">Max 5MB (JPG/PNG)</span>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold ml-1">Select Platforms</label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(platforms).map((p) => {
                const isConnected =
                  p === 'twitter' ? connectedAccounts.twitter :
                    p === 'facebook' ? connectedAccounts.facebook :
                      p === 'linkedin' ? connectedAccounts.linkedin :
                        p === 'mastodon' ? connectedAccounts.mastodon : false;

                return (
                  <div
                    key={p}
                    onClick={() => handlePlatformChange(p as keyof typeof platforms)}
                    className={`
                  relative group flex items-center justify-center w-10 h-10 rounded-full cursor-pointer transition-all duration-300
                  ${platforms[p as keyof typeof platforms]
                        ? 'bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-[0_4px_12px_rgba(59,130,246,0.3)] scale-110'
                        : 'bg-slate-100 hover:bg-slate-200 border border-slate-200'
                      }
`}
                  >
                    {/* Tooltip for unconnected platforms */}
                    {activeTooltip === p && (
                      <div className="absolute bottom-full mb-2 w-max px-3 py-1.5 bg-gray-900 text-white text-[10px] font-medium rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-1 z-50 pointer-events-none">
                        Go to Accounts tab to connect
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    )}

                    {platforms[p as keyof typeof platforms] && (
                      <div className="absolute -top-1 -right-1 bg-white text-blue-600 rounded-full p-0.5 shadow-sm border border-blue-100">
                        <CheckCircle size={10} fill="currentColor" className="text-white" />
                      </div>
                    )}

                    <div className={`transition-colors ${platforms[p as keyof typeof platforms] ? 'text-white' : 'text-slate-400'}`}>
                      {p === 'twitter' && <FaTwitter size={18} />}
                      {p === 'facebook' && <FaFacebook size={18} />}
                      {p === 'linkedin' && <FaLinkedin size={18} />}
                      {p === 'mastodon' && <span className="text-lg font-bold">M</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(localDraftContent);
              alert("Content copied to clipboard!");
            }}
            className="text-slate-500 hover:text-blue-600 text-xs h-8"
          >
            <Paperclip className="w-3 h-3 mr-1.5" />
            Copy Text
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-3 p-4 bg-slate-50/80 border-t border-blue-100/50 backdrop-blur-sm">
        <div className="flex gap-3">
          <Popover open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={isPublished}
                className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 px-6 py-6 rounded-xl transition-all duration-300 font-medium"
              >
                <CalendarIcon size={20} className="mr-2" />
                Schedule
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 bg-white/95 backdrop-blur-xl border-blue-100 shadow-xl rounded-xl" align="end">
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                  <CalendarIcon size={16} className="text-blue-500" />
                  Schedule Post
                </h4>

                <div className="space-y-3">
                  <div className="space-y-1.5 p-3 rounded-lg border bg-slate-50 border-slate-200">
                    <label className="text-xs font-medium text-slate-600 block mb-1">Select Date & Time</label>
                    <input
                      type="datetime-local"
                      className="w-full text-sm p-2.5 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 font-medium"
                      value={pickerTime}
                      onChange={(e) => setPickerTime(e.target.value)}
                      min={new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 italic px-1">
                    This time will apply to all selected platforms.
                  </p>
                </div>

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 mt-4"
                  onClick={() => {
                    if (!pickerTime) {
                      alert("Please select a date and time");
                      return;
                    }

                    // Update the draft metadata with the selected time
                    const displayTime = new Date(pickerTime).toISOString();
                    onUpdate(draft.id, { scheduledTime: displayTime });
                    setIsScheduleOpen(false);
                  }}
                >
                  Confirm Schedule
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Approve Schedule Button */}
          {draft.scheduledTime && (
            <Button
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-6 rounded-xl transition-all duration-300 font-medium shadow-sm hover:shadow-md"
              onClick={() => {
                // Determine which platforms to schedule for
                // Priority:
                // 1. Explicitly set time in popover (scheduleTimes)
                // 2. Selected platforms (platforms state) with draft.scheduledTime

                let finalScheduleData: { platform: string, time: string }[] = [];

                // Use the scheduled time from the draft
                if (draft.scheduledTime) {
                  // 1. Identify which platforms are currently "active" in the UI toggles
                  const activePlatforms = Object.keys(platforms).filter(p => platforms[p as keyof typeof platforms]);

                  // 2. Map to schedule data
                  finalScheduleData = activePlatforms.map(p => ({
                    platform: p.charAt(0).toUpperCase() + p.slice(1),
                    time: draft.scheduledTime!
                  }));
                }

                if (finalScheduleData.length === 0) {
                  alert("Please select at least one connected platform to schedule.");
                  return;
                }

                // Trigger animation
                // setIsApproving(true); REMOVED

                // Wait for animation then schedule
                onSchedule(localDraftContent, finalScheduleData, mediaFiles, draft.id, draft.topic);
              }}
            >
              <CheckCircle size={20} className="mr-2" />
              Approve Schedule
            </Button>
          )}

          <Button
            onClick={handleConfirm}
            disabled={isPublished}
            className={`
bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500
text-white shadow-[0_4px_20px_rgba(37,99,235,0.25)] border-none px-8 py-6 rounded-xl
transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_25px_rgba(37,99,235,0.35)]
font-medium tracking-wide
              ${isPublished ? 'opacity-50 cursor-not-allowed grayscale' : ''}
`}
          >
            {isPublished ? (
              <>
                <CheckCircle className="mr-2 h-5 w-5 animate-bounce" />
                Published!
              </>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                Publish Now
              </>
            )}
          </Button>
        </div>
      </div>
    </div >
  );
}

// --- Draft Carousel Component ---
interface Draft {
  id: string;
  content: string;
  topic?: string;
  scheduledTime?: string;
}

interface DraftCarouselProps {
  drafts: Draft[];
  connectedAccounts: ConnectedMap;
  onConfirm: (content: string, platforms: string[], mediaFiles: File[]) => void;
  onSchedule: (content: string, scheduleData: { platform: string, time: string }[], mediaFiles: File[], draftId?: string, topic?: string) => void;
  onEdit: (id: string, updates: any) => void;
  onSelect?: (draft: any) => void;
  onDelete?: (index: number) => void;
  onClear?: () => void;
}

const DraftCarousel = ({ drafts, connectedAccounts, onConfirm, onSchedule, onEdit, onDelete, onClear }: DraftCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fix safe index access
  const validIndex = Math.min(currentIndex, drafts.length - 1);
  const currentDraft = drafts[validIndex >= 0 ? validIndex : 0];

  // Ensure currentIndex is valid when drafts change
  useEffect(() => {
    // If we have no drafts, index doesn't matter (handled by guard clause below)
    if (drafts.length === 0) {
      setCurrentIndex(0);
      return;
    }

    // If index is now out of bounds (e.g. deleted last item), move to last valid item
    if (currentIndex >= drafts.length) {
      setCurrentIndex(Math.max(0, drafts.length - 1));
    }
  }, [drafts.length]); // Only react to length changes to avoid fighting with manual navigation



  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % drafts.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + drafts.length) % drafts.length);
  };

  if (!drafts || drafts.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto my-6">
        <div className="w-full min-w-full max-w-none bg-white/80 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-[0_8px_32px_rgba(37,99,235,0.08)] animate-fade-in ring-1 ring-blue-900/5 p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-2">
            <Sparkles size={40} className="text-blue-500 animate-pulse" />
          </div>
          <h3 className="text-2xl font-bold text-slate-700">All Caught Up!</h3>
          <p className="text-slate-500 max-w-md">
            You've scheduled all your drafts. Ready to create more? Just ask the agent to generate new content for you.
          </p>
          <div className="flex gap-3 mt-4">
            {/* Hint chips */}
            <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full border border-slate-200">
              "Write a LinkedIn post about leadership"
            </span>
            <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full border border-slate-200">
              "Create 3 tweets for product launch"
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Extra safety: If index points to nothing (rare race condition), render nothing/loader instead of crashing
  if (!currentDraft) {
    console.warn("DraftCarousel: Index points to undefined draft. Resetting...");
    // Ideally we shouldn't be here due to useEffect, but render cycles can be fast.
    // We can return null to wait for the next render cycle where useEffect fixes the index.
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto my-6">
      <div className="relative group">

        {/* Draft Count & Navigation Header */}
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-slate-500">
              Draft {currentIndex + 1} of {drafts.length}
            </div>

            {onClear && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1.5 transition-colors px-2 py-1 hover:bg-red-50 rounded"
                title="Clear all drafts"
              >
                <Trash2 size={12} />
                Clear All
              </button>
            )}
          </div>

          {drafts.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={prevSlide}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                title="Previous draft"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={nextSlide}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                title="Next draft"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Floating Desktop Navigation Buttons (kept for larger screens) */}
        {drafts.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute -left-16 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 shadow-md hover:shadow-lg transition-all z-20 hidden lg:flex items-center justify-center group"
              title="Previous draft"
            >
              <ChevronLeft size={24} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute -right-16 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 shadow-md hover:shadow-lg transition-all z-20 hidden lg:flex items-center justify-center group"
              title="Next draft"
            >
              <ChevronRight size={24} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </>
        )}

        {/* Carousel Content */}
        <div className="transform transition-transform duration-500">
          <InlineDraftCard
            key={currentDraft.id}
            draft={currentDraft}
            index={currentIndex}
            connectedAccounts={connectedAccounts}
            onConfirm={onConfirm}
            onSchedule={onSchedule}
            onDelete={onDelete}
            onUpdate={onEdit}
            onCancel={() => onClear?.()}
          />
        </div>

        {/* Pagination Dots */}
        {drafts.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {drafts.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`transition-all duration-300 rounded-full ${idx === currentIndex
                  ? "w-8 h-2 bg-blue-500"
                  : "w-2 h-2 bg-slate-200 hover:bg-blue-200"
                  }`}
                aria-label={`Go to draft ${idx + 1}`}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

const safeFormat = (date: any, fmt: string) => {
  if (!date) return "N/A";
  const d = new Date(date);
  return isNaN(d.getTime()) ? "N/A" : format(d, fmt);
};

const getPlatformIcon = (platform: string) => {
  switch (platform.toLowerCase()) {
    case "twitter": return <FaTwitter size={14} />;
    case "facebook": return <FaFacebook size={14} />;
    case "linkedin": return <FaLinkedin size={14} />;
    case "instagram": return <Instagram size={14} />;
    case "mastodon": return <span className="text-xs font-bold">M</span>;
    default: return null;
  }
};

const getPlatformColor = (platform: string) => {
  switch (platform?.toLowerCase()) {
    case "twitter": return "bg-sky-500/10 text-sky-500 border-sky-500/20 hover:bg-sky-500/20";
    case "facebook": return "bg-blue-600/10 text-blue-600 border-blue-600/20 hover:bg-blue-600/20";
    case "linkedin": return "bg-indigo-600/10 text-indigo-600 border-indigo-600/20 hover:bg-indigo-600/20";
    case "mastodon": return "bg-purple-600/10 text-purple-600 border-purple-600/20 hover:bg-purple-600/20";
    default: return "bg-slate-500/10 text-slate-500 border-slate-500/20 hover:bg-slate-500/20";
  }
};

const getPlatformDotColor = (platform: string) => {
  switch (platform?.toLowerCase()) {
    case "twitter": return "bg-sky-500";
    case "facebook": return "bg-blue-600";
    case "linkedin": return "bg-indigo-600";
    case "mastodon": return "bg-purple-600";
    default: return "bg-slate-500";
  }
};

const SocialMediaAgent = () => {
  // Authentication state
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  // -- Resize Logic --
  // Use percentage ratio for responsiveness (default 40% width to ensure proper alignment)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [panelRatio, setPanelRatio] = useState(0.4); // Start at 40% (min constraint)
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null); // This ref now points to the chat interface, not the sidebar

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback(
    (mouseMoveEvent: any) => {
      if (isResizing && sidebarRef.current) {
        // Calculate new ratio based on mouse position
        const totalWidth = window.innerWidth;
        const newWidth = mouseMoveEvent.clientX - sidebarRef.current.getBoundingClientRect().left;
        let newRatio = newWidth / totalWidth;

        // Constraints: min 40%, max 60%
        // Increased min to 40% to absolutely prevent header wrapping
        if (newRatio < 0.4) newRatio = 0.4;
        if (newRatio > 0.6) newRatio = 0.6;

        setPanelRatio(newRatio);
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // -- Chat Session Logic --
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/agent/sessions`);
      setSessions(data);
    } catch (err) {
      console.error("Failed to fetch sessions", err);
    }
  }, []);

  const handleCreateSession = () => {
    setMessages([]); // Clear current view immediately
    setActiveSessionId(null); // Reset active ID to allow new one to be created lazily on first message
    // We don't create the session on the server until the first message is sent
  };

  const handleSelectSession = async (sessionId: string) => {
    try {
      setSessionLoading(true);
      setActiveSessionId(sessionId);
      const { data: history } = await axios.get(`${API_BASE}/agent/sessions/${sessionId}`);

      // Map DB messages to UI messages
      const uiMessages = history.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        // Parse metadata if needed for complex rendering
      }));
      setMessages(uiMessages);
    } catch (err) {
      console.error("Failed to load session", err);
    } finally {
      setSessionLoading(false);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat?")) return;

    try {
      await axios.delete(`${API_BASE}/agent/sessions/${sessionId}`);

      if (activeSessionId === sessionId) {
        setMessages([]);
        setActiveSessionId(null);
      }
      await fetchSessions();
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  const handleClearAllHistory = async () => {
    if (!confirm("Are you sure you want to delete ENTIRE history? This cannot be undone.")) return;

    try {
      await axios.delete(`${API_BASE}/agent/sessions`);
      setMessages([]);
      setActiveSessionId(null);
      await fetchSessions();
    } catch (err) {
      console.error("Failed to clear history", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchSessions();
    }
  }, [isAuthenticated, fetchSessions]);
  // -----------------------
  // ------------------

  // Form state
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [platform, setPlatform] = useState("Twitter");
  const [result, setResult] = useState("");
  const [agentOutputs, setAgentOutputs] = useState<any[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Chat State
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedMap>({});

  // Facebook state
  const [facebookPages, setFacebookPages] = useState<any[]>([]);
  const [selectedFacebookPage, setSelectedFacebookPage] = useState<any>(null);

  // Twitter state
  const [twitterUsername, setTwitterUsername] = useState("");

  // Calendar/Scheduling state
  const [showScheduler, setShowScheduler] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState("");
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<
    "Calendar" | "Upcoming Posts" | "History"
  >("Calendar");

  // New UI State
  const [activeCanvasTab, setActiveCanvasTab] = useState<"editor" | "calendar" | "accounts">("editor");
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [jobHistory, setJobHistory] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<any>(null); // Added missing state
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false); // Controls the detail popup
  const [editingPost, setEditingPost] = useState<any>(null);
  const [scheduleTopicOverride, setScheduleTopicOverride] = useState("");
  const [scheduleToneOverride, setScheduleToneOverride] = useState("");
  const [showScheduleSuccessPopup, setShowScheduleSuccessPopup] = useState(false); // New success popup state

  // Compute derived state for posts
  const now = new Date();
  const upcomingPosts = scheduledPosts.filter(p => new Date(p.scheduledTime) > now);

  // Combine jobHistory (executed) with past scheduled posts (pending/missed execution)
  const historyPosts = [
    ...jobHistory,
    ...scheduledPosts.filter(p => new Date(p.scheduledTime) <= now)
  ].sort((a, b) => {
    const timeA = new Date(a.executedAt || a.scheduledTime || 0).getTime();
    const timeB = new Date(b.executedAt || b.scheduledTime || 0).getTime();
    return timeB - timeA;
  });
  const getMastoToken = () => localStorage.getItem("ma_access_token");
  const getMastoInstance = () => localStorage.getItem("ma_instance");

  // Media upload state
  const MAX_FILE_MB = 50;
  const ACCEPT = "image/*,video/*";
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedMediaUrls, setUploadedMediaUrls] = useState<string[]>([]);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successPostUrl, setSuccessPostUrl] = useState("");

  // Content preview state
  const [showContentPreview, setShowContentPreview] = useState(false);
  const [editableContent, setEditableContent] = useState("");

  // Schedule media handlers
  const [scheduleSelectedFiles, setScheduleSelectedFiles] = useState<File[]>(
    [],
  );

  // Platform Selection State
  const [showPlatformSelect, setShowPlatformSelect] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [pendingContent, setPendingContent] = useState("");

  // Chat State
  interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    action?: {
      type: "publish" | "schedule";
      platforms: string[];
      content?: string;
      scheduledTime?: Date;
    };
    draft?: {
      content: string;
      topic: string;
    };
    drafts?: Array<{ // Support multiple drafts
      id: string;
      content: string;
      topic: string;
    }>;
    success?: {
      platform: string;
      url: string;
    } | {
      platform: string;
      url: string;
    }[];
    scheduled?: {
      platform: string;
      time: string;
    }[];
    isLoading?: boolean;
    loadingType?: "publishing" | "generating";
    animate?: boolean;
  }
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [lastGeneratedContent, setLastGeneratedContent] = useState("");

  // Initialize from localStorage if available
  const [generatedDrafts, setGeneratedDrafts] = useState<Array<{ id: string, content: string, topic?: string, scheduledTime?: string }>>(() => {
    const saved = localStorage.getItem("generated_drafts");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved drafts", e);
        return [];
      }
    }
    return [];
  });

  // Persist drafts to localStorage
  useEffect(() => {
    localStorage.setItem("generated_drafts", JSON.stringify(generatedDrafts));
  }, [generatedDrafts]);

  // Persist messages to localStorage
  useEffect(() => {
    const savedMessages = localStorage.getItem("chat_messages");
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        // Convert date strings back to Date objects
        const hydrated = parsed.map((m: any) => ({
          ...m,
          action: m.action ? {
            ...m.action,
            scheduledTime: m.action.scheduledTime ? new Date(m.action.scheduledTime) : undefined
          } : undefined,
          animate: false // Disable animation for loaded messages
        }));
        setMessages(hydrated);

        // Restore drafts from history
        const lastDraftMessage = hydrated.slice().reverse().find((m: any) => m.drafts && m.drafts.length > 0);
        if (lastDraftMessage) {
          console.log("Restoring drafts from history:", lastDraftMessage.drafts);
          setGeneratedDrafts(lastDraftMessage.drafts);
          setActiveCanvasTab("editor");
        }
      } catch (e) {
        console.error("Failed to load chat messages:", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("chat_messages", JSON.stringify(messages));
  }, [messages]);

  // Persist connected accounts to localStorage
  useEffect(() => {
    const savedAccounts = localStorage.getItem("connected_accounts");
    if (savedAccounts) {
      try {
        setConnectedAccounts(JSON.parse(savedAccounts));
      } catch (e) {
        console.error("Failed to load connected accounts:", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("connected_accounts", JSON.stringify(connectedAccounts));
  }, [connectedAccounts]);

  const handleChatFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setChatFile(e.target.files[0]);
    }
  };

  // Helper to publish content to all connected platforms
  const publishContentToAll = async (contentToPublish: string, platformsOverride?: string[], mediaFiles?: File[]) => {
    setLoading(true);
    setError("");

    try {
      // Ensure platform list is initialized
      let platformsToPost: string[] = [];

      if (platformsOverride && platformsOverride.length > 0) {
        platformsToPost = platformsOverride;
      } else {
        if (connectedAccounts.twitter) platformsToPost.push("Twitter");
        if (connectedAccounts.facebook) platformsToPost.push("Facebook");
        if (connectedAccounts.linkedin) platformsToPost.push("LinkedIn");
        if (connectedAccounts.mastodon) platformsToPost.push("Mastodon");
      }

      if (platformsToPost.length === 0) {
        setError("No platforms selected or connected. Please connect at least one account.");
        setLoading(false);
        return;
      }

      // Confirmation removed as per user request
      // if (!confirm(`Are you sure you want to publish this post to ${ platformsToPost.length } platform(s): ${ platformsToPost.join(", ") }?`)) {
      //   setLoading(false);
      //   return;
      // }

      // Add posting message - use empty content to show only the loading animation
      setMessages(prev => [...prev, { role: "assistant", content: "", isLoading: true, loadingType: "publishing", animate: true }]);

      const results: string[] = [];
      const successMessages: ChatMessage[] = [];
      for (const p of platformsToPost) {
        try {
          if (p === "Twitter") {
            const form = new FormData();
            form.append("content", contentToPublish);
            const { data } = await axios.post(`${API_BASE}/twitter/publish`, form, { withCredentials: true, headers: { "Content-Type": "multipart/form-data" } });

            if (data.success) {
              results.push(`✅ Twitter: Published`);
              const newPost = {
                id: Date.now().toString() + "-tw",
                platform: "Twitter",
                topic: topic || "New Post",
                content: contentToPublish,
                executedAt: new Date().toISOString(),
                status: "published",
                url: data.data?.url || data.data?.tweetUrl || ""
              };
              setJobHistory(prev => [...prev, newPost]);

              successMessages.push({
                role: "assistant",
                content: "",
                success: {
                  platform: "Twitter",
                  url: data.data?.url || data.data?.tweetUrl || ""
                }
              });
            } else {
              throw new Error(data.error || "Unknown error");
            }

          } else if (p === "Facebook") {
            if (!selectedFacebookPage || !selectedFacebookPage.accessToken) {
              results.push(`❌ Facebook: No page selected or missing token`);
              continue;
            }
            const form = new FormData();
            form.append("content", contentToPublish);
            form.append("pageId", selectedFacebookPage.id);
            form.append("pageAccessToken", selectedFacebookPage.accessToken);

            // Append media files from draft if available, otherwise fall back to selectedFiles
            const filesToUpload = mediaFiles && mediaFiles.length > 0 ? mediaFiles : selectedFiles;
            for (const file of filesToUpload) form.append("media", file);

            // Add link URL if no media files (matching single-publish logic)
            if (filesToUpload.length === 0 && uploadedMediaUrls.length > 0) {
              form.append("linkUrl", uploadedMediaUrls[0]);
            }

            const { data } = await axios.post(`${API_BASE}/social/facebook/publish`, form, { withCredentials: true, headers: { "Content-Type": "multipart/form-data" } });

            if (data.success) {
              results.push(`✅ Facebook: Published`);
              const newPost = {
                id: Date.now().toString() + "-fb",
                platform: "Facebook",
                topic: topic || "New Post",
                content: contentToPublish,
                executedAt: new Date().toISOString(),
                status: "published",
                url: data.url || ""
              };
              setJobHistory(prev => [...prev, newPost]);

              successMessages.push({
                role: "assistant",
                content: "",
                success: {
                  platform: "Facebook",
                  url: data.url || ""
                }
              });
            } else {
              throw new Error(data.error || "Unknown error");
            }

          } else if (p === "LinkedIn") {
            const form = new FormData();
            form.append("content", contentToPublish);

            const filesToUpload = mediaFiles && mediaFiles.length > 0 ? mediaFiles : selectedFiles;
            for (const file of filesToUpload) form.append("media", file);

            const { data } = await axios.post(`${API_BASE}/social/linkedin/publish`, form, {
              withCredentials: true,
              headers: { "Content-Type": "multipart/form-data" }
            });

            if (data.success) {
              results.push(`✅ LinkedIn: Published`);
              const newPost = {
                id: Date.now().toString() + "-li",
                platform: "LinkedIn",
                topic: topic || "New Post",
                content: contentToPublish,
                executedAt: new Date().toISOString(),
                status: "published",
                url: data.url || ""
              };
              setJobHistory(prev => [...prev, newPost]);

              successMessages.push({
                role: "assistant",
                content: "",
                success: {
                  platform: "LinkedIn",
                  url: data.url || ""
                }
              });
            } else {
              throw new Error(data.error || "Unknown error");
            }

          } else if (p === "Mastodon") {
            const form = new FormData();
            form.append("status", contentToPublish);

            const filesToUpload = mediaFiles && mediaFiles.length > 0 ? mediaFiles : selectedFiles;
            for (const file of filesToUpload) form.append("media", file);
            const { data } = await axios.post(`${API_BASE}/social/mastodon/publish`, form, {
              withCredentials: true,
              headers: {
                "Content-Type": "multipart/form-data",
                "X-Mastodon-Token": getMastoToken() || "",
                "X-Mastodon-Instance": getMastoInstance() || "",
              }
            });

            if (data.success) {
              results.push(`✅ Mastodon: Published`);
              const newPost = {
                id: Date.now().toString() + "-mast",
                platform: "Mastodon",
                topic: topic || "New Post",
                content: contentToPublish,
                executedAt: new Date().toISOString(),
                status: "published",
                url: data.result?.url || ""
              };
              setJobHistory(prev => [...prev, newPost]);

              successMessages.push({
                role: "assistant",
                content: "",
                success: {
                  platform: "Mastodon",
                  url: data.result?.url || ""
                }
              });
            } else {
              throw new Error(data.error || "Unknown error");
            }
          }
        } catch (err: any) {
          console.error(`Failed to publish to ${p}: `, err);
          results.push(`❌ ${p}: Failed - ${err.message || "Unknown error"}`);
        }
      }

      // Remove loading message
      setMessages(prev => prev.filter(m => !m.isLoading));

      // Add success messages (cards)
      if (successMessages.length > 0) {
        setMessages(prev => [...prev, ...successMessages]);
      }

      // If there were failures or mixed results, show a summary text message too
      if (results.some(r => r.includes("❌")) || results.length === 0) {
        setMessages(prev => [...prev, { role: "assistant", content: results.join("\n") }]);
      }

    } catch (err: any) {
      console.error("Publish to all error:", err);
      setError(err.message || "Failed to publish to all platforms");
      setMessages(prev => prev.filter(m => !m.isLoading));
      setMessages(prev => [...prev, { role: "assistant", content: "Failed to publish content." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm("Are you sure you want to clear the chat history? This cannot be undone.")) {
      setMessages([]);
      localStorage.removeItem("chat_messages");
    }
  };

  const handleChatSubmit = async () => {
    if (!newMessage.trim() && !chatFile) return;

    const userMsg = newMessage;
    const fileMsg = chatFile ? `[Attached file: ${chatFile.name}]` : "";
    const fullUserMsg = [userMsg, fileMsg].filter(Boolean).join(" ");

    setNewMessage("");
    setChatFile(null);
    setMessages(prev => [...prev, { role: "user", content: fullUserMsg }]);
    setChatLoading(true);

    try {
      // Add a temporary loading message for the assistant
      setMessages(prev => [...prev, { role: "assistant", content: "", isLoading: true, animate: true }]);

      const { data } = await axios.post(`${API_BASE}/agent/process`, {
        prompt: fullUserMsg,
        sessionId: activeSessionId, // Send current session ID if it exists
        currentDraftsContext: generatedDrafts, // Send current drafts for context sync
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Send user's timezone
      }, { withCredentials: true });

      console.log("DEBUG: Agent response data:", data);

      // Update active session ID if this was a new chat initiated
      if (data.sessionId && data.sessionId !== activeSessionId) {
        setActiveSessionId(data.sessionId);
        fetchSessions(); // Refresh list to show new title
      }

      setMessages((prev) => {
        // Replace the temporary loading message with the actual response
        const newHistory = prev.slice(0, -1); // Remove the last (loading) message
        const newMessage: ChatMessage = {
          role: "assistant",
          content: data.response || data.text || (data.startDrafts ? "I've generated some drafts for you. Check them out in the Content Studio." : "Task completed."),
          animate: true
        };

        // Process drafts updates (Combine creation and updates to avoid race conditions)
        if (data.startDrafts || data.updatedDrafts || data.updatedDraft) {
          setGeneratedDrafts(prev => {
            let currentDrafts = [...prev];

            // 1. Handle New Drafts (Create/Replace)
            if (data.startDrafts && Array.isArray(data.startDrafts)) {
              if (data.clearDrafts) {
                currentDrafts = data.startDrafts;
              } else {
                // Avoid duplicates if needed, or just append
                currentDrafts = [...currentDrafts, ...data.startDrafts];
              }
            }

            // 2. Handle Updates
            const updates = data.updatedDrafts || (data.updatedDraft ? [data.updatedDraft] : []);
            console.log("DEBUG: Processing Updates:", updates, "Current Drafts:", currentDrafts.length);

            if (updates.length > 0) {
              currentDrafts = currentDrafts.map((d, idx) => {
                // 1. Try strict ID match
                let update = updates.find((u: any) => u.id === d.id);

                // 2. Try strict Topic match
                if (!update && d.topic) {
                  update = updates.find((u: any) => u.topic === d.topic);
                }

                // 3. Fallback: Fuzzy match for "Draft 1", "Draft 2" etc.
                if (!update) {
                  update = updates.find((u: any) => {
                    // Robust fuzzy match: Normalize both to just numbers
                    const idStr = String(u.id || u.draftId || ""); // Check draftId too
                    if (!idStr) return false;

                    const normalize = (s: string) => s.toLowerCase().replace(/draft/g, '').replace(/#/g, '').replace(/\s+/g, '');
                    const cleanId = normalize(idStr);
                    const cleanTarget = String(idx + 1);
                    return cleanId === cleanTarget;
                  });
                }

                // 4. POSITIONAL FALLBACK: If we have exactly the same number of updates as drafts,
                // and we haven't matched yet, assume 1-to-1 mapping order.
                // This is critical for "schedule all" commands where IDs might be dropped.
                if (!update && updates.length === currentDrafts.length) {
                  update = updates[idx];
                }

                if (update) {
                  console.log(`Updated draft ${d.id} (idx ${idx}) with`, update);
                  return { ...d, ...update };
                } else {
                  console.log(`No update found for draft ${d.id} (idx ${idx})`);
                }
                return d;
              });
            }

            return currentDrafts;
          });
          setActiveCanvasTab("editor");
        }

        if (data.success) {
          newMessage.success = data.success;
        }
        if (data.scheduled) {
          newMessage.scheduled = data.scheduled;
        }

        // Handle scheduled post update
        if (data.scheduledPost) {
          // New Robust Logic: Handle array of scheduled posts or single object
          const scheduledUpdates = Array.isArray(data.scheduledPost) ? data.scheduledPost : [data.scheduledPost];

          setGeneratedDrafts(prev => prev.map((d, idx) => {
            // 1. Try exact ID match
            const updateById = scheduledUpdates.find((u: any) => u.draftId === d.id);
            if (updateById) return { ...d, scheduledTime: updateById.scheduledTime };

            // 2. Try strict topic match
            const updateByTopic = scheduledUpdates.find((u: any) => u.topic === d.topic);
            if (updateByTopic) return { ...d, scheduledTime: updateByTopic.scheduledTime };

            // 3. Try fuzzy/index match (if "Draft 1" is mentioned in topic or ID)
            // This is a fallback for when the agent refers to "Draft 1" but returns no ID
            const updateByIndex = scheduledUpdates.find((u: any) => {
              const idStr = String(u.draftId || "");

              // Normalize both ID and Topic to remove "Draft", "#", whitespace
              const normalize = (s: string) => s.toLowerCase().replace(/draft/g, '').replace(/#/g, '').replace(/\s+/g, '');
              const cleanId = normalize(idStr);
              const cleanTarget = String(idx + 1);

              // Match normalized ID or normalized Topic containing "Draft X"
              const topicMatch = u.topic && normalize(u.topic).includes(cleanTarget); // basic heuristic

              return cleanId === cleanTarget || topicMatch;
            });
            if (updateByIndex) return { ...d, scheduledTime: updateByIndex.scheduledTime };

            // 4. POSITIONAL FALLBACK:
            // Same logic as updatedDrafts: If count matches, assume index based mapping
            if (scheduledUpdates.length === prev.length) {
              const updateByPos = scheduledUpdates[idx];
              if (updateByPos) return { ...d, scheduledTime: updateByPos.scheduledTime };
            }

            return d;
          }));
        }

        return [...newHistory, newMessage];
      });

      if (data.actionPerformed) {
        // Refresh scheduled posts if an action was performed
        loadScheduledPosts();
      }

    } catch (err: any) {
      console.error("Agent error:", err);
      setMessages(prev => {
        const newHistory = prev.slice(0, -1); // Remove the last (loading) message
        return [...newHistory, { role: "assistant", content: `Sorry, I encountered an error: ${err.message}. Details: ${JSON.stringify(err.response?.data || {})} `, animate: true }];
      });
    } finally {
      setChatLoading(false);
    }
  };

  const handleDeleteDraft = (index: number) => {
    setGeneratedDrafts(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearDrafts = () => {
    if (confirm("Are you sure you want to clear all drafts?")) {
      setGeneratedDrafts([]);
    }
  };

  const handleClearAllScheduledPosts = async () => {
    if (!confirm("Are you sure you want to delete ALL upcoming scheduled posts? This cannot be undone.")) {
      return;
    }

    try {
      setLoading(true);
      const { data } = await axios.delete(`${API_BASE}/schedule`);
      if (data.success) {
        setScheduledPosts([]); // clear local state immediately
        // Also refresh from server to be safe
        await loadScheduledPosts();
      }
    } catch (err: any) {
      console.error("Failed to clear schedule", err);
      alert("Failed to clear scheduled posts: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async (finalContent: string, scheduleData: { platform: string, time: string }[], mediaFiles: File[], draftId?: string, topicParam?: string) => {
    console.log("🚀 [HANDLE_SCHEDULE] Initiated", { draftId, platforms: scheduleData.length, contentLen: finalContent?.length, topic: topicParam });

    if (!scheduleData || scheduleData.length === 0) {
      console.error("❌ [HANDLE_SCHEDULE] No schedule data provided");
      alert("System Error: No schedule data passed to handler. Please try again.");
      return;
    }

    // Store draftId in a constant to ensure it's captured in closure
    const targetDraftId = draftId;

    try {
      const promises = scheduleData.map(async (item) => {
        const formData = new FormData();
        // Priority: Passed topic > Selected Draft topic > State topic > Default
        // Note: 'topic' param here shadows the state 'topic' variable.
        // To be safe/clear, we use the param if valid.
        const effectiveTopic = topicParam || selectedDraft?.topic || topic || "Scheduled content";

        formData.append("topic", effectiveTopic);
        formData.append("platform", item.platform);
        formData.append("run_at_iso", item.time);
        formData.append("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
        formData.append("preGeneratedContent", finalContent);

        mediaFiles.forEach((file) => {
          formData.append("media", file);
        });

        // Use a wrapper promise to ensure we can debug the response
        try {
          return await axios.post(`${API_BASE}/schedule`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
            withCredentials: true,
          });
        } catch (err: any) {
          console.error(`❌ [HANDLE_SCHEDULE] API Error for ${item.platform}:`, err);
          throw err;
        }
      });

      const results = await Promise.allSettled(promises);

      // Optimistic Update
      const newPosts = results
        .filter(r => r.status === 'fulfilled')
        .map((r: any) => {
          const data = r.value.data;
          return {
            id: data.id || Date.now().toString(),
            platform: data.platform || 'Unknown',
            scheduledTime: data.scheduledTime || new Date().toISOString(),
            topic: data.topic || 'Scheduled Draft',
            tone: data.tone || 'Professional',
            status: 'scheduled',
            content: data.preGeneratedContent || data.topic
          };
        });

      if (newPosts.length > 0) {
        setScheduledPosts(prev => [...prev, ...newPosts]);
        console.log("✅ [HANDLE_SCHEDULE] Optimistically added posts:", newPosts.length);

        // Show success popup ONLY if we actually scheduled something
        setShowScheduleSuccessPopup(true);

        // CRITICAL: Only remove draft if scheduling SUCCEEDED
        if (targetDraftId) {
          console.log("🗑️ [HANDLE_SCHEDULE] Removing draft upon success:", targetDraftId);
          // Add a small delay for animation to play out
          setTimeout(() => {
            setGeneratedDrafts(prev => {
              const nextState = prev.filter(d => d.id !== targetDraftId);
              return nextState;
            });
          }, 300);
        }
      } else {
        console.error("❌ [HANDLE_SCHEDULE] No posts were successfully scheduled");
        alert("Scheduling failed. The server did not accept the scheduled time (is it in the past?). Please check the console.");
        // Do NOT remove the draft so the user can try again
      }

      // Refresh schedule in background
      loadScheduledPosts().catch(err => console.error("Background refresh failed:", err));

    } catch (error) {
      console.error("❌ [HANDLE_SCHEDULE] Critical Failure:", error);
      alert("Scheduling failed due to a system error. Please try again.");
    }
  };


  // Check Twitter connection status
  const checkTwitterConnection = async () => {
    try {
      const response = await axios.get(`${API_BASE}/twitter/status`, {
        withCredentials: true,
        timeout: 10000,
      });

      if (response.data.success && response.data.data.authenticated) {
        setConnectedAccounts((prev) => ({ ...prev, twitter: true }));
        setTwitterUsername(response.data.data.username || "");
      } else {
        setConnectedAccounts((prev) => ({ ...prev, twitter: false }));
        setTwitterUsername("");
      }
    } catch (error: any) {
      console.log("Twitter connection check failed:", error.message);
      setConnectedAccounts((prev) => ({ ...prev, twitter: false }));
      setTwitterUsername("");
    }
  };

  // Check existing connections function
  const checkExistingConnections = () => {
    const mastoToken = getMastoToken();
    const mastoInstance = getMastoInstance();

    console.log("🔍 Checking connections:", {
      mastoToken: !!mastoToken,
      mastoInstance: !!mastoInstance,
    });

    setConnectedAccounts((prev) => ({
      ...prev,
      mastodon: !!(mastoToken && mastoInstance), // Only true if both exist
    }));

    // Check Facebook connection and load pages if connected
    checkFacebookConnection();

    // Check Twitter connection
    checkTwitterConnection();

    // Check LinkedIn connection
    checkLinkedinConnection();
  };

  // Check Facebook connection status (for Facebook Pages posting)
  const checkFacebookConnection = async () => {
    if (!isAuthenticated) return;

    try {
      const response = await axios.get(`${API_BASE}/social/facebook/status`, {
        withCredentials: true,
        timeout: 10000,
      });

      console.log("📘 Facebook status response:", response.data);

      if (response.data.success && response.data.connected) {
        const pages = Array.isArray(response.data.pages)
          ? response.data.pages
          : [];
        console.log("📘 Facebook pages received:", pages);
        setFacebookPages(pages);
        setConnectedAccounts((prev) => ({
          ...prev,
          facebook: pages.length > 0,
        }));

        // Auto-select first page if none selected
        if (pages.length > 0 && !selectedFacebookPage) {
          setSelectedFacebookPage(pages[0]);
        }
      } else {
        setFacebookPages([]);
        setConnectedAccounts((prev) => ({
          ...prev,
          facebook: false,
        }));
      }
    } catch (error: any) {
      console.log("Facebook connection check failed:", error.message);
      setFacebookPages([]);
      setConnectedAccounts((prev) => ({
        ...prev,
        facebook: false,
      }));
    }
  };

  // Check LinkedIn connection status
  const checkLinkedinConnection = async () => {
    try {
      const response = await axios.get(`${API_BASE}/social/linkedin/status`, {
        withCredentials: true,
        timeout: 10000,
      });

      if (response.data.connected) {
        setConnectedAccounts((prev) => ({ ...prev, linkedin: true }));
      } else {
        setConnectedAccounts((prev) => ({ ...prev, linkedin: false }));
      }
    } catch (error: any) {
      console.log("LinkedIn connection check failed:", error.message);
      setConnectedAccounts((prev) => ({ ...prev, linkedin: false }));
    }
  };

  // Capture tokens from URL after OAuth redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const linkedPlatform = params.get("linked");
    const oauthError = params.get("error");
    const errorDetails = params.get("details");
    const demoMode = params.get("demo");
    const demoMessage = params.get("message");
    const twSuccess = params.get("tw_success");

    // Mastodon
    const maToken = params.get("ma_token");
    const maInstance = params.get("ma_instance");

    if (oauthError) {
      const errorMessage = errorDetails
        ? `Authentication failed: ${oauthError} - ${decodeURIComponent(errorDetails)}`
        : `Authentication failed: ${oauthError}`;
      setError(errorMessage);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Handle demo mode messages
    if (demoMode && demoMessage) {
      setError(`🎯 DEMO MODE: ${decodeURIComponent(demoMessage)}`);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Mastodon: save to localStorage
    if (maToken && maInstance) {
      localStorage.setItem("ma_access_token", maToken);
      localStorage.setItem("ma_instance", maInstance);
      setConnectedAccounts((prev) => ({ ...prev, mastodon: true }));
      setPlatform("Mastodon");
    }

    // Twitter: Check if OAuth callback was successful
    if (linkedPlatform === "twitter" && twSuccess === "true") {
      setConnectedAccounts((prev) => ({ ...prev, twitter: true }));
      setPlatform("Twitter");
      checkTwitterConnection();
    }

    if (linkedPlatform === "facebook" && twSuccess === "true") {
      setConnectedAccounts((prev) => ({ ...prev, facebook: true }));
      setPlatform("Facebook");
      checkFacebookConnection();
    }

    // LinkedIn: Check if OAuth callback was successful
    if (linkedPlatform === "linkedin") {
      setConnectedAccounts((prev) => ({ ...prev, linkedin: true }));
      setPlatform("LinkedIn");
      checkLinkedinConnection();
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (linkedPlatform === "linkedin" && twSuccess === "true") {
      setConnectedAccounts((prev) => ({ ...prev, linkedin: true }));
      checkLinkedinConnection();
    }

    // Mark connected account if present in URL
    // if (linkedPlatform) {
    //   setConnectedAccounts(
    //     (prev) =>
    //       ({
    //         ...prev,
    //         [linkedPlatform.toLowerCase()]: true,
    //       }) as ConnectedMap,
    //   );

    //   // If Facebook was connected, reload pages
    //   if (linkedPlatform.toLowerCase() === "facebook") {
    //     checkFacebookConnection();
    //   }
    // }

    // Clean the URL
    if (maToken || maInstance || linkedPlatform || demoMode || twSuccess) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check for existing connections on component load
    if (isAuthenticated) {
      checkExistingConnections();
    }
  }, []);

  // Load scheduled posts from API
  const loadScheduledPosts = async () => {
    try {
      const response = await fetch(`${API_BASE}/schedule`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setScheduledPosts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log("Failed to load scheduled posts:", error);
      setScheduledPosts([]);
    }
  };

  // Load job history
  const loadJobHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/schedule/history`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setJobHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load job history:", error);
      setJobHistory([]);
    }
  };

  // Check connections on component mount - only when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      checkExistingConnections();
    } else {
      // Clear connection status when not authenticated
      setConnectedAccounts({});
    }
  }, [isAuthenticated]);

  // Check platform-specific connections when platform switches
  useEffect(() => {
    if (platform === "Facebook" && isAuthenticated) {
      checkFacebookConnection();
    } else if (platform === "Twitter" && isAuthenticated) {
      checkTwitterConnection();
    } else if (platform === "LinkedIn" && isAuthenticated) {
      checkLinkedinConnection();
    }
  }, [platform, isAuthenticated]);

  // Clear media files when switching to Twitter
  useEffect(() => {
    if (platform === "Twitter") {
      setSelectedFiles([]);
      setScheduleSelectedFiles([]);
    }
  }, [platform]);

  useEffect(() => {
    loadScheduledPosts();
    loadJobHistory();
  }, []);

  // Restore pending post after OAuth
  useEffect(() => {
    const savedPost = localStorage.getItem("pendingSocialPost");
    if (savedPost) {
      const savedData = JSON.parse(savedPost);
      setResult(savedData.content || "");
      setPlatform(savedData.platform || "Twitter");
      localStorage.removeItem("pendingSocialPost");
    }
  }, []);

  // Generate post with preview option
  const handleSubmit = async (
    e?: React.SyntheticEvent,
    previewMode = false,
  ) => {
    e?.preventDefault?.();
    setLoading(true);
    setError("");
    if (!previewMode) setResult("");

    // Use schedule topic override if in schedule section, otherwise use regular topic
    const currentTopic = scheduleTopicOverride || topic;
    const currentTone = scheduleToneOverride || tone;

    try {
      const { data } = await axios.post(
        // Falls back to a same-origin endpoint so this works without an
        // external service URL hard-coded into the frontend.
        `${(import.meta.env.VITE_CREWAI_API_URL || "/api/crewai").replace(/\/+$/, "")}/generate`,
        {
          topic: currentTopic,
          platform: platform.toLowerCase(),
          tone: currentTone,
        },
      );

      console.log("📥 Raw response data:", JSON.stringify(data, null, 2));

      // Handle different response structures from external service
      let content = "";
      if (data.result?.result) {
        content = data.result.result;
      } else if (data.result) {
        content = data.result;
      } else if (data.raw) {
        content = data.raw;
      } else if (typeof data === "string") {
        content = data;
      } else {
        content = data.content || "";
      }

      console.log("🎯 Extracted content:", content.substring(0, 100) + "...");
      console.log("✅ Content extraction successful");

      setAgentOutputs([]);

      if (!content || !content.trim()) {
        setError("No content generated.");
        return;
      }

      if (previewMode) {
        setEditableContent(content);
        setShowContentPreview(true);
      } else {
        setResult(content);
      }
    } catch (err: any) {
      setError(err?.message || "Network Error");
    } finally {
      setLoading(false);
    }
  };

  // Preview content
  const handlePreviewContent = (e: React.FormEvent) => {
    handleSubmit(e, true);
  };

  // Reset form after successful scheduling
  const resetForm = () => {
    setTopic("");
    setResult("");
    setEditableContent("");
    setShowContentPreview(false);
    setUploadedMediaUrls([]);
    setSelectedFiles([]);
    setScheduleSelectedFiles([]);
    setScheduleTopicOverride("");
    setScheduleToneOverride("");
    setSelectedDate(undefined);
    setSelectedTime("");
    setError("");
  };

  const handleRegenerate = handleSubmit;

  const handleScheduleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const valid = files.filter((f) => {
      const okType = f.type.startsWith("image/") || f.type.startsWith("video/");
      const okSize = f.size <= MAX_FILE_MB * 1024 * 1024;
      return okType && okSize;
    });
    if (valid.length !== files.length) {
      alert(
        `Some files were rejected. Accepted: images/videos. Max ${MAX_FILE_MB}MB each.`,
      );
    }

    setScheduleSelectedFiles((prev) => [...prev, ...valid]);
    e.currentTarget.value = "";
  };

  const removeScheduleSelected = (idx: number) =>
    setScheduleSelectedFiles((prev) => prev.filter((_, i) => i !== idx));

  const removeMediaFile = (indexToRemove: number) => {
    setUploadedMediaUrls((prev) =>
      prev.filter((_, index) => index !== indexToRemove),
    );
  };

  // Handle scheduling a post
  // This function is now largely superseded by the `handleSchedule` function used by InlineDraftCard
  const handleSchedulePost = async () => {
    if (!selectedDate || !selectedTime) {
      setError("Please select both date and time for scheduling");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const scheduledDateTime = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(":");
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const now = new Date();
      if (scheduledDateTime <= now) {
        setError(
          "Cannot schedule posts for past times. Please select a future date and time.",
        );
        setLoading(false);
        return;
      }

      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      let credentials: any = {
        topic: scheduleTopicOverride || topic || "Scheduled content",
        tone: scheduleToneOverride || tone,
        platform,
        run_at_iso: scheduledDateTime.toISOString(),
        timezone: userTimezone,
        tz_offset_minutes: scheduledDateTime.getTimezoneOffset(),
        mediaUrls: uploadedMediaUrls,
        preGeneratedContent: editableContent || result,
      };

      if (platform === "Mastodon") {
        credentials.mastodon_instance = getMastoInstance();
        credentials.mastodon_access_token = getMastoToken();

        if (
          !credentials.mastodon_instance ||
          !credentials.mastodon_access_token
        ) {
          setError("Please connect to Mastodon first to schedule posts");
          setLoading(false);
          return;
        }
      } else if (platform === "Twitter") {
        if (!connectedAccounts.twitter) {
          setError("Please connect to Twitter first to schedule posts");
          setLoading(false);
          return;
        }
      }

      console.log("📅 [SCHEDULE] Scheduling post:", {
        platform,
        scheduledTime: scheduledDateTime.toISOString(),
        topic: topic || "Scheduled content",
        filesCount: scheduleSelectedFiles.length,
      });

      const form = new FormData();

      Object.entries(credentials).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          form.append(
            key,
            typeof value === "object" ? JSON.stringify(value) : String(value),
          );
        }
      });

      for (const file of scheduleSelectedFiles) {
        form.append("media", file, file.name);
      }

      const response = await fetch(`${API_BASE}/schedule`, {
        method: "POST",
        body: form,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();

      if (responseData.success) {
        const newPost = {
          id: responseData.id,
          platform,
          scheduledTime: scheduledDateTime.toISOString(),
          topic: scheduleTopicOverride || topic || "Scheduled content",
          tone: scheduleToneOverride || tone,
          status: "scheduled",
        };
        setScheduledPosts((prev) => [...prev, newPost]);

        resetForm();

        console.log("✅ [SCHEDULE] Post scheduled successfully");
        alert(
          `Post scheduled for ${scheduledDateTime.toLocaleString()} on ${platform}`,
        );
      } else {
        throw new Error(responseData.message || "Failed to schedule post");
      }
    } catch (error: any) {
      console.error("❌ [SCHEDULE] Error scheduling post:", error);
      setError(
        error.response?.data?.error ||
        error.message ||
        "Failed to schedule post",
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle deleting a scheduled post


  // Validate and stash chosen files
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const valid = files.filter((f) => {
      const okType = f.type.startsWith("image/") || f.type.startsWith("video/");
      const okSize = f.size <= MAX_FILE_MB * 1024 * 1024;
      return okType && okSize;
    });
    if (valid.length !== files.length) {
      alert(
        `Some files were rejected. Accepted: images/videos. Max ${MAX_FILE_MB}MB each.`,
      );
    }

    setSelectedFiles((prev) => [...prev, ...valid]);
    e.currentTarget.value = "";
  };

  const removeSelected = (idx: number) =>
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));



  // Ensure Mastodon tokens exist
  const ensureMastodonOrRedirect = () => {
    const tok = getMastoToken();
    const inst = getMastoInstance();
    if (tok && inst) return { tok, inst };

    const instance = window.prompt(
      "Enter your Mastodon server (e.g. mastodon.social):",
      "mastodon.social",
    );
    if (!instance || instance.trim().length === 0) return null;

    const fullInstance = instance.trim();

    if (result.trim()) {
      localStorage.setItem(
        "pendingSocialPost",
        JSON.stringify({ content: result, platform }),
      );
    }
    window.location.href = `${SITE_BASE}/api/social/mastodon/login?instance=${encodeURIComponent(fullInstance)}`;
    return null;
  };

  // Publish
  const handlePublish = async () => {
    setLoading(true);
    setError("");

    if (!result.trim()) {
      alert(
        "⚠️ Cannot publish an empty post. Please generate or enter content.",
      );
      setLoading(false);
      return;
    }

    try {
      // TWITTER PUBLISHING
      if (platform === "Twitter") {
        if (!connectedAccounts.twitter) {
          setError("Please connect to Twitter first.");
          setLoading(false);
          return;
        }

        const form = new FormData();
        form.append("content", result.trim());

        // Attach media files
        for (const file of selectedFiles) {
          form.append("media", file, file.name);
        }

        try {
          const { data } = await axios.post(
            `${API_BASE}/twitter/publish`,
            form,
            {
              withCredentials: true,
              headers: {
                "Content-Type": "multipart/form-data",
              },
              timeout: 60000,
            },
          );

          if (data.success) {
            const postUrl = data.data?.tweetUrl || "";
            setSuccessPostUrl(postUrl);
            setShowSuccessPopup(true);
            resetForm();
          } else {
            setError(data.error || "Twitter publishing failed");
          }
        } catch (err: any) {
          console.error("Twitter publish error:", err);

          let msg = "Failed to publish to Twitter";
          if (err.response?.status === 401) {
            msg = "Authentication failed. Please reconnect to Twitter.";
            setConnectedAccounts((p) => ({ ...p, twitter: false }));
          } else {
            msg =
              err?.response?.data?.error ||
              err.message ||
              "Failed to publish to Twitter";
          }
          setError(msg);
        }
        setLoading(false);
        return;
      }

      // MASTODON PUBLISHING
      if (platform === "Mastodon") {
        const ok = ensureMastodonOrRedirect();
        if (!ok) {
          setLoading(false);
          return;
        }

        const form = new FormData();
        form.append("content", result);
        form.append("instance", ok.inst);
        form.append("access_token", ok.tok);

        for (const file of selectedFiles) {
          form.append("media", file, file.name);
        }
        for (const url of uploadedMediaUrls) {
          form.append("mediaUrls[]", url);
        }

        const { data } = await axios.post(
          `${API_BASE}/social/mastodon/publish`,
          form,
          { timeout: 30000 },
        );

        if (data.success) {
          const postUrl = data.result?.url || "";
          setSuccessPostUrl(postUrl);
          setShowSuccessPopup(true);
          setConnectedAccounts((prev) => ({ ...prev, mastodon: true }));
          resetForm();
        } else {
          setError(data.error || "Publishing failed");
        }
        setLoading(false);
        return;
      }

      // FACEBOOK PUBLISHING
      if (platform === "Facebook") {
        // if (!connectedAccounts.facebook || !selectedFacebookPage) {
        //   setError("Please connect Facebook and select a page first.");
        if (!connectedAccounts.facebook) {
          setError("Please connect to Facebook first.");
          setLoading(false);
          return;
        }

        if (
          !selectedFacebookPage ||
          !selectedFacebookPage.id ||
          !selectedFacebookPage.accessToken
        ) {
          console.error("📘 Facebook page validation failed:", {
            hasPage: !!selectedFacebookPage,
            hasId: !!selectedFacebookPage?.id,
            hasToken: !!selectedFacebookPage?.accessToken,
            page: selectedFacebookPage,
          });
          setError(
            "Missing Facebook page permissions. Please ensure your Facebook App has 'pages_manage_posts' permission approved, or use the app in Development Mode with test pages.",
          );
          setLoading(false);
          return;
        }

        console.log("📘 Publishing to Facebook page because i am debugging:", {
          pageId: selectedFacebookPage.id,
          pageName: selectedFacebookPage.name,
          hasToken: !!selectedFacebookPage.accessToken,
          tokenLength: selectedFacebookPage.accessToken?.length,
          mediaCount: selectedFiles.length,
          selectedPageObject: selectedFacebookPage,
        });

        const form = new FormData();
        form.append("content", result.trim());
        form.append("pageId", selectedFacebookPage.id);
        form.append("pageAccessToken", selectedFacebookPage.accessToken);

        console.log("📘 FormData being sent:", {
          hasContent: form.has("content"),
          hasPageId: form.has("pageId"),
          hasPageAccessToken: form.has("pageAccessToken"),
          pageIdValue: form.get("pageId"),
          tokenPrefix: (form.get("pageAccessToken") as string)?.substring(
            0,
            20,
          ),
        });
        // Attach media files (images/videos)
        for (const file of selectedFiles) {
          form.append("media", file, file.name);
        }

        // Add link URL if no media files
        if (selectedFiles.length === 0) {
          for (const url of uploadedMediaUrls) {
            form.append("linkUrl", url);
            break; // Only one link for Facebook
          }
        }

        try {
          const { data } = await axios.post(
            `${API_BASE}/social/facebook/publish`,
            form,
            {
              withCredentials: true,
              timeout: 60000,
              headers: {
                "Content-Type": "multipart/form-data",
              },
            },
          );

          if (data.success) {
            const postUrl = data.url || "";
            setSuccessPostUrl(postUrl);
            setShowSuccessPopup(true);
            resetForm();
          } else {
            setError(data.error || "Facebook publishing failed");
          }
        } catch (err: any) {
          console.error("Facebook publish error:", err);
          // setError(
          //   err?.response?.data?.error ||
          //     err.message ||
          //     "Failed to publish to Facebook",
          // );
          const errorDetails =
            err?.response?.data?.details ||
            err?.response?.data?.error ||
            err.message;
          const errorCode = err?.response?.data?.errorCode;
          const errorType = err?.response?.data?.errorType;

          let errorMessage = errorDetails || "Failed to publish to Facebook";
          if (errorCode || errorType) {
            errorMessage += ` (${errorType || "Error"} ${errorCode || ""})`;
          }

          setError(errorMessage);
        }
        setLoading(false);
        return;
      }

      // LINKEDIN PUBLISHING
      if (platform === "LinkedIn") {
        if (!connectedAccounts.linkedin) {
          setError("Please connect to LinkedIn first.");
          setLoading(false);
          return;
        }

        const form = new FormData();
        form.append("content", result.trim());

        // Attach media files
        for (const file of selectedFiles) {
          form.append("media", file, file.name);
        }

        try {
          const { data } = await axios.post(
            `${API_BASE}/social/linkedin/publish`,
            form,
            {
              withCredentials: true,
              timeout: 60000,
              headers: {
                "Content-Type": "multipart/form-data",
              },
            },
          );

          if (data.success) {
            const postUrl = data.url || "";
            setSuccessPostUrl(postUrl);
            setShowSuccessPopup(true);
            resetForm();
          } else {
            setError(data.error || "LinkedIn publishing failed");
          }
        } catch (err: any) {
          console.error("LinkedIn publish error:", err);
          let msg = "Failed to publish to LinkedIn";
          if (err.response?.status === 401) {
            msg = "Authentication failed. Please reconnect to LinkedIn.";
            setConnectedAccounts((p) => ({ ...p, linkedin: false }));
          } else {
            msg =
              err?.response?.data?.error ||
              err.message ||
              "Failed to publish to LinkedIn";
          }
          setError(msg);
        }
        setLoading(false);
        return;
      }
    } catch (err: any) {
      console.error("Publishing error:", err);
      let msg = "Failed to publish";
      if (err.response?.status === 401) {
        msg = "Authentication failed. Please reconnect.";
        if (platform === "Mastodon") {
          localStorage.removeItem("ma_access_token");
          localStorage.removeItem("ma_instance");
          setConnectedAccounts((p) => ({ ...p, mastodon: false }));
        } else if (platform === "Twitter") {
          setConnectedAccounts((p) => ({ ...p, twitter: false }));
        }
      } else if (err.response?.status === 422) {
        msg = "Content validation failed. Please check your content.";
      } else if (err.code === "ECONNABORTED") {
        msg = "Request timed out. Please try again.";
      } else {
        msg = err?.response?.data?.error || err.message || "Network Error";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Get character limit based on platform
  const getCharacterLimit = () => {
    if (platform === "Twitter") return 280;
    if (platform === "Mastodon") return 500;
    return null;
  };

  const charLimit = getCharacterLimit();

  const handleDeletePost = async (id: string) => {
    if (!confirm("Are you sure you want to delete this scheduled post?")) return;
    try {
      await axios.delete(`${API_BASE}/schedule/${id}`);
      loadScheduledPosts();
    } catch (error) {
      console.error("Failed to delete post:", error);
      alert("Failed to delete post.");
    }
  };


  const renderChatInterface = () => (
    <div
      ref={sidebarRef}
      style={{ width: `${panelRatio * 100}%`, flexShrink: 0 }}
      className="flex flex-col border-r border-gray-200 bg-white shadow-sm z-10 h-full relative"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-white/80 backdrop-blur-sm sticky top-0 z-10">


        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-green-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-green-200">
          <span className="text-xl">🦖</span>
        </div>
        <div>
          <h1 className="font-semibold text-gray-900">Requisor Agent</h1>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs text-gray-500 font-medium">Online • Dino Expert</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <Popover open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 shadow-sm whitespace-nowrap">
                <MessageSquare size={16} />
                Chat History
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex flex-col h-[400px]">
                {/* Popover Header */}
                <div className="p-4 border-b border-gray-100 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Recent Conversations</h3>
                    <button
                      onClick={handleClearAllHistory}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Clear All History"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <Button
                    className="w-full justify-center gap-2 bg-gray-900 text-white hover:bg-gray-800 shadow-sm transition-all"
                    onClick={() => {
                      handleCreateSession();
                      setIsHistoryOpen(false); // Auto-close popover
                    }}
                  >
                    <Plus size={16} />
                    New Chat
                  </Button>
                </div>

                {/* Session List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-gray-50/50">
                  {sessions.map((session) => (
                    <div
                      key={session.sessionId}
                      onClick={() => {
                        handleSelectSession(session.sessionId);
                        setIsHistoryOpen(false); // Also close when selecting a session
                      }}
                      className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${activeSessionId === session.sessionId
                        ? "bg-white shadow-sm border border-gray-200"
                        : "hover:bg-gray-200/50 text-gray-600"
                        }`}
                    >
                      <MessageSquare size={16} className={activeSessionId === session.sessionId ? "text-blue-600" : "text-gray-400"} />
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate text-gray-900">
                          {session.title || "New Conversation"}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {new Date(session.updatedAt || session.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(e, session.sessionId)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  {sessions.length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-sm">
                      <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                      No history yet
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <button
            onClick={handleClearChat}
            className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-full hover:bg-red-50"
            title="Clear Chat History"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-200">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-0 animate-fade-in" style={{ animation: 'fadeIn 0.5s forwards' }}>
            <div className="w-20 h-20 bg-gradient-to-tr from-blue-100 to-purple-100 rounded-full flex items-center justify-center mb-6 text-4xl shadow-sm">
              👋
            </div>
            <h3 className="text-2xl font-medium text-gray-800 mb-2">Hello, Creator</h3>
            <p className="text-gray-500 max-w-md leading-relaxed">
              I can help you draft posts, refine content, or schedule updates.
              Try asking: <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => setNewMessage("Draft a LinkedIn post about AI trends")}>"Draft a LinkedIn post about AI trends"</span>
            </p>
          </div>
        )}

        {messages.map((msg, idx) => {
          // Helper for initials
          const getInitials = () => {
            const first = user?.firstName?.[0] || "";
            const last = user?.lastName?.[0] || "";
            return (first + last).toUpperCase() || "U";
          };

          return (
            <div key={idx} className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`${msg.draft ? "w-full" : "max-w-[85%]"} flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm shadow-sm border border-black/5 ${msg.role === "user"
                  ? "bg-gradient-to-br from-gray-800 to-gray-900 text-white font-medium tracking-tight"
                  : "bg-gradient-to-tr from-green-500 to-emerald-400 text-white text-lg" // Dino green
                  }`}>
                  {msg.role === "user" ? getInitials() : "🦖"}
                </div>

                {/* Message Bubble */}
                <div className="flex flex-col gap-2 w-full">
                  {/* Text Content */}
                  {msg.content && !msg.draft && (
                    <div className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${msg.role === "user"
                      ? "bg-gray-100 text-gray-800 rounded-tr-sm"
                      : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm"
                      }`}>
                      <div className="whitespace-pre-wrap">
                        {msg.role === "assistant" && msg.animate ? (
                          <TypeAnimation
                            sequence={[msg.content]}
                            wrapper="span"
                            speed={80}
                            cursor={false}
                            style={{ display: 'inline-block' }}
                          />
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  )}

                  {msg.draft && (
                    <div className="bg-white border border-gray-100 px-5 py-3.5 rounded-2xl rounded-tl-sm text-[15px] leading-relaxed shadow-sm text-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                          <PenTool size={12} />
                        </span>
                        <span>
                          I've generated a draft for <span className="font-medium text-gray-900">{msg.draft.topic || "your request"}</span> in the Content Studio.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Success Message Card */}
                  {msg.success && (
                    (() => {
                      const successList = Array.isArray(msg.success) ? msg.success : [msg.success];

                      return (
                        <div className="flex flex-col gap-2">
                          {successList.map((successItem, i) => {
                            const p = successItem.platform.toLowerCase();
                            const s =
                              p === 'twitter' || p === 'x' ? { bg: 'bg-sky-50', border: 'border-sky-100', title: 'text-sky-900', text: 'text-sky-800', iconBg: 'bg-sky-100', iconColor: 'text-sky-500', btn: 'bg-sky-500 hover:bg-sky-600', Icon: FaTwitter } :
                                p === 'facebook' ? { bg: 'bg-blue-50', border: 'border-blue-100', title: 'text-blue-900', text: 'text-blue-800', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700', Icon: FaFacebook } :
                                  p === 'linkedin' ? { bg: 'bg-indigo-50', border: 'border-indigo-100', title: 'text-indigo-900', text: 'text-indigo-800', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', btn: 'bg-indigo-600 hover:bg-indigo-700', Icon: FaLinkedin } :
                                    p === 'mastodon' ? { bg: 'bg-purple-50', border: 'border-purple-100', title: 'text-purple-900', text: 'text-purple-800', iconBg: 'bg-purple-100', iconColor: 'text-purple-600', btn: 'bg-purple-600 hover:bg-purple-700', Icon: null } :
                                      { bg: 'bg-emerald-50', border: 'border-emerald-100', title: 'text-emerald-900', text: 'text-emerald-800', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', btn: 'bg-emerald-600 hover:bg-emerald-700', Icon: CheckCircle };

                            return (
                              <div key={i} className={`${s.bg} border ${s.border} px-5 py-4 rounded-2xl rounded-tl-sm text-[15px] leading-relaxed shadow-sm max-w-sm`}>
                                <div className="flex items-start gap-3">
                                  <div className={`w-8 h-8 rounded-full ${s.iconBg} flex items-center justify-center ${s.iconColor} flex-shrink-0`}>
                                    {s.Icon ? <s.Icon size={16} /> : <span className="font-bold text-xs">M</span>}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className={`font-semibold ${s.title} mb-1`}>Successfully Published</h4>
                                    <p className={`${s.text} text-sm mb-3`}>
                                      Your post is now live on <span className="font-medium">{successItem.platform}</span>.
                                    </p>
                                    {successItem.url && (
                                      <a
                                        href={successItem.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`inline-flex items-center gap-1.5 text-xs font-semibold text-white ${s.btn} px-3 py-1.5 rounded-lg transition-colors shadow-sm`}
                                      >
                                        View Live Post
                                        <ExternalLink size={12} />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}

                  {/* Visualize Draft Button */}
                  {msg.role === "assistant" && !msg.draft && !msg.isLoading && msg.content && isLikelyPost(msg.content) && (
                    <div className="mt-2">
                      <button
                        onClick={() => {
                          const extracted = extractPostContent(msg.content);
                          setSelectedDraft({
                            content: extracted,
                            topic: topic || "Draft Content"
                          });
                          setActiveCanvasTab("editor");
                        }}
                        className="text-xs flex items-center gap-1.5 text-cyan-600 hover:text-cyan-700 font-medium bg-cyan-50 px-3 py-1.5 rounded-lg transition-all border border-cyan-100 hover:border-cyan-200 hover:bg-cyan-100"
                      >
                        <Eye size={12} />
                        Open in Editor
                      </button>
                    </div>
                  )}

                  {/* Loading State */}
                  {msg.isLoading && (
                    <div className="flex items-center gap-2 text-gray-500 text-sm animate-pulse ml-2">
                      <span>Working on it...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={(el) => el?.scrollIntoView({ behavior: "smooth" })} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <div className="relative bg-gray-50 rounded-2xl border border-gray-200 shadow-inner">
          <div className="flex items-end p-2">
            <div className="flex-shrink-0 pb-2 pl-2">
            </div>

            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSubmit()}
              placeholder="Ask to schedule a post..."
              className="flex-1 bg-transparent border-none focus:ring-0 resize-none min-h-[60px] max-h-[200px] py-3.5 px-3 text-[15px] text-gray-800 placeholder-gray-400 leading-relaxed"
              disabled={chatLoading}
            />

            <div className="pb-2 pr-2">
              <button
                onClick={handleChatSubmit}
                disabled={chatLoading || (!newMessage.trim() && !chatFile)}
                className="bg-gray-900 text-white p-3 rounded-xl hover:bg-black hover:shadow-lg hover:scale-105 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
          {chatFile && (
            <div className="hidden"></div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCanvas = () => (
    <div className="flex-1 flex flex-col bg-gray-50/50 relative h-full">
      {/* Header & Tabs */}
      <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-gray-200 sticky top-0 z-10">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Studio</h2>
          <p className="text-gray-500 text-sm mt-1">Create, schedule, and manage content.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveCanvasTab("editor")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeCanvasTab === "editor" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
          >
            <PenTool size={16} /> Editor
          </button>
          <button
            onClick={() => setActiveCanvasTab("calendar")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeCanvasTab === "calendar" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
          >
            <CalendarIcon size={16} /> Calendar
          </button>
          <button
            onClick={() => setActiveCanvasTab("accounts")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeCanvasTab === "accounts" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
          >
            <Settings size={16} /> Accounts
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeCanvasTab === "editor" && (
          <div className="min-h-full flex flex-col">
            {generatedDrafts && generatedDrafts.length > 0 ? (
              <DraftCarousel
                drafts={generatedDrafts}
                onSelect={(draft) => setSelectedDraft(draft)}
                onDelete={(index) => handleDeleteDraft(index)} // Pass delete handler
                onClear={() => handleClearDrafts()} // Pass clear handler
                onSchedule={handleSchedule}
                onConfirm={(content, platforms, mediaFiles) => {
                  publishContentToAll(content, platforms, mediaFiles);
                }}
                connectedAccounts={connectedAccounts}
                onEdit={(id, updates) => {
                  setGeneratedDrafts(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
                }}
                onCancel={() => setGeneratedDrafts([])}
              />
            ) : selectedDraft ? (
              <InlineDraftCard
                key={selectedDraft.id || "new-draft"} // Force remount if topic changes
                draft={selectedDraft}
                index={0} // Assuming single draft, index doesn't matter much here
                connectedAccounts={connectedAccounts}
                isPublished={false}
                onConfirm={(content, platforms, mediaFiles) => publishContentToAll(content, platforms, mediaFiles)}
                onSchedule={handleSchedule}
                onDelete={undefined}
                onUpdate={(id, updates) => {
                  setSelectedDraft({ ...selectedDraft, ...updates });
                }}
                onCancel={() => setSelectedDraft(null)}
              />
            ) : (
              <div className="min-h-[400px] p-12 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-300">
                  <PenTool size={32} />
                </div>
                <h3 className="text-lg font-medium text-gray-600">No active draft</h3>
                <p className="text-sm">Select a draft from chat or create a new one</p>
                <button
                  onClick={() => {
                    const newDraft = { id: `new_${Date.now()}`, content: "", topic: "New Draft" };
                    setGeneratedDrafts([newDraft]);
                  }}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Create New Draft
                </button>
              </div>
            )}
          </div>
        )}

        {activeCanvasTab === "calendar" && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm min-h-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">Content Calendar</h3>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                {["Calendar", "Upcoming Posts", "History"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === tab
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "Calendar" && (
              <SocialCalendar posts={[...scheduledPosts, ...jobHistory]} onPostUpdate={loadScheduledPosts} />
            )}

            {activeTab === "Upcoming Posts" && (
              <div className="space-y-4">
                {upcomingPosts.length > 0 && (
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearAllScheduledPosts();
                      }}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200 text-xs"
                    >
                      <Trash2 size={14} className="mr-2" />
                      Clear All Upcoming
                    </Button>
                  </div>
                )}
                {upcomingPosts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <CalendarIcon size={48} className="mb-4 text-slate-200" />
                    <p className="text-lg font-medium">No upcoming posts</p>
                    <p className="text-sm">Schedule some content to see it here</p>
                  </div>
                ) : (
                  upcomingPosts
                    .sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime())
                    .map((post, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedPost(post);
                          setIsViewDialogOpen(true);
                        }}
                        className="group relative bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-300 overflow-hidden cursor-pointer"
                      >
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${getPlatformDotColor(post.platform)}`}></div>

                        <div className="flex justify-between items-start pl-3">
                          <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl border shadow-sm ${post.platform === 'Twitter' ? 'bg-sky-50 border-sky-100 text-sky-500' :
                              post.platform === 'Facebook' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                                post.platform === 'LinkedIn' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' :
                                  'bg-purple-50 border-purple-100 text-purple-600'
                              }`}>
                              {getPlatformIcon(post.platform)}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{post.platform}</span>
                              </div>
                              <h4 className="font-semibold text-slate-800 text-lg mb-2">{post.topic}</h4>
                              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg w-fit border border-slate-100">
                                <CalendarIcon size={14} className="text-slate-400" />
                                <span>{format(new Date(post.scheduledTime), "MMM d, yyyy 'at' h:mm a")}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPost(post);
                                setEditingPost(post);
                              }}
                              className="p-2 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                              title="Edit Post"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePost(post.id);
                              }}
                              className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                              title="Delete Post"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}

            {activeTab === "History" && (
              <div className="space-y-4">
                {historyPosts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <CalendarIcon size={48} className="mb-4 text-slate-200" />
                    <p className="text-lg font-medium">No history yet</p>
                    <p className="text-sm">Past and published posts will appear here</p>
                  </div>
                ) : (
                  historyPosts
                    .map((post, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedPost(post);
                          setIsViewDialogOpen(true);
                        }}
                        className="group relative bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden"
                      >
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${getPlatformDotColor(post.platform)}`}></div>
                        <div className="flex justify-between items-start pl-3">
                          <div className="flex gap-4">
                            <div className={`p-3 rounded-xl border shadow-sm h-fit ${post.platform === 'Twitter' ? 'bg-sky-50 border-sky-100 text-sky-500' :
                              post.platform === 'Facebook' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                                post.platform === 'LinkedIn' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' :
                                  'bg-purple-50 border-purple-100 text-purple-600'
                              }`}>
                              {getPlatformIcon(post.platform)}
                            </div>

                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                {post.status === 'published' || post.status === 'completed' ? (
                                  <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full border border-emerald-200 flex items-center gap-1 font-medium">
                                    <CheckCircle2 size={12} /> Published
                                  </span>
                                ) : post.status === 'failed' ? (
                                  <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full border border-red-200 flex items-center gap-1 font-medium">
                                    <AlertCircle size={12} /> Failed
                                  </span>
                                ) : (
                                  <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-200 flex items-center gap-1 font-medium animate-pulse">
                                    <Clock size={12} /> In Progress
                                  </span>
                                )}  <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs font-medium text-slate-500">{post.platform}</span>
                              </div>

                              <h4 className="font-semibold text-slate-800 text-base mb-2">{post.topic}</h4>

                              <div className="text-xs text-slate-400">
                                {post.executedAt ? format(new Date(post.executedAt), "MMM d, yyyy 'at' h:mm a") : 'Date unknown'}
                              </div>
                              <div className="mt-3">
                                {(post.status === 'published' || post.status === 'completed') ? (
                                  <div className="text-emerald-600 text-sm font-medium flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg w-fit">
                                    <CheckCircle2 size={14} /> Successfully published
                                  </div>
                                ) : post.status === 'failed' ? (
                                  <div className="text-red-600 text-sm font-medium flex items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-lg w-fit">
                                    <AlertCircle size={14} /> Failed to publish
                                  </div>
                                ) : (
                                  <div className="text-blue-600 text-sm font-medium flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg w-fit">
                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" /> Publishing...
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {(post.publishedUrl || (post.status === 'completed' && post.url)) && (
                            <a
                              href={post.publishedUrl || post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <ExternalLink size={16} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        )
        }

        {
          activeCanvasTab === "accounts" && (
            <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm max-w-3xl mx-auto">
              <h3 className="text-xl font-semibold mb-6 text-gray-900">Connected Accounts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Twitter */}
                <div className="border rounded-xl p-6 flex flex-col items-center gap-4 hover:border-blue-200 transition-colors">
                  <FaTwitter className={`w-8 h-8 ${connectedAccounts.twitter ? "text-blue-500" : "text-gray-400"}`} />
                  <div className="text-center">
                    <h4 className="font-medium text-gray-900">Twitter</h4>
                    <p className="text-xs text-gray-500">{connectedAccounts.twitter ? "Connected" : "Not connected"}</p>
                  </div>
                  <button
                    onClick={() => window.location.href = `${SITE_BASE}/api/twitter/login`}
                    className={`w-full py-2 rounded-lg text-sm font-medium ${connectedAccounts.twitter ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"}`}
                  >
                    {connectedAccounts.twitter ? "Reconnect" : "Connect"}
                  </button>
                </div>

                {/* Facebook */}
                <div className="border rounded-xl p-6 flex flex-col items-center gap-4 hover:border-blue-200 transition-colors">
                  <FaFacebook className={`w-8 h-8 ${connectedAccounts.facebook ? "text-blue-600" : "text-gray-400"}`} />
                  <div className="text-center">
                    <h4 className="font-medium text-gray-900">Facebook</h4>
                    <p className="text-xs text-gray-500">{connectedAccounts.facebook ? "Connected" : "Not connected"}</p>
                  </div>
                  <button
                    onClick={() => {
                      const returnUrl = encodeURIComponent(window.location.pathname);
                      window.location.href = `${SITE_BASE}/api/auth/facebook?returnTo=${returnUrl}`;
                    }}
                    className={`w-full py-2 rounded-lg text-sm font-medium ${connectedAccounts.facebook ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                  >
                    {connectedAccounts.facebook ? "Reconnect" : "Connect"}
                  </button>
                </div>

                {/* LinkedIn */}
                <div className="border rounded-xl p-6 flex flex-col items-center gap-4 hover:border-blue-200 transition-colors">
                  <FaLinkedin className={`w-8 h-8 ${connectedAccounts.linkedin ? "text-blue-700" : "text-gray-400"}`} />
                  <div className="text-center">
                    <h4 className="font-medium text-gray-900">LinkedIn</h4>
                    <p className="text-xs text-gray-500">{connectedAccounts.linkedin ? "Connected" : "Not connected"}</p>
                  </div>
                  <button
                    onClick={() => {
                      const returnUrl = encodeURIComponent(window.location.pathname);
                      window.location.href = `${SITE_BASE}/api/auth/linkedin?returnTo=${returnUrl}`;
                    }}
                    className={`w-full py-2 rounded-lg text-sm font-medium ${connectedAccounts.linkedin ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-blue-700 text-white hover:bg-blue-800"}`}
                  >
                    {connectedAccounts.linkedin ? "Reconnect" : "Connect"}
                  </button>
                </div>

                {/* Mastodon */}
                <div className="border rounded-xl p-6 flex flex-col items-center gap-4 hover:border-purple-200 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${connectedAccounts.mastodon ? "bg-indigo-600" : "bg-gray-400"}`}>M</div>
                  <div className="text-center">
                    <h4 className="font-medium text-gray-900">Mastodon</h4>
                    <p className="text-xs text-gray-500">{connectedAccounts.mastodon ? "Connected" : "Not connected"}</p>
                  </div>
                  <button
                    onClick={() => {
                      const instance = window.prompt("Enter your Mastodon server (e.g. mastodon.social):", "mastodon.social");
                      if (instance?.trim()) window.location.href = `${SITE_BASE}/api/social/mastodon/login?instance=${encodeURIComponent(instance.trim())}`;
                    }}
                    className={`w-full py-2 rounded-lg text-sm font-medium ${connectedAccounts.mastodon ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
                  >
                    {connectedAccounts.mastodon ? "Reconnect" : "Connect"}
                  </button>
                </div>
              </div>
            </div>
          )
        }
      </div >
    </div >
  );

  const renderModals = () => (
    <>
      {/* Platform Selection Modal */}
      {showPlatformSelect && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl transform transition-all scale-100">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Select Platforms</h3>
            <div className="space-y-3 mb-6">
              {["Twitter", "Facebook", "LinkedIn", "Mastodon"].map((p) => (
                <label key={p} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${p === "Twitter" ? "bg-blue-100 text-blue-600" :
                      p === "Facebook" ? "bg-indigo-100 text-indigo-600" :
                        p === "LinkedIn" ? "bg-sky-100 text-sky-700" :
                          "bg-purple-100 text-purple-600"
                      } `}>
                      {p === "Twitter" && <FaTwitter size={16} />}
                      {p === "Facebook" && <FaFacebook size={16} />}
                      {p === "LinkedIn" && <FaLinkedin size={16} />}
                      {p === "Mastodon" && <span className="text-xs font-bold">M</span>}
                    </div>
                    <span className="font-medium text-gray-700">{p}</span>
                  </div>
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedPlatforms.includes(p)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPlatforms(prev => [...prev, p]);
                      } else {
                        setSelectedPlatforms(prev => prev.filter(item => item !== p));
                      }
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPlatformSelect(false)}
                className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowPlatformSelect(false);
                  publishContentToAll(pendingContent, selectedPlatforms);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                disabled={selectedPlatforms.length === 0}
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Schedule Success Popup */}
      <Dialog open={showScheduleSuccessPopup} onOpenChange={setShowScheduleSuccessPopup}>
        <DialogContent className="sm:max-w-[400px] bg-white border border-gray-100 shadow-xl rounded-2xl p-0 overflow-hidden">
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-blue-100">
              <CalendarIcon size={28} />
            </div>

            <DialogTitle className="text-xl font-semibold text-gray-900 mb-2">
              Scheduled Successfully
            </DialogTitle>

            <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-[260px]">
              Your posts have been added to the calendar. We'll handle the publishing for you.
            </p>

            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                onClick={() => setShowScheduleSuccessPopup(false)}
                className="flex-1 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 h-11"
              >
                Keep Editing
              </Button>
              <Button
                onClick={() => {
                  setShowScheduleSuccessPopup(false);
                  setActiveCanvasTab("calendar");
                  setActiveTab("Calendar");
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 shadow-md shadow-blue-200"
              >
                View Schedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Post Detail Modal */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-xl border-gray-200 shadow-2xl">
          <DialogHeader className="border-b border-gray-100 pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              {selectedPost && (
                <div className={`p-2 rounded-lg ${getPlatformColor(selectedPost.platform)}`}>
                  {getPlatformIcon(selectedPost.platform)}
                </div>
              )}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                {(selectedPost?.status === 'published' || selectedPost?.status === 'completed') ? 'Published Post' : 'Scheduled Post'}
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedPost && (
            <div className="space-y-5 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Time</span>
                <span className="col-span-3 font-medium text-gray-700 font-mono text-sm">
                  {(() => {
                    const d = new Date(selectedPost.scheduledTime || selectedPost.executedAt);
                    return !isNaN(d.getTime()) ? format(d, "PPP 'at' p") : "Invalid Date";
                  })()}
                </span>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Topic</span>
                <span className="col-span-3 text-sm font-medium text-gray-900">
                  {selectedPost.topic}
                </span>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Content</span>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-600 leading-relaxed max-h-[200px] overflow-y-auto">
                  {selectedPost.content || selectedPost.text || selectedPost.message || (typeof selectedPost.result === 'string' ? selectedPost.result : selectedPost.result?.text) || selectedPost.preGeneratedContent || "No content available."}
                </div>
              </div>

              {(selectedPost.status === 'published' || selectedPost.status === 'completed') && (selectedPost.url || selectedPost.publishedUrl) && (
                <div className="flex justify-end">
                  <a href={selectedPost.url || selectedPost.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    View Live Post <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="sm:justify-between border-t border-gray-100 pt-4">
            <div></div> {/* Spacer */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsViewDialogOpen(false)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Post Published! 🎉
              </h3>
              <p className="text-gray-600 mb-6">
                Your content has been successfully shared on {platform}.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    if (successPostUrl) {
                      window.open(successPostUrl, "_blank");
                    }
                    setShowSuccessPopup(false);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Post
                </Button>
                <Button
                  onClick={() => setShowSuccessPopup(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit Scheduled Post</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                <input
                  type="text"
                  value={scheduleTopicOverride || editingPost.topic}
                  onChange={(e) => setScheduleTopicOverride(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                <input
                  type="text"
                  value={scheduleToneOverride || editingPost.tone}
                  onChange={(e) => setScheduleToneOverride(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Time</label>
                <input
                  type="datetime-local"
                  value={(() => {
                    const d = new Date(editingPost.scheduledTime);
                    return !isNaN(d.getTime()) ? format(d, "yyyy-MM-dd'T'HH:mm") : "";
                  })()}
                  onChange={(e) => {
                    if (e.target.value) {
                      const d = new Date(e.target.value);
                      if (!isNaN(d.getTime())) {
                        setEditingPost({
                          ...editingPost,
                          scheduledTime: d.toISOString(),
                        });
                      }
                    }
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  try {
                    await axios.put(
                      `${API_BASE}/schedule/${editingPost.id}`,
                      {
                        topic: scheduleTopicOverride || editingPost.topic,
                        tone: scheduleToneOverride || editingPost.tone,
                        scheduledTime: editingPost.scheduledTime,
                      },
                      { withCredentials: true },
                    );
                    setEditingPost(null);
                    setScheduleTopicOverride("");
                    setScheduleToneOverride("");
                    loadScheduledPosts();
                  } catch (error) {
                    console.error("Failed to update post:", error);
                    alert("Failed to update post. Please try again.");
                  }
                }}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                Update Post
              </button>
              <button
                onClick={() => {
                  setEditingPost(null);
                  setScheduleTopicOverride("");
                  setScheduleToneOverride("");
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {renderChatInterface()}

      {/* Resize Handle */}
      <div
        className={`w-1 cursor-col-resize hover:bg-blue-500 transition-colors z-50 flex items-center justify-center group ${isResizing ? 'bg-blue-500' : 'bg-transparent'}`}
        onMouseDown={startResizing}
      >
        {/* Visual Grip Handle */}
        <div className={`h-8 w-1 rounded-full bg-gray-300 group-hover:bg-blue-200 ${isResizing ? 'bg-blue-200' : ''}`} />
      </div>

      {renderCanvas()}
      {renderModals()}
    </div>
  );
};

export default SocialMediaAgent;
