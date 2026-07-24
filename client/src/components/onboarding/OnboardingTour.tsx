import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, ChevronLeft, Sparkles, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement: "top" | "bottom" | "left" | "right";
  spotlightPadding?: number;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="sidebar-agent"]',
    title: "Your AI Command Center",
    content: "This is Requisor Agent, your starting point. Ask it to plan projects, discover features, or analyze customer feedback. It works in two modes: Build and Plan.",
    placement: "right",
    spotlightPadding: 4,
  },
  {
    target: '[data-tour="mode-toggle"]',
    title: "Switch Between Build & Plan",
    content: "Build mode discovers what to build next from evidence. Plan mode creates detailed project plans with milestones and tasks. Switch anytime.",
    placement: "bottom",
    spotlightPadding: 6,
  },
  {
    target: '[data-tour="chat-input"]',
    title: "Talk to Your AI",
    content: "Type your request here: paste a customer interview, describe a product idea, or ask \"what should we build next?\" The AI streams responses in real-time.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    target: '[data-tour="prompt-pills"]',
    title: "Quick Prompts",
    content: "Not sure where to start? Click any of these suggestions to get going instantly. They change based on whether you're in Build or Plan mode.",
    placement: "top",
    spotlightPadding: 6,
  },
  {
    target: '[data-tour="canvas-panel"]',
    title: "Your Canvas",
    content: "Results appear here: project plans in Plan mode, discovered features in Build mode. You can edit, prioritize, refine, and export everything.",
    placement: "left",
    spotlightPadding: 8,
  },
  {
    target: '[data-tour="sidebar-meetings"]',
    title: "Import Meetings & Transcripts",
    content: "Upload meeting recordings, paste transcripts, or connect Slack/Zoom/Teams. Audio files are automatically transcribed with AI.",
    placement: "right",
    spotlightPadding: 4,
  },
  {
    target: '[data-tour="sidebar-evidence"]',
    title: "Evidence Library",
    content: "All your research artifacts in one place: interview notes, transcripts, uploaded files, and usage data. Attach evidence to AI conversations for grounded recommendations.",
    placement: "right",
    spotlightPadding: 4,
  },
  {
    target: '[data-tour="sidebar-projects"]',
    title: "Your Projects",
    content: "Approved feature specs and project plans live here. Track progress, manage tasks, and send implementation prompts to coding agents like Replit, Cursor, or Claude Code.",
    placement: "right",
    spotlightPadding: 4,
  },
];

const STORAGE_KEY = "requisor_onboarding_completed";

function findNextVisibleStep(startIndex: number, direction: 1 | -1): number | null {
  let idx = startIndex;
  while (idx >= 0 && idx < TOUR_STEPS.length) {
    const el = document.querySelector(TOUR_STEPS[idx].target);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return idx;
    }
    idx += direction;
  }
  return null;
}

function computePlacement(
  rect: DOMRect,
  padding: number,
  preferred: "top" | "bottom" | "left" | "right",
  tooltipW: number,
  tooltipH: number
): { top: number; left: number; placement: "top" | "bottom" | "left" | "right" } {
  const gap = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 12;

  const attempts: Array<"top" | "bottom" | "left" | "right"> = [preferred];
  for (const d of (["right", "bottom", "left", "top"] as const)) {
    if (!attempts.includes(d)) attempts.push(d);
  }

  for (const dir of attempts) {
    let top = 0;
    let left = 0;

    if (dir === "right") {
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.right + gap + padding;
    } else if (dir === "left") {
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.left - tooltipW - gap - padding;
    } else if (dir === "bottom") {
      top = rect.bottom + gap + padding;
      left = rect.left + rect.width / 2 - tooltipW / 2;
    } else {
      top = rect.top - tooltipH - gap - padding;
      left = rect.left + rect.width / 2 - tooltipW / 2;
    }

    top = Math.max(margin, Math.min(top, vh - tooltipH - margin));
    left = Math.max(margin, Math.min(left, vw - tooltipW - margin));

    const fitsH = left >= margin && left + tooltipW <= vw - margin;
    const fitsV = top >= margin && top + tooltipH <= vh - margin;

    if (fitsH && fitsV) {
      return { top, left, placement: dir };
    }
  }

  return {
    top: Math.max(margin, Math.min(rect.bottom + gap, vh - tooltipH - margin)),
    left: Math.max(margin, Math.min(rect.left, vw - tooltipW - margin)),
    placement: "bottom",
  };
}

interface OnboardingTourProps {
  forceShow?: boolean;
  onComplete?: () => void;
}

