import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { User, Sparkles, Users, Building2 } from "lucide-react";
import CanvasCursor from "@/pages/cursor_d";

const cards = [
  {
    title: "Solo Founders",
    description:
      "For the visionaries and makers turning chaos into products at record speed.",
    image: "/card/solo.jpg",
    icon: User,
  },
  {
    title: "Female Founders",
    description:
      "Empowering women-led ventures with tools to lead, scale, and succeed.",
    image: "/card/woman.jpg",
    icon: Sparkles,
  },
  {
    title: "Growth Teams",
    description:
      "For high-velocity startups synchronizing workflows to hit hypergrowth.",
    image: "/card/team.jpg",
    icon: Users,
  },
  {
    title: "Enterprise",
    description:
      "Secure, governed, and scalable infrastructure for global organizations.",
    image: "/card/enterprise.png",
    icon: Building2,
  },
];

function ParallaxCard({ card }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 120, damping: 18 });
  const springY = useSpring(y, { stiffness: 120, damping: 18 });

  const rotateX = useTransform(springY, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(springX, [-0.5, 0.5], ["-15deg", "15deg"]);

  const bgX = useTransform(springX, [-0.5, 0.5], ["15%", "-15%"]);
  const bgY = useTransform(springY, [-0.5, 0.5], ["15%", "-15%"]);

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;

    x.set(px);
    y.set(py);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (

    <div className="[perspective:1200px]">
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ rotateX, rotateY }}
        className="relative h-[350px] rounded-3xl  "
        whileHover={{ y: -12 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <div
          className="group relative h-full w-full overflow-hidden rounded-3xl
                     bg-white/10 dark:bg-black/20
                     backdrop-blur-xl
                       hover:drop-shadow-[0_5px_5px_rgba(0,176,134,1)]"
        >
          <motion.div
            className="absolute -inset-10 bg-cover bg-center"
            style={{
              backgroundImage: `url(${card.image})`,
              x: bgX,
              y: bgY,
            }}
          />

      
          <div
            className="absolute inset-0 bg-gradient-to-br
                       from-white/20 via-transparent to-transparent
                       opacity-0 group-hover:opacity-100
                       transition-opacity duration-700"
          />

        
          <div
            className="absolute inset-0 bg-gradient-to-t
                       from-black/80 via-black/40 to-transparent
                       opacity-0 group-hover:opacity-100
                       transition-opacity duration-700"
          />

          
          <motion.div
            initial={{ y: 40 }}
            whileHover={{ y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative z-10 flex h-full flex-col justify-end p-10   "
          >
            
            <h4
              className="absolute top-60 left-1/2 transform -translate-x-1/2 whitespace-nowrap px-4 py-2 text-base font-medium tracking-wide text-emerald-700 dark:text-emerald-300 bg-white/70 dark:bg-black/40 backdrop-blur-xl rounded-2xl
shadow-lg shadow-black/10 ring-1 ring-black/5 dark:ring-white/10"
            >
              {card.title}
            </h4>
          </motion.div>
        </div>
      </motion.div>
       <CanvasCursor />
    </div>
   
  );
}

export default function HoverCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
      {cards.map((card, index) => (
        <ParallaxCard key={index} card={card} />
      ))}
    </div>
  );
}
