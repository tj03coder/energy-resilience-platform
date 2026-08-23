import React, { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle, Anchor, Factory, Fuel, TrendingUp, TrendingDown, Radio, Zap, CheckCircle2,
  ArrowRight, Activity, GitBranch, Battery, Globe, ChevronRight, ShieldCheck, ShieldAlert,
} from "lucide-react";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ================= Shared domain data =================
const SIGNALS = [
  "REUTERS · Houthi vessel intercepted near Bab-el-Mandeb strait",
  "AIS DATA · Tanker congestion building at Suez northern anchorage",
  "SATELLITE · Refinery flare activity spike, Jamnagar complex",
  "OFAC · New sanctions tranche targeting Urals-grade exports",
  "WEATHER · Cyclone track approaching Persian Gulf shipping lanes",
  "PORT AUTH · Novorossiysk terminal reports slowed loading rate",
];

// Real snapshot data — EIA Weekly Petroleum Status Report (SPR, w/e Aug 14 2026) and
// WTI/Brent spot as of Aug 22 2026. In production these would be pulled live from the EIA API;
// here they're a manually refreshed snapshot so the numbers are grounded, not invented.
// Strips HTML/script content from any externally-ingested text before it's ever rendered.
// The real "anti-malware" surface for a system that ingests untrusted news text isn't viruses —
// it's injection (XSS, markup smuggling) riding in on a headline. Sanitize at the boundary.
function sanitize(str) {
  return String(str).replace(/<[^>]*>/g, "").replace(/javascript:/gi, "").replace(/on\w+=/gi, "").slice(0, 220);
}

const REAL_DATA = {
  spr: { current: 293.4, capacity: 714, minOperating: 70, maxDrawdownPerDay: 4.4, asOf: "week ending Aug 14, 2026" },
  wti: 86.64,
  brent: 91.54,
  priceAsOf: "Aug 22, 2026",
};

const NODES = [
  { id: "src_ksa", lane: 0, type: "source", label: "Ras Tanura", sub: "Saudi Arabia · Crude", risk: 0.18, lon: 50, lat: 26 },
  { id: "src_rus", lane: 0, type: "source", label: "Novorossiysk", sub: "Russia · Crude", risk: 0.61, lon: 37, lat: 44 },
  { id: "src_us", lane: 0, type: "source", label: "Gulf Coast", sub: "USA · Crude", risk: 0.09, lon: -95, lat: 29 },
  { id: "corridor_hormuz", lane: 1, type: "corridor", label: "Strait of Hormuz", sub: "Chokepoint", risk: 0.52, lon: 56, lat: 26 },
  { id: "corridor_suez", lane: 1, type: "corridor", label: "Suez / Red Sea", sub: "Chokepoint", risk: 0.35, lon: 33, lat: 29 },
  { id: "refinery_jam", lane: 2, type: "refinery", label: "Jamnagar", sub: "India · Refining", risk: 0.22, lon: 70, lat: 22 },
  { id: "refinery_rot", lane: 2, type: "refinery", label: "Rotterdam", sub: "Netherlands · Refining", risk: 0.12, lon: 4, lat: 52 },
  { id: "market", lane: 3, type: "market", label: "Delivered Market", sub: "Downstream Price Index", risk: 0.0, lon: 90, lat: 15 },
];

const EDGES = [
  ["src_ksa", "corridor_hormuz"], ["src_rus", "corridor_suez"], ["src_us", "corridor_suez"],
  ["corridor_hormuz", "refinery_jam"], ["corridor_suez", "refinery_jam"], ["corridor_suez", "refinery_rot"],
  ["refinery_jam", "market"], ["refinery_rot", "market"],
];

