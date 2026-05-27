/**
 * Creative, CSS-only animated hero background.
 * No WebGL, no Three.js, no Lottie, no video files.
 * Blends into the current MemorialSpace theme using CSS custom properties.
 * Respects prefers-reduced-motion.
 */

const LIGHT_COUNT = 24;
const PARTICLE_COUNT = 14;

export function AnimatedHeroBackground() {
  return (
    <div
      className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Deep ambient glow orbs — slow breathing */}
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />
      <div className="hero-orb hero-orb-3" />
      <div className="hero-orb hero-orb-4" />

      {/* Sweeping aurora band */}
      <div className="hero-aurora" />

      {/* Memorial lights — soft twinkling dots like candles in the distance */}
      {Array.from({ length: LIGHT_COUNT }).map((_, i) => {
        const left = `${((i * 47.3) % 100)}%`;
        const top = `${20 + (i * 11.7) % 60}%`;
        const delay = `${(i * 1.3) % 7}s`;
        const duration = `${3 + (i % 5)}s`;
        const size = 2 + (i % 3);
        const hue = i % 2 === 0 ? "var(--primary)" : "42 60% 55%"; /* primary or gold */
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
              background: `hsl(${hue})`,
            }}
          />
        );
      })}

      {/* Rising particles like embers / floating petals */}
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const left = `${(i * 57.1) % 100}%`;
        const delay = `${(i * 0.9) % 14}s`;
        const duration = `${16 + (i % 10)}s`;
        const size = 2 + (i % 3);
        const drift = i % 2 === 0 ? 30 : -25;
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
              "--drift": `${drift}px`,
            } as React.CSSProperties}
          />
        );
      })}

      {/* Subtle ground / horizon silhouette */}
      <svg
        className="hero-ground-silhouette"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.04" />
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
          opacity="0.04"
        />
        <path
          d="M1100,130 Q1105,65 1110,130 M1105,75 L1085,110 M1105,80 L1125,112"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          opacity="0.03"
        />
      </svg>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .hero-orb {
            position: absolute;
            border-radius: 50%;
            filter: blur(100px);
            opacity: 0.22;
            animation: orbBreath 18s ease-in-out infinite alternate;
          }
          .hero-orb-1 {
            top: -15%;
            left: 10%;
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, hsl(var(--primary) / 0.18) 0%, transparent 70%);
            animation-delay: 0s;
          }
          .hero-orb-2 {
            top: 5%;
            right: 5%;
            width: 450px;
            height: 450px;
            background: radial-gradient(circle, hsl(42 60% 55% / 0.10) 0%, transparent 70%);
            animation-delay: -6s;
          }
          .hero-orb-3 {
            bottom: 10%;
            left: 35%;
            width: 500px;
            height: 500px;
            background: radial-gradient(circle, hsl(var(--primary) / 0.10) 0%, transparent 70%);
            animation-delay: -12s;
          }
          .hero-orb-4 {
            top: 40%;
            left: -5%;
            width: 350px;
            height: 350px;
            background: radial-gradient(circle, hsl(160 50% 45% / 0.08) 0%, transparent 70%);
            animation-delay: -9s;
          }
          @keyframes orbBreath {
            0% { transform: translate(0, 0) scale(1); opacity: 0.18; }
            100% { transform: translate(20px, -30px) scale(1.12); opacity: 0.28; }
          }

          .hero-aurora {
            position: absolute;
            top: -20%;
            left: -20%;
            width: 140%;
            height: 140%;
            background: conic-gradient(
              from 180deg at 50% 50%,
              transparent 0deg,
              hsl(var(--primary) / 0.03) 60deg,
              transparent 120deg,
              hsl(42 60% 55% / 0.02) 180deg,
              transparent 240deg,
              hsl(160 50% 40% / 0.03) 300deg,
              transparent 360deg
            );
            animation: auroraSpin 30s linear infinite;
            filter: blur(60px);
            opacity: 0.7;
          }
          @keyframes auroraSpin {
            0% { transform: rotate(0deg) scale(1); }
            100% { transform: rotate(360deg) scale(1.05); }
          }

          .hero-memorial-light {
            position: absolute;
            border-radius: 50%;
            filter: blur(1px);
            animation-name: memorialTwinkle;
            animation-timing-function: ease-in-out;
            animation-iteration-count: infinite;
            opacity: 0.5;
            box-shadow: 0 0 6px 2px currentColor;
            color: inherit;
          }
          @keyframes memorialTwinkle {
            0%, 100% { opacity: 0.2; transform: scale(0.8); }
            50% { opacity: 0.7; transform: scale(1.3); }
          }

          .hero-particle {
            position: absolute;
            bottom: -8px;
            border-radius: 50%;
            background: hsl(var(--primary) / 0.35);
            animation-name: particleDrift;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
            opacity: 0;
          }
          @keyframes particleDrift {
            0% {
              transform: translateY(0) translateX(0);
              opacity: 0;
            }
            8% {
              opacity: 0.4;
            }
            50% {
              transform: translateY(-55vh) translateX(var(--drift, 20px));
              opacity: 0.3;
            }
            92% {
              opacity: 0.2;
            }
            100% {
              transform: translateY(-115vh) translateX(calc(var(--drift, 20px) * -0.3));
              opacity: 0;
            }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-orb, .hero-aurora, .hero-memorial-light, .hero-particle {
            animation: none !important;
          }
          .hero-aurora { opacity: 0; }
        }
        .hero-ground-silhouette {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 160px;
          color: hsl(var(--foreground));
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
