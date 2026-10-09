import type { CalculatedInstruction } from "@/lib/types/project";

/** Separates the piece name from the round label, e.g. "Head · Rnd 3". */
export const PIECE_SEPARATOR = " · ";

/** Index of the amigurumi piece that step `index` belongs to. */
export function activePieceIndex(
  instructions: CalculatedInstruction[],
  index: number,
): number {
  let piece = 0;
  for (let i = 0; i < Math.min(index, instructions.length); i++) {
    if (instructions[i].label.endsWith(`${PIECE_SEPARATOR}Finish`)) piece++;
  }
  return piece;
}

export type GarmentSection = "back" | "front" | "sleeve";

/** Garment piece named by a step label such as "Front: shoulders". */
export function garmentSection(label: string): GarmentSection | null {
  const prefix = label.split(":")[0].trim().toLowerCase();
  return prefix === "back" || prefix === "front" || prefix === "sleeve"
    ? prefix
    : null;
}