const SCENARIOS = [
  {
    id: "hormuz", label: "Hormuz chokepoint disruption", hit: "corridor_hormuz",
    desc: "Naval incident closes the strait to tanker traffic for an estimated 9 days.",
    priceDelta: "+14.2%", delayDays: 9, gdpRisk: "Medium-High",
    reroute: { from: "corridor_hormuz", via: "corridor_suez", to: "refinery_jam" },
    recommendation: "Reroute Ras Tanura liftings via Suez-bound spot tankers; draw down Jamnagar strategic reserve by 6% to bridge the gap.",
    confidence: 0.81,
    alternatives: [
      { source: "Ras Tanura (via Suez spot)", eta: "11d", costDelta: "+9.4%", capacity: "72%", score: 0.81 },
      { source: "Gulf Coast crude (direct)", eta: "14d", costDelta: "+4.1%", capacity: "58%", score: 0.74 },
      { source: "West African spot cargo", eta: "16d", costDelta: "+12.0%", capacity: "40%", score: 0.61 },
    ],
    reserve: { gap: [2, 6, 11, 15, 17, 14, 9], draw: [1, 4, 8, 12, 14, 12, 7] },
  },
  {
    id: "redsea", label: "Red Sea suspension", hit: "corridor_suez",
    desc: "Shipping suspends Red Sea transits; vessels reroute via Cape of Good Hope, +11 days transit.",
    priceDelta: "+8.9%", delayDays: 11, gdpRisk: "Medium",
    reroute: { from: "corridor_suez", via: "corridor_hormuz", to: "refinery_jam" },
    recommendation: "Redirect Novorossiysk and Gulf Coast cargoes to Hormuz-adjacent buyers; hold Rotterdam contracts on Cape-route vessels already at sea.",
    confidence: 0.76,
    alternatives: [
      { source: "Hormuz corridor (re-flagged)", eta: "13d", costDelta: "+7.2%", capacity: "65%", score: 0.76 },
      { source: "Cape of Good Hope routing", eta: "19d", costDelta: "+10.5%", capacity: "80%", score: 0.70 },
      { source: "Gulf Coast direct to Rotterdam", eta: "15d", costDelta: "+5.0%", capacity: "50%", score: 0.68 },
    ],
    reserve: { gap: [1, 4, 8, 12, 14, 13, 10], draw: [0, 3, 6, 9, 11, 10, 8] },
  },
  {
    id: "jamnagar", label: "Refinery outage — Jamnagar", hit: "refinery_jam",
    desc: "Unplanned maintenance shutdown cuts throughput by 40% for 12 days.",
    priceDelta: "+9.5%", delayDays: 12, gdpRisk: "Medium",
    reroute: { from: "refinery_jam", via: "corridor_suez", to: "refinery_rot" },
    recommendation: "Redirect 40% of Hormuz-origin crude to Rotterdam for refining; activate downstream distributor buffer stock in South Asia.",
    confidence: 0.69,
    alternatives: [
      { source: "Rotterdam refining capacity", eta: "10d", costDelta: "+6.6%", capacity: "55%", score: 0.69 },
      { source: "Singapore spot refining", eta: "9d", costDelta: "+8.8%", capacity: "35%", score: 0.63 },
      { source: "South Asia buffer stock draw", eta: "2d", costDelta: "+2.0%", capacity: "20%", score: 0.58 },
    ],
    reserve: { gap: [3, 7, 10, 13, 12, 9, 5], draw: [2, 5, 9, 11, 10, 7, 4] },
  },
  {
    id: "sanctions", label: "Sanctions escalation — Urals crude", hit: "src_rus",
    desc: "New OFAC measures restrict insurance for Urals-grade cargo movement.",
    priceDelta: "+11.0%", delayDays: 6, gdpRisk: "High",
    reroute: { from: "src_rus", via: "corridor_suez", to: "refinery_rot" },
    recommendation: "Substitute Novorossiysk volumes with Gulf Coast and spot-market crude; renegotiate Rotterdam offtake to non-sanctioned grades.",
    confidence: 0.77,
    alternatives: [
      { source: "Gulf Coast crude (spot)", eta: "12d", costDelta: "+7.5%", capacity: "60%", score: 0.77 },
      { source: "Ras Tanura long-term contract", eta: "13d", costDelta: "+5.9%", capacity: "70%", score: 0.72 },
      { source: "West African spot cargo", eta: "16d", costDelta: "+13.2%", capacity: "38%", score: 0.55 },
    ],
    reserve: { gap: [2, 5, 7, 9, 8, 6, 3], draw: [1, 3, 5, 7, 6, 4, 2] },
  },
];

const RISK_ENTRIES = [
  { id: "corridor_hormuz", name: "Strait of Hormuz", type: "Corridor", base: 0.52 },
  { id: "corridor_suez", name: "Suez / Red Sea", type: "Corridor", base: 0.35 },
  { id: "src_rus", name: "Novorossiysk (Russia)", type: "Supplier", base: 0.61 },
  { id: "src_ksa", name: "Ras Tanura (Saudi Arabia)", type: "Supplier", base: 0.18 },
  { id: "src_us", name: "Gulf Coast (USA)", type: "Supplier", base: 0.09 },
  { id: "refinery_jam", name: "Jamnagar Refinery", type: "Refining node", base: 0.22 },
  { id: "corridor_malacca", name: "Strait of Malacca", type: "Corridor", base: 0.15 },
  { id: "refinery_rot", name: "Rotterdam Refinery", type: "Refining node", base: 0.12 },
];

const TYPE_ICON = { source: Fuel, corridor: Anchor, refinery: Factory, market: TrendingUp };
const TABS = [
  { id: "risk", label: "Risk Intelligence", icon: Radio },
  { id: "scenario", label: "Scenario Modeller", icon: AlertTriangle },
  { id: "orchestrator", label: "Procurement Orchestrator", icon: GitBranch },
  { id: "reserve", label: "Reserve Optimisation", icon: Battery },
  { id: "twin", label: "Digital Twin", icon: Globe },
];

function riskColor(r) {
  if (r >= 0.5) return "var(--danger)";
  if (r >= 0.25) return "var(--warn)";
  return "var(--safe)";
}
function riskLabel(r) {
  if (r >= 0.5) return "CRITICAL";
  if (r >= 0.25) return "ELEVATED";
  return "WATCH";
}

