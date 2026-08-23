# Energy Supply Resilience Platform

An AI-powered system that **continuously monitors geopolitical and logistics risk**, **models disruption
scenarios and their economic impact**, and **generates executable procurement rerouting recommendations**
for the energy/oil supply chain.

🔗 **Live demo:** https://energy-resilience-platform.vercel.app/

---

## Table of contents

- [Problem statement](#problem-statement)
- [How this solves it](#how-this-solves-it)
- [System architecture](#system-architecture)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Data sources](#data-sources)
- [Getting started (local setup)](#getting-started-local-setup)
- [Project structure](#project-structure)
- [Security & trust design](#security--trust-design)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## Problem statement

> Design an AI-powered system that continuously monitors geopolitical and logistics risk, models
> disruption scenarios and their economic impact, and generates executable procurement rerouting
> recommendations.

The intended full system architecture consists of five agents:

1. **Geopolitical Risk Intelligence Agent** - produces a live supply-disruption probability score by
   corridor and supplier from news, shipping, and sanctions data.
2. **Disruption Scenario Modeller** - simulates events such as a Hormuz closure or Red Sea suspension
   and their cascading impact on refining, prices, and GDP.
3. **Adaptive Procurement Orchestrator** - ranks alternative crude sources and logistics routes for
   procurement teams to act on within hours.
4. **Strategic Reserve Optimisation Agent** - models optimal reserve drawdown schedules against supply
   gap forecasts.
5. **Supply Chain Digital Twin** - a geospatial simulation of the energy network enabling continuous
   what-if analysis.

## How this solves it

| Requirement | Implementation |
|---|---|
| Continuously monitors risk | Risk Intelligence tab ingests **live news via the GDELT API** and scores 8 corridors/suppliers in real time; a global banner interrupts the user the moment a score crosses a critical threshold — monitoring is proactive, not passive. |
| Models disruption scenarios & economic impact | The Scenario Modeller traces a triggering event through the supply chain (source → chokepoint → refinery → market) and produces concrete price/delay/GDP outputs; the Reserve tab extends this into a time-series forecast grounded in **real Strategic Petroleum Reserve (SPR) data**. |
| Generates executable recommendations | The Procurement Orchestrator ranks specific alternative sources/routes (ETA, cost delta, capacity, confidence score) rather than just describing the problem. Every selection is written to a **tamper-evident audit trail**, so a recommendation acted on has a verifiable record. |

The five tabs aren't independent demos selecting a scenario in the Modeller flows into the
Orchestrator's ranking and the Reserve tab's forecast, so the app functions as one connected decision
pipeline.

## System architecture

```
┌─────────────────────────┐      ┌──────────────────────────┐
│ Geopolitical Risk         │      │  Disruption Scenario      │
│ Intelligence Agent        │─────▶│  Modeller                  │
│ (live GDELT feed +        │      │  (4 predefined scenarios)  │
│  probability scoring)     │      └──────────────┬─────────────┘
└─────────────────────────┘                     │
                                                    ▼
┌─────────────────────────┐      ┌──────────────────────────┐
│ Strategic Reserve         │◀─────│  Adaptive Procurement      │
│ Optimisation Agent        │      │  Orchestrator              │
│ (real EIA/SPR baseline)   │      │  (ranked alternatives)     │
└─────────────────────────┘      └──────────────────────────┘
                                                    │
                                                    ▼
                                     ┌──────────────────────────┐
                                     │  Supply Chain Digital Twin │
                                     │  (geospatial what-if view)  │
                                     └──────────────────────────┘

        All actions above are logged to a SHA-256 hash-chained audit trail.
```

## Features

**Global**
- Live GDELT news ticker with automatic offline fallback and status indicator
- Real EIA data snapshot: WTI/Brent price, SPR level, capacity, minimum operating level, drawdown rate
- Unified WATCH / ELEVATED / CRITICAL severity system used across every tab
- Global CRITICAL alert banner, fires automatically on threshold breach
- Tamper-evident audit trail (SHA-256 hash chain) with live integrity verification and alerting
- Input sanitization on all externally-ingested text (XSS/injection defense on the live news feed)

**Risk Intelligence** - live-updating probability table, trend indicators, severity badges, real price
cards.

**Scenario Modeller** - animated supply-chain pipeline, 4 disruption scenarios, live probability badges,
impact summary (probability, price, delay, GDP risk), animated reroute overlay.

**Procurement Orchestrator** - ranked alternative sources/routes per active scenario, with ETA, cost
delta, capacity, and AI confidence score.

**Reserve Optimisation** - real SPR baseline shown by default; per-scenario supply-gap-vs-drawdown chart;
derived stats including SPR headroom in days at max drawdown.

**Digital Twin** - geospatial node map with a "Run what-if" toggle overlaying the active scenario's
disruption and reroute paths.

## Tech stack

- **React 18** (functional components, hooks)
- **Vite** - dev server & build tool
- **Recharts** - Reserve Optimisation chart
- **lucide-react** - icon set
- **Web Crypto API** (`crypto.subtle`) - SHA-256 hashing for the audit trail
- **GDELT DOC 2.0 API** - live news data, fetched client-side
- No backend - this is a fully client-side prototype

## Data sources

| Source | What it provides | Access | Status in this build |
|---|---|---|---|
| **GDELT Project (DOC 2.0 API)** | Global news events, geocoded, updated ~every 15 min | Free, public, no key | **Live** - actively queried |
| **U.S. EIA** | Crude oil prices (WTI/Brent), refinery/import/export data | Free, public API | Snapshot baked in |
| **EIA Weekly Petroleum Status Report** | U.S. Strategic Petroleum Reserve levels | Free, public | Snapshot baked in |
| **OFAC Sanctions List (SDN List)** | U.S. Treasury sanctions designations | Free, public | Referenced conceptually not yet ingested |
| **ACLED** | Structured conflict event data | Free (academic/hackathon use) | Referenced conceptually not yet ingested |
| **MarineCadastre AIS Data** | Historical vessel-tracking data | Free, public | Not implemented - real-time AIS is the identified gap |
| **World Port Index / UN/LOCODE** | Standardized port/refinery coordinates | Free, public | Not yet implemented - map uses approximate coordinates |

## Getting started (local setup)

### Prerequisites
Node.js 18+ - check with `node -v`. Get it from [nodejs.org](https://nodejs.org) if needed.

### Install & run

```bash
git clone <this-repo-url>
cd energy-resilience-platform
npm install
npm run dev
```

Open the `http://localhost:5173/` link printed in your terminal.

### What a healthy first load looks like
- Header shows **"LIVE - GDELT NEWS FEED"** within a few seconds (confirms the live fetch is reaching
  the real GDELT API)
- A red **CRITICAL** banner appears near the top automatically - expected, not a bug (Hormuz and
  Novorossiysk are seeded above threshold by default)

### Production build

```bash
npm run build
npm run preview
```

## Project structure

```
energy-resilience-platform/
├── index.html          # HTML entry point
├── package.json         # dependencies & scripts
├── vite.config.js       # build tool config
├── README.md             # this file
└── src/
    ├── main.jsx          # mounts the app
    └── App.jsx           # entire dashboard (all 5 tabs, all logic - single-file by design)
```

## Security & trust design

Because a system like this could trigger real procurement action, the prototype includes:

- **Tamper-evident audit trail** -every meaningful action (scenario triggered, procurement option
  selected, what-if toggled) is hashed (SHA-256) and chained to the previous entry. A background process
  continuously re-verifies the chain; any mismatch fires a global integrity alert.
- **Input sanitization** - all text from the live GDELT feed is stripped of HTML/script content and
  `javascript:`/inline-event-handler patterns before rendering, closing the main injection surface for a
  system that displays untrusted external text.
- **Human-in-the-loop by design** - the Orchestrator ranks and recommends; it does not auto-execute.

What a production deployment would still need (out of scope for a client-side prototype): TLS, an
authenticated API layer, role-based access control, encryption at rest, and a compliance-check step
(e.g. auto-flagging a recommendation that would touch a sanctioned entity).

## Known limitations

- Risk probability scores are illustrative (sine-wave simulated), not a trained/calibrated model
- Scenario economic impact figures (price delta, GDP risk) are hand-authored, not derived from an
  economic model
- Digital Twin node coordinates are approximate, not sourced from an authoritative port database
- No real-time AIS/shipping data identified as the hardest data-access gap (no free real-time source
  exists; Spire/MarineTraffic are the realistic paid options)
- No backtesting yet against historical disruption events

## Roadmap

**Near-term:** train a real sentiment/frequency model on GDELT tone data, backtest against known
historical disruptions (e.g. 2021 Suez blockage); ingest the OFAC SDN list directly; use UN/LOCODE for
accurate Digital Twin coordinates.

**Medium-term:** real-time AIS integration; a prediction-vs-outcome feedback loop to calibrate confidence
scores; a compliance-check step in the Orchestrator.

**Longer-term:** multi-commodity expansion (LNG, refined products, critical minerals); direct ERP/
procurement system integration; Monte Carlo-style parallel scenario stress-testing in the Digital Twin.

---

*Built for [OOSC 4.0 Hackathon] — data grounded in GDELT and U.S. EIA open datasets.*
## Team Members
* [Tisha Jain](https://github.com/tj03coder)
*[Yukta Kumari](https://github.com/gokulyukta-hub)
