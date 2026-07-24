import { motion } from "framer-motion";

const tools = [
  {
    category: "To-do lists",
    apps: [
      {
        name: "Todoist",
        color: "bg-white/10",
        label: "TD",
        type: "image",
        logo: "/app/todo1.png",
      },
      {
        name: "Things",
        label: "Th",
        type: "image",
        color: "bg-white/10",
        logo: "/app/todo2.png",
      },
      {
        name: "TickTick",
        label: "TT",
        type: "image",
        color: "bg-white/10",
        logo: "/app/todo3.png",
      },
      {
        name: "Any.do",
        label: "AD",
        type: "image",
        color: "bg-white/10",
        logo: "/app/todo4.png",
      },
    ],
  },
  {
    category: "Project Management",
    apps: [
      {
        name: "Asana",
        label: "As",
        type: "image",
        color: "bg-white/10",
        logo: "/app/pm.jpg",
      },
      {
        name: "Monday",
        label: "Mo",
        type: "image",
        color: "bg-white/10",
        logo: "/app/pm2.jpg",
      },
      {
        name: "Jira",
        label: "Ji",
        type: "image",
        color: "bg-white/10",
        logo: "/app/pm3.jpg",
      },
      {
        name: "Linear",
        label: "Li",
        type: "image",
        color: "bg-white/10",
        logo: "/app/pm4.jpg",
      },
    ],
  },
  {
    category: "Social Media Schedulers",
    apps: [
      {
        name: "Buffer",
        label: "Bu",
        type: "image",
        color: "bg-white/10",
        logo: "/app/sm.png",
      },
      {
        name: "Hootsuite",
        label: "Hs",
        type: "image",
        color: "bg-white/10",
        logo: "/app/sm2.png",
      },
      {
        name: "Later",
        label: "La",
        type: "image",
        color: "bg-white/10",
        logo: "/app/sm3.png",
      },
      {
        name: "Sprout",
        label: "Sp",
        type: "image",
        color: "bg-white/10",
        logo: "/app/sm4.png",
      },
    ],
  },
  {
    category: "CRMs",
    apps: [
      {
        name: "Salesforce",
        label: "SF",
        type: "image",
        color: "bg-white/10",
        logo: "/app/crm1.png",
      },
      {
        name: "HubSpot",
        label: "HS",
        type: "image",
        color: "bg-white/10",
        logo: "/app/crm2.png",
      },
      {
        name: "Pipedrive",
        label: "PD",
        type: "image",
        color: "bg-white/10",
        logo: "/app/crm3.png",
      },
      {
        name: "Apollo",
        label: "Ap",
        type: "image",
        color: "bg-white/10",
        logo: "/app/crm4.png",
      },
    ],
  },
  {
    category: "Docs & Wikis",
    apps: [
      {
        name: "Notion",
        label: "N",
        type: "image",
        color: "bg-white/10",
        logo: "/app/doc.png",
      },
      {
        name: "Evernote",
        label: "Ev",
        type: "image",
        color: "bg-white/10",
        logo: "/app/doc2.png",
      },
      {
        name: "Confluence",
        label: "Co",
        type: "image",
        color: "bg-white/10",
        logo: "/app/doc3.png",
      },
      {
        name: "Obsidian",
        label: "Ob",
        type: "image",
        color: "bg-white/10",
        logo: "/app/doc4.png",
      },
    ],
  },
];

export function ToolsReplacement() {
  return (
    <section className="py-15 md:py-22 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-secondary/30 to-transparent opacity-70 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-20 max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-semibold mb-8 leading-tight tracking-tight">
            Requisor includes all of the tools you use to be productive and
            organized — <span className="text-accent">in one place</span>
          </h2>
          <p className="text-base md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            And it modernizes and supercharges those tools with the power of
            automation and AI
          </p>

          <div className="mt-12 flex items-center justify-center gap-4">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white font-semibold text-lg shadow-lg shadow-accent/30">
              R
            </div>
            <span className="font-semibold text-xl md:text-2xl">
              Requisor replaces...
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {tools.map((category, i) => (
            <motion.div
              key={category.category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="bg-card/50 backdrop-blur-sm md:p-8 p-2 rounded-[2rem] border border-border/50 shadow-lg relative overflow-hidden group hover:shadow-2xl hover:border-accent/30 transition-all duration-300"
            >
              <h3 className="text-center font-bold text-muted-foreground md:mb-10 mb-5 text-lg tracking-wide">
                {category.category}
              </h3>

              <div className="grid grid-cols-2 md:gap-6  max-w-[220px] mx-auto relative pb-4">
                <svg
                  className="absolute inset-0 w-full h-full z-20 pointer-events-none overflow-visible"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <motion.line
                    x1="-10%"
                    y1="100%"
                    x2="110%"
                    y2="-10%"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-slate-700/80 dark:text-slate-400/80 drop-shadow-md"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      delay: i * 0.1 + 0.3,
                      duration: 0.4,
                      ease: "easeOut",
                    }}
                  />
                  <motion.line
                    x1="-10%"
                    y1="-10%"
                    x2="110%"
                    y2="100%"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-slate-700/80 dark:text-slate-400/80 drop-shadow-md"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      delay: i * 0.1 + 0.5,
                      duration: 0.4,
                      ease: "easeOut",
                    }}
                  />
                </svg>

                {category.apps.map((app) => (
                  <div
                    key={app.name}
                    className="flex flex-col items-center gap-2 group-hover:opacity-80 transition-opacity duration-300"
                  >
                    <div
                      className={`w-20 h-20 rounded-2xl shadow-sm flex items-center justify-center text-white font-semibold text-2xl ${app.color} opacity-100 grayscale-[0.3] group-hover:grayscale-0 transition-all relative overflow-hidden`}
                    >
                      {app.type === "logo" ? (
                        app.logo ? (
                          <app.logo />
                        ) : (
                          <span>{app.label}</span>
                        )
                      ) : app.type === "image" && app.logo ? (
                        <img
                          src={app.logo}
                          className="w-12 h-12 object-contain "
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.parentElement.classList.remove(
                              "bg-opacity-80",
                            );
                          }}
                        />
                      ) : (
                        <span>{app.label}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, delay: 0.16 }}
            className="flex items-center justify-center md:mt-15 "
          >
            <button className="relative group border-none bg-transparent outline-none cursor-pointer  text-base animate-float">
              <span className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-25 rounded-4xl transform translate-y-0.8 transition duration-[600ms] ease-[cubic-bezier(0.3,0.7,0.4,1)] group-hover:translate-y-1 group-hover:duration-[250ms] group-active:translate-y-px"></span>

              <span className="absolute top-0 left-0 w-full h-full rounded-4xl bg-gradient-to-l from-emerald-800 via-emerald-700 to-emerald-800"></span>

              <div className="relative flex items-center justify-between py-3 px-5 md:text-lg text-base text-white rounded-4xl transform -translate-y-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 gap-3 transition duration-[600ms] ease-[cubic-bezier(0.3,0.7,0.4,1)] group-hover:-translate-y-1.5 group-hover:duration-[250ms] group-active:-translate-y-0.5 brightness-100 group-hover:brightness-110">
                <a href="#pricing">
                  <span className="hover:text-lg ">
                    Start for free now
                  </span>{" "}
                </a>
              </div>
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
