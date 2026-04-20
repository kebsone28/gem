/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import React, { useEffect, useRef } from 'react';
import { animate, useMotionValue, useTransform, motion } from 'framer-motion';

/**
 * AnimatedCounter (Axe 4 — Plan d'Amélioration Continue GEM-SAAS)
 * Un compteur de chiffres fluide qui anime le défilement lors du changement de valeur.
 * Style : "Pulse" Premium.
 */
interface Props {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const AnimatedCounter: React.FC<Props> = ({ 
  value, 
  duration = 1.5, 
  prefix = '', 
  suffix = '',
  className = ''
}) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const prevValueRef = useRef(0);

  useEffect(() => {
    const controls = animate(count, value, { 
      duration, 
      ease: [0.16, 1, 0.3, 1] // Custom quintic ease-out for a smooth premium feel
    });
    
    return controls.stop;
  }, [value, count, duration]);

  return (
    <motion.span className={className}>
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </motion.span>
  );
};
