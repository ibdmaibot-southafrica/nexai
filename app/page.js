"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Activity,
  Users,
  DollarSign,
  Zap,
  Send,
  X,
  BarChart3,
  Code2,
  Megaphone,
  LineChart,
  Crown,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
  LayoutDashboard,
  GitBranch,
  Settings,
  ArrowUpRight,
  CircleDot,
  Wallet,
  FileText,
  Target,
  Rocket,
  Play,
  Eye,
} from "lucide-react";

const AGENTS_CONFIG = [
  { key: "ceo", name: "CEO Agent", icon: Crown, color: "#7b2ff7", description: "Strategic decisions, goal-setting, and company direction" },
  { key: "marketing", name: "Marketing Agent", icon: Megaphone, color: "#00d4ff", description: "Brand strategy, content, and market positioning" },
  { key: "tech", name: "Tech Agent", icon: Code2, color: "#00ff88", description: "Product development, engineering, and technical ops" },
  { key: "finance", name: "Finance Agent", icon: Wallet, color: "#ffaa00", description: "Financial planning, invoicing, and budget management" },
  { key: "analytics", name: "Analytics Agent", icon: LineChart, color: "#ff4466", description: "Data analysis, reporting, and performance insights" },
];

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "pipeline", label: "Pipeline", icon: GitBranch },
  { key: "agents", label: "Agents", icon: Settings },
];

const PIPELINE_STAGES = [
  { name: "Ideation", statuses: ["research_complete"] },
  { name: "Development", statuses: ["building", "needs_rebuild"] },
  { name: "Testing", statuses: ["built"] },
  { name: "Launch", statuses: ["launched"] },
];

const STATUS_PROGRESS = {
  research_complete: 25,
  building: 50,
  needs_rebuild: 40,
  built: 75,
  launched: 100,
  rejected: 0,
};

