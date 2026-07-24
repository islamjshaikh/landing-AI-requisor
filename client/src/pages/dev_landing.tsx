import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { ArrowRight, Play, Menu, X, Check, Upload, MessageSquare, Code, Star, Send, Zap, Target, Video, Mic, Brain, FileText, BarChart3, Layers } from "lucide-react";
import { useAuth } from "@/hooks/useAuth.tsx";
import { useLocation } from "wouter";
import logo from "@assets/Group_185_1764797140461.png";
import davidVideo from "/video/David_Video.mp4";
import "../landing-theme.css";

export default function DevLandingPage() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleGetStarted = () => {
    setLocation(isAuthenticated ? "/dashboard" : "/auth");
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    if (href.startsWith("#")) {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="landing-root dark min-h-screen overflow-x-hidden">
      <Navbar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        handleGetStarted={handleGetStarted}
        scrollToSection={scrollToSection}
        logo={logo}
      />
      <main className="bg-background text-foreground">
        <HeroSection handleGetStarted={handleGetStarted} scrollToSection={scrollToSection} />
        <WhyNotChatGPTSection />
        <ProblemSection />
        <WorkflowSection />
        <ChaosToClaritySection />
        <MeetingIntegrationSection />
        <TestimonialsSection />
        <PricingSection handleGetStarted={handleGetStarted} />
        <QuoteSection />
        <FinalCTA handleGetStarted={handleGetStarted} />
      </main>
      <FooterSection logo={logo} />
    </div>
  );
}

