import { motion, Variants } from "framer-motion";
import { useState, useRef } from "react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 1.6,
      ease: "easeOut",
    },
  },
};

const stagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.35,
      delayChildren: 0.3,
    },
  },
};

export default function DataSorPage() {
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <main className="relative w-full text-foreground overflow-hidden">
      
      <section className="relative pt-28 pb-32">
        
        <div className="absolute inset-0 z-0">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            className="w-full h-full object-cover opacity-50"
          >
            <source src="/dinovideo/dino4.mp4" type="video/mp4" />
          </video>

          
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-transparent" />

          
          <button
            onClick={toggleMute}
            className="absolute top-6 right-6 z-20 px-4 py-2 rounded-full
              bg-black/40 backdrop-blur-md border border-white/10
              text-white text-sm hover:bg-emerald-500/70 transition"
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
        </div>

        
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative z-10 max-w-6xl mx-auto px-6 text-center"
        >
          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-6xl font-bold mb-6"
          >
            🧠 DataSor
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-xl md:text-2xl text-muted-foreground mb-4"
          >
            The AI Data Agent for Instant Insights
          </motion.p>

          <motion.p
            variants={fadeUp}
            className="text-lg max-w-3xl mx-auto mb-4 text-emerald-400"
          >
            Turn messy data into decisions in minutes — not dashboards in weeks.
          </motion.p>

          <motion.p variants={fadeUp}
            className="text-lg max-w-3xl mx-auto mb-5 text-emerald-400 ">👉 No Tableau. No Power BI. No formatting hell.
          </motion.p>
          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row justify-center gap-4"
          >
            <button className="h-14 px-8 rounded-3xl bg-emerald-500 text-black font-semibold hover:scale-105 transition">
              Get Insights Instantly
            </button>
            <button className="h-14 px-8 rounded-3xl border border-emerald-400 hover:bg-emerald-400/10 transition">
              Try DataSor Free
            </button>
          </motion.div>
        </motion.div>
      </section>

      
      <motion.section
        className="py-24 max-w-6xl mx-auto px-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <motion.h2 variants={fadeUp} className="text-4xl font-bold mb-10">
          Most teams don’t need another dashboard.
        </motion.h2>

        <motion.ul className="space-y-4 text-lg text-muted-foreground">
          {[
            "Dashboards take weeks to build",
            "Stakeholders still ask follow-up questions",
            "Data lives across tools & spreadsheets",
            "Insights trapped behind filters",
          ].map((item) => (
            <motion.li key={item} variants={fadeUp}>
              • {item}
            </motion.li>
          ))}
        </motion.ul>
      </motion.section>

    
      <motion.section
        className="py-24 bg-muted/30"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <div className="max-w-6xl mx-auto px-6">
          <motion.h2 variants={fadeUp} className="text-4xl font-bold mb-10">
            What teams actually want
          </motion.h2>

          <motion.ul className="grid md:grid-cols-2 gap-6 text-lg">
            {[
              "Clear answers, fast",
              "One-click analysis",
              "Plain English insights",
              "Adaptive visuals",
            ].map((item) => (
              <motion.li key={item} variants={fadeUp}>
                ✔ {item}
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </motion.section>

      
      <motion.section
        className="py-24 max-w-6xl mx-auto px-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <motion.h2 variants={fadeUp} className="text-4xl font-bold mb-10">
          How DataSor Helps
        </motion.h2>

        <motion.ul className="space-y-4 text-lg text-muted-foreground mb-12">
          {[
            "Upload data or connect sources",
            "Ask questions in plain English",
            "Get analysis, charts, and summaries instantly",
            "Refine insights conversationally — no rebuilds",
          ].map((item) => (
            <motion.li key={item} variants={fadeUp}>
              • {item}
            </motion.li>
          ))}
        </motion.ul>

        <motion.div
          variants={stagger}
          className="grid md:grid-cols-3 gap-6 text-center text-lg font-medium"
        >
          {[
            "“What changed last month?”",
            "“Why did revenue dip in the Midwest?”",
            "“Which segment is growing fastest?”",
            "“Show me the Q4 forecast”"
          ].map((q) => (
            <motion.div
              key={q}
              variants={fadeUp}
              className="p-6 rounded-2xl border border-white/10 bg-muted/30"
            >
              {q}
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      
      <motion.section
        className="py-24 bg-muted/30"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <div className="max-w-6xl mx-auto px-6">
          <motion.h2 variants={fadeUp} className="text-4xl font-bold mb-10">
            Why DataSor Wins
          </motion.h2>

          <motion.ul className="grid md:grid-cols-2 gap-6 text-lg">
            {[
              "🚫 No clunky dashboard design",
              "⚡ No waiting on analysts",
              "🧠 No SQL, formulas, or filters",
              "📊 Insights adapt as questions change",
            ].map((item) => (
              <motion.li key={item} variants={fadeUp}>
                {item}
              </motion.li>
            ))}
          </motion.ul>

          <motion.p
            variants={fadeUp}
            className="mt-12 text-2xl font-semibold text-center"
          >
            This isn’t BI software. It’s decision intelligence.
          </motion.p>
        </div>
      </motion.section>

    
      <motion.section
        className="py-24 max-w-6xl mx-auto px-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <motion.h2 variants={fadeUp} className="text-4xl font-bold mb-10">
          Who It’s For
        </motion.h2>

        <motion.ul className="grid md:grid-cols-2 gap-6 text-lg text-muted-foreground">
          {[
            "Founders & operators",
            "Product managers",
            "Marketing & growth teams",
            "Consultants & agencies",
            "Anyone tired of dashboards that don’t answer questions",
          ].map((role) => (
            <motion.li key={role} variants={fadeUp}>
              ✔ {role}
            </motion.li>
          ))}
        </motion.ul>
      </motion.section>

      <motion.section
        className="py-28 text-center"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <motion.h2 variants={fadeUp} className="text-4xl font-bold mb-6">
          Stop building dashboards.
          <br />
          Start making decisions.
        </motion.h2>

        <motion.button
          variants={fadeUp}
          className="mt-6 h-14 px-10 rounded-3xl bg-emerald-500 text-black font-semibold hover:scale-105 transition"
        >
          Try DataSor Free
        </motion.button>
      </motion.section>
    </main>
  );
}