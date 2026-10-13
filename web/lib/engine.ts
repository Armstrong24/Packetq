/*
 * engine.ts
 * TypeScript port of the C simulator (circular_queue.c, priority_queue.c, simulator.c).
 * Same random generator and same rules, so the website gives the SAME numbers
 * as the C program for the same settings and seed.
 */

export type Priority = 0 | 1 | 2 | 3 // LOW, NORMAL, HIGH, CRITICAL
export type Policy = 'fifo' | 'priority'
export type Load = 'Light' | 'Moderate' | 'Heavy' | 'Burst'

export const PRIORITY_NAMES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const
export const TRAFFIC_TYPES = ['Bulk', 'Web', 'Video', 'VoIP'] as const
export const LOADS: Load[] = ['Light', 'Moderate', 'Heavy', 'Burst']

export interface Packet {
  id: number
  priority: Priority
  size: number
  arrivalTick: number
}

/* ---------- circular queue (array, wrap-around) ---------- */
export class CircularQueue {
  items: (Packet | null)[]
  front = 0
  rear = 0
  count = 0
  constructor(public capacity: number) {
    this.items = new Array(capacity).fill(null)
  }
  isFull() { return this.count === this.capacity }
  isEmpty() { return this.count === 0 }
  enqueue(p: Packet) {
    if (this.isFull()) return false
    this.items[this.rear] = p
    this.rear = (this.rear + 1) % this.capacity
    this.count++
    return true
  }
  dequeue(): Packet | null {
    if (this.isEmpty()) return null
    const p = this.items[this.front]
    this.items[this.front] = null
    this.front = (this.front + 1) % this.capacity
    this.count--
    return p
  }
  /* packets in send order */
  ordered(): Packet[] {
    const out: Packet[] = []
    for (let k = 0; k < this.count; k++) out.push(this.items[(this.front + k) % this.capacity] as Packet)
    return out
  }
}

/* ---------- priority queue (binary max-heap) ---------- */
const moreUrgent = (a: Packet, b: Packet) =>
  a.priority !== b.priority ? a.priority > b.priority : a.id < b.id

export class PriorityQueue {
  heap: Packet[] = []
  constructor(public capacity: number) {}
  get count() { return this.heap.length }
  isFull() { return this.heap.length === this.capacity }
  isEmpty() { return this.heap.length === 0 }
  private swap(i: number, j: number) { const t = this.heap[i]; this.heap[i] = this.heap[j]; this.heap[j] = t }
  private siftUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (!moreUrgent(this.heap[i], this.heap[parent])) break
      this.swap(i, parent)
      i = parent
    }
  }
  private siftDown(i: number) {
    const n = this.heap.length
    for (;;) {
      const l = 2 * i + 1, r = 2 * i + 2
      let best = i
      if (l < n && moreUrgent(this.heap[l], this.heap[best])) best = l
      if (r < n && moreUrgent(this.heap[r], this.heap[best])) best = r
      if (best === i) break
      this.swap(i, best)
      i = best
    }
  }
  insert(p: Packet) {
    if (this.isFull()) return false
    this.heap.push(p)
    this.siftUp(this.heap.length - 1)
    return true
  }
  extractMax(): Packet | null {
    if (this.isEmpty()) return null
    const top = this.heap[0]
    const last = this.heap.pop() as Packet
    if (this.heap.length > 0) {
      this.heap[0] = last
      this.siftDown(0)
    }
    return top
  }
  private lowestIndex() {
    const n = this.heap.length
    let idx = n >> 1
    for (let i = (n >> 1) + 1; i < n; i++) if (moreUrgent(this.heap[idx], this.heap[i])) idx = i
    return idx
  }
  peekLowest(): Packet | null { return this.isEmpty() ? null : this.heap[this.lowestIndex()] }
  removeLowest(): Packet | null {
    if (this.isEmpty()) return null
    const i = this.lowestIndex()
    const out = this.heap[i]
    const last = this.heap.pop() as Packet
    if (i < this.heap.length) {
      this.heap[i] = last
      this.siftUp(i)
      this.siftDown(i)
    }
    return out
  }
  ordered(): Packet[] { return [...this.heap].sort((a, b) => (moreUrgent(a, b) ? -1 : 1)) }
}

