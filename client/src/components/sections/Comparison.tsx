import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

export function Comparison() {
  return (
    <section className=" overflow-hidden bg-background/50 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] opacity-50 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16 md:mb-24">
          <h2 className="text-3xl md:text-5xl font-semibold text-foreground mb-6 tracking-tight">
            Stop using tech from the{" "}
            <span className="text-muted-foreground line-through decoration-destructive/50 decoration-2 decoration-black ">
              pre-AI era
            </span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Manual project management is killing your productivity. Requisor
            handles the busywork so you can focus on building.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-9 lg:gap-17 max-w-4xl mx-auto">
          <div className="dark:bg-background/50 backdrop-blur-sm p-8 md:p-10 rounded-[2rem] border dark:border-white border-gray-200 shadow-sm opacity-80 hover:opacity-100 transition-opacity duration-500 bg-gray-200/50">
            <h3 className="text-lg font-semibold text-muted-foreground mb-10 flex items-center gap-3">
              <span className="p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-500">
                <X className="w-5 h-5" />
              </span>
              Your existing tools
            </h3>
            <ul className="space-y-6">
              {[
                {
                  title: "Manual Task Entry",
                  desc: "Endless typing and organizing lists",
                },
                {
                  title: "Missed Deadlines",
                  desc: "No warnings until it's too late",
                },
                {
                  title: "Messy Docs",
                  desc: "Ideas scattered across 5 different apps",
                },
                {
                  title: "Constant Rescheduling",
                  desc: "Spending hours moving calendar blocks",
                },
                {
                  title: "Manual Execution",
                  desc: "Doing every subtask yourself from scratch",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-3">
                  <div className="mt-1 min-w-[24px]">
                    <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center text-muted-foreground/50">
                      <X className="w-3 h-3" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-muted-foreground text-base md:text-lg">
                      {item.title}
                    </h4>
                    <p className="text-sm text-muted-foreground/70 leading-relaxed mt-1">
                      {item.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="
              relative p-8 md:p-10 w-full max-w-4xs
              dark:bg-gradient-to-br
            dark:from-purple-600/20
            dark:via-gray-900
            dark:to-pink-600/20
              rounded-[2rem]
              border dark:border-white
              overflow-hidden
              group 
              bg-gray-400/50
              backdrop-blur-xl hover:rounded-[5rem] transition-all duration-800
            "
          >
            
            <div className="mb-6 relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold dark:text-white text-emerald-500">Requisor AI</h3>
              </div>
              <p className="text-sm dark:text-gray-400 text-gray-500 leading-relaxed">
                Perfect for your next project, leave to us and enjoy the result!
              </p>
            </div>

            
            <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent mb-4"></div>

            {/* Features list */}
            <ul className="space-y-2 mb-5">
              {[
                {
                  title: "AI Project Generation",
                  desc: "One prompt creates tasks, timelines, and subtasks",
                },
                {
                  title: "Smart Prioritization",
                  desc: "Knows exactly what you should work on next",
                },
                {
                  title: "Centralized Intelligence",
                  desc: "Docs, tasks, and plans in one unified view",
                },
                {
                  title: "Auto-Rescheduling",
                  desc: "Automatically adjusts plans when life happens",
                },
                {
                  title: "AI Agent Execution",
                  desc: "Assign specialized agents to do the heavy lifting",
                },
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 mt-1 w-5 h-5 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-lg">
                    <Check className="w-3 h-3 text-white stroke-[3px]" />
                  </span>
                  <div>
                    <span className="text-base font-semibold dark:text-white text-emerald-500">
                      {item.title}
                    </span>
                    <p className="text-sm text-dark:gray-400 text-gray-500 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Button */}
            <a href="#pricing">
              {" "}
              <button className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold rounded-full shadow-lg hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-300">
                Sign up Now
              </button>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
