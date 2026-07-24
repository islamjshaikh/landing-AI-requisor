const agents = [
  { name: "Sociasor", role: "Social Media Agent", icon: "/public/dinocard2/dino3.png" },
  { name: "Ideasor", role: "Ideation Agent", icon: "/public/dinocard2/dino4.png" },
  { name: "Datasor", role: "Data Insight Agent", icon: "/public/dinocard2/dino1.png" },
  { name: "CMR", role: "CRM Agent", icon: "/public/dinocard2/dino2.png" },
  { name: "Requisor", role: "Project Management Agent", icon: "/public/dinocard2/dino5.png" },
];

const positionMap: string[] = [
  "col-start-1 row-start-1",
  "col-start-3 row-start-1",
  "col-start-1 row-start-3",
  "col-start-3 row-start-3",
];

export default function AITeamGrid() {
  return (
    <div className="relative grid grid-cols-3 grid-rows-3 gap-8 p-8 bg-background rounded-xl border border-border">

      {/* 4 CORNER AGENTS */}
      {agents.slice(0, 4).map((agent, index) => (
        <div key={agent.name} className={positionMap[index]}>
          <AgentCard agent={agent} />
        </div>
      ))}

      {/* CENTER OVERLAY AGENT */}
      <div
        className="
          absolute 
          left-1/2 
          top-1/2 
          -translate-x-1/2 
          -translate-y-1/2
          z-20
        "
      >
        <AgentCard
          agent={agents[4]}
          highlight
        />
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  highlight = false,
}: {
  agent: { name: string; role: string; icon: string };
  highlight?: boolean;
}) {
  return (
    <div
      className={`
        border rounded-xl p-4 flex flex-col items-center text-center gap-2
        bg-background transition-all duration-300
        ${highlight
          ? "scale-110 shadow-[0_0_45px_rgba(0,160,255,0.6)]"
          : "hover:scale-105 hover:shadow-lg"}
      `}
    >
      <img
        src={agent.icon}
        alt={agent.name}
        className="w-14 h-14 object-contain"
      />
      <div>
        <div className="font-bold">{agent.name}</div>
        <div className="text-sm text-muted-foreground">{agent.role}</div>
      </div>
    </div>
  );
}
