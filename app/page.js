"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ------------------------------------------------------------------ helpers */
const C = {
  bg: "#07070C", panel: "#0F0F18", panel2: "#14141F", line: "rgba(130,140,170,0.12)",
  ink: "#E8EAF2", muted: "#888EA6", cyan: "#22D3EE", violet: "#8B5CF6",
  green: "#34D399", amber: "#FBBF24", red: "#FB7185",
};
const mono = "var(--mono)";
const display = "var(--display)";

const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString();
const num = (n) => (Number(n) || 0).toLocaleString();
function timeAgo(ts) {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 0) return "now";
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}
const humanize = (x) => (x || "").replace(/[_-]+/g, " ").trim();
function logTone(action = "") {
  const a = action.toLowerCase();
  if (a.includes("error") || a.includes("fail") || a.includes("reject")) return C.red;
  if (a.includes("sale") || a.includes("paid") || a.includes("fund") || a.includes("merged") || a.includes("launch") || a.includes("purchase")) return C.green;
  if (a.includes("build") || a.includes("deploy") || a.includes("generat") || a.includes("repair")) return C.cyan;
  return C.muted;
}
const agentColor = (s) => (s === "active" ? C.green : s === "running" ? C.cyan : s === "error" ? C.red : C.muted);

/* ------------------------------------------------------------------ charts */
function AreaChart({ data, color = C.green, h = 130 }) {
  const w = 520;
  const vals = data.map((d) => d.v);
  const max = Math.max(1, ...vals);
  const stepX = vals.length > 1 ? w / (vals.length - 1) : w;
  const pts = vals.map((v, i) => [i * stepX, h - 14 - (v / max) * (h - 28)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  const id = "g" + color.replace("#", "");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke={C.line} strokeWidth="1" />
      ))}
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.length > 0 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={color} />}
    </svg>
  );
}

