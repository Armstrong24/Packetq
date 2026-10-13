'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_CONFIG, LOADS, Load, Simulation, TRAFFIC_TYPES, avgWait, classWait, dropRate, runFull, throughput,
} from '@/lib/engine'
import { C_SOURCES } from '@/lib/sources'
import { CompareBars } from './Charts'

/* ---------- hero: a small live buffer that loops forever ---------- */
export function HeroVisual() {
  const ref = useRef(new Simulation({ ...DEFAULT_CONFIG, load: 'Burst', ticks: 600, seed: 7 }))
  const [, setV] = useState(0)
  const [last, setLast] = useState('')
  useEffect(() => {
    const id = setInterval(() => {
      let s = ref.current
      if (s.done) s = ref.current = new Simulation({ ...s.cfg, seed: s.cfg.seed + 1 })
      const ev = s.step()
      const sent = ev.filter(e => e.kind === 'send').pop()
      if (sent) setLast(`P${String(sent.packet.id).padStart(4, '0')} · ${TRAFFIC_TYPES[sent.packet.priority]}`)
      setV(v => v + 1)
    }, 420)
    return () => clearInterval(id)
  }, [])
  const s = ref.current
  const buf = s.buffer()
  const drops = s.history.slice(-1)[0]?.dropped ?? 0
  return (
    <div className="hero-visual" aria-label="Live router buffer animation">
      <div className="grid-bg" />
      <div className="hv-label in">INGRESS →</div>
      <div className="hv-label out">→ EGRESS</div>
      <div className="router">
        <div className="router-core">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="8" width="18" height="8" rx="2" /><path d="M7 12h.01M11 12h.01M15 12h2" /><path d="M8 8V5M16 8V5" />
          </svg>
        </div>
        <span>ROUTER</span>
        <b className={drops ? 'red' : 'green'}>{drops ? `CONGESTED · ${drops} DROPPED` : 'FORWARDING'}</b>
      </div>
      <div className="hv-card">
        <span className="pulse" /> SENDING <b>{last || '—'}</b>
        <small>priority heap · tick {String(s.tick).padStart(3, '0')}</small>
      </div>
      <div className="hv-buffer">
        <div className="hv-head"><span>BUFFER</span><b>{String(buf.length).padStart(2, '0')} / {s.cfg.bufferCapacity}</b></div>
        <div className="hv-slots">
          {Array.from({ length: s.cfg.bufferCapacity }, (_, i) => (
            <span key={i} className={buf[i] ? `p${buf[i].priority}` : ''} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- comparison across loads and policies ---------- */
export function Compare() {
  const [load, setLoad] = useState<Load>('Heavy')
  const [cap, setCap] = useState(16)
  const results = useMemo(() => LOADS.map(l => {
    const f = runFull({ ...DEFAULT_CONFIG, bufferCapacity: cap, load: l, policy: 'fifo' })
    const p = runFull({ ...DEFAULT_CONFIG, bufferCapacity: cap, load: l, policy: 'priority' })
    return { load: l, f, p }
  }), [cap])
  const sel = results.find(r => r.load === load)!
  const ticks = DEFAULT_CONFIG.ticks

  return (
    <section id="compare" className="section">
      <div className="section-label"><span>04 / POLICY COMPARISON</span></div>
      <div className="section-intro">
        <h2>Same traffic.<br />Different winners.</h2>
        <p>Both buffers receive identical packets (same seed). The link is the bottleneck either way, so throughput matches. What changes is <em>who</em> waits and <em>who</em> gets dropped.</p>
      </div>

      <div className="compare-controls">
        <div className="segmented four">
          {LOADS.map(l => <button key={l} className={load === l ? 'active' : ''} onClick={() => setLoad(l)}>{l}</button>)}
        </div>
        <label className="inline">Buffer <b>{cap}</b>
          <input type="range" min={4} max={64} value={cap} onChange={e => setCap(+e.target.value)} />
        </label>
      </div>

      <div className="analytics-grid">
        <div className="card pad">
          <div className="kicker">AVERAGE WAIT BY CLASS · {load.toUpperCase()} LOAD</div>
          <CompareBars unit=" t" rows={[3, 2, 1, 0].map(c => ({
            label: TRAFFIC_TYPES[c], cls: `p${c}`, a: classWait(sel.f.stats, c), b: classWait(sel.p.stats, c),
          }))} />
        </div>
        <div className="card pad">
          <div className="kicker">PACKETS DROPPED BY CLASS</div>
          <CompareBars unit="" rows={[3, 2, 1, 0].map(c => ({
            label: TRAFFIC_TYPES[c], cls: `p${c}`, a: sel.f.stats.dropBy[c], b: sel.p.stats.dropBy[c],
          }))} />
        </div>
      </div>

      <div className="card table-card">
        <table className="tbl wide">
          <thead>
            <tr><th>Load</th><th>Policy</th><th>Generated</th><th>Sent</th><th>Dropped</th><th>Drop %</th><th>Throughput</th><th>Avg wait</th><th>VoIP wait</th><th>Bulk wait</th></tr>
          </thead>
          <tbody>
            {results.flatMap(r => [['FIFO', r.f], ['Priority', r.p]] as const).map(([name, sim], i) => {
              const s = sim.stats
              return (
                <tr key={i} className={sim.cfg.load === load ? 'hl' : ''}>
                  <td>{sim.cfg.load}</td><td>{name}</td><td>{s.generated}</td><td>{s.transmitted}</td>
                  <td>{s.dropped}</td><td>{dropRate(s).toFixed(1)}%</td><td>{throughput(s, ticks).toFixed(2)}</td>
                  <td>{avgWait(s).toFixed(2)}</td><td>{classWait(s, 3).toFixed(2)}</td><td>{classWait(s, 0).toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="foot-note">Service rate 2 packets/tick · {ticks} ticks · seed {DEFAULT_CONFIG.seed} · smart drop on. Matches option 4 of the C program.</p>
      </div>
    </section>
  )
}

/* ---------- real C source viewer ---------- */
const NOTES: Record<string, string> = {
  'circular_queue.c': 'O(1) enqueue / dequeue · wrap-around with % capacity',
  'priority_queue.c': 'O(log n) insert / extract · binary max-heap',
  'simulator.c': 'arrival → buffer → service → stats, every tick',
  'packet.h': 'packet struct and priority levels',
  'main.c': 'menu, settings and step-by-step demo',
}

export function CodeTabs() {
  const files = Object.keys(C_SOURCES)
  const [file, setFile] = useState(files[0])
  return (
    <div className="card code-card">
      <div className="code-tabs">
        {files.map(f => <button key={f} className={f === file ? 'active' : ''} onClick={() => setFile(f)}>{f}</button>)}
      </div>
      <pre><code>{C_SOURCES[file]}</code></pre>
      <div className="code-foot"><span>✓ gcc -Wall -std=c99 · 0 warnings</span><span>{NOTES[file]}</span></div>
    </div>
  )
}
