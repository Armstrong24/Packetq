'use client'

import { TickSample } from '@/lib/engine'

/* Buffer level (area) + arrivals (line) + drops (red bars), last 120 ticks. Pure SVG, no library. */
export function TrafficChart({ history, capacity }: { history: TickSample[]; capacity: number }) {
  const data = history.slice(-120)
  const W = 600, H = 170
  if (data.length < 2) return <div className="chart-empty">The chart fills in as the simulation runs.</div>
  const maxY = Math.max(capacity, ...data.map(d => d.arrived), 1)
  const x = (i: number) => (i / (data.length - 1)) * W
  const y = (v: number) => H - (v / maxY) * (H - 10)
  const level = data.map((d, i) => `${x(i)},${y(d.level)}`).join(' ')
  const arrived = data.map((d, i) => `${x(i)},${y(d.arrived)}`).join(' ')
  const bw = Math.max(1.5, W / data.length - 1)
  return (
    <div>
      <div className="chart-legend">
        <span><i className="sw level" /> Buffer level</span>
        <span><i className="sw arr" /> Arrivals / tick</span>
        <span><i className="sw drop" /> Drops / tick</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" preserveAspectRatio="none">
        <line x1={0} x2={W} y1={y(capacity)} y2={y(capacity)} className="cap-line" />
        <polygon points={`0,${H} ${level} ${W},${H}`} className="area" />
        <polyline points={level} className="level-line" />
        <polyline points={arrived} className="arr-line" />
        {data.map((d, i) => d.dropped > 0 && (
          <rect key={i} x={x(i) - bw / 2} y={y(d.dropped)} width={bw} height={H - y(d.dropped)} className="drop-bar" />
        ))}
      </svg>
      <div className="axis"><span>t {data[0].tick}</span><span>capacity line = {capacity}</span><span>t {data[data.length - 1].tick}</span></div>
    </div>
  )
}

/* Horizontal grouped bars: FIFO vs Priority for each traffic class */
export function CompareBars({ rows, unit }: { rows: { label: string; a: number; b: number; cls: string }[]; unit: string }) {
  const max = Math.max(1, ...rows.flatMap(r => [r.a, r.b]))
  return (
    <div className="cbars">
      {rows.map(r => (
        <div className="cbar" key={r.label}>
          <span className="cbar-label"><i className={`dot ${r.cls}`} /> {r.label}</span>
          <div className="cbar-tracks">
            <div className="track"><i className="fifo" style={{ width: `${(r.a / max) * 100}%` }} /><em>{r.a.toFixed(2)}{unit}</em></div>
            <div className="track"><i className="prio" style={{ width: `${(r.b / max) * 100}%` }} /><em>{r.b.toFixed(2)}{unit}</em></div>
          </div>
        </div>
      ))}
      <div className="chart-legend"><span><i className="sw fifo" /> FIFO (circular)</span><span><i className="sw prio" /> Priority (heap)</span></div>
    </div>
  )
}
