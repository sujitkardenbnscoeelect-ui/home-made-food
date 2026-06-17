import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";

const ElectricGlow: React.FC<{ intensity: number }> = ({ intensity }) => {
  const glowColor = `rgba(0, 200, 255, ${intensity})`;
  const outerGlow = `rgba(80, 0, 255, ${intensity * 0.5})`;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        boxShadow: `
          0 0 ${40 * intensity}px ${20 * intensity}px ${glowColor},
          0 0 ${80 * intensity}px ${40 * intensity}px ${outerGlow}
        `,
        borderRadius: 8,
        opacity: intensity,
      }}
    />
  );
};

const Lightning: React.FC<{ seed: number; frame: number }> = ({ seed, frame }) => {
  const points: string[] = [];
  let x = 0;
  let y = 50;
  const steps = 8;
  const rand = (n: number) => Math.sin(n * 127.1 + seed * 311.7 + frame * 0.7) * 0.5 + 0.5;
  for (let i = 0; i <= steps; i++) {
    x = (i / steps) * 100;
    y = 50 + (rand(i) - 0.5) * 60;
    points.push(`${x},${y}`);
  }
  return (
    <polyline
      points={points.join(" ")}
      fill="none"
      stroke={`hsl(${200 + seed * 30}, 100%, 70%)`}
      strokeWidth={1.5}
      strokeLinecap="round"
      opacity={rand(frame) * 0.9 + 0.1}
    />
  );
};

const Arrow: React.FC<{ progress: number }> = ({ progress }) => {
  const x = interpolate(progress, [0, 1], [-80, 0]);
  const opacity = interpolate(progress, [0, 0.3], [0, 1]);
  const pulseScale = 1 + Math.sin(progress * Math.PI * 6) * 0.04 * (1 - progress);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        transform: `translateX(${x}px) scale(${pulseScale})`,
        opacity,
      }}
    >
      {/* Arrow shaft */}
      <div
        style={{
          width: interpolate(progress, [0.2, 0.8], [0, 120]),
          height: 4,
          background: "linear-gradient(90deg, transparent, #00ccff, #7700ff)",
          borderRadius: 2,
          boxShadow: "0 0 12px 4px rgba(0,200,255,0.6)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Energy flow shimmer */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${((progress * 5) % 1) * 200 - 50}%`,
            width: "50%",
            height: "100%",
            background: "linear-gradient(90deg, transparent, white, transparent)",
            opacity: 0.6,
          }}
        />
      </div>
      {/* Arrowhead */}
      <div
        style={{
          width: 0,
          height: 0,
          borderTop: "14px solid transparent",
          borderBottom: "14px solid transparent",
          borderLeft: "28px solid #00ccff",
          filter: "drop-shadow(0 0 10px #00ccff) drop-shadow(0 0 20px #7700ff)",
          opacity: interpolate(progress, [0.5, 0.8], [0, 1]),
        }}
      />
    </div>
  );
};

export const MillingMachineAnimation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Phase timings
  const glowBuildFrames = 40;
  const revealStartFrame = 30;
  const arrowStartFrame = 80;

  // Glow pulse (flickers like electricity)
  const glowBase = interpolate(frame, [0, glowBuildFrames], [0, 1], {
    extrapolateRight: "clamp",
  });
  const flicker =
    Math.sin(frame * 0.8) * 0.15 +
    Math.sin(frame * 2.3) * 0.08 +
    Math.sin(frame * 5.1) * 0.04;
  const glowIntensity = Math.max(0, glowBase + flicker * glowBase);

  // Text reveal (character by character mask)
  const text = "Milling Machine";
  const revealProgress = interpolate(
    frame,
    [revealStartFrame, revealStartFrame + 60],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Arrow entrance
  const arrowProgress = spring({
    fps,
    frame: Math.max(0, frame - arrowStartFrame),
    config: { damping: 18, stiffness: 80 },
  });

  // Text glow flicker per-frame for electric feel
  const textGlowStrength = glowIntensity;
  const textShadow = `
    0 0 ${10 * textGlowStrength}px rgba(0,200,255,${0.9 * textGlowStrength}),
    0 0 ${30 * textGlowStrength}px rgba(0,200,255,${0.7 * textGlowStrength}),
    0 0 ${60 * textGlowStrength}px rgba(100,0,255,${0.5 * textGlowStrength}),
    0 0 ${2}px rgba(255,255,255,${0.8 * textGlowStrength})
  `;

  const numLightnings = 6;

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at center, #0a001a 0%, #000008 100%)",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "'Arial Black', 'Impact', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,150,255,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,150,255,0.07) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          opacity: glowIntensity,
        }}
      />

      {/* Lightning bolts behind text */}
      {glowBase > 0.1 && (
        <svg
          viewBox="0 0 100 100"
          style={{
            position: "absolute",
            width: "80%",
            height: 80,
            opacity: glowIntensity * 0.6,
          }}
        >
          {Array.from({ length: numLightnings }).map((_, i) => (
            <Lightning key={i} seed={i} frame={frame} />
          ))}
        </svg>
      )}

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
          position: "relative",
        }}
      >
        {/* Electric border around text */}
        <div style={{ position: "relative", padding: "20px 40px" }}>
          <ElectricGlow intensity={glowIntensity * 0.7} />

          {/* Corner sparks */}
          {[
            { top: -4, left: -4 },
            { top: -4, right: -4 },
            { bottom: -4, left: -4 },
            { bottom: -4, right: -4 },
          ].map((pos, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#00ccff",
                boxShadow: `0 0 ${12 * glowIntensity}px 4px #00ccff, 0 0 20px 8px #7700ff`,
                opacity:
                  glowIntensity *
                  (0.7 + Math.sin(frame * 0.5 + i * 1.5) * 0.3),
                ...pos,
              }}
            />
          ))}

          {/* TEXT with character reveal */}
          <div style={{ display: "flex", position: "relative" }}>
            {text.split("").map((char, i) => {
              const charReveal = interpolate(
                revealProgress,
                [i / text.length, (i + 1.5) / text.length],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              const charGlitch =
                charReveal < 1
                  ? Math.sin(frame * 10 + i * 3) * 4 * (1 - charReveal)
                  : 0;
              return (
                <span
                  key={i}
                  style={{
                    fontSize: 96,
                    fontWeight: 900,
                    letterSpacing: char === " " ? "0.3em" : "0.05em",
                    color: "#ffffff",
                    textShadow: textShadow,
                    opacity: charReveal,
                    transform: `translateY(${charGlitch}px)`,
                    display: "inline-block",
                    WebkitTextStroke: `1px rgba(0,200,255,${textGlowStrength * 0.5})`,
                  }}
                >
                  {char === " " ? " " : char}
                </span>
              );
            })}
          </div>
        </div>

        {/* Arrow row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            opacity: interpolate(frame, [arrowStartFrame - 5, arrowStartFrame + 5], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <Arrow progress={arrowProgress} />
          <span
            style={{
              fontSize: 28,
              color: "rgba(0,200,255,0.85)",
              fontWeight: 700,
              letterSpacing: "0.15em",
              textShadow: `0 0 10px rgba(0,200,255,0.8), 0 0 30px rgba(100,0,255,0.5)`,
              opacity: interpolate(arrowProgress, [0.5, 0.9], [0, 1]),
              textTransform: "uppercase",
            }}
          >
            Precision Engineering
          </span>
        </div>
      </div>

      {/* Scanline overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)",
          pointerEvents: "none",
          opacity: 0.4,
        }}
      />
    </AbsoluteFill>
  );
};
