/*
 * simulator.c
 * Traffic generator, router simulation loop, statistics and comparisons.
 */

#include <stdio.h>
#include <string.h>
#include "simulator.h"
#include "circular_queue.h"
#include "priority_queue.h"

/* ---------- random numbers ----------
 * Our own small generator (LCG) instead of rand(), so the same seed gives the
 * same traffic on Windows, Linux and Mac, and both policies see identical packets. */
static unsigned long rngState = 1;

static void rngSeed(unsigned long s) { rngState = s ? s : 1; }

static int rngNext(int n) {                     /* random integer in 0 .. n-1 */
    rngState = (rngState * 1103515245UL + 12345UL) & 0x7fffffffUL;
    return (int)((rngState >> 8) % (unsigned long)n);
}

/* ---------- names ---------- */

const char *policyName(QueuePolicy p) {
    return p == POLICY_PRIORITY ? "Priority Queue" : "FIFO (Circular)";
}

const char *loadName(TrafficLoad l) {
    switch (l) {
        case LOAD_LIGHT:    return "Light";
        case LOAD_MODERATE: return "Moderate";
        case LOAD_HEAVY:    return "Heavy";
        default:            return "Burst";
    }
}

void defaultConfig(SimConfig *cfg) {
    cfg->bufferCapacity = 16;
    cfg->serviceRate = 2;
    cfg->ticks = 200;
    cfg->policy = POLICY_PRIORITY;
    cfg->load = LOAD_HEAVY;
    cfg->seed = 2026;
    cfg->smartDrop = 1;
    cfg->verbose = 0;
}

/* ---------- traffic generator ---------- */

/* arrival rate for this tick as a % of the router's service rate */
static int loadPercent(TrafficLoad load, int tick) {
    switch (load) {
        case LOAD_LIGHT:    return 50;
        case LOAD_MODERATE: return 90;
        case LOAD_HEAVY:    return 140;
        default:            return (tick % 30) < 10 ? 300 : 25;   /* burst */
    }
}

/* Number of packets arriving this tick.
 * Mean arrivals  lambda = serviceRate * percent / 100.
 * We run 'trials' coin flips each with probability lambda/trials (a binomial
 * draw), so arrivals vary randomly from tick to tick but average lambda. */
static int arrivalsThisTick(const SimConfig *cfg, int tick) {
    int lambda100 = cfg->serviceRate * loadPercent(cfg->load, tick);   /* lambda x 100 */
    int trials = (2 * lambda100 + 99) / 100;                           /* ceil(2*lambda) */
    int count = 0;
    if (trials < 1)
        trials = 1;
    for (int i = 0; i < trials; i++)
        if (rngNext(trials * 100) < lambda100)
            count++;
    return count;
}

/* Traffic mix: 10% VoIP, 20% video, 40% web, 30% bulk */
static Packet makePacket(int id, int tick) {
    Packet p;
    int r = rngNext(100);
    p.id = id;
    p.arrivalTick = tick;
    if (r < 10)      { p.priority = PRI_CRITICAL; p.size = 64 + rngNext(137);   }
    else if (r < 30) { p.priority = PRI_HIGH;     p.size = 1000 + rngNext(501); }
    else if (r < 70) { p.priority = PRI_NORMAL;   p.size = 200 + rngNext(1301); }
    else             { p.priority = PRI_LOW;      p.size = 1500;                }
    return p;
}

/* ---------- the simulation ---------- */

static void recordDrop(SimStats *st, const Packet *p) {
    st->dropped++;
    st->dropBy[p->priority]++;
}

