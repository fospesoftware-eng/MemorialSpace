/**
 * Creative, CSS-only animated hero background.
 * No WebGL, no Three.js, no Lottie, no video files.
 * Blends into the current MemorialSpace dark/light themes.
 * Respects prefers-reduced-motion.
 */

import "./animated-hero-bg.css";

const LIGHT_COUNT = 36;
const PARTICLE_COUNT = 32;
const STAR_COUNT = 60;
const WAVE_COUNT = 3;
const RAY_COUNT = 4;

export function AnimatedHeroBackground() {
  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Deep ambient glow orbs — slow breathing */}
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />
      <div className="hero-orb hero-orb-3" />
      <div className="hero-orb hero-orb-4" />

      {/* Sweeping aurora band */}
      <div className="hero-aurora" />

      {/* Light rays emanating from behind the text area */}
      {Array.from({ length: RAY_COUNT }).map((_, i) => (
        <div key={`ray-${i}`} className={`hero-ray hero-ray-${i + 1}`} />
      ))}

      {/* Flowing gradient wave lines */}
      {Array.from({ length: WAVE_COUNT }).map((_, i) => (
        <div key={`wave-${i}`} className={`hero-wave hero-wave-${i + 1}`} />
      ))}

      {/* Star field — subtle distant stars */}
      {Array.from({ length: STAR_COUNT }).map((_, i) => {
        const left = `${(i * 61.7) % 100}%`;
        const top = `${(i * 37.3) % 65}%`;
        const delay = `${(i * 0.7) % 5}s`;
        const duration = `${2 + (i % 4)}s`;
        const size = 1 + (i % 2);
        return (
          <span
            key={`star-${i}`}
            className="hero-star"
            style={{
              left,
              top,
              width: size,
              height: size,
              animationDelay: delay,
              animationDuration: duration,
            }}
          />
        );
      })}

      {/* Memorial lights — candle-like dots that twinkle */}
      {Array.from({ length: LIGHT_COUNT }).map((_, i) => {
        const left = `${((i * 47.3) % 100)}%`;
        const top = `${20 + (i * 11.7) % 55}%`;
        const delay = `${(i * 1.3) % 7}s`;
        const duration = `${3 + (i % 5)}s`;
        const size = 2 + (i % 3);
        const isGold = i % 3 === 0;
        return (
          <span
            key={`light-${i}`}
            className="hero-memorial-light"
            style={{
              left,
              top,
              width: size,
              height: size,
              animationDelay: delay,
              animationDuration: duration,
              color: isGold
                ? "rgba(234,179,8,0.6)"
                : "rgba(34,197,94,0.55)",
            }}
          />
        );
      })}

      {/* Rising particles like embers / floating petals */}
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const left = `${(i * 57.1) % 100}%`;
        const delay = `${(i * 0.9) % 14}s`;
        const duration = `${16 + (i % 10)}s`;
        const size = 2 + (i % 4);
        const drift = i % 2 === 0 ? 40 : -35;
        const isGold = i % 4 === 0;
        return (
          <span
            key={`particle-${i}`}
            className="hero-particle"
            style={{
              left,
              width: size,
              height: size,
              animationDelay: delay,
              animationDuration: duration,
              background: isGold
                ? "rgba(234,179,8,0.75)"
                : "rgba(34,197,94,0.7)",
              "--drift": `${drift}px`,
            } as React.CSSProperties}
          />
        );
      })}

      {/* Ground mist haze */}
      <div className="hero-mist" />

      {/* Subtle ground / horizon silhouette */}
      <svg
        className="hero-ground-silhouette"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.08" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,200 L0,140 Q80,110 160,125 T320,115 T480,130 T640,105 T800,120 T960,100 T1120,115 T1280,95 L1440,110 L1440,200 Z"
          fill="url(#groundGrad)"
        />
        {/* Sparse tree silhouettes */}
        <path
          d="M120,140 Q125,80 130,140 M125,90 L110,115 M125,95 L140,118"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          opacity="0.07"
        />
        <path
          d="M1100,130 Q1105,65 1110,130 M1105,75 L1085,110 M1105,80 L1125,112"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          opacity="0.06"
        />
      </svg>
    </div>
  );
}
