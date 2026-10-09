import type { AmigurumiShape } from "@/lib/types/project";

const WIDTH = 240;
const GAP = 6;

const heightOf = (s: AmigurumiShape) =>
  s.type === "sphere" ? s.maxDiameterInches : s.heightInches;

export function ShapeStackPreview({ shapes }: { shapes: AmigurumiShape[] }) {
  if (shapes.length === 0) return null;
  const maxWidth = Math.max(...shapes.map((s) => s.maxDiameterInches));
  const totalHeight = shapes.reduce((sum, s) => sum + heightOf(s), 0);
  const scale = Math.min((WIDTH * 0.7) / maxWidth, 280 / totalHeight);
  const svgHeight = totalHeight * scale + GAP * (shapes.length + 1);
  const cx = WIDTH / 2;
  let y = GAP;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${svgHeight}`}
      className="mx-auto w-full max-w-60"
      role="img"
      aria-label={`Preview of ${shapes.map((s) => s.name).join(", ")}`}
    >
      {shapes.map((shape) => {
        const w = shape.maxDiameterInches * scale;
        const h = heightOf(shape) * scale;
        const top = y;
        y += h + GAP;
        const common = {
          className: "fill-accent/20 stroke-accent",
          strokeWidth: 2,
        };
        return (
          <g key={shape.id}>
            {shape.type === "sphere" && (
              <ellipse
                cx={cx}
                cy={top + h / 2}
                rx={w / 2}
                ry={h / 2}
                {...common}
              />
            )}
            {shape.type === "cylinder" && (
              <rect
                x={cx - w / 2}
                y={top}
                width={w}
                height={h}
                rx={Math.min(w, h) * 0.25}
                {...common}
              />
            )}
            {shape.type === "cone" && (
              <path
                d={`M ${cx} ${top} L ${cx + w / 2} ${top + h} L ${cx - w / 2} ${top + h} Z`}
                strokeLinejoin="round"
                {...common}
              />
            )}
            <text
              x={cx}
              y={top + h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground text-[11px]"
            >
              {shape.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
