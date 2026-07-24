import React from 'react';
import { Lock, Crown, Star, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'wouter';

interface FeatureGateProps {
  featureSlug: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
  requiredPlan?: string;
}

const planIcons = {
  'pro': <Star className="h-4 w-4" />,
  'business': <Crown className="h-4 w-4" />,
  'enterprise': <Crown className="h-4 w-4" />
};

const planColors = {
  'pro': 'text-blue-600',
  'business': 'text-purple-600', 
  'enterprise': 'text-amber-600'
};

export function FeatureGate({ 
  featureSlug, 
  children, 
  fallback, 
  showUpgradePrompt = true,
  requiredPlan = 'pro'
}: FeatureGateProps) {
  const { hasAccess, isLoading } = useFeatureAccess(featureSlug);
  const { isAuthenticated } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="animate-pulse bg-muted rounded-lg p-4">
        <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-muted-foreground/20 rounded w-1/2"></div>
      </div>
    );
  }

  // If user has access, show the feature
  if (hasAccess) {
    return <>{children}</>;
  }

  // If custom fallback is provided, show it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show upgrade prompt if feature is locked
  if (showUpgradePrompt) {
    return (
      <Card className="border-dashed border-2 bg-muted/20">
        <CardHeader className="text-center pb-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-muted-foreground/20 to-muted-foreground/10 mb-2">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg flex items-center justify-center gap-2">
            🔒 Upgrade to access
            {planIcons[requiredPlan as keyof typeof planIcons] && (
              <span className={planColors[requiredPlan as keyof typeof planColors]}>
                {planIcons[requiredPlan as keyof typeof planIcons]}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            This feature requires a {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan or higher
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pt-0">
          <div className="space-y-3">
            <Badge variant="outline" className="capitalize">
              {requiredPlan} Plan Required
            </Badge>
            
            {isAuthenticated ? (
              <div className="space-x-2">
                <Link href="/pricing">
                  <Button size="sm" className="gap-2">
                    <Zap className="h-4 w-4" />
                    View Plans
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Sign in to unlock premium features
                </p>
                <Link href="/api/login">
                  <Button size="sm" variant="default">
                    Sign In
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default: just hide the feature
  return null;
}

// Helper component for inline feature restrictions
export function InlineFeatureLock({ 
  featureSlug, 
  requiredPlan = 'pro',
  size = 'sm' 
}: { 
  featureSlug: string; 
  requiredPlan?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { hasAccess } = useFeatureAccess(featureSlug);
  const { isAuthenticated } = useAuth();

  if (hasAccess) return null;

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5', 
    lg: 'text-base px-4 py-2'
  };

  return (
    <div className={`inline-flex items-center gap-1 bg-muted/60 rounded-full ${sizeClasses[size]}`}>
      <Lock className="h-3 w-3" />
      <span>{requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}</span>
    </div>
  );
}

// Higher-order component version
export function withFeatureGate<P extends object>(
  Component: React.ComponentType<P>,
  featureSlug: string,
  requiredPlan = 'pro'
) {
  return function FeatureGatedComponent(props: P) {
    return (
      <FeatureGate featureSlug={featureSlug} requiredPlan={requiredPlan}>
        <Component {...props} />
      </FeatureGate>
    );
  };
}