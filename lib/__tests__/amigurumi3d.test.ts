import { describe, expect, it } from "vitest";
import { halfExtent, layoutPieces, pieceHeight } from "@/lib/amigurumi3d";
import type { AmigurumiShape, LimbAttachment } from "@/lib/types/project";

const piece = (
  id: string,
  type: AmigurumiShape["type"],
  d: number,
  h: number,
  attachment: LimbAttachment | null = null,
): AmigurumiShape => ({
  id,
  type,
  name: id,
  maxDiameterInches: d,
  heightInches: h,
  attachment,
});

const head = piece("head", "sphere", 3, 3);
const body = piece("body", "cylinder", 3, 4);
const at = (
  targetPieceId: string,
  position: LimbAttachment["position"],
  round = 6,
): LimbAttachment => ({ targetPieceId, position, round });
const byId = (l: ReturnType<typeof layoutPieces>, id: string) =>
  l.pieces.find((p) => p.shape.id === id)!;

describe("layoutPieces", () => {
  it("stacks root pieces top to bottom, touching", () => {
    const l = layoutPieces([head, body]);
    const h = byId(l, "head").position;
    const b = byId(l, "body").position;
    expect(h[0]).toBe(0);
    expect(b[1]).toBeLessThan(h[1]);
    const headBottom = h[1] - pieceHeight(head) / 2;
    const bodyTop = b[1] + pieceHeight(body) / 2;
    expect(bodyTop).toBeGreaterThanOrEqual(headBottom);
  });

  it("mirrors a pair of arms left/right at the attach round", () => {
    const l = layoutPieces([
      head,
      body,
      piece("armL", "cylinder", 1, 2.5, at("body", "side", 4)),
      piece("armR", "cylinder", 1, 2.5, at("body", "side", 4)),
    ]);
    const a = byId(l, "armL");
    const b = byId(l, "armR");
    expect(a.position[0]).toBeLessThan(-1.5);
    expect(b.position[0]).toBeCloseTo(-a.position[0]);
    expect(a.position[1]).toBeCloseTo(b.position[1]);
    expect(a.rotation[2]).toBeCloseTo(-b.rotation[2]);
    expect(a.drag).not.toBeNull();
  });

  it("moves a side piece down as its attach round grows", () => {
    const y = (round: number) =>
      byId(
        layoutPieces([
          body,
          piece("arm", "cylinder", 1, 2, at("body", "side", round)),
        ]),
        "arm",
      ).position[1];
    expect(y(8)).toBeLessThan(y(4));
  });

  it("puts ears on top, legs below, snout in front and tail behind", () => {
    const l = layoutPieces([
      head,
      body,
      piece("ear", "cone", 1, 1.2, at("head", "top")),
      piece("leg", "cylinder", 1, 1.5, at("body", "bottom")),
      piece("snout", "oval", 1.5, 1, at("head", "front")),
      piece("tail", "curved-tube", 0.8, 2, at("body", "back")),
    ]);
    const h = byId(l, "head").position;
    const b = byId(l, "body").position;
    expect(byId(l, "ear").position[1]).toBeGreaterThan(h[1] + 1);
    expect(byId(l, "leg").position[1]).toBeLessThan(b[1] - 1.5);
    expect(byId(l, "snout").position[2]).toBeGreaterThan(1);
    expect(byId(l, "tail").position[2]).toBeLessThan(-1);
    expect(byId(l, "ear").drag).toBeNull();
    expect(byId(l, "leg").drag).toBeNull();
    expect(byId(l, "snout").drag).not.toBeNull();
  });

  it("skips pieces attached to a missing target, like the 2D preview", () => {
    const l = layoutPieces([
      head,
      piece("x", "cone", 1, 1, at("nope", "side")),
    ]);
    expect(l.pieces.map((p) => p.shape.id)).toEqual(["head"]);
  });

  it("fits every piece inside the bounding sphere", () => {
    const l = layoutPieces([
      head,
      body,
      piece("ear", "cone", 1, 1.2, at("head", "top")),
      piece("leg", "cylinder", 1, 1.5, at("body", "bottom")),
    ]);
    for (const p of l.pieces) {
      const d = Math.hypot(
        p.position[0] - l.center[0],
        p.position[1] - l.center[1],
        p.position[2] - l.center[2],
      );
      expect(d).toBeLessThan(l.radius);
    }
  });
});

describe("halfExtent", () => {
  it("flattens flat pieces and narrows cones toward the tip", () => {
    const ear = piece("ear", "flat-triangle", 2, 2);
    expect(halfExtent(ear, 1).z).toBeCloseTo(0.3);
    expect(halfExtent(piece("c", "cone", 2, 2), 0.2).x).toBeLessThan(
      halfExtent(piece("c", "cone", 2, 2), 0.9).x,
    );
  });
});
