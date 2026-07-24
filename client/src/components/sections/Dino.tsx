
import { motion, useInView } from "framer-motion";
import React, { useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
const agents = [
  {
    name: "DataSor",
    role: "AI Data Data Agent",
    description: "Turns brain dumps into actionable project roadmaps.",
    image: "/dinocard2/dino1.png",
    route: "/datasor",
  },
  {
    name: "IdeaSor",
    role: "AI Ideation Agent ",
    description: "Manages your backlog and runs automated sprints.",
    image: "/dinocard2/dino4.png",
    route: "/ideasor",
  },
  {
    name: "SociaSor",
    role: "AI Social Media Agent",
    description: "Clarifies vague tickets and spots missing details.",
    image: "/dinocard2/dino3.png",
    route: "/sociasor",
  },
  {
    name: "CRMSor",
    role: "AI CRM Partner",
    description: "Keeps client data and communication in sync.",
    image: "/dinocard2/dino5.png",
    route: "/crm"
  },
];

export function Dino() {
  const [, setLocation] = useLocation();

  return (
    <section className="py-14 relative overflow-y-hidden">
      <div
        className="flex flex-nowrap justify-center gap-3
        scale-[0.78] sm:scale-[0.1] md:scale-90
        origin-center"
      >
        {agents.map((agent, index) => (
          <motion.div
            key={agent.name}
            className="relative w-[110px] h-[90px] shrink-0 
              hover:-translate-y-3 transition delay-150 duration-300
              overflow-visible"
            onClick={() => setLocation(agent.route)}
          >
            <div className="group relative w-full h-full flex items-center justify-center">

            
              <div
                className="
                  absolute -top-7 left-1/2 -translate-x-1/2
                  px-3 py-1.5 text-xs font-medium
                  dark:text-white text-black opacity-0
                  rounded-lg
                  transition-all duration-300
                  pointer-events-none whitespace-nowrap z-20
                  group-hover:opacity-100 group-hover:scale-100
                "
              >
                {agent.role}
              </div>

            
              <img
                src={agent.image}
                alt={agent.name}
                className="
                  w-full h-full object-contain
                  drop-shadow-[0_12px_20px_rgba(0,0,0,0.25)]
                  transition-transform duration-300
                  group-hover:scale-105
                "
              />

          
              <div className="absolute -bottom-6 w-full text-center">
                <span className="text-xs font-semibold tracking-wide text-black dark:text-white">
                  {agent.name}
                </span>
              </div>

            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
export default Dino;