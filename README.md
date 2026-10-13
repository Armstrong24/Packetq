# Network Packet Buffer and Traffic Simulator

**Data Structures (BTECAD25302) · PS 9 · SQ09**

🌐 **Live demo:** https://packetq.vercel.app/  (interactive web version of the simulator, source in [`web/`](web/))

A C simulation of a router that receives packets, stores them in a limited-capacity buffer and sends them using a selected queue policy. It models congestion and packet drops and compares results under different traffic loads.

**Core data structures:** circular queue (FIFO buffer) and priority queue (binary max-heap).

## Files

| File | What it does |
|---|---|
| `packet.h / packet.c` | Packet struct (id, priority, size, arrival tick) and print helpers |
| `circular_queue.h / .c` | Array circular queue: enqueue, dequeue, full/empty, display with front/rear |
| `priority_queue.h / .c` | Binary max-heap: insert (sift up), extract max (sift down), remove lowest, tree display |
| `simulator.h / .c` | Traffic generator, tick-by-tick router loop, statistics, policy and load comparisons, CSV export |
| `main.c` | Menu, settings, step-by-step buffer demo |

## Build and run

```
gcc -Wall main.c packet.c circular_queue.c priority_queue.c simulator.c -o netsim
```

- Windows: `.\netsim.exe`
- Mac / Linux: `./netsim`
- VS Code: open this folder and press **Ctrl+Shift+B** (uses `.vscode/tasks.json`).
- Don't use the Code Runner ▶ button: it compiles only `main.c` and gives "undefined reference" errors.

## How the simulation works

Time runs in **ticks**. Every tick:

1. **Arrival** – the traffic generator creates a random number of packets (average = load × service rate).
2. **Buffer management** – each packet is stored; if the buffer is full the packet is **dropped**.
   With the priority policy and *smart drop* ON, a more important packet pushes out the least important one instead.
3. **Service** – the router sends up to `serviceRate` packets: oldest first (FIFO) or most important first (priority).
4. **Statistics** – waiting time = send tick − arrival tick; drops, throughput and buffer use are recorded.

**Traffic mix:** VoIP (CRITICAL) 10%, Video (HIGH) 20%, Web (NORMAL) 40%, Bulk (LOW) 30%.

**Traffic loads** (as % of router capacity): Light 50%, Moderate 90%, Heavy 140%, Burst (10 ticks at 300%, 20 ticks at 25%).

The generator uses its own seeded random function, so the same seed gives the **same packets** on every laptop and to both policies. That makes the comparison fair and the demo repeatable.

## Menu

1. Show / change settings (buffer size, service rate, ticks, policy, load, seed, smart drop, tick log)
2. Run simulation and print full statistics
3. Compare FIFO vs Priority on the same traffic
4. Compare all four loads × both policies, saved to `results.csv` for report graphs
5. Step-by-step demo: add and send packets yourself and watch both buffers change

## Statistics reported

Generated, transmitted, dropped, pending (with a check that generated = sent + dropped + pending), drop rate, throughput (packets/tick and KB), link utilisation, average and max waiting time, average and peak buffer occupancy, congested ticks, and per-class sent / dropped / average wait.

## Time and space complexity

| Operation | Circular queue | Priority queue (heap) |
|---|---|---|
| Insert packet | O(1) | O(log n) |
| Remove next packet | O(1) | O(log n) |
| Full / empty check | O(1) | O(1) |
| Peek next | O(1) | O(1) |
| Smart drop (remove lowest) | – | O(n) scan of leaves + O(log n) repair |
| Space | O(n) | O(n) |

One simulation of T ticks with A arrivals costs O(A log n) with the heap and O(A) with the circular queue (n = buffer capacity).

## Sample result (default settings, Heavy load, buffer 16, 2 packets/tick, 200 ticks, seed 2026)

| | FIFO | Priority |
|---|---|---|
| Dropped | 152 (26.9%) | 152 (26.9%) |
| Throughput | 2.00 | 2.00 |
| Avg wait | 6.37 ticks | 3.41 ticks |
| VoIP avg wait / dropped | 6.22 / 12 | 0.00 / 0 |
| Bulk avg wait / dropped | 6.34 / 38 | 54.75 / 152 |

Same throughput and total drops (the link is the bottleneck either way), but the priority queue protects VoIP and Video completely and pushes the delay and losses onto bulk traffic.

## Suggested test cases

| # | Input | Expected |
|---|---|---|
| 1 | Demo, size 3, add 3 packets | Circular queue full, rear wraps to 0 |
| 2 | Demo, add a 4th Web packet | Both buffers report overflow, packet dropped |
| 3 | Demo, buffer has a LOW packet, add CRITICAL | FIFO drops it; priority buffer pushes out the LOW packet |
| 4 | Demo, send with LOW then CRITICAL queued | FIFO sends LOW, priority sends CRITICAL |
| 5 | Demo, send from an empty buffer | Underflow message, no crash |
| 6 | Light load | 0 drops, low wait |
| 7 | Heavy load | Drops > 0, throughput = service rate, buffer near 100% |
| 8 | Compare policies, Heavy | Same drops; VoIP wait 0 with priority |
| 9 | Buffer 1, Burst, tick log ON | Drops nearly every tick |
| 10 | Letters or out-of-range menu input | "Enter a number from…" and asks again |

## Suggested split for 4 members

- **Member 1:** `circular_queue.c` (FIFO buffer, wrap-around)
- **Member 2:** `priority_queue.c` (heap, sift up/down, smart drop)
- **Member 3:** `simulator.c` (traffic generator, tick loop, statistics)
- **Member 4:** `main.c`, `packet.c`, testing, `results.csv` graphs and report screenshots
