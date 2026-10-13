/*
 * circular_queue.c
 * Array-based circular queue: the router's FIFO (first come, first served) buffer.
 */

#include <stdio.h>
#include <stdlib.h>
#include "circular_queue.h"

int cqInit(CircularQueue *q, int capacity) {
    q->items = (Packet *)malloc(sizeof(Packet) * capacity);
    if (q->items == NULL)
        return 0;
    q->capacity = capacity;
    q->front = 0;
    q->rear = 0;
    q->count = 0;
    return 1;
}

void cqFree(CircularQueue *q) {
    free(q->items);
    q->items = NULL;
    q->capacity = q->front = q->rear = q->count = 0;
}

int cqIsFull(const CircularQueue *q)  { return q->count == q->capacity; }
int cqIsEmpty(const CircularQueue *q) { return q->count == 0; }

/* O(1): store at rear, then move rear forward with wrap-around */
int cqEnqueue(CircularQueue *q, Packet p) {
    if (cqIsFull(q))
        return 0;                               /* buffer overflow -> packet dropped */
    q->items[q->rear] = p;
    q->rear = (q->rear + 1) % q->capacity;
    q->count++;
    return 1;
}

/* O(1): take from front, then move front forward with wrap-around */
int cqDequeue(CircularQueue *q, Packet *out) {
    if (cqIsEmpty(q))
        return 0;                               /* underflow -> nothing to send */
    *out = q->items[q->front];
    q->front = (q->front + 1) % q->capacity;
    q->count--;
    return 1;
}

int cqPeek(const CircularQueue *q, Packet *out) {
    if (cqIsEmpty(q))
        return 0;
    *out = q->items[q->front];
    return 1;
}

/* Shows the raw array, which slots are in use, and where front/rear point */
void cqDisplay(const CircularQueue *q) {
    printf("\n  CIRCULAR QUEUE (FIFO)   %d/%d used   front=%d  rear=%d\n",
           q->count, q->capacity, q->front, q->rear);
    printf("  slot : ");
    for (int i = 0; i < q->capacity; i++)
        printf("%5d ", i);
    printf("\n  data : ");
    for (int i = 0; i < q->capacity; i++) {
        /* slot i is occupied if it lies within count steps after front */
        int offset = (i - q->front + q->capacity) % q->capacity;
        if (offset < q->count)
            printf("  P%-2d ", q->items[i].id);
        else
            printf("    - ");
    }
    printf("\n         ");
    for (int i = 0; i < q->capacity; i++) {
        if (i == q->front && i == q->rear) printf("  F/R ");
        else if (i == q->front)            printf("    F ");
        else if (i == q->rear)             printf("    R ");
        else                               printf("      ");
    }
    printf("\n  Send order: ");
    if (cqIsEmpty(q)) {
        printf("(empty)\n");
        return;
    }
    for (int k = 0; k < q->count; k++) {
        const Packet *p = &q->items[(q->front + k) % q->capacity];
        printf("P%d(%c) ", p->id, priorityName(p->priority)[0]);
    }
    printf("\n");
}
