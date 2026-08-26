/**
 * Battle City plaza — textured low-poly town square.
 * Procedural only (no GLTF / HDRI). Day/night from plazaTime.
 */
import { useMemo, useRef, type RefObject } from "react";
import { ContactShadows } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sampleWorld, tickClock } from "./plazaTime";
import { getPlazaTextures, type PlazaTextures } from "./plazaTextures";

function useTex() {
  return useMemo(() => getPlazaTextures(), []);
}

function Tree({
  x,
  z,
  scale = 1,
  blossom = 0.55,
  seed = 1,
  tex,
}: {
  x: number;
  z: number;
  scale?: number;
  blossom?: number;
  seed?: number;
  tex: PlazaTextures;
}) {
  const pink = blossom > 0.42;
  const clumps = useMemo(() => {
    let a = (seed * 1103515245 + 12345) >>> 0;
    const rnd = () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
    return Array.from({ length: 9 }, () => ({
      p: [(rnd() - 0.5) * 1.55, 1.55 + rnd() * 1.25, (rnd() - 0.5) * 1.55] as [number, number, number],
      r: 0.34 + rnd() * 0.46,
      tint: pink
        ? rnd() > 0.5 ? "#f4b0c4" : "#e8789a"
        : rnd() > 0.5 ? "#4cb05a" : "#2e8a38",
    }));
  }, [seed, pink]);

  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.34, 0.44, 8]} />
        <meshStandardMaterial map={tex.bark} roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.22, 1.7, 7]} />
        <meshStandardMaterial map={tex.bark} roughness={0.9} />
      </mesh>
      <mesh position={[0.28, 1.55, 0.1]} rotation={[0.4, 0.3, -0.7]} castShadow>
        <cylinderGeometry args={[0.05, 0.09, 0.7, 6]} />
        <meshStandardMaterial map={tex.bark} roughness={0.9} />
      </mesh>
      <mesh position={[-0.22, 1.7, -0.12]} rotation={[-0.35, -0.2, 0.8]} castShadow>
        <cylinderGeometry args={[0.045, 0.08, 0.55, 6]} />
        <meshStandardMaterial map={tex.bark} roughness={0.9} />
      </mesh>
      {clumps.map((cl, i) => (
        <mesh key={i} position={cl.p} castShadow>
          <icosahedronGeometry args={[cl.r, 0]} />
          <meshStandardMaterial
            map={pink ? tex.blossom : tex.leaf}
            color={cl.tint}
            roughness={0.78}
          />
        </mesh>
      ))}
    </group>
  );
}

function FramedWindow({
  position,
  tex,
}: {
  position: [number, number, number];
  tex: PlazaTextures;
}) {
  const glass = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (glass.current) glass.current.emissiveIntensity = 0.06 + sampleWorld().window * 1.1;
  });
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[0.72, 0.82]} />
        <meshStandardMaterial ref={glass} color="#7ec8e8" emissive="#f0d78c" emissiveIntensity={0.08} roughness={0.18} />
      </mesh>
      <mesh position={[0, 0.44, 0.03]}>
        <boxGeometry args={[0.82, 0.07, 0.07]} />
        <meshStandardMaterial map={tex.wood} />
      </mesh>
      <mesh position={[0, -0.44, 0.03]}>
        <boxGeometry args={[0.82, 0.07, 0.07]} />
        <meshStandardMaterial map={tex.wood} />
      </mesh>
      <mesh position={[-0.38, 0, 0.03]}>
        <boxGeometry args={[0.07, 0.9, 0.07]} />
        <meshStandardMaterial map={tex.wood} />
      </mesh>
      <mesh position={[0.38, 0, 0.03]}>
        <boxGeometry args={[0.07, 0.9, 0.07]} />
        <meshStandardMaterial map={tex.wood} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[0.05, 0.82, 0.04]} />
        <meshStandardMaterial map={tex.wood} />
      </mesh>
    </group>
  );
}

