// Lightweight SVG chart components for the dashboard — no external deps.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// ---------- shared helpers ----------

interface Pt {
  x: number;
  y: number;
}

/** Catmull-Rom → cubic bezier smoothing. */
function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Round a max value up to a "nice" number for chart axes. */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const f = v / Math.pow(10, exp);
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * Math.pow(10, exp);
}

/** Measures an element's content box with ResizeObserver. */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

// ---------- Sparkline ----------

export function Sparkline({
  data,
  width = 120,
  height = 40,
  color = "#4f46e5",
  className = "",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const id = useId();
  if (data.length < 2) return <div style={{ width, height }} className={className} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - 3 - ((v - min) / span) * (height - 6),
  }));
  const line = smoothPath(pts);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${id}-fill)`} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={2.5} fill={color} />
    </svg>
  );
}

// ---------- Area chart ----------

export interface SeriesPoint {
  label: string;
  value: number;
  extra?: number;
}

interface AreaChartProps {
  data: SeriesPoint[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
  formatAxis?: (v: number) => string;
  formatExtra?: (v: number) => string;
  extraLabel?: string;
  emptyMessage?: string;
}

export function AreaChart({
  data,
  color = "#4f46e5",
  height = 260,
  formatValue = (v) => String(v),
  formatAxis,
  formatExtra,
  extraLabel,
  emptyMessage = "No data for this period",
}: AreaChartProps) {
  const id = useId();
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const padL = 48;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const w = Math.max(width, 10);
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;

  const maxV = niceCeil(Math.max(...data.map((d) => d.value), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxV * f);
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;

  const pts: Pt[] = data.map((d, i) => ({
    x: padL + (data.length > 1 ? i * step : innerW / 2),
    y: padT + innerH - (d.value / maxV) * innerH,
  }));
  const line = smoothPath(pts);
  const area = pts.length > 1 ? `${line} L ${pts[pts.length - 1].x} ${padT + innerH} L ${pts[0].x} ${padT + innerH} Z` : "";

  // ~6 x-axis labels evenly spaced
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));
  const fmtAxis = formatAxis ?? formatValue;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (data.length < 2) return;
    const i = Math.round((x - padL) / step);
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const hasData = data.some((d) => d.value > 0 || (d.extra ?? 0) > 0);

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }}>
      <svg
        width={w}
        height={height}
        className="block"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* gridlines + y labels */}
        {ticks.map((t, i) => {
          const y = padT + innerH - (t / maxV) * innerH;
          return (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} strokeDasharray={i === 0 ? "" : "4 4"} />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#94a3b8">
                {fmtAxis(t)}
              </text>
            </g>
          );
        })}

        {/* x labels */}
        {data.map((d, i) =>
          i % labelEvery !== 0 ? null : (
            <text key={i} x={pts[i].x} y={height - 6} textAnchor="middle" fontSize={11} fill="#94a3b8">
              {d.label}
            </text>
          ),
        )}

        {area && <path d={area} fill={`url(#${id}-area)`} />}
        <path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />

        {/* hover guide + point */}
        {hover != null && pts[hover] && (
          <g>
            <line x1={pts[hover].x} x2={pts[hover].x} y1={padT} y2={padT + innerH} stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
            <circle cx={pts[hover].x} cy={pts[hover].y} r={5} fill={color} opacity={0.18} />
            <circle cx={pts[hover].x} cy={pts[hover].y} r={3.5} fill="#fff" stroke={color} strokeWidth={2} />
          </g>
        )}
      </svg>

      {/* tooltip */}
      {hover != null && data[hover] && (
        <div
          className="absolute z-10 pointer-events-none bg-slate-900 text-white rounded-lg px-3 py-2 shadow-lg text-xs"
          style={{
            left: Math.min(Math.max(mouse.x, 70), w - 70),
            top: Math.max(pts[hover].y - 14, 8),
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-medium text-slate-300 mb-0.5 whitespace-nowrap">{data[hover].label}</p>
          <p className="font-semibold whitespace-nowrap">{formatValue(data[hover].value)}</p>
          {extraLabel && data[hover].extra != null && (
            <p className="text-slate-300 whitespace-nowrap">
              {formatExtra ? formatExtra(data[hover].extra!) : data[hover].extra} {extraLabel}
            </p>
          )}
        </div>
      )}

      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-slate-400 bg-white/80 px-3 py-1.5 rounded-lg">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}

// ---------- Donut chart ----------

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  data,
  size = 180,
  thickness = 24,
  hovered,
  onHover,
  center,
}: {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  hovered?: number | null;
  onHover?: (i: number | null) => void;
  center?: ReactNode;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - Math.max(thickness + 6, thickness)) / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
        {total > 0 && (
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {data.map((d, i) => {
              const frac = d.value / total;
              const len = Math.max(frac * C - (frac > 0 ? 2 : 0), 0);
              const off = -offset;
              offset += frac * C;
              const active = hovered === i;
              return (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={active ? thickness + 5 : thickness}
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={off}
                  style={{
                    transition: "stroke-width .18s ease, opacity .18s ease",
                    opacity: hovered == null || active ? 1 : 0.4,
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => onHover?.(i)}
                  onMouseLeave={() => onHover?.(null)}
                />
              );
            })}
          </g>
        )}
      </svg>
      {center && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {center}
        </div>
      )}
    </div>
  );
}

// ---------- Horizontal meter bar ----------

export function MeterBar({
  value,
  max,
  color = "#4f46e5",
  trackClass = "bg-slate-100",
  height = 6,
}: {
  value: number;
  max: number;
  color?: string;
  trackClass?: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={`w-full ${trackClass} rounded-full overflow-hidden`} style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}
