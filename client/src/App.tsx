import { lazy, Suspense } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth, AuthProvider } from "./hooks/useAuth.tsx";
import { UpgradeModalProvider } from "./hooks/useUpgradeModal.tsx";
import { Spinner } from "@/components/ui/spinner";

// Eager load only critical pages
import { AgentPageContent } from "@/pages/agent";
import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth";
import Hub from "./components/sections/hub.tsx";
import DevLandingPage from "./pages/dev_landing.tsx";
import AgentsHubPage from "./pages/agents-hub.tsx";

// Lazy load all other pages
const NotFound = lazy(() => import("@/pages/not-found"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const Projects = lazy(() => import("@/pages/projects"));
const ProjectDetails = lazy(() => import("@/pages/project-details"));
const CreateProject = lazy(() => import("@/pages/create-project"));
const WorkflowBuilder = lazy(() => import("@/pages/WorkflowBuilder"));
const AIBudgetAgent = lazy(() => import("@/pages/ai-budget-agent"));
const AIAgentsPage = lazy(() => import("@/pages/ai-agents"));
const AIAgentsLanding = lazy(() => import("@/pages/agents_landing"));
const SmartBandwidthPage = lazy(() => import("@/pages/smart-bandwidth"));
const SmartBandwidthDemo = lazy(() => import("@/pages/smart-bandwidth-demo"));
const Timeline = lazy(() => import("@/pages/timeline"));
const Analytics = lazy(() => import("@/pages/analytics"));
const ImportData = lazy(() => import("@/pages/import-data"));
const Settings = lazy(() => import("@/pages/settings"));
const Connect = lazy(() => import("@/pages/connect"));
const TokenUsage = lazy(() => import("@/pages/token-usage"));
const Team = lazy(() => import("@/pages/team"));
const FormsPage = lazy(() => import("@/pages/forms"));
const PublicFormPage = lazy(() => import("@/pages/public-form"));
const IntegrationsPage = lazy(() => import("@/pages/IntegrationsPage"));
const AcceptInvitation = lazy(() => import("@/pages/accept-invitation"));
const OnboardingAgent = lazy(() => import("@/pages/OnboardingAgent"));
const FoodisaurAgent = lazy(() => import("@/pages/FoodisaurAgent"));
const PrioritisorAgent = lazy(() => import("@/pages/PrioritisorAgent"));
const PrioritisorAgentV2 = lazy(() => import("@/pages/PrioritisorAgentV2"));
const PrioritisorDemo = lazy(() => import("@/pages/PrioritisorDemo"));
const RgaAssistant = lazy(() => import("@/pages/rga-assistant"));
const RgaDemo = lazy(() => import("@/pages/rga-demo"));
const TeamManagementPage = lazy(
  () => import("@/components/team/TeamManagementPage"),
);
const JiraAgent = lazy(() => import("@/pages/JiraAgent"));
const JiraAgentSimple = lazy(() => import("@/pages/JiraAgentSimple"));
const JiraStoryWriter = lazy(() => import("@/pages/JiraStoryWriter"));
const JiraStoryEstimator = lazy(() => import("@/pages/JiraStoryEstimator"));
const JiraBacklogGenerator = lazy(() => import("@/pages/JiraBacklogGenerator"));
const JiraSettings = lazy(() => import("@/pages/JiraSettings"));
const JiraSetupGuide = lazy(() => import("@/pages/JiraSetupGuide"));
const AgilePlanningPage = lazy(() => import("@/pages/agile-planning"));
const EnhancedAgilePlanningPage = lazy(() =>
  import("@/pages/enhanced-agile-planning").then((m) => ({
    default: m.EnhancedAgilePlanningPage,
  })),
);
const SocialMediaAgent = lazy(() => import("@/pages/social-media-agent"));
const TestChat = lazy(() =>
  import("@/pages/TestChat").then((m) => ({ default: m.TestChat })),
);
const PricingPage = lazy(() => import("@/pages/pricing"));
const PrivacyPolicyPage = lazy(() => import("@/pages/privacy-policy"));
const TermsPage = lazy(() => import("@/pages/terms"));
const SupportPage = lazy(() => import("@/pages/support"));
const ZoomIntegrationPage = lazy(() => import("@/pages/zoom-integration"));
const AIProjectPlanner = lazy(() => import("@/pages/AIProjectPlanner"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const VerifyPendingPage = lazy(() => import("@/pages/verify-pending"));
const VerifyEmailPage = lazy(() => import("@/pages/verify-email"));
const MeetingsPage = lazy(() => import("@/pages/meetings"));
const EvidencePage = lazy(() => import("@/pages/evidence"));
const BrainPage = lazy(() => import("@/pages/brain"));
const ThemesPage = lazy(() => import("@/pages/themes"));
const SharedReportPage = lazy(() => import("@/pages/shared-report"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Spinner size="lg" />
  </div>
);

function AuthenticatedRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/profile" component={ProfilePage} />
        {/* Redirect authenticated users from /auth to home */}
        <Route path="/auth">
          <Redirect to="/" />
        </Route>

        {/* Agent-first interface - main entry point */}
        <Route
          path="/"
          component={() => (
            <AppLayout>
              <AgentPageContent />
            </AppLayout>
          )}
        />
        <Route
          path="/agent"
          component={() => (
            <AppLayout>
              <AIProjectPlanner />
            </AppLayout>
          )}
        />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route
          path="/meetings"
          component={() => (
            <AppLayout>
              <MeetingsPage />
            </AppLayout>
          )}
        />
        <Route
          path="/evidence"
          component={() => (
            <AppLayout>
              <EvidencePage />
            </AppLayout>
          )}
        />
        <Route
          path="/brain"
          component={() => (
            <AppLayout>
              <BrainPage />
            </AppLayout>
          )}
        />
        <Route
          path="/themes"
          component={() => (
            <AppLayout>
              <ThemesPage />
            </AppLayout>
          )}
        />
        <Route
          path="/themes/:id"
          component={() => (
            <AppLayout>
              <ThemesPage />
            </AppLayout>
          )}
        />

        {/* Traditional views available but secondary */}
        <Route
          path="/projects"
          component={() => (
            <AppLayout>
              <Projects />
            </AppLayout>
          )}
        />
        <Route
          path="/projects/:id"
          component={() => (
            <AppLayout>
              <ProjectDetails />
            </AppLayout>
          )}
        />
        <Route
          path="/project/:id"
          component={() => (
            <AppLayout>
              <ProjectDetails />
            </AppLayout>
          )}
        />
        <Route
          path="/create-project"
          component={() => (
            <AppLayout>
              <CreateProject />
            </AppLayout>
          )}
        />
        <Route
          path="/workflow-builder"
          component={() => (
            <AppLayout>
              <WorkflowBuilder />
            </AppLayout>
          )}
        />
        {/* <Route
        path="/ai-agents"
        component={() => (
          <AppLayout>
            <AIAgentsPage />
          </AppLayout>
        )}
      /> */}
        <Route
          path="/ai-agents"
          component={() => (
            <AppLayout>
              <Hub />
            </AppLayout>
          )}
        />
        <Route
          path="/ai-budget-agent"
          component={() => (
            <AppLayout>
              <AIBudgetAgent />
            </AppLayout>
          )}
        />
        <Route
          path="/ai-onboarding-agent"
          component={() => (
            <AppLayout>
              <OnboardingAgent />
            </AppLayout>
          )}
        />
        <Route
          path="/foodisaur-agent"
          component={() => (
            <AppLayout>
              <FoodisaurAgent />
            </AppLayout>
          )}
        />
        <Route
          path="/prioritisor-agent"
          component={() => (
            <AppLayout>
              <PrioritisorAgentV2 />
            </AppLayout>
          )}
        />
        <Route
          path="/prioritisor-agent-old"
          component={() => (
            <AppLayout>
              <PrioritisorAgent />
            </AppLayout>
          )}
        />
        <Route
          path="/prioritisor-demo"
          component={() => (
            <AppLayout>
              <PrioritisorDemo />
            </AppLayout>
          )}
        />
        <Route
          path="/rga-assistant"
          component={() => (
            <AppLayout>
              <RgaAssistant />
            </AppLayout>
          )}
        />
        <Route
          path="/rga-demo"
          component={() => (
            <AppLayout>
              <RgaDemo />
            </AppLayout>
          )}
        />
        <Route
          path="/jira-agent"
          component={() => (
            <AppLayout>
              <JiraAgentSimple />
            </AppLayout>
          )}
        />
        <Route
          path="/jira-agent-old"
          component={() => (
            <AppLayout>
              <JiraAgent />
            </AppLayout>
          )}
        />
        <Route
          path="/jira-story-writer"
          component={() => (
            <AppLayout>
              <JiraStoryWriter />
            </AppLayout>
          )}
        />
        <Route
          path="/jira-story-estimator"
          component={() => (
            <AppLayout>
              <JiraStoryEstimator />
            </AppLayout>
          )}
        />
        <Route
          path="/jira-backlog-generator"
          component={() => (
            <AppLayout>
              <JiraBacklogGenerator />
            </AppLayout>
          )}
        />
        <Route
          path="/jira-settings"
          component={() => (
            <AppLayout>
              <JiraSettings />
            </AppLayout>
          )}
        />
        <Route
          path="/jira-setup-guide"
          component={() => (
            <AppLayout>
              <JiraSetupGuide />
            </AppLayout>
          )}
        />
        <Route
          path="/agile-planning"
          component={() => (
            <AppLayout>
              <AgilePlanningPage />
            </AppLayout>
          )}
        />
        <Route
          path="/enhanced-agile-planning"
          component={() => (
            <AppLayout>
              <EnhancedAgilePlanningPage />
            </AppLayout>
          )}
        />
        <Route
          path="/social-media-agent"
          component={() => (
            <AppLayout>
              <SocialMediaAgent />
            </AppLayout>
          )}
        />
        <Route
          path="/smart-bandwidth"
          component={() => (
            <AppLayout>
              <SmartBandwidthPage />
            </AppLayout>
          )}
        />
        <Route
          path="/smart-bandwidth-demo"
          component={() => (
            <AppLayout>
              <SmartBandwidthDemo />
            </AppLayout>
          )}
        />
        <Route
          path="/integrations"
          component={() => (
            <AppLayout>
              <IntegrationsPage />
            </AppLayout>
          )}
        />
        <Route
          path="/timeline"
          component={() => (
            <AppLayout>
              <Timeline />
            </AppLayout>
          )}
        />
        <Route
          path="/analytics"
          component={() => (
            <AppLayout>
              <Analytics />
            </AppLayout>
          )}
        />
        <Route
          path="/team"
          component={() => (
            <AppLayout>
              <Team />
            </AppLayout>
          )}
        />
        <Route
          path="/forms"
          component={() => (
            <AppLayout>
              <FormsPage />
            </AppLayout>
          )}
        />
        <Route
          path="/team-management"
          component={() => (
            <AppLayout>
              <TeamManagementPage />
            </AppLayout>
          )}
        />
        <Route
          path="/import-data"
          component={() => (
            <AppLayout>
              <ImportData />
            </AppLayout>
          )}
        />
        <Route
          path="/settings"
          component={() => (
            <AppLayout>
              <Settings />
            </AppLayout>
          )}
        />
        <Route
          path="/connect"
          component={() => (
            <AppLayout>
              <Connect />
            </AppLayout>
          )}
        />
        <Route
          path="/token-usage"
          component={() => (
            <AppLayout>
              <TokenUsage />
            </AppLayout>
          )}
        />
        <Route
          path="/pricing"
          component={() => (
            <AppLayout>
              <PricingPage />
            </AppLayout>
          )}
        />
        <Route
          path="/test-chat"
          component={() => (
            <AppLayout>
              <TestChat />
            </AppLayout>
          )}
        />
        <Route path="/privacy-policy" component={() => <PrivacyPolicyPage />} />
        <Route path="/terms" component={() => <TermsPage />} />
        <Route path="/support" component={() => <SupportPage />} />
        <Route path="/zoom-integration" component={() => <ZoomIntegrationPage />} />
        <Route path="/accept-invitation" component={AcceptInvitation} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// Separate routes component to avoid Hook ordering issues
function RouterContent() {
  const { isAuthenticated, isLoading } = useAuth();

  console.log(
    "RouterContent - isAuthenticated:",
    isAuthenticated,
    "isLoading:",
    isLoading,
  );
  const [location] = useLocation();
  console.log("Current location:", location);

  // If still loading auth status, show loading indicator
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Special handling for invitation acceptance page
  if (location.startsWith("/accept-invitation")) {
    return (
      <Suspense fallback={<PageLoader />}>
        <AcceptInvitation />
      </Suspense>
    );
  }

  if (location.startsWith("/shared-report/")) {
    return (
      <Suspense fallback={<PageLoader />}>
        <SharedReportPage />
      </Suspense>
    );
  }

  // Special handling for public form pages (no auth required)
  if (location.startsWith("/form/")) {
    console.log("Detected form URL, rendering PublicFormPage:", location);
    return (
      <Suspense fallback={<PageLoader />}>
        <PublicFormPage />
      </Suspense>
    );
  }

  // If user is not authenticated, check if they're trying to access demo-enabled pages
  if (!isAuthenticated) {
    console.log("User not authenticated, checking location:", location);
    // Allow access to certain pages in demo mode
    if (location === "/ai-agents") {
      console.log("Rendering AI Agents Page");
      return (
        <Suspense fallback={<PageLoader />}>
          <AppLayout>
            <Hub />
          </AppLayout>
        </Suspense>
      );
    }
    if (location === "/social-media-agent") {
      console.log("Rendering Social Media Agent");
      return (
        <Suspense fallback={<PageLoader />}>
          <AppLayout>
            <SocialMediaAgent />
          </AppLayout>
        </Suspense>
      );
    }
    if (location === "/agile-planning") {
      return (
        <Suspense fallback={<PageLoader />}>
          <AppLayout>
            <AgilePlanningPage />
          </AppLayout>
        </Suspense>
      );
    }
    if (location === "/enhanced-agile-planning") {
      return (
        <Suspense fallback={<PageLoader />}>
          <AppLayout>
            <EnhancedAgilePlanningPage />
          </AppLayout>
        </Suspense>
      );
    }
    if (location === "/pricing") {
      return (
        <Suspense fallback={<PageLoader />}>
          <AppLayout>
            <PricingPage />
          </AppLayout>
        </Suspense>
      );
    }
    if (location === "/privacy-policy") {
      return (
        <Suspense fallback={<PageLoader />}>
          <PrivacyPolicyPage />
        </Suspense>
      );
    }
    if (location === "/terms") {
      return (
        <Suspense fallback={<PageLoader />}>
          <TermsPage />
        </Suspense>
      );
    }
    if (location === "/support") {
      return (
        <Suspense fallback={<PageLoader />}>
          <SupportPage />
        </Suspense>
      );
    }
    if (location === "/zoom-integration") {
      return (
        <Suspense fallback={<PageLoader />}>
          <ZoomIntegrationPage />
        </Suspense>
      );
    }
    if (location === "/auth") {
      console.log("Rendering Auth Page");
      return <AuthPage />;
    }
    if (location.startsWith("/reset-password")) {
      console.log("Rendering Reset Password Page");
      return (
        <Suspense fallback={<PageLoader />}>
          <ResetPasswordPage />
        </Suspense>
      );
    }
    if (location === "/verify-email") {
      console.log("Rendering Verify Email Page");
      return (
        <Suspense fallback={<PageLoader />}>
          <VerifyEmailPage />
        </Suspense>
      );
    }
    if (location === "/verify-pending") {
      console.log("Rendering Verify Pending Page");
      return (
        <Suspense fallback={<PageLoader />}>
          <VerifyPendingPage />
        </Suspense>
      );
    }
    if (location === "/agents-hub") {
      console.log("Rendering AI Agents Hub Page");
      return <AgentsHubPage />;
    }
    if (location === "/landingpage") {
      console.log("Rendering Old Landing Page");
      return <LandingPage />;
    }

    // Root → Dev landing (default)
    if (location === "/") {
      console.log("Rendering Dev Landing Page");
      return <DevLandingPage />;
    }

    // Default to landing page for other routes
    console.log("Rendering Landing Page");
    return <DevLandingPage />;
  }

  // Otherwise, show authenticated routes
  return <AuthenticatedRoutes />;
}

function Router() {
  return <RouterContent />;
}

function App() {
  console.log("App component rendered");
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UpgradeModalProvider>
          <Router />
          <Toaster />
        </UpgradeModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
