/*
 * main.c
 * Menu for the Network Packet Buffer and Traffic Simulator (PS 9, SQ09).
 *
 * Compile:  gcc -Wall main.c packet.c circular_queue.c priority_queue.c simulator.c -o netsim
 * Run:      .\netsim.exe   (Windows)      ./netsim   (Mac/Linux)
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "packet.h"
#include "circular_queue.h"
#include "priority_queue.h"
#include "simulator.h"

/* ---------- safe input (fgets avoids scanf newline problems) ---------- */

static int inputEnded = 0;

static void readLine(const char *prompt, char *buf, int size) {
    printf("%s", prompt);
    if (fgets(buf, size, stdin) == NULL) {
        buf[0] = '\0';
        inputEnded = 1;
        return;
    }
    buf[strcspn(buf, "\r\n")] = '\0';
}

/* reads a whole number between lo and hi; on end of input returns 'fallback' */
static int readInt(const char *prompt, int lo, int hi, int fallback) {
    char buf[64], *end;
    while (1) {
        readLine(prompt, buf, sizeof(buf));
        if (inputEnded)
            return fallback;
        long v = strtol(buf, &end, 10);
        if (end != buf && *end == '\0' && v >= lo && v <= hi)
            return (int)v;
        printf("  Enter a number from %d to %d.\n", lo, hi);
    }
}

/* ---------- configuration menu ---------- */

static void configure(SimConfig *cfg) {
    int ch;
    do {
        printConfig(cfg);
        printf("\n  1. Buffer capacity   2. Service rate   3. Duration\n");
        printf("  4. Queue policy      5. Traffic load   6. Random seed\n");
        printf("  7. Smart drop on/off 8. Tick log on/off 0. Back\n");
        ch = readInt("  Change: ", 0, 8, 0);
        switch (ch) {
            case 1: cfg->bufferCapacity = readInt("  Buffer capacity (1-1000): ", 1, 1000, cfg->bufferCapacity); break;
            case 2: cfg->serviceRate = readInt("  Packets sent per tick (1-50): ", 1, 50, cfg->serviceRate); break;
            case 3: cfg->ticks = readInt("  Number of ticks (1-100000): ", 1, 100000, cfg->ticks); break;
            case 4: cfg->policy = (QueuePolicy)readInt("  0 = FIFO (circular), 1 = Priority: ", 0, 1, cfg->policy); break;
            case 5: cfg->load = (TrafficLoad)readInt("  0 Light, 1 Moderate, 2 Heavy, 3 Burst: ", 0, 3, cfg->load); break;
            case 6: cfg->seed = (unsigned long)readInt("  Seed (1-999999): ", 1, 999999, (int)cfg->seed); break;
            case 7: cfg->smartDrop = !cfg->smartDrop; break;
            case 8: cfg->verbose = !cfg->verbose; break;
        }
    } while (ch != 0 && !inputEnded);
}

/* ---------- step-by-step demo of the two data structures ----------
 * Every packet you add goes into BOTH buffers, so you can see how the
 * circular queue (arrival order) and the heap (priority order) differ. */

static void manualDemo(void) {
    CircularQueue cq;
    PriorityQueue pq;
    int cap = readInt("  Buffer size for the demo (2-10): ", 2, 10, 5);
    int nextId = 1, ch;

    if (!cqInit(&cq, cap) || !pqInit(&pq, cap)) {
        printf("  Out of memory.\n");
        return;
    }
    do {
        printf("\n  --- STEP-BY-STEP BUFFER DEMO (capacity %d) ---\n", cap);
        printf("  1. Packet arrives   2. Router sends one packet   3. Show buffers   0. Back\n");
        ch = readInt("  Choice: ", 0, 3, 0);
        if (ch == 1) {
            Packet p;
            p.priority = (Priority)readInt("  Priority 0 LOW(Bulk) 1 NORMAL(Web) 2 HIGH(Video) 3 CRITICAL(VoIP): ",
                                           0, 3, 1);
            p.id = nextId++;
            p.size = 500;
            p.arrivalTick = 0;
            printf("  Arrived: ");
            printPacket(&p);
            printf("\n");
            printf("  FIFO buffer     : %s\n", cqEnqueue(&cq, p) ? "stored" : "FULL -> packet dropped (overflow)");
            if (pqInsert(&pq, p)) {
                printf("  Priority buffer : stored\n");
            } else {
                Packet low;
                pqPeekLowest(&pq, &low);
                if (low.priority < p.priority) {        /* smart drop */
                    pqRemoveLowest(&pq, &low);
                    pqInsert(&pq, p);
                    printf("  Priority buffer : FULL -> pushed out P%d (%s) to make room\n",
                           low.id, priorityName(low.priority));
                } else {
                    printf("  Priority buffer : FULL -> packet dropped (overflow)\n");
                }
            }
            cqDisplay(&cq);
            pqDisplay(&pq);
        } else if (ch == 2) {
            Packet a, b;
            if (cqDequeue(&cq, &a))
                printf("  FIFO sends     : P%d (%s) - oldest packet\n", a.id, priorityName(a.priority));
            else
                printf("  FIFO buffer empty (underflow).\n");
            if (pqExtractMax(&pq, &b))
                printf("  Priority sends : P%d (%s) - most important packet\n", b.id, priorityName(b.priority));
            else
                printf("  Priority buffer empty (underflow).\n");
            cqDisplay(&cq);
            pqDisplay(&pq);
        } else if (ch == 3) {
            cqDisplay(&cq);
            pqDisplay(&pq);
        }
    } while (ch != 0 && !inputEnded);

    cqFree(&cq);
    pqFree(&pq);
}

/* ---------- main menu ---------- */

int main(void) {
    SimConfig cfg;
    SimStats st;
    int choice;

    defaultConfig(&cfg);
    printf("\n  NETWORK PACKET BUFFER AND TRAFFIC SIMULATOR\n");
    printf("  Circular queue (FIFO) vs priority queue (max-heap) in a router buffer\n");

    do {
        printf("\n==================== MAIN MENU ====================\n");
        printf("  Policy: %s | Load: %s | Buffer: %d | Rate: %d/tick\n",
               policyName(cfg.policy), loadName(cfg.load), cfg.bufferCapacity, cfg.serviceRate);
        printf("---------------------------------------------------\n");
        printf("  1. Show / change settings\n");
        printf("  2. Run simulation\n");
        printf("  3. Compare FIFO vs Priority (same traffic)\n");
        printf("  4. Compare all traffic loads (saves results.csv)\n");
        printf("  5. Step-by-step buffer demo (add/send packets yourself)\n");
        printf("  0. Exit\n");
        printf("===================================================\n");
        choice = readInt("Enter choice: ", 0, 5, 0);

        switch (choice) {
            case 1:
                configure(&cfg);
                break;
            case 2:
                if (runSimulation(&cfg, &st))
                    printStats(&cfg, &st);
                else
                    printf("  Out of memory.\n");
                break;
            case 3:
                comparePolicies(&cfg);
                break;
            case 4:
                compareLoads(&cfg, "results.csv");
                break;
            case 5:
                manualDemo();
                break;
            case 0:
                printf("  Goodbye!\n");
                break;
        }
    } while (choice != 0 && !inputEnded);

    return 0;
}