int runSimulation(const SimConfig *cfg, SimStats *st) {
    CircularQueue cq;
    PriorityQueue pq;
    int usePQ = (cfg->policy == POLICY_PRIORITY);
    int nextId = 1;

    memset(st, 0, sizeof(*st));
    if (usePQ ? !pqInit(&pq, cfg->bufferCapacity) : !cqInit(&cq, cfg->bufferCapacity))
        return 0;
    rngSeed(cfg->seed);

    if (cfg->verbose)
        printf("\n  tick  arrived  dropped  sent  buffer\n");

    for (int t = 1; t <= cfg->ticks; t++) {
        int arrived = arrivalsThisTick(cfg, t);
        int droppedNow = 0, sentNow = 0, level;

        /* 1 + 2: packet arrival and buffer management */
        for (int k = 0; k < arrived; k++) {
            Packet p = makePacket(nextId++, t);
            st->generated++;
            st->genBy[p.priority]++;

            if (!usePQ) {
                if (!cqEnqueue(&cq, p)) {               /* tail drop */
                    recordDrop(st, &p);
                    droppedNow++;
                }
            } else if (!pqInsert(&pq, p)) {
                Packet lowest;
                pqPeekLowest(&pq, &lowest);
                if (cfg->smartDrop && lowest.priority < p.priority) {
                    pqRemoveLowest(&pq, &lowest);       /* push out a less important packet */
                    recordDrop(st, &lowest);
                    pqInsert(&pq, p);
                } else {
                    recordDrop(st, &p);                 /* tail drop */
                }
                droppedNow++;
            }
        }

        level = usePQ ? pq.count : cq.count;           /* buffer level after arrivals */
        st->occupancySum += level;
        if (level > st->peakOccupancy)
            st->peakOccupancy = level;
        if (droppedNow > 0)
            st->fullTicks++;

        /* 3: service - the router sends up to serviceRate packets */
        for (int k = 0; k < cfg->serviceRate; k++) {
            Packet p;
            int ok = usePQ ? pqExtractMax(&pq, &p) : cqDequeue(&cq, &p);
            if (!ok)
                break;
            int wait = t - p.arrivalTick;
            st->transmitted++;
            st->sentBy[p.priority]++;
            st->totalWait += wait;
            st->waitBy[p.priority] += wait;
            st->bytesSent += p.size;
            if (wait > st->maxWait)
                st->maxWait = wait;
            sentNow++;
        }

        if (cfg->verbose) {
            int now = usePQ ? pq.count : cq.count;
            printf("  %4d  %7d  %7d  %4d  %3d/%-3d ", t, arrived, droppedNow, sentNow,
                   now, cfg->bufferCapacity);
            int bar = cfg->bufferCapacity > 0 ? now * 30 / cfg->bufferCapacity : 0;
            printf("[");
            for (int b = 0; b < 30; b++)
                printf("%c", b < bar ? '#' : '.');
            printf("]%s\n", droppedNow ? "  DROP" : "");
        }
    }

    st->pending = usePQ ? pq.count : cq.count;
    if (usePQ) pqFree(&pq); else cqFree(&cq);
    return 1;
}

/* ---------- metrics ---------- */

double throughput(const SimConfig *cfg, const SimStats *st) {
    return cfg->ticks ? (double)st->transmitted / cfg->ticks : 0.0;
}
double dropRate(const SimStats *st) {
    return st->generated ? 100.0 * st->dropped / st->generated : 0.0;
}
double avgWait(const SimStats *st) {
    return st->transmitted ? (double)st->totalWait / st->transmitted : 0.0;
}
double avgOccupancyPct(const SimConfig *cfg, const SimStats *st) {
    return cfg->ticks ? 100.0 * st->occupancySum / ((double)cfg->ticks * cfg->bufferCapacity) : 0.0;
}
double linkUtilPct(const SimConfig *cfg, const SimStats *st) {
    return cfg->ticks ? 100.0 * st->transmitted / ((double)cfg->ticks * cfg->serviceRate) : 0.0;
}

/* ---------- printing ---------- */

void printConfig(const SimConfig *cfg) {
    printf("\n  Buffer capacity : %d packets\n", cfg->bufferCapacity);
    printf("  Service rate    : %d packets/tick\n", cfg->serviceRate);
    printf("  Duration        : %d ticks\n", cfg->ticks);
    printf("  Queue policy    : %s\n", policyName(cfg->policy));
    printf("  Traffic load    : %s\n", loadName(cfg->load));
    printf("  Random seed     : %lu\n", cfg->seed);
    printf("  Smart drop      : %s (priority policy only)\n", cfg->smartDrop ? "ON" : "OFF");
    printf("  Tick-by-tick log: %s\n", cfg->verbose ? "ON" : "OFF");
}

void printStats(const SimConfig *cfg, const SimStats *st) {
    printf("\n  ===== RESULTS: %s, %s load =====\n", policyName(cfg->policy), loadName(cfg->load));
    printf("  Packets generated   : %d\n", st->generated);
    printf("  Packets transmitted : %d\n", st->transmitted);
    printf("  Packets dropped     : %d  (drop rate %.2f%%)\n", st->dropped, dropRate(st));
    printf("  Packets pending     : %d  (still in buffer)\n", st->pending);
    printf("  Check               : %d = %d + %d + %d  %s\n", st->generated, st->transmitted,
           st->dropped, st->pending,
           st->generated == st->transmitted + st->dropped + st->pending ? "OK" : "MISMATCH");
    printf("  Throughput          : %.2f packets/tick  (%.1f KB sent)\n",
           throughput(cfg, st), st->bytesSent / 1024.0);
    printf("  Link utilisation    : %.1f%%\n", linkUtilPct(cfg, st));
    printf("  Average waiting time: %.2f ticks   (max %d)\n", avgWait(st), st->maxWait);
    printf("  Avg buffer occupancy: %.1f%%   (peak %d/%d)\n",
           avgOccupancyPct(cfg, st), st->peakOccupancy, cfg->bufferCapacity);
    printf("  Congested ticks     : %d of %d had drops\n", st->fullTicks, cfg->ticks);

    printf("\n  Per traffic class:\n");
    printf("  %-9s %-6s %9s %6s %8s %10s\n", "Priority", "Type", "Generated", "Sent", "Dropped", "Avg wait");
    for (int p = NUM_PRIORITIES - 1; p >= 0; p--) {
        double w = st->sentBy[p] ? (double)st->waitBy[p] / st->sentBy[p] : 0.0;
        printf("  %-9s %-6s %9d %6d %8d %10.2f\n", priorityName((Priority)p),
               trafficType((Priority)p), st->genBy[p], st->sentBy[p], st->dropBy[p], w);
    }
}

