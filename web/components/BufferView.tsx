'use client'

import { CircularQueue, Packet, PriorityQueue, PRIORITY_NAMES, TRAFFIC_TYPES } from '@/lib/engine'

const cls = (p: Packet) => `p${p.priority}`

/* Circular queue drawn as a real ring: slot i sits at angle i/capacity * 360deg */
export function RingView({ q, onPick }: { q: CircularQueue; onPick?: (p: Packet) => void }) {
  const cap = q.capacity
  const size = cap > 40 ? 18 : cap > 24 ? 24 : 34
  return (
    <div className="ring-wrap">
      <div className="ring" style={{ ['--node' as string]: `${size}px` }}>
        {Array.from({ length: cap }, (_, i) => {
          const angle = (i / cap) * 2 * Math.PI - Math.PI / 2
          const x = 50 + 42 * Math.cos(angle)
          const y = 50 + 42 * Math.sin(angle)
          const p = q.items[i]
          const isFront = i === q.front && q.count > 0
          const isRear = i === q.rear && !q.isFull()
          return (
            <button
              key={i}
              className={`ring-node ${p ? 'filled ' + cls(p) : ''} ${isFront ? 'front' : ''} ${isRear ? 'rear' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={() => p && onPick?.(p)}
              title={p ? `P${p.id} · ${PRIORITY_NAMES[p.priority]} · slot ${i}` : `slot ${i} (empty)`}
            >
              {cap <= 24 ? (p ? p.id : i) : ''}
            </button>
          )
        })}
        <div className="ring-center">
          <b>{q.count}</b>
          <span>/ {cap}</span>
          <small>
            front {q.front} · rear {q.rear}
          </small>
        </div>
      </div>
      <div className="legend-row">
        <span><i className="dot front-dot" /> Front (next to send)</span>
        <span><i className="dot rear-dot" /> Rear (next free slot)</span>
      </div>
    </div>
  )
}

/* Priority queue drawn as the heap tree it really is, level by level */
export function HeapView({ q, onPick }: { q: PriorityQueue; onPick?: (p: Packet) => void }) {
  const levels: Packet[][] = []
  for (let start = 0; start < q.heap.length && levels.length < 5; start = 2 * start + 1) {
    levels.push(q.heap.slice(start, 2 * start + 1))
  }
  const shown = levels.reduce((n, l) => n + l.length, 0)
  return (
    <div className="heap-wrap">
      {q.heap.length === 0 && <div className="empty-note">Heap is empty. Start the simulation or inject a packet.</div>}
      {levels.map((level, li) => (
        <div className="heap-level" key={li}>
          <span className="level-tag">L{li}</span>
          <div className="heap-row" style={{ ['--slots' as string]: 2 ** li }}>
            {level.map((p, i) => (
              <button key={p.id} className={`heap-node ${cls(p)}`} onClick={() => onPick?.(p)}
                title={`index ${2 ** li - 1 + i} · P${p.id} · ${PRIORITY_NAMES[p.priority]}`}>
                {li < 4 ? `P${p.id}` : ''}
              </button>
            ))}
          </div>
        </div>
      ))}
      {q.heap.length > shown && <div className="empty-note">+{q.heap.length - shown} more nodes on deeper levels</div>}
      <div className="heap-array">
        {Array.from({ length: q.capacity }, (_, i) => {
          const p = q.heap[i]
          return <span key={i} className={p ? `filled ${cls(p)}` : ''} title={p ? `[${i}] P${p.id}` : `[${i}]`} />
        })}
      </div>
      <div className="legend-row">
        <span>Root = next to send · array index i → children 2i+1, 2i+2</span>
      </div>
    </div>
  )
}

export function PacketCard({ p, tick }: { p: Packet | null; tick: number }) {
  if (!p) return <div className="empty-note">Click any packet in the buffer to inspect it.</div>
  return (
    <div className="packet-card">
      <div className="packet-title">
        <b>P{String(p.id).padStart(4, '0')}</b>
        <span className={`tag ${cls(p)}`}>{PRIORITY_NAMES[p.priority]}</span>
      </div>
      <div className="detail-grid">
        <span>TYPE<b>{TRAFFIC_TYPES[p.priority]}</b></span>
        <span>SIZE<b>{p.size} B</b></span>
        <span>ARRIVED<b>tick {p.arrivalTick}</b></span>
        <span>WAITING<b>{Math.max(0, tick - p.arrivalTick)} ticks</b></span>
      </div>
    </div>
  )
}
