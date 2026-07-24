import { useQuery } from "@tanstack/react-query";
import { Coins, TrendingUp, Zap, AlertTriangle, BarChart3, Clock, Rocket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";

interface TokenBudget {
  limit: number;
  used: number;
  remaining: number;
  percentUsed: number;
  warning: boolean;
  exceeded: boolean;
}

interface FeatureUsage {
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  callCount: number;
}

interface RecentCall {
  id: number;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  createdAt: string;
}

interface TokenUsageSummary {
  budget: TokenBudget;
  today: { totalTokens: number; totalCost: number; callCount: number };
  monthly: { byFeature: FeatureUsage[] };
  recentCalls: RecentCall[];
}

const featureLabels: Record<string, string> = {
  "plan-mode-chat": "Plan Mode Chat",
  "build-mode-chat": "Build Mode Chat",
  "deep-planner-generate": "Project Generation",
  "deep-planner-clarify": "Project Clarification",
  "context-brain": "Context Brain",
  "rice-scoring": "Feature Scoring (RICE)",
  "feature-refinement": "Feature Refinement",
  "team-ai-chat": "Team AI Chat",
  "rga-classify": "RGA Classification",
  "rga-recommendations": "RGA Recommendations",
  "subtask-generation": "Subtask Generation",
  "smart-assignments": "Smart Assignments",
  "audio-transcription": "Audio Transcription",
  "meeting-summary": "Meeting Summary",
  "usage-data-analysis": "Usage Data Analysis",
};

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

function getFeatureLabel(feature: string): string {
  return featureLabels[feature] || feature.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TokenUsagePage() {
  const { data, isLoading } = useQuery<TokenUsageSummary>({
    queryKey: ["/api/tokens/usage"],
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });
  const { data: budgetData } = useQuery<{ planSlug: string; ownKeyActive?: boolean }>({
    queryKey: ["/api/tokens/budget"],
  });
  const ownKeyActive = budgetData?.ownKeyActive ?? false;
  const { showUpgrade } = useUpgradeModal();
  const planSlug = budgetData?.planSlug || "free";
  const nextPlanName = planSlug === "free" ? "Pro" : planSlug === "pro" ? "Business" : "Enterprise";

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Coins className="h-6 w-6 text-amber-500" />
          AI Token Usage
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const budget = data?.budget || { limit: 1000000, used: 0, remaining: 1000000, percentUsed: 0, warning: false, exceeded: false };
  const today = data?.today || { totalTokens: 0, totalCost: 0, callCount: 0 };
  const byFeature = data?.monthly?.byFeature || [];
  const recentCalls = data?.recentCalls || [];

  const totalMonthlyTokens = byFeature.reduce((sum, f) => sum + f.totalTokens, 0);
  const totalMonthlyCalls = byFeature.reduce((sum, f) => sum + f.callCount, 0);

  const progressColor = budget.exceeded
    ? "bg-red-500"
    : budget.warning
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Coins className="h-6 w-6 text-amber-500" />
          AI Token Usage
        </h1>
        <div className="flex items-center gap-2">
          {ownKeyActive && (
            <Badge className="flex items-center gap-1 bg-emerald-100 text-emerald-800 border-emerald-300" data-testid="badge-own-key">
              <Zap className="h-3 w-3" />
              Your Claude key &middot; no limits
            </Badge>
          )}
          {!ownKeyActive && budget.exceeded && (
            <Button
              size="sm"
              onClick={() => showUpgrade("token_limit")}
              className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
            >
              <Rocket className="h-3.5 w-3.5" />
              Upgrade to {nextPlanName}
            </Button>
          )}
          {!ownKeyActive && budget.exceeded && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Monthly Limit Reached
            </Badge>
          )}
          {!ownKeyActive && budget.warning && !budget.exceeded && (
            <Badge variant="secondary" className="flex items-center gap-1 bg-amber-100 text-amber-800 border-amber-300">
              <AlertTriangle className="h-3 w-3" />
              Approaching Limit ({budget.percentUsed}%)
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Zap className="h-4 w-4" />
              Monthly Budget
            </div>
            {ownKeyActive ? (
              <>
                <div className="text-2xl font-bold">Unlimited</div>
                <p className="text-sm text-muted-foreground mt-2">
                  You're using your own Claude key, so platform token caps don't apply. Usage below
                  is billed directly by Anthropic.
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{formatTokenCount(budget.used)} / {formatTokenCount(budget.limit)}</div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{budget.percentUsed}% used</span>
                    <span>{formatTokenCount(budget.remaining)} remaining</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${progressColor}`}
                      style={{ width: `${Math.min(100, budget.percentUsed)}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              This Month
            </div>
            <div className="text-2xl font-bold">{formatTokenCount(totalMonthlyTokens)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {totalMonthlyCalls} AI calls
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              Today
            </div>
            <div className="text-2xl font-bold">{formatTokenCount(today.totalTokens)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {today.callCount} AI calls
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Usage by Feature
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byFeature.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No AI usage recorded yet. Start using AI features to see your breakdown here.</p>
            ) : (
              <div className="space-y-3">
                {byFeature
                  .sort((a, b) => b.totalTokens - a.totalTokens)
                  .map((f, idx) => {
                    const percent = totalMonthlyTokens > 0 ? (f.totalTokens / totalMonthlyTokens) * 100 : 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{getFeatureLabel(f.feature)}</span>
                            <Badge variant="outline" className="text-xs">{f.model}</Badge>
                          </div>
                          <div className="text-muted-foreground">
                            {formatTokenCount(f.totalTokens)} &middot; {f.callCount} calls
                          </div>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-teal-500 transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent AI Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent AI calls.</p>
            ) : (
              <div className="space-y-2">
                {recentCalls.slice(0, 15).map((call) => (
                  <div key={call.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="text-sm font-medium">{getFeatureLabel(call.feature)}</div>
                      <div className="text-xs text-muted-foreground">
                        {call.model} &middot; {getTimeAgo(call.createdAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono">{formatTokenCount(call.totalTokens)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatTokenCount(call.inputTokens)} in &middot; {formatTokenCount(call.outputTokens)} out
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