function TownHouse({
  a, r, w, h, d, roofKey, tex,
}: {
  a: number;
  r: number;
  w: number;
  h: number;
  d: number;
  roofKey: "clay" | "teal" | "slate" | "amber";
  tex: PlazaTextures;
}) {
  const x = Math.cos(a) * r;
  const z = Math.sin(a) * r;
  const roofs = { clay: tex.roofClay, teal: tex.roofTeal, slate: tex.roofSlate, amber: tex.roofAmber };
  return (
    <group position={[x, 0, z]} rotation={[0, -a + Math.PI / 2, 0]}>
      <mesh position={[0, 0.18, 0]} receiveShadow>
        <boxGeometry args={[w + 0.18, 0.36, d + 0.18]} />
        <meshStandardMaterial map={tex.brick} roughness={0.82} />
      </mesh>
      <mesh position={[0, h / 2 + 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial map={tex.plaster} roughness={0.78} />
      </mesh>
      <mesh position={[0, h + 0.95, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[Math.max(w, d) * 0.66, 1.85, 4]} />
        <meshStandardMaterial map={roofs[roofKey]} roughness={0.55} />
      </mesh>
      <mesh position={[w * 0.28, h + 1.15, -d * 0.12]} castShadow>
        <boxGeometry args={[0.38, 0.9, 0.38]} />
        <meshStandardMaterial map={tex.brick} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.95, d / 2 + 0.04]} castShadow>
        <boxGeometry args={[0.62, 1.35, 0.08]} />
        <meshStandardMaterial map={tex.wood} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.55, d / 2 + 0.08]}>
        <boxGeometry args={[0.08, 0.08, 0.08]} />
        <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.3} />
      </mesh>
      {[-w * 0.28, w * 0.28].map((wx) => (
        <FramedWindow key={wx} position={[wx, h * 0.58, d / 2 + 0.03]} tex={tex} />
      ))}
    </group>
  );
}

function Cloud({ x, y, z, s }: { x: number; y: number; z: number; s: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.position.x += dt * 0.35;
    if (ref.current.position.x > 50) ref.current.position.x = -50;
    const n = sampleWorld().night;
    for (const child of ref.current.children) {
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.opacity = 0.9 * (1 - n * 0.55);
    }
  });
  return (
    <group ref={ref} position={[x, y, z]} scale={s}>
      {([[0, 0, 0, 2.2], [1.7, 0.15, 0.25, 1.45], [-1.5, 0.1, -0.2, 1.35], [0.4, 0.45, -0.4, 1.1]] as const).map((p, i) => (
        <mesh key={i} position={[p[0], p[1], p[2]]}>
          <icosahedronGeometry args={[p[3], 0]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.9} roughness={1} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Fountain({ tex }: { tex: PlazaTextures }) {
  const water = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!water.current?.map) return;
    water.current.map.offset.set(Math.sin(clock.elapsedTime * 0.12) * 0.05, clock.elapsedTime * 0.04);
    water.current.emissiveIntensity = 0.18 + Math.sin(clock.elapsedTime * 2.1) * 0.07;
  });
  return (
    <group>
      <mesh position={[0, 0.18, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[2.35, 2.55, 0.36, 24]} />
        <meshStandardMaterial map={tex.brick} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.48, 0]} receiveShadow>
        <cylinderGeometry args={[2.05, 2.15, 0.42, 24]} />
        <meshStandardMaterial map={tex.plasterSand} roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.12, 1.92, 32]} />
        <meshStandardMaterial map={tex.cobble} bumpMap={tex.cobbleBump} bumpScale={0.12} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.74, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.1, 28]} />
        <meshStandardMaterial
          ref={water}
          map={tex.water}
          color="#8ee0f0"
          emissive="#3aa8c8"
          emissiveIntensity={0.22}
          roughness={0.12}
          metalness={0.28}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh position={[0, 1.22, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.26, 1.15, 10]} />
        <meshStandardMaterial map={tex.plasterSand} roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.82, 0]}>
        <sphereGeometry args={[0.3, 14, 12]} />
        <meshStandardMaterial color="#7ed4ea" emissive="#5ec8e0" emissiveIntensity={0.45} roughness={0.2} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[Math.sin(i * 1.1) * 0.12, 2.05 + i * 0.12, Math.cos(i * 1.3) * 0.12]}>
          <sphereGeometry args={[0.07 - i * 0.008, 8, 8]} />
          <meshStandardMaterial color="#c8f0fa" transparent opacity={0.65} />
        </mesh>
      ))}
    </group>
  );
}

