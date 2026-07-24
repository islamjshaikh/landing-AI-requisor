import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Star, Zap, Building, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

let stripePromise: Promise<Stripe | null> | null = null;

async function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    try {
      const response = await fetch("/api/stripe/config");
      if (!response.ok) {
        console.error("Failed to fetch Stripe config");
        return null;
      }
      const { publishableKey } = await response.json();
      if (!publishableKey) {
        console.error("No Stripe publishable key returned");
        return null;
      }
      console.log("Stripe public key loaded from server");
      stripePromise = loadStripe(publishableKey);
    } catch (error) {
      console.error("Error loading Stripe:", error);
      return null;
    }
  }
  return stripePromise;
}

interface SubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  features: string[];
  maxUsers: number;
  maxProjects: number;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface UserSubscription {
  user: any;
  plan?: SubscriptionPlan;
}

const planIcons: Record<string, React.ReactNode> = {
  free: <Zap className="h-6 w-6" />,
  pro: <Star className="h-6 w-6" />,
  business: <Building className="h-6 w-6" />,
  enterprise: <Crown className="h-6 w-6" />,
};

const planColors: Record<string, string> = {
  free: "text-gray-600",
  pro: "text-blue-600",
  business: "text-purple-600",
  enterprise: "text-amber-600",
};

