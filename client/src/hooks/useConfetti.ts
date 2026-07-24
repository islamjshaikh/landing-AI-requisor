import { useState, useCallback } from 'react';

interface UseConfettiReturn {
  isConfettiActive: boolean;
  triggerConfetti: () => void;
  stopConfetti: () => void;
}

export const useConfetti = (): UseConfettiReturn => {
  const [isConfettiActive, setIsConfettiActive] = useState(false);

  const triggerConfetti = useCallback(() => {
    setIsConfettiActive(true);
  }, []);

  const stopConfetti = useCallback(() => {
    setIsConfettiActive(false);
  }, []);

  return {
    isConfettiActive,
    triggerConfetti,
    stopConfetti
  };
};