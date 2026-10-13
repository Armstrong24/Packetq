/*
 * priority_queue.h
 * Fixed-capacity priority buffer implemented as a BINARY MAX-HEAP stored in an array.
 *
 *   For the node at index i:
 *       parent = (i - 1) / 2
 *       left   = 2*i + 1
 *       right  = 2*i + 2
 *
 *   Heap rule: every parent is "more urgent" than its children, so the most
 *   urgent packet is always at index 0.
 *   "More urgent" = higher priority; if priorities are equal, the packet that
 *   arrived first (smaller id) wins, so equal packets still leave in FIFO order.
 *
 *   insert / extract are O(log n) instead of O(n) for a sorted array.
 */

#ifndef PRIORITY_QUEUE_H
#define PRIORITY_QUEUE_H

#include "packet.h"

typedef struct {
    Packet *heap;
    int capacity;
    int count;
} PriorityQueue;

int  pqInit(PriorityQueue *q, int capacity);
void pqFree(PriorityQueue *q);
int  pqIsFull(const PriorityQueue *q);
int  pqIsEmpty(const PriorityQueue *q);
int  pqInsert(PriorityQueue *q, Packet p);          /* 0 if full            */
int  pqExtractMax(PriorityQueue *q, Packet *out);   /* 0 if empty           */
int  pqPeek(const PriorityQueue *q, Packet *out);
int  pqPeekLowest(const PriorityQueue *q, Packet *out);
int  pqRemoveLowest(PriorityQueue *q, Packet *out); /* used for smart drop  */
void pqDisplay(const PriorityQueue *q);

#endif