function Navbar({
  mobileMenuOpen,
  setMobileMenuOpen,
  handleGetStarted,
  scrollToSection,
  logo,
}: {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
  handleGetStarted: () => void;
  scrollToSection: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  logo: string;
}) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const links = [
    { name: "How it Works", href: "#workflow" },
    { name: "Problem", href: "#problem" },
    { name: "Pricing", href: "#pricing" },
    { name: "AI Agents Hub (Beta)", href: "/agents-hub", isRoute: true },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-background/90 backdrop-blur-xl border-b border-border/20 shadow-lg shadow-black/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Requisor Logo" className="h-10 w-auto" />
            <span className="font-bold text-xl md:text-2xl tracking-wide text-foreground">
              Requisor AI
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => {
                  if ((link as any).isRoute) return;
                  scrollToSection(e, link.href);
                }}
                className={`text-sm font-medium transition-colors ${
                  (link as any).isRoute
                    ? "text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full bg-emerald-500/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <a
              href="/auth"
              className="text-sm font-medium text-foreground hover:text-accent transition-colors"
            >
              Log In
            </a>
            <button
              onClick={handleGetStarted}
              className="px-5 py-2.5 rounded-full text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition-colors"
            >
              Get Started
            </button>
          </div>

          <button
            className="md:hidden text-foreground p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background/95 backdrop-blur-lg border-b border-border"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              {links.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => {
                    if ((link as any).isRoute) return;
                    scrollToSection(e, link.href);
                  }}
                  className={`block text-lg font-medium py-3 px-4 transition-colors ${
                    (link as any).isRoute ? "text-emerald-400" : "text-foreground hover:text-accent"
                  }`}
                >
                  {link.name}
                </a>
              ))}
              <div className="pt-4 flex flex-col gap-3">
                <a href="/auth" className="text-center font-medium py-3">Log in</a>
                <button
                  onClick={handleGetStarted}
                  className="w-full px-6 py-3 rounded-full font-semibold bg-emerald-500 text-white"
                >
                  Get Started
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function HeroChatBox({ handleGetStarted }: { handleGetStarted: () => void }) {
  const [mode, setMode] = useState<"build" | "plan">("build");
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleGetStarted();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="mt-10 max-w-xl"
    >
      <form onSubmit={handleSubmit} className="relative">
        <div className="rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.3)] p-3">
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => setMode("build")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                mode === "build"
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                  : "bg-white/5 text-white/50 hover:text-white/80 border border-white/10"
              }`}
            >
              Build
            </button>
            <button
              type="button"
              onClick={() => setMode("plan")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                mode === "plan"
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                  : "bg-white/5 text-white/50 hover:text-white/80 border border-white/10"
              }`}
            >
              Plan
            </button>
            <span className="text-[10px] text-white/30 ml-auto">powered by AI</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={mode === "build"
                ? "Describe a feature to build..."
                : "Describe a project to plan..."
              }
              className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm outline-none px-1 py-2"
            />
            <button
              type="submit"
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>
      <p className="text-xs text-white/30 mt-3 text-center">
        Try it out. Sign up free to start building with AI
      </p>
    </motion.div>
  );
}

function HeroSection({
  handleGetStarted,
  scrollToSection,
}: {
  handleGetStarted: () => void;
  scrollToSection: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-32 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              AI-Powered Product Discovery
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-6 leading-[1.1]">
              Turn conversations into execution{" "}
              <span className="text-emerald-400">automatically</span>
            </h1>

            <p className="text-lg text-muted-foreground mb-4 max-w-xl leading-relaxed">
              Requisor transforms meetings, customer feedback, and product data into
              execution-ready plans with tasks, owners, and timelines, in minutes.
            </p>

            <p className="text-sm text-emerald-400/80 mb-6 font-medium">
              From conversation → decision → execution. In one system.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <button
                onClick={handleGetStarted}
                className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition-all"
              >
                Start free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#workflow"
                onClick={(e) => scrollToSection(e, "#workflow")}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold border border-border text-foreground hover:bg-white/5 transition-all"
              >
                <Play className="w-4 h-4" />
                See how it works
              </a>
            </div>

            <HeroChatBox handleGetStarted={handleGetStarted} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="absolute -top-4 left-8 z-20 bg-[#1a1f2e] border border-white/10 rounded-xl p-4 shadow-2xl"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs text-muted-foreground">AI Suggestion</span>
                </div>
                <p className="text-sm font-semibold text-foreground">Feature: Dark Mode</p>
                <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-emerald-500 rounded-full" />
                </div>
              </motion.div>

              <img
                src="/dinocard2/dino5.png"
                alt="Requisor Dino Mascot"
                className="w-80 h-auto mx-auto relative z-10 drop-shadow-2xl"
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className="absolute -bottom-2 right-4 z-20 bg-[#1a1f2e] border border-white/10 rounded-xl p-4 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground font-mono">TICKET-142</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                    READY
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">Update User Schema</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-8 h-4 bg-white/10 rounded-full relative">
                    <div className="absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-white/40" />
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function WhyNotChatGPTSection() {
  const comparisonRows = [
    { left: "Works per interaction with limited continuity across workflows", right: "Unified product memory across meetings, data, and feedback" },
    { left: "Requires manual input of transcripts, notes, and data", right: "Automatic ingestion from Zoom, Meet, Teams, and files" },
    { left: "Context fragmented across tools", right: "Persistent context that improves over time" },
    { left: "Outputs insights, not structured execution", right: "Generates prioritized decisions + execution-ready plans" },
    { left: "You assemble the product story", right: "Connects feedback → features → tasks → build" },
  ];

  return (
    <section className="py-20 md:py-32 relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight leading-tight">
            Why not just use{" "}
            <span className="text-muted-foreground">ChatGPT?</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            General-purpose AI is great for brainstorming. But product decisions need structured context, not one-off prompts.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center md:text-left"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold mb-4">
              LLMs
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center md:text-left"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold mb-4">
              Requisor
            </div>
          </motion.div>
        </div>

        <div className="space-y-3 mt-2">
          {comparisonRows.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="grid md:grid-cols-2 gap-3 md:gap-6"
            >
              <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">{row.left}</p>
              </div>
              <div className="flex items-start gap-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
                <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">{row.right}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-10 text-lg font-semibold text-foreground"
        >
          ChatGPT helps you <span className="text-muted-foreground">think</span>.
          Requisor helps you <span className="text-emerald-400">decide and execute</span>.
        </motion.p>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section id="problem" className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight leading-tight">
            Code is not the hard part.
            <br />
            <span className="text-emerald-400">Knowing what to build is.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            While coding gets 100x faster with AI, product definition is stuck in 2015.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0 }}
            className="bg-card/50 backdrop-blur-sm p-8 rounded-2xl border border-border/50"
          >
            <h3 className="text-lg font-bold text-foreground mb-3">Disconnected Insights</h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Customer research lives in Google Docs, completely disconnected from what actually gets
              built.
            </p>
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-400 mb-1">40%</div>
              <p className="text-sm text-muted-foreground">
                Of dev time is wasted on reworking unclear requirements.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-card/50 backdrop-blur-sm p-8 rounded-2xl border border-border/50"
          >
            <h3 className="text-lg font-bold text-foreground mb-3">The Manual Grind</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400/70" />
                Writing tickets manually
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400/70" />
                Updating Jira status
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400/70" />
                Chasing stakeholders
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400/70" />
                Lost context in Slack
              </li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-card/50 backdrop-blur-sm p-8 rounded-2xl border border-border/50"
          >
            <h3 className="text-lg font-bold text-foreground mb-3">No Traceability</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Feature requests are scattered across 5 different tools. No system connects feedback
              → prioritization → product spec.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section id="workflow" className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-4">
            How It Works
          </p>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight leading-tight">
            Two modes.{" "}
            <span className="text-emerald-400">One system.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Build Mode figures out what to build. Plan Mode makes it happen.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0 }}
            className="relative bg-card/50 backdrop-blur-sm p-8 rounded-2xl border border-border/50 group hover:border-emerald-500/30 transition-colors"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                <Target className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Build Mode</div>
                <h3 className="text-xl font-bold text-foreground">Decide what to build</h3>
              </div>
            </div>
            <ul className="space-y-3">
              {[
                "Analyze meetings, feedback, and usage data",
                "Identify opportunities with AI-powered scoring",
                "Generate feature specs with evidence and reasoning",
                "Prioritize with confidence, not gut feeling",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="relative bg-card/50 backdrop-blur-sm p-8 rounded-2xl border border-border/50 group hover:border-emerald-500/30 transition-colors"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Plan Mode</div>
                <h3 className="text-xl font-bold text-foreground">Execute what matters</h3>
              </div>
            </div>
            <ul className="space-y-3">
              {[
                "Generate PRDs, tasks, and timelines instantly",
                "Assign ownership and set milestones",
                "Export to Jira, Asana, or Monday.com",
                "Keep every plan linked to its evidence",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ChaosToClaritySection() {
  const beforeItems = [
    { icon: Video, label: "Calls in Zoom", color: "text-blue-400" },
    { icon: FileText, label: "Notes in Notion", color: "text-orange-400" },
    { icon: MessageSquare, label: "Feedback in Slack", color: "text-purple-400" },
    { icon: BarChart3, label: "Data in dashboards", color: "text-cyan-400" },
    { icon: Layers, label: "Tasks in Jira", color: "text-yellow-400" },
  ];

  const afterItems = [
    { icon: Upload, label: "All inputs ingested automatically" },
    { icon: Brain, label: "AI identifies patterns across sources" },
    { icon: Target, label: "Suggests what to build next with evidence" },
    { icon: Zap, label: "Generates execution-ready plans" },
  ];

  return (
    <section className="py-20 md:py-32 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight leading-tight">
            From scattered inputs to{" "}
            <span className="text-emerald-400">clear decisions</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your product knowledge is trapped across five different tools. Requisor brings it all together.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-red-500/5 border border-red-500/10 rounded-2xl p-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold mb-6">
              Before Requisor
            </div>
            <div className="space-y-4">
              {beforeItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </motion.div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-red-500/10">
              <p className="text-sm text-red-400/80 font-medium">Nothing connected. Context lost daily.</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-6">
              With Requisor
            </div>
            <div className="space-y-4">
              {afterItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-sm text-foreground">{item.label}</span>
                </motion.div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-emerald-500/10">
              <p className="text-sm text-emerald-400/80 font-medium">One system. Everything connected.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function MeetingIntegrationSection() {
  const meetingFeatures = [
    {
      icon: Video,
      title: "Import from Zoom, Meet & Teams",
      description: "Connect your calendar and import meetings automatically. No manual entry needed.",
    },
    {
      icon: Mic,
      title: "Capture insights automatically",
      description: "AI transcribes and analyzes every conversation to extract decisions, pain points, and opportunities.",
    },
    {
      icon: Brain,
      title: "No more lost context",
      description: "Every meeting insight is preserved and linked to your product evidence library.",
    },
    {
      icon: Target,
      title: "Feed your roadmap",
      description: "Every conversation automatically surfaces feature candidates and shapes your product direction.",
    },
  ];

  return (
    <section className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-14"
        >
          <p className="text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-4">
            Meeting Intelligence
          </p>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight leading-tight">
            Turn every meeting into{" "}
            <span className="text-emerald-400">product intelligence</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stop losing insights buried in call recordings. Requisor turns every conversation into actionable product decisions.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {meetingFeatures.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card/50 backdrop-blur-sm p-6 rounded-2xl border border-border/50 group hover:border-emerald-500/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <feature.icon className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const testimonials = [
    {
      quote:
        '" Requisor has been such a lifesaver for consulting projects! Specifically, Requisor has been so helpful in requirements gathering to have it all in one place. When working in other projects it can be so time consuming and hard to keep track of all the information across different platforms. It\'s been so much easier now with Requisor!"',
      author: "Erin Magennis",
      role: "Emerging Science Tech Startup Strategist",
      image: "/test/erin.png",
      hasVideo: false,
    },
    {
      quote: "",
      author: "David Nowak",
      role: "Consulting Firm Partner",
      image: "/test/david.jpeg",
      hasVideo: true,
    },
    {
      quote:
        '"Honestly, Requisor feels like the teammate I never had. I used to spend late nights trying to piece together project plans, but now I just write my messy ideas and it gives me clarity in minutes. It\'s taken a huge weight off my shoulders and let me fall back in love with the creative side of my business."',
      author: "Emily kapszukiewicz",
      role: "Startup Founder",
      image: "/test/emeli.png",
      hasVideo: false,
    },
  ];

  return (
    <section ref={sectionRef} id="testimonials" className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
            Teams that ship with clarity
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            See how founders, consultants, and product teams use Requisor to go from conversation to execution.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.15, type: "spring", stiffness: 90, damping: 26 }}
              className="group relative rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.4)] p-6"
            >
              <div className="flex gap-1 mb-4 text-emerald-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-3 h-3 fill-current" />
                ))}
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-emerald-600 shadow-lg">
                  <img src={t.image} alt={t.author} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">{t.author}</div>
                  <div className="text-sm text-muted-foreground">{t.role}</div>
                </div>
              </div>

              {!t.hasVideo && (
                <p className="text-sm leading-relaxed text-foreground/80">{t.quote}</p>
              )}

              {t.hasVideo && (
                <div
                  className="cursor-pointer"
                  onClick={() => setIsVideoPlaying((prev) => !prev)}
                >
                  {!isVideoPlaying ? (
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
                      <video
                        className="w-full h-full object-cover opacity-60"
                        src={davidVideo}
                        muted
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                        </div>
                      </div>
                      <div className="absolute bottom-3 left-3 right-3">
                        <span className="text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                          Watch David's testimonial
                        </span>
                      </div>
                    </div>
                  ) : (
                    <video
                      autoPlay
                      controls
                      className="w-full aspect-video rounded-xl"
                      src={davidVideo}
                    />
                  )}
                </div>
              )}

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-400/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl" />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-20 text-center"
        >
          <p className="text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-3">
            AI Agents
          </p>
          <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Meet your AI execution team
          </h3>
          <p className="text-base text-muted-foreground max-w-xl mx-auto mb-6">
            Each agent owns a part of your workflow and works together to move you from idea to execution.
          </p>
          <a
            href="/agents-hub"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-sm"
          >
            Explore AI Agents Hub
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>

        <div className="mt-16">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-center mb-6">
            Our Partner companies
          </p>
          <LogoSlider />
        </div>
      </div>
    </section>
  );
}

function LogoSlider() {
  const [translateX, setTranslateX] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const logos = [
    { src: "/logos/logo1.png", name: "TechCorp" },
    { src: "/logos/logo2.png", name: "InnovateX" },
    { src: "/logos/logo3.png", name: "DataFlow" },
    { src: "/logos/logo5.png", name: "CloudSys" },
    { src: "/logos/logo6.png", name: "QuantumAI" },
    { src: "/logos/logo7.png", name: "FutureTech" },
    { src: "/logos/logo8.png", name: "NexGen" },
  ];

  const duplicatedLogos = [...logos, ...logos];

  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp = 0;
    const speed = 0.6;

    const animate = (timestamp: number) => {
      if (!isPaused) {
        if (!lastTimestamp) lastTimestamp = timestamp;
        const delta = timestamp - lastTimestamp;
        setTranslateX((prev) => {
          const newX = prev - (speed * delta) / 16.67;
          const totalWidth = logos.length * 200 + logos.length * 48;
          return newX <= -totalWidth ? 0 : newX;
        });
        lastTimestamp = timestamp;
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPaused, logos.length]);

  return (
    <div
      className="relative w-full overflow-hidden py-8 group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className="flex items-center gap-x-12 opacity-100 grayscale group-hover:grayscale-0 transition-all duration-500"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isPaused ? "transform 0.2s ease-out" : "none",
          width: "max-content",
        }}
      >
        {duplicatedLogos.map((l, index) => (
          <div key={index} className="flex-shrink-0">
            <img
              src={l.src}
              alt={`${l.name} logo`}
              className="h-16 md:h-20 w-auto object-contain brightness-0 invert opacity-70 hover:opacity-100 transition-all duration-300"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingSection({ handleGetStarted }: { handleGetStarted: () => void }) {
  return (
    <section id="pricing" className="py-20 md:py-32 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[130px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-8 tracking-tight">
          Ready to transform your
          <br />
          business with AI?
        </h2>
        <p className="text-xl text-muted-foreground mb-14 max-w-2xl mx-auto">
          Join thousands of solopreneurs and small teams who are scaling smarter with Requisor.
        </p>

        <div className="flex flex-wrap justify-center gap-6">
          <PricingCard
            tier="Free- Explorer"
            price="$0 / month"
            description="For curious builders, students, and early-stage founders."
            features={[
              "1 active project",
              "AI Project Generator (idea → milestones)",
              "Project Canvas (edit, reorder, reprioritize)",
              "Basic AI task refinement",
              "Limited AI usage (daily cap)",
            ]}
            buttonText="Start for free"
            onButtonClick={handleGetStarted}
            highlighted={false}
          />
          <PricingCard
            tier="Builder"
            price="$29 / month"
            description="For solo founders, freelancers, and consultants."
            features={[
              "Unlimited projects",
              "Full AI Project Generator",
              "Project Canvas + Board view",
              "AI task breakdown & prioritization",
              "AI rewrite, clarify, and scope tasks",
              "Export to PDF / CSV",
              "Access for core agents",
              "Higher AI usage limits",
            ]}
            buttonText="Buy Builder version"
            onButtonClick={() => {}}
            highlighted={false}
          />
          <PricingCard
            tier="Pro · Most Popular ⭐"
            price="$99 / month"
            description="For agencies, startups, and small teams."
            features={[
              "Everything in Builder",
              "Full AI Agents Hub",
              "Multi-project roadmap view",
              "Advanced AI reasoning",
              "Team collaboration (up to X users)",
              "Integrations (Jira, Notion, Asana, Monday phased rollout)",
              "Export to Jira / PM tools",
              "Brand & tone memory (project-level instructions)",
              "Priority AI compute",
            ]}
            buttonText="Buy Pro version"
            onButtonClick={() => {}}
            highlighted={true}
          />
          <PricingCard
            tier="Customise"
            price="Custom pricing"
            description="For universities, enterprises, and regulated industries."
            features={[
              "Everything in Pro",
              "Custom AI agents & workflows",
              "Private model routing / data isolation",
              "Advanced integrations & APIs",
              "SSO & role-based access",
              "Dedicated onboarding & support",
              "SLA + compliance (HIPAA / SOC2-ready roadmap)",
              "White-labeled or co-branded options",
            ]}
            buttonText="Contact for pricing"
            onButtonClick={() => {}}
            highlighted={false}
          />
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          No credit card required · Cancel anytime
        </p>
      </div>
    </section>
  );
}

function PricingCard({
  tier,
  price,
  description,
  features,
  buttonText,
  onButtonClick,
  highlighted,
}: {
  tier: string;
  price: string;
  description: string;
  features: string[];
  buttonText: string;
  onButtonClick: () => void;
  highlighted: boolean;
}) {
  return (
    <div
      className={`relative rounded-3xl ${
        highlighted
          ? "p-[2px] bg-[conic-gradient(from_180deg_at_50%_50%,#34ffd2,#22d3ee,#34ffd2)] shadow-[0_0_40px_rgba(52,255,210,0.4)] scale-[1.03] z-20"
          : "p-[2px]"
      }`}
    >
      <div
        className={`relative rounded-3xl ${
          highlighted
            ? "border-2 border-emerald-300 shadow-[0_0_25px_rgba(52,255,210,0.3)]"
            : "border border-white/20"
        } bg-neutral-900`}
      >
        <div className="relative w-[18rem] rounded-3xl bg-neutral-900 text-white">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-white/10 blur-xl mix-blend-overlay pointer-events-none" />

          <div className="relative z-10 flex h-full flex-col p-8">
            <span
              className={`w-fit rounded-xl px-2 py-1 text-xs font-bold uppercase ${
                highlighted
                  ? "bg-black border border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(52,255,210,0.4)]"
                  : "bg-white/10"
              }`}
            >
              {tier}
            </span>

            <h2 className="mt-3 text-3xl font-medium">{price}</h2>
            <p className="mt-4 text-xs opacity-70">{description}</p>

            <ul className="mt-6 space-y-3 text-xs">
              {features.map((feature, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 flex-shrink-0">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </span>
                  <span className="leading-relaxed">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={onButtonClick}
              className="mt-6 rounded-xl border border-white/30 bg-white/5 px-4 py-2.5 font-semibold backdrop-blur hover:bg-white/10 transition text-sm"
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuoteSection() {
  return (
    <section className="py-20 md:py-32 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <blockquote className="text-2xl md:text-4xl font-bold text-foreground mb-8 leading-tight">
            "The best products aren't built from guesses. They're built from conversations."
          </blockquote>
          <p className="text-lg text-muted-foreground mb-8">
            Requisor closes the loop from customer conversation to product decision to team execution, automatically.
          </p>
          <img
            src="/assets/dino-logo.png"
            alt="Requisor"
            className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-white/10"
          />
        </motion.div>
      </div>
    </section>
  );
}

function FinalCTA({ handleGetStarted }: { handleGetStarted: () => void }) {
  return (
    <section className="py-20 md:py-32 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight leading-tight">
            From conversation to execution.
            <br />
            <span className="text-emerald-400">In one system.</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Stop losing product insights across scattered tools. Start making evidence-backed decisions today.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleGetStarted}
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition-all text-lg"
            >
              Start free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold border border-border text-foreground hover:bg-white/5 transition-all text-lg"
            >
              Schedule a Demo
            </button>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-sm text-muted-foreground"
          >
            Try it on your last meeting transcript and see what Requisor finds.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

function FooterSection({ logo }: { logo: string }) {
  return (
    <footer className="bg-background pt-16 pb-12 border-t border-border relative">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <img src={logo} alt="Requisor Logo" className="h-10 w-auto" />
              <span className="font-semibold text-xl tracking-wide text-foreground">
                Requisor AI
              </span>
            </div>
            <p className="text-muted-foreground max-w-xs mb-6 leading-relaxed text-sm">
              Making bad projects extinct. The smart project manager for the AI era.
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-foreground text-sm">Product</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-accent transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-accent transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Changelog</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Docs</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-foreground text-sm">Company</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-accent transition-colors">About</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-foreground text-sm">Legal & Support</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="/privacy-policy" className="hover:text-accent transition-colors">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-accent transition-colors">Terms of Use</a></li>
              <li><a href="/support" className="hover:text-accent transition-colors">Support</a></li>
              <li><a href="/zoom-integration" className="hover:text-accent transition-colors">Zoom Integration</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border/50 text-center text-sm text-muted-foreground flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; {new Date().getFullYear()} Requisor AI. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            All systems operational
          </p>
        </div>
      </div>
    </footer>
  );
}
