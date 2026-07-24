import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Minimize2, MoreHorizontal } from "lucide-react";

import image1 from "@assets/image_1764024922702.png";
import image2 from "@assets/image_1764024983322.png";
import image3 from "@assets/image_1764024969188.png";

const slides = [
  {
    id: 1,
    image: image1,
    title: "Ideate & Plan",
    description: "Transform ideas into structured project plans with AI assistance.",
  },
  {
    id: 2,
    image: image2,
    title: "Select Agents",
    description: "Choose specialized AI agents from the hub to execute your plan.",
  },
  {
    id: 3,
    image: image3,
    title: "Execute",
    description: "Watch your AI squad generate assets and complete tasks instantly.",
  },
];

export function ProductDemo() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-12 bg-background overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Browser Window Frame */}
        <div className="relative rounded-xl overflow-hidden border border-border/50 shadow-2xl bg-card dark:shadow-[0_0_50px_-12px_rgba(13,148,136,0.2)]">
          {/* Browser Header */}
          <div className="h-10 bg-muted/50 border-b border-border/50 flex items-center justify-between px-4 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-background/50 border border-border/50 text-xs text-muted-foreground font-medium font-mono">
              <span className="text-accent">🔒</span> app.requisor.io
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MoreHorizontal className="w-4 h-4" />
            </div>
          </div>

          {/* Content Area */}
          <div className="relative aspect-video bg-muted/30 w-full overflow-hidden group">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="absolute inset-0 flex items-center justify-center p-1"
              >
                <img
                  src={slides[currentSlide].image}
                  alt={slides[currentSlide].title}
                  className="w-full h-full object-contain rounded-lg shadow-sm"
                />
              </motion.div>
            </AnimatePresence>

            {/* Floating Progress Card */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-xl bg-card/90 dark:bg-[#0B1120]/90 backdrop-blur-xl border border-border/50 rounded-2xl p-2 shadow-2xl z-20 flex items-center gap-1">
              {slides.map((slide, index) => (
                <div key={slide.id} className="relative flex-1">
                  <button
                    onClick={() => setCurrentSlide(index)}
                    className={`relative w-full h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-300 z-10 overflow-hidden ${
                      currentSlide === index
                        ? "text-accent-foreground"
                        : "hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {/* Progress Bar Background for Active Slide */}
                    {currentSlide === index && (
                      <motion.div
                        layoutId="active-bg"
                        className="absolute inset-0 bg-accent"
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    
                    {/* Loading Progress Bar */}
                    {currentSlide === index && (
                      <motion.div
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 4, ease: "linear" }}
                        className="absolute bottom-0 left-0 h-1 bg-white/30 z-20"
                      />
                    )}

                    <span className={`text-xs font-bold relative z-20 ${currentSlide === index ? "text-white" : ""}`}>
                      {slide.title}
                    </span>
                    <span className={`text-[10px] font-medium relative z-20 truncate max-w-[90%] ${currentSlide === index ? "text-white/80" : "hidden sm:block"}`}>
                      {slide.description.split(" ").slice(0, 3).join(" ")}...
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
