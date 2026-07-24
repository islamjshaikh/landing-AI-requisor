import { useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Folder,
  Brain,
  CreditCard,
  FilePlus,
  Sparkles,
  Zap,
  Star,
  Clock,
  Play,
  ArrowRight,
  Bot,
  FolderKanban,
  DollarSign,
  Users,
  FileText,
  Target,
  Lightbulb,
  BarChart3,
  Share2,
  Puzzle,
  ChevronDown,
  LogOut,
  Settings,
  Menu,
  X,
  ArrowUpRight,
  Check,
  Rocket,
  Shield,
  Cpu,
  Sun,
  Moon,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";

type AgentStatus = "active" | "beta" | "coming-soon";

type PlanTier = "free" | "pro" | "business" | "enterprise";

const PLAN_HIERARCHY: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  business: 2,
  enterprise: 3,
};

function hasAccess(userPlan: PlanTier, requiredPlan: PlanTier): boolean {
  return PLAN_HIERARCHY[userPlan] >= PLAN_HIERARCHY[requiredPlan];
}

interface Agent {
  id: string;
  name: string;
  tagline: string;
  description: string;
  status: AgentStatus;
  featured?: boolean;
  capabilities: string[];
  color: "emerald" | "cyan" | "purple" | "rose" | "amber" | "sky" | "slate";
  stats?: { label: string; value: string }[];
  image: string;
  route?: string;
  requiredPlan: PlanTier;
}

const agents: Agent[] = [
  {
    id: "sociasor",
    name: "Sociasor",
    tagline: "Social Media Command Center",
    description:
      "Plan, schedule, and track social media performance across all platforms with intelligent automation.",
    status: "active",
    featured: true,
    capabilities: [
      "Content Scheduling",
      "Multi-Platform",
      "Analytics",
      "Auto-Posting",
    ],
    color: "sky",
    stats: [
      { label: "Stories Generated", value: "45K+" },
      { label: "Teams Using", value: "2.1K" },
    ],
    image: "/dinocard2/dino3.png",
    route: "/social-media-agent",
    requiredPlan: "pro",
  },

  {
    id: "requisor",
    name: "Requisor",
    tagline: "Project Management AI",
    description:
      "Transform chaotic brain dumps into structured, actionable project roadmaps. Your ideas deserve execution.",
    status: "active",
    featured: true,
    capabilities: [
      "Roadmap Generation",
      "Task Breakdown",
      "Jira Export",
      "AI Planning",
    ],
    color: "emerald",
    stats: [
      { label: "Projects Created", value: "12.4K" },
      { label: "Time Saved", value: "840h" },
    ],
    image: "/dinocard2/dino5.png",
    route: "/",
    requiredPlan: "pro",
  },

  {
    id: "agile-planning",
    name: "Agile Planner",
    tagline: "Sprint & Epic Architect",
    description:
      "Chat-driven planning that decomposes ideas into initiatives, epics, and user stories with acceptance criteria.",
    status: "active",
    capabilities: [
      "Epic Creation",
      "Story Points",
      "Sprint Planning",
      "Acceptance Criteria",
    ],
    color: "rose",
    stats: [
      { label: "Stories Generated", value: "45K+" },
      { label: "Teams Using", value: "2.1K" },
    ],
    image: "",
    route: "/agile-planning",
    requiredPlan: "pro",
  },
  {
    id: "budget-quote",
    name: "Budget & Quote",
    tagline: "AI Estimation Engine",
    description:
      "Generate accurate project budgets, create professional quotes, and export client-ready proposals instantly.",
    status: "active",
    capabilities: [
      "Project Scoping",
      "Cost Estimation",
      "PDF Export",
      "Client Proposals",
    ],
    color: "cyan",
    image: "/dino2/dino1.jpeg",
    route: "/ai-budget-agent",
    requiredPlan: "pro",
  },

  {
    id: "datasor",
    name: "Datasor",
    tagline: "Business Intelligence AI",
    description:
      "Turn raw data into actionable insights. Trend monitoring, pattern detection, and automated reporting.",
    status: "active",
    capabilities: [
      "Data Analysis",
      "Trend Detection",
      "Auto Reports",
      "Dashboards",
    ],
    color: "slate",
    image: "/dino2/dino1.jpeg",
    route: "/",
    requiredPlan: "business",
  },
  {
    id: "crmsor",
    name: "CRMsor",
    tagline: "Relationship Intelligence",
    description:
      "AI-powered customer relationship management with smart contact insights and pipeline automation.",
    status: "active",
    capabilities: [
      "Contact Intelligence",
      "Pipeline AI",
      "Sales Insights",
      "Auto Follow-ups",
    ],
    color: "slate",
    image: "/dino2/dino1.jpeg",
    route: "/",
    requiredPlan: "business",
  },

  {
    id: "ideasor",
    name: "Ideasor",
    tagline: "Creative Catalyst",
    description:
      "Transform rough concepts into refined, actionable ideas. Explore, structure, and validate before you build.",
    status: "coming-soon",
    capabilities: [
      "Idea Refinement",
      "Concept Mapping",
      "Validation",
      "Brainstorming",
    ],
    color: "amber",
    stats: [
      { label: "Stories Generated", value: "45K+" },
      { label: "Teams Using", value: "2.1K" },
    ],
    image: "/dino2/dino3.jpeg",
    requiredPlan: "business",
  },

  {
    id: "prioritisor",
    name: "Prioritisor",
    tagline: "Smart Task Ranking",
    description:
      "AI-powered prioritization based on ROI, effort, urgency, and strategic alignment. Know what matters most.",
    status: "coming-soon",
    capabilities: [
      "Multi-Factor Analysis",
      "Priority Scoring",
      "AI Recommendations",
      "Custom Weights",
    ],
    color: "purple",
    image: "/dino2/dino1.jpeg",
    requiredPlan: "business",
  },
];