function DuelTable({ x, z, tex }: { x: number; z: number; tex: PlazaTextures }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 0.4, 8]} />
        <meshStandardMaterial map={tex.wood} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.74, 0.8, 0.1, 16]} />
        <meshStandardMaterial map={tex.wood} roughness={0.55} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.64, 20]} />
        <meshStandardMaterial map={tex.felt} roughness={0.85} />
      </mesh>
    </group>
  );
}

const HOUSES: { a: number; r: number; w: number; h: number; d: number; roofKey: "clay" | "teal" | "slate" | "amber" }[] = [
  { a: 0.2, r: 24, w: 5.2, h: 6.5, d: 3.6, roofKey: "clay" },
  { a: 0.55, r: 25.5, w: 4.2, h: 8, d: 3.2, roofKey: "teal" },
  { a: 0.95, r: 24, w: 5.8, h: 5.5, d: 3.8, roofKey: "amber" },
  { a: 1.35, r: 26, w: 3.8, h: 9, d: 3.0, roofKey: "clay" },
  { a: 1.75, r: 24.5, w: 5.0, h: 7, d: 3.5, roofKey: "slate" },
  { a: 2.15, r: 25, w: 4.6, h: 6, d: 3.3, roofKey: "clay" },
  { a: 2.55, r: 24, w: 5.4, h: 8.5, d: 3.6, roofKey: "teal" },
  { a: 2.95, r: 26, w: 3.6, h: 10, d: 2.8, roofKey: "amber" },
  { a: 3.35, r: 24.5, w: 5.6, h: 6.2, d: 3.7, roofKey: "clay" },
  { a: 3.75, r: 25.5, w: 4.4, h: 7.5, d: 3.2, roofKey: "slate" },
  { a: 4.15, r: 24, w: 5.2, h: 5.8, d: 3.5, roofKey: "teal" },
  { a: 4.55, r: 26, w: 3.9, h: 9.2, d: 3.0, roofKey: "clay" },
  { a: 4.95, r: 24.5, w: 5.0, h: 6.8, d: 3.4, roofKey: "amber" },
  { a: 5.35, r: 25, w: 4.8, h: 8, d: 3.3, roofKey: "slate" },
  { a: 5.75, r: 24, w: 5.5, h: 7.2, d: 3.6, roofKey: "clay" },
  { a: 6.1, r: 25.5, w: 4.0, h: 9.5, d: 3.1, roofKey: "teal" },
];

const TREES: [number, number, number, number, number][] = [
  [-12.5, -1.5, 1.08, 0.72, 1],
  [12.5, -1.2, 0.98, 0.58, 2],
  [-12.2, 3.5, 1.18, 0.82, 3],
  [12.4, 3.8, 1.02, 0.48, 4],
  [-2.5, -13.5, 1.12, 0.78, 5],
  [2.8, -13.2, 0.92, 0.4, 6],
  [-14, 12, 1.22, 0.22, 7],
  [14, 12.2, 1.08, 0.55, 8],
  [0, 15.5, 1.18, 0.7, 9],
  [-15.5, -8, 1.02, 0.28, 10],
  [15.5, -8.2, 1.12, 0.8, 11],
  [-18, 4, 0.95, 0.35, 12],
  [18.2, 3.5, 1.05, 0.6, 13],
  [-7, -16, 0.88, 0.2, 14],
  [7.2, -16.2, 1.0, 0.75, 15],
];

