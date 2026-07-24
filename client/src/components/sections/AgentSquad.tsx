import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Plus } from "lucide-react";
import { useLocation } from "wouter";

const agents = [
  {
    name: "Requisor",
    role: "Project Management AI",
    status: "Active",
    description: "Turns brain dumps into actionable project roadmaps.",
    tags: ["Project Planning", "Roadmap Generation", "Task Breakdown"],
    image: "/dino2/dino1.jpeg",
    //route: "/requisor",
    // textColor: "#7cffc7",
  },
  {
    name: "Sociasor",
    role: "Social Media Management AI",
    status: "Active",
    description: "Plans, schedules and tracks social media performance.",
    tags: ["Content Scheduling", "Post Automation", "Multi-Platform"],
    image: "/dino2/dino2.png",
    // route: "/sociasor",
    // textColor: "viole"
  },
  {
    name: "Ideasor",
    role: "Ideation Agent AI",
    status: "Coming Soon",
    description: "Turns rough ideas into clear, actionable concepts.",
    tags: ["Idea Structuring", "Concept Refinement", "Creative Exploration"],
    image: "/dino2/dino3.jpeg",
    // route: "/ideasor",
  },
  {
    name: "Datasor",
    role: "Data Insight AI",
    status: "Coming Soon",
    description: "Transforms raw data into business intelligence.",
    tags: ["Data Analysis", "Trend Monitoring", "Insight Generation"],
    image: "/dino2/dino4.jpeg",
    // route: "/datasor",
  },
  {
    name: "CRMsor",
    role: "CRM AI",
    status: "Coming Soon",
    description: "Manages customer relationships and pipelines.",
    tags: ["Contact Management", "Sales Enablement", "Customer Insights"],
    image: "/dino2/dino5.jpeg",
    // route: "/crm",
  },
];

export function AgentSquad() {
  const ref = useRef(null);
  const [, setLocation] = useLocation();
  const inView = useInView(ref, { margin: "-30% 0px -30% 0px" });

  return (
    <section ref={ref} className="py-16">
      <h2 className="text-center text-2xl md:text-4xl font-bold mb-14">
        Meet Your AI Teammates
      </h2>

      <div className="flex flex-wrap justify-center gap-6 relative">
        {agents.map((agent, index) => (
          <motion.div
            /* key={agent.name}
            onClick={() => setLocation(agent.route)} */
            className="relative w-[240px] h-[320px] cursor-pointer"
            style={{ zIndex: 20 - index }}
            animate={{
              y: inView ? 0 : index * 12,
              scale: inView ? 1 : 0.96,
              opacity: inView ? 1 : 0,
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30">
              {agent.status === "Active" ? (
                <div className="relative">
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500 text-black">
                    Active
                  </span>
                  <span className="absolute inset-0 rounded-full animate-ping bg-emerald-400/60" />
                </div>
              ) : (
                <span
                  className="px-3 py-1 text-xs font-medium rounded-full 
                                 bg-background/80 backdrop-blur border 
                                 border-dashed border-purple-400 text-purple-400"
                >
                  Coming Soon
                </span>
              )}
            </div>

            {/* CARD */}
            <div className="group w-full h-full [perspective:1000px]">
              <div
                className="relative w-full h-full rounded-2xl transition-transform duration-700 
                              [transform-style:preserve-3d] 
                              group-hover:[transform:rotateY(180deg)]"
              >
                {/* FRONT */}
                <div
                  className="absolute inset-0 rounded-2xl bg-cover bg-center overflow-hidden 
                             [backface-visibility:hidden]"
                  style={{ backgroundImage: `url(${agent.image})` }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 h-24 
                                  bg-gradient-to-t from-black/80 via-black/40 to-transparent 
                                  "
                  />

                  <div className="absolute bottom-3 w-full text-center px-3">
                    <h3
                      className="text-xl font-semibold text-white "
                      //style={{ color: agent.textColor }}
                    >
                      {agent.name}
                    </h3>

                    <p
                      className="text-sm text-white opacity-80"
                      // style={{ color: agent.textColor }}
                    >
                      {agent.role}
                    </p>
                  </div>
                </div>

                {/* BACK */}
                <div
                  className="absolute inset-0 rounded-2xl 
                                bg-gradient-to-br from-slate-900 to-slate-800 
                                text-white px-6 
                                [transform:rotateY(180deg)] 
                                [backface-visibility:hidden]"
                >
                  <div className="flex flex-col justify-center items-center h-full text-center space-y-4">
                    <p className="text-base leading-relaxed">
                      {agent.description}
                    </p>

                    <div className="flex flex-wrap justify-center gap-4">
                      {agent.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-sm px-5 py-3 rounded-full bg-white/10"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        <motion.div
          whileHover={{ y: -10, scale: 1.04 }}
          className="relative w-[240px] h-[320px] rounded-3xl 
                     border-2 border-dashed border-emerald-400/50 
                     bg-emerald-400/5 flex flex-col items-center justify-center 
                     text-center cursor-pointer overflow-hidden"
          onClick={() => setLocation("/create")}
        >
          <motion.div
            className="absolute inset-[-40px] rounded-3xl"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
          />

          <div className="relative z-10 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500   flex items-center justify-center mb-5">
              <Plus className="w-8 h-8 text-black" />
            </div>
            <h3 className="text-xl font-bold mb-2">Build Your Own</h3>
            <p className="text-sm text-muted-foreground px-4">
              Train a custom agent on your workflows.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default AgentSquad;
