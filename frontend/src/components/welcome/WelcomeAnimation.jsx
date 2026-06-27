import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const APPLE_EASE = [0.65, 0, 0.35, 1];

function StaggeredText({ text, delay = 0, className = '' }) {
  return (
    <span className={`inline-flex ${className}`}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + i * 0.04, duration: 0.4, ease: APPLE_EASE }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  );
}

export default function WelcomeAnimation({ firstName, onComplete }) {
  const [phase, setPhase] = useState(0);
  const [visible, setVisible] = useState(true);

  const skip = useCallback(() => {
    setVisible(false);
    setTimeout(onComplete, 100);
  }, [onComplete]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),   // Show "Welcome"
      setTimeout(() => setPhase(2), 1000),   // Slide left
      setTimeout(() => setPhase(3), 1600),   // Show divider + name
      setTimeout(() => setPhase(4), 2800),   // Fade out
      setTimeout(() => { setVisible(false); onComplete(); }, 3200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  useEffect(() => {
    const handler = (e) => { if (e.key || e.type === 'click') skip(); };
    window.addEventListener('keydown', handler);
    window.addEventListener('click', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('click', handler);
    };
  }, [skip]);

  const displayName = firstName || 'Welcome';
  const fontSize = displayName.length > 10 ? 'text-5xl md:text-6xl' : 'text-6xl md:text-7xl';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'linear-gradient(145deg, #f8f9fc 0%, #eff1f8 50%, #f4f5fb 100%)' }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Desktop layout */}
          <div className="hidden md:flex items-center gap-0">
            <motion.div
              animate={phase >= 2 ? { x: '-12vw' } : { x: 0 }}
              transition={{ duration: 0.6, ease: APPLE_EASE }}
              className="flex items-center"
            >
              {phase >= 1 && (
                <StaggeredText
                  text="Welcome"
                  className={`${fontSize} font-extralight text-[#0F172A] tracking-tight`}
                />
              )}
            </motion.div>

            {phase >= 3 && (
              <motion.div
                className="flex items-center gap-6"
                style={{ x: '-12vw' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <motion.div
                  className="w-px bg-[#94A3B8] mx-6"
                  initial={{ height: 0 }}
                  animate={{ height: 60 }}
                  transition={{ duration: 0.3, ease: APPLE_EASE }}
                />
                <StaggeredText
                  text={displayName}
                  delay={0.2}
                  className={`${fontSize} font-extralight text-[#0F172A] tracking-tight`}
                />
              </motion.div>
            )}
          </div>

          {/* Mobile layout: stacked vertically */}
          <div className="flex md:hidden flex-col items-center gap-4">
            {phase >= 1 && (
              <StaggeredText
                text="Welcome"
                className="text-5xl font-extralight text-[#0F172A] tracking-tight"
              />
            )}
            {phase >= 3 && (
              <>
                <motion.div
                  className="h-px bg-[#94A3B8]"
                  initial={{ width: 0 }}
                  animate={{ width: 60 }}
                  transition={{ duration: 0.3, ease: APPLE_EASE }}
                />
                <StaggeredText
                  text={displayName}
                  delay={0.2}
                  className="text-5xl font-extralight text-[#0F172A] tracking-tight"
                />
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}