// ================= App =================
export default function App() {
  const [tab, setTab] = useState("risk");
  const [tick, setTick] = useState(0);
  const [scenarioId, setScenarioId] = useState(null);
  const [executed, setExecuted] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [whatIf, setWhatIf] = useState(false);
  const [selectedAlt, setSelectedAlt] = useState(null);
  const [liveHeadlines, setLiveHeadlines] = useState(null);
  const [feedStatus, setFeedStatus] = useState("connecting"); // connecting | live | offline
  const [auditLog, setAuditLog] = useState([]);
  const [showAudit, setShowAudit] = useState(false);
  const [tamperedIdx, setTamperedIdx] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function verify() {
      const bad = [];
      for (let i = 0; i < auditLog.length; i++) {
        const e = auditLog[i];
        if (e.hash === "computing…") continue;
        const payload = `${e.prevHash}|${e.ts}|${e.action}`;
        try {
          const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
          const recomputed = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
          if (recomputed !== e.hash) bad.push(i);
        } catch (err) { /* fallback-hashed entries aren't re-verifiable this way */ }
      }
      if (!cancelled) setTamperedIdx(bad);
    }
    verify();
    return () => { cancelled = true; };
  }, [auditLog]);

  function simulateTamper() {
    setAuditLog((log) => {
      if (!log.length) return log;
      const idx = Math.floor(Math.random() * log.length);
      const copy = [...log];
      copy[idx] = { ...copy[idx], action: copy[idx].action + " [ALTERED]" };
      return copy;
    });
  }

  async function logAction(action) {
    setAuditLog((log) => {
      const prevHash = log.length ? log[log.length - 1].hash : "GENESIS";
      const ts = new Date().toISOString();
      const payload = `${prevHash}|${ts}|${action}`;
      // Fire-and-append: hash computed async, entry patched in once ready so the chain stays ordered.
      (async () => {
        let hash;
        try {
          const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
          hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
        } catch (e) {
          hash = Math.abs(payload.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)).toString(16).padStart(16, "0");
        }
        setAuditLog((cur) => cur.map((e) => (e.ts === ts && e.action === action ? { ...e, hash } : e)));
      })();
      return [...log, { ts, action, prevHash, hash: "computing…" }];
    });
  }

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 2400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchGdelt() {
      try {
        const q = encodeURIComponent('(Hormuz OR "Suez Canal" OR "Red Sea" OR OFAC sanctions oil OR refinery outage OR crude tanker)');
        const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=8&format=json&sort=datedesc&timespan=2d`;
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled && data?.articles?.length) {
          setLiveHeadlines(data.articles.map((a) => sanitize(`${(a.domain || "NEWS").toUpperCase()} · ${a.title}`)));
          setFeedStatus("live");
        } else if (!cancelled) {
          setFeedStatus("offline");
        }
      } catch (e) {
        if (!cancelled) setFeedStatus("offline");
      }
    }
    fetchGdelt();
    const iv = setInterval(fetchGdelt, 120000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const scenario = useMemo(() => SCENARIOS.find((s) => s.id === scenarioId) || null, [scenarioId]);

  useEffect(() => {
    setExecuted(false);
    setSelectedAlt(null);
    if (!scenario) { setPhase("idle"); return; }
    setPhase("analyzing");
    const t = setTimeout(() => setPhase("ready"), 850);
    return () => clearTimeout(t);
  }, [scenarioId]);

  const jitter = (base, seed) => {
    const v = base + Math.sin(tick * 0.6 + seed) * 0.03;
    return Math.max(0.02, Math.min(0.96, v));
  };

  const criticalEntries = RISK_ENTRIES
    .map((r) => ({ ...r, score: jitter(r.base, r.base * 10) }))
    .filter((r) => r.score >= 0.5)
    .sort((a, b) => b.score - a.score);

  const vars = {
    "--bg": "#0A0E14", "--panel": "#12181F", "--panel2": "#161D26", "--border": "#232B36",
    "--text": "#E7ECF2", "--muted": "#7C8798", "--accent": "#E3A857", "--danger": "#D8584A",
    "--warn": "#E3A857", "--safe": "#4FA37D", "--mono": "'IBM Plex Mono', monospace",
  };

  return (
    <div style={{
      ...vars, fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      background: "var(--bg)", color: "var(--text)", minHeight: "640px",
      padding: "20px 22px 26px", borderRadius: 12, position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .sg { font-family: 'Space Grotesk', sans-serif; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
        @keyframes flow { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }
        @keyframes scrollTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .pulse { animation: pulse 1.4s ease-in-out infinite; }
        .flowline { stroke-dasharray: 4 4; animation: flow 1s linear infinite; }
        .scenBtn, .tabBtn, .altCard { transition: border-color .15s, background .15s; cursor: pointer; }
        .scenBtn:hover, .tabBtn:hover, .altCard:hover { border-color: var(--accent) !important; }
        .execBtn { transition: transform .1s, opacity .15s; }
        .execBtn:active { transform: scale(0.97); }
        .fadein { animation: fadeIn .25s ease-out; }
        table.riskTable { border-collapse: collapse; width: 100%; }
        table.riskTable td, table.riskTable th { padding: 8px 10px; text-align: left; }
        table.riskTable th { font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); border-bottom: 1px solid var(--border); }
        table.riskTable tr:not(:last-child) td { border-bottom: 1px solid var(--border); }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--panel2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Activity size={18} color="var(--accent)" />
          </div>
          <div>
            <div className="sg" style={{ fontSize: 17, fontWeight: 700, letterSpacing: 0.2 }}>Energy Supply Resilience Platform</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", letterSpacing: 0.3 }}>Geopolitical risk → scenario modelling → procurement action</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--muted)" }}>
          <button className="scenBtn" onClick={() => setShowAudit((v) => !v)} style={{
            fontSize: 10.5, padding: "5px 10px", borderRadius: 6, background: "var(--panel2)",
            border: "1px solid var(--border)", color: "var(--muted)", display: "flex", alignItems: "center", gap: 5,
          }}>
            <ShieldCheck size={12} color={tamperedIdx.length ? "var(--danger)" : "var(--safe)"} />
            Audit trail {showAudit ? "▲" : "▼"}
          </button>
          <span className="pulse" style={{ width: 7, height: 7, borderRadius: 99, background: feedStatus === "live" ? "var(--safe)" : "var(--warn)", display: "inline-block" }} />
          {feedStatus === "live" ? "LIVE — GDELT NEWS FEED" : feedStatus === "connecting" ? "CONNECTING…" : "OFFLINE — CACHED SIGNALS"}
        </div>
      </div>

      {/* Tamper-integrity alert — takes priority over the critical-risk banner */}
      {tamperedIdx.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, background: "rgba(216,88,74,0.16)",
          border: "1.5px solid var(--danger)", borderRadius: 8, padding: "9px 13px", marginBottom: 10,
        }}>
          <ShieldAlert size={16} color="var(--danger)" className="pulse" />
          <span style={{
            fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: "var(--danger)",
            border: "1px solid var(--danger)", borderRadius: 99, padding: "1px 8px", letterSpacing: 0.4,
          }}>INTEGRITY ALERT</span>
          <span style={{ fontSize: 12.5 }}>
            {tamperedIdx.length} audit log {tamperedIdx.length === 1 ? "entry" : "entries"} failed hash verification — record may have been tampered with.
          </span>
          <button className="scenBtn" onClick={() => setShowAudit(true)} style={{
            marginLeft: "auto", fontSize: 11, padding: "5px 10px", borderRadius: 6,
            background: "var(--danger)", border: "none", color: "#1a0d0a", fontWeight: 600, whiteSpace: "nowrap",
          }}>Inspect chain</button>
        </div>
      )}

      {/* Ticker */}
      <div style={{ marginTop: 12, marginBottom: 14, height: 24, overflow: "hidden", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 48, whiteSpace: "nowrap", animation: "scrollTicker 28s linear infinite", fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>
          {[...(liveHeadlines || SIGNALS), ...(liveHeadlines || SIGNALS)].map((s, i) => (
            <span key={i}><Radio size={10} style={{ verticalAlign: -1, marginRight: 6, color: "var(--accent)" }} />{s}</span>
          ))}
        </div>
      </div>

      {/* Critical risk banner — visible on every tab */}
      {criticalEntries.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, background: "rgba(216,88,74,0.12)",
          border: "1px solid var(--danger)", borderRadius: 8, padding: "9px 13px", marginBottom: 14,
        }}>
          <AlertTriangle size={15} color="var(--danger)" className="pulse" />
          <span style={{
            fontFamily: "var(--mono)", fontSize: 10, fontWeight: 600, color: "var(--danger)",
            border: "1px solid var(--danger)", borderRadius: 99, padding: "1px 8px", letterSpacing: 0.4,
          }}>CRITICAL</span>
          <span style={{ fontSize: 12.5 }}>
            {criticalEntries.length === 1
              ? `${criticalEntries[0].name} is at critical risk (${Math.round(criticalEntries[0].score * 100)}%) — recommended decision window: 6 hrs`
              : `${criticalEntries.length} nodes at critical risk: ${criticalEntries.map((c) => `${c.name} (${Math.round(c.score * 100)}%)`).join(", ")}`}
          </span>
          <button className="scenBtn" onClick={() => setTab("risk")} style={{
            marginLeft: "auto", fontSize: 11, padding: "5px 10px", borderRadius: 6,
            background: "var(--danger)", border: "none", color: "#1a0d0a", fontWeight: 600, whiteSpace: "nowrap",
          }}>View details</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} className="tabBtn" onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 7,
              fontSize: 12, background: active ? "rgba(227,168,87,0.12)" : "var(--panel2)",
              border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
              color: active ? "var(--accent)" : "var(--text)", fontWeight: active ? 600 : 400,
            }}>
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ============ TAB: Risk Intelligence ============ */}
      {tab === "risk" && (
        <div className="fadein" style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>
            Live disruption probability by corridor & supplier
          </div>
          <table className="riskTable">
            <thead>
              <tr><th>Node</th><th>Type</th><th>Probability</th><th>Signal trend</th><th>Status</th></tr>
            </thead>
            <tbody>
              {[...RISK_ENTRIES].sort((a, b) => jitter(b.base, b.base * 10) - jitter(a.base, a.base * 10)).map((r, idx) => {
                const score = jitter(r.base, r.base * 10);
                const trendUp = Math.sin(tick * 0.6 + r.base * 10) > 0;
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.name}</td>
                    <td style={{ fontSize: 11.5, color: "var(--muted)" }}>{r.type}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: riskColor(score) }}>{Math.round(score * 100)}%</td>
                    <td>{trendUp ? <TrendingUp size={13} color="var(--danger)" /> : <TrendingDown size={13} color="var(--safe)" />}</td>
                    <td>
                      <span style={{
                        fontSize: 10, fontFamily: "var(--mono)", padding: "2px 7px", borderRadius: 99,
                        color: riskColor(score), border: `1px solid ${riskColor(score)}`,
                      }}>{riskLabel(score)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <div style={{ background: "var(--panel2)", borderRadius: 8, padding: "8px 12px", fontSize: 11.5 }}>
              <span style={{ color: "var(--muted)" }}>WTI </span><span className="sg" style={{ fontWeight: 700 }}>${REAL_DATA.wti}</span>
            </div>
            <div style={{ background: "var(--panel2)", borderRadius: 8, padding: "8px 12px", fontSize: 11.5 }}>
              <span style={{ color: "var(--muted)" }}>Brent </span><span className="sg" style={{ fontWeight: 700 }}>${REAL_DATA.brent}</span>
            </div>
            <div style={{ background: "var(--panel2)", borderRadius: 8, padding: "8px 12px", fontSize: 10.5, color: "var(--muted)", display: "flex", alignItems: "center" }}>
              as of {REAL_DATA.priceAsOf}
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 10.5, color: "var(--muted)" }}>
            Headline feed: live GDELT DOC 2.0 API ({feedStatus}) · probability scores: illustrative jitter over EIA/ACLED/OFAC-style inputs, not yet a trained model
          </div>
        </div>
      )}

      {/* ============ TAB: Scenario Modeller ============ */}
      {tab === "scenario" && (
        <div className="fadein" style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 18 }}>
          <PipelinePanel scenario={scenario} phase={phase} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>
                Simulate a disruption event
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {SCENARIOS.map((s) => {
                  const nodeRisk = NODES.find((n) => n.id === s.hit)?.risk ?? 0;
                  return (
                    <button key={s.id} className="scenBtn" onClick={() => {
                      const id = s.id === scenarioId ? null : s.id;
                      setScenarioId(id);
                      if (id) logAction(`Scenario triggered: ${s.label}`);
                    }} style={{
                      textAlign: "left", padding: "9px 11px", borderRadius: 8, fontSize: 12.5,
                      background: scenarioId === s.id ? "rgba(227,168,87,0.1)" : "var(--panel2)",
                      border: `1px solid ${scenarioId === s.id ? "var(--accent)" : "var(--border)"}`,
                      color: "var(--text)", display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <AlertTriangle size={13} color={scenarioId === s.id ? "var(--accent)" : "var(--muted)"} />
                      <span style={{ flex: 1 }}>{s.label}</span>
                      <span style={{
                        fontFamily: "var(--mono)", fontSize: 10.5, padding: "2px 7px", borderRadius: 99,
                        color: riskColor(nodeRisk), border: `1px solid ${riskColor(nodeRisk)}`, whiteSpace: "nowrap",
                      }}>{Math.round(nodeRisk * 100)}% risk</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {!scenario && (
              <div style={{ background: "var(--panel)", border: "1px dashed var(--border)", borderRadius: 10, padding: 20, fontSize: 12.5, color: "var(--muted)", textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                Select a scenario to model cascading impact on refining, prices and GDP.
              </div>
            )}
            {scenario && phase === "analyzing" && (
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 20, fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 10 }}>
                <Zap size={15} color="var(--accent)" className="pulse" /> Modelling cascading impact…
              </div>
            )}
            {scenario && phase === "ready" && (
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{scenario.desc}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  {[["Disruption probability", `${Math.round((NODES.find((n) => n.id === scenario.hit)?.risk ?? 0) * 100)}%`, "var(--danger)"], ["Price impact", scenario.priceDelta, "var(--danger)"], ["Transit delay", `${scenario.delayDays}d`, "var(--warn)"], ["GDP cascade risk", scenario.gdpRisk, "var(--warn)"]].map(([label, val, color]) => (
                    <div key={label} style={{ background: "var(--panel2)", borderRadius: 8, padding: "8px 8px" }}>
                      <div style={{ fontSize: 9.5, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
                      <div className="sg" style={{ fontSize: 15, fontWeight: 700, color }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div className="scenBtn" onClick={() => setTab("orchestrator")} style={{ marginTop: 10, fontSize: 11, color: "var(--accent)", display: "flex", alignItems: "center", gap: 5, width: "fit-content" }}>
                  See ranked reroutes in Procurement Orchestrator <ChevronRight size={12} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ TAB: Procurement Orchestrator ============ */}
      {tab === "orchestrator" && (
        <div className="fadein" style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: 0.4, textTransform: "uppercase" }}>
              Ranked alternative sources & routes
            </div>
            {!scenario && <span style={{ fontSize: 11, color: "var(--muted)" }}>showing baseline options — select a scenario in Scenario Modeller for a live ranking</span>}
          </div>
          {!scenario ? (
            <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "24px 8px", textAlign: "center" }}>
              No active disruption. Baseline procurement plan is nominal — no rerouting required.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {scenario.alternatives.map((a, i) => (
                <div key={i} className="altCard" onClick={() => { setSelectedAlt(i); logAction(`Procurement option selected: ${a.source} (rank #${i + 1})`); }} style={{
                  display: "grid", gridTemplateColumns: "28px 1.4fr 0.7fr 0.7fr 0.7fr 0.9fr", alignItems: "center",
                  gap: 10, padding: "11px 12px", borderRadius: 8, background: "var(--panel2)",
                  border: `1px solid ${selectedAlt === i ? "var(--accent)" : "var(--border)"}`,
                }}>
                  <div className="sg" style={{ fontSize: 14, color: i === 0 ? "var(--accent)" : "var(--muted)", fontWeight: 700 }}>#{i + 1}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.source}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>ETA {a.eta}</div>
                  <div style={{ fontSize: 11.5, color: "var(--warn)" }}>{a.costDelta}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>cap {a.capacity}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, justifySelf: "end" }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--safe)" }}>{Math.round(a.score * 100)}%</div>
                    {selectedAlt === i ? <CheckCircle2 size={14} color="var(--safe)" /> : <ArrowRight size={13} color="var(--muted)" />}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>
                Ranked by AI confidence score, weighting transit time, cost delta, and available capacity · click a row to select for execution
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ TAB: Reserve Optimisation ============ */}
      {tab === "reserve" && (
        <div className="fadein" style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 12 }}>
            Strategic reserve drawdown vs. supply gap forecast
          </div>
          {!scenario ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                <div style={{ background: "var(--panel2)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 9.5, color: "var(--muted)" }}>Current SPR level</div>
                  <div className="sg" style={{ fontSize: 15, fontWeight: 700 }}>{REAL_DATA.spr.current}M bbl</div>
                </div>
                <div style={{ background: "var(--panel2)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 9.5, color: "var(--muted)" }}>Authorized capacity</div>
                  <div className="sg" style={{ fontSize: 15, fontWeight: 700 }}>{REAL_DATA.spr.capacity}M bbl</div>
                </div>
                <div style={{ background: "var(--panel2)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 9.5, color: "var(--muted)" }}>Min safe operating level</div>
                  <div className="sg" style={{ fontSize: 15, fontWeight: 700, color: "var(--warn)" }}>{REAL_DATA.spr.minOperating}M bbl</div>
                </div>
                <div style={{ background: "var(--panel2)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 9.5, color: "var(--muted)" }}>Max drawdown rate</div>
                  <div className="sg" style={{ fontSize: 15, fontWeight: 700 }}>{REAL_DATA.spr.maxDrawdownPerDay}M bbl/day</div>
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", margin: "10px 0 4px" }}>
                Real EIA figures, {REAL_DATA.spr.asOf} — the reserve is already near its post-1983 low. Select a scenario in Scenario Modeller to see a forecasted drawdown schedule against this baseline.
              </div>
            </div>
          ) : (
            <>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <ComposedChart data={scenario.reserve.gap.map((g, i) => ({ day: `D${i + 1}`, gap: g, draw: scenario.reserve.draw[i] }))}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke="var(--muted)" tick={{ fontSize: 11, fill: "#7C8798" }} />
                    <YAxis stroke="var(--muted)" tick={{ fontSize: 11, fill: "#7C8798" }} label={{ value: "kbbl/day", angle: -90, position: "insideLeft", fill: "#7C8798", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#161D26", border: "1px solid #232B36", fontSize: 12 }} />
                    <Area type="monotone" dataKey="draw" name="Recommended drawdown" fill="rgba(227,168,87,0.25)" stroke="var(--accent)" strokeWidth={2} />
                    <Line type="monotone" dataKey="gap" name="Forecasted supply gap" stroke="var(--danger)" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
                <div style={{ background: "var(--panel2)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 9.5, color: "var(--muted)" }}>Peak supply gap</div>
                  <div className="sg" style={{ fontSize: 15, fontWeight: 700, color: "var(--danger)" }}>{Math.max(...scenario.reserve.gap)} kbbl/d</div>
                </div>
                <div style={{ background: "var(--panel2)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 9.5, color: "var(--muted)" }}>Total recommended draw</div>
                  <div className="sg" style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>{scenario.reserve.draw.reduce((a, b) => a + b, 0)} kbbl</div>
                </div>
                <div style={{ background: "var(--panel2)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 9.5, color: "var(--muted)" }}>SPR headroom above min level</div>
                  <div className="sg" style={{ fontSize: 15, fontWeight: 700, color: "var(--safe)" }}>{Math.round((REAL_DATA.spr.current - REAL_DATA.spr.minOperating) / REAL_DATA.spr.maxDrawdownPerDay)} days at max draw</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ TAB: Digital Twin ============ */}
      {tab === "twin" && (
        <div className="fadein" style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: 0.4, textTransform: "uppercase" }}>
              Geospatial network twin — continuous what-if simulation
            </div>
            <button className="scenBtn" onClick={() => { const nv = !whatIf; setWhatIf(nv); logAction(`Digital twin what-if ${nv ? "enabled" : "disabled"}`); }} style={{
              fontSize: 11.5, padding: "6px 12px", borderRadius: 7, background: whatIf ? "rgba(227,168,87,0.12)" : "var(--panel2)",
              border: `1px solid ${whatIf ? "var(--accent)" : "var(--border)"}`, color: whatIf ? "var(--accent)" : "var(--text)",
            }}>
              {whatIf ? "What-if: ON" : "Run what-if"}
            </button>
          </div>
          <DigitalTwinMap scenario={whatIf ? scenario : null} tick={tick} />
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>
            Node positions are approximate geospatial coordinates · toggle what-if to overlay the active scenario's disruption and reroute paths
          </div>
        </div>
      )}

      {/* Tamper-evident audit trail */}
      {showAudit && (
        <div className="fadein" style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: 0.4, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={13} color={tamperedIdx.length ? "var(--danger)" : "var(--safe)"} />
              Tamper-evident audit trail (SHA-256 hash chain)
            </div>
            <button className="scenBtn" onClick={simulateTamper} style={{
              fontSize: 10.5, padding: "5px 10px", borderRadius: 6, background: "var(--panel2)",
              border: "1px solid var(--border)", color: "var(--muted)",
            }}>Simulate tampering (demo)</button>
          </div>
          {auditLog.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--muted)", padding: "12px 4px" }}>
              No actions logged yet — trigger a scenario, select a procurement option, or toggle the digital twin what-if to see entries appear here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 220, overflowY: "auto" }}>
              {auditLog.map((e, i) => {
                const bad = tamperedIdx.includes(i);
                return (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "120px 1fr 90px", gap: 10, fontSize: 11,
                    padding: "6px 8px", borderRadius: 6, background: bad ? "rgba(216,88,74,0.14)" : "var(--panel2)",
                    border: `1px solid ${bad ? "var(--danger)" : "var(--border)"}`, fontFamily: "var(--mono)",
                  }}>
                    <span style={{ color: "var(--muted)" }}>{e.ts.slice(11, 19)}</span>
                    <span style={{ color: bad ? "var(--danger)" : "var(--text)", fontFamily: "IBM Plex Sans" }}>
                      {e.action} {bad && "⚠ TAMPERED"}
                    </span>
                    <span style={{ color: bad ? "var(--danger)" : "var(--safe)", textAlign: "right" }}>
                      {e.hash === "computing…" ? "…" : e.hash.slice(0, 8)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
            Each entry hashes its predecessor's hash together with its own timestamp and action — altering any past entry breaks the chain and is
            flagged immediately, without needing a central authority to detect it. "Simulate tampering" mutates a random past entry in place (bypassing
            the normal write path) to demonstrate detection; it doesn't defeat it.
          </div>
        </div>
      )}
    </div>
  );
}

// ================= Pipeline (scenario tab) =================
function PipelinePanel({ scenario, phase }) {
  const layout = { colW: 210, rowH: 108, padX: 40, padY: 30 };
  const lanes = [[], [], [], []];
  NODES.forEach((n) => lanes[n.lane].push(n));
  const pos = {};
  lanes.forEach((laneNodes, laneIdx) => {
    laneNodes.forEach((n, i) => {
      pos[n.id] = { x: layout.padX + laneIdx * layout.colW, y: layout.padY + i * layout.rowH + (laneNodes.length === 1 ? layout.rowH : 0) };
    });
  });
  const svgW = layout.padX * 2 + 3 * layout.colW + 40;
  const svgH = 420;
  const hitNode = scenario?.hit;
  const rerouteEdge = scenario?.reroute;

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 8px" }}>
      <div style={{ padding: "0 12px 10px", fontSize: 12, color: "var(--muted)", letterSpacing: 0.4, textTransform: "uppercase" }}>
        Supply chain flow — source → chokepoint → refinery → market
      </div>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height="380">
        {EDGES.map(([a, b], i) => {
          const pa = pos[a], pb = pos[b];
          const stroke = hitNode && a === hitNode ? "var(--danger)" : "var(--border)";
          return <line key={i} x1={pa.x + 78} y1={pa.y + 24} x2={pb.x} y2={pb.y + 24} stroke={stroke} strokeWidth={hitNode && a === hitNode ? 2 : 1.4} strokeDasharray={hitNode && a === hitNode ? "3 5" : "0"} opacity={hitNode && a === hitNode ? 0.5 : 1} />;
        })}
        {rerouteEdge && phase === "ready" && (() => {
          const p1 = pos[rerouteEdge.from], p2 = pos[rerouteEdge.via], p3 = pos[rerouteEdge.to];
          return (<>
            <line x1={p1.x + 78} y1={p1.y + 24} x2={p2.x} y2={p2.y + 24} stroke="var(--accent)" strokeWidth={2.4} className="flowline" />
            <line x1={p2.x + 78} y1={p2.y + 24} x2={p3.x} y2={p3.y + 24} stroke="var(--accent)" strokeWidth={2.4} className="flowline" />
          </>);
        })()}
        {NODES.map((n) => {
          const p = pos[n.id];
          const Icon = TYPE_ICON[n.type];
          const isHit = hitNode === n.id;
          const isRerouteNode = rerouteEdge && phase === "ready" && (n.id === rerouteEdge.via || n.id === rerouteEdge.to);
          const color = isHit ? "var(--danger)" : riskColor(n.risk);
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`}>
              <rect width="78" height="48" rx="9" fill="var(--panel2)" stroke={isHit ? "var(--danger)" : isRerouteNode ? "var(--accent)" : "var(--border)"} strokeWidth={isHit || isRerouteNode ? 2 : 1} className={isHit ? "pulse" : ""} />
              <foreignObject x="6" y="5" width="16" height="16"><Icon size={14} color={color} /></foreignObject>
              <text x="8" y="30" fontSize="9.5" fill="var(--text)" fontFamily="IBM Plex Sans" fontWeight="600">{n.label.length > 12 ? n.label.slice(0, 11) + "…" : n.label}</text>
              <text x="8" y="41" fontSize="7.5" fill="var(--muted)" fontFamily="IBM Plex Mono">{n.type === "market" ? "downstream" : `risk ${Math.round((isHit ? 0.95 : n.risk) * 100)}%`}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 16, padding: "4px 14px 2px", fontSize: 10.5, color: "var(--muted)" }}>
        <span><span style={{ color: "var(--safe)" }}>●</span> low risk</span>
        <span><span style={{ color: "var(--warn)" }}>●</span> elevated</span>
        <span><span style={{ color: "var(--danger)" }}>●</span> disrupted</span>
        {phase === "ready" && <span><span style={{ color: "var(--accent)" }}>┄</span> AI-recommended reroute</span>}
      </div>
    </div>
  );
}

// ================= Digital Twin geospatial map =================
function DigitalTwinMap({ scenario, tick }) {
  const W = 760, H = 380;
  const lonRange = [-100, 110], latRange = [60, -12];
  const X = (lon) => ((lon - lonRange[0]) / (lonRange[1] - lonRange[0])) * W;
  const Y = (lat) => ((lat - latRange[0]) / (latRange[1] - latRange[0])) * H;

  const hitNode = scenario?.hit;
  const rerouteEdge = scenario?.reroute;
  const dotGrid = [];
  for (let x = 0; x < W; x += 26) for (let y = 0; y < H; y += 26) dotGrid.push([x, y]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="380" style={{ background: "#0D131B", borderRadius: 8, border: "1px solid var(--border)" }}>
      {dotGrid.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.7} fill="#1B2430" />)}
      {EDGES.map(([a, b], i) => {
        const na = NODES.find((n) => n.id === a), nb = NODES.find((n) => n.id === b);
        const isHitEdge = hitNode && a === hitNode;
        return <line key={i} x1={X(na.lon)} y1={Y(na.lat)} x2={X(nb.lon)} y2={Y(nb.lat)} stroke={isHitEdge ? "var(--danger)" : "#2A3644"} strokeWidth={isHitEdge ? 2 : 1} strokeDasharray={isHitEdge ? "3 5" : "0"} />;
      })}
      {rerouteEdge && (() => {
        const p1 = NODES.find((n) => n.id === rerouteEdge.from), p2 = NODES.find((n) => n.id === rerouteEdge.via), p3 = NODES.find((n) => n.id === rerouteEdge.to);
        return (<>
          <line x1={X(p1.lon)} y1={Y(p1.lat)} x2={X(p2.lon)} y2={Y(p2.lat)} stroke="var(--accent)" strokeWidth={2} className="flowline" />
          <line x1={X(p2.lon)} y1={Y(p2.lat)} x2={X(p3.lon)} y2={Y(p3.lat)} stroke="var(--accent)" strokeWidth={2} className="flowline" />
        </>);
      })()}
      {NODES.map((n) => {
        const isHit = hitNode === n.id;
        const color = isHit ? "var(--danger)" : riskColor(n.risk);
        const r = n.type === "market" ? 4 : 6;
        return (
          <g key={n.id} transform={`translate(${X(n.lon)},${Y(n.lat)})`}>
            {isHit && <circle r={12} fill="none" stroke="var(--danger)" strokeWidth={1.2} className="pulse" />}
            <circle r={r} fill={color} opacity={0.9} />
            <circle r={r} fill="none" stroke="#0D131B" strokeWidth={1.5} />
            <text x={9} y={3} fontSize="9.5" fill="#C9D2DC" fontFamily="IBM Plex Mono">{n.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
