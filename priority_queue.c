/*
 * priority_queue.c
 * Binary max-heap priority queue: the router's priority (QoS) buffer.
 */

#include <stdio.h>
#include <stdlib.h>
#include "priority_queue.h"

/* returns 1 if packet a must be sent before packet b */
static int moreUrgent(const Packet *a, const Packet *b) {
    if (a->priority != b->priority)
        return a->priority > b->priority;
    return a->id < b->id;                       /* same priority -> older first */
}

static void swap(Packet *a, Packet *b) {
    Packet t = *a;
    *a = *b;
    *b = t;
}

/* move node i up while it is more urgent than its parent: O(log n) */
static void siftUp(PriorityQueue *q, int i) {
    while (i > 0) {
        int parent = (i - 1) / 2;
        if (!moreUrgent(&q->heap[i], &q->heap[parent]))
            break;
        swap(&q->heap[i], &q->heap[parent]);
        i = parent;
    }
}

/* move node i down while a child is more urgent than it: O(log n) */
static void siftDown(PriorityQueue *q, int i) {
    while (1) {
        int left = 2 * i + 1, right = 2 * i + 2, best = i;
        if (left < q->count && moreUrgent(&q->heap[left], &q->heap[best]))
            best = left;
        if (right < q->count && moreUrgent(&q->heap[right], &q->heap[best]))
            best = right;
        if (best == i)
            break;
        swap(&q->heap[i], &q->heap[best]);
        i = best;
    }
}

int pqInit(PriorityQueue *q, int capacity) {
    q->heap = (Packet *)malloc(sizeof(Packet) * capacity);
    if (q->heap == NULL)
        return 0;
    q->capacity = capacity;
    q->count = 0;
    return 1;
}

void pqFree(PriorityQueue *q) {
    free(q->heap);
    q->heap = NULL;
    q->capacity = q->count = 0;
}

int pqIsFull(const PriorityQueue *q)  { return q->count == q->capacity; }
int pqIsEmpty(const PriorityQueue *q) { return q->count == 0; }

/* put the packet at the end of the array, then sift it up */
int pqInsert(PriorityQueue *q, Packet p) {
    if (pqIsFull(q))
        return 0;
    q->heap[q->count] = p;
    q->count++;
    siftUp(q, q->count - 1);
    return 1;
}

/* take the root, move the last element to the root, then sift it down */
int pqExtractMax(PriorityQueue *q, Packet *out) {
    if (pqIsEmpty(q))
        return 0;
    *out = q->heap[0];
    q->count--;
    if (q->count > 0) {
        q->heap[0] = q->heap[q->count];
        siftDown(q, 0);
    }
    return 1;
}

int pqPeek(const PriorityQueue *q, Packet *out) {
    if (pqIsEmpty(q))
        return 0;
    *out = q->heap[0];
    return 1;
}

/* The least urgent packet is always a leaf (index count/2 .. count-1),
 * so only about half the array has to be scanned: O(n/2). */
static int lowestIndex(const PriorityQueue *q) {
    int idx = q->count / 2;
    for (int i = q->count / 2 + 1; i < q->count; i++)
        if (moreUrgent(&q->heap[idx], &q->heap[i]))
            idx = i;
    return idx;
}

int pqPeekLowest(const PriorityQueue *q, Packet *out) {
    if (pqIsEmpty(q))
        return 0;
    *out = q->heap[lowestIndex(q)];
    return 1;
}

/* Remove the least urgent packet (used when the buffer is full and a more
 * important packet arrives). Replace it with the last element and repair. */
int pqRemoveLowest(PriorityQueue *q, Packet *out) {
    if (pqIsEmpty(q))
        return 0;
    int i = lowestIndex(q);
    *out = q->heap[i];
    q->count--;
    if (i != q->count) {
        q->heap[i] = q->heap[q->count];
        siftUp(q, i);
        siftDown(q, i);
    }
    return 1;
}

/* Shows the heap array and the heap level by level (it is a tree) */
void pqDisplay(const PriorityQueue *q) {
    printf("\n  PRIORITY QUEUE (max-heap)   %d/%d used\n", q->count, q->capacity);
    if (pqIsEmpty(q)) {
        printf("  (empty)\n");
        return;
    }
    printf("  index: ");
    for (int i = 0; i < q->count; i++)
        printf("%6d ", i);
    printf("\n  data : ");
    for (int i = 0; i < q->count; i++)
        printf(" P%-2d(%c)", q->heap[i].id, priorityName(q->heap[i].priority)[0]);
    printf("\n  Tree levels:\n");
    for (int start = 0, level = 0; start < q->count; level++, start = 2 * start + 1) {
        int end = 2 * start + 1;                /* first index of next level */
        printf("    level %d: ", level);
        for (int i = start; i < end && i < q->count; i++)
            printf("P%d(%c) ", q->heap[i].id, priorityName(q->heap[i].priority)[0]);
        printf("\n");
    }
    Packet top;
    pqPeek(q, &top);
    printf("  Next to send: P%d (%s)\n", top.id, priorityName(top.priority));
}