export default function PricingPage() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState<number | null>(null);

  // Handle payment success from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");
    const sessionId = urlParams.get("session_id");
    const planId = urlParams.get("plan");

    if (success === "true" && sessionId) {
      // Process the successful payment
      apiRequest("/api/stripe/payment-success", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      })
        .then(() => {
          toast({
            title: "Payment Successful!",
            description: "Your subscription has been upgraded successfully.",
          });
          // Refresh user subscription data
          queryClient.invalidateQueries({
            queryKey: ["/api/user/subscription"],
          });
          // Clean up URL
          window.history.replaceState({}, "", "/pricing");
        })
        .catch((error) => {
          toast({
            title: "Payment Processing Error",
            description:
              "Payment was successful but there was an issue updating your account. Please contact support.",
            variant: "destructive",
          });
        });
    }

    const cancelled = urlParams.get("cancelled");
    if (cancelled === "true") {
      toast({
        title: "Payment Cancelled",
        description: "You can upgrade your subscription anytime.",
      });
      window.history.replaceState({}, "", "/pricing");
    }
  }, [toast, queryClient]);

  // Fetch subscription plans
  const { data: plans = [], isLoading: plansLoading } = useQuery<
    SubscriptionPlan[]
  >({
    queryKey: ["/api/subscription-plans"],
  });

  // Fetch user's current subscription
  const { data: userSubscription, isLoading: subscriptionLoading } =
    useQuery<UserSubscription>({
      queryKey: ["/api/user/subscription"],
      enabled: isAuthenticated,
    });

  // Upgrade subscription mutation
  const upgradeMutation = useMutation({
    mutationFn: async (planId: number) => {
      return await apiRequest("/api/stripe/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
    },
    onSuccess: async (data, planId) => {
      setIsProcessing(planId);

      try {
        const stripe = await getStripe();
        if (!stripe) {
          throw new Error("Payment service not configured. Please contact support.");
        }

        console.log("Redirecting to Stripe checkout with session:", data.sessionId);
        // Redirect to Stripe's hosted payment page
        const { error } = await stripe.redirectToCheckout({
          sessionId: data.sessionId,
        });

        if (error) {
          console.error("Stripe redirectToCheckout error:", error);
          toast({
            title: "Payment Failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error("Payment processing error:", error);
        toast({
          title: "Payment Error",
          description: error.message || "Failed to process payment. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Failed to start upgrade process",
        variant: "destructive",
      });
      setIsProcessing(null);
    },
  });

  const handleUpgrade = (planId: number) => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to upgrade your subscription.",
        variant: "destructive",
      });
      return;
    }

    upgradeMutation.mutate(planId);
  };

  const getCurrentPlanId = () => {
    return userSubscription?.plan?.id || 1; // Default to Free plan
  };

  const isCurrentPlan = (planId: number) => {
    return getCurrentPlanId() === planId;
  };

  if (plansLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading pricing plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Unlock powerful project management features with our flexible pricing
          options
        </p>
        {isAuthenticated && userSubscription && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
            <span>Current Plan:</span>
            <Badge variant="outline" className="font-medium">
              {userSubscription.plan?.name || "Free"}
            </Badge>
          </div>
        )}
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {plans.map((plan: SubscriptionPlan) => (
          <Card
            key={plan.id}
            className={`relative ${plan.isPopular ? "border-primary shadow-lg scale-105" : ""} ${
              isCurrentPlan(plan.id) ? "ring-2 ring-primary" : ""
            }`}
          >
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">
                  Most Popular
                </Badge>
              </div>
            )}

            <CardHeader className="text-center pb-2">
              <div
                className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-primary/20 to-primary/10 mb-4 ${planColors[plan.slug as keyof typeof planColors] || "text-gray-600"}`}
              >
                {planIcons[plan.slug as keyof typeof planIcons] || (
                  <Zap className="h-6 w-6" />
                )}
              </div>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription className="text-sm">
                {plan.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="text-center pb-2">
              <div className="mb-6">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-muted-foreground">
                  {plan.price > 0 ? "/month" : ""}
                </span>
              </div>

              <div className="space-y-3 text-left">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>
                    {plan.maxUsers === -1 ? "Unlimited" : plan.maxUsers}
                    {plan.maxUsers === 1 ? " user" : " users"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>
                    {plan.maxProjects === -1 ? "Unlimited" : plan.maxProjects}
                    {plan.maxProjects === 1 ? " project" : " projects"}
                  </span>
                </div>

                {/* Feature list */}
                {plan.features && plan.features.length > 0 && (
                  <div className="space-y-2 pt-2">
                    {plan.features.slice(0, 4).map((feature, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="capitalize">
                          {feature.replace(/_/g, " ")}
                        </span>
                      </div>
                    ))}
                    {plan.features.length > 4 && (
                      <div className="text-xs text-muted-foreground">
                        +{plan.features.length - 4} more features
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter>
              {isCurrentPlan(plan.id) ? (
                <Button disabled className="w-full">
                  Current Plan
                </Button>
              ) : plan.slug === "enterprise" ? (
                <Button variant="outline" className="w-full">
                  Contact Sales
                </Button>
              ) : !isAuthenticated ? (
                <Button variant="outline" className="w-full" disabled>
                  Log in to Select
                </Button>
              ) : (
                <Button
                  className={`w-full ${getCurrentPlanId() > plan.id ? "" : ""}`}
                  variant={getCurrentPlanId() > plan.id ? "outline" : "default"}
                  disabled={isProcessing === plan.id}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {isProcessing === plan.id ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Processing...
                    </>
                  ) : getCurrentPlanId() > plan.id ? (
                    <>Downgrade to {plan.name}</>
                  ) : (
                    <>
                      Upgrade to {plan.name}
                      {plan.isPopular && <Star className="ml-2 h-4 w-4" />}
                    </>
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Feature Comparison */}
      <div className="bg-card rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold text-center mb-6">
          Feature Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 font-medium">Features</th>
                {plans.map((plan: SubscriptionPlan) => (
                  <th
                    key={plan.id}
                    className="text-center py-3 font-medium min-w-[120px]"
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-3">Project Management</td>
                {plans.map((plan: SubscriptionPlan) => (
                  <td key={plan.id} className="text-center py-3">
                    <Check className="h-4 w-4 text-green-600 mx-auto" />
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-3">AI Assistant</td>
                {plans.map((plan: SubscriptionPlan) => (
                  <td key={plan.id} className="text-center py-3">
                    {plan.features?.includes("ai_assistant") ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <Lock className="h-4 w-4 text-gray-400 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-3">Advanced Analytics</td>
                {plans.map((plan: SubscriptionPlan) => (
                  <td key={plan.id} className="text-center py-3">
                    {plan.features?.includes("advanced_analytics") ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <Lock className="h-4 w-4 text-gray-400 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-3">API Access</td>
                {plans.map((plan: SubscriptionPlan) => (
                  <td key={plan.id} className="text-center py-3">
                    {plan.features?.includes("api_access") ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <Lock className="h-4 w-4 text-gray-400 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-3">Priority Support</td>
                {plans.map((plan: SubscriptionPlan) => (
                  <td key={plan.id} className="text-center py-3">
                    {plan.features?.includes("priority_support") ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <Lock className="h-4 w-4 text-gray-400 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-card rounded-lg p-6">
        <h2 className="text-2xl font-bold text-center mb-6">
          Frequently Asked Questions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2">
              Can I change my plan anytime?
            </h3>
            <p className="text-muted-foreground text-sm">
              Yes, you can upgrade or downgrade your plan at any time. Changes
              take effect immediately.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">
              What payment methods do you accept?
            </h3>
            <p className="text-muted-foreground text-sm">
              We accept all major credit cards and PayPal through our secure
              Stripe integration.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Is there a free trial?</h3>
            <p className="text-muted-foreground text-sm">
              Our Free plan gives you access to basic features. You can upgrade
              anytime to unlock premium features.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">
              Need custom enterprise features?
            </h3>
            <p className="text-muted-foreground text-sm">
              Contact our sales team for custom pricing and enterprise-specific
              features and integrations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
