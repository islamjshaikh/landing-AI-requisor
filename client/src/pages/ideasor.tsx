import { motion } from "framer-motion";
import { useRef, useState } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.4, ease: "easeOut" },
  },
};

const stagger = {
  visible: {
    transition: { staggerChildren: 0.25, delayChildren: 0.2 },
  },
};

export default function IdeaSorPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  return (
    <main className="relative w-full text-foreground overflow-hidden">
      <section className="relative pt-28 pb-32 min-h-[90vh] flex items-center">
        
        <div className="absolute inset-0 z-0">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            className="w-full h-full object-cover opacity-50"
          >
            <source src="/dinovideo/dino2.mp4" type="video/mp4" />
          </video>

          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-background" />

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="absolute top-6 right-6 z-20 px-4 py-2 rounded-full
              bg-black/40 backdrop-blur border border-white/10
              text-sm hover:bg-emerald-500/60 transition"
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
          <motion.h1 variants={fadeUp} className="text-5xl md:text-6xl font-bold mb-6">
            💡 IdeaSor
          </motion.h1>

          <motion.p variants={fadeUp} className="text-xl md:text-2xl text-muted-foreground mb-4">
            The AI Ideation Agent That Never Runs Out of Ideas
          </motion.p>

          <motion.p variants={fadeUp} className="text-lg max-w-3xl mx-auto mb-10">
            Turn blank pages into bold ideas — on demand.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="h-14 px-10 rounded-3xl bg-emerald-500 text-black font-semibold hover:scale-105 transition">
              Generate Better Ideas Instantly
            </button>
            <button className="h-14 px-10 rounded-3xl border border-emerald-400 hover:bg-emerald-400/10 transition">
              Try IdeaSor Free
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
          The Problem
        </motion.h2>

        <motion.ul className="space-y-4 text-lg text-muted-foreground">
          {[
            "Great ideas don’t come on command",
            "Brainstorms stall",
            "Ideas feel recycled",
            "You overthink before starting",
            "Momentum dies at the idea stage",
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
            The Outcome
          </motion.h2>

          <motion.ul className="grid md:grid-cols-2 gap-6 text-lg">
            {[
              "✔ A constant flow of fresh ideas",
              "✔ Clear next steps",
              "✔ Faster execution",
              "✔ More confidence in what you build",
            ].map((item) => (
              <motion.li key={item} variants={fadeUp}>
                {item}
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
        <motion.h2 variants={fadeUp} className="text-4xl font-bold mb-4">
          How IdeaSor Helps
        </motion.h2>

        <motion.p variants={fadeUp} className="text-lg text-muted-foreground mb-10">
          Think better. Faster. Together.
        </motion.p>

        <motion.ul className="grid md:grid-cols-2 gap-6 text-lg">
          {[
            "Generate ideas across products, content, marketing, and growth",
            "Explore multiple angles instantly",
            "Stress-test ideas before committing",
            "Turn ideas into structured plans",
          ].map((item) => (
            <motion.li key={item} variants={fadeUp}>
              ✔ {item}
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
            What Makes IdeaSor Different
          </motion.h2>

          <motion.ul className="grid md:grid-cols-2 gap-6 text-lg">
            {[
              "🧠 Not random — context-aware ideation",
              "🔄 Iterative thinking, not one-off lists",
              "⚡ Designed to unblock momentum",
              "🛠 Built for builders, not note-takers",
            ].map((item) => (
              <motion.li key={item} variants={fadeUp}>
                {item}
              </motion.li>
            ))}
          </motion.ul>

          <motion.p variants={fadeUp} className="mt-12 text-2xl font-semibold text-center">
            This isn’t inspiration. It’s idea execution fuel.
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
            "Founders & entrepreneurs",
            "Creators & marketers",
            "Product teams",
            "Anyone stuck at “what should I do next?”",
          ].map((item) => (
            <motion.li key={item} variants={fadeUp}>
              ✔ {item}
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
          Stop staring at blank pages.
          <br />
          Start building.
        </motion.h2>

        <motion.button
          variants={fadeUp}
          className="mt-6 h-14 px-12 rounded-3xl bg-emerald-500 text-black font-semibold hover:scale-105 transition"
        >
          👉 Try IdeaSor Free
        </motion.button>
      </motion.section>
    </main>
  );
}
