import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Rocket,
  Zap,
  Shield,
  Users,
  FolderKanban,
  Cpu,
  Check,
  ArrowRight,
  Crown,
  AlertTriangle,
} from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: "token_limit" | "project_limit" | "feature_locked" | "agent_access";
}

interface BudgetData {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
  percentUsed: number;
  warning: boolean;
  degradeToMini: boolean;
  planName: string;
  planSlug: string;
  projectLimit: {
    current: number;
    max: number;
    allowed: boolean;
  };
}

const plans = [
  {
    name: "Pro",
    price: 29,
    slug: "pro",
    description: "For solo founders & small teams",
    tokens: "1M",
    projects: 50,
    highlight: true,
    features: [
      "50 projects",
      "1M AI tokens/month",
      "Advanced AI features",
      "Integrations (Jira, Asana)",
      "Team collaboration",
    ],
  },
  {
    name: "Business",
    price: 99,
    slug: "business",
    description: "For growing teams & agencies",
    tokens: "10M",
    projects: 200,
    highlight: false,
    features: [
      "200 projects",
      "10M AI tokens/month",
      "All integrations",
      "Priority support",
      "Custom workflows",
    ],
  },
  {
    name: "Enterprise",
    price: 299,
    slug: "enterprise",
    description: "For large organizations",
    tokens: "20M",
    projects: 1000,
    highlight: false,
    features: [
      "1000 projects",
      "20M AI tokens/month",
      "SSO & custom integrations",
      "Dedicated support",
      "Custom workflows",
    ],
  },
];

const reasonMessages: Record<string, { title: string; subtitle: string; icon: any }> = {
  token_limit: {
    title: "You've reached your AI token limit",
    subtitle: "Upgrade your plan to continue using AI-powered features like project planning, context analysis, and smart prioritization.",
    icon: Cpu,
  },
  project_limit: {
    title: "You've reached your project limit",
    subtitle: "Free plan includes 1 project. Upgrade to create more projects and unlock your full potential.",
    icon: FolderKanban,
  },
  agent_access: {
    title: "AI Agents require a paid plan",
    subtitle: "Free plan doesn't include AI agent access. Upgrade to Pro or Business to unlock powerful AI agents that automate your workflow.",
    icon: Cpu,
  },
  feature_locked: {
    title: "This feature requires an upgrade",
    subtitle: "Unlock advanced capabilities to supercharge your product workflow.",
    icon: Shield,
  },
};

const PLAN_ORDER = ["free", "pro", "business", "enterprise"];

export function UpgradeModal({ open, onClose, reason = "token_limit" }: UpgradeModalProps) {
  const [, navigate] = useLocation();

  const { data: budget } = useQuery<BudgetData>({
    queryKey: ["/api/tokens/budget"],
    enabled: open,
  });

  const { title, subtitle, icon: ReasonIcon } = reasonMessages[reason] || reasonMessages.token_limit;

  const currentSlug = budget?.planSlug || "free";
  const currentIndex = PLAN_ORDER.indexOf(currentSlug);
  const upgradePlans = plans.filter((p) => PLAN_ORDER.indexOf(p.slug) > currentIndex);

  const tokenPercent = budget ? Math.min(100, budget.percentUsed) : 0;
  const projectPercent = budget?.projectLimit
    ? Math.min(100, (budget.projectLimit.current / Math.max(1, budget.projectLimit.max)) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[900px] p-0 gap-0 overflow-hidden">
        <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/15 rounded-lg backdrop-blur-sm">
                <ReasonIcon className="h-6 w-6" />
              </div>
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                {budget?.planName || "Free"} Plan
              </Badge>
            </div>
            <DialogTitle className="text-xl font-bold text-white">{title}</DialogTitle>
            <p className="text-sm text-white/80 mt-1">{subtitle}</p>
          </DialogHeader>

          {budget && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-white/70 flex items-center gap-1">
                    <Cpu className="h-3 w-3" /> AI Tokens
                  </span>
                  <span className="text-xs font-medium">
                    {budget.used >= 1000 ? `${(budget.used / 1000).toFixed(1)}K` : budget.used} / {budget.limit >= 1000 ? `${(budget.limit / 1000).toFixed(1)}K` : budget.limit}
                  </span>
                </div>
                <Progress
                  value={tokenPercent}
                  className="h-1.5 bg-white/20"
                />
                {budget.percentUsed >= 100 && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-amber-200">
                    <AlertTriangle className="h-3 w-3" /> Limit reached
                  </div>
                )}
              </div>
              <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-white/70 flex items-center gap-1">
                    <FolderKanban className="h-3 w-3" /> Projects
                  </span>
                  <span className="text-xs font-medium">
                    {budget.projectLimit.current} / {budget.projectLimit.max}
                  </span>
                </div>
                <Progress
                  value={projectPercent}
                  className="h-1.5 bg-white/20"
                />
                {!budget.projectLimit.allowed && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-amber-200">
                    <AlertTriangle className="h-3 w-3" /> Limit reached
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6">
          {upgradePlans.length > 0 ? (
            <div className={`grid grid-cols-1 ${upgradePlans.length === 1 ? "sm:max-w-sm mx-auto" : upgradePlans.length === 2 ? "sm:grid-cols-2 sm:max-w-2xl mx-auto" : "sm:grid-cols-3"} gap-4`}>
              {upgradePlans.map((plan, i) => {
                const isRecommended = i === 0;
                return (
                  <div
                    key={plan.slug}
                    className={`relative rounded-xl border-2 p-4 transition-all ${
                      isRecommended
                        ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 shadow-md"
                        : "border-border hover:border-violet-300"
                    }`}
                  >
                    {isRecommended && (
                      <Badge className="absolute -top-2.5 left-4 bg-violet-600 text-white text-xs">
                        <Rocket className="h-3 w-3 mr-1" /> Recommended
                      </Badge>
                    )}
                    <div className="mb-3 pt-1">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        {plan.name}
                        {!isRecommended && <Crown className="h-4 w-4 text-amber-500" />}
                      </h3>
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    </div>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-bold">${plan.price}</span>
                      <span className="text-sm text-muted-foreground">/month</span>
                    </div>
                    <ul className="space-y-2 mb-4">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full ${
                        isRecommended
                          ? "bg-violet-600 hover:bg-violet-700 text-white"
                          : ""
                      }`}
                      variant={isRecommended ? "default" : "outline"}
                      onClick={() => {
                        onClose();
                        navigate("/pricing");
                      }}
                    >
                      Upgrade to {plan.name}
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <Crown className="h-10 w-10 text-amber-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-800">You're on our top plan!</h3>
              <p className="text-sm text-muted-foreground mt-1">You already have access to all features.</p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Continue with {budget?.planName || "current"} plan
            </button>
            {currentSlug !== "free" && (
              <button
                onClick={() => { onClose(); navigate("/pricing"); }}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                View all plans
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
