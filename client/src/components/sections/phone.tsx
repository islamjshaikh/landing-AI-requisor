import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Camera,
  MessageCircle,
  Image,
  Mail,
  Music,
  Settings,
  Phone,
  Globe,
} from "lucide-react";
import logo from "@assets/Group_185_1764797140461.png";

export function Fig() {
  const [stage, setStage] = useState(0);
  const [searchText, setSearchText] = useState("");
  const fullSearchText = "Requisor.ai";

useEffect(() => {
  if (stage === 4) {
    const timer = setTimeout(() => {
      setStage(0);
      setSearchText("");
    }, 5000); // restart after 5 sec

    return () => clearTimeout(timer);
  }
}, [stage]);


  useEffect(() => {
    // Stage 0: Phone locked (1.5s)
    if (stage === 0) {
      const timer = setTimeout(() => setStage(1), 1000);
      return () => clearTimeout(timer);
    }

    // Stage 1: Phone unlocking (0.8s)
    if (stage === 1) {
      const timer = setTimeout(() => setStage(2), 700);
      return () => clearTimeout(timer);
    }

    // Stage 2: Typing animation with more realistic timing
    if (
      stage === 2 &&
      searchText.length < fullSearchText.length
    ) {
      // Variable typing speed for realism
      const delay =
        searchText.length === 0 ? 380 : Math.random() * 50 + 90;
      const timer = setTimeout(() => {
        setSearchText(
          fullSearchText.slice(0, searchText.length + 1),
        );
      }, delay);
      return () => clearTimeout(timer);
    }

    // Stage 3: After typing, wait before search
    if (
      stage === 2 &&
      searchText.length === fullSearchText.length
    ) {
      const timer = setTimeout(() => setStage(3), 520);
      return () => clearTimeout(timer);
    }

    // Stage 4: Show website
    if (stage === 3) {
      const timer = setTimeout(() => setStage(4), 360);
      return () => clearTimeout(timer);
    }
  }, [stage, searchText]);

  const apps = [
    {
      name: "Photos",
      icon: Image,
      color: "from-pink-400 to-orange-400",
    },
    {
      name: "Messages",
      icon: MessageCircle,
      color: "from-green-400 to-green-600",
    },
    {
      name: "Safari",
      icon: Globe,
      color: "from-blue-400 to-blue-600",
    },
    {
      name: "Camera",
      icon: Camera,
      color: "from-gray-600 to-gray-800",
    },
    {
      name: "Mail",
      icon: Mail,
      color: "from-blue-500 to-blue-700",
    },
    {
      name: "Music",
      icon: Music,
      color: "from-red-400 to-pink-500",
    },
    {
      name: "Settings",
      icon: Settings,
      color: "from-gray-500 to-gray-700",
    },
    {
      name: "Phone",
      icon: Phone,
      color: "from-green-500 to-green-600",
    },
  ];

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
      <div className="relative">
        {/* Mobile Phone */}
        <motion.div
          className="w-[320px] h-[640px] bg-black rounded-[50px] border-[8px] border-gray-900 shadow-2xl overflow-hidden relative"
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{
            duration: 0.48,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {/* Phone notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-b-3xl z-50 shadow-lg">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-800 rounded-full" />
          </div>
          <div className="pointer-events-none absolute inset-0 rounded-[36px]
                bg-gradient-to-tr from-white/5 via-transparent to-white/10" />

          {/* Screen Content */}
          <div
            className="w-full h-full bg-white relative 
                before:absolute before:inset-0 
                before:rounded-[36px] 
                before:shadow-inner 
                before:opacity-20"
          >
            <AnimatePresence mode="wait">
              {/* Stage 0-1: Lock Screen / Unlocking */}
              {stage <= 1 && (
                <motion.div
                  key="lockscreen"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 bg-black flex flex-col items-center justify-center"
                >
                  <motion.div
                    animate={{
  scale: stage === 1 ? [1, 1.03, 0.96] : 1,
  opacity: stage === 1 ? [1, 0.6, 0] : 1,
}}
transition={{ duration: 0.55, ease: "easeOut" }}

                    className="text-white text-center"
                  >
                    <div className="text-sm opacity-80">
                      Unlocking...
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* Stage 2-3: Home Screen with Google Search */}
              {stage >= 2 && stage < 4 && (
                <motion.div
                  key="homescreen"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  }}
                >
                  {/* Status Bar */}
                  <div className="h-12 flex items-center justify-between px-6 pt-8 text-white text-xs">
                    <span>9:41</span>
                    <div className="flex gap-1 items-center">
                      <div className="flex gap-0.5 items-end">
                        <div className="w-0.5 h-4 bg-white rounded" />
                        <div className="w-0.5 h-3.5 bg-white rounded" />
                        <div className="w-0.5 h-3 bg-white rounded" />
                        <div className="w-0.5 h-2 bg-white rounded" />
                      </div>
                      <span className="ml-1">87%</span>
                    </div>
                  </div>


                  {/* Time Display */}
                  <motion.div
                    className="text-white text-center mt-12 mb-8"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      duration: 0.6,
                      ease: "easeInOut",
                    }}
                  >
                    <div className="text-6xl font-light mb-1">
                      9:41
                    </div>
                    <div className="text-sm opacity-90">
                      Monday, January 5
                    </div>
                  </motion.div>

                  {/* Google Search Widget */}
                  <motion.div
                    className="px-6 mb-8"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <motion.div
                      className="relative bg-white/95 backdrop-blur-md rounded-full px-5 py-3.5 flex items-center gap-3"
                      animate={
                        stage === 3
                          ? { scale: [1, 0.98, 1] }
                          : {}
                      }
                      transition={{
  duration: 0.6,
  repeat: Infinity,
  ease: "easeInOut",
}}

                    >
                      <Search className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 relative">
                        <span className="text-gray-900 text-sm">
                          {searchText}
                        </span>

                        {stage === 2 &&
                          searchText.length <
                            fullSearchText.length && (
                            <motion.span
                              className="inline-block w-0.5 h-4 bg-blue-600 ml-0.5 -mb-0.5"
                              animate={{ opacity: [1, 0] }}
                              transition={{
                                duration: 0.5,
                                repeat: Infinity,
                              }}
                            />
                          )}

                        {!searchText && (
                          <span className="text-gray-400 text-sm absolute left-0">
                            Search
                          </span>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>

                  {/* App Icons Grid */}
                  <div className="px-8">
                    <div className="grid grid-cols-4 gap-y-8 gap-x-4">
                      {apps.map((app, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{
                            delay: 0.65 + i * 0.07,
                            stiffness: 260,
                            damping: 18,
                          }}
                          className="flex flex-col items-center gap-2"
                        >
                          <div
                            className={`w-10 h-10 bg-gradient-to-br ${app.color} rounded-2xl shadow-lg flex items-center justify-center`}
                          >
                            <app.icon className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-xs text-white font-medium drop-shadow">
                            {app.name}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Dock */}
                  <div className="absolute bottom-8 left-0 right-0 px-8">
                    <motion.div
                      className="bg-white/20 backdrop-blur-xl rounded-3xl p-4 flex justify-around items-center"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        delay: 0.9,
                        type: "spring",
                        stiffness: 260,
                        damping: 18,
                        mass: 0.6,
                      }}
                    >
                      {apps.slice(0, 4).map((app, i) => (
                        <div
                          key={i}
                          className={`w-10 h-10 bg-gradient-to-br ${app.color} rounded-2xl shadow-lg flex items-center justify-center`}
                        >
                          <app.icon className="w-5 h-5 text-white" />
                        </div>
                      ))}
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* Stage 4: Requisor.ai Website */}
              {stage === 4 && (
                <motion.div
                  key="website"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                 transition={{
  type: "spring",
  stiffness: 240,
  damping: 28,
  mass: 0.9,
}}

                  className="absolute inset-0 bg-white overflow-hidden flex flex-col"
                >
                  {/* Browser Chrome */}
                  <motion.div
                    className="h-[56px] bg-gradient-to-b from-[#f7f7f8] to-[#eeeeef]
                               border-b border-black/10
                               flex items-center px-4  pt-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 }}
                  >
                    {/* macOS window controls */}
                    <div className="flex gap-[4px]">
                      <span className="w-[9px] h-[9px] rounded-full bg-[#ff5f57] shadow-inner" />
                      <span className="w-[9px] h-[9px] rounded-full bg-[#febc2e] shadow-inner" />
                      <span className="w-[9px] h-[9px] rounded-full bg-[#28c840] shadow-inner" />
                    </div>

                    {/* Address bar */}
                    <div
                      className="flex-1 max-w-[220px] mx-auto
                                 bg-white/90
                                 rounded-xl
                                 px-3 py-[6px]
                                 text-[11px] text-gray-700
                                 border border-black/10
                                 shadow-[0_1px_2px_rgba(0,0,0,0.06)]
                                 flex items-center gap-2"
                    >
                      <span className="text-emerald-600 text-[11px]">🔒</span>
                      <span className="font-medium tracking-tight">requisor.ai</span>
                    </div>
                  </motion.div>

                  {/* Website Content */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-8 flex flex-col items-center">
                      {/* Logo/Brand */}
                      <motion.div
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{
                          delay: 0.5,
                          duration: 0.6,
                        }}
                        className="mb-12 text-center"
                      >
                        <h1 className="text-4xl font-bold text-emerald-500">
                          Requisor.ai
                        </h1>
                      </motion.div>

   
                      <motion.div
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{
                          delay: 0.7,
                          duration: 0.6,
                        }}
                        className="w-full max-w-md"
                      >
                        <div className="w-full h-64 flex items-center justify-center">
                       <motion.img
                              src={logo}
                              alt="Requisor Logo" whileHover={{ rotate: 5 }} transition={{ type: "spring", stiffness: 300, damping: 10 }}
                            />
                            
                          </div>
                        
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Tap Ripple Effect for Search */}
        <AnimatePresence>
          {stage === 3 && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0.8 }}
              animate={{ scale: 2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute w-20 h-20 rounded-full pointer-events-none
           bg-blue-400/30 blur-xl"
              style={{
                top: "210px",
                left: "50%",
                transform: "translateX(-50%)",
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Fig;