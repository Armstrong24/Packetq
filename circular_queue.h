/*
 * circular_queue.h
 * Fixed-capacity FIFO buffer built on an array whose indices wrap around.
 *
 *   front -> index of the oldest packet (next to be sent)
 *   rear  -> index where the next arriving packet will be stored
 *   count -> number of packets in the buffer
 *
 *   rear = (rear + 1) % capacity   lets freed slots at the start be reused
 *   without shifting any elements, so enqueue and dequeue are both O(1).
 */

#ifndef CIRCULAR_QUEUE_H
#define CIRCULAR_QUEUE_H

#include "packet.h"

typedef struct {
    Packet *items;      /* array of 'capacity' slots */
    int capacity;
    int front;
    int rear;
    int count;
} CircularQueue;

int  cqInit(CircularQueue *q, int capacity);      /* 1 = ok, 0 = no memory */
void cqFree(CircularQueue *q);
int  cqIsFull(const CircularQueue *q);
int  cqIsEmpty(const CircularQueue *q);
int  cqEnqueue(CircularQueue *q, Packet p);       /* 0 if full (overflow)   */
int  cqDequeue(CircularQueue *q, Packet *out);    /* 0 if empty (underflow) */
int  cqPeek(const CircularQueue *q, Packet *out);
void cqDisplay(const CircularQueue *q);

#endif
