export type CraftType = "knitting" | "crochet";

export type ProjectCategory = "garment" | "amigurumi";

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

export interface AmigurumiShape {
  id: string;
  type: AmigurumiShapeType;
  name: string;
  maxDiameterInches: number;
  heightInches: number;
}

export interface CalculatedInstruction {
  stepNumber: number;
  label: string;
  instructionText: string;
  stitchCount: number;
}

export interface Project {
  id: string;
  title: string;
  craftType: CraftType;
  category: ProjectCategory;
  gauge: Gauge;
  garmentData: GarmentInputs | null;
  amigurumiShapes: AmigurumiShape[];
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
