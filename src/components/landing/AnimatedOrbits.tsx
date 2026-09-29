"use client";

import { motion } from "framer-motion";

const orbits = [
  { size: "w-[760px] h-[300px]", duration: 32, reverse: false, opacity: 0.35 },
  { size: "w-[580px] h-[230px]", duration: 24, reverse: true, opacity: 0.45 },
  { size: "w-[420px] h-[165px]", duration: 18, reverse: false, opacity: 0.55 },
  { size: "w-[290px] h-[115px]", duration: 14, reverse: true, opacity: 0.7 },
];

const particles = [
  { orbit: 0, delay: 0, size: 7 },
  { orbit: 0, delay: 5, size: 5 },
  { orbit: 1, delay: 2, size: 6 },
  { orbit: 1, delay: 8, size: 4 },
  { orbit: 2, delay: 3, size: 5 },
  { orbit: 2, delay: 9, size: 4 },
  { orbit: 3, delay: 1, size: 5 },
  { orbit: 3, delay: 6, size: 4 },
];

export default function AnimatedOrbits() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Background glow */}
      <div className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-[100px]" />

      {/* Orbit system */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {orbits.map((orbit, index) => (
          <motion.div
            key={index}
            className={`absolute left-1/2 top-1/2 ${orbit.size} -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-cyan-400/20`}
            style={{
              opacity: orbit.opacity,
              boxShadow: "0 0 30px rgba(0, 174, 255, 0.08)",
            }}
            animate={{
              rotate: orbit.reverse ? -360 : 360,
            }}
            transition={{
              duration: orbit.duration,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}

        {/* Orbit particles */}
        {particles.map((particle, index) => {
          const orbit = orbits[particle.orbit];

          return (
            <motion.div
              key={index}
              className={`absolute left-1/2 top-1/2 ${orbit.size}`}
              style={{
                transform: "translate(-50%, -50%)",
              }}
              animate={{
                rotate: orbit.reverse ? -360 : 360,
              }}
              transition={{
                duration: orbit.duration,
                repeat: Infinity,
                ease: "linear",
                delay: -particle.delay,
              }}
            >
              <div
                className="absolute left-1/2 top-0 rounded-full bg-cyan-300"
                style={{
                  width: particle.size,
                  height: particle.size,
                  marginLeft: -(particle.size / 2),
                  boxShadow: "0 0 8px rgba(34,211,238,0.9), 0 0 20px rgba(0,174,255,0.5)",
                }}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Center energy point */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300"
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          boxShadow: "0 0 15px rgba(34,211,238,1), 0 0 50px rgba(0,174,255,0.8)",
        }}
      />

      {/* Fade edges so the animation blends into the hero */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020817]/30 via-transparent to-[#020817]/80" />
    </div>
  );
}
