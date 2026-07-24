import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ChatMessage, ChatAction } from "@shared/ai-types";
import type { Project } from "@shared/schema";
import { updateProjectLastOpened } from "@/lib/projectUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
// import {hub} from "@/sections/hub";
import {
  LayoutDashboard,
  FolderOpen,
  Calendar,
  BarChart2,
  ChevronDown,
  LogOut,
  ExternalLink,
  X,
  Users,
  Link as LinkIcon,
  Sparkles,
  Send,
  User,
  Play,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronUp,
  Workflow,
  ChevronRight,
  PanelLeft,
  Target,
  TrendingUp,
  FileText,
  Settings,
  Calculator,
  Brain,
  Activity,
  CreditCard,
  FolderArchiveIcon,
  MessageSquare,
  Library,
  HelpCircle,
  Zap,
  FolderKanban,
  Plug,
} from "lucide-react";
import FormsPage from "@/pages/forms";

interface SidebarItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive?: boolean;
  badge?: React.ReactNode;
  comingSoon?: boolean;
  onClick?: () => void;
  isCollapsed?: boolean;
}

function formatTokenShort(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

function SidebarUsageIndicator({ isCollapsed }: { isCollapsed: boolean }) {
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem("sidebar-usage-expanded") !== "false"; } catch { return true; }
  });

  const toggleExpanded = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem("sidebar-usage-expanded", String(next)); } catch {}
  };

  const { data: budget } = useQuery<{
    used: number;
    limit: number;
    percentUsed: number;
    warning: boolean;
    planName: string;
    planSlug: string;
    projectLimit: { current: number; max: number };
  }>({
    queryKey: ["/api/tokens/budget"],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  if (!budget) return null;

  const tokenPercent = Math.min(100, Math.round(budget.percentUsed));
  const tokenBarColor = tokenPercent >= 100 ? "bg-red-500" : tokenPercent >= 80 ? "bg-amber-500" : "bg-emerald-500";
  const projPercent = budget.projectLimit.max > 0
    ? Math.min(100, Math.round((budget.projectLimit.current / budget.projectLimit.max) * 100))
    : 0;
  const projBarColor = projPercent >= 100 ? "bg-red-500" : projPercent >= 80 ? "bg-amber-500" : "bg-emerald-500";

  if (isCollapsed) {
    return (
      <div className="px-2 pb-2">
        <Link
          href="/profile"
          className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-emerald-50/60 transition-colors cursor-pointer"
          title={`Tokens: ${formatTokenShort(budget.used)}/${formatTokenShort(budget.limit)} | Projects: ${budget.projectLimit.current}/${budget.projectLimit.max}`}
        >
          <div className="w-7 h-7 rounded-full relative">
            <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="11" fill="none" stroke="#e2e8f0" strokeWidth="3" />
              <circle
                cx="14" cy="14" r="11" fill="none"
                stroke={tokenPercent >= 100 ? "#ef4444" : tokenPercent >= 80 ? "#f59e0b" : "#10b981"}
                strokeWidth="3"
                strokeDasharray={`${(tokenPercent / 100) * 69.1} 69.1`}
                strokeLinecap="round"
              />
            </svg>
            <Zap className="w-3 h-3 text-slate-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pb-3">
      <div className="rounded-xl bg-slate-50/80 border border-slate-200/60 overflow-hidden transition-all group">
        <button
          onClick={toggleExpanded}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-emerald-50/30 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Usage</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-slate-200 text-slate-500">
              {budget.planName}
            </Badge>
          </div>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>

        {expanded && (
          <Link
            href="/profile"
            className="block px-3 pb-3 hover:bg-emerald-50/30 transition-colors cursor-pointer"
          >
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-slate-400" />
                    <span className="text-[11px] text-slate-500">Tokens</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-600">
                    {formatTokenShort(budget.used)}/{formatTokenShort(budget.limit)}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${tokenBarColor}`} style={{ width: `${tokenPercent}%` }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <FolderKanban className="w-3 h-3 text-slate-400" />
                    <span className="text-[11px] text-slate-500">Projects</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-600">
                    {budget.projectLimit.current}/{budget.projectLimit.max}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${projBarColor}`} style={{ width: `${projPercent}%` }} />
                </div>
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

function SidebarItem({
  href,
  icon,
  children,
  isActive,
  badge,
  comingSoon,
  onClick,
  isCollapsed,
}: SidebarItemProps) {
  const content = (
    <div
      className={cn(
        "flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
        isActive
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm"
          : "text-slate-600 hover:bg-emerald-50/50 hover:text-emerald-700",
        comingSoon && "opacity-60",
        isCollapsed ? "justify-center px-2" : "justify-start",
      )}
      title={isCollapsed ? (children as string) : undefined}
    >
      <span className={cn("flex-shrink-0", !isCollapsed && "mr-3")}>
        {icon}
      </span>
      {!isCollapsed && (
        <>
          <span className="flex-1 truncate">{children}</span>
          {badge && <span className="ml-auto">{badge}</span>}
          {comingSoon && (
            <Badge
              variant="secondary"
              className="ml-2 text-xs bg-amber-100 text-amber-700 border-amber-200"
            >
              Soon
            </Badge>
          )}
        </>
      )}
    </div>
  );

  if (comingSoon) {
    return (
      <div className="px-2 mb-1" onClick={onClick}>
        {content}
      </div>
    );
  }

  return (
    <Link href={href} className="block px-2 mb-1" onClick={onClick}>
      {content}
    </Link>
  );
}

interface SidebarProps {
  onCloseMobile?: () => void;
  onRestartTour?: () => void;
}

function Sidebar({ onCloseMobile, onRestartTour }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { toast } = useToast();


  // Fetch real projects data
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
  });

  // Get recent projects sorted by lastOpenedAt, updatedAt, or createdAt
  const recentProjects = [...projects]
    .sort((a, b) => {
      const dateA = a.lastOpenedAt || a.updatedAt || a.createdAt;
      const dateB = b.lastOpenedAt || b.updatedAt || b.createdAt;

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return new Date(dateB).getTime() - new Date(dateA).getTime();
    })
    .slice(0, 3);

  // Toggle sidebar collapsed state
  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Handle mobile item click - close sidebar on mobile
  const handleItemClick = () => {
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  // Get user initials
  const getUserInitials = () => {
    if (!user) return "U";

    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`;
    }

    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }

    return "U";
  };

  // Get display name
  const getUserDisplayName = () => {
    if (!user) return "User";

    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }

    return user.username || "User";
  };

  return (
    <aside
      className={cn(
        "bg-white md:bg-gradient-to-b md:from-white md:via-emerald-50/10 md:to-teal-50/20 border-r border-emerald-100/50 h-screen flex flex-col shadow-lg transition-all duration-300",
        isCollapsed ? "w-16" : isMobile ? "w-[280px]" : "w-64",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "p-4 border-b border-emerald-100/50 bg-gradient-to-r from-white to-emerald-50/30",
          isCollapsed && "px-2",
        )}
      >
        <div className="flex items-center justify-between">
          {isCollapsed ? (
            <div className="flex items-center justify-center w-full">
              <img
                src="/favicon/favicon.png"
                alt="Requisor Logo"
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  console.error("Logo failed to load");
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <img
                src="/favicon/favicon.png"
                alt="Requisor Logo"
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  console.error("Logo failed to load");
                  e.currentTarget.style.display = "none";
                }}
              />
              <div className="flex flex-col">
                <h1 className="text-lg font-bold text-slate-800">
                  Requisor <span className="text-emerald-600">AI</span>
                </h1>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-1">
            {!isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCollapsed}
                className="h-8 w-8 p-0 hover:bg-emerald-100/50"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                ) : (
                  <ChevronLeft className="h-4 w-4 text-slate-600" />
                )}
              </Button>
            )}
            {isMobile && onCloseMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCloseMobile}
                className="h-8 w-8 p-0 hover:bg-emerald-100/50"
              >
                <X className="h-4 w-4 text-slate-600" />
              </Button>
            )}
          </div>
        </div>
      </div>
      {/* Main Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-4 mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            MAIN
          </div>
        )}

        <div data-tour="sidebar-agent">
          <SidebarItem
            href="/"
            icon={<Sparkles className="h-5 w-5" />}
            isActive={location === "/"}
            onClick={handleItemClick}
            isCollapsed={isCollapsed}
          >
            Requisor Agent
          </SidebarItem>
        </div>

        <div data-tour="sidebar-meetings">
          <SidebarItem
            href="/meetings"
            icon={<MessageSquare className="h-5 w-5" />}
            isActive={location === "/meetings"}
            onClick={handleItemClick}
            isCollapsed={isCollapsed}
          >
            Meetings
          </SidebarItem>
        </div>

        <div data-tour="sidebar-evidence">
          <SidebarItem
            href="/evidence"
            icon={<Library className="h-5 w-5" />}
            isActive={location === "/evidence"}
            onClick={handleItemClick}
            isCollapsed={isCollapsed}
          >
            Evidence Library
          </SidebarItem>
        </div>

        <div data-tour="sidebar-brain">
          <SidebarItem
            href="/brain"
            icon={<Brain className="h-5 w-5" />}
            isActive={location === "/brain"}
            onClick={handleItemClick}
            isCollapsed={isCollapsed}
            badge="AI"
          >
            Context Brain
          </SidebarItem>
        </div>

        <div data-tour="sidebar-themes">
          <SidebarItem
            href="/themes"
            icon={<TrendingUp className="h-5 w-5" />}
            isActive={location === "/themes" || location.startsWith("/themes/")}
            onClick={handleItemClick}
            isCollapsed={isCollapsed}
            badge="AI"
          >
            Theme Finder
          </SidebarItem>
        </div>

        <div data-tour="sidebar-connect">
          <SidebarItem
            href="/connect"
            icon={<Plug className="h-5 w-5" />}
            isActive={location === "/connect"}
            onClick={handleItemClick}
            isCollapsed={isCollapsed}
          >
            Connect
          </SidebarItem>
        </div>

        <div data-tour="sidebar-projects">
          <SidebarItem
            href="/projects"
            icon={<FolderOpen className="h-5 w-5" />}
            isActive={location === "/projects"}
            onClick={handleItemClick}
            isCollapsed={isCollapsed}
          >
            Projects
          </SidebarItem>
        </div>

        {/* <SidebarItem
          href="/workflow-builder"
          icon={<Workflow className="h-5 w-5" />}
          isActive={location === "/workflow-builder"}
          onClick={handleItemClick}
          isCollapsed={isCollapsed}
        >
          Workflow Builder
        </SidebarItem> */}

        <SidebarItem
          href="/ai-agents"
          icon={<Brain className="h-5 w-5" />}
          isActive={location === "/ai-agents"}
          onClick={handleItemClick}
          isCollapsed={isCollapsed}
          badge={
            <Badge
              variant="secondary"
              className="text-xs bg-gradient-to-r from-blue-100 to-purple-100 text-purple-700"
            >
              Hub
            </Badge>
          }
        >
          AI Agents
        </SidebarItem>

        <SidebarItem
          href="/pricing"
          icon={<CreditCard className="h-5 w-5" />}
          isActive={location === "/pricing"}
          onClick={handleItemClick}
          isCollapsed={isCollapsed}
        >
          Pricing
        </SidebarItem>


        {/* <SidebarItem
          href="/ai-budget-agent"
          icon={<Calculator className="h-5 w-5" />}
          isActive={location === "/ai-budget-agent"}
          onClick={handleItemClick}
          isCollapsed={isCollapsed}
          badge={
            <Badge
              variant="secondary"
              className="text-xs bg-green-100 text-green-700"
            >
              AI
            </Badge>
          }
        >
          Budget & Quotes
        </SidebarItem>
 */}
        {/* <SidebarItem
          href="/smart-bandwidth"
          icon={<Activity className="h-5 w-5" />}
          isActive={location === "/smart-bandwidth"}
          onClick={handleItemClick}
          isCollapsed={isCollapsed}
          badge={
            <Badge
              variant="secondary"
              className="text-xs bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700"
            >
              Smart+
            </Badge>
          }
        >
          Bandwidth Planner
        </SidebarItem> */}

        <SidebarItem
          href="/team"
          icon={<Users className="h-5 w-5" />}
          isActive={location === "/team"}
          onClick={handleItemClick}
          isCollapsed={isCollapsed}
        >
          Team
        </SidebarItem>

        <SidebarItem
          href="/forms"
          icon={<FolderArchiveIcon className="h-5 w-5" />}
          isActive={location === "/forms"}
          onClick={handleItemClick}
          isCollapsed={isCollapsed}
        >
          Forms
        </SidebarItem>

        {/* Recent Projects Section */}
        {user && !isCollapsed && recentProjects.length > 0 && (
          <>
            <div className="mx-4 mt-6 mb-3 border-t border-emerald-100/50"></div>

            <div className="px-4 mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              RECENT PROJECTS
            </div>

            <div className="px-4 space-y-2">
              {recentProjects.slice(0, 3).map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  onClick={async () => {
                    await updateProjectLastOpened(project.id);
                    if (isMobile && onCloseMobile) {
                      onCloseMobile();
                    }
                  }}
                  className="block p-2 bg-emerald-50/50 rounded-lg hover:bg-emerald-100/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs text-slate-800 truncate group-hover:text-emerald-700">
                        {project.name}
                      </div>
                      <div className="text-xs text-emerald-600 mt-1">
                        {project.status}
                      </div>
                    </div>
                    <Target className="h-3 w-3 text-slate-400 group-hover:text-emerald-600 flex-shrink-0 ml-2" />
                  </div>
                </Link>
              ))}

              {/* <Button
                variant="ghost"
                size="sm"
                asChild
                className="w-full mt-3 text-xs justify-start"
              >
                <Link
                  href="/projects"
                  className="text-slate-500 hover:text-emerald-700"
                >
                  <FolderOpen className="h-3 w-3 mr-2" />
                  View all projects
                </Link>
              </Button> */}
            </div>
          </>
        )}

        {/* Integrations Section */}
        {/* {!isCollapsed && (
          <>
            <div className="mx-4 mt-6 mb-3 border-t border-emerald-100/50"></div>

            <div className="px-4 mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              INTEGRATIONS
            </div>

            <div className="px-4 space-y-2">
              <div className="flex items-center p-2 bg-green-50/50 rounded-lg">
                <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center mr-3">
                  <FileText className="h-3 w-3 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-slate-800">
                    Smartsheet
                  </div>
                  <div className="text-xs text-green-600">Connected</div>
                </div>
              </div>

              <div className="flex items-center p-2 bg-slate-50 rounded-lg opacity-60">
                <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center mr-3">
                  <Settings className="h-3 w-3 text-slate-400" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-slate-600">
                    More integrations
                  </div>
                  <div className="text-xs text-slate-400">Coming soon</div>
                </div>
              </div>
            </div>
          </>
        )} */}
      </nav>
      {/* User Section */}
      {/* <div
        className={cn(
          "border-t border-emerald-100/50 p-4",
          isCollapsed && "px-2",
        )}
      > */}
      {/* {user ? (
          <div
            className={cn(
              "flex items-center space-x-3",
              isCollapsed && "justify-center",
            )}
          >
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-medium text-sm shadow-lg shadow-emerald-200/50">
              {getUserInitials()}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">
                  {getUserDisplayName()}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {user.username || user.email}
                </div>
              </div>
            )}
            <a
              href="/api/logout"
              className={cn(
                "p-2 text-slate-400 hover:text-red-500 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors",
                isCollapsed ? "w-8 h-8" : "ml-2",
              )}
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <div className={cn("text-center", isCollapsed && "px-1")}>
            {!isCollapsed ? (
              <>
                <div className="text-sm text-slate-600 mb-3">
                  Sign in to access your projects
                </div>
                <Button
                  asChild
                  size="sm"
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-200/50"
                >
                  <a href="/api/login">Sign In</a>
                </Button>
              </>
            ) : (
              <Button
                asChild
                size="sm"
                className="w-8 h-8 p-0 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              >
                <a href="/api/login" title="Sign In">
                  <User className="h-4 w-4 text-white" />
                </a>
              </Button>
            )}
          </div>
        )} */}
      {/* </div> */}
      {user && onRestartTour && (
        <div className={cn("px-4 pb-2", isCollapsed && "px-2")}>
          <button
            onClick={() => {
              if (location !== "/") {
                setLocation("/");
                setTimeout(() => onRestartTour?.(), 600);
              } else {
                onRestartTour?.();
              }
            }}
            className={cn(
              "flex items-center w-full rounded-lg text-xs text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/60 transition-colors",
              isCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2"
            )}
            title="Take a tour"
          >
            <HelpCircle className="h-4 w-4 flex-shrink-0" />
            {!isCollapsed && "Take a Tour"}
          </button>
        </div>
      )}

      {/* Usage Limits Indicator */}
      {user && <SidebarUsageIndicator isCollapsed={isCollapsed} />}

      {/* User Section */}
      <div
        className={cn(
          "border-t border-emerald-100/50 p-4",
          isCollapsed && "px-2",
        )}
      >
        {user ? (
          <div
            className={cn(
              "flex items-center",
              isCollapsed ? "justify-center" : "justify-between",
            )}
          >
            {/* Profile clickable area */}
            <Link
              href="/profile"
              onClick={handleItemClick}
              className={cn(
                "group flex items-center rounded-lg transition-colors cursor-pointer",
                isCollapsed ? "p-0" : "px-2 py-1 hover:bg-emerald-50/60",
              )}
              aria-label="Open profile"
              title="Open profile"
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-medium text-sm shadow-lg shadow-emerald-200/50 group-hover:scale-105 transition-transform">
                  {getUserInitials()}
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate group-hover:text-emerald-700">
                      {getUserDisplayName()}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {user.username || user.email}
                    </div>
                  </div>
                )}
              </div>
            </Link>

            {/* Logout button stays separate */}
            <a
              href="/api/logout"
              className={cn(
                "p-2 text-slate-400 hover:text-red-500 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors",
                isCollapsed ? "ml-2 w-8 h-8" : "ml-2",
              )}
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <div className={cn("text-center", isCollapsed && "px-1")}>
            {!isCollapsed ? (
              <>
                <div className="text-sm text-slate-600 mb-3">
                  Sign in to access your projects
                </div>
                <Button
                  asChild
                  size="sm"
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-200/50"
                >
                  <a href="/api/login">Sign In</a>
                </Button>
              </>
            ) : (
              <Button
                asChild
                size="sm"
                className="w-8 h-8 p-0 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              >
                <a href="/api/login" title="Sign In">
                  <User className="h-4 w-4 text-white" />
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export { Sidebar };