const sidebarNav = [
  { icon: Sparkles, label: "Requisor Agent", href: "#" },
  { icon: Folder, label: "Projects", href: "#" },
  { icon: Brain, label: "AI Agents", href: "#",badge: "Hub" },
  { icon: CreditCard, label: "Pricing", href: "#" },
  { icon: Users, label: "Team", href: "#" },
  { icon: FilePlus, label: "Forms", href: "#" },
];

const colorMap = {
  emerald: {
    bg: "from-emerald-400/30 to-emerald-500/10",
    border: "border-emerald-500 border-1",
    text: "text-emerald-500",
    glow: "glow-emerald",
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    button:
      "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-300   ",
    orb: "bg-emerald-500",
  },
  cyan: {
    bg: "from-cyan-500/20 to-cyan-500/5",
    border: "border-cyan-500/20",
    text: "text-cyan-400",
    glow: "glow-cyan",
    badge: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    button: "bg-cyan-500 hover:bg-cyan-400 text-white",
    orb: "bg-cyan-500",
  },
  purple: {
    bg: "from-purple-500/20 to-purple-500/5",
    border: "border-purple-500/20",
    text: "text-purple-600",
    glow: "glow-purple",
    badge: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    button: "bg-purple-500 hover:bg-purple-400 text-white",
    orb: "bg-purple-500",
  },
  rose: {
    bg: "from-red-500/20 to-red-500/5",
    border: "border-red-500 border-1",
    text: "text-red-500",
    glow: "glow-red",
    badge: "bg-red-500/20 text-red-400 border-red-500/30",
    button: "bg-red-500 hover:bg-red-400 text-white",
    orb: "bg-red-500",
  },
  amber: {
    bg: "from-amber-500 to-amber-500",
    border: "border-amber-500 border-1",
    text: "text-amber-400",
    glow: "glow-amber",
    badge: "bg-amber-500 text-amber-400 border-amber-500",
    button: "bg-amber-500 hover:bg-amber-400 text-white",
    orb: "bg-amber-500",
  },
  sky: {
    bg: "from-purple-500/20 to-purple-500/5",
    border: "border-purple-500 border-1",
    text: "text-purple-600",
    glow: "glow-purple",
    badge: "bg-purple-500 text-purple-400 border-purple-500",
    button:
      "bg-purple-600 hover:bg-purple-400 text-white border border-purple-300 hover:border-2",
    orb: "bg-purple-500",
  },
  slate: {
    bg: "from-slate-500/20 to-slate-500/5",
    border: "border-slate-500/20",
    text: "text-slate-400",
    glow: "",
    badge: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    button: "bg-slate-600 hover:bg-slate-500 text-white",
    orb: "bg-slate-500",
  },
};

