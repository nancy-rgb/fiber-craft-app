import { describe, expect, it } from "vitest";
import {
  cellAspect,
  colorAbbreviations,
  floodFill,
  generateColorworkInstructions,
  paintCell,
  proportionalRows,
  quantizeImageToGrid,
  resizeGrid,
  rowRuns,
  type PixelSource,
} from "@/lib/math/colorworkMath";
import type { YarnColor } from "@/lib/types/project";

type Rgba = [number, number, number, number?];

function image(
  width: number,
  height: number,
  pixel: (x: number, y: number) => Rgba,
): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = pixel(x, y);
      data.set([r, g, b, a], (y * width + x) * 4);
    }
  }
  return { data, width, height } as PixelSource;
}

const two: YarnColor[] = [
  { id: "w", name: "White", hex: "#ffffff" },
  { id: "k", name: "Black", hex: "#000000" },
];

describe("quantizeImageToGrid", () => {
  it("averages each block of pixels into one cell", () => {
    const img = image(4, 2, (x) => (x < 2 ? [0, 0, 0] : [255, 255, 255]));
    expect(quantizeImageToGrid(img, 2, 1, two)).toEqual([["k", "w"]]);
  });

  it("picks the perceptually nearest yarn color", () => {
    const palette: YarnColor[] = [
      { id: "cream", name: "Cream", hex: "#f4ede1" },
      { id: "navy", name: "Navy", hex: "#2f3e5c" },
      { id: "brick", name: "Brick", hex: "#b5523b" },
    ];
    const img = image(3, 1, (x) =>
      x === 0 ? [220, 30, 20] : x === 1 ? [20, 30, 120] : [250, 245, 230],
    );
    expect(quantizeImageToGrid(img, 3, 1, palette)).toEqual([
      ["brick", "navy", "cream"],
    ]);
  });

  it("blends mixed blocks toward a mid-tone when one is available", () => {
    const palette = [...two, { id: "g", name: "Gray", hex: "#777777" }];
    const img = image(2, 1, (x) => (x === 0 ? [0, 0, 0] : [255, 255, 255]));
    expect(quantizeImageToGrid(img, 1, 1, palette)).toEqual([["g"]]);
  });

  it("treats transparent pixels as white", () => {
    const img = image(2, 2, () => [0, 0, 0, 0]);
    expect(quantizeImageToGrid(img, 2, 2, two)).toEqual([
      ["w", "w"],
      ["w", "w"],
    ]);
  });

  it("upscales tiny images to the requested grid size", () => {
    const grid = quantizeImageToGrid(
      image(1, 1, () => [0, 0, 0]),
      5,
      3,
      two,
    );
    expect(grid).toHaveLength(3);
    expect(
      grid.every((row) => row.length === 5 && row.every((id) => id === "k")),
    ).toBe(true);
  });

  it("rejects fractional sizes and empty palettes", () => {
    const img = image(2, 2, () => [0, 0, 0]);
    expect(() => quantizeImageToGrid(img, 2.5, 2, two)).toThrow(RangeError);
    expect(() => quantizeImageToGrid(img, 2, 0, two)).toThrow(RangeError);
    expect(() => quantizeImageToGrid(img, 2, 2, [])).toThrow(RangeError);
  });
});

