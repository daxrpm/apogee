import { useEffect, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";

interface OrbitIntroSceneProps {
  onContinue?: () => void;
  onInteractionChange?: (isInteracting: boolean) => void;
}

export function OrbitIntroScene({
  onContinue,
  onInteractionChange,
}: OrbitIntroSceneProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [globeSize, setGlobeSize] = useState<{ width: number; height: number }>(
    { width: 0, height: 0 },
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setGlobeSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const controls = globe.controls() as unknown as {
      autoRotate: boolean;
      autoRotateSpeed: number;
      enablePan: boolean;
      minDistance: number;
      maxDistance: number;
      addEventListener?: (type: string, listener: () => void) => void;
      removeEventListener?: (type: string, listener: () => void) => void;
    };
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enablePan = false;
    controls.minDistance = 160;
    controls.maxDistance = 320;

    globe.pointOfView({ lat: 0, lng: -78.5, altitude: 2.2 }, 0);

    const onStart = () => onInteractionChange?.(true);
    const onEnd = () => onInteractionChange?.(false);
    controls.addEventListener?.("start", onStart);
    controls.addEventListener?.("end", onEnd);

    return () => {
      controls.removeEventListener?.("start", onStart);
      controls.removeEventListener?.("end", onEnd);
    };
  }, [onInteractionChange]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <Globe
        ref={globeRef}
        backgroundColor="#000000"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        width={globeSize.width}
        height={globeSize.height}
      />

      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          padding: "0 40px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            background: "rgba(0, 0, 0, 0.7)",
            padding: "18px 24px",
            borderRadius: 12,
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            pointerEvents: "auto",
          }}
        >
          <div style={{ fontSize: 44 }}>🌍</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 700,
                color: "#fff",
                fontFamily: "'Inter', system-ui, sans-serif",
                letterSpacing: 2,
              }}
            >
              APOGEE
            </div>
            <div
              style={{
                margin: 0,
                fontSize: 14,
                color: "rgba(255, 255, 255, 0.6)",
                fontFamily: "'Roboto Mono', monospace",
              }}
            >
              Globe view • Navigate to launch site
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none",
            borderRadius: 8,
            padding: "14px 28px",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 2,
            cursor: "pointer",
            pointerEvents: "auto",
            transition: "all 0.2s ease",
            fontFamily: "'Roboto Mono', monospace",
            boxShadow: "0 4px 15px rgba(99, 102, 241, 0.4)",
          }}
        >
          CONTINUE →
        </button>
      </div>
    </div>
  );
}