/* Same traffic (same seed) through both buffers, side by side */
void comparePolicies(const SimConfig *base) {
    SimConfig c[2];
    SimStats s[2];
    for (int i = 0; i < 2; i++) {
        c[i] = *base;
        c[i].verbose = 0;
        c[i].policy = (QueuePolicy)i;
        if (!runSimulation(&c[i], &s[i])) {
            printf("  Out of memory.\n");
            return;
        }
    }
    printf("\n  ===== FIFO vs PRIORITY (%s load, buffer %d, %d ticks, same traffic) =====\n",
           loadName(base->load), base->bufferCapacity, base->ticks);
    printf("  %-26s %16s %16s\n", "Metric", "FIFO (Circular)", "Priority Queue");
    printf("  %-26s %16d %16d\n", "Generated", s[0].generated, s[1].generated);
    printf("  %-26s %16d %16d\n", "Transmitted", s[0].transmitted, s[1].transmitted);
    printf("  %-26s %16d %16d\n", "Dropped", s[0].dropped, s[1].dropped);
    printf("  %-26s %15.2f%% %15.2f%%\n", "Drop rate", dropRate(&s[0]), dropRate(&s[1]));
    printf("  %-26s %16.2f %16.2f\n", "Throughput (pkts/tick)", throughput(&c[0], &s[0]), throughput(&c[1], &s[1]));
    printf("  %-26s %16.2f %16.2f\n", "Avg wait (ticks)", avgWait(&s[0]), avgWait(&s[1]));
    for (int p = NUM_PRIORITIES - 1; p >= 0; p--) {
        char label[40];
        double w0 = s[0].sentBy[p] ? (double)s[0].waitBy[p] / s[0].sentBy[p] : 0.0;
        double w1 = s[1].sentBy[p] ? (double)s[1].waitBy[p] / s[1].sentBy[p] : 0.0;
        sprintf(label, "  %s avg wait", trafficType((Priority)p));
        printf("  %-26s %16.2f %16.2f\n", label, w0, w1);
        sprintf(label, "  %s dropped", trafficType((Priority)p));
        printf("  %-26s %16d %16d\n", label, s[0].dropBy[p], s[1].dropBy[p]);
    }
    printf("\n  Same total traffic, but the priority queue sends VoIP/Video first,\n");
    printf("  so important packets wait less and are dropped less; Bulk pays the price.\n");
}

/* Every load x both policies; also saved as CSV for graphs in the report */
void compareLoads(const SimConfig *base, const char *csvFile) {
    FILE *fp = fopen(csvFile, "w");
    if (fp)
        fprintf(fp, "load,policy,generated,transmitted,dropped,drop_rate_pct,throughput,"
                    "avg_wait,voip_avg_wait,bulk_avg_wait,avg_occupancy_pct\n");

    printf("\n  ===== ALL TRAFFIC LOADS (buffer %d, service %d/tick, %d ticks) =====\n",
           base->bufferCapacity, base->serviceRate, base->ticks);
    printf("  %-9s %-16s %5s %5s %5s %7s %6s %7s %7s %7s\n", "Load", "Policy", "Gen", "Sent",
           "Drop", "Drop%", "Thru", "AvgW", "VoIP W", "Bulk W");

    for (int l = 0; l < NUM_LOADS; l++) {
        for (int p = 0; p < 2; p++) {
            SimConfig c = *base;
            SimStats s;
            c.load = (TrafficLoad)l;
            c.policy = (QueuePolicy)p;
            c.verbose = 0;
            if (!runSimulation(&c, &s)) {
                printf("  Out of memory.\n");
                if (fp) fclose(fp);
                return;
            }
            double voip = s.sentBy[PRI_CRITICAL] ? (double)s.waitBy[PRI_CRITICAL] / s.sentBy[PRI_CRITICAL] : 0.0;
            double bulk = s.sentBy[PRI_LOW] ? (double)s.waitBy[PRI_LOW] / s.sentBy[PRI_LOW] : 0.0;
            printf("  %-9s %-16s %5d %5d %5d %6.1f%% %6.2f %7.2f %7.2f %7.2f\n",
                   loadName(c.load), policyName(c.policy), s.generated, s.transmitted,
                   s.dropped, dropRate(&s), throughput(&c, &s), avgWait(&s), voip, bulk);
            if (fp)
                fprintf(fp, "%s,%s,%d,%d,%d,%.2f,%.3f,%.3f,%.3f,%.3f,%.2f\n",
                        loadName(c.load), policyName(c.policy), s.generated, s.transmitted,
                        s.dropped, dropRate(&s), throughput(&c, &s), avgWait(&s), voip, bulk,
                        avgOccupancyPct(&c, &s));
        }
    }
    if (fp) {
        fclose(fp);
        printf("\n  Saved to %s (open in Excel to make graphs for the report).\n", csvFile);
    } else {
        printf("\n  Could not write %s.\n", csvFile);
    }
}
