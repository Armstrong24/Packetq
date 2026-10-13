/*
 * simulator.h
 * Discrete-time router simulation.
 *
 * Every tick:
 *   1. ARRIVAL   - the traffic generator creates 0 or more packets
 *   2. BUFFER    - each packet is stored in the buffer; if it is full the
 *                  packet is DROPPED (congestion)
 *   3. SERVICE   - the router sends up to 'serviceRate' packets from the buffer
 *                  using the selected queue policy
 *   4. STATS     - waiting time, throughput, drops and buffer use are recorded
 */

#ifndef SIMULATOR_H
#define SIMULATOR_H

#include "packet.h"

typedef enum {
    POLICY_FIFO     = 0,    /* circular queue  */
    POLICY_PRIORITY = 1     /* priority queue  */
} QueuePolicy;

typedef enum {
    LOAD_LIGHT    = 0,      /* arrivals ~ 50% of router capacity              */
    LOAD_MODERATE = 1,      /* ~ 90%                                          */
    LOAD_HEAVY    = 2,      /* ~ 140% -> permanent congestion                 */
    LOAD_BURST    = 3       /* 10 ticks at 300%, then 20 ticks at 25%, repeat */
} TrafficLoad;

#define NUM_LOADS 4

typedef struct {
    int bufferCapacity;     /* packets the buffer can hold        */
    int serviceRate;        /* packets the router sends per tick  */
    int ticks;              /* how long the simulation runs       */
    QueuePolicy policy;
    TrafficLoad load;
    unsigned long seed;     /* same seed = same traffic, so policies are compared fairly */
    int smartDrop;          /* priority policy only: when full, drop the least
                               important packet instead of the new one          */
    int verbose;            /* print a line per tick                */
} SimConfig;

typedef struct {
    int generated;          /* packets that arrived                     */
    int transmitted;        /* packets sent by the router               */
    int dropped;            /* packets lost because the buffer was full */
    int pending;            /* still waiting in the buffer at the end   */
    long totalWait;         /* sum of waiting ticks of sent packets     */
    int maxWait;
    long bytesSent;
    long occupancySum;      /* buffer level summed over all ticks       */
    int peakOccupancy;
    int fullTicks;          /* ticks in which at least one packet was dropped */
    int genBy[NUM_PRIORITIES];
    int sentBy[NUM_PRIORITIES];
    int dropBy[NUM_PRIORITIES];
    long waitBy[NUM_PRIORITIES];
} SimStats;

void defaultConfig(SimConfig *cfg);
int  runSimulation(const SimConfig *cfg, SimStats *st);   /* 0 if out of memory */
void printConfig(const SimConfig *cfg);
void printStats(const SimConfig *cfg, const SimStats *st);
void comparePolicies(const SimConfig *cfg);
void compareLoads(const SimConfig *cfg, const char *csvFile);

const char *policyName(QueuePolicy p);
const char *loadName(TrafficLoad l);

/* metric helpers (return 0 when there is nothing to divide by) */
double throughput(const SimConfig *cfg, const SimStats *st);
double dropRate(const SimStats *st);
double avgWait(const SimStats *st);
double avgOccupancyPct(const SimConfig *cfg, const SimStats *st);
double linkUtilPct(const SimConfig *cfg, const SimStats *st);

#endif