/* ---------- random generator (same LCG as the C code) ---------- */
class Rng {
  private state: number
  constructor(seed: number) { this.state = seed ? seed & 0x7fffffff : 1 }
  next(n: number) {
    this.state = (Math.imul(this.state, 1103515245) + 12345) & 0x7fffffff
    return (this.state >>> 8) % n
  }
}

/* ---------- simulation ---------- */
export interface SimConfig {
  bufferCapacity: number
  serviceRate: number
  ticks: number
  policy: Policy
  load: Load
  seed: number
  smartDrop: boolean
}

export const DEFAULT_CONFIG: SimConfig = {
  bufferCapacity: 16,
  serviceRate: 2,
  ticks: 200,
  policy: 'priority',
  load: 'Heavy',
  seed: 2026,
  smartDrop: true,
}

export interface SimStats {
  generated: number
  transmitted: number
  dropped: number
  totalWait: number
  maxWait: number
  bytesSent: number
  occupancySum: number
  peakOccupancy: number
  fullTicks: number
  genBy: number[]
  sentBy: number[]
  dropBy: number[]
  waitBy: number[]
}

export type EventKind = 'arrive' | 'drop' | 'evict' | 'send'
export interface SimEvent { tick: number; kind: EventKind; packet: Packet; wait?: number }
export interface TickSample { tick: number; arrived: number; sent: number; dropped: number; level: number }

const emptyStats = (): SimStats => ({
  generated: 0, transmitted: 0, dropped: 0, totalWait: 0, maxWait: 0, bytesSent: 0,
  occupancySum: 0, peakOccupancy: 0, fullTicks: 0,
  genBy: [0, 0, 0, 0], sentBy: [0, 0, 0, 0], dropBy: [0, 0, 0, 0], waitBy: [0, 0, 0, 0],
})

export function loadPercent(load: Load, tick: number) {
  switch (load) {
    case 'Light': return 50
    case 'Moderate': return 90
    case 'Heavy': return 140
    default: return tick % 30 < 10 ? 300 : 25
  }
}

export class Simulation {
  cq: CircularQueue
  pq: PriorityQueue
  stats = emptyStats()
  tick = 0
  history: TickSample[] = []
  private rng: Rng
  private nextId = 1

  constructor(public cfg: SimConfig) {
    this.cq = new CircularQueue(cfg.bufferCapacity)
    this.pq = new PriorityQueue(cfg.bufferCapacity)
    this.rng = new Rng(cfg.seed)
  }

  get level() { return this.cfg.policy === 'priority' ? this.pq.count : this.cq.count }
  get done() { return this.tick >= this.cfg.ticks }
  buffer(): Packet[] { return this.cfg.policy === 'priority' ? this.pq.ordered() : this.cq.ordered() }

  private arrivals(t: number) {
    const lambda100 = this.cfg.serviceRate * loadPercent(this.cfg.load, t)
    const trials = Math.max(1, Math.floor((2 * lambda100 + 99) / 100))
    let count = 0
    for (let i = 0; i < trials; i++) if (this.rng.next(trials * 100) < lambda100) count++
    return count
  }

  private makePacket(t: number): Packet {
    const r = this.rng.next(100)
    const id = this.nextId++
    if (r < 10) return { id, arrivalTick: t, priority: 3, size: 64 + this.rng.next(137) }
    if (r < 30) return { id, arrivalTick: t, priority: 2, size: 1000 + this.rng.next(501) }
    if (r < 70) return { id, arrivalTick: t, priority: 1, size: 200 + this.rng.next(1301) }
    return { id, arrivalTick: t, priority: 0, size: 1500 }
  }

  private drop(p: Packet) {
    this.stats.dropped++
    this.stats.dropBy[p.priority]++
  }

