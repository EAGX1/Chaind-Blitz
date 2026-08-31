/**
 * Battle City street — textured low-poly shopping avenue.
 * Procedural street plus optional GLTF props and a drei HDRI when motion is on.
 */
import { useMemo, useRef, type RefObject } from "react";
import { ContactShadows, Environment } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sampleWorld, tickClock } from "./plazaTime";
import { getPlazaTextures, type PlazaTextures } from "./plazaTextures";
import { OptionalCityGltf } from "./OptionalCityGltf";
import { CityStreet } from "./CityStreet";

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
    <group position={[0, 0, -21.4]}>
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
      <mesh position={[0, 2.55, 0]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color="#f0d78c" emissive="#c9a227" emissiveIntensity={0.95} />
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

const TREES: [number, number, number, number, number][] = [
  [-7.55, -22, 1.08, 0.72, 1],
  [7.55, -22, 0.98, 0.58, 2],
  [-7.6, -15, 1.12, 0.82, 3],
  [7.5, -15, 1.02, 0.48, 4],
  [-7.45, 8.2, 1.18, 0.78, 5],
  [7.5, 8.4, 0.92, 0.4, 6],
  [-7.6, 24, 1.22, 0.22, 7],
  [7.55, 24.2, 1.08, 0.55, 8],
  [-7.4, 3.2, 0.95, 0.7, 9],
  [7.45, 3.0, 1.02, 0.28, 10],
  [7.4, 12.6, 1.05, 0.62, 11],
  [7.5, 17.4, 0.92, 0.35, 12],
  [7.35, 21.8, 1.12, 0.78, 13],
  [-7.4, 17.2, 1.0, 0.5, 14],
];

const HILLS: [number, number, number, number][] = [
  [-52, -32, 14, 3.2],
  [-28, -58, 16, 3.6],
  [12, -62, 18, 4.0],
  [48, -42, 15, 3.4],
  [58, -12, 13, 3.0],
  [56, 28, 16, 3.8],
  [22, 58, 17, 3.5],
  [-22, 58, 15, 3.2],
  [-56, 24, 14, 3.4],
  [-58, -14, 12, 2.8],
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
  road,
}: {
  reduced: boolean;
  grass: RefObject<THREE.MeshStandardMaterial | null>;
  stone: RefObject<THREE.MeshStandardMaterial | null>;
  road: RefObject<THREE.MeshStandardMaterial | null>;
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
    if (road.current) road.current.color.setRGB(dim * 0.92, dim * 0.92, dim * 0.95);
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
        shadow-camera-far={90}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={36}
        shadow-camera-bottom={-36}
        shadow-bias={-0.00028}
        shadow-radius={1.6}
        shadow-normalBias={0.04}
      />
      <directionalLight ref={moon} position={[-16, 14, -12]} intensity={0} color="#c8d8f0" />
      <mesh ref={sunBall} position={[28, 22, -30]}>
        <sphereGeometry args={[3.2, 16, 16]} />
        <meshBasicMaterial color="#fff6d8" />
      </mesh>
      <fog attach="fog" args={["#c8e0f4", 52, 110]} />
    </>
  );
}

export function CityEnvironment({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const tex = useTex();
  const grass = useRef<THREE.MeshStandardMaterial>(null);
  const stone = useRef<THREE.MeshStandardMaterial>(null);
  const road = useRef<THREE.MeshStandardMaterial>(null);
  if (!tex) return null;

  return (
    <>
      <color attach="background" args={["#7ec8f0"]} />
      <WorldClock reduced={reducedMotion} grass={grass} stone={stone} road={road} />
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
      <CityStreet tex={tex} sidewalkMat={stone} roadMat={road} />
      <Fountain tex={tex} />
      <DuelTable x={-6.15} z={3.2} tex={tex} />
      <DuelTable x={6.15} z={3.2} tex={tex} />
      <DuelTable x={-6.15} z={-11.2} tex={tex} />
      <DuelTable x={6.15} z={14.2} tex={tex} />
      <DuelTable x={6.15} z={20.8} tex={tex} />
      {TREES.map(([x, z, s, b, seed], i) => (
        <Tree key={i} x={x} z={z} scale={s} blossom={b} seed={seed} tex={tex} />
      ))}
      <Cloud x={-18} y={16} z={-12} s={1.2} />
      <Cloud x={8} y={18} z={-20} s={0.9} />
      <Cloud x={22} y={15} z={8} s={1.1} />
      <Cloud x={-28} y={17} z={10} s={1} />
      <ContactShadows position={[0, 0.045, 0]} opacity={0.38} scale={52} blur={2.2} far={8} color="#142018" />
      {!reducedMotion && <Environment preset="city" background={false} environmentIntensity={0.38} />}
      <OptionalCityGltf />
    </>
  );
}
