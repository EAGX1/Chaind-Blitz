import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { t } from "../../meta/i18n.js";

type Props = {
  buildingId: string;
  label: string;
  onOpenDesk: () => void;
  onExit: () => void;
};

function FitInterior() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const apply = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w < 1 || h < 1) return;
      gl.setSize(w, h, false);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [gl, camera]);
  return null;
}

function PlankFloor({ onWalk }: { onWalk: (x: number, z: number) => void }) {
  const planks = Array.from({ length: 14 }, (_, i) => i);
  return (
    <group
      onPointerDown={(e) => {
        e.stopPropagation();
        onWalk(e.point.x, e.point.z);
      }}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[14.4, 12.4]} />
        <meshLambertMaterial color="#5a3d28" />
      </mesh>
      {planks.map((i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-6.3 + i * 0.98, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[0.9, 12]} />
          <meshLambertMaterial color={i % 2 === 0 ? "#c9a36a" : "#b08950"} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -1.2]} receiveShadow>
        <planeGeometry args={[5.2, 3.6]} />
        <meshLambertMaterial color="#7a2e28" />
      </mesh>
    </group>
  );
}

function Room({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, 3.15, -5.85]} receiveShadow>
        <boxGeometry args={[14, 6.4, 0.28]} />
        <meshLambertMaterial color="#e8dcc8" />
      </mesh>
      <mesh position={[-6.95, 3.15, 0]} receiveShadow>
        <boxGeometry args={[0.28, 6.4, 12]} />
        <meshLambertMaterial color="#dccfb8" />
      </mesh>
      <mesh position={[6.95, 3.15, 0]} receiveShadow>
        <boxGeometry args={[0.28, 6.4, 12]} />
        <meshLambertMaterial color="#dccfb8" />
      </mesh>
      <mesh position={[0, 6.38, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 12]} />
        <meshLambertMaterial color="#f3ead8" />
      </mesh>
      <mesh position={[0, 0.18, -5.68]}>
        <boxGeometry args={[14, 0.36, 0.12]} />
        <meshLambertMaterial color="#6b4428" />
      </mesh>
      <mesh position={[0, 3.4, -5.68]}>
        <planeGeometry args={[2.8, 2.1]} />
        <meshBasicMaterial color="#fff1b0" />
      </mesh>
      <mesh position={[0, 3.4, -5.66]}>
        <planeGeometry args={[2.4, 1.7]} />
        <meshBasicMaterial color="#f7e08a" />
      </mesh>
      <mesh position={[0, 1.12, -3.45]} castShadow>
        <boxGeometry args={[4.6, 1.18, 1.55]} />
        <meshLambertMaterial color={accent} />
      </mesh>
      <mesh position={[0, 1.78, -3.45]}>
        <boxGeometry args={[4.7, 0.12, 1.65]} />
        <meshLambertMaterial color="#2a2118" />
      </mesh>
      {[-1.2, 0, 1.2].map((x) => (
        <mesh key={x} position={[x, 1.95, -3.2]}>
          <boxGeometry args={[0.55, 0.12, 0.8]} />
          <meshLambertMaterial color="#f4f0e4" />
        </mesh>
      ))}
      <mesh position={[0, 5.6, 0]}>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshBasicMaterial color="#ffe9b8" />
      </mesh>
      <ambientLight intensity={1.15} color="#fff6e8" />
      <hemisphereLight args={["#fff4dc", "#6a4a32", 0.7]} />
      <pointLight position={[0, 5.4, 0]} intensity={55} distance={24} color="#ffe7b0" />
      <pointLight position={[0, 3.6, -5.2]} intensity={28} distance={14} color="#fff1b0" />
      <directionalLight position={[3, 7, 5]} intensity={1.35} color="#fff8e8" />
    </group>
  );
}

function Walker({
  target,
  keys,
  onNearDesk,
}: {
  target: MutableRefObject<{ x: number; z: number } | null>;
  keys: MutableRefObject<Record<string, boolean>>;
  onNearDesk: (near: boolean) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const pos = useRef({ x: 0, z: 3.4 });
  const { camera } = useThree();
  const lastNear = useRef(false);
  const look = useRef(new THREE.Vector3());
  const camPos = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    const step = Math.min(0.05, dt);
    const k = keys.current;
    const wish = { x: (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), z: (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0) };
    const wishLen = Math.hypot(wish.x, wish.z);
    if (wishLen > 0) {
      target.current = null;
      pos.current.x += (wish.x / wishLen) * 5.2 * step;
      pos.current.z += (wish.z / wishLen) * 5.2 * step;
    }
    const t = target.current;
    if (t) {
      const dx = t.x - pos.current.x;
      const dz = t.z - pos.current.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.18) {
        pos.current.x += (dx / dist) * 4.4 * step;
        pos.current.z += (dz / dist) * 4.4 * step;
      }
    }
    pos.current.x = THREE.MathUtils.clamp(pos.current.x, -5.4, 5.4);
    pos.current.z = THREE.MathUtils.clamp(pos.current.z, -4.0, 5.1);
    if (ref.current) ref.current.position.set(pos.current.x, 0, pos.current.z);
    camPos.current.set(pos.current.x, 3.6, pos.current.z + 7.2);
    camera.position.lerp(camPos.current, 1 - Math.exp(-8 * step));
    look.current.set(pos.current.x, 1.35, pos.current.z - 3.2);
    camera.lookAt(look.current);
    const near = Math.hypot(pos.current.x, pos.current.z + 3.45) < 2.15;
    if (near !== lastNear.current) {
      lastNear.current = near;
      onNearDesk(near);
    }
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.42, 1.7, 0.32]} />
        <meshLambertMaterial color="#1c2a44" />
      </mesh>
      <mesh position={[0, 1.85, 0.02]}>
        <boxGeometry args={[0.28, 0.28, 0.28]} />
        <meshLambertMaterial color="#e8c8a0" />
      </mesh>
    </group>
  );
}

const ACCENT: Record<string, string> = {
  pack_shop: "#c9a227",
  boutique: "#3aa0c8",
  solo_gates: "#6bcb77",
  coliseum: "#e85d4c"
};

export function InteriorWalk({ buildingId, label, onOpenDesk, onExit }: Props) {
  const walk = useRef<{ x: number; z: number } | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const [near, setNear] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onExit(); }
      if ((e.code === "KeyE" || e.key === "Enter") && near) onOpenDesk();
      if (e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD") {
        keys.current[e.code] = e.type === "keydown";
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD") {
        keys.current[e.code] = false;
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [near, onOpenDesk, onExit]);

  return (
    <div className="city-interior">
      <Canvas
        shadows
        camera={{ position: [0, 3.6, 10.6], fov: 52 }}
        dpr={[1, 1.5]}
        resize={{ debounce: 0 }}
        style={{ width: "100%", height: "100%", display: "block" }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor("#c9b496", 1);
          gl.shadowMap.enabled = true;
        }}
      >
        <color attach="background" args={["#c9b496"]} />
        <FitInterior />
        <Room accent={ACCENT[buildingId] || "#c9a227"} />
        <PlankFloor onWalk={(x, z) => { walk.current = { x, z }; }} />
        <Walker target={walk} keys={keys} onNearDesk={setNear} />
      </Canvas>
      <div className="city-interior-hud">
        <p><b>{label}</b> — walk to the desk (click floor or WASD)</p>
        {near ? (
          <button type="button" className="city-enter-cta" onClick={onOpenDesk}>OPEN COUNTER</button>
        ) : (
          <button type="button" className="cb-btn" onClick={onExit}>{t("city.back")}</button>
        )}
      </div>
    </div>
  );
}
