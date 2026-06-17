import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const HelloWorld: React.FC<{ titleText: string; titleColor: string }> = ({
  titleText,
  titleColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ fps, frame, config: { damping: 200 } });
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const moveY = interpolate(frame, [0, 30], [-50, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "white",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: "Helvetica, Arial",
          fontSize: 80,
          fontWeight: "bold",
          color: titleColor,
          transform: `scale(${scale}) translateY(${moveY}px)`,
          opacity,
        }}
      >
        {titleText}
      </div>
    </AbsoluteFill>
  );
};
