export type CraftType = "knitting" | "crochet";

export type ProjectCategory =
  "garment" | "amigurumi" | "colorwork" | "hat" | "sock";

export interface Gauge {
  stitchesPerInch: number;
  rowsPerInch: number;
}

export interface GarmentInputs {
  chestWidthInches: number;
  bodyLengthInches: number;
  sleeveLengthInches: number;
  sleeveUpperArmInches: number;
  neckWidthInches: number;
  easeInches: number;
}

export type AmigurumiShapeType =
  | "sphere"
  | "cylinder"
  | "cone"
  | "oval"
  | "curved-tube"
  | "teardrop"
  | "flat-triangle"
  | "trumpet";

export type CurvatureIntensity = "slight" | "medium" | "sharp";

export type HatBrimStyle = "none" | "single" | "folded";
export type HatRibbing = "1x1" | "2x2" | "garter";
export type HatBodyStyle = "fitted" | "standard" | "slouchy" | "balloon";
export type HatCrownStyle = "dome" | "long-tail" | "square-cat-ear" | "cinch";

export interface HatInputs {
  headCircumferenceInches: number;
  brimStyle: HatBrimStyle;
  ribbingType: HatRibbing;
  bodyStyle: HatBodyStyle;
  crownStyle: HatCrownStyle;
  /** Total hat height only when crownStyle === 'long-tail'. */
  tailLengthInches?: number;
}

/** Top-down heel-flap sock. */
export interface SockInputs {
  footCircumferenceInches: number;
  /** Heel to tip of longest toe. */
  footLengthInches: number;
  /** Leg length from cast-on to the top of the heel flap (1" ankle, 6" crew). */
  cuffLengthInches: number;
  /** Negative ease as a percent of foot circumference (default 10). */
  negativeEasePercent: number;
}

export interface SafetyEyePlacement {
  eyeSizeMm: number;
  /** 1-based round the eyes sit on, counted from the magic ring. */
  eyePlacementRound: number;
  /** Stitches between the two eye posts. */
  eyeDistanceStitches: number;
}

export type FacialFeature = "nose" | "mouth" | "cheeks";

/** One band of a stripe sequence; the sequence repeats from Rnd 1. */
export interface StripeSegment {
  colorName: string;
  hex: string;
  rounds: number;
}

export type AttachmentPosition = "side" | "front" | "back" | "top" | "bottom";

export interface LimbAttachment {
  targetPieceId: string;
  /** Round on the target piece; ignored for "top" and "bottom". */
  round: number;
  position: AttachmentPosition;
}

export interface AmigurumiShape {
  id: string;
  type: AmigurumiShapeType;
  name: string;
  maxDiameterInches: number;
  heightInches: number;
  /** Oval: foundation chain length worked around both sides. */
  chainLength?: number;
  /** Curved tube: how tightly it bends. */
  curvatureIntensity?: CurvatureIntensity;
  /** Flat pieces worked in turned rows (ears, fins). */
  isFlat?: boolean;
  eyes?: SafetyEyePlacement | null;
  facialFeatures?: FacialFeature[];
  stripes?: StripeSegment[] | null;
  attachment?: LimbAttachment | null;
}

export interface YarnColor {
  id: string;
  name: string;
  hex: string;
}

export interface ColorworkGrid {
  width: number;
  height: number;
  palette: YarnColor[];
  /** cells[0] is the top chart row; Row 1 is cells[height - 1]. Values are YarnColor ids. */
  cells: string[][];
  workedInRound: boolean;
}

export interface CalculatedInstruction {
  stepNumber: number;
  label: string;
  instructionText: string;
  stitchCount: number;
  /** Yarn color for this step, e.g. the current stripe. */
  yarnColor?: { name: string; hex: string };
}

export interface Project {
  id: string;
  title: string;
  craftType: CraftType;
  category: ProjectCategory;
  gauge: Gauge;
  garmentData: GarmentInputs | null;
  hatData: HatInputs | null;
  sockData: SockInputs | null;
  amigurumiShapes: AmigurumiShape[];
  colorworkData: ColorworkGrid | null;
  instructions: CalculatedInstruction[];
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
}

export type NewProject = Omit<
  Project,
  "id" | "currentStepIndex" | "createdAt" | "updatedAt"
>;

export type ProjectUpdate = Partial<Omit<Project, "id" | "createdAt">>;
