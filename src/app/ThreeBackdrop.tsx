import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";

/** Subtle 2D-first three.js backdrop — never blocks rules UX. */
export function ThreeBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  const particles = useMemo(
    () => Array.from({ length: reducedMotion ? 0 : 24 }, (_, i) => ({
      id: i,
      x: (i * 17) % 20 - 10,
      y: (i * 13) % 12 - 6,
      z: -8 - (i % 5),
    })),
    [reducedMotion]
  );

  if (reducedMotion) return <div className="cb-backdrop flat" aria-hidden />;

  return (
    <div className="cb-backdrop" aria-hidden>
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }} dpr={[1, 1.5]} style={{ pointerEvents: "none" }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[4, 6, 4]} intensity={0.6} color="#6ec8ff" />
        {particles.map((p) => (
          <mesh key={p.id} position={[p.x * 0.4, p.y * 0.3, p.z]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#3a7bd5" emissive="#1a3a6a" />
          </mesh>
        ))}
      </Canvas>
    </div>
  );
}
