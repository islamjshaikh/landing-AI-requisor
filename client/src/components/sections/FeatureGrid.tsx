import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, KanbanSquare, Bot, CalendarClock } from "lucide-react";

const features = [
  {
    id: "plan",
    title: "Prompt Builder",
    icon: Wand2,
    description: "Turn messy thoughts into structured project plans instantly.",
    color: "bg-purple-500",
    content: (
      <div className="bg-background rounded-xl shadow-lg border border-border p-6 h-full flex flex-col">
        <div className="mb-4 p-4 bg-secondary/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-2 font-mono text-xs uppercase tracking-wider">
            Input Prompt
          </p>
          <p className="text-foreground font-medium">
            "I want to launch a newsletter for freelance designers..."
          </p>
        </div>
        <div className="flex-1 flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border border-l border-dashed border-muted-foreground/30"></div>
          {[
            "Define target audience personas",
            "Set up Substack account",
            "Draft first 3 welcome emails",
            "Create lead magnet (PDF checklist)",
          ].map((task, i) => (
            <motion.div
              key={task}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className="ml-8 bg-white border shadow-sm p-3 rounded-lg flex items-center gap-3"
            >
              <div className="w-4 h-4 rounded-full border-2 border-accent" />
              <span className="text-sm font-medium">{task}</span>
            </motion.div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "board",
    title: "Project Board",
    icon: KanbanSquare,
    description:
      "Kanban-style board that estimates effort and auto-tags priority.",
    color: "bg-blue-500",
    content: (
      <div className="bg-background rounded-xl shadow-lg border border-border p-6 h-full overflow-hidden">
        <div className="flex gap-4 h-full">
          {["To Do", "In Progress", "Done"].map((col, i) => (
            <div
              key={col}
              className="flex-1 bg-secondary/30 rounded-lg p-3 flex flex-col gap-3"
            >
              <h4 className="text-xs font-bold uppercase text-muted-foreground">
                {col}
              </h4>
              {[1, 2].map((card) => (
                <div
                  key={card}
                  className="bg-white p-3 rounded border shadow-sm text-sm"
                >
                  <div className="h-2 w-12 bg-gray-100 rounded-full mb-2" />
                  <div className="h-2 w-full bg-gray-100 rounded-full mb-1" />
                  <div className="h-2 w-3/4 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "agents",
    title: "AI Agent Hub",
    icon: Bot,
    description:
      "Plug in specialized agents for budgeting, strategy, and more.",
    color: "bg-teal-500",
    content: (
      <div className="bg-background rounded-xl shadow-lg border border-border p-4 relative">
        <div className="grid grid-cols-2 grid-rows-2 gap-4">
          {[
            {
              name: "Sociasor",
              role: "Social Media Agent",
              icon: "/dinocard2/dino3.png",
              hoverShadow: "hover:drop-shadow-[0_0_20px_rgba(149,39,245,1)]",
              iconHoverShadow:
                "hover:drop-shadow-[0_0_30px_rgba(149,39,245,1)]",
            },
            {
              name: "Ideasor",
              role: "Ideation Agent",
              icon: "/dinocard2/dino4.png",
              hoverShadow: "hover:drop-shadow-[0_0_20px_rgba(245,200,39,1)]",
              iconHoverShadow:
                "hover:drop-shadow-[0_0_30px_rgba(245,200,39,1)]",
            },
            {
              name: "Datasor",
              role: "Data Insight Agent",
              icon: "/dinocard2/dino1.png",
              hoverShadow: "hover:drop-shadow-[0_0_20px_rgba(255,165,0,1)]",
              iconHoverShadow: "hover:drop-shadow-[0_0_30px_rgba(255,165,0,1)]",
            },
            {
              name: "CMR",
              role: "CRM Agent",
              icon: "/dinocard2/dino2.png",
              hoverShadow: "hover:drop-shadow-[0_0_20px_rgba(255,166,201,1)]",
              iconHoverShadow:
                "hover:drop-shadow-[0_0_30px_rgba(255,166,201,1)]",
            },
          ].map((agent) => (
            <div
              key={agent.name}
              className={`border rounded-xl md:p-4 p-2 hover:border-accent/50 transition-colors cursor-pointer flex flex-col items-center text-center justify-center gap-2 hover:bg-black/10 ${agent.hoverShadow} transition-all duration-300`}
            >
              <div
                className={`md:w-24 w-12 md:h-24 h-12 rounded-full flex items-center justify-center text-accent transition-transform duration-300 ease-in-out hover:scale-125 will-change-transform ${agent.iconHoverShadow}`}
              >
                <img
                  src={agent.icon}
                  alt={`${agent.name} icon`}
                  className="w-12 md:w-18 md:h-18 h-12 object-contain"
                />
              </div>
              <div>
                <div className="font-bold md:text-base text-sm">
                  {agent.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {agent.role}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="border rounded-xl md:p-4 p-2 hover:border-accent/50 transition-colors cursor-pointer flex flex-col items-center text-center justify-center gap-2 hover:bg-black/10 hover:drop-shadow-[0_0_25px_rgba(39,245,183,1)] bg-background/95 backdrop-blur-sm transition-all duration-300">
            <div className="md:w-24 w-12 md:h-24 h-12 rounded-full flex items-center justify-center text-accent transition-transform duration-300 ease-in-out hover:scale-125 will-change-transform hover:drop-shadow-[0_0_40px_rgba(39,245,183,1)]">
              <img
                src="/public/dinocard2/dino5.png"
                alt="Lead-sor icon"
                className="w-12 md:w-35 md:h-35 h-12 object-contain"
              />
            </div>
            <div>
              <div className="font-bold md:text-base text-sm">Requisor</div>
              <div className="text-sm text-muted-foreground">
                Project Manager
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export function FeatureGrid() {
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const activeFeature = features[activeFeatureIndex];

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setActiveFeatureIndex((prev) => (prev + 1) % features.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const handleManualSelect = (index: number) => {
    setActiveFeatureIndex(index);
    setIsPaused(true);
  };

  return (
    <section
      className=" md:py-8 bg-background relative overflow-hidden"
      id="features"
    >
      <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16 md:mb-24">
          <h2 className="text-3xl md:text-5xl font-bold mb-8 tracking-tight">
            What would you like to build?
          </h2>
          <div className="flex flex-wrap gap-3 md:gap-4">
            {features.map((feature, index) => {
              const isActive = activeFeatureIndex === index;
              return (
                <div key={feature.id} className="relative ">
                  {isActive && !isPaused && (
                    <motion.div
                      layoutId="progress-bar"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2.5, ease: "linear" }}
                      className="absolute bottom-0 left-0 h-full bg-secondary/50 rounded-full -z-10  "
                    />
                  )}
                  <button
                    onClick={() => handleManualSelect(index)}
                    className={`relative flex items-center gap-2 px-6 py-3 rounded-full border transition-all overflow-hidden ${
                      isActive
                        ? "bg-foreground text-background border-foreground dark:drop-shadow-[0_10px_70px_rgba(212,212,212,1)]"
                        : "bg-background text-foreground border-border hover:border-foreground/50 dark:hover:drop-shadow-[0_10px_100px_rgba(212,212,212,1)]"
                    }`}
                  >
                    {isActive && !isPaused && (
                      <motion.div
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2.5, ease: "linear" }}
                        className="absolute bottom-0 left-0 top-0 bg-white/20 pointer-events-none "
                      />
                    )}

                    <feature.icon className="w-4 h-4 relative z-10 " />
                    <span className="font-medium relative z-10 ">
                      {feature.title}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFeature.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <h3 className="text-2xl md:text-3xl font-bold ">
                  {activeFeature.title}
                </h3>
                <p className="md:text-xl text-lg text-muted-foreground leading-relaxed">
                  {activeFeature.description}
                </p>
                <ul className="space-y-3 mt-6">
                  <li className="flex items-center gap-3 text-foreground/80">
                    <CheckCircle2 className="w-5 h-5 text-accent" />
                    <span>AI-powered analysis of your requirements</span>
                  </li>
                  <li className="flex items-center gap-3 text-foreground/80">
                    <CheckCircle2 className="w-5 h-5 text-accent" />
                    <span>Automatic breakdown into actionable steps</span>
                  </li>
                  <li className="flex items-center gap-3 text-foreground/80">
                    <CheckCircle2 className="w-5 h-5 text-accent" />
                    <span>Seamless integration with your workflow</span>
                  </li>
                </ul>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative h-[500px] bg-secondary/30 rounded-[2rem] p-6 md:p-10 border border-border/50 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFeature.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full"
              >
                {activeFeature.content}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
