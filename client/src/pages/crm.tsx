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

export default function CRMSorPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  return (
    <main className="relative w-full text-foreground overflow-hidden">
      {/* HERO */}
      <section className="relative pt-28 pb-32 min-h-[90vh] flex items-center">
        {/* VIDEO BG */}
        <div className="absolute inset-0 z-0">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            className="w-full h-full object-cover opacity-50"
          >
            <source src="/dinovideo/dino1.mp4" type="video/mp4" />
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

        {/* HERO CONTENT */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative z-10 max-w-6xl mx-auto px-6 text-center"
        >
          <motion.h1 variants={fadeUp} className="text-5xl md:text-6xl font-bold mb-6">
            🤝 CRMSor
          </motion.h1>

          <motion.p variants={fadeUp} className="text-xl md:text-2xl text-muted-foreground mb-4">
            The AI Sales & CRM Agent That Actually Drives Revenue
          </motion.p>

          <motion.p variants={fadeUp} className="text-lg max-w-3xl mx-auto mb-10">
            Turn strangers into leads. Leads into customers. Automatically.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="h-14 px-10 rounded-3xl bg-emerald-500 text-black font-semibold hover:scale-105 transition">
              Start Closing More Deals
            </button>
            <button className="h-14 px-10 rounded-3xl border border-emerald-400 hover:bg-emerald-400/10 transition">
              Try CRMSor Free
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* PROBLEM */}
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
            "CRMs store data — they don’t sell",
            "Leads fall through cracks",
            "Outreach is manual and inconsistent",
            "ICPs are vague guesses",
            "CRMs become graveyards, not growth engines",
          ].map((item) => (
            <motion.li key={item} variants={fadeUp}>
              • {item}
            </motion.li>
          ))}
        </motion.ul>
      </motion.section>

      {/* OUTCOME */}
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
              "✔ A clear, focused ICP",
              "✔ A steady stream of qualified leads",
              "✔ Personalized outreach at scale",
              "✔ Sales momentum without manual grind",
            ].map((item) => (
              <motion.li key={item} variants={fadeUp}>
                {item}
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </motion.section>

      {/* HOW IT HELPS */}
      <motion.section
        className="py-24 max-w-6xl mx-auto px-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <motion.h2 variants={fadeUp} className="text-4xl font-bold mb-4">
          How CRMSor Helps
        </motion.h2>

        <motion.p variants={fadeUp} className="text-lg text-muted-foreground mb-10">
          Your AI sales engine, end to end.
        </motion.p>

        <motion.ul className="grid md:grid-cols-2 gap-6 text-lg">
          {[
            "Define and refine your ICP",
            "Identify and enrich leads",
            "Organize them into a smart CRM",
            "Draft outreach messages",
            "Track engagement and next actions",
          ].map((item) => (
            <motion.li key={item} variants={fadeUp}>
              ✔ {item}
            </motion.li>
          ))}
        </motion.ul>
      </motion.section>

      {/* WHY IT WORKS */}
      <motion.section
        className="py-24 bg-muted/30"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <div className="max-w-6xl mx-auto px-6">
          <motion.h2 variants={fadeUp} className="text-4xl font-bold mb-10">
            Why CRMSor Works
          </motion.h2>

          <motion.ul className="grid md:grid-cols-2 gap-6 text-lg">
            {[
              "🎯 Focuses on fit, not volume",
              "🧠 Learns what converts and doubles down",
              "📬 Personalized outreach without busywork",
              "📊 Sales insights without CRM clutter",
            ].map((item) => (
              <motion.li key={item} variants={fadeUp}>
                {item}
              </motion.li>
            ))}
          </motion.ul>

          <motion.p variants={fadeUp} className="mt-12 text-2xl font-semibold text-center">
            This isn’t another CRM. It’s AI-driven sales execution.
          </motion.p>
        </div>
      </motion.section>

      {/* WHO IT’S FOR */}
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
            "Solo founders & small teams",
            "B2B startups",
            "Agencies & consultants",
            "Anyone selling without a sales ops team",
          ].map((item) => (
            <motion.li key={item} variants={fadeUp}>
              ✔ {item}
            </motion.li>
          ))}
        </motion.ul>
      </motion.section>

      {/* CTA */}
      <motion.section
        className="py-28 text-center"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <motion.h2 variants={fadeUp} className="text-4xl font-bold mb-6">
          Stop managing leads.
          <br />
          Start closing deals.
        </motion.h2>

        <motion.button
          variants={fadeUp}
          className="mt-6 h-14 px-12 rounded-3xl bg-emerald-500 text-black font-semibold hover:scale-105 transition"
        >
          👉 Try CRMSor Free
        </motion.button>
      </motion.section>
    </main>
  );
}
