import { useState, useEffect } from "react";

const SmoothLogoSlider = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [translateX, setTranslateX] = useState(0);

  const logos = [
    { src: "/logos/logo1.png", name: "TechCorp" },
    { src: "/logos/logo2.png", name: "InnovateX" },
    { src: "/logos/logo3.png", name: "DataFlow" },
    { src: "/logos/logo5.png", name: "CloudSys" },
    { src: "/logos/logo6.png", name: "QuantumAI" },
    { src: "/logos/logo7.png", name: "FutureTech" },
    { src: "/logos/logo8.png", name: "NexGen" },
  ];

  const duplicatedLogos = [...logos, ...logos];

  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp = 0;
    const speed = 0.6;

    const animate = (timestamp: number) => {
      if (!isPaused) {
        if (!lastTimestamp) lastTimestamp = timestamp;
        const delta = timestamp - lastTimestamp;

        setTranslateX((prev) => {
          const newX = prev - (speed * delta) / 16.67;
          const totalWidth = logos.length * 200 + logos.length * 48;
          return newX <= -totalWidth ? 0 : newX;
        });

        lastTimestamp = timestamp;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPaused, logos.length]);

  return (

    
    <div
      className="relative w-full overflow-hidden md:py-15 mt-6 md:mt-3  group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className="flex items-center md:gap-x-16 gap-x-3 opacity-100 grayscale group-hover:grayscale-0 transition-all duration-500"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isPaused ? "transform 0.2s ease-out" : "none",
          width: "max-content",
        }}
      >
      {duplicatedLogos.map((logo, index) => (
        <div
          key={index}
          className="flex-shrink-0 relative group/logo"
          onMouseEnter={() => {
            setIsPaused(true);
          }}
          onMouseLeave={() => {
            setIsPaused(false);
          }}
        >

          <div className="relative p-2 transition-all duration-300 ">
            <img
              src={logo.src}
              alt={`${logo.name} logo`}
              className="h-20 md:h-24 w-auto object-contain brightness-0 dark:invert 
                         opacity-70 group-hover/logo:opacity-100 group-hover/logo:brightness-100 
                         group-hover/logo:dark:invert-0 transition-all duration-300 hover:scale-130"
            />
          </div>
        </div>
      ))}
      </div>
      <div className="absolute left-0 top-0 bottom-0 w-32 "></div>
      <div className="absolute right-0 top-0 bottom-0 w-32 "></div>
    </div>
  );
};

export default SmoothLogoSlider;