const HILLS: [number, number, number, number][] = [
  [-42, -28, 14, 3.2],
  [-22, -48, 16, 3.6],
  [8, -52, 18, 4.0],
  [38, -36, 15, 3.4],
  [48, -8, 13, 3.0],
  [46, 22, 16, 3.8],
  [18, 46, 17, 3.5],
  [-16, 48, 15, 3.2],
  [-46, 18, 14, 3.4],
  [-50, -8, 12, 2.8],
];

function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: new THREE.Color("#5eb4e8") },
          uHorizon: { value: new THREE.Color("#e4f3ff") },
          uNight: { value: 0 },
        },
        vertexShader: `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vPos;
          uniform vec3 uZenith;
          uniform vec3 uHorizon;
          uniform float uNight;
          void main() {
            vec3 n = normalize(vPos);
            float h = n.y;
            vec3 col = mix(uHorizon, uZenith, smoothstep(-0.12, 0.62, h));
            float haze = smoothstep(0.08, -0.25, h);
            col = mix(col, uHorizon * 1.05, haze * 0.65);
            float star = fract(sin(dot(n.xz * 40.0, vec2(12.9898, 78.233))) * 43758.5453);
            col += vec3(0.95, 0.97, 1.0) * step(0.996, star) * uNight * smoothstep(0.1, 0.5, h);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    []
  );
  useFrame(() => {
    const w = sampleWorld();
    mat.uniforms.uZenith.value.copy(w.zenith);
    mat.uniforms.uHorizon.value.copy(w.horizon);
    mat.uniforms.uNight.value = w.night;
  });
  return (
    <mesh material={mat}>
      <sphereGeometry args={[95, 32, 20]} />
    </mesh>
  );
}

function WorldClock({
  reduced,
  grass,
  stone,
}: {
  reduced: boolean;
  grass: RefObject<THREE.MeshStandardMaterial | null>;
  stone: RefObject<THREE.MeshStandardMaterial | null>;
}) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sunBall = useRef<THREE.Mesh>(null);
  const { scene, gl } = useThree();

  useFrame((_, dt) => {
    tickClock(Math.min(dt, 0.05), reduced);
    const w = sampleWorld();
    if (sun.current) {
      sun.current.position.set(w.sunX, Math.max(6, w.sunY), w.sunZ);
      sun.current.intensity = w.sunInt;
      sun.current.color.set(w.night > 0.45 ? "#ffc48a" : "#fff2d0");
    }
    if (moon.current) {
      moon.current.position.set(-w.sunX, 16, -w.sunZ);
      moon.current.intensity = w.night * 0.62;
    }
    if (amb.current) {
      amb.current.intensity = w.ambInt;
      amb.current.color.copy(w.amb);
    }
    if (hemi.current) {
      hemi.current.intensity = w.hemiInt;
      hemi.current.color.copy(w.zenith);
      hemi.current.groundColor.copy(w.grass);
    }
    if (scene.fog && "color" in scene.fog) (scene.fog as THREE.Fog).color.copy(w.fog);
    const dim = 1 - w.night * 0.52;
    if (grass.current) grass.current.color.setRGB(dim, dim * 0.98, dim * 0.92);
    if (stone.current) stone.current.color.setRGB(dim, dim * 0.97, dim * 0.94);
    if (sunBall.current) {
      sunBall.current.position.set(w.sunX * 1.6, Math.max(8, w.sunY * 1.15) + 6, w.sunZ * 1.6);
      (sunBall.current.material as THREE.MeshBasicMaterial).color.set(w.night > 0.65 ? "#d8e4f8" : "#fff6d8");
    }
    gl.setClearColor(w.horizon, 1);
  });

  return (
    <>
      <ambientLight ref={amb} intensity={0.42} color="#fff4e0" />
      <hemisphereLight ref={hemi} args={["#8ec8f0", "#3a7a40", 0.55]} />
      <directionalLight
        ref={sun}
        castShadow
        position={[16, 22, 10]}
        intensity={2.05}
        color="#fff2d0"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={70}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-bias={-0.00028}
        shadow-radius={1.6}
        shadow-normalBias={0.04}
      />
      <directionalLight ref={moon} position={[-16, 14, -12]} intensity={0} color="#c8d8f0" />
      <mesh ref={sunBall} position={[28, 22, -30]}>
        <sphereGeometry args={[3.2, 16, 16]} />
        <meshBasicMaterial color="#fff6d8" />
      </mesh>
      <fog attach="fog" args={["#c8e0f4", 38, 92]} />
    </>
  );
}

function Lamps({ tex }: { tex: PlazaTextures }) {
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const globes = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  useFrame(() => {
    const w = sampleWorld();
    for (const l of lights.current) if (l) l.intensity = w.lamp;
    for (const g of globes.current) if (g) g.emissiveIntensity = 0.25 + w.lamp * 1.05;
  });
  const spots: [number, number][] = [
    [6.4, 6.4],
    [-6.4, 6.4],
    [6.4, -6.4],
    [-6.4, -6.4],
  ];
  return (
    <group>
      {spots.map(([x, z], i) => (
        <group key={`${x}:${z}`} position={[x, 0, z]}>
          <mesh position={[0, 1.55, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.12, 3.1, 8]} />
            <meshStandardMaterial map={tex.plasterSand} roughness={0.45} />
          </mesh>
          <mesh position={[0, 3.18, 0]}>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshStandardMaterial
              ref={(m) => { globes.current[i] = m; }}
              color="#ffe9b0"
              emissive="#ffc060"
              emissiveIntensity={0.35}
            />
          </mesh>
          <pointLight
            ref={(l) => { lights.current[i] = l; }}
            position={[0, 3.1, 0]}
            color="#ffb060"
            intensity={0}
            distance={14}
            decay={2}
          />
        </group>
      ))}
    </group>
  );
}

export function CityEnvironment({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const tex = useTex();
  const grass = useRef<THREE.MeshStandardMaterial>(null);
  const stone = useRef<THREE.MeshStandardMaterial>(null);
  if (!tex) return null;

  return (
    <>
      <color attach="background" args={["#7ec8f0"]} />
      <WorldClock reduced={reducedMotion} grass={grass} stone={stone} />
      <SkyDome />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial ref={grass} map={tex.grass} roughness={0.95} />
      </mesh>
      {HILLS.map(([hx, hz, rad, ht], i) => (
        <mesh key={i} position={[hx, ht * 0.15, hz]} scale={[rad, ht, rad]} receiveShadow>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial map={tex.grass} color="#4a9a4e" roughness={0.96} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} receiveShadow>
        <circleGeometry args={[14.2, 64]} />
        <meshStandardMaterial
          ref={stone}
          map={tex.cobble}
          bumpMap={tex.cobbleBump}
          bumpScale={0.42}
          roughness={0.78}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} receiveShadow>
        <ringGeometry args={[13.85, 14.45, 64]} />
        <meshStandardMaterial map={tex.brick} roughness={0.72} />
      </mesh>
      <Fountain tex={tex} />
      <DuelTable x={-3.4} z={0.2} tex={tex} />
      <DuelTable x={3.4} z={0.2} tex={tex} />
      <DuelTable x={0} z={3.6} tex={tex} />
      <DuelTable x={0} z={-3.4} tex={tex} />
      <Lamps tex={tex} />
      {TREES.map(([x, z, s, b, seed], i) => (
        <Tree key={i} x={x} z={z} scale={s} blossom={b} seed={seed} tex={tex} />
      ))}
      {HOUSES.map((h, i) => (
        <TownHouse key={i} {...h} tex={tex} />
      ))}
      <Cloud x={-18} y={16} z={-12} s={1.2} />
      <Cloud x={8} y={18} z={-20} s={0.9} />
      <Cloud x={22} y={15} z={8} s={1.1} />
      <Cloud x={-28} y={17} z={10} s={1} />
      <ContactShadows position={[0, 0.045, 0]} opacity={0.42} scale={38} blur={2.1} far={7} color="#142018" />
    </>
  );
}
