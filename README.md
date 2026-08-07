# SiklOps

**SiklOps** — *Simulation of Cyclic Construction Operations*

Educational discrete-event simulation for construction production cycles  
(Earthmoving · Bricklaying · Concreting / RMC placing).

This is the **web app** (React + TypeScript + TanStack Start + Tailwind) — same UI as the Grok Build sandbox.  
Deploy target: **Vercel**.

> Streamlit Python edition (legacy): [m46d45/SiklOps](https://github.com/m46d45/SiklOps) — optional, not required.

## Features

- **Earthmoving** — excavator + dump truck, distributions, cost, emissions, fleet comparison
- **Concreting** — dual-cycle RMC (truck mixer + placing) with site buffer; methods: buggy / crane bucket / pump
- Shared result tabs: Ringkasan, Perbandingan, queueing insights
- Illustrations and Indonesian/English learning copy

## Local development

```bash
npm install
npm run dev      # http://localhost:8080
npm run build    # production → .vercel/output (Nitro Vercel preset)
npm run typecheck
```

Node **22+** recommended.

## Deploy on Vercel

### Option A — Import from GitHub (recommended)

1. Push this repo to GitHub (already: `m46d45/SiklOps-web` if following our setup).
2. Open [vercel.com/new](https://vercel.com/new)
3. Import **`m46d45/SiklOps-web`**
4. Framework: auto / Vite · Build: `npm run build` · Output: handled by Nitro (`vercel` preset)
5. Deploy

No `DATABASE_URL` needed for classroom use (PGLite fallback).

### Option B — CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

## Stack

- React 19 · TypeScript · Vite · TanStack Start / Router / Query  
- Tailwind CSS v4 · Radix / shadcn · Recharts · Zustand  
- Nitro preset `vercel` for SSR deploy  

## License

Educational use.