function FeaturedCard({ agent, userPlan, onUpgrade }: { agent: Agent; userPlan: PlanTier; onUpgrade: () => void }) {
  const [, setLocation] = useLocation();
  const colors = colorMap[agent.color];
  const locked = !hasAccess(userPlan, agent.requiredPlan);

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-120px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="group relative
      col-span-1 row-span-1
      sm:col-span-2 sm:row-span-2"
      data-testid={`card-featured-${agent.id}`}
    >

      <div
        className={`relative h-full rounded-3xl overflow-hidden
w-full sm:w-4/5 lg:w-3/5
mx-auto backdrop-blur-2xl dark:bg-white/[0.06] bg-gradient-to-br ${colors.bg}
            border ${colors.border} 
            dark:shadow-[0_30px_120px_rgba(0,0,0,0.55)]
            transition-all duration-700

          `}
      >
        <div className="absolute inset-0 noise opacity-[0.08]" />

        <div
          className="
            pointer-events-none absolute inset-0
            bg-gradient-to-r from-transparent via-white/10 to-transparent
            translate-x-[-120%] group-hover:translate-x-[120%]
            transition-transform duration-[1600ms]
          "
        />

        <div className="relative p-3 sm:p-4 md:p-6 h-full flex flex-col">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center ">
              {agent.image && (
                <div
                  className={`
                      relative 
                      rounded-2xl overflow-hidden  
                    `}
                >
                  <img
                    src={agent.image}
                    alt={agent.name}
                    loading="lazy"
                    className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 object-cover"
                  />
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20 pointer-events-none" />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                    <div className="absolute inset-0 rounded-full bg-red-300/50 blur-md opacity-60" />
                  </div>
                  <span
                    className={`text-sm font-mono uppercase md:tracking-[0.2em] ${colors.text}`}
                  >
                    Featured Agent
                  </span>
                </div>
              </div>
            </div>

            <Badge
              variant="outline"
              className={` border ${colors.border} ${colors.text} ${colors.bg} backdrop-blur flex items-center `}
            >
              <Zap className="w-3 h-3 mr-1   animate-[zap-flicker_2.2s_linear_infinite]" />
              <style>
                {`@keyframes zap-flicker {
  0%, 100% { opacity: 1; }
  40% { opacity: 0.4; }
  60% { opacity: 1; }
  80% { opacity: 0.6; }
}

`}
              </style>
              Active
            </Badge>
            {locked && (
              <Badge
                variant="outline"
                className="border border-violet-500/40 bg-violet-500/15 text-violet-300 backdrop-blur flex items-center"
              >
                <Lock className="w-3 h-3 mr-1" />
                {agent.requiredPlan === "pro" ? "Pro" : "Business"}
              </Badge>
            )}
          </div>

          <div className="flex-1">
            <h2
              className={`md:text-2xl text-lg font-bold mb-1 ${colors.text}`}
            >
              {agent.name}
            </h2>

            <p
              className={`md:text-base text-sm font-medium mb-1 ${colors.text}`}
            >
              {agent.tagline}
            </p>

            <p
              className={`md:text-sm text-xs leading-relaxed  max-w-md ${colors.text}`}
            >
              {agent.description}
            </p>
          </div>

          {agent.stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3">
              {agent.stats.map((stat, i) => (
                <div key={i} className="space-y-1">
                  <p className={`md:text-xl text-base font-semibold dark:text-white ${colors.text} `}>
                    {stat.value}
                  </p>
                  <p className={`md:text-[11px] text-[9px] dark:text-white/40 ${colors.text} uppercase tracking-widest`}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1 mb-5">
            {agent.capabilities.map((cap, i) => (
              <span
                key={i}
                className={`
                    px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full text-xs font-medium
                    dark:bg-white/5 bg-black/5 dark:text-white/70 ${colors.text}
                    border border-white/10
                    backdrop-blur
                    hover:bg-emerald-500/10 hover:border-emerald-400/30
                    transition
                  `}
              >
                {cap}
              </span>
            ))}
          </div>

          <Button
            size="lg"
            onClick={() => {
              if (locked) {
                onUpgrade();
              } else if (agent.route) {
                setLocation(agent.route);
              }
            }}
            disabled={!agent.route && !locked}
            data-testid={`button-launch-${agent.id}`}
            className={`
                group/btn w-full sm:w-fit rounded-xl border border-white/10
                ${locked ? "bg-slate-600 hover:bg-slate-500 text-white" : colors.button}
                text-white font-semibold
                transition-all
              `}
          >
            {locked ? (
              <>
                <Lock className="md:w-4 w-2 md:h-4 h-2 mr-2" />
                Upgrade to {agent.requiredPlan === "pro" ? "Pro" : "Business"}
                <ArrowRight className="md:w-4 w-2 md:h-4 h-2 ml-2 transition-transform group-hover/btn:translate-x-1" />
              </>
            ) : (
              <>
                <Rocket className="md:w-4 w-2 md:h-4 h-2 mr-2" />
                Launch Agent
                <ArrowRight className="md:w-4 w-2 md:h-4 h-2 ml-2 transition-transform group-hover/btn:translate-x-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function AgentCard({ agent, index, userPlan, onUpgrade }: { agent: Agent; index: number; userPlan: PlanTier; onUpgrade: () => void }) {
  const [, setLocation] = useLocation();
  const colors = colorMap[agent.color];
  const isDisabled = agent.status === "coming-soon";
  const isBeta = agent.status === "beta";
  const locked = !hasAccess(userPlan, agent.requiredPlan);

  const icons: Record<string, typeof Bot> = {
    requisor: FolderKanban,
    "agile-planning": Target,
    "budget-quote": DollarSign,
    prioritisor: BarChart3,
    sociasor: Share2,
    ideasor: Lightbulb,
    datasor: BarChart3,
    crmsor: Users,
  };

  const Icon = icons[agent.id] || Bot;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.6,
        delay: index * 0.1,
        type: "spring",
        stiffness: 100,
        damping: 15,
      }}
      whileHover={{ y: -8, transition: { duration: 0.3 } }}
      className="group relative"
      data-testid={`card-agent-${agent.id}`}
    >
      <div
        className="
          absolute inset-0 rounded-2xl
          opacity-0 group-hover:opacity-100
          transition-opacity duration-500
          bg-gradient-to-br

          from-emerald-50 via-emerald-100/70 to-emerald-200/40

          dark:from-slate-900
          dark:via-slate-900/90
          dark:to-slate-800
        "
      />



      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_50%,rgba(255,255,255,0.03)_50%)] bg-[length:10px_10px]" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(255,255,255,0.03)_50%)] bg-[length:10px_10px]" />
      </div>

      <div
        className={`absolute -inset-px rounded-2xl bg-gradient-to-r from-transparent via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
          isDisabled
            ? "group-hover:via-slate-600/30"
            : isBeta
              ? "group-hover:via-amber-500/40"
              : "group-hover:via-cyan-400/40"
        }`}
      />

      <div
        className={`relative h-full rounded-2xl border backdrop-blur-sm transition-all duration-300 overflow-hidden ${
          !isDisabled
          ? "border-emerald-200/60 hover:border-emerald-300/80 bg-white/70 text-slate-800 dark:border-white/10 dark:hover:border-white/30 dark:bg-slate-900/50 dark:text-white cursor-pointer" : "border-emerald-200/40 bg-white/50 text-slate-500 dark:border-white/5 dark:bg-slate-900/40 dark:text-slate-400 opacity-60"}`}
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div className="absolute top-1/4 -left-20 w-40 h-40 bg-gradient-to-r from-cyan-500/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-20 w-40 h-40 bg-gradient-to-l from-blue-500/10 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="absolute top-0 left-0 w-12 h-12">
          <div className="absolute top-2 left-2 w-2 h-2 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-sm" />
          <div className="absolute top-0 left-0 w-4 h-px bg-gradient-to-r from-cyan-400/50 to-transparent" />
          <div className="absolute top-0 left-0 h-4 w-px bg-gradient-to-b from-cyan-400/50 to-transparent" />
        </div>
        <div className="absolute bottom-0 right-0 w-12 h-12">
          <div className="absolute bottom-2 right-2 w-2 h-2 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-sm" />
          <div className="absolute bottom-0 right-0 w-4 h-px bg-gradient-to-l from-blue-500/50 to-transparent" />
          <div className="absolute bottom-0 right-0 h-4 w-px bg-gradient-to-t from-blue-500/50 to-transparent" />
        </div>

        <div className="relative p-6 md:space-y-5 space-y-2">
          <div className="flex items-start justify-between">
            <div
              className={`relative md:w-14 w-8 md:h-14 h-8 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center group/icon overflow-hidden`}
            >
              <div
                className={`absolute inset-0 opacity-0 group-hover/icon:opacity-100 transition-opacity duration-500 rounded-xl ${
                  isDisabled
                    ? "bg-gradient-to-br from-slate-600/20 to-transparent"
                    : isBeta
                      ? "bg-gradient-to-br from-amber-500/20 to-transparent"
                      : "bg-gradient-to-br from-cyan-500/20 to-transparent"
                }`}
              />

              <Icon
                className={`relative md:w-6 w-4 md:h-6 h-4 ${colors.text} transition-transform duration-500 group-hover/icon:scale-110 group-hover/icon:rotate-6`}
              />

              {!isDisabled && !isBeta && (
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400/30 to-transparent rounded-xl opacity-0 group-hover/icon:opacity-100 animate-pulse" />
              )}
            </div>

            <Badge
              variant="outline"
              className={`relative px-2 md:px-3 md:py-1.5 py-1 rounded-lg border backdrop-blur-sm text-xs font-medium transition-all duration-300 ${
                isDisabled
                  ? "bg-slate-800/60 text-slate-400 border-slate-700/50 hover:border-slate-600/80"
                  : isBeta
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/40 hover:border-amber-400/60 hover:bg-amber-500/20"
                    : "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:border-cyan-400/50 hover:bg-cyan-500/15"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {isDisabled ? (
                  <Clock className="w-3 h-3" />
                ) : isBeta ? (
                  <Star className="w-3 h-3" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                <span className="relative">
                  {isDisabled ? "Soon" : isBeta ? "Beta" : "Live"}
                  <span
                    className={`absolute inset-0 blur opacity-0 group-hover:opacity-70 ${
                      isDisabled
                        ? "text-slate-400"
                        : isBeta
                          ? "text-amber-300"
                          : "text-cyan-300"
                    }`}
                  >
                    {isDisabled ? "Soon" : isBeta ? "Beta" : "Live"}
                  </span>
                </span>
              </div>
            </Badge>

            {locked && !isDisabled && (
              <Badge
                variant="outline"
                className="px-2 md:px-3 md:py-1.5 py-1 rounded-lg border backdrop-blur-sm text-xs font-medium bg-violet-500/15 text-violet-300 border-violet-500/40"
              >
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  <span>{agent.requiredPlan === "pro" ? "Pro" : "Business"}</span>
                </div>
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
                <h3 className="md:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {agent.name}
              </h3>
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300/90 tracking-wide">
              {agent.tagline}
            </p>
          </div>
          <motion.p
            initial={{ opacity: 0.8 }}
            whileHover={{ opacity: 1 }}
            className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2 transition-opacity duration-300"
          >
            {agent.description}
          </motion.p>
          <div className="flex flex-wrap gap-2 pt-1">
            {agent.capabilities.slice(0, 3).map((cap, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                whileHover={{ scale: 1.05, y: -2 }}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm border transition-all duration-300 ${
                  isDisabled
                    ? "bg-slate-800/30 text-slate-400 border-slate-700/40"
                    : isBeta
                      ? "bg-amber-500/10 text-amber-300 border-amber-500/20 hover:bg-amber-500/15"
                      : "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 dark:bg-cyan-500/5 dark:text-cyan-300 dark:border-cyan-500/20 dark:hover:bg-cyan-500/10"
                }`}
              >
                {cap}
                <span
                  className={`absolute inset-0 rounded-lg opacity-0 group-hover:opacity-30 blur transition-opacity duration-300 ${
                    isDisabled
                      ? "bg-slate-400"
                      : isBeta
                        ? "bg-amber-400"
                        : "bg-cyan-400"
                  }`}
                />
              </motion.span>
            ))}
          </div>
          <div className="pt-4">
            {locked && !isDisabled ? (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={onUpgrade}
                  variant="ghost"
                  className="w-full relative group/btn font-medium border backdrop-blur-sm overflow-hidden transition-all duration-300 bg-gradient-to-r from-violet-500/20 to-purple-600/10 hover:from-violet-500/30 hover:to-purple-600/20 text-violet-700 border-violet-400/40 hover:border-violet-500/60 dark:from-violet-600/20 dark:to-purple-600/10 dark:hover:from-violet-600/30 dark:hover:to-purple-600/20 dark:text-violet-300 dark:border-violet-500/30 dark:hover:border-violet-400/50"
                  size="sm"
                >
                  <Lock className="w-4 h-4 mr-2 relative z-10" />
                  <span className="relative z-10">Upgrade to {agent.requiredPlan === "pro" ? "Pro" : "Business"}</span>
                  <ArrowUpRight className="w-4 h-4 ml-auto opacity-60 group-hover/btn:opacity-100 transition-all duration-300 relative z-10" />
                </Button>
              </motion.div>
            ) : !isDisabled ? (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={() => agent.route && setLocation(agent.route)}
                  disabled={!agent.route}
                  variant="ghost"
                  className={`w-full relative group/btn font-medium border backdrop-blur-sm overflow-hidden transition-all duration-300 ${
                    isBeta
                      ? "bg-gradient-to-br from-yellow-600/20 to-yellow-700/10 hover:from-amber-600/30 hover:to-yellow-700/20 text-yellow-300 border-yellow-500/30 hover:border-amber-400/50"
                      : "bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 hover:from-emerald-500/30 hover:to-emerald-600/20 text-emerald-700 border-emerald-400/40 hover:border-emerald-500/60 dark:from-cyan-600/20 dark:to-blue-600/10 dark:hover:from-cyan-600/30 dark:hover:to-blue-600/20 dark:text-cyan-300 dark:border-cyan-500/30 dark:hover:border-cyan-400/50 "
                  }`}
                  size="sm"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />

                  <Play className="w-4 h-4 mr-2 relative z-10" />
                  <span className="relative z-10">Launch</span>
                  <ArrowUpRight className="w-4 h-4 ml-auto opacity-60 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-all duration-300 relative z-10" />
                </Button>
              </motion.div>
            ) : (
              <Button
                variant="ghost"
                className="w-full text-slate-500 hover:text-slate-400 hover:bg-slate-800/30 border border-transparent hover:border-slate-700/50"
                size="sm"
                disabled
              >
                <Clock className="w-4 h-4 mr-2" />
                Coming Soon
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const agentPacks = [
  {
    id: "agency",
    name: "Agency Pack",
    audience: "Agencies",
    description: "Manage multiple client projects with ease",
    agents: ["requisor", "budget-quote", "agile-planning", "sociasor"],
    color: "emerald",
  },
  {
    id: "marketing",
    name: "Marketing Team",
    audience: "Marketing Teams",
    description: "Plan campaigns and track performance",
    agents: ["sociasor", "ideasor", "prioritisor"],
    color: "rose",
  },
  {
    id: "consultant",
    name: "Consultant Suite",
    audience: "Consultants",
    description: "Scope projects and deliver proposals fast",
    agents: ["budget-quote", "requisor", "prioritisor"],
    color: "cyan",
  },
  {
    id: "startup",
    name: "Startup Essentials",
    audience: "Startups & Founders",
    description: "Move fast from idea to execution",
    agents: ["requisor", "agile-planning", "ideasor"],
    color: "purple",
  },
];

function PackFinderInline() {
  const [selectedPack, setSelectedPack] = useState<
    (typeof agentPacks)[0] | null
  >(null);

  const getAgentByIds = (ids: string[]) =>
    agents.filter((a) => ids.includes(a.id));
  const packIcons: Record<string, typeof Users> = {
    agency: Users,
    marketing: Share2,
    consultant: DollarSign,
    startup: Rocket,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="d:mb-8 mb-3"
      data-testid="pack-finder-section"
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-6 h-6 text-emerald-400" />
        <span className="text-xs md:text-base font-medium text-gray-400">
          Quick start — Choose your team type
        </span>
      </div>

      <div className="flex flex-wrap md:gap-3 gap-2">
        {agentPacks.map((pack) => {
          const Icon = packIcons[pack.id] || Users;
          const isSelected = selectedPack?.id === pack.id;

          return (
            <button
              key={pack.id}
              onClick={() => setSelectedPack(isSelected ? null : pack)}
              className={`flex items-center md:gap-2.5 px-2 md:py-1.5 py-1 rounded-xl border transition-all ${
                isSelected
                  ? "bg-emerald-500/15  border-emerald-500/30 text-emerald-400"
                  : "dark:bg-white/5  dark:border-white/30 border-emerald-500 dark:text-white/50 text-emerald-500/90 hover:bg-emerald-400/50 hover:border-emerald-500 hover:text-emerald-50"
              }`}
              data-testid={`pack-option-${pack.id}`}
            >
              <Icon className="w-3 h-3" />
              <span className="text-xs font-medium">{pack.audience}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedPack && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className=" md:w-3/5 w-auto mt-4 md:p-4 p-2 rounded-2xl glass border dark:border-white/30 dark:bg-white/5 bg-emerald-400/5 border-emerald-500"
              data-testid="pack-details"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between md:gap-4 gap-2 mb-4">
                <div>
                  <p className="text-xs dark:text-emerald-400 uppercase tracking-wider mb-1 text-emerald-500">
                    Recommended for {selectedPack.audience}
                  </p>
                  <p className="md:text-lg text-base font-semibold dark:text-gray-500 text-gray-600">
                    {selectedPack.name}
                  </p>
                  <p className="text-sm dark:text-gray-500 text-gray-600">
                    {selectedPack.description}
                  </p>
                </div>

                <button
                  className="relative inline-flex md:h-12 h-8 active:scale-95 transistion overflow-hidden rounded-lg p-[1px] focus:outline-none hover:scale-105 "
                  data-testid="button-launch-pack"
                >
                  <span
                    className="
                      absolute inset-[-1000%]
                      animate-[spin_3s_linear_infinite]
                      bg-[conic-gradient(from_90deg_at_50%_50%,#ecfdf5_0%,#a7f3d0_35%,#34d399_65%,#d1fae5_100%)]
                      dark:bg-[conic-gradient(from_90deg_at_50%_50%,#022c22_0%,#065f46_40%,#10b981_70%,#064e3b_100%)]
                    "
                  ></span>


                  <span
                    className="
                      inline-flex h-full w-full cursor-pointer
                      items-center justify-center gap-2
                      rounded-xl md:px-7 px-4 md:py-3 py-1/5 text-sm font-semibold
                      backdrop-blur-xl
                      transition-all duration-300

                      bg-emerald-300 text-emerald-700

                      hover:bg-emerald-100 hover:scale-[1.02]

                      dark:bg-emerald-950/60 dark:text-emerald-300

                      dark:hover:bg-emerald-900/70

                      shadow-sm hover:shadow-md
                    "
                  >
                    <Rocket className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />

                    <span>Launch Pack</span>

                    <ArrowRight className="w-4 h-4 text-emerald-700 dark:text-emerald-400 group-hover:translate-x-1 transition-transform" />
                  </span>

                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {getAgentByIds(selectedPack.agents).map((agent) => {
                  const colors = colorMap[agent.color];
                  return (
                    <div
                      key={agent.id}
                      className="flex items-center md:gap-2 gap-1 md:px-3 px-1 md:py-2 py-1 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div
                        className={`md:w-6 w-3 md:h-6 h-3 rounded-md bg-gradient-to-br ${colors.bg} border ${colors.border} flex items-center justify-center ${colors.text} `}
                      >
                        <Zap className="md:w-3 w-2 md:h-3 h-2" />
                      </div>
                      <span className={` text-xs font-medium ${colors.text} `}>
                        {agent.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function Hub() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [activeItem, setActiveItem] = useState("AI Agents"); 
  const { showUpgrade } = useUpgradeModal();

  const { data: tokenBudget } = useQuery<{
    planSlug: string;
    planName: string;
  }>({
    queryKey: ["/api/tokens/budget"],
    staleTime: 0,
  });

  const rawSlug = tokenBudget?.planSlug || "free";
  const normalizedSlug = rawSlug in PLAN_HIERARCHY ? rawSlug : "free";
  const userPlan: PlanTier = normalizedSlug as PlanTier;

  const handleUpgrade = () => {
    showUpgrade("agent_access");
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "light");
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  const filteredAgents = useMemo(() => {
    if (!searchTerm.trim()) return agents;
    const term = searchTerm.toLowerCase();
    return agents.filter(
      (agent) =>
        agent.id.toLowerCase().includes(term) ||
        agent.name.toLowerCase().includes(term) ||
        agent.description.toLowerCase().includes(term) ||
        agent.tagline.toLowerCase().includes(term) ||
        agent.status.toLowerCase().includes(term) ||
        agent.capabilities.some((cap) => cap.toLowerCase().includes(term))
    );
  }, [searchTerm]);

  const featuredAgents = useMemo(() => 
    filteredAgents.filter((a) => a.featured), 
    [filteredAgents]
  );

  const otherAgents = useMemo(() => 
    filteredAgents.filter((a) => !a.featured), 
    [filteredAgents]
  );

  return (
    <div
      className="flex min-h-screen bg-background dark:bg-[linear-gradient(120deg,#020617,#0a1628,#020617,#0a1628)] dark:bg-[length:300%_300%] dark:animate-live-gradient"
      data-testid="page-ai-agents-hub"
    >
      <style>
        {`@keyframes live-gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.animate-live-gradient {
  animation: live-gradient 12s ease infinite;
}
`}
      </style>

      

      {/* <motion.main 
        initial={false}
        animate={{ marginLeft: sidebarOpen ? 240 : 72 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className="flex-1 relative z-10 overflow-auto min-h-screen"
      > */}
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
          <motion.header
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative z-10 py-12 text-center overflow-hidden"
          >

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[150px] bg-emerald-500/20 blur-[100px] overflow-visible rounded-full pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center max-w-3xl mx-auto px-4">
              {/* Badge */}
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)] mb-8"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs  font-medium text-emerald-100 tracking-wider uppercase">
                  Next Gen Workforce
                </span>
              </motion.div>

              {/* Title */}
              <h1 className="text-3xl md:text-6xl  font-bold tracking-tight dark:text-white text-emeral-500 mb-6">
                Scale with intelligent <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 animate-gradient-x bg-[length:200%_auto]">
                  Digital Agents
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-base md:text-xl text-zinc-500 dark:text-zinc-400 max-w-xl leading-relaxed">
                Unlock 24/7 productivity. From complex problem solving to routine automation, deploy agents that evolve with your business.
              </p>
            </div>
          </motion.header>


          <PackFinderInline />

          {/* <div className="flex justify-center md:mb-16 mb-10 md:mt-12 mt-6 md:px-4 px-2">
            <div className="md:w-full  max-w-sm relative group">
              <div
                className="
                    absolute -inset-[1px] rounded-2xl
                    bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500
                    opacity-40 blur-sm
                    group-focus-within:opacity-100
                    transition duration-500
                    animate-gradient
                  "
              />

              <div
                className="
                    relative flex items-center gap-3
                    rounded-2xl
                    bg-card dark:bg-slate-900/80 backdrop-blur-xl
                    border border-border
                    px-5 py-3
                    shadow-xl
                  "
              >
                <div className="text-emerald-600 dark:text-cyan-400">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>

                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  type="text"
                  placeholder="Search AI agents, tools, workflows..."
                  className="
                        flex-1 bg-transparent
                        text-foreground placeholder:text-muted-foreground
                        text-base
                        outline-none
                      "
                />

                <div
                  className="
                      w-2 h-2 rounded-full
                      bg-emerald-400
                      animate-pulse
                    "
                />
              </div>
            </div>
          </div> */}

          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/50 border border-border">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="text-sm font-medium text-foreground/80">
                  Featured
                </span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              {featuredAgents.map((agent) => (
                <FeaturedCard key={agent.id} agent={agent} userPlan={userPlan} onUpgrade={handleUpgrade} />
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/50 border border-border">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  All Agents
                </span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
            </div>

            <AnimatePresence mode="popLayout">
              <motion.div
                layout
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {otherAgents.map((agent, index) => (
                  <AgentCard key={agent.id} agent={agent} index={index} userPlan={userPlan} onUpgrade={handleUpgrade} />
                ))}
              </motion.div>
            </AnimatePresence>
          </section>

          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-10 md:mt-20 p-3 rounded-3xl relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800" />
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_50%,rgba(168,85,247,0.1)_50%)] bg-[length:30px_30px]" />
              <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(168,85,247,0.1)_50%)] bg-[length:30px_30px]" />
            </div>
            <div className="absolute -top-40 -right-40 w-[400px] h-[400px]">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/40 via-violet-500/30 to-transparent rounded-full blur-3xl animate-pulse" />
              <div className="absolute inset-10 bg-gradient-to-br from-purple-500/20 to-pink-500/10 rounded-full animate-spin-slow" />
            </div>

            <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px]">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/30 via-cyan-500/20 to-transparent rounded-full blur-3xl opacity-70" />
            </div>

            <div className="absolute -inset-px rounded-3xl bg-gradient-to-r from-transparent via-purple-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute top-4 left-4 w-8 h-8">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-purple-400/50 rounded-tl-lg" />
            </div>
            <div className="absolute top-4 right-4 w-8 h-8">
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-purple-400/50 rounded-tr-lg" />
            </div>
            <div className="absolute bottom-4 left-4 w-8 h-8">
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-purple-400/50 rounded-bl-lg" />
            </div>
            <div className="absolute bottom-4 right-4 w-8 h-8">
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-purple-400/50 rounded-br-lg" />
            </div>

            <div className="absolute inset-0 overflow-hidden">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-cyan-400/30 rounded-full"
                  initial={{
                    x: Math.random() * 100 + "%",
                    y: Math.random() * 100 + "%",
                    opacity: 0.3,
                  }}
                  animate={{
                    y: ["0%", "-100%", "0%"],
                    opacity: [0.3, 0.8, 0.3],
                  }}
                  transition={{
                    duration: 3 + i * 0.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-3">
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-6"
              >
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-br from-purple-500/30 to-cyan-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative md:w-16 w-10 md:h-16 h-10 rounded-2xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 backdrop-blur-sm border border-purple-500/30 flex items-center justify-center group/icon overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-purple-500/10 to-transparent opacity-0 group-hover/icon:opacity-100 transition-opacity duration-500" />
                    <Puzzle className="relative md:w-7 w-4 md:h-7 h-4 text-purple-400 group-hover:text-purple-300 transition-colors duration-300" />

                    <div className="absolute inset-0 border-2 border-purple-400/30 rounded-2xl opacity-0 group-hover:opacity-100 animate-ping-slow" />
                  </div>
                </div>
                <div className="space-y-1 max-w-md">
                  <div className="flex items-center gap-2">
                    <h3 className="md:text-lg text-base font-bold bg-gradient-to-r from-purple-300 via-purple-200 to-cyan-300 bg-clip-text text-transparent">
                      Build Your Own Agent
                    </h3>
                    <motion.span
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      transition={{ delay: 0.4, type: "spring" }}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500/20 to-pink-500/10 text-purple-300 border border-purple-500/30"
                    >
                      NEW
                    </motion.span>
                  </div>

                  <p className="text-slate-300/90 leading-relaxed md:text-base text-sm">
                    Train a custom AI agent on your specific workflows and
                    processes.
                    <span className="block mt-1 text-slate-400 text-xs font-medium">
                      Unlock personalized automation tailored to your unique
                      needs.
                    </span>
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      "Custom Training",
                      "API Integration",
                      "Real-time Analytics",
                      "Team Collaboration",
                    ].map((feature, i) => (
                      <motion.span
                        key={feature}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className="px-2 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-slate-300 border border-white/10 hover:border-purple-500/30 hover:bg-purple-500/10 transition-all duration-300 cursor-default"
                      >
                        {feature}
                      </motion.span>
                    ))}
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ x: 20, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="relative shrink-0"
              >
                <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/30 to-cyan-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-500" />

                <Button
                  className="relative px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600/20 via-purple-500/15 to-cyan-500/10 hover:from-purple-600/30 hover:via-purple-500/25 hover:to-cyan-500/20 text-white border border-purple-500/30 hover:border-purple-400/50 backdrop-blur-sm font-medium text-base group/btn transition-all duration-300"
                  size="lg"
                  data-testid="button-custom-agent"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />

                  <div className="relative flex items-center gap-3">
                    <div className="relative">
                      <Shield className="w-5 h-5 text-purple-300 group-hover:text-purple-200 transition-colors duration-300" />

                      <div className="absolute -inset-1 bg-purple-400/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>

                    <span className="font-semibold">
                      Request Access
                    </span>
                    <motion.div
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="ml-1"
                    >
                      <ArrowRight className="w-5 h-5 text-cyan-300" />
                    </motion.div>
                  </div>
                  <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-purple-500/0 via-purple-400/50 to-purple-500/0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
                </Button>
                <p className="text-center text-xs text-slate-500 mt-2 font-medium">
                  Early access available
                </p>
              </motion.div>
            </div>
            <motion.div
              initial={{ width: "0%" }}
              whileInView={{ width: "100%" }}
              transition={{ delay: 0.6, duration: 1 }}
              className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"
            />
          </motion.section>
        </div>
      {/* </motion.main> */}
    </div>
  );
}
export default Hub;
