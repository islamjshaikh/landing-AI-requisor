import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth.tsx";
import { useLocation } from "wouter";
import CanvasCursor from "@/pages/cursor_d";
import {
  ArrowRight,
  User,
  Users,
  Building2,
  Zap,
  Sparkles,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Slider from "./slider";
import Cards from "./cards";
import Dino from "./Dino";
import { AIAgentsSection } from "./AIAgentsSection";
import Type from "./type";
import { AgentSquad } from "./AgentSquad";

export function Hero() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  const handleSignupClick = () => {
    // ⛔ do nothing until auth state is known
    if (isLoading) return;

    if (isAuthenticated) {
      setLocation("/dashboard");
    } else {
      setLocation("/auth");
    }
  };

  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const features = [
    "AI Projects",
    "AI Tasks",
    "AI Social Media Agent",
    "AI Docs",
    "AI Reports",
    "Workflows",
    "Seamless Integrations",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeatureIndex((prev) => (prev + 1) % features.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none " />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-accent/10 rounded-full blur-[120px] -z-10 opacity-60 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 text-center z-10 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.16 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent dark:text-accent-foreground text-xs sm:text-sm md:text-sm font-medium mb-4 backdrop-blur-sm"
        >
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, -10, 10, 0],
              filter: ["brightness(1)", "brightness(1.9)", "brightness(1)"],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 2,
            }}
          >
            <Zap className="w-4 h-4 fill-current" />
          </motion.div>
          <span>Ideas to execution in seconds</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.16 }}
          className="text-3xl sm:text-3xl md:text-6xl font-bold tracking-tight text-foreground mb-8 max-w-5xl mx-auto leading-[1.1] sm:leading-[1.25] group relative text-center  "
        >
          {" "}
          {/*dark:drop-shadow-[30px_-60px_50px_rgba(97,255,200,1)]*/}
          <span className="relative z-10 inline-block bg-gradient-to-r from-emerald-300 via-emerald-500 to-emerald-700 bg-[length:300%] bg-clip-text text-transparent animate-gradient">
            Unlock your AI cheat-code for
          </span>
          <style>{`
            @keyframes gradient {
              0% {
                background-position: 0% 50%;
              }
              50% {
                background-position: 100% 50%;
              }
              100% {
                background-position: 0% 50%;
              }
            }

            .animate-gradient {
              animation: gradient 5s ease infinite;
              background-size: 300% !important;
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
          `}</style>
          {/* < span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 -skew-x-12 animate-shine pointer-events-none"></span>
           */}
          {/* <style>{`

  @keyframes shine {
    0% {
      transform: translateX(-100%) skewX(-12deg);
    }
    100% {
      transform: translateX(200%) skewX(-12deg);
    }
  }

  .animate-shine {
    animation: shine 1.5s ease-in-out infinite;
    -webkit-ma: linear-grsk-imageadient(
      75deg,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 1) 30%,
      rgba(0, 0, 0, 1) 70%,
      rgba(0, 0, 0, 0) 100%
    );
    mask-image: linear-gradient(
      75deg,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 1) 30%,
      rgba(0, 0, 0, 1) 70%,
      rgba(0, 0, 0, 0) 100%
    );
  }

`}</style> */}
        </motion.h2>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.16 }}
          className="relative text-2xl sm:text-2xl md:text-5xl
          font-bold tracking-tight text-foreground
          mb-5 max-w-5xl mx-auto leading-[1.1] text-foreground max-w-5xl mx-auto leading-[1.1] sm:leading-[1.1] dark:drop-shadow-[-40px_0_60px_rgba(97,255,200,1)] "
        >
          <span className="text-accent absolute -top-5 relative inline-block dark:text-white/90 tracking-normal">
            {/*dark:drop-shadow-[50px_50px_60px_rgba(97,255,200,1)] */}
            10× productivity
            <svg
              className="absolute w-full h-1 -bottom-0 left-0 text-accent/20 dark:text-white/80"
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
            >
              <path
                d="M0 5 Q 50 10 100 5"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
            </svg>
          </span>
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.16 }}
          className="text-lg sm:text-xl text-muted-foreground max-w-4xl mx-auto mb-10 px-4"
        >
          <span className="block mb-3 font-medium text-foreground">
            We know… it’s almost unfair.
          </span>

          <div className="inline-block text-center">
            <span>
              The{" "}
              <span className="font-extrabold text-foreground">
                #1 Productivity Platform
              </span>{" "}
              of the AI Era — with
            </span>
            <div className="relative inline-flex justify-center sm:justify-start h-[30px] w-[220px] align-bottom  ml-2">
              <AnimatePresence mode="wait">
                <motion.span
                  key={features[currentFeatureIndex]}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute left-0 bottom-0 font-semibold text-accent whitespace-nowrap text-left"
                >
                  {features[currentFeatureIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.16 }} className=" flex items-center justify-center">

            <Type />

        </motion.div>
 */}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.16 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            type="button"
            disabled={isLoading}
            onClick={handleSignupClick}
            className="relative group border-none bg-transparent outline-none cursor-pointer font-medium  text-base animate-float"
          >
            <span className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-25 rounded-full transform -group-active:translate-y-px transition duration-[600ms] ease-[cubic-bezier(0.3,0.7,0.4,1)] group-hover:translate-y-1 group-hover:duration-[250ms] group-active:translate-y-px"></span>

            <span className="absolute top-0 left-0 w-full h-full rounded-full bg-gradient-to-l from-emerald-800 via-emerald-700 to-emerald-800"></span>

            <div className="relative flex items-center justify-between py-2 px-3 md:text-lg text-base text-white rounded-full transform -translate-y-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 gap-3 transition duration-[600ms] ease-[cubic-bezier(0.3,0.7,0.4,1)] group-hover:-translate-y-1.5 group-hover:duration-[250ms] group-active:-translate-y-0.5 brightness-100 group-hover:brightness-110">
              <span className="hover:text-lg ">Sign up for free</span>{" "}
            </div>
          </button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="
              h-13 px-6  sm:w-auto
              rounded-3xl
              border-2 border-emerald-400
              text-base text-emerald-400
              transition-all duration-300
              hover:border-2 hover:text-emerald-500
              hover:rounded-5xl
              group animate-float
              hover:shadow-lg hover:shadow-emerald-500/20 hover:shadow-inner
              tracking-widest [word-spacing:0.09em]
            "
          >
            <a href="#demo">Learn more</a>
          </Button>
        </motion.div>

        {/* < Dino/> */}
        <AgentSquad />
        <AIAgentsSection />

        <section id="demo">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mt-10 relative max-w-6xl mx-auto rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-background via-background/80 to-background/70 backdrop-blur-xl ring-1 ring-white/20 group mb-20"
          >
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-2xl animate-pulse"></div>
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-gradient-to-tr from-purple-500/15 to-pink-500/15 rounded-full blur-2xl"></div>

            <div className="px-8 pt-8 pb-6 text-center relative z-10">
              <div className="inline-flex items-center gap-3 mb-3">
                <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
                <span className="text-sm font-medium text-emerald-400 tracking-wider uppercase">
                  Product Demo
                </span>
                <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
              </div>

              <h1
                className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground via-foreground to-emerald-400 bg-clip-text text-transparent tracking-wide"
                style={{ wordSpacing: "0.3rem" }}
              >
                See Requisor in Action
                <span
                  className="block text-lg md:text-xl font-normal text-muted-foreground mt-3 tracking-wide"
                  style={{ wordSpacing: "0.3rem" }}
                >
                  Watch how AI transforms ideas into execution
                </span>
              </h1>
            </div>

            {/* THEATER VIDEO SECTION */}

            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/20 via-black to-purple-900/20 pointer-events-none z-0"></div>

              <div
                className="absolute inset-0 z-20 w-full h-full pointer-events-none"
                style={{
                  backgroundImage:
                    "url('https://mattcannon.games/codepen/followers/200/theater.png')",
                  backgroundPosition: "center",
                  backgroundSize: "100% 100%",
                  backgroundRepeat: "no-repeat",
                }}
              ></div>

              <div
                className="absolute z-10 overflow-hidden"
                style={{
                  top: "4%",
                  left: "11%",
                  width: "78%",
                  height: "84%",
                  borderRadius: "4px",

                  maskImage:
                    "radial-gradient(100% 100% at 50% 50%, #000 85%, transparent 100%)",
                  WebkitMaskImage:
                    "radial-gradient(100% 100% at 50% 50%, #000 85%, transparent 100%)",
                }}
              >
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted={isMuted}
                  loop
                  playsInline
                  controls={false}
                >
                  <source src="/demo-video.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              <button
                onClick={toggleMute}
                className="absolute top-6 right-6 z-30 flex items-center gap-2 px-4 py-2 
                           bg-black/40 hover:bg-emerald-500/80 backdrop-blur-md 
                           border border-white/10 rounded-full transition-all duration-300 group/btn"
              >
                {isMuted ? (
                  <>
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                      />
                    </svg>
                    <span className="text-sm font-medium text-white/90">
                      Unmute
                    </span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5 text-emerald-100"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                    <span className="text-sm font-medium text-white/90">
                      Mute
                    </span>
                  </>
                )}
              </button>
            </div>

            <div className="px-8 pb-8 pt-6 bg-gradient-to-t from-background/80 to-transparent relative z-30">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center group/stat">
                  <div className="md:text-3xl text-2xl font-bold text-emerald-400 md:mb-1 group-hover/stat:scale-110 transition-transform duration-300 hover:drop-shadow-[0_0_2px_rgba(52,211,153,0.9)]">
                    10x
                  </div>
                  <div className="md:text-lg text-base text-muted-foreground">
                    Faster Planning
                  </div>
                </div>
                <div className="text-center group/stat">
                  <div className="md:text-3xl text-2xl font-bold text-emerald-400 md:mb-1 group-hover/stat:scale-110 transition-transform duration-300 hover:drop-shadow-[0_0_2px_rgba(52,211,153,0.9)]">
                    24/7
                  </div>
                  <div className="md:text-lg text-base text-muted-foreground">
                    AI Agents
                  </div>
                </div>
                <div className="text-center group/stat">
                  <div className="md:text-3xl text-2xl font-bold text-emerald-400 md:mb-1 group-hover/stat:scale-110 transition-transform duration-300 hover:drop-shadow-[0_0_2px_rgba(52,211,153,0.9)]">
                    Minimal
                  </div>
                  <div className="md:text-lg text-base text-muted-foreground">
                    Manual Work
                  </div>
                </div>
                <div className="text-center group/stat">
                  <div className="md:text-3xl text-2xl font-bold text-emerald-400 md:mb-1 group-hover/stat:scale-110 transition-transform duration-300 hover:drop-shadow-[0_0_2px_rgba(52,211,153,1)]">
                    100%
                  </div>
                  <div className="md:text-lg text-base text-muted-foreground">
                    Automated
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute top-0 left-0 w-16 h-16 overflow-hidden pointer-events-none">
              <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-emerald-400/50 rounded-tl-xl"></div>
            </div>
            <div className="absolute bottom-0 right-0 w-16 h-16 overflow-hidden pointer-events-none">
              <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-emerald-400/50 rounded-br-xl"></div>
            </div>
          </motion.div>
        </section>

        <div className=" bg-secondary/30 rounded-[2.5rem]  md:p-14 max-w-7xl mx-auto border border-border/50 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent/20 to-transparent opacity-50" />
          <div className="text-center mb-10">
            <h3 className="text-3xl md:text-5xl font-semibold text-foreground mb-5 tracking-tight">
              Built for <span className="text-accent">every builder</span>
            </h3>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Whether you're a solo visionary or leading a global team, Requisor
              scales with your ambition from day one to IPO.
            </p>
          </div>

          <Cards />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, delay: 0.16 }}
            className="flex items-center justify-center mt-10"
          >
            <button className="relative group border-none bg-transparent outline-none cursor-pointer font-medium text-base animate-float">
              <span className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-25 rounded-full transform -group-active:translate-y-px transition duration-[600ms] ease-[cubic-bezier(0.3,0.7,0.4,1)] group-hover:translate-y-1 group-hover:duration-[250ms] group-active:translate-y-px"></span>

              <span className="absolute top-0 left-0 w-full h-full rounded-full bg-gradient-to-l from-emerald-800 via-emerald-700 to-emerald-800"></span>

              <div className="relative flex items-center justify-between py-3 px-5 md:text-lg text-base text-white rounded-full transform -translate-y-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 gap-3 transition duration-[600ms] ease-[cubic-bezier(0.3,0.7,0.4,1)] group-hover:-translate-y-1.5 group-hover:duration-[250ms] group-active:-translate-y-0.5 brightness-100 group-hover:brightness-110">
                <a href="/auth">
                  <span className="hover:text-lg ">Sign up for free</span>{" "}
                </a>
              </div>
            </button>
          </motion.div>
        </div>
      </div>
      <CanvasCursor />
    </section>
  );
}
