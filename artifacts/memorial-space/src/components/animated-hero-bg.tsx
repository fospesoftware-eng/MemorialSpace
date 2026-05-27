/**
 * Lightweight, CSS-only animated hero background.
 * No WebGL, no Three.js, no Lottie, no video files.
 * Respects prefers-reduced-motion.
 */

const PARTICLE_COUNT = 18;

export function AnimatedHeroBackground() {
  return (
    <div
      className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Soft ambient glow orbs */}
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />
      <div className="hero-orb hero-orb-3" />

      {/* Floating particles */}
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const left = `${(i * 137.5) % 100}%`;
        const delay = `${(i * 0.7) % 12}s`;
        const duration = `${12 + (i % 8)}s`;
        const size = 2 + (i % 4);
        const opacity = 0.15 + (i % 5) * 0.05;
        return (
          <span
            key={i}
            className="hero-particle"
            style={{
              left,
              width: size,
              height: size,
              animationDelay: delay,
              animationDuration: duration,
              opacity,
            }}
          />
        );
      })}

      {/* Subtle tree silhouette at bottom */}
      <svg
        className="hero-tree-silhouette"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,320 L0,240 Q60,200 120,220 T240,200 T360,230 T480,210 T600,240 T720,190 T840,230 T960,200 T1080,220 T1200,190 T1320,230 L1440,200 L1440,320 Z"
          fill="currentColor"
          opacity="0.03"
        />
      </svg>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .hero-orb {
            position: absolute;
            border-radius: 50%;
            filter: blur(80px);
            opacity: 0.25;
            animation: orbFloat 20s ease-in-out infinite alternate;
          }
          .hero-orb-1 {
            top: -10%;
            left: 20%;
            width: 500px;
            height: 500px;
            background: hsl(var(--primary) / 0.12);
            animation-delay: 0s;
          }
          .hero-orb-2 {
            top: 10%;
            right: 10%;
            width: 400px;
            height: 400px;
            background: hsl(42 60% 55% / 0.08);
            animation-delay: -8s;
          }
          .hero-orb-3 {
            bottom: 20%;
            left: 50%;
            width: 350px;
            height: 350px;
            background: hsl(var(--primary) / 0.06);
            animation-delay: -14s;
          }
          @keyframes orbFloat {
            0% { transform: translate(0, 0) scale(1); }
            100% { transform: translate(30px, -40px) scale(1.08); }
          }
          .hero-particle {
            position: absolute;
            bottom: -10px;
            border-radius: 50%;
            background: hsl(var(--primary) / 0.4);
            animation-name: particleRise;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
          }
          @keyframes particleRise {
            0% {
              transform: translateY(0) translateX(0);
              opacity: 0;
            }
            10% {
              opacity: var(--particle-opacity, 0.3);
            }
            50% {
              transform: translateY(-50vh) translateX(20px);
            }
            90% {
              opacity: var(--particle-opacity, 0.3);
            }
            100% {
              transform: translateY(-110vh) translateX(-10px);
              opacity: 0;
            }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-orb, .hero-particle {
            animation: none !important;
          }
        }
        .hero-tree-silhouette {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 120px;
          color: hsl(var(--foreground));
        }
      `}</style>
    </div>
  );
}
