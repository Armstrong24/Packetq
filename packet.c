/*
 * packet.c
 * Small helpers for printing packets.
 */

#include <stdio.h>
#include "packet.h"

const char *priorityName(Priority p) {
    switch (p) {
        case PRI_CRITICAL: return "CRITICAL";
        case PRI_HIGH:     return "HIGH";
        case PRI_NORMAL:   return "NORMAL";
        default:           return "LOW";
    }
}

const char *trafficType(Priority p) {
    switch (p) {
        case PRI_CRITICAL: return "VoIP";
        case PRI_HIGH:     return "Video";
        case PRI_NORMAL:   return "Web";
        default:           return "Bulk";
    }
}

void printPacket(const Packet *p) {
    printf("P%-4d %-8s %-5s %5d B  arrived t=%d",
           p->id, priorityName(p->priority), trafficType(p->priority),
           p->size, p->arrivalTick);
}
