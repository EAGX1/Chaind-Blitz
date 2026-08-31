import { useEffect, useState } from "react";
import { useGLTF } from "@react-three/drei";

function LampModel({ url }: { url: string }) {
  const gltf = useGLTF(url);
  return <primitive object={gltf.scene.clone()} position={[0, 0, -8.2]} scale={1.4} />;
}

/** Loads public/city/lamp.gltf when present; otherwise renders nothing. */
export function OptionalCityGltf() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("./city/lamp.gltf")
      .then((r) => { if (live && r.ok) setUrl("./city/lamp.gltf"); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  if (!url) return null;
  return <LampModel url={url} />;
}
