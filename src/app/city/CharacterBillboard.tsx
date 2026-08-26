import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { activeAvatar, AVATAR_CHANGED } from "../../meta/avatarCutout.js";

function planeSize(aspect: number) {
  const a = Math.max(0.28, Math.min(1.6, Number(aspect) || 0.5));
  let height = 2.18;
  let width = height * a;
  if (width > 1.52) {
    width = 1.52;
    height = width / a;
  }
  if (height < 1.45) height = 1.45;
  if (height > 2.32) height = 2.32;
  return { width, height };
}

/** Flat PNG cutout that always faces the camera. */
export function CharacterBillboard({
  groupRef,
  url,
  aspect,
}: {
  groupRef?: RefObject<THREE.Group | null>;
  url: string;
  aspect: number;
}) {
  const face = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { width, height } = useMemo(() => planeSize(aspect), [aspect]);
  const texture = useMemo(() => {
    const tex = new THREE.TextureLoader().load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }, [url]);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    if (!face.current) return;
    const y = (face.current.parent?.position.y ?? 0) + height / 2;
    face.current.lookAt(camera.position.x, y, camera.position.z);
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.5, 16]} />
        <meshBasicMaterial color="#1a3020" transparent opacity={0.28} />
      </mesh>
      <group ref={face} position={[0, height / 2, 0]}>
        <mesh>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            map={texture}
            transparent
            alphaTest={0.08}
            side={THREE.DoubleSide}
            depthWrite
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

export function usePlazaAvatar() {
  const [cutout, setCutout] = useState(() => activeAvatar());
  useEffect(() => {
    const sync = () => setCutout(activeAvatar());
    window.addEventListener(AVATAR_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AVATAR_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return cutout;
}