function Sparkline({ vals, color = C.cyan, w = 90, h = 28 }) {
  if (!vals || vals.length === 0) vals = [0, 0];
  const max = Math.max(1, ...vals);
  const stepX = vals.length > 1 ? w / (vals.length - 1) : w;
  const line = vals.map((v, i) => (i ? "L" : "M") + (i * stepX).toFixed(1) + " " + (h - 2 - (v / max) * (h - 4)).toFixed(1)).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} preserveAspectRatio="none">
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// Known stage order + colors; any other status the data has is appended.
const STAGE_ORDER = ["ideation", "research_complete", "building", "needs_rebuild", "built", "validated", "launched", "retired", "rejected"];
const STAGE_COLOR = { ideation: C.muted, research_complete: C.muted, building: C.cyan, needs_rebuild: C.amber, built: C.violet, validated: C.violet, launched: C.green, retired: C.muted, rejected: C.red };
function Funnel({ byStatus }) {
  const keys = Object.keys(byStatus || {});
  const ordered = [...STAGE_ORDER.filter((k) => keys.includes(k)), ...keys.filter((k) => !STAGE_ORDER.includes(k))];
  const max = Math.max(1, ...ordered.map((k) => byStatus[k] || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {ordered.map((k) => {
        const v = byStatus[k] || 0;
        const color = STAGE_COLOR[k] || C.cyan;
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 92, fontFamily: mono, fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.replace(/_/g, " ")}</span>
            <div style={{ flex: 1, height: 22, background: "rgba(255,255,255,0.03)", borderRadius: 4, overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${(v / max) * 100}%` }} transition={{ duration: 0.7, ease: "easeOut" }}
                style={{ height: "100%", background: color, opacity: 0.85, minWidth: v > 0 ? 6 : 0 }} />
            </div>
            <span style={{ width: 28, textAlign: "right", fontFamily: mono, fontSize: 13, color: C.ink }}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}

function Bars({ items, color = C.violet }) {
  const max = Math.max(1, ...items.map((i) => i.v));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, paddingTop: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
          <motion.div initial={{ height: 0 }} animate={{ height: `${(it.v / max) * 92}px` }} transition={{ delay: i * 0.04, duration: 0.5 }}
            style={{ width: "100%", maxWidth: 26, borderRadius: "3px 3px 0 0", background: `linear-gradient(180deg, ${color}, ${color}55)` }} title={`${it.label}: ${it.v}`} />
          <span style={{ fontFamily: mono, fontSize: 9.5, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 44 }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

/* heartbeat — the company's vital sign */
function Heartbeat({ alive }) {
  return (
    <svg viewBox="0 0 120 24" width="120" height="24" aria-hidden>
      <path d="M0 12 H38 L44 4 L52 20 L58 12 H120" fill="none" stroke={alive ? C.green : C.muted} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" opacity="0.5" />
      {alive && (
        <motion.circle r="2.6" fill={C.green}
          animate={{ cx: [0, 38, 44, 52, 58, 120], cy: [12, 12, 4, 20, 12, 12] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }} />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ shells */
function Panel({ title, hint, right, children, style }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18, minWidth: 0, overflow: "hidden", ...style }}>
      {(title || right) && (
        <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: display, fontSize: 14, fontWeight: 600, letterSpacing: 0.2, color: C.ink }}>{title}</h2>
            {hint && <p style={{ margin: "3px 0 0", fontSize: 11, color: C.muted }}>{hint}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

function Vital({ label, value, accent, sub, spark }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: accent }} />
      <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.muted }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
        <div style={{ fontFamily: display, fontSize: 30, fontWeight: 700, color: C.ink, lineHeight: 1 }}>{value}</div>
        {spark && <Sparkline vals={spark} color={accent} />}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>{sub}</div>}
    </div>
  );
}

function StatusPill({ color, label, pulse }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 20, background: C.panel, border: `1px solid ${C.line}` }}>
      <span style={{ position: "relative", width: 7, height: 7 }}>
        <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
        {pulse && <motion.span style={{ position: "absolute", inset: -3, borderRadius: "50%", border: `1px solid ${color}` }} animate={{ scale: [1, 1.9], opacity: [0.7, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />}
      </span>
      <span style={{ color: "#B7BCCB" }}>{label}</span>
    </span>
  );
}

function Empty({ text, h = 120 }) {
  return (
    <div style={{ height: h, display: "grid", placeItems: "center", textAlign: "center", padding: "0 20px" }}>
      <p style={{ margin: 0, fontSize: 12.5, color: C.muted, lineHeight: 1.5, maxWidth: 280 }}>{text}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ page */
export default function Home() {
  const [a, setA] = useState(null);
  const [ins, setIns] = useState(null);
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [deploy, setDeploy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(0);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [reports, setReports] = useState(null);
  const [openReport, setOpenReport] = useState(null);

  const loadReports = async () => {
    setReportsOpen(true);
    try { const r = await fetch("/api/reports?limit=25"); if (r.ok) { const d = await r.json(); setReports(d.reports || []); } } catch {}
  };

  useEffect(() => { setLastSeen(Number(localStorage.getItem("nexai_last_seen") || 0)); }, []);

  const fetchSlow = useCallback(async () => {
    try {
      const [ar, ir] = await Promise.all([fetch("/api/analytics"), fetch("/api/insights")]);
      if (ar.ok) setA(await ar.json());
      if (ir.ok) setIns(await ir.json());
    } catch {}
  }, []);
  const fetchFast = useCallback(async () => {
    try {
      const [sr, lr, dr] = await Promise.all([
        fetch("/api/status"),
        fetch("/api/logs?count=40"),
        fetch("/api/agents/deploy").catch(() => null),
      ]);
      if (sr?.ok) setStatus(await sr.json());
      if (lr?.ok) { const d = await lr.json(); setLogs(Array.isArray(d) ? d : d.logs || []); }
      if (dr?.ok) setDeploy(await dr.json());
    } catch {}
  }, []);

  useEffect(() => {
    (async () => { await Promise.all([fetchSlow(), fetchFast()]); setLoading(false); })();
    const f = setInterval(fetchFast, 12000);
    const s = setInterval(fetchSlow, 30000);
    return () => { clearInterval(f); clearInterval(s); };
  }, [fetchSlow, fetchFast]);

  const runCycle = async () => {
    if (running) return;
    setRunning(true);
    try { await fetch("/api/cron/daily-agents"); await Promise.all([fetchFast(), fetchSlow()]); } catch {}
    setRunning(false);
  };

  const fin = a?.financials || {};
  const agents = status?.agents || a?.agents || [];
  const onlineCount = agents.filter((x) => x.status === "active" || x.status === "running").length;
  const byStatus = a?.pipeline?.by_status || {};
  const products = a?.products || [];
  const topProducts = a?.top_products || [];
  const liveProducts = products.filter((p) => p.status === "live" || p.status === "launched").length || (byStatus.launched || 0);
  const revByDay = fin.revenue_by_day || {};
  const revSeries = Object.keys(revByDay).sort().map((k) => ({ k, v: Number(revByDay[k]) || 0 }));
  const revSpark = revSeries.map((d) => d.v);

  const lastEvent = logs[0];
  const alive = lastEvent && (Date.now() - new Date(lastEvent.created_at).getTime()) < 20 * 60 * 1000;

  const agentBars = agents.slice(0, 8).map((ag) => {
    const da = a?.agents?.find((x) => x.key === ag.key);
    return { label: ag.key, v: (da?.recentActions ?? da?.tasksCompleted ?? ag.tasksCompleted ?? 0) };
  });

  const pendingBuild = deploy?.counts?.find?.((c) => c.status === "pending")?.n || 0;
  const deployments = deploy?.deployments || [];
  const activeDeploy = deployments.find((d) => d.status === "building");

  // Notifications = the things actually happening: insights + meaningful events
  // (sales, products launched/discontinued, deploys, hires/fires, errors, throttles).
  const NOTE = /sale|fund|paid|purchase|launch|discontinu|merged|build_started|build_failed|agent_created|agent_removed|hiring|repair|throttled|error|reject|product_/i;
  const notifs = [];
  for (const i of (ins?.insights || [])) {
    notifs.push({ tone: i.priority === "high" ? C.amber : i.priority === "medium" ? C.cyan : C.muted, title: i.title, body: i.content, ts: i.created_at || ins.timestamp });
  }
  for (const l of logs.slice(0, 40)) {
    if (!NOTE.test(l.action || "")) continue;
    notifs.push({ tone: logTone(l.action), title: `${l.agent}: ${humanize(l.action)}`, body: l.details ? String(l.details).replace(/[{}"]/g, "") : "", ts: l.created_at });
  }
  notifs.sort((x, y) => new Date(y.ts || 0) - new Date(x.ts || 0));
  const unread = notifs.filter((n) => new Date(n.ts || 0).getTime() > lastSeen).length;
  const openNotifs = () => {
    setNotifOpen((o) => !o);
    if (!notifOpen) { const now = Date.now(); localStorage.setItem("nexai_last_seen", String(now)); setLastSeen(now); }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <Heartbeat alive />
          <p style={{ fontFamily: mono, fontSize: 12, color: C.muted, marginTop: 12, letterSpacing: 1 }}>CONNECTING TO NEXAI…</p>
        </div>
      </div>
    );
  }

  const maxW = 1240;
  return (
    <div style={{ minHeight: "100vh", paddingBottom: 64, overflowX: "hidden" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(7,7,12,0.82)", backdropFilter: "blur(14px)", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: maxW, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontFamily: display, fontSize: 19, fontWeight: 700, letterSpacing: -0.4 }}>Nex<span style={{ color: C.cyan }}>AI</span></div>
            <span style={{ fontFamily: mono, fontSize: 10.5, color: C.muted, letterSpacing: 1, textTransform: "uppercase", borderLeft: `1px solid ${C.line}`, paddingLeft: 16 }}>Autonomous Company Control</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div title="Company vital sign" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Heartbeat alive={alive} />
              <span style={{ fontFamily: mono, fontSize: 11, color: alive ? C.green : C.muted }}>{alive ? "OPERATIONAL" : "IDLE"}</span>
            </div>
            <div style={{ position: "relative" }}>
              <button onClick={openNotifs} aria-label="Notifications" style={{ position: "relative", width: 38, height: 38, borderRadius: 10, background: C.panel, border: `1px solid ${C.line}`, color: C.ink, cursor: "pointer" }}>
                <span style={{ fontSize: 15 }}>◔</span>
                {unread > 0 && <span style={{ position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 9, background: C.red, color: "#0b0b10", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", fontFamily: mono }}>{unread}</span>}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    style={{ position: "absolute", right: 0, top: 46, width: 340, maxHeight: 420, overflowY: "auto", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 24px 60px rgba(0,0,0,0.55)", zIndex: 60 }}>
                    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.line}`, fontFamily: mono, fontSize: 11, color: C.muted, letterSpacing: 1 }}>NOTIFICATIONS</div>
                    {notifs.length === 0 && <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>All quiet. Agent activity shows up here.</div>}
                    {notifs.slice(0, 30).map((n, i) => (
                      <div key={i} style={{ padding: "11px 14px", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 10 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: n.tone, marginTop: 5, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.4 }}>{n.title}</div>
                          {n.body && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(n.body).slice(0, 80)}</div>}
                          <div style={{ fontFamily: mono, fontSize: 10, color: C.muted, marginTop: 3 }}>{timeAgo(n.ts)} ago</div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button onClick={loadReports}
              style={{ padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontFamily: display, fontWeight: 600, fontSize: 13, color: C.ink, background: C.panel, border: `1px solid ${C.line}` }}>
              Reports
            </button>
            <button onClick={runCycle} disabled={running}
              style={{ padding: "9px 16px", borderRadius: 10, border: "none", cursor: running ? "wait" : "pointer", fontFamily: display, fontWeight: 600, fontSize: 13, color: "#06121A", background: `linear-gradient(135deg, ${C.cyan}, ${C.violet})`, opacity: running ? 0.7 : 1 }}>
              {running ? "Running…" : "Run cycle"}
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: maxW, margin: "0 auto", padding: "26px 24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 22, fontFamily: mono, fontSize: 11 }}>
          <StatusPill color={alive ? C.green : C.amber} label={`Last event ${timeAgo(lastEvent?.created_at)} ago`} pulse={alive} />
          <StatusPill color={C.cyan} label={`${onlineCount}/${agents.length} agents online`} />
          <StatusPill color={activeDeploy ? C.cyan : pendingBuild ? C.amber : C.green} label={activeDeploy ? `Deploying ${activeDeploy.branch}` : pendingBuild ? `${pendingBuild} build queued` : "Code synced"} pulse={!!activeDeploy} />
          <StatusPill color={C.violet} label={`${num(a?.pipeline?.total || 0)} products tracked`} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 16 }}>
          <Vital label="Revenue" value={money(fin.total_revenue)} accent={C.green} spark={revSpark} sub={`${money(fin.pending_revenue)} pending · ${fin.collection_rate || 0}% collected`} />
          <Vital label="Agents online" value={`${onlineCount}/${agents.length}`} accent={C.cyan} sub={`${agents.filter((x) => x.status === "running").length} executing now`} />
          <Vital label="Products live" value={num(liveProducts)} accent={C.violet} sub={`${num(a?.pipeline?.total || 0)} in pipeline`} />
          <Vital label="Invoices paid" value={num(fin.paid_invoices || 0)} accent={C.amber} sub={`${num(fin.total_invoices || 0)} total invoices`} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }} className="nx-2col">
          <Panel title="Revenue" hint="Collected per day, last 7 days" right={<span style={{ fontFamily: mono, fontSize: 18, color: C.green }}>{money(fin.total_revenue)}</span>}>
            {revSpark.some((v) => v > 0) ? <AreaChart data={revSeries} color={C.green} /> : <Empty text="No revenue yet. The first agent purchase will show here." h={130} />}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: mono, fontSize: 9.5, color: C.muted }}>
              {revSeries.map((d, i) => <span key={i}>{d.k.slice(5)}</span>)}
            </div>
          </Panel>
          <Panel title="Product pipeline" hint="Ideas advancing to launch">
            {(a?.pipeline?.total || 0) > 0 ? <Funnel byStatus={byStatus} /> : <Empty text="No products yet. Agents are still building the catalog." h={120} />}
          </Panel>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, marginBottom: 16 }} className="nx-2col">
          <Panel title="Agent crew" hint={`${agents.length} agents on the roster`}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {agents.map((ag) => {
                const da = a?.agents?.find((x) => x.key === ag.key);
                return (
                  <div key={ag.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 6px", borderBottom: `1px solid ${C.line}` }}>
                    <span style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
                      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: agentColor(ag.status) }} />
                      {ag.status === "running" && <motion.span style={{ position: "absolute", inset: -3, borderRadius: "50%", border: `1px solid ${C.cyan}` }} animate={{ scale: [1, 1.8], opacity: [0.7, 0] }} transition={{ duration: 1.4, repeat: Infinity }} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "capitalize" }}>{ag.name || ag.key}</span>
                    <span style={{ fontFamily: mono, fontSize: 10.5, color: agentColor(ag.status), textTransform: "uppercase", width: 62, textAlign: "right" }}>{ag.status}</span>
                    <span style={{ fontFamily: mono, fontSize: 10.5, color: C.muted, width: 62, textAlign: "right" }}>{num(da?.tasksCompleted ?? ag.tasksCompleted ?? 0)} runs</span>
                    <span style={{ fontFamily: mono, fontSize: 10.5, color: C.muted, width: 34, textAlign: "right" }}>{timeAgo(ag.lastRun)}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel title="Live telemetry" hint="Real-time agent activity stream"
            right={<span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: 10, color: C.muted }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: alive ? C.green : C.muted }} />STREAM</span>}>
            <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {logs.length === 0 && <Empty text="No activity yet. Hit Run cycle to wake the agents." h={120} />}
              {logs.map((l, i) => (
                <div key={`${l.id}-${i}`} style={{ display: "flex", gap: 10, padding: "7px 2px", borderBottom: `1px solid ${C.line}`, alignItems: "baseline" }}>
                  <span style={{ fontFamily: mono, fontSize: 10, color: C.muted, width: 34, flexShrink: 0 }}>{timeAgo(l.created_at)}</span>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: logTone(l.action), flexShrink: 0, alignSelf: "center" }} />
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.cyan, width: 78, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.agent}</span>
                  <span style={{ fontSize: 12, color: C.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{humanize(l.action)}{l.details ? <span style={{ color: C.muted }}> — {String(l.details).replace(/[{}"]/g, "").slice(0, 70)}</span> : null}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }} className="nx-2col">
          <Panel title="Agent throughput" hint="Total runs per agent">
            {agentBars.some((b) => b.v > 0) ? <Bars items={agentBars} /> : <Empty text="No agent runs recorded yet." h={120} />}
          </Panel>
          <Panel title="Top products" hint="Ranked by sales revenue"
            right={<a href="/store" style={{ fontFamily: mono, fontSize: 11, color: C.cyan, textDecoration: "none" }}>Open store →</a>}>
            {topProducts.length === 0
              ? <Empty text="No services live yet. The Product agent lists them as it invents them." h={120} />
              : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", gap: 10, padding: "0 2px 8px", fontFamily: mono, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${C.line}` }}>
                    <span style={{ width: 18 }}>#</span>
                    <span style={{ flex: 1 }}>Product</span>
                    <span style={{ width: 48, textAlign: "right" }}>Sales</span>
                    <span style={{ width: 80, textAlign: "right" }}>Revenue</span>
                  </div>
                  {topProducts.map((p, i) => (
                    <div key={p.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", borderBottom: `1px solid ${C.line}` }}>
                      <span style={{ width: 18, fontFamily: mono, fontSize: 12, color: i === 0 && p.sales > 0 ? C.amber : C.muted }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}{p.status === "retired" ? <span style={{ color: C.muted, fontSize: 11 }}> · retired</span> : null}
                      </span>
                      <span style={{ width: 48, textAlign: "right", fontFamily: mono, fontSize: 12, color: p.sales > 0 ? C.cyan : C.muted }}>{num(p.sales)}</span>
                      <span style={{ width: 80, textAlign: "right", fontFamily: mono, fontSize: 12, color: p.revenue > 0 ? C.green : C.muted }}>{money(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
          </Panel>
        </div>

        <div style={{ marginTop: 16 }}>
          <Panel title="Shipped" hint="Code the build-gate built, tested, and merged to production">
            {deployments.length === 0
              ? <Empty text="Nothing shipped yet. When an agent's code passes the build-gate, the deploy shows here." h={100} />
              : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {deployments.map((d, i) => {
                    const tone = d.status === "merged" ? C.green : d.status === "failed" ? C.red : C.cyan;
                    return (
                      <div key={d.id || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 2px", borderBottom: `1px solid ${C.line}` }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: tone, flexShrink: 0 }} />
                        <span style={{ fontFamily: mono, fontSize: 11.5, color: C.ink, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.branch}</span>
                        <span style={{ fontFamily: mono, fontSize: 10.5, color: tone, textTransform: "uppercase", width: 70, textAlign: "right" }}>{d.status === "merged" ? "shipped" : d.status}</span>
                        <span style={{ fontFamily: mono, fontSize: 10, color: C.muted, width: 36, textAlign: "right" }}>{timeAgo(d.updated_at || d.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
          </Panel>
        </div>

        {(ins?.strategy || status?.strategy) && (
          <Panel title="Current strategy" hint="Set autonomously by the CEO agent" style={{ marginTop: 16 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#C3C7D6" }}>{ins?.strategy || status?.strategy}</p>
          </Panel>
        )}
      </main>

      <AnimatePresence>
        {reportsOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setReportsOpen(false); setOpenReport(null); }}
            style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(3,3,6,0.7)", backdropFilter: "blur(6px)", display: "grid", placeItems: "center", padding: 20 }}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 680, maxHeight: "84vh", display: "flex", flexDirection: "column", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.line}` }}>
                <div>
                  <h2 style={{ margin: 0, fontFamily: display, fontSize: 16, fontWeight: 700 }}>Analytics reports</h2>
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: C.muted }}>Snapshots written by the analytics agents</p>
                </div>
                <button onClick={() => { setReportsOpen(false); setOpenReport(null); }} style={{ width: 34, height: 34, borderRadius: 8, background: C.panel, border: `1px solid ${C.line}`, color: C.muted, cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>
              <div style={{ overflowY: "auto", padding: 12 }}>
                {!reports && <Empty text="Loading reports…" h={120} />}
                {reports && reports.length === 0 && <Empty text="No reports yet. They appear as the analytics agents run." h={120} />}
                {reports && reports.map((r) => {
                  const open = openReport === r.id;
                  return (
                    <div key={r.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                      <button onClick={() => setOpenReport(open ? null : r.id)} style={{ width: "100%", textAlign: "left", padding: "12px 14px", background: open ? C.panel : "transparent", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, color: C.ink }}>{r.title}</div>
                          {r.summary && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: open ? "normal" : "nowrap" }}>{r.summary}</div>}
                        </div>
                        <span style={{ fontFamily: mono, fontSize: 10, color: C.muted, flexShrink: 0 }}>{timeAgo(r.created_at)} ago</span>
                      </button>
                      {open && r.data && (
                        <pre style={{ margin: 0, padding: 14, borderTop: `1px solid ${C.line}`, background: "#0A0A12", fontFamily: mono, fontSize: 11, color: "#AEB4C7", overflowX: "auto", maxHeight: 280 }}>
                          {JSON.stringify(r.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@media (max-width: 880px) { .nx-2col { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