  /* put one packet in the buffer, handling overflow; returns the events */
  private admit(p: Packet, t: number, events: SimEvent[]) {
    const s = this.stats
    s.generated++
    s.genBy[p.priority]++
    if (this.cfg.policy === 'fifo') {
      if (this.cq.enqueue(p)) events.push({ tick: t, kind: 'arrive', packet: p })
      else { this.drop(p); events.push({ tick: t, kind: 'drop', packet: p }); return 1 }
      return 0
    }
    if (this.pq.insert(p)) { events.push({ tick: t, kind: 'arrive', packet: p }); return 0 }
    const lowest = this.pq.peekLowest() as Packet
    if (this.cfg.smartDrop && lowest.priority < p.priority) {
      this.pq.removeLowest()
      this.drop(lowest)
      this.pq.insert(p)
      events.push({ tick: t, kind: 'evict', packet: lowest })
      events.push({ tick: t, kind: 'arrive', packet: p })
    } else {
      this.drop(p)
      events.push({ tick: t, kind: 'drop', packet: p })
    }
    return 1
  }

  /* one tick: arrivals -> buffer -> service -> stats */
  step(): SimEvent[] {
    if (this.done) return []
    const t = ++this.tick
    const s = this.stats
    const events: SimEvent[] = []
    const arrived = this.arrivals(t)
    let droppedNow = 0
    for (let k = 0; k < arrived; k++) droppedNow += this.admit(this.makePacket(t), t, events)

    const level = this.level
    s.occupancySum += level
    if (level > s.peakOccupancy) s.peakOccupancy = level
    if (droppedNow > 0) s.fullTicks++

    let sent = 0
    for (let k = 0; k < this.cfg.serviceRate; k++) {
      const p = this.cfg.policy === 'priority' ? this.pq.extractMax() : this.cq.dequeue()
      if (!p) break
      const wait = t - p.arrivalTick
      s.transmitted++
      s.sentBy[p.priority]++
      s.totalWait += wait
      s.waitBy[p.priority] += wait
      s.bytesSent += p.size
      if (wait > s.maxWait) s.maxWait = wait
      events.push({ tick: t, kind: 'send', packet: p, wait })
      sent++
    }
    this.history.push({ tick: t, arrived, sent, dropped: droppedNow, level: this.level })
    return events
  }

  /* manual packet injection (step-by-step demo); does not use the random generator */
  inject(priority: Priority): SimEvent[] {
    const events: SimEvent[] = []
    const sizes = [1500, 800, 1200, 120]
    this.admit({ id: this.nextId++, priority, size: sizes[priority], arrivalTick: this.tick }, this.tick, events)
    return events
  }

  /* manual send of one packet (step-by-step demo) */
  sendOne(): SimEvent[] {
    const p = this.cfg.policy === 'priority' ? this.pq.extractMax() : this.cq.dequeue()
    if (!p) return []
    const s = this.stats
    const wait = this.tick - p.arrivalTick
    s.transmitted++
    s.sentBy[p.priority]++
    s.totalWait += wait
    s.waitBy[p.priority] += wait
    s.bytesSent += p.size
    if (wait > s.maxWait) s.maxWait = wait
    return [{ tick: this.tick, kind: 'send', packet: p, wait }]
  }

  run() { while (!this.done) this.step(); return this }
}

/* ---------- metrics ---------- */
export const pending = (sim: Simulation) => sim.level
export const throughput = (s: SimStats, ticks: number) => (ticks ? s.transmitted / ticks : 0)
export const dropRate = (s: SimStats) => (s.generated ? (100 * s.dropped) / s.generated : 0)
export const avgWait = (s: SimStats) => (s.transmitted ? s.totalWait / s.transmitted : 0)
export const classWait = (s: SimStats, p: number) => (s.sentBy[p] ? s.waitBy[p] / s.sentBy[p] : 0)
export const avgOccupancy = (s: SimStats, ticks: number, cap: number) =>
  ticks ? (100 * s.occupancySum) / (ticks * cap) : 0
export const linkUtil = (s: SimStats, ticks: number, rate: number) =>
  ticks ? (100 * s.transmitted) / (ticks * rate) : 0

export function runFull(cfg: SimConfig) {
  return new Simulation(cfg).run()
}
