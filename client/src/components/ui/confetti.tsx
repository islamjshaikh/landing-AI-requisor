import React, { useCallback, useEffect, useRef } from 'react';
import Confetti from 'react-confetti';

interface ConfettiComponentProps {
  isActive: boolean;
  onComplete?: () => void;
  duration?: number;
  numberOfPieces?: number;
  colors?: string[];
}

export const ConfettiComponent: React.FC<ConfettiComponentProps> = ({
  isActive,
  onComplete,
  duration = 3000,
  numberOfPieces = 200,
  colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']
}) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleComplete = useCallback(() => {
    if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  useEffect(() => {
    if (isActive) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set timeout to stop confetti after duration
      timeoutRef.current = setTimeout(() => {
        handleComplete();
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isActive, duration, handleComplete]);

  if (!isActive) {
    return null;
  }

  return (
    <Confetti
      width={window.innerWidth}
      height={window.innerHeight}
      numberOfPieces={numberOfPieces}
      recycle={false}
      colors={colors}
      gravity={0.3}
      initialVelocityY={20}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    />
  );
};

export default ConfettiComponent;