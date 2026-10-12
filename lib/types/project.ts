export type CraftType = "knitting" | "crochet";

export type ProjectCategory = "garment" | "amigurumi" | "colorwork" | "hat";

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

export type AmigurumiShapeType = "sphere" | "cylinder" | "cone";

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