describe("generateColorworkInstructions", () => {
  const M = "w";
  const C = "k";
  // Displayed top to bottom; Row 1 is the last array.
  const grid = [
    [M, M, C, C], // Row 3
    [M, C, C, C], // Row 2
    [C, M, M, M], // Row 1
  ];

  it("reads RS rows right to left and WS rows left to right when flat", () => {
    expect(generateColorworkInstructions(grid, two, false)).toEqual([
      {
        stepNumber: 1,
        label: "Row 1 (RS)",
        instructionText: "3 MC, 1 CC",
        stitchCount: 4,
      },
      {
        stepNumber: 2,
        label: "Row 2 (WS)",
        instructionText: "1 MC, 3 CC",
        stitchCount: 4,
      },
      {
        stepNumber: 3,
        label: "Row 3 (RS)",
        instructionText: "2 CC, 2 MC",
        stitchCount: 4,
      },
    ]);
  });

  it("reads every round right to left in the round", () => {
    const steps = generateColorworkInstructions(grid, two, true);
    expect(steps.map((s) => s.label)).toEqual(["Rnd 1", "Rnd 2", "Rnd 3"]);
    expect(steps[1].instructionText).toBe("3 CC, 1 MC");
  });

  it("matches the classic written format", () => {
    const row = [...Array(8).fill(M), C, C, ...Array(4).fill(M)];
    const [step] = generateColorworkInstructions([row], two, false);
    expect(`${step.label}: ${step.instructionText}`).toBe(
      "Row 1 (RS): 4 MC, 2 CC, 8 MC",
    );
  });

  it("numbers contrast colors CC1, CC2… when there are more than two", () => {
    const three = [...two, { id: "r", name: "Red", hex: "#ff0000" }];
    expect([...colorAbbreviations(three).values()]).toEqual([
      "MC",
      "CC1",
      "CC2",
    ]);
    expect(
      generateColorworkInstructions([["r", "k", "w"]], three, false)[0]
        .instructionText,
    ).toBe("1 MC, 1 CC1, 1 CC2");
  });

  it("run counts always add up to the row width", () => {
    const wide = Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 13 }, (_, c) => ((r * c) % 3 === 0 ? M : C)),
    );
    for (let n = 1; n <= wide.length; n++) {
      const total = rowRuns(wide, n, false).reduce(
        (sum, run) => sum + run.count,
        0,
      );
      expect(total).toBe(13);
    }
  });

  it("rejects ragged grids and unknown colors", () => {
    expect(() =>
      generateColorworkInstructions([[M, M], [M]], two, false),
    ).toThrow(RangeError);
    expect(() => generateColorworkInstructions([[M, "x"]], two, false)).toThrow(
      /unknown color/,
    );
    expect(() => generateColorworkInstructions([], two, false)).toThrow(
      RangeError,
    );
  });
});

describe("drawing helpers", () => {
  it("flood fill stays inside the 4-connected region", () => {
    const grid = [
      ["a", "b", "a"],
      ["b", "a", "b"],
      ["a", "b", "a"],
    ];
    expect(floodFill(grid, 1, 1, "c")[1]).toEqual(["b", "c", "b"]);
    expect(floodFill(grid, 1, 1, "c")[0]).toEqual(["a", "b", "a"]);
    expect(
      floodFill(
        [
          ["a", "a"],
          ["a", "b"],
        ],
        0,
        0,
        "c",
      ),
    ).toEqual([
      ["c", "c"],
      ["c", "b"],
    ]);
  });

  it("returns the same grid when nothing changes", () => {
    const grid = [["a"]];
    expect(floodFill(grid, 0, 0, "a")).toBe(grid);
    expect(paintCell(grid, 0, 0, "a")).toBe(grid);
    expect(paintCell(grid, 3, 0, "b")).toBe(grid);
  });

  it("resizes anchored at the bottom-left so Row 1 stays put", () => {
    const grid = [
      ["t", "t"],
      ["b", "x"],
    ];
    expect(resizeGrid(grid, 3, 3, "f")).toEqual([
      ["f", "f", "f"],
      ["t", "t", "f"],
      ["b", "x", "f"],
    ]);
    expect(resizeGrid(grid, 1, 1, "f")).toEqual([["b"]]);
  });
});

describe("gauge-aware proportions", () => {
  const gauge = { stitchesPerInch: 6, rowsPerInch: 8 };

  it("stitch cells are wider than tall for typical knit gauge", () => {
    expect(cellAspect(gauge)).toBeCloseTo(4 / 3);
  });

  it("adds rows so a square photo stays square in fabric", () => {
    expect(proportionalRows(40, 100, 100, gauge)).toBe(53);
  });
});
