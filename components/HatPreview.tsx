import type { HatInputs } from "@/lib/types/project";

/**
 * Silhouette preview: outline varies with crown/body/brim choices.
 * Not to scale — it's a shape guide, not a measurement chart.
 */
export function HatPreview({ inputs }: { inputs: HatInputs }) {
  const W = 200;
  const H = 150;
  const cx = W / 2;
  const bottom = H - 14;

  // Body silhouette: width and fullness by body style.
  const halfWidth = {
    fitted: 46,
    standard: 50,
    slouchy: 54,
    balloon: 62,
  }[inputs.bodyStyle];
  const crownZone = {
    fitted: 62,
    standard: 58,
    slouchy: 50,
    balloon: 46,
  }[inputs.bodyStyle];
  const top = 14;

  const brimH = { none: 4, single: 12, folded: 20 }[inputs.brimStyle];
  const brimTop = bottom - brimH;

  // Crown outline as a path from left base of crown zone to right base.
  let crown = "";
  switch (inputs.crownStyle) {
    case "dome":
      crown = `M ${cx - halfWidth} ${brimTop}
               C ${cx - halfWidth} ${top + crownZone / 2.5},
                 ${cx - halfWidth * 0.55} ${top},
                 ${cx} ${top}
               C ${cx + halfWidth * 0.55} ${top},
                 ${cx + halfWidth} ${top + crownZone / 2.5},
                 ${cx + halfWidth} ${brimTop}`;
      break;
    case "long-tail": {
      const tail = Math.min(46, (inputs.tailLengthInches ?? 5) * 6);
      crown = `M ${cx - halfWidth} ${brimTop}
               C ${cx - halfWidth} ${top + crownZone / 2},
                 ${cx - 14} ${top + 10},
                 ${cx} ${top + 8}
               C ${cx + 10} ${top + 7},
                 ${cx + 14} ${top + 16},
                 ${cx + 10} ${top + 26}
               C ${cx + 6} ${top + 26 + tail},
                 ${cx - 8} ${top + 30 + tail},
                 ${cx - 10} ${top + 24 + tail}
               L ${cx - 4} ${top + 26 + tail}
               C ${cx - 2} ${top + 18 + tail},
                 ${cx + 6} ${top + 24},
                 ${cx + halfWidth} ${brimTop}`;
      break;
    }
    case "square-cat-ear":
      crown = `M ${cx - halfWidth} ${brimTop}
               L ${cx - halfWidth} ${top + 6}
               L ${cx - halfWidth + 6} ${top}
               L ${cx + halfWidth - 6} ${top}
               L ${cx + halfWidth} ${top + 6}
               L ${cx + halfWidth} ${brimTop}`;
      break;
    case "cinch":
      crown = `M ${cx - halfWidth} ${brimTop}
               C ${cx - halfWidth} ${top + crownZone / 2.2},
                 ${cx - halfWidth * 0.4} ${top + 4},
                 ${cx} ${top + 4}
               C ${cx + halfWidth * 0.4} ${top + 4},
                 ${cx + halfWidth} ${top + crownZone / 2.2},
                 ${cx + halfWidth} ${brimTop}`;
      break;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mx-auto w-full max-w-52"
      role="img"
      aria-label={`Preview of a ${inputs.bodyStyle} hat with ${inputs.crownStyle.replace("-", " ")} crown`}
    >
      {/* body */}
      <path
        d={`${crown} L ${cx + halfWidth} ${brimTop} L ${cx - halfWidth} ${brimTop} Z`}
        fill="var(--rose)"
        fillOpacity="0.35"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* gather marks for cinch */}
      {inputs.crownStyle === "cinch" && (
        <circle cx={cx} cy={top + 6} r="5" fill="var(--accent)" />
      )}
      {/* brim */}
      {inputs.brimStyle !== "none" && (
        <rect
          x={cx - halfWidth}
          y={brimTop}
          width={halfWidth * 2}
          height={brimH}
          rx={inputs.brimStyle === "folded" ? 3 : 0}
          fill="var(--oat)"
          stroke="var(--accent)"
          strokeWidth="2"
        />
      )}
      {/* ribbing ticks */}
      {inputs.brimStyle !== "none" &&
        inputs.ribbingType !== "garter" &&
        Array.from({ length: 7 }, (_, i) => (
          <line
            key={i}
            x1={cx - halfWidth + ((i + 1) * halfWidth * 2) / 8}
            y1={brimTop + 2}
            x2={cx - halfWidth + ((i + 1) * halfWidth * 2) / 8}
            y2={bottom - 2}
            stroke="var(--accent)"
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />
        ))}
      {/* flat seam line for cat ear */}
      {inputs.crownStyle === "square-cat-ear" && (
        <line
          x1={cx - halfWidth + 6}
          y1={top + 3}
          x2={cx + halfWidth - 6}
          y2={top + 3}
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      )}
    </svg>
  );
}
