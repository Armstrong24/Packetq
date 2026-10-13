import Simulator from '@/components/Simulator'
import { CodeTabs, Compare, HeroVisual } from '@/components/Sections'
import { SITE, TEAM } from '@/lib/site'

const FEATURES = [
  ['Packet arrival', 'A seeded traffic generator sends VoIP, Video, Web and Bulk packets at Light, Moderate, Heavy or Burst load.', 'λ = load × service rate'],
  ['Finite buffer', 'The router can hold only N packets. When bursts arrive faster than it can send, the buffer fills up.', 'capacity = 4 … 64'],
  ['Two queue policies', 'A circular queue sends oldest first. A binary max-heap sends the most important packet first.', 'O(1)  vs  O(log n)'],
  ['Drops & statistics', 'Every overflow is a drop. Throughput, waiting time, drop rate and buffer use are measured each tick.', 'gen = sent + drop + pending'],
]

const STAGES = [
  ['01', 'ARRIVE', 'Random number of packets created this tick.'],
  ['02', 'BUFFER', 'Enqueue each one; if the buffer is full, drop it.'],
  ['03', 'SCHEDULE', 'Pick the next packet: front of the ring, or root of the heap.'],
  ['04', 'TRANSMIT', 'Send up to the service rate and record waiting time.'],
  ['05', 'MEASURE', 'Update drops, throughput and buffer occupancy.'],
]

const COMPLEXITY = [
  ['Insert packet', 'O(1)', 'O(log n)'],
  ['Send next packet', 'O(1)', 'O(log n)'],
  ['Peek next', 'O(1)', 'O(1)'],
  ['Full / empty check', 'O(1)', 'O(1)'],
  ['Smart drop (remove lowest)', '—', 'O(n)'],
  ['Space', 'O(n)', 'O(n)'],
]

function Logo() {
  return (
    <a href="#top" className="logo">
      <span className="logo-mark"><span /><span /><span /></span>
      {SITE.name}
    </a>
  )
}

export default function Page() {
  return (
    <main id="top">
      <nav className="nav">
        <Logo />
        <div className="nav-links">
          <a href="#overview">Overview</a>
          <a href="#simulator">Simulator</a>
          <a href="#compare">Compare</a>
          <a href="#code">Code</a>
          <a href="#team">Team</a>
        </div>
        <a className="btn primary small" href="#simulator">Launch simulator →</a>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="section-label"><span>DATA STRUCTURES / NETWORK SYSTEMS</span></div>
          <h1>What happens when a <em>router runs out of room?</em></h1>
          <p>
            Packets arrive faster than they can leave. {SITE.name} simulates a router&apos;s limited buffer with a
            circular queue and a priority heap, so you can watch congestion build, packets drop, and see which
            traffic gets through.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href="#simulator">Run the simulation →</a>
            <a className="btn" href="#compare">See the comparison</a>
            {SITE.githubUrl && <a className="btn ghost" href={SITE.githubUrl} target="_blank" rel="noreferrer">GitHub ↗</a>}
          </div>
          <div className="hero-facts">
            <div className="stat"><span className="stat-value">02</span><span className="stat-label">QUEUE STRUCTURES</span></div>
            <div className="stat"><span className="stat-value">04</span><span className="stat-label">TRAFFIC LOADS</span></div>
            <div className="stat"><span className="stat-value">C</span><span className="stat-label">CORE ENGINE</span></div>
          </div>
        </div>
        <HeroVisual />
      </section>

      <section id="overview" className="section">
        <div className="section-label"><span>01 / SYSTEM OVERVIEW</span></div>
        <div className="section-intro">
          <h2>A router is only as<br />good as its queue.</h2>
          <p>Traffic is unpredictable. Buffer space is not. This project makes the trade-offs of packet scheduling visible and measurable.</p>
        </div>
        <div className="feature-grid">
          {FEATURES.map(([t, d, c]) => (
            <article className="feature" key={t}><h3>{t}</h3><p>{d}</p><code>{c}</code></article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-label"><span>02 / ONE TICK OF THE SIMULATION</span></div>
        <div className="section-intro">
          <h2>From ingress to egress.</h2>
          <p>Every tick repeats the same five steps. The queue policy only changes step 03.</p>
        </div>
        <div className="stages">
          {STAGES.map(([n, t, d]) => (
            <div className="stage" key={n}><span>{n}</span><b>{t}</b><p>{d}</p></div>
          ))}
        </div>
      </section>

      <Simulator />

      <Compare />

      <section id="code" className="section">
        <div className="section-label"><span>05 / UNDER THE HOOD</span></div>
        <div className="section-intro">
          <h2>The data structures<br />are the engine.</h2>
          <p>The full C source, exactly as submitted. This website runs a line-for-line TypeScript port of the same logic.</p>
        </div>
        <div className="code-layout">
          <CodeTabs />
          <div className="card pad">
            <div className="kicker">TIME & SPACE COMPLEXITY</div>
            <table className="tbl">
              <thead><tr><th>Operation</th><th>Circular</th><th>Heap</th></tr></thead>
              <tbody>{COMPLEXITY.map(([o, a, b]) => <tr key={o}><td>{o}</td><td>{a}</td><td>{b}</td></tr>)}</tbody>
            </table>
            <div className="kicker sub">HOW THE HEAP IS STORED</div>
            <p className="muted small-text">
              The heap is a complete binary tree kept in an array. Node <code>i</code> has children <code>2i+1</code> and
              <code> 2i+2</code>, and parent <code>(i−1)/2</code>. Insert sifts up; sending sifts down. Ties go to the
              older packet, so equal-priority traffic still leaves in FIFO order.
            </p>
          </div>
        </div>
      </section>

      <section id="team" className="section">
        <div className="section-label"><span>06 / TEAM</span></div>
        <div className="section-intro">
          <h2>Who built what.</h2>
          <p>{SITE.course}</p>
        </div>
        <div className="team-grid">
          {TEAM.map(m => (
            <div className="card pad member" key={m.name}>
              <div className="avatar">{m.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
              <b>{m.name}</b><span>{m.role}</span><code>{m.file}</code>
            </div>
          ))}
        </div>
      </section>

      <footer>
        <Logo />
        <span>Every packet has a path. Every queue has a cost.</span>
        <span>DATA STRUCTURES PROJECT / {SITE.year}</span>
      </footer>
    </main>
  )
}
