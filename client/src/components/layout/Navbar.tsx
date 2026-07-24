import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ModeToggle } from "@/components/ui/mode-toggle";
import baffle from "baffle";
import { useAuth } from "@/hooks/useAuth.tsx";
import { useLocation } from "wouter";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useInView } from "framer-motion";

import logo from "@assets/Group_185_1764797140461.png";

export function Navbar() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const handleSignupClick = () => {
    setLocation(isAuthenticated ? "/dashboard" : "/auth");
  };

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeLink, setActiveLink] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const scrollToSection = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    e.preventDefault();
    if (href.startsWith("#") && href.length > 1) {
      try {
        const element = document.querySelector(href);
        if (element) {
          element.scrollIntoView({
            behavior: shouldReduceMotion ? "auto" : "smooth",
            block: "start",
          });
          setActiveLink(href);
          setMobileMenuOpen(false);
        }
      } catch (e) {
        console.error("Invalid selector:", href);
      }
    }
  };

  const scrollToSectionMobile = (href: string) => {
    if (!href.startsWith("#")) return;

    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({
        behavior: shouldReduceMotion ? "auto" : "smooth",
        block: "start",
      });
    }

    setActiveLink(href);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);

      const totalHeight = document.body.scrollHeight - window.innerHeight;
      const progress =
        totalHeight > 0 ? (window.scrollY / totalHeight) * 100 : 0;
      setScrollProgress(progress);

      const sections = links.map((link) => {
        if (link.href === "#" || !link.href.startsWith("#")) return null;
        try {
          return document.querySelector(link.href);
        } catch (e) {
          return null;
        }
      });

      sections.forEach((section, index) => {
        if (section) {
          const rect = section.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            setActiveLink(links[index].href);
          }
        }
      });
    };

    window.addEventListener("scroll", handleScroll);

    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mobileMenuOpen && e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const links = [
    { name: "Features", href: "#features" },
    { name: "How it works", href: "#demo" },
    { name: "Pricing", href: "#pricing" },
    { name: "Testimonials", href: "#testimonials" },
  ];

  // const handleSignUp = () => {
  //   setIsLoading(true);

  //   setTimeout(() => {
  //     setIsLoading(false);
  //   }, 1500);
  // };

  const textRef = useRef(null);

  useEffect(() => {
    if (!textRef.current) return;

    const b = baffle(textRef.current, {
      characters: "░▒▓█  ▓▒░<>/\\ ⌁⌂⌇⌐⌠⌡ ▌▐▀▄ ◢◣◤◥ ⊳⊲⊰⊱ ⌘⌗⌬⌭",
      speed: 200,
    });

    b.start();
    b.reveal(4000);

    return () => { b.stop(); };
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 transition-all duration-500 ease-in-out 
                      bg-gradient-to-b from-background via-transparent to-transparent -z-10"
      />

      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-background/90 backdrop-blur-xl saturate-150 border-b border-border/20 shadow-lg shadow-black/5"
            : "bg-transparent"
        }`}
      >
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent/30 to-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: isScrolled ? 1 : 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-accent to-purple-500"
            style={{ width: `${scrollProgress}%` }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.1 }}
          />
        </motion.div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
              className={`flex-shrink-0 flex flex-col cursor-pointer ${
                !isScrolled ? "ml-2 sm:ml-4" : ""
              }`}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-2">
                <motion.img
                  src={logo}
                  alt="Requisor Logo"
                  className="h-10 w-auto"
                  whileHover={{ rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300, damping: 10 }}
                />

                <span
                  ref={textRef}
                  className="font-bold text-xl md:text-2xl lg:text-3xl tracking-wide text-foreground inline-block"
                >
                  Requisor AI
                </span>

                <motion.span
                  className="ml-2 px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 15,
                    delay: 0.2,
                  }}
                >
                  Private Beta
                </motion.span>
              </div>
              <motion.span
                className="text-[10px] text-muted-foreground font-medium tracking-wide pl-12 -mt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                The AI era workspace
              </motion.span>
            </motion.div>

            <AnimatePresence>
              {isScrolled && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.3 }}
                  className="hidden md:flex items-center space-x-8 text-muted-foreground flex-1 justify-center"
                >
                  {links.map((link) => (
                    <a
                      key={link.name}
                      href={link.href}
                      onClick={() => scrollToSectionMobile(link.href)}
                      className="relative text-sm font-medium transition-colors group hover:text-foreground "
                    >
                      <span className="relative ">
                        {link.name}
                        <span
                          className={`absolute -bottom-1 left-0 h-0.5 bg-accent transition-all duration-300 ${
                            activeLink === link.href
                              ? "w-full"
                              : "w-0 group-hover:w-full"
                          }`}
                        />
                      </span>
                    </a>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              className={`hidden md:flex items-center gap-4 ${
                !isScrolled ? "mr-2 sm:mr-4" : ""
              }`}
            >
              <AnimatePresence>
                {isScrolled && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ModeToggle />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isScrolled && (
                  <motion.a
                    href="/auth"
                    className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Log in
                  </motion.a>
                )}
              </AnimatePresence>

              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Button
                  onClick={handleSignupClick}
                  className="rounded-full px-6 py-3 font-semibold 
                            bg-emerald-500 text-white
                            border border-emerald-300 border-b-4
                            overflow-hidden relative
                            hover:brightness-105 hover:border-t-4 hover:border-b
                            active:opacity-75 outline-none duration-300 group
                            disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  <span className="bg-emerald-300 shadow-emerald-300 absolute -top-[150%] left-0 inline-flex w-32 h-[3px] rounded-md opacity-50 group-hover:top-[150%] duration-500 shadow-[0_0_5px_5px_rgba(0,0,0,0.1)]"></span>

                  <span className="relative flex items-center gap-2">
                    {isLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                        Loading...
                      </>
                    ) : (
                      "Sign Up Free"
                    )}
                  </span>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </div>

        <motion.div className="md:hidden" whileTap={{ scale: 0.95 }}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-foreground p-2 rounded-lg hover:bg-accent/5 transition-colors"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </motion.div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.3,
                ease: "easeInOut",
              }}
              className="md:hidden bg-background/95 backdrop-blur-lg border-b border-border relative z-50"
            >
              <div className="px-4 pt-2 pb-8 space-y-1">
                {links.map((link, index) => (
                  <motion.a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => scrollToSection(e, link.href)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: shouldReduceMotion ? 0 : index * 0.1,
                      duration: shouldReduceMotion ? 0 : 0.2,
                    }}
                    className={`block text-lg font-medium py-3 px-4 rounded-lg transition-colors ${
                      activeLink === link.href
                        ? "bg-accent/10 text-accent"
                        : "text-foreground hover:bg-accent/5"
                    }`}
                  >
                    {link.name}
                  </motion.a>
                ))}

                <div className="pt-4 flex flex-col gap-3">
                  <motion.button
                    type="button"
                    onClick={handleSignupClick}
                    className="text-center font-medium py-3 rounded-lg hover:bg-accent/5 transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      delay: shouldReduceMotion ? 0 : links.length * 0.1,
                    }}
                  >
                    Log in
                  </motion.button>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: shouldReduceMotion ? 0 : links.length * 0.1 + 0.1,
                    }}
                    className="flex justify-center"
                  >
                    <Button
                      onClick={handleSignupClick}
                      className="rounded-full px-6 py-3 font-semibold 
                                bg-emerald-500 text-white
                                border border-emerald-300 border-b-4
                                overflow-hidden relative
                                hover:brightness-105 hover:border-t-4 hover:border-b
                                active:opacity-75 outline-none duration-300 group
                                disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isLoading}
                    >
                      <span className="bg-emerald-300 shadow-emerald-300 absolute -top-[150%] left-0 inline-flex w-32 h-[3px] rounded-md opacity-50 group-hover:top-[150%] duration-500 shadow-[0_0_5px_5px_rgba(0,0,0,0.1)]"></span>

                      <span className="relative flex items-center gap-2">
                        {isLoading ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                            Loading...
                          </>
                        ) : (
                          "Sign Up Free"
                        )}
                      </span>
                    </Button>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      delay: shouldReduceMotion ? 0 : links.length * 0.1 + 0.2,
                    }}
                    className="flex justify-center pt-2"
                  >
                    <ModeToggle />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}
