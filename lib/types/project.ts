/** All measurements are stored in inches. */
export type Inches = number;

export type ProjectKind = "garment" | "amigurumi";

export interface Gauge {
  stitchesPerInch: number;
  rowsPerInch: number;
}

/** "My panel measures X inches at Y stitches" (rows optional). */
export interface GaugeAdjustment {
  id: string;
  createdAt: string;
  measuredWidth: Inches;
  stitchCount: number;
  measuredHeight?: Inches;
  rowCount?: number;
  /** Gauge before this adjustment was applied. */
  previousGauge: Gauge;
  /** Gauge derived from this measurement and used from now on. */
  resultingGauge: Gauge;
}

export interface RowCounter {
  currentRow: number;
  totalRows?: number;
  updatedAt: string;
}

/**
 * A trackable piece of a project. `quantity` > 1 represents identical
 * pieces (e.g. 4 legs) for the assembly tracker.
 */
export interface ProjectPiece {
  id: string;
  name: string;
  quantity: number;
  completedCount: number;
  counter: RowCounter;
}

export type GarmentStyle = "drop-shoulder-sweater";

export interface GarmentMeasurements {
  chestWidth: Inches;
  bodyLength: Inches;
  sleeveLength: Inches;
  upperArmCircumference: Inches;
}

export type GarmentPieceRole = "front" | "back" | "sleeve";

export interface GarmentPiece extends ProjectPiece {
  role: GarmentPieceRole;
}

export type ShapePrimitive = "sphere" | "cylinder" | "cone";

export interface ShapeDimensions {
  diameter: Inches;
  /** Required for cylinders and cones; ignored for spheres. */
  height?: Inches;
}

export interface AmigurumiPiece extends ProjectPiece {
  primitive: ShapePrimitive;
  dimensions: ShapeDimensions;
}

interface ProjectBase {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  gauge: Gauge;
  activePieceId?: string;
  notes?: string;
}

export interface GarmentProject extends ProjectBase {
  kind: "garment";
  style: GarmentStyle;
  measurements: GarmentMeasurements;
  gaugeAdjustments: GaugeAdjustment[];
  pieces: GarmentPiece[];
}

export interface AmigurumiProject extends ProjectBase {
  kind: "amigurumi";
  pieces: AmigurumiPiece[];
}

export type Project = GarmentProject | AmigurumiProject;

export type PieceInput<P extends ProjectPiece> = Omit<
  P,
  "id" | "completedCount" | "counter"
> & { totalRows?: number };

export type NewGarmentProject = Pick<
  GarmentProject,
  "name" | "gauge" | "style" | "measurements" | "notes"
> & { kind: "garment"; pieces: PieceInput<GarmentPiece>[] };

export type NewAmigurumiProject = Pick<
  AmigurumiProject,
  "name" | "gauge" | "notes"
> & { kind: "amigurumi"; pieces: PieceInput<AmigurumiPiece>[] };

export type NewProject = NewGarmentProject | NewAmigurumiProject;
