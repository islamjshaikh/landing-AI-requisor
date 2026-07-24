import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { DynamicChat } from "@/components/ai-chat/DynamicChat";
import { Menu, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { FloatingProjectAssistant } from "@/components/FloatingProjectAssistant";
import { OnboardingTour, useOnboardingTour } from "@/components/onboarding/OnboardingTour";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const { showTour, restartTour, completeTour } = useOnboardingTour();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleAgent = () => {
    setAgentOpen(!agentOpen);
  };

  return (
    <div className="flex min-h-screen h-screen relative bg-gradient-to-br from-slate-50 to-emerald-50/20">
      {/* Mobile Sidebar Toggle Button */}
      {isMobile && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 bg-white rounded-lg p-2 shadow-lg border border-emerald-100/50 hover:bg-emerald-50 transition-colors"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? (
            <X className="h-5 w-5 text-slate-600" />
          ) : (
            <Menu className="h-5 w-5 text-slate-600" />
          )}
        </button>
      )}

      {/* Sidebar - conditionally shown/positioned on mobile */}
      <div
        className={`
        ${isMobile ? "fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out" : ""}
        ${isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"}
      `}
      >
        <Sidebar onCloseMobile={() => setSidebarOpen(false)} onRestartTour={restartTour} />
      </div>

      {/* Overlay for mobile sidebar */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main
        className={`
        flex-1 overflow-y-auto bg-transparent
        ${isMobile ? "pt-16" : ""}
        transition-all duration-300
      `}
      >
        {children}
      </main>

      <OnboardingTour forceShow={showTour} onComplete={completeTour} />
    </div>
  );
}
