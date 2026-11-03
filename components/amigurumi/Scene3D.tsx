"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import * as THREE from "three";
import {
  curveBend,
  isFlat,
  layoutPieces,
  pieceHeight,
  profileRadius,
  roundsOf,
  FLAT_DEPTH,
  type Layout3D,
  type PiecePlacement,
} from "@/lib/amigurumi3d";
import type { AmigurumiShape, Gauge } from "@/lib/types/project";

const FOV = 40;
const COLOR = "#d7a6a0"; // --rose
const DIMMED = "#d9cdbc"; // --border
const EYE = "#302a26"; // --foreground

type Controls = ComponentRef<typeof OrbitControls>;

function latheProfile(shape: AmigurumiShape, R: number, h: number) {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const f = 1 - i / 24;
    points.push(new THREE.Vector2(R * profileRadius(shape, f), h / 2 - f * h));
  }
  return points;
}

function PieceGeometry({ shape }: { shape: AmigurumiShape }) {
  const R = shape.maxDiameterInches / 2;
  const h = pieceHeight(shape);
  const lathe = useMemo(
    () =>
      shape.type === "teardrop" || shape.type === "trumpet"
        ? latheProfile(shape, R, h)
        : null,
    [shape, R, h],
  );
  const curve = useMemo(
    () =>
      shape.type === "curved-tube"
        ? new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(0, -h / 2, 0),
            new THREE.Vector3(curveBend(shape) * h, 0, 0),
            new THREE.Vector3(0, h / 2, 0),
          )
        : null,
    [shape, h],
  );
  switch (shape.type) {
    case "sphere":
      return <sphereGeometry args={[R, 32, 24]} />;
    case "oval":
      // Unit sphere, stretched by the mesh scale.
      return <sphereGeometry args={[1, 32, 24]} />;
    case "cylinder":
      return <cylinderGeometry args={[R, R, h, 32]} />;
    case "cone":
    case "flat-triangle":
      return <coneGeometry args={[R, h, 32]} />;
    case "curved-tube":
      return <tubeGeometry args={[curve!, 48, R * 0.8, 16, false]} />;
    default:
      return <latheGeometry args={[lathe!, 32]} />;
  }
}

function Eyes({
  shape,
  gauge,
}: {
  shape: AmigurumiShape;
  gauge: Gauge | null;
}) {
  if (!shape.eyes) return null;
  const h = pieceHeight(shape);
  const w = shape.maxDiameterInches;
  const f = Math.min(
    0.85,
    Math.max(0.1, shape.eyes.eyePlacementRound / roundsOf(shape, gauge)),
  );
  const gap = Math.min((shape.eyes.eyeDistanceStitches / 6) * (w / 6), w * 0.3);
  const xr = (w / 2) * profileRadius(shape, f);
  const zr =
    (shape.type === "oval" ? h / 2 : w / 2) *
    profileRadius(shape, f) *
    (isFlat(shape) ? FLAT_DEPTH : 1);
  const z = zr * Math.sqrt(Math.max(0, 1 - (gap / Math.max(xr, 0.01)) ** 2));
  const r = Math.max(0.06, shape.eyes.eyeSizeMm / 25.4 / 2);
  const y = h / 2 - f * h;
  return (
    <>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * gap, y, z * 0.97]}>
          <sphereGeometry args={[r, 16, 12]} />
          <meshStandardMaterial color={EYE} roughness={0.2} />
        </mesh>
      ))}
    </>
  );
}

function Piece({
  piece,
  gauge,
  dimmed,
  highlighted,
}: {
  piece: PiecePlacement;
  gauge: Gauge | null;
  dimmed: boolean;
  highlighted: boolean;
}) {
  const { shape } = piece;
  const flat = isFlat(shape) ? FLAT_DEPTH : 1;
  const half = pieceHeight(shape) / 2;
  const R = shape.maxDiameterInches / 2;
  const scale: [number, number, number] =
    shape.type === "oval" ? [R, half, half * flat] : [1, 1, flat];
  return (
    <group position={piece.position} rotation={piece.rotation}>
      <mesh scale={scale}>
        <PieceGeometry shape={shape} />
        <meshStandardMaterial
          color={dimmed ? DIMMED : COLOR}
          emissive={highlighted ? COLOR : "#000000"}
          emissiveIntensity={highlighted ? 0.25 : 0}
          roughness={0.9}
          transparent={dimmed}
          opacity={dimmed ? 0.45 : 1}
          side={
            shape.type === "curved-tube" ? THREE.DoubleSide : THREE.FrontSide
          }
        />
      </mesh>
      {!dimmed && <Eyes shape={shape} gauge={gauge} />}
    </group>
  );
}

/** Frames the whole model when pieces are added, removed or resized. */
function CameraRig({
  layout,
  fitKey,
  controls,
}: {
  layout: Layout3D;
  fitKey: string;
  controls: React.RefObject<Controls | null>;
}) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const latest = useRef(layout);
  useEffect(() => {
    latest.current = layout;
  });
  useEffect(() => {
    const { center, radius } = latest.current;
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(FOV / 2))) * 1.05;
    camera.position.set(center[0], center[1] + radius * 0.3, center[2] + dist);
    camera.near = dist / 100;
    camera.far = dist * 10;
    camera.updateProjectionMatrix();
    const c = controls.current;
    if (c) {
      c.target.set(...center);
      c.minDistance = radius * 1.2;
      c.maxDistance = dist * 2.5;
      c.update();
    }
    invalidate();
  }, [fitKey, camera, controls, invalidate]);
  return null;
}

function Model({ shapes, gauge = null, activeIndex }: Scene3DProps) {
  const layout = useMemo(() => layoutPieces(shapes, gauge), [shapes, gauge]);
  const controls = useRef<Controls>(null);
  // Refit when pieces are added, removed or resized, not on every attach-round edit.
  const fitKey =
    shapes
      .map(
        (s) =>
          `${s.id}:${s.type}:${s.maxDiameterInches}:${s.heightInches}:${s.attachment?.targetPieceId}:${s.attachment?.position}`,
      )
      .join("|") + `@${gauge?.stitchesPerInch}/${gauge?.rowsPerInch}`;

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} />
      {layout.pieces.map((p) => (
        <Piece
          key={p.shape.id}
          piece={p}
          gauge={gauge}
          dimmed={activeIndex !== undefined && activeIndex !== p.index}
          highlighted={activeIndex === p.index}
        />
      ))}
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        rotateSpeed={0.8}
      />
      <CameraRig layout={layout} fitKey={fitKey} controls={controls} />
    </>
  );
}

export interface Scene3DProps {
  shapes: AmigurumiShape[];
  /** Project gauge, so attach and eye rounds line up with the pattern. */
  gauge?: Gauge | null;
  /** Highlights the piece being worked; others are dimmed. */
  activeIndex?: number;
}

/**
 * Interactive 3D preview of the assembled amigurumi. Swipe to orbit 360°,
 * pinch to zoom.
 */
export function Scene3D(props: Scene3DProps) {
  if (props.shapes.length === 0) return null;
  return (
    <div
      role="img"
      aria-label={`3D preview of ${props.shapes.map((s) => s.name).join(", ")}. Swipe to rotate.`}
      className="mx-auto h-72 w-full max-w-sm overflow-hidden rounded-xl bg-oat/50"
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ fov: FOV, position: [0, 0, 10] }}
      >
        <Model {...props} />
      </Canvas>
    </div>
  );
}

export default Scene3D;