export function OnboardingTour({ forceShow, onComplete }: OnboardingTourProps) {
  const [isActive, setIsActive] = useState(false);
  const isActiveRef = useRef(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<{ top: number; left: number; width: number; height: number; borderRadius: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const resizeTimerRef = useRef<any>(null);
  const retryTimerRef = useRef<any>(null);
  const retryCountRef = useRef(0);

  const activate = useCallback((step = 0) => {
    setCurrentStep(step);
    setIsActive(true);
    isActiveRef.current = true;
  }, []);

  const deactivate = useCallback(() => {
    setIsActive(false);
    isActiveRef.current = false;
    localStorage.setItem(STORAGE_KEY, "true");
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (forceShow) {
      const timer = setTimeout(() => activate(0), 500);
      return () => clearTimeout(timer);
    }
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => activate(0), 1500);
      return () => clearTimeout(timer);
    }
  }, [forceShow, activate]);

  const positionTooltip = useCallback(() => {
    if (!isActiveRef.current) return;

    const step = TOUR_STEPS[currentStep];
    if (!step) {
      deactivate();
      return;
    }

    const el = document.querySelector(step.target);
    const elRect = el?.getBoundingClientRect();
    if (!el || !elRect || elRect.width === 0 || elRect.height === 0) {
      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        retryTimerRef.current = setTimeout(positionTooltip, 300);
        return;
      }
      retryCountRef.current = 0;
      const next = findNextVisibleStep(currentStep + 1, 1);
      if (next !== null) {
        setCurrentStep(next);
      } else {
        deactivate();
      }
      return;
    }

    retryCountRef.current = 0;
    const rect = el.getBoundingClientRect();
    const padding = step.spotlightPadding || 4;

    setSpotlightRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      borderRadius: 8,
    });

    const tooltipW = 340;
    const tooltipH = tooltipRef.current?.offsetHeight || 180;

    const { top, left } = computePlacement(rect, padding, step.placement, tooltipW, tooltipH);
    setTooltipPos({ top, left });
  }, [currentStep, deactivate]);

  useEffect(() => {
    if (!isActive) return;

    const timer = setTimeout(positionTooltip, 50);
    const rafId = requestAnimationFrame(() => setTimeout(positionTooltip, 100));

    const handleResize = () => {
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(positionTooltip, 100);
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", positionTooltip, true);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafId);
      clearTimeout(retryTimerRef.current);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", positionTooltip, true);
    };
  }, [isActive, positionTooltip]);

  const handleNext = useCallback(() => {
    retryCountRef.current = 0;
    const next = findNextVisibleStep(currentStep + 1, 1);
    if (next !== null) {
      setCurrentStep(next);
    } else {
      deactivate();
    }
  }, [currentStep, deactivate]);

  const handlePrev = useCallback(() => {
    retryCountRef.current = 0;
    const prev = findNextVisibleStep(currentStep - 1, -1);
    if (prev !== null) setCurrentStep(prev);
  }, [currentStep]);

  if (!isActive) return null;

  const step = TOUR_STEPS[currentStep];
  if (!step) return null;

  const isLast = findNextVisibleStep(currentStep + 1, 1) === null;
  const isFirst = findNextVisibleStep(currentStep - 1, -1) === null;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  const maskStyle: any = {};
  if (spotlightRect) {
    const { top, left, width, height, borderRadius: br } = spotlightRect;
    const svgMask = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${window.innerWidth}' height='${window.innerHeight}'%3E%3Crect width='100%25' height='100%25' fill='white'/%3E%3Crect x='${left}' y='${top}' width='${width}' height='${height}' rx='${br}' ry='${br}' fill='black'/%3E%3C/svg%3E")`;
    maskStyle.maskImage = svgMask;
    maskStyle.WebkitMaskImage = svgMask;
    maskStyle.maskSize = "100% 100%";
    maskStyle.WebkitMaskSize = "100% 100%";
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999]">
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: "rgba(0, 0, 0, 0.55)",
          ...maskStyle,
        }}
        onClick={deactivate}
      />

      {spotlightRect && (
        <div
          className="absolute pointer-events-none transition-all duration-300 ease-in-out"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
            borderRadius: spotlightRect.borderRadius,
            boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.6), 0 0 20px rgba(16, 185, 129, 0.2)",
          }}
        />
      )}

      <div
        ref={tooltipRef}
        className="absolute bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden transition-all duration-300 ease-in-out animate-in fade-in-0 slide-in-from-bottom-2"
        style={{ top: tooltipPos.top, left: tooltipPos.left, width: 340 }}
      >
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-sm text-gray-900">{step.title}</h3>
            </div>
            <button
              onClick={deactivate}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed ml-8 mb-4">{step.content}</p>

          <div className="flex items-center justify-between ml-8">
            <span className="text-[10px] text-gray-400 font-medium">
              {currentStep + 1} of {TOUR_STEPS.length}
            </span>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrev}
                  className="h-7 text-xs gap-1 text-gray-500"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Back
                </Button>
              )}

              {isFirst && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deactivate}
                  className="h-7 text-xs text-gray-400"
                >
                  Skip tour
                </Button>
              )}

              <Button
                size="sm"
                onClick={handleNext}
                className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {isLast ? (
                  <>
                    <Rocket className="h-3 w-3" />
                    Get Started
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-3 w-3" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function useOnboardingTour() {
  const [showTour, setShowTour] = useState(false);

  const restartTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setShowTour(true);
  }, []);

  const completeTour = useCallback(() => {
    setShowTour(false);
  }, []);

  return { showTour, restartTour, completeTour };
}