export default function Home() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  // Brain modal
  const [showBrain, setShowBrain] = useState(false);
  const [brainInput, setBrainInput] = useState("");
  const [brainMessages, setBrainMessages] = useState([
    { role: "assistant", content: "Hello! I'm the NexAI Brain. I can help you direct any of our 5 autonomous agents, check company status, or run strategic initiatives. What would you like to do?" },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const brainEndRef = useRef(null);

  // Contact form
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", company: "", message: "" });
  const [contactSent, setContactSent] = useState(false);

  // Agent running state
  const [runningAgent, setRunningAgent] = useState(null);
  const [viewingLogs, setViewingLogs] = useState(null);
  const [agentLogs, setAgentLogs] = useState({});

  // --- Data fetching ---
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/logs?count=30");
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchLogs()]);
      setLoading(false);
    };
    load();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchLogs]);

  useEffect(() => {
    brainEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [brainMessages]);

  // --- Handlers ---
  const handleSendBrainMessage = async () => {
    if (!brainInput.trim() || isThinking) return;
    const userMsg = { role: "user", content: brainInput.trim() };
    setBrainMessages((prev) => [...prev, userMsg]);
    setBrainInput("");
    setIsThinking(true);
    try {
      const res = await fetch("/api/brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content }),
      });
      const data = await res.json();
      setBrainMessages((prev) => [...prev, { role: "assistant", content: data.response || "I'm having trouble processing that. Please try again." }]);
    } catch {
      setBrainMessages((prev) => [...prev, { role: "assistant", content: "Connection issue. Please try again in a moment." }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleRunAllAgents = async () => {
    setIsThinking(true);
    setBrainMessages((prev) => [...prev, { role: "assistant", content: "🚀 Initiating full agent sweep — running all 5 autonomous agents..." }]);
    try {
      const res = await fetch("/api/cron/daily-agents", { method: "POST" });
      const data = await res.json();
      await fetchStatus();
      await fetchLogs();
      const results = data.results || [];
      const summary = results.map((r) => `• ${r.agent} — ${r.action}${r.product ? ` (${r.product})` : ""}`).join("\n");
      setBrainMessages((prev) => [...prev, { role: "assistant", content: `✅ Agent cycle complete (${data.duration}):\n\n${summary}\n\nCheck the Dashboard for updated metrics!` }]);
    } catch {
      setBrainMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Agent run encountered an issue. Please try again." }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleRunAgent = async (agentKey) => {
    try {
      const res = await fetch(`/api/agent/${agentKey}`, { method: "POST" });
      const data = await res.json();
      await fetchStatus();
      await fetchLogs();
      return data;
    } catch (err) {
      console.error(`Failed to run agent ${agentKey}:`, err);
      return { success: false };
    }
  };

  const handleRunAgentClick = async (agentKey) => {
    setRunningAgent(agentKey);
    await handleRunAgent(agentKey);
    setRunningAgent(null);
  };

  const handleViewLogs = async (agentKey) => {
    try {
      const res = await fetch(`/api/agent/${agentKey}`);
      const data = await res.json();
      setAgentLogs((prev) => ({ ...prev, [agentKey]: data.recentLogs || [] }));
      setViewingLogs(agentKey);
    } catch (err) {
      console.error(`Failed to fetch logs for ${agentKey}:`, err);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: contactForm.name,
          product: `NexAI Inquiry — ${contactForm.company || "General"}`,
          amount: 0,
          message: contactForm.message,
          email: contactForm.email,
        }),
      });
    } catch (err) {
      console.error("Contact form error:", err);
    }
    setContactSent(true);
    setTimeout(() => {
      setShowContactForm(false);
      setContactSent(false);
      setContactForm({ name: "", email: "", company: "", message: "" });
    }, 3000);
  };

  // --- Helpers ---
  const getStatusColor = (s) => {
    if (s === "active" || s === "operational") return "#00ff88";
    if (s === "warning" || s === "pending") return "#ffaa00";
    return "#ff4466";
  };

  const formatTime = (ts) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // --- Loading screen ---
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#08080f" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
          <Loader2 size={40} color="#00d4ff" />
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ fontSize: 14, color: "#8888a0", letterSpacing: 1 }}>
          Initializing NexAI...
        </motion.p>
      </div>
    );
  }

  // --- Render ---
  const pipeline = status?.pipeline || [];
  const agents = status?.agents || [];
  const invoices = status?.invoices || {};

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", background: "#08080f" }}>
      {/* Background orbs */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <motion.div
          animate={{ background: ["radial-gradient(ellipse at 20% 20%, rgba(123,47,247,0.12) 0%, transparent 50%)", "radial-gradient(ellipse at 80% 80%, rgba(0,212,255,0.1) 0%, transparent 50%)", "radial-gradient(ellipse at 50% 50%, rgba(123,47,247,0.08) 0%, transparent 50%)"] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", top: "-20%", left: "-10%", width: "60%", height: "60%", borderRadius: "50%", filter: "blur(80px)" }}
        />
        <motion.div
          animate={{ background: ["radial-gradient(ellipse at 80% 20%, rgba(0,212,255,0.1) 0%, transparent 50%)", "radial-gradient(ellipse at 20% 80%, rgba(123,47,247,0.1) 0%, transparent 50%)", "radial-gradient(ellipse at 60% 30%, rgba(0,255,136,0.06) 0%, transparent 50%)"] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", bottom: "-20%", right: "-10%", width: "50%", height: "50%", borderRadius: "50%", filter: "blur(80px)" }}
        />
      </div>

      {/* Header */}
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }} style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(8,8,15,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(30,30,50,0.6)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.5 }} style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Brain size={28} color="#00d4ff" />
            </motion.div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, background: "linear-gradient(135deg, #00d4ff, #7b2ff7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0, lineHeight: 1.1 }}>NexAI</h1>
              <p style={{ fontSize: 11, color: "#8888a0", margin: 0, letterSpacing: 1, textTransform: "uppercase" }}>Autonomous Company OS</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block", background: getStatusColor(status?.status), boxShadow: `0 0 8px ${getStatusColor(status?.status)}` }} />
              <span style={{ fontSize: 12, color: "#00ff88", fontWeight: 600 }}>{status?.status === "operational" ? "All Systems Go" : status?.status || "Loading..."}</span>
            </div>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowBrain(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10, background: "linear-gradient(135deg, #7b2ff7, #00d4ff)", border: "none", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 20px rgba(123,47,247,0.3)" }}>
              <Sparkles size={16} color="#fff" />
              <span>AI Brain</span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Tabs */}
      <motion.nav initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, duration: 0.4 }} style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 0", display: "flex", gap: 4, position: "relative", zIndex: 1 }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <motion.button key={tab.key} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setActiveTab(tab.key)} style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: isActive ? "rgba(0,212,255,0.08)" : "transparent", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, overflow: "hidden" }}>
              <Icon size={18} color={isActive ? "#00d4ff" : "#8888a0"} />
              <span style={{ color: isActive ? "#f0f0f5" : "#8888a0" }}>{tab.label}</span>
              {isActive && <motion.div layoutId="tabIndicator" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #00d4ff, #7b2ff7)", borderRadius: 1 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            </motion.button>
          );
        })}
      </motion.nav>

      {/* Main */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px", position: "relative", zIndex: 1 }}>
        <AnimatePresence mode="wait">
          {/* ==================== DASHBOARD ==================== */}
          {activeTab === "dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Revenue (MTD)", value: `$${(status?.financials?.revenue || 0).toLocaleString()}`, change: status?.financials?.growth || "+0%", icon: DollarSign, color: "#00ff88" },
                  { label: "Active Agents", value: `${agents.filter((a) => a.status === "active").length}/5`, change: agents.every((a) => a.status === "active") ? "All online" : "Some idle", icon: Users, color: "#00d4ff" },
                  { label: "Pipeline Items", value: pipeline.length, change: `${pipeline.filter((p) => p.status === "building").length} in progress`, icon: GitBranch, color: "#7b2ff7" },
                  { label: "Invoices", value: invoices.total || 0, change: `${invoices.pending || 0} pending`, icon: FileText, color: "#ffaa00" },
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.4 }} whileHover={{ y: -4, scale: 1.01 }} style={{ padding: 20, borderRadius: 14, background: "rgba(18,18,30,0.8)", border: "1px solid rgba(30,30,50,0.6)", backdropFilter: "blur(10px)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: `${stat.color}15`, border: `1px solid ${stat.color}30` }}>
                          <Icon size={20} color={stat.color} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: stat.color }}>{stat.change}</span>
                      </div>
                      <p style={{ fontSize: 28, fontWeight: 800, color: "#f0f0f5", margin: "4px 0", lineHeight: 1.1 }}>{stat.value}</p>
                      <p style={{ fontSize: 13, color: "#8888a0", margin: 0 }}>{stat.label}</p>
                    </motion.div>
                  );
                })}
              </div>

              {/* Agent Status + Activity */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                <div style={{ background: "rgba(18,18,30,0.6)", border: "1px solid rgba(30,30,50,0.5)", borderRadius: 14, padding: 20, backdropFilter: "blur(10px)" }}>
                  <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: "#f0f0f5", marginBottom: 16 }}>
                    <Zap size={18} color="#00d4ff" /> Agent Status
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {AGENTS_CONFIG.map((agent, i) => {
                      const Icon = agent.icon;
                      const agentData = agents.find((a) => a.key === agent.key);
                      return (
                        <motion.div key={agent.key} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06, duration: 0.3 }} whileHover={{ scale: 1.02, x: 4 }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(26,26,46,0.5)", border: "1px solid rgba(30,30,50,0.4)", cursor: "pointer" }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: `${agent.color}15`, border: `1px solid ${agent.color}40` }}>
                            <Icon size={18} color={agent.color} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#f0f0f5", margin: "0 0 2px" }}>{agent.name}</p>
                            <p style={{ fontSize: 11, color: "#8888a0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.description}</p>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, flexShrink: 0, background: `${agentData?.status === "active" ? "#00ff88" : "#ffaa00"}20`, color: agentData?.status === "active" ? "#00ff88" : "#ffaa00" }}>
                            <CircleDot size={8} />
                            <span style={{ fontSize: 11, fontWeight: 600 }}>{agentData?.status === "active" ? "Active" : "Standby"}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ background: "rgba(18,18,30,0.6)", border: "1px solid rgba(30,30,50,0.5)", borderRadius: 14, padding: 20, backdropFilter: "blur(10px)", maxHeight: 480, overflowY: "auto" }}>
                  <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: "#f0f0f5", marginBottom: 16 }}>
                    <Activity size={18} color="#7b2ff7" /> Activity Log
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {logs.slice(0, 12).map((log, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03, duration: 0.2 }} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(30,30,50,0.3)" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0, background: log.type === "success" ? "#00ff88" : log.type === "warning" ? "#ffaa00" : "#00d4ff", boxShadow: `0 0 6px ${log.type === "success" ? "#00ff8840" : log.type === "warning" ? "#ffaa0040" : "#00d4ff40"}` }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, color: "#e0e0e8", margin: "0 0 2px", lineHeight: 1.4 }}>{log.message || log.action || "System update"}</p>
                          <p style={{ fontSize: 11, color: "#8888a0", margin: 0 }}>{formatDate(log.timestamp)} {formatTime(log.timestamp)}</p>
                        </div>
                      </motion.div>
                    ))}
                    {logs.length === 0 && <p style={{ color: "#8888a0", fontSize: 13, padding: 20, textAlign: "center" }}>No recent activity</p>}
                  </div>
                </div>
              </div>

              {/* Strategy */}
              {status?.strategy && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} style={{ padding: 20, borderRadius: 14, background: "rgba(18,18,30,0.6)", border: "1px solid rgba(255,170,0,0.2)", backdropFilter: "blur(10px)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Target size={18} color="#ffaa00" />
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f5", margin: 0 }}>Current Strategy</h3>
                  </div>
                  <p style={{ fontSize: 14, color: "#c0c0d0", lineHeight: 1.6, margin: 0 }}>{status.strategy}</p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ==================== PIPELINE ==================== */}
          {activeTab === "pipeline" && (
            <motion.div key="pipeline" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: "#f0f0f5" }}>
                  <Rocket size={18} color="#7b2ff7" /> Product Pipeline
                </h2>
                <p style={{ fontSize: 13, color: "#8888a0", margin: "4px 0 0" }}>{pipeline.length} products tracked across all stages</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                {PIPELINE_STAGES.map((stage, stageIdx) => {
                  const stageItems = pipeline.filter((p) => stage.statuses.includes(p.status));
                  return (
                    <motion.div key={stage.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: stageIdx * 0.1 }} style={{ background: "rgba(18,18,30,0.6)", border: "1px solid rgba(30,30,50,0.5)", borderRadius: 14, padding: 16, backdropFilter: "blur(10px)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid rgba(30,30,50,0.4)" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#f0f0f5" }}>{stage.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#00d4ff", background: "rgba(0,212,255,0.1)", padding: "2px 8px", borderRadius: 6 }}>{stageItems.length}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {stageItems.map((item, i) => {
                          const progress = STATUS_PROGRESS[item.status] || 0;
                          const name = item.idea?.name || item.name || "Unnamed";
                          return (
                            <motion.div key={item.id || i} whileHover={{ scale: 1.02 }} style={{ padding: 12, borderRadius: 8, background: "rgba(26,26,46,0.5)", border: "1px solid rgba(30,30,50,0.4)" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f5", margin: 0 }}>{name}</p>
                                <span style={{ fontSize: 12, fontWeight: 700, color: progress >= 80 ? "#00ff88" : progress >= 50 ? "#00d4ff" : "#ffaa00" }}>{progress}%</span>
                              </div>
                              <div style={{ height: 4, borderRadius: 2, background: "rgba(30,30,50,0.6)", overflow: "hidden", marginBottom: 6 }}>
                                <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 0.8, ease: "easeOut" }} style={{ height: "100%", borderRadius: 2, background: progress >= 80 ? "linear-gradient(90deg, #00ff88, #00d4ff)" : progress >= 50 ? "linear-gradient(90deg, #00d4ff, #7b2ff7)" : "linear-gradient(90deg, #ffaa00, #ff4466)" }} />
                              </div>
                              {item.idea?.pricing && <p style={{ fontSize: 11, color: "#8888a0", margin: 0 }}>${item.idea.pricing.amount}/{item.idea.pricing.period} — {item.idea.targetAudience}</p>}
                              {item.qualityScore != null && <p style={{ fontSize: 11, color: "#8888a0", margin: 0 }}>Quality: {item.qualityScore}/10</p>}
                            </motion.div>
                          );
                        })}
                        {stageItems.length === 0 && <p style={{ color: "#8888a0", fontSize: 12, padding: 12, textAlign: "center" }}>No items in this stage</p>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ==================== AGENTS ==================== */}
          {activeTab === "agents" && (
            <motion.div key="agents" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: "#f0f0f5" }}>
                  <Settings size={18} color="#00d4ff" /> Agent Configuration
                </h2>
                <p style={{ fontSize: 13, color: "#8888a0", margin: "4px 0 0" }}>5 autonomous agents running continuously</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
                {AGENTS_CONFIG.map((agent, i) => {
                  const Icon = agent.icon;
                  const agentData = agents.find((a) => a.key === agent.key);
                  const isRunning = runningAgent === agent.key;
                  return (
                    <motion.div key={agent.key} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08, duration: 0.3 }} whileHover={{ y: -4 }} style={{ padding: 20, borderRadius: 14, background: "rgba(18,18,30,0.7)", border: "1px solid rgba(30,30,50,0.5)", backdropFilter: "blur(10px)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${agent.color}15`, border: `2px solid ${agent.color}50`, boxShadow: `0 0 20px ${agent.color}20` }}>
                          <Icon size={24} color={agent.color} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, background: agentData?.status === "active" ? "#00ff8820" : agentData?.status === "running" ? "#00d4ff20" : "#ffaa0020", color: agentData?.status === "active" ? "#00ff88" : agentData?.status === "running" ? "#00d4ff" : "#ffaa00" }}>
                          {agentData?.status === "active" ? <CheckCircle2 size={12} /> : agentData?.status === "running" ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Clock size={12} />}
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{agentData?.status || "active"}</span>
                        </div>
                      </div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f5", margin: "0 0 6px" }}>{agent.name}</h3>
                      <p style={{ fontSize: 13, color: "#8888a0", lineHeight: 1.5, margin: "0 0 14px" }}>{agent.description}</p>
                      <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#8888a0" }}><Zap size={12} color="#8888a0" /> Runs every 6h</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#8888a0" }}><Activity size={12} color="#8888a0" /> {agentData?.tasksCompleted || 0} tasks</span>
                      </div>
                      {agentData?.lastRun && <p style={{ fontSize: 11, color: "#8888a0", margin: "0 0 10px" }}>Last run: {new Date(agentData.lastRun).toLocaleString()}</p>}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleRunAgentClick(agent.key)} disabled={isRunning} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "transparent", border: `1px solid ${isRunning ? "#8888a0" : agent.color}`, color: isRunning ? "#8888a0" : agent.color, fontSize: 12, fontWeight: 600, cursor: isRunning ? "not-allowed" : "pointer", textAlign: "center", opacity: isRunning ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          {isRunning ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={12} />}
                          {isRunning ? "Running..." : "Run Now"}
                        </button>
                        <button onClick={() => handleViewLogs(agent.key)} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "transparent", border: "1px solid #8888a0", color: "#8888a0", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          <Eye size={12} /> View Logs
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Run All */}
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleRunAllAgents} disabled={isThinking} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px", borderRadius: 12, background: "linear-gradient(135deg, #7b2ff7, #00d4ff)", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 30px rgba(123,47,247,0.3)", opacity: isThinking ? 0.6 : 1 }}>
                  <Zap size={18} color="#fff" /> Run All Agents Now
                </motion.button>
                <p style={{ fontSize: 12, color: "#8888a0", marginTop: 10 }}>Triggers a full cycle across CEO, Marketing, Tech, Finance, and Analytics agents</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(30,30,50,0.4)", marginTop: 40, padding: "20px 24px", background: "rgba(8,8,15,0.6)", backdropFilter: "blur(10px)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 12, color: "#8888a0", margin: 0 }}>© 2026 NexAI — Autonomous AI Company. Powered by 5 intelligent agents.</p>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowContactForm(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", color: "#00d4ff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Contact to Purchase <ArrowUpRight size={14} />
          </motion.button>
        </div>
      </footer>

      {/* ==================== AI BRAIN MODAL ==================== */}
      <AnimatePresence>
        {showBrain && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowBrain(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", borderRadius: 16, background: "rgba(14,14,24,0.95)", border: "1px solid rgba(30,30,50,0.6)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottom: "1px solid rgba(30,30,50,0.4)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Brain size={22} color="#00d4ff" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f5", margin: 0 }}>NexAI Brain</h2>
                    <p style={{ fontSize: 11, color: "#8888a0", margin: 0 }}>Direct all agents from one place</p>
                  </div>
                </div>
                <button onClick={() => setShowBrain(false)} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(30,30,50,0.4)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={20} color="#8888a0" />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12, maxHeight: 360 }}>
                {brainMessages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} style={{ display: "flex", gap: 10, maxWidth: "85%", alignSelf: msg.role === "user" ? "flex-end" : "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                    {msg.role === "assistant" && <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(0,212,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><Sparkles size={12} color="#00d4ff" /></div>}
                    <div style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.5, color: "#c0c0d0", background: "rgba(26,26,46,0.6)", border: "1px solid rgba(30,30,50,0.4)" }}>
                      {msg.content.split("\n").map((line, j) => (
                        <p key={j} style={{ margin: line ? "4px 0" : 0 }}>{line}</p>
                      ))}
                    </div>
                  </motion.div>
                ))}
                {isThinking && (
                  <div style={{ display: "flex", gap: 10, alignSelf: "flex-start" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(0,212,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><Sparkles size={12} color="#00d4ff" /></div>
                    <div style={{ display: "flex", gap: 4, padding: "10px 14px", fontSize: 18, color: "#00d4ff" }}>
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}>●</motion.span>
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}>●</motion.span>
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}>●</motion.span>
                    </div>
                  </div>
                )}
                <div ref={brainEndRef} />
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 20px 12px" }}>
                {["Run all agents", "Show company status", "Revenue report", "Pipeline update"].map((q) => (
                  <motion.button key={q} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => { setBrainInput(q); setTimeout(() => handleSendBrainMessage(), 50); }} style={{ padding: "6px 12px", borderRadius: 6, background: "rgba(30,30,50,0.4)", border: "1px solid rgba(30,30,50,0.6)", color: "#8888a0", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>
                    {q}
                  </motion.button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, padding: 16, borderTop: "1px solid rgba(30,30,50,0.4)" }}>
                <input type="text" value={brainInput} onChange={(e) => setBrainInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendBrainMessage()} placeholder="Ask the AI Brain anything..." style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(26,26,46,0.6)", border: "1px solid rgba(30,30,50,0.6)", color: "#f0f0f5", fontSize: 13, outline: "none" }} />
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleSendBrainMessage} disabled={isThinking || !brainInput.trim()} style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #7b2ff7, #00d4ff)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: isThinking || !brainInput.trim() ? 0.5 : 1 }}>
                  <Send size={18} color="#fff" />
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== AGENT LOGS MODAL ==================== */}
      <AnimatePresence>
        {viewingLogs && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setViewingLogs(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} style={{ width: "100%", maxWidth: 520, maxHeight: "80vh", borderRadius: 16, background: "rgba(14,14,24,0.95)", border: "1px solid rgba(30,30,50,0.6)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottom: "1px solid rgba(30,30,50,0.4)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Activity size={22} color="#00d4ff" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f5", margin: 0 }}>{viewingLogs} Agent Logs</h2>
                    <p style={{ fontSize: 11, color: "#8888a0", margin: 0 }}>Recent activity</p>
                  </div>
                </div>
                <button onClick={() => setViewingLogs(null)} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(30,30,50,0.4)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={20} color="#8888a0" />
                </button>
              </div>
              <div style={{ padding: 20, maxHeight: 400, overflowY: "auto" }}>
                {(agentLogs[viewingLogs] || []).length > 0 ? (
                  agentLogs[viewingLogs].map((log, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(30,30,50,0.3)" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0, background: "#00d4ff", boxShadow: "0 0 6px #00d4ff40" }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, color: "#e0e0e8", margin: "0 0 2px", lineHeight: 1.4 }}>{log.action || "Action"}</p>
                        <p style={{ fontSize: 11, color: "#8888a0", margin: 0 }}>
                          {log.details ? JSON.stringify(log.details).substring(0, 100) : ""}{" "}
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: "#8888a0", fontSize: 13, textAlign: "center", padding: 20 }}>No logs yet. Run the agent to generate activity.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== CONTACT FORM MODAL ==================== */}
      <AnimatePresence>
        {showContactForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowContactForm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ width: "100%", maxWidth: 440, borderRadius: 16, background: "rgba(14,14,24,0.95)", border: "1px solid rgba(30,30,50,0.6)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ padding: 24, borderBottom: "1px solid rgba(30,30,50,0.4)", position: "relative" }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f5", margin: "0 0 4px" }}>Get in Touch</h2>
                <p style={{ fontSize: 13, color: "#8888a0", margin: 0 }}>Interested in NexAI? We'll send you an invoice manually.</p>
                <button onClick={() => setShowContactForm(false)} style={{ position: "absolute", top: 20, right: 20, width: 36, height: 36, borderRadius: 8, background: "rgba(30,30,50,0.4)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={20} color="#8888a0" />
                </button>
              </div>
              {contactSent ? (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
                  <CheckCircle2 size={48} color="#00ff88" />
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f5", margin: 0 }}>Message Sent!</h3>
                  <p style={{ fontSize: 13, color: "#8888a0", margin: 0, lineHeight: 1.5 }}>We'll get back to you with an invoice within 24 hours.</p>
                </motion.div>
              ) : (
                <form onSubmit={handleContactSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    { label: "Full Name", key: "name", type: "text", placeholder: "John Doe" },
                    { label: "Email", key: "email", type: "email", placeholder: "john@company.com" },
                    { label: "Company", key: "company", type: "text", placeholder: "Acme Corp" },
                  ].map((field) => (
                    <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#8888a0", textTransform: "uppercase", letterSpacing: 0.5 }}>{field.label}</label>
                      <input type={field.type} placeholder={field.placeholder} value={contactForm[field.key]} onChange={(e) => setContactForm((prev) => ({ ...prev, [field.key]: e.target.value }))} required style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(26,26,46,0.6)", border: "1px solid rgba(30,30,50,0.6)", color: "#f0f0f5", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                    </div>
                  ))}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#8888a0", textTransform: "uppercase", letterSpacing: 0.5 }}>Message</label>
                    <textarea placeholder="Tell us about your needs..." value={contactForm.message} onChange={(e) => setContactForm((prev) => ({ ...prev, message: e.target.value }))} rows={3} style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(26,26,46,0.6)", border: "1px solid rgba(30,30,50,0.6)", color: "#f0f0f5", fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical" }} />
                  </div>
                  <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", borderRadius: 10, background: "linear-gradient(135deg, #7b2ff7, #00d4ff)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>
                    Send Message <Send size={16} color="#fff" />
                  </motion.button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
