# PACKETQ: Network Packet Buffer & Traffic Simulator (web)

Interactive website for the Data Structures project **PS 9 · SQ09**. It runs a TypeScript port of the C simulator
(circular queue + binary max-heap priority queue) in the browser, with the same random generator, so it gives the
**same numbers as the C program** for the same settings and seed.

## Run it on your laptop

You need Node.js 18.18 or newer (https://nodejs.org, LTS version).

```
npm install
npm run dev
```

Open http://localhost:3000

## Deploy on Vercel

1. Push this folder to a GitHub repo.
2. Go to https://vercel.com → **Add New → Project** → import the repo.
3. Framework preset: **Next.js** (auto-detected). Leave the build settings as they are.
   If the website sits in a subfolder of your repo (for example `web/`), set **Root Directory** to that folder.
4. Click **Deploy**. Every push to GitHub redeploys automatically.

## Customise

- `lib/site.ts`: project name, course line, GitHub link, team names and roles.
- `lib/sources.ts`: the C code shown in the "Under the hood" section. If you change the C files, paste the new
  code in here.
- `app/globals.css`: colours (the `--p0` to `--p3` variables are the four priority colours).

## Structure

| File | What it does |
|---|---|
| `lib/engine.ts` | Circular queue, heap priority queue, traffic generator, tick loop, statistics |
| `components/Simulator.tsx` | Live simulator: settings, start/step/run, manual inject/send, ring and heap views, log, metrics, chart |
| `components/BufferView.tsx` | Circular queue drawn as a ring, heap drawn as a tree plus its array |
| `components/Charts.tsx` | SVG traffic chart and FIFO vs priority bar charts |
| `components/Sections.tsx` | Animated hero buffer, policy comparison across all loads, C code viewer |
| `app/page.tsx` | Page layout: hero, overview, tick lifecycle, simulator, comparison, code, team |
