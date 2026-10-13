import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Network Packet Buffer & Traffic Simulator',
  description:
    'A router buffer simulator built on a circular queue and a priority queue (binary heap). Run live traffic, watch congestion and packet drops, and compare FIFO with priority scheduling.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
