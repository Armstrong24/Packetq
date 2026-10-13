'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_CONFIG, LOADS, Load, Packet, Priority, PRIORITY_NAMES, SimConfig, SimEvent, Simulation,
  TRAFFIC_TYPES, avgOccupancy, avgWait, classWait, dropRate, linkUtil, throughput,
} from '@/lib/engine'
import { HeapView, PacketCard, RingView } from './BufferView'
import { TrafficChart } from './Charts'

const pad = (n: number, w = 3) => String(n).padStart(w, '0')

function eventText(e: SimEvent) {
  const id = `P${pad(e.packet.id, 4)}`
  const pr = PRIORITY_NAMES[e.packet.priority]
  switch (e.kind) {
    case 'arrive': return { cls: '', text: `${id} ${pr} ENQUEUED` }
    case 'send': return { cls: 'green', text: `${id} ${pr} TRANSMITTED · waited ${e.wait}` }
    case 'evict': return { cls: 'amber', text: `BUFFER FULL · ${id} ${pr} PUSHED OUT` }
    default: return { cls: 'red', text: `BUFFER FULL · ${id} ${pr} DROPPED` }
  }
}

export default function Simulator() {
  const [cfg, setCfg] = useState<SimConfig>(DEFAULT_CONFIG)
  const simRef = useRef<Simulation>(new Simulation(DEFAULT_CONFIG))
  const [, setVersion] = useState(0)
  const [log, setLog] = useState<SimEvent[]>([])
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(6)
  const [picked, setPicked] = useState<Packet | null>(null)

  const sim = simRef.current
  const refresh = () => setVersion(v => v + 1)
  const pushLog = (ev: SimEvent[]) => setLog(l => [...ev.slice(-14).reverse(), ...l].slice(0, 14))

  const reset = useCallback((next: SimConfig) => {
    simRef.current = new Simulation(next)
    setLog([])
    setPicked(null)
    setRunning(false)
    refresh()
  }, [])

  const update = <K extends keyof SimConfig>(key: K, value: SimConfig[K]) => {
    const next = { ...cfg, [key]: value }
    setCfg(next)
    reset(next)
  }

  const step = useCallback(() => {
    const s = simRef.current
    if (s.done) { setRunning(false); return }
    pushLog(s.step())
    refresh()
  }, [])

  useEffect(() => {
    if (!running) return
    const id = setInterval(step, 1000 / speed)
    return () => clearInterval(id)
  }, [running, speed, step])

  const runToEnd = () => {
    const s = simRef.current
    let last: SimEvent[] = []
    while (!s.done) last = s.step()
    pushLog(last)
    setRunning(false)
    refresh()
  }

  const inject = (p: Priority) => { pushLog(sim.inject(p)); refresh() }
  const sendOne = () => { pushLog(sim.sendOne()); refresh() }

  const st = sim.stats
  const t = sim.tick
  const isPQ = cfg.policy === 'priority'
  const occ = Math.round((sim.level / cfg.bufferCapacity) * 100)

  return (
    <section id="simulator" className="section sim-section">
      <div className="section-label"><span>03 / LIVE SIMULATOR</span></div>
      <div className="sim-head">
        <h2>Run the traffic.</h2>
        <div className="chip"><span className="status-dot" /> REAL ENGINE · SAME RESULTS AS THE C PROGRAM</div>
      </div>

      <div className="sim-layout">
        <aside className="card config">
          <div className="kicker">CONFIGURATION</div>

          <label>Queue policy</label>
          <div className="segmented">
            <button className={!isPQ ? 'active' : ''} onClick={() => update('policy', 'fifo')}>Circular FIFO</button>
            <button className={isPQ ? 'active' : ''} onClick={() => update('policy', 'priority')}>Priority heap</button>
          </div>

          <label>Traffic load</label>
          <div className="segmented four">
            {LOADS.map(l => (
              <button key={l} className={cfg.load === l ? 'active' : ''} onClick={() => update('load', l as Load)}>{l}</button>
            ))}
          </div>

          <label>Buffer capacity <b>{cfg.bufferCapacity} packets</b></label>
          <input type="range" min={4} max={64} value={cfg.bufferCapacity}
            onChange={e => update('bufferCapacity', +e.target.value)} />

          <label>Service rate <b>{cfg.serviceRate} / tick</b></label>
          <input type="range" min={1} max={8} value={cfg.serviceRate}
            onChange={e => update('serviceRate', +e.target.value)} />

          <label>Duration <b>{cfg.ticks} ticks</b></label>
          <input type="range" min={50} max={1000} step={50} value={cfg.ticks}
            onChange={e => update('ticks', +e.target.value)} />

          <label>Seed <b>same seed = same packets</b></label>
          <input className="text-input" type="number" min={1} max={999999} value={cfg.seed}
            onChange={e => update('seed', Math.max(1, Math.min(999999, +e.target.value || 1)))} />

          <label className="toggle">
            <input type="checkbox" checked={cfg.smartDrop} disabled={!isPQ}
              onChange={e => update('smartDrop', e.target.checked)} />
            Smart drop <small>(full buffer pushes out a less important packet)</small>
          </label>

          <label>Animation speed <b>{speed} ticks/s</b></label>
          <input type="range" min={1} max={30} value={speed} onChange={e => setSpeed(+e.target.value)} />

          <div className="btn-row">
            <button className="btn primary" onClick={() => setRunning(r => !r)} disabled={sim.done}>
              {running ? '❚❚ Pause' : '▶ Start'}
            </button>
            <button className="btn" onClick={step} disabled={sim.done}>Step ›</button>
          </div>
          <div className="btn-row">
            <button className="btn" onClick={runToEnd} disabled={sim.done}>⚡ Run to end</button>
            <button className="btn ghost" onClick={() => reset(cfg)}>↺ Reset</button>
          </div>

          <div className="kicker sub">MANUAL (STEP-BY-STEP DEMO)</div>
          <div className="inject-grid">
            {([3, 2, 1, 0] as Priority[]).map(p => (
              <button key={p} className={`btn small p${p}-btn`} onClick={() => inject(p)}>
                + {TRAFFIC_TYPES[p]}
              </button>
            ))}
          </div>
          <button className="btn full" onClick={sendOne}>Send one packet →</button>
        </aside>

        <div className="sim-main">
          <div className="card buffer-card">
            <div className="panel-head">
              <div>
                <div className="kicker">PACKET BUFFER</div>
                <h3>{isPQ ? 'Priority queue · binary max-heap' : 'Circular queue · FIFO'} <span>· tick {pad(t)} / {cfg.ticks}</span></h3>
              </div>
              <div className="occ"><b>{sim.level}</b> / {cfg.bufferCapacity} <span className={occ >= 100 ? 'red' : occ > 70 ? 'amber' : 'green'}>{occ}%</span></div>
            </div>
            <div className="progress"><i style={{ width: `${(t / cfg.ticks) * 100}%` }} /></div>
            {isPQ ? <HeapView q={sim.pq} onPick={setPicked} /> : <RingView q={sim.cq} onPick={setPicked} />}
            <div className="send-order">
              <span>SEND ORDER</span>
              <div>
                {sim.buffer().slice(0, 16).map(p => <i key={p.id} className={`p${p.priority}`}>P{p.id}</i>)}
                {sim.level > 16 && <em>+{sim.level - 16}</em>}
                {sim.level === 0 && <em>empty</em>}
              </div>
            </div>
          </div>

          <div className="lower-grid">
            <div className="card pad">
              <div className="kicker">PACKET INSPECTOR</div>
              <PacketCard p={picked} tick={t} />
            </div>
            <div className="card pad">
              <div className="panel-head"><div className="kicker">EVENT LOG</div><span className="live"><span className="status-dot" /> {running ? 'LIVE' : 'IDLE'}</span></div>
              <div className="events">
                {log.length === 0 && <p className="muted">Press Start, Step, or inject a packet.</p>}
                {log.map((e, i) => {
                  const { cls, text } = eventText(e)
                  return <p key={i}><span>[T{pad(e.tick)}]</span> <b className={cls}>{text}</b></p>
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="metrics">
        <Stat label="GENERATED" value={st.generated} />
        <Stat label="TRANSMITTED" value={st.transmitted} />
        <Stat label="DROPPED" value={st.dropped} tone="red" />
        <Stat label="DROP RATE" value={dropRate(st).toFixed(1)} suffix="%" />
        <Stat label="THROUGHPUT" value={throughput(st, t).toFixed(2)} suffix="/tick" />
        <Stat label="AVG WAIT" value={avgWait(st).toFixed(2)} suffix=" ticks" />
        <Stat label="LINK USE" value={linkUtil(st, t, cfg.serviceRate).toFixed(0)} suffix="%" />
        <Stat label="AVG BUFFER" value={avgOccupancy(st, t, cfg.bufferCapacity).toFixed(0)} suffix="%" />
      </div>

      <div className="analytics-grid">
        <div className="card pad">
          <div className="kicker">TRAFFIC OVER TIME</div>
          <TrafficChart history={sim.history} capacity={cfg.bufferCapacity} />
        </div>
        <div className="card pad">
          <div className="kicker">PER TRAFFIC CLASS</div>
          <table className="tbl">
            <thead><tr><th>Class</th><th>Gen</th><th>Sent</th><th>Drop</th><th>Avg wait</th></tr></thead>
            <tbody>
              {[3, 2, 1, 0].map(p => (
                <tr key={p}>
                  <td><i className={`dot p${p}`} /> {TRAFFIC_TYPES[p]}</td>
                  <td>{st.genBy[p]}</td><td>{st.sentBy[p]}</td>
                  <td className={st.dropBy[p] ? 'red' : ''}>{st.dropBy[p]}</td>
                  <td>{classWait(st, p).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="check">
            generated {st.generated} = sent {st.transmitted} + dropped {st.dropped} + pending {sim.level}{' '}
            <b className={st.generated === st.transmitted + st.dropped + sim.level ? 'green' : 'red'}>
              {st.generated === st.transmitted + st.dropped + sim.level ? '✓' : '✗'}
            </b>
          </p>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value, suffix, tone }: { label: string; value: number | string; suffix?: string; tone?: string }) {
  return (
    <div className="stat">
      <span className={`stat-value ${tone ?? ''}`}>{value}{suffix && <small>{suffix}</small>}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}
