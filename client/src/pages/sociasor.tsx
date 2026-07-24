import { motion } from "framer-motion";
import { useState, useRef } from "react";

const fadeUp = {
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

const stagger = {
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
            <source src="/dinovideo/dino3.mp4" type="video/mp4" />
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
            📣 SociaSor
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-xl md:text-2xl text-muted-foreground mb-4"
          >
            The AI Social Media Agent That Knows What People Want to See

          </motion.p>

          <motion.p
            variants={fadeUp}
            className="text-lg max-w-3xl mx-auto mb-4 text-emerald-400"
          >
            Create content people actually want  not what you think might work.
          </motion.p>

          <motion.p variants={fadeUp}
            className="text-lg max-w-3xl mx-auto mb-5 text-emerald-400 "> SociaSor is your AI social media strategist, creator, and scheduler  all in one.


          </motion.p>
          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row justify-center gap-4"
          >
            <button className="h-14 px-8 rounded-3xl bg-emerald-500 text-black font-semibold hover:scale-105 transition">
               High Performing Content
            </button>
            <button className="h-14 px-8 rounded-3xl border border-emerald-400 hover:bg-emerald-400/10 transition">
              Try SociaSor Free
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
          Posting consistently is hard.
           Posting content that performs is harder.

        </motion.h2>

        <motion.ul className="space-y-4 text-lg text-muted-foreground">
          {[
      "Trends change daily",
     " Algorithms are unpredictable",
     " Content ideas dry up fast",
        "Scheduling across platforms is a mess",
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
            The Outcomes You Actually Want
          </motion.h2>

          <motion.ul className="grid md:grid-cols-2 gap-6 text-lg">
            {[
              "Content that aligns with real trends",
         " Posts people engage with",
         " Less guessing, more momentum",
         "A system — not a content scramble",
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
          How SociaSor Helps
        </motion.h2>

        <motion.ul className="space-y-4 text-lg text-muted-foreground mb-12">
          {[
            "Detects trending patterns and formats", "Generates posts optimized for each platform", "Adapts tone to your brand voice",
"Auto-schedules across channels", "Integrates with your existing tools",
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
            What Makes SociaSor Different
          </motion.h2>

          <motion.ul className="grid md:grid-cols-2 gap-6 text-lg">
            {[
              "📈 Trend-aware, not template-based", " 🎯 Built for reach, saves, and engagement", "🤖 AI that understands why content works", "🔁 Learn from what performs and iterate",

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
            This isn’t a posting tool.
             It’s a growth engine.

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
        "Founders building a personal brand",


        "Startups growing visibility",


        "Agencies managing multiple accounts",


       " Creators tired of burnout posting",

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
          Stop posting blindly.<br/> Start posting strategically.
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
