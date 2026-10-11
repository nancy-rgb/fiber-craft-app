import type { GarmentPlan } from "@/lib/math/garmentMath";
import type { GarmentSection } from "@/lib/projectProgress";
import type { GarmentInputs, Gauge } from "@/lib/types/project";

const WIDTH = 300;
const PAD = 12;
const LABEL = 16;

interface GarmentPreviewProps {
  inputs: GarmentInputs;
  gauge: Gauge;
  plan: GarmentPlan;
  active: GarmentSection | null;
}

export function GarmentPreview({
  inputs,
  gauge,
  plan,
  active,
}: GarmentPreviewProps) {
  const panelW = plan.panelWidthInches;
  const bodyH = inputs.bodyLengthInches;
  const sleeveTopW = plan.sleeveTopStitches / gauge.stitchesPerInch;
  const cuffW = plan.sleeveCuffStitches / gauge.stitchesPerInch;
  const sleeveH = inputs.sleeveLengthInches;
  const scale = Math.min(
    (WIDTH - PAD * 3) / (2 * panelW),
    (WIDTH - PAD * 3) / (2 * sleeveTopW),
    320 / (bodyH + sleeveH),
  );

  const pw = panelW * scale;
  const bh = bodyH * scale;
  const neckW = (plan.neckStitches / gauge.stitchesPerInch) * scale;
  const armholeY = (plan.armholeDepthRows / gauge.rowsPerInch) * scale;
  const sw = sleeveTopW * scale;
  const cw = cuffW * scale;
  const sh = sleeveH * scale;
  const height = PAD + LABEL + bh + PAD + LABEL + sh + PAD;

  const style = (section: GarmentSection) => {
    const dimmed = active !== null && active !== section;
    return {
      className: dimmed
        ? "fill-border/40 stroke-muted"
        : "fill-rose/40 stroke-accent",
      strokeWidth: active === section ? 3 : 2,
      strokeLinejoin: "round" as const,
    };
  };

  const panel = (x: number, section: "back" | "front", neckDepth: number) => {
    const top = PAD + LABEL;
    const cx = x + pw / 2;
    const d = [
      `M ${x} ${top}`,
      `L ${cx - neckW / 2} ${top}`,
      `Q ${cx} ${top + neckDepth * 2} ${cx + neckW / 2} ${top}`,
      `L ${x + pw} ${top}`,
      `L ${x + pw} ${top + bh}`,
      `L ${x} ${top + bh}`,
      "Z",
    ].join(" ");
    return (
      <g>
        <text
          x={cx}
          y={PAD + LABEL / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground text-[11px]"
        >
          {section === "back" ? "Back" : "Front"} · {plan.panelStitches} sts
        </text>
        <path d={d} {...style(section)} />
        {[x, x + pw].map((edge) => (
          <line
            key={edge}
            x1={edge - 5}
            x2={edge + 5}
            y1={top + armholeY}
            y2={top + armholeY}
            className="stroke-foreground"
            strokeWidth={2}
          />
        ))}
      </g>
    );
  };

  const sleeve = (cx: number) => {
    const top = PAD + LABEL + bh + PAD + LABEL;
    return (
      <path
        d={`M ${cx - sw / 2} ${top} L ${cx + sw / 2} ${top} L ${cx + cw / 2} ${top + sh} L ${cx - cw / 2} ${top + sh} Z`}
        {...style("sleeve")}
      />
    );
  };

  const leftX = (WIDTH - PAD) / 2 - pw;
  const rightX = (WIDTH + PAD) / 2;
  const leftSleeve = (WIDTH - PAD) / 2 - sw / 2;
  const rightSleeve = (WIDTH + PAD) / 2 + sw / 2;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      className="mx-auto w-full max-w-72"
      role="img"
      aria-label={`Sweater pieces${active ? `, working the ${active}` : ""}`}
    >
      {panel(leftX, "back", 0.75 * scale)}
      {panel(rightX, "front", Math.min(2.5, bodyH * 0.1) * scale)}
      <text
        x={WIDTH / 2}
        y={PAD + LABEL + bh + PAD + LABEL / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-foreground text-[11px]"
      >
        Sleeves × 2 · {plan.sleeveCuffStitches} → {plan.sleeveTopStitches} sts
      </text>
      {sleeve(leftSleeve)}
      {sleeve(rightSleeve)}
    </svg>
  );
}
