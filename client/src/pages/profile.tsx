import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import { Coins, TrendingUp, ArrowRight } from "lucide-react";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[a-z]/, "Include at least one lowercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function ProfilePage() {
  const { toast } = useToast();
  const { showUpgrade } = useUpgradeModal();

  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const { data: tokenBudget } = useQuery<{
    allowed: boolean; remaining: number; limit: number; used: number;
    percentUsed: number; warning: boolean; planName: string; planSlug: string;
    projectLimit: { current: number; max: number; allowed: boolean };
  }>({
    queryKey: ["/api/tokens/budget"],
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (payload: ChangePasswordForm) => {
      return apiRequest("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: payload.currentPassword,
          newPassword: payload.newPassword,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      form.reset();
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't change password",
        description: err?.message || "Please verify your current password.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ChangePasswordForm) => {
    changePasswordMutation.mutate(data);
  };

  const percentUsed = tokenBudget ? Math.min(100, Math.round(tokenBudget.percentUsed)) : 0;
  const barColor = percentUsed >= 100 ? "bg-red-500" : percentUsed >= 80 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl">
        <PageHeader
          title="Your Profile"
          description="Manage your account information and settings"
        />

        <div className="mt-6 space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-emerald-50">
                <Coins className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  AI Token Usage
                </h2>
                <p className="text-sm text-slate-500">
                  {tokenBudget?.planName || "Free"} Plan
                </p>
              </div>
            </div>

            {tokenBudget ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      {formatTokenCount(tokenBudget.used)} / {formatTokenCount(tokenBudget.limit)} tokens used
                    </span>
                    <span className={`text-sm font-semibold ${
                      percentUsed >= 100 ? "text-red-600" : percentUsed >= 80 ? "text-amber-600" : "text-emerald-600"
                    }`}>
                      {percentUsed}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${barColor}`}
                      style={{ width: `${percentUsed}%` }}
                    />
                  </div>
                </div>

                {tokenBudget.remaining > 0 && (
                  <p className="text-xs text-slate-500">
                    {formatTokenCount(tokenBudget.remaining)} tokens remaining this month
                  </p>
                )}

                {percentUsed >= 80 && percentUsed < 100 && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      You're approaching your token limit. Consider upgrading for more capacity.
                    </p>
                  </div>
                )}

                {percentUsed >= 100 && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-red-600 flex-shrink-0" />
                    <p className="text-xs text-red-700">
                      You've reached your token limit. Upgrade your plan to continue using AI features.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <Link
                    href="/token-usage"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    View detailed usage
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  {tokenBudget.planSlug !== "enterprise" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-violet-600 border-violet-200 hover:bg-violet-50"
                      onClick={() => showUpgrade("token_limit")}
                    >
                      Upgrade to {tokenBudget.planSlug === "free" ? "Pro" : tokenBudget.planSlug === "pro" ? "Business" : "Enterprise"}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="animate-pulse space-y-3">
                <div className="h-2.5 bg-slate-100 rounded-full" />
                <div className="h-4 bg-slate-100 rounded w-1/3" />
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              Account Information
            </h2>
            <p className="text-sm text-slate-600">
              Here you'll be able to update your personal details.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Security
            </h2>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="••••••••"
                  {...form.register("currentPassword")}
                />
                {form.formState.errors.currentPassword && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.currentPassword.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    {...form.register("newPassword")}
                  />
                  {form.formState.errors.newPassword && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword">
                    Confirm new password
                  </Label>
                  <Input
                    id="confirmNewPassword"
                    type="password"
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    {...form.register("confirmNewPassword")}
                  />
                  {form.formState.errors.confirmNewPassword && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.confirmNewPassword.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                >
                  {changePasswordMutation.isPending
                    ? "Updating..."
                    : "Change Password"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                >
                  Reset
                </Button>
              </div>
            </form>

            <p className="mt-3 text-xs text-slate-500">
              Tip: Use a strong passphrase with a mix of upper/lowercase,
              numbers, and symbols.
            </p>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
