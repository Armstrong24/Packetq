/*
 * packet.h
 * Network Packet Buffer and Traffic Simulator (PS 9, SQ09)
 * Data Structures (BTECAD25302)
 *
 * A Packet is the element stored in both buffers:
 *   - CircularQueue  (FIFO buffer, array that wraps around)
 *   - PriorityQueue  (binary max-heap ordered by priority)
 */

#ifndef PACKET_H
#define PACKET_H

#define NUM_PRIORITIES 4

/* Higher number = more important. Each level stands for a kind of traffic. */
typedef enum {
    PRI_LOW      = 0,   /* bulk / file download */
    PRI_NORMAL   = 1,   /* web browsing         */
    PRI_HIGH     = 2,   /* video streaming      */
    PRI_CRITICAL = 3    /* voice call (VoIP)    */
} Priority;

typedef struct {
    int id;             /* increases with every new packet (also used as arrival order) */
    Priority priority;
    int size;           /* bytes                                  */
    int arrivalTick;    /* simulation tick when the packet arrived */
} Packet;

const char *priorityName(Priority p);   /* "CRITICAL", "HIGH", ... */
const char *trafficType(Priority p);    /* "VoIP", "Video", ...    */
void printPacket(const Packet *p);

#endif
