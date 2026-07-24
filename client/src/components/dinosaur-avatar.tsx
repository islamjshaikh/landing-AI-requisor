import { motion } from "framer-motion";

interface DinosaurAvatarProps {
  species: string;
  name: string;
  className?: string;
}

const dinosaurEmojis: Record<string, string> = {
  triceratops: '🦕',
  stegosaurus: '🦕',
  velociraptor: '🦖',
  pterodactyl: '🦅',
  ankylosaurus: '🦕',
  brachiosaurus: '🦕',
  tyrannosaurus: '🦖',
};

const dinosaurColors: Record<string, { primary: string; secondary: string }> = {
  triceratops: { primary: '#10B981', secondary: '#34D399' }, // Green
  stegosaurus: { primary: '#3B82F6', secondary: '#60A5FA' }, // Blue
  velociraptor: { primary: '#8B5CF6', secondary: '#A78BFA' }, // Purple
  pterodactyl: { primary: '#EC4899', secondary: '#F472B6' }, // Pink
  ankylosaurus: { primary: '#F59E0B', secondary: '#FCD34D' }, // Orange
  brachiosaurus: { primary: '#6366F1', secondary: '#818CF8' }, // Indigo
  tyrannosaurus: { primary: '#EF4444', secondary: '#F87171' }, // Red
};

export function DinosaurAvatar({ species, name, className = "" }: DinosaurAvatarProps) {
  const emoji = dinosaurEmojis[species] || '🦕';
  const colors = dinosaurColors[species] || { primary: '#6366F1', secondary: '#818CF8' };

  return (
    <motion.div
      className={`relative ${className}`}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      {/* Dinosaur container with gradient background */}
      <div className="relative w-32 h-32 mx-auto">
        {/* Background circle with gradient */}
        <div 
          className="absolute inset-0 rounded-full shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`
          }}
        />
        
        {/* Dinosaur emoji */}
        <motion.div 
          className="absolute inset-0 flex items-center justify-center text-6xl select-none"
          animate={{ 
            y: [0, -5, 0],
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {emoji}
        </motion.div>

        {/* Decorative elements */}
        <motion.div
          className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full shadow-md flex items-center justify-center text-xs"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ✨
        </motion.div>
      </div>

      {/* Dinosaur name */}
      <motion.h3 
        className="mt-3 text-lg font-bold text-gray-800 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {name}
      </motion.h3>

      {/* Footprint decoration */}
      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full opacity-30" />
        <div className="w-2 h-2 bg-gray-400 rounded-full opacity-20" />
        <div className="w-2 h-2 bg-gray-400 rounded-full opacity-10" />
      </div>
    </motion.div>
  );
}