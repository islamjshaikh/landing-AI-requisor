import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, LayoutDashboard, Share2, Check, Send, Paperclip, Facebook, Linkedin, Instagram, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import CanvasCursor from "@/pages/cursor_d";

const agents = [
  {
    id: "planning",
    title: "Planning Agent",
    icon: MessageSquare,
    description: "Chat with Requisor to turn messy brain dumps into structured, actionable project plans.",
    color: "bg-indigo-500",
    content: (
      <div className="bg-background rounded-xl shadow-lg border border-border h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-secondary/30">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="font-semibold text-sm">AI Project Planner</span>
            </div>
            <Button variant="ghost" size="sm" className="h-6 text-xs">New Session</Button>
        </div>
        
        {/* Chat Area */}
        <div className="flex-1 p-4 space-y-4 overflow-hidden flex flex-col">
            <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
                    <MessageSquare className="w-4 h-4" />
                </div>
                <div className="bg-secondary/50 p-3 rounded-lg rounded-tl-none text-sm max-w-[90%]">
                    Hi! I'm your AI project planner. Upload files or describe your idea to start planning.
                </div>
            </div>

            <div className="flex gap-3 flex-row-reverse">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold">You</span>
                </div>
                <div className="bg-primary text-primary-foreground p-3 rounded-lg rounded-tr-none text-sm max-w-[90%]">
                    Create a new marketing campaign for our Q3 product launch, focusing on social media and email outreach.
                </div>
            </div>

            <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
                    <MessageSquare className="w-4 h-4" />
                </div>
                <div className="bg-secondary/50 p-3 rounded-lg rounded-tl-none text-sm max-w-[90%] space-y-2">
                    <p>Great idea! I'm generating a structured plan for your marketing campaign.</p>
                    <div className="bg-background border rounded p-2 mt-2 text-xs font-mono text-muted-foreground">
                        <div className="flex items-center gap-2 mb-1"><Check className="w-3 h-3 text-green-500" /> Analyzing requirements...</div>
                        <div className="flex items-center gap-2 mb-1"><Check className="w-3 h-3 text-green-500" /> Creating task breakdown...</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" /> Generating timeline...</div>
                    </div>
                </div>
            </div>
        </div>

        {/* Input Area */}
        <div className="p-3 border-t bg-background">
            <div className="flex gap-2">
                <div className="flex-1 bg-secondary/30 rounded-md px-3 py-2 text-sm text-muted-foreground flex items-center justify-between">
                    <span>Describe your project idea...</span>
                    <Paperclip className="w-4 h-4" />
                </div>
                <Button size="icon" className="h-9 w-9 bg-accent hover:bg-accent/90">
                    <Send className="w-4 h-4" />
                </Button>
            </div>
        </div>
      </div>
    )
  },
  {
    id: "manager",
    title: "Project Manager Agent",
    icon: LayoutDashboard,
    description: "Keeps your project on track. Automatically assigns tasks, sets deadlines, and flags risks.",
    color: "bg-blue-500",
    content: (
      <div className="bg-background rounded-xl shadow-lg border border-border h-full flex flex-col overflow-hidden">
         <div className="p-6 bg-purple-50/50 h-full flex flex-col justify-center">
            <div className="bg-white rounded-xl shadow-sm border p-6 max-w-md mx-auto w-full">
                <div className="flex items-center gap-2 mb-4 text-purple-600 font-medium">
                    <div className="w-5 h-5 rounded bg-purple-100 flex items-center justify-center">✨</div>
                    Create Project with AI
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Project Goal</label>
                        <div className="h-20 bg-secondary/20 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                            Launch web app MVP by end of month...
                        </div>
                    </div>
                    
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Detected Tasks</label>
                        <div className="space-y-2">
                             <div className="flex items-center justify-between bg-secondary/20 p-2 rounded text-sm">
                                <span>Design UI mockups</span>
                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">High</span>
                             </div>
                             <div className="flex items-center justify-between bg-secondary/20 p-2 rounded text-sm">
                                <span>Setup DB Schema</span>
                                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Medium</span>
                             </div>
                        </div>
                    </div>

                    <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                        Generate Full Plan
                    </Button>
                </div>
            </div>
         </div>
      </div>
    )
  },
  {
    id: "social",
    title: "Social Media Agent",
    icon: Share2,
    description: "Generate content, connect to platforms, and schedule posts seamlessly.",
    color: "bg-pink-500",
    content: (
        <div className="bg-background rounded-xl shadow-lg border border-border h-full flex items-center justify-center overflow-hidden">
          <img
            src="/pic/pic.jpeg"
            alt="Social Media Dashboard"
            className="max-h-full max-w-full object-contain"
          />
        </div>

    )
  }
];

export function AIAgentsSection() {
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const activeAgent = agents[activeAgentIndex];

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setActiveAgentIndex((prev) => (prev + 1) % agents.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const handleManualSelect = (index: number) => {
    setActiveAgentIndex(index);
    setIsPaused(true);
  };

  return (
    <section className="py-20 md:py-15 bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 md:mb-24 max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-5xl font-bold mb-6 tracking-normal">Meet Your New AI Workforce</h2>
          <p className="text-sm md:text-lg text-muted-foreground leading-relaxed">
            Deploy specialized agents to handle the heavy lifting. From planning to promotion, Requisor has an agent for that.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 md:gap-16 items-center">
          {/* Left Side: Navigation */}
          <div className="lg:col-span-5 space-y-4">
            {agents.map((agent, index) => {
              const isActive = activeAgentIndex === index;
              return (
                <button
                  key={agent.id}
                  onClick={() => handleManualSelect(index)}
                  className={`w-full text-left p-6 rounded-2xl transition-all border relative overflow-hidden group ${
                    isActive 
                      ? "bg-secondary/30 border-accent/50 shadow-sm" 
                      : "bg-background border-transparent hover:bg-secondary/10"
                  }`}
                >
                  {isActive && !isPaused && (
                    <motion.div 
                        layoutId="agent-progress"
                        initial={{ height: "0%" }}
                        animate={{ height: "100%" }}
                        transition={{ duration: 3, ease: "linear" }}
                        className="absolute left-0 top-0 w-1 bg-accent h-full"
                    />
                  )}
                  
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${isActive ? "bg-accent text-white" : "bg-secondary text-muted-foreground group-hover:text-foreground"}`}>
                        <agent.icon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className={`text-xl font-bold mb-2 ${isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                            {agent.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {agent.description}
                        </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Side: Visual Preview */}
          <div className="lg:col-span-7 relative h-[600px]">
             <div className="absolute inset-0 bg-gradient-to-tr from-accent/5 to-purple-500/5 rounded-3xl -z-10 blur-3xl" />
             
             <AnimatePresence mode="wait">
               <motion.div
                 key={activeAgent.id}
                 initial={{ opacity: 0, x: 50, scale: 0.95 }}
                 animate={{ opacity: 1, x: 0, scale: 1 }}
                 exit={{ opacity: 0, x: -50, scale: 1.05 }}
                 transition={{ duration: 0.4, ease: "easeOut" }}
                 className="w-full h-full"
               >
                 {activeAgent.content}
               </motion.div>
             </AnimatePresence>
          </div>
        </div>
      </div>
        <CanvasCursor />
    </section>
  );
}
