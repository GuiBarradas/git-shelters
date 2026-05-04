"use client";

import { OrthographicCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useLayoutEffect } from "react";

import { palette, type PaletteColor } from "@/lib/palette";

import { Cube } from "./Cube";
import { BunkerLights } from "./lights";

type BunkerSceneProps = {
  cubeColor?: PaletteColor;
};

function CameraRig() {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

export default function BunkerScene({ cubeColor }: BunkerSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ background: palette.coalBlack }}
    >
      <OrthographicCamera
        makeDefault
        position={[10, 8, 10]}
        zoom={50}
        near={0.1}
        far={1000}
      />
      <CameraRig />

      <BunkerLights />

      <Cube color={cubeColor} />

      <EffectComposer>
        <Bloom intensity={0.4} luminanceThreshold={0.85} luminanceSmoothing={0.4} />
        <Vignette darkness={0.3} offset={0.3} eskil={false} />
      </EffectComposer>
    </Canvas>
  );
}
