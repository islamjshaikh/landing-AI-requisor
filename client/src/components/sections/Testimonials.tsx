import { Star, Play } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import davidVideo from "/video/David_Video.mp4";
import { useState } from "react";

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.25,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 40,
    scale: 0.96,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 90,
      damping: 26,
      duration: 0.12,
    },
  },
};

const innerFadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.9,
      delay: 0.2,
      ease: "easeOut",
    },
  },
};

const testimonials = [
  {
    quote:
      " Requisor has been such a lifesaver for consulting projects! Specifically, Requisor has been so helpful in requirements gathering to have it all in one place. When working in other projects it can be so time consuming and hard to keep track of all the information across different platforms. It's been so much easier now with Requisor!",
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
      "Honestly, Requisor feels like the teammate I never had. I used to spend late nights trying to piece together project plans, but now I just write my messy ideas and it gives me clarity in minutes. It’s taken a huge weight off my shoulders and let me fall back in love with the creative side of my business.",
    author: "Emily kapszukiewicz ",
    role: "Startup Founder",
    image: "/test/emeli.png",
    hasVideo: false,
  },
];

export function Testimonials() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, {
    once: true,
    margin: "-100px",
  });
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  return (
    <section
      ref={sectionRef}
      className="py-8 md:py-20 bg-background relative"
      id="testimonials"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-16 md:mb-24"
        >
          <h2
            className="text-3xl md:text-5xl font-bold mb-6 tracking-normal"
            style={{ wordSpacing: "0.6rem" }}
          >
            Designed for Builders
          </h2>
          <p
            className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed tracking-normal"
            style={{ wordSpacing: "0.3rem" }}
          >
            See how solopreneurs and small teams use Requisor to work smarter.
          </p>
        </motion.div>

        {/* Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid md:grid-cols-3 md:gap-10 gap-4"
        >
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              variants={cardVariants}
              whileHover={{ y: -8 }}
              className="
                group relative
                rounded-3xl 
                bg-white/30 dark:bg-white/5
                dark:backdrop-blur-2xl
                border dark:border-white/40 dark:border-white/10
                shadow-[0_25px_80px_rgba(0,0,0,0.25)]
                dark:shadow-[0_25px_80px_rgba(0,0,0,0.6)]
                pb-6
              "
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-60 dark:opacity-30 pointer-events-none" />

              <motion.div
                variants={innerFadeUp}
                className="flex gap-1 md:px-6 px-3 pt-6 text-emerald-500"
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-3 h-3 fill-current" />
                ))}
              </motion.div>

              {/* Author */}
              <motion.div
                variants={innerFadeUp}
                className="px-4 md:px-6 md:pt-3 pt-1"
              >
                <div className="w-10 h-10 md:w-16 md:h-16 rounded-full overflow-hidden border border-2 border-emerald-600  shadow-lg">
                  <img
                    src={t.image}
                    alt={t.author}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div
                  className="font-semibold text-foreground md:text-xl text-base tracking-wide"
                  style={{ wordSpacing: "0.3rem" }}
                >
                  {t.author}
                </div>
                <div
                  className="text-sm text-muted-foreground tracking-wide"
                  style={{ wordSpacing: "0.3rem" }}
                >
                  {t.role}
                </div>
              </motion.div>

              <motion.div
                variants={innerFadeUp}
                className="px-6 mt-4 text-center"
              >
                {!t.hasVideo && (
                  <p
                    className="
                      md:text-base text-sm
                      leading-relaxed
                      text-foreground/90
                      dark:text-foreground/80
                    "
                  >
                    “{t.quote}”
                  </p>
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
                          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                            <Play className="w-6 h-6 text-primary-foreground fill-current ml-1" />
                          </div>
                        </div>

                        <div className="absolute bottom-3 left-3 right-3">
                          <span className="text-white text-xs md:text-sm font-medium bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
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
              </motion.div>

              {/* hover glow */}
              <div
                className="
                  pointer-events-none absolute inset-0
                  bg-gradient-to-br from-emerald-400/20 via-transparent to-transparent
                  opacity-0 group-hover:opacity-100
                  transition-opacity duration-700
                "
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
