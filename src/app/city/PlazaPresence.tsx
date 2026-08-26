/** Static local greeters — unique silhouettes, no plazaNet / no online presence. */
const GREETERS: {
  id: string;
  poi: string;
  x: number;
  z: number;
  yaw: number;
  kind: "vendor" | "stylist" | "keeper" | "marshal";
}[] = [
  { id: "vendor", poi: "pack_shop", x: -5.55, z: -2.35, yaw: 0.55, kind: "vendor" },
  { id: "stylist", poi: "boutique", x: 5.55, z: -2.35, yaw: -0.55, kind: "stylist" },
  { id: "keeper", poi: "solo_gates", x: -5.55, z: 6.15, yaw: 2.55, kind: "keeper" },
  { id: "marshal", poi: "coliseum", x: 5.55, z: 6.15, yaw: -2.55, kind: "marshal" },
];

function Shadow() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <circleGeometry args={[0.42, 16]} />
      <meshBasicMaterial color="#1a3020" transparent opacity={0.28} />
    </mesh>
  );
}

/** Stocky pack merchant — crate + visor, navy/gold. */
function Vendor() {
  return (
    <group>
      <Shadow />
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.52, 0.72, 0.36]} />
        <meshStandardMaterial color="#1c2a44" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.38, 0.2]} castShadow>
        <boxGeometry args={[0.46, 0.38, 0.08]} />
        <meshStandardMaterial color="#c9a227" roughness={0.4} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.96, 0]} castShadow>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color="#e8c8a8" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.1, 0.04]} castShadow>
        <boxGeometry args={[0.34, 0.1, 0.28]} />
        <meshStandardMaterial color="#8a6a12" roughness={0.45} />
      </mesh>
      <mesh position={[0.42, 0.18, 0.12]} castShadow>
        <boxGeometry args={[0.28, 0.22, 0.22]} />
        <meshStandardMaterial color="#6a4a22" roughness={0.7} />
      </mesh>
      <mesh position={[0.42, 0.32, 0.12]}>
        <boxGeometry args={[0.22, 0.06, 0.16]} />
        <meshStandardMaterial color="#c9a227" roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Slim boutique stylist — wide hat + teal cape. */
function Stylist() {
  return (
    <group>
      <Shadow />
      <mesh position={[0, 0.62, 0]} castShadow>
        <capsuleGeometry args={[0.12, 0.72, 4, 8]} />
        <meshStandardMaterial color="#2a6a78" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.58, -0.08]} rotation={[0.15, 0, 0]} castShadow>
        <boxGeometry args={[0.42, 0.7, 0.08]} />
        <meshStandardMaterial color="#3aa0c8" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color="#f0d8c0" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.28, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.05, 16]} />
        <meshStandardMaterial color="#d8ecf4" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.22, 8]} />
        <meshStandardMaterial color="#3aa0c8" roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Hooded gatekeeper — robe + green halo. */
function Keeper() {
  return (
    <group>
      <Shadow />
      <mesh position={[0, 0.55, 0]} castShadow>
        <coneGeometry args={[0.32, 1.05, 8]} />
        <meshStandardMaterial color="#1a3a28" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color="#c8b090" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.18, 0]} rotation={[0.2, 0, 0]} castShadow>
        <coneGeometry args={[0.22, 0.38, 8]} />
        <meshStandardMaterial color="#2a6a48" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.03, 6, 16]} />
        <meshStandardMaterial color="#6bcb77" emissive="#6bcb77" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0.28, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 1.15, 6]} />
        <meshStandardMaterial color="#8a6a12" roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Coliseum marshal — pauldrons + banner, crimson/gold. */
function Marshal() {
  return (
    <group>
      <Shadow />
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.4, 0.95, 0.28]} />
        <meshStandardMaterial color="#8a3228" roughness={0.5} />
      </mesh>
      <mesh position={[-0.28, 0.88, 0]} castShadow>
        <boxGeometry args={[0.18, 0.22, 0.26]} />
        <meshStandardMaterial color="#c9a227" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0.28, 0.88, 0]} castShadow>
        <boxGeometry args={[0.18, 0.22, 0.26]} />
        <meshStandardMaterial color="#c9a227" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.48, 0.16]}>
        <boxGeometry args={[0.22, 0.08, 0.04]} />
        <meshStandardMaterial color="#c9a227" roughness={0.35} metalness={0.35} />
      </mesh>
      <mesh position={[0, 1.16, 0]} castShadow>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color="#e8c8a8" roughness={0.55} />
      </mesh>
      <mesh position={[0.34, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.035, 1.55, 6]} />
        <meshStandardMaterial color="#3a2a18" roughness={0.6} />
      </mesh>
      <mesh position={[0.48, 1.35, 0]} castShadow>
        <boxGeometry args={[0.28, 0.36, 0.04]} />
        <meshStandardMaterial color="#c45a3a" roughness={0.45} />
      </mesh>
    </group>
  );
}

function GreeterMesh({ kind }: { kind: (typeof GREETERS)[number]["kind"] }) {
  if (kind === "vendor") return <Vendor />;
  if (kind === "stylist") return <Stylist />;
  if (kind === "keeper") return <Keeper />;
  return <Marshal />;
}

export function PlazaPresence({ enabled: _enabled }: { enabled?: boolean }) {
  void _enabled;
  return (
    <group>
      {GREETERS.map((g) => (
        <group key={g.id} position={[g.x, 0, g.z]} rotation={[0, g.yaw, 0]}>
          <GreeterMesh kind={g.kind} />
        </group>
      ))}
    </group>
  );
}
