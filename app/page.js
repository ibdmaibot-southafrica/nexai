"use client";

import "./modern.css";
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
  CreditCard,
  Target,
  Rocket,
  Play,
  Eye,
} from "lucide-react";

const AGENTS_CONFIG = [
  { key: "ceo", name: "CEO Agent", icon: Crown, color: "#7b2ff7", description: "Strategic decisions, goal-setting, and company direction" },
  { key: "coding", name: "Coding Agent", icon: Code2, color: "#00ff88", description: "Builds new agents from CEO appointments, modifies website" },
  { key: "marketing", name: "Marketing Agent", icon: Megaphone, color: "#00d4ff", description: "Brand strategy, content, and market positioning" },
  { key: "tech", name: "Tech Agent", icon: Code2, color: "#00ff88", description: "Product development, engineering, and technical ops" },
  { key: "product", name: "Product Design Agent", icon: Sparkles, color: "#ff00ff", description: "UI/UX design, product research, and user experience" },
  { key: "sales", name: "Sales Agent", icon: DollarSign, color: "#ff6600", description: "B2B sales, lead generation, and customer outreach" },
  { key: "growth", name: "Growth Agent", icon: ArrowUpRight, color: "#00ff88", description: "Growth hacking, viral loops, and referral systems" },
  { key: "content", name: "Content Agent", icon: Megaphone, color: "#7b2ff7", description: "Blog posts, social media, and SEO content" },
  { key: "finance", name: "Finance Agent", icon: Wallet, color: "#ffaa00", description: "Financial planning, invoicing, and budget management" },
  { key: "analytics", name: "Analytics Agent", icon: LineChart, color: "#ff4466", description: "Data analysis, reporting, and performance insights" },
];

const TABS = [
  { key: "home", label: "Home", icon: Rocket },
  { key: "products", label: "Products", icon: Sparkles },
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "pipeline", label: "Pipeline", icon: GitBranch },
  { key: "agents", label: "Agents", icon: Settings },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "payments", label: "Payments", icon: CreditCard },
];

const PIPELINE_STAGES = [
  { name: "Ideation", statuses: ["ideation"], icon: "💡", agent: "Marketing" },
  { name: "Development", statuses: ["building"], icon: "🔧", agent: "Tech" },
  { name: "Testing", statuses: ["testing"], icon: "🧪", agent: "Analytics" },
  { name: "Validation", statuses: ["validated"], icon: "✅", agent: "CEO" },
  { name: "Launched", statuses: ["launched"], icon: "🚀", agent: "Sales" },
];

const STATUS_PROGRESS = {
  ideation: 20,
  building: 40,
  built: 50,
  testing: 60,
  validated: 80,
  launched: 100,
  rejected: 0,
};

export default function Home() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("home");
  const [loading, setLoading] = useState(true);

  // Brain modal
  const [showBrain, setShowBrain] = useState(false);
  const [brainInput, setBrainInput] = useState("");
  const [brainMessages, setBrainMessages] = useState([
    { role: "assistant", content: "Hello! I'm the NexAI Brain. I can help you direct any of our 6 autonomous agents, check company status, or run strategic initiatives. What would you like to do?" },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const brainEndRef = useRef(null);

  // Contact form
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", company: "", message: "" });
  const [contactSent, setContactSent] = useState(false);

  // Agent running state — support multiple simultaneous agents
  const [runningAgents, setRunningAgents] = useState(new Set());
  const [selectedAgents, setSelectedAgents] = useState(new Set());
  const [viewingLogs, setViewingLogs] = useState(null);
  const [agentLogs, setAgentLogs] = useState({});
  const [invoiceList, setInvoiceList] = useState([]);
  const [agentActivities, setAgentActivities] = useState({});
  const [paymentForm, setPaymentForm] = useState({ customer: "", product: "", amount: "" });
  const [paymentResult, setPaymentResult] = useState(null);

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

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch("/api/invoices");
      const data = await res.json();
      setInvoiceList(data.invoices || []);
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
    }
  }, []);

  const handleCreatePayment = async () => {
    if (!paymentForm.customer || !paymentForm.amount) return;
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentForm),
      });
      const data = await res.json();
      setPaymentResult(data);
      if (data.success) {
        setPaymentForm({ customer: "", product: "", amount: "" });
        fetchInvoices();
      }
    } catch (err) {
      setPaymentResult({ error: err.message });
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchLogs(), fetchInvoices()]);
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
    setBrainMessages((prev) => [...prev, { role: "assistant", content: "🚀 Initiating full agent sweep — running all 7 autonomous agents..." }]);
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
    setRunningAgents(prev => new Set(prev).add(agentKey));
    const activityMap = {
      ceo: "Reviewing strategy & making launch decisions...",
      marketing: "Researching markets & generating product ideas...",
      tech: "Building & developing products...",
      product: "Designing UI/UX & improving product quality...",
      sales: "Finding leads & creating outreach campaigns...",
      finance: "Analyzing finances & optimizing revenue...",
      analytics: "Testing products & validating quality...",
    };
    setAgentActivities(prev => ({ ...prev, [agentKey]: activityMap[agentKey] || "Working..." }));
    const result = await handleRunAgent(agentKey);
    if (result?.result) {
      const r = result.result;
      let doneMsg = "✅ Completed";
      if (r.productCreated) doneMsg = `✅ Created: ${r.productCreated}`;
      else if (r.built) doneMsg = `🔧 Built ${r.built} items`;
      else if (r.validated) doneMsg = `🧪 Validated ${r.validated} products`;
      else if (r.launched) doneMsg = `🚀 Launched: ${r.launched}`;
      else if (r.leadsFound) doneMsg = `💰 Found ${r.leadsFound} leads`;
      else if (r.designed) doneMsg = `🎨 Designed ${r.designed} products`;
      else if (r.selfImprovement) doneMsg = `📚 Studying: ${r.selfImprovement.substring(0, 50)}...`;
      setAgentActivities(prev => ({ ...prev, [agentKey]: doneMsg }));
    }
    setRunningAgents(prev => { const n = new Set(prev); n.delete(agentKey); return n; });
    setTimeout(() => {
      setAgentActivities(prev => { const n = {...prev}; delete n[agentKey]; return n; });
    }, 10000);
  };

  const handleRunSelectedAgents = async (agentKeys) => {
    if (agentKeys.length === 0) return;
    const newRunning = new Set(runningAgents);
    agentKeys.forEach(k => newRunning.add(k));
    setRunningAgents(newRunning);
    
    // Set activities
    const activityMap = {
      ceo: "Reviewing strategy...", marketing: "Researching markets...", tech: "Building products...",
      product: "Designing UI/UX...", sales: "Finding leads...", finance: "Analyzing finances...", analytics: "Testing products...",
    };
    const newActivities = {};
    agentKeys.forEach(k => { newActivities[k] = activityMap[k] || "Working..."; });
    setAgentActivities(prev => ({ ...prev, ...newActivities }));
    
    // Run all selected in parallel
    const results = await Promise.all(agentKeys.map(key => handleRunAgent(key)));
    
    // Update activities with results
    const doneActivities = {};
    results.forEach((result, idx) => {
      const key = agentKeys[idx];
      if (result?.result) {
        const r = result.result;
        if (r.productCreated) doneActivities[key] = `✅ ${r.productCreated}`;
        else if (r.built) doneActivities[key] = `🔧 Built ${r.built}`;
        else if (r.validated) doneActivities[key] = `🧪 Validated ${r.validated}`;
        else if (r.launched) doneActivities[key] = `🚀 Launched ${r.launched}`;
        else if (r.leadsFound) doneActivities[key] = `💰 ${r.leadsFound} leads`;
        else if (r.designed) doneActivities[key] = `🎨 Designed ${r.designed}`;
        else doneActivities[key] = "✅ Done";
      }
    });
    setAgentActivities(prev => ({ ...prev, ...doneActivities }));
    
    // Clear running state
    setRunningAgents(prev => {
      const n = new Set(prev);
      agentKeys.forEach(k => n.delete(k));
      return n;
    });
    
    // Clear activities after 10s
    setTimeout(() => {
      setAgentActivities(prev => {
        const n = {...prev};
        agentKeys.forEach(k => delete n[k]);
        return n;
      });
    }, 10000);
    
    await fetchStatus();
    await fetchLogs();
  };

  const handleViewLogs = async (agentKey) => {
    try {
      const res = await fetch(`/api/logs?count=100`);
      const data = await res.json();
      const agentName = AGENTS_CONFIG.find(a => a.key === agentKey)?.name || agentKey;
      // Match logs by agent name (e.g. "Sales Agent" matches "Sales" or "Sales Agent")
      const filtered = data.filter(l => {
        const logAgent = (l.agent || "").toLowerCase();
        return logAgent.includes(agentKey.toLowerCase()) || 
               logAgent.includes(agentName.toLowerCase()) ||
               agentName.toLowerCase().includes(logAgent);
      });
      setAgentLogs((prev) => ({ ...prev, [agentKey]: filtered.length > 0 ? filtered : data.slice(0, 20) }));
      setViewingLogs(agentName);
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
    if (s === "running") return "#00d4ff";
    if (s === "training" || s === "learning") return "#ffaa00";
    if (s === "active" || s === "operational") return "#00ff88";
    if (s === "pending") return "#ffaa00";
    if (s === "disabled") return "#6b6b8a";
    return "#ff4466";
  };

  const getStatusLabel = (s) => {
    if (s === "running") return "Running";
    if (s === "training" || s === "learning") return "Training";
    if (s === "active") return "Standby";
    if (s === "pending") return "Pending";
    if (s === "disabled") return "Disabled";
    return "Error";
  };

  const isAgentRunning = (key) => runningAgents.has(key);
  const isAgentTraining = (key) => agentActivities[key] && (agentActivities[key].includes("Learning") || agentActivities[key].includes("Studying") || agentActivities[key].includes("Training"));

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
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "var(--bg)" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
          <Loader2 size={40} color="var(--cyan)" />
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ fontSize: 14, color: "var(--text-dim)", letterSpacing: 1 }}>
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
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", background: "var(--bg)" }}>
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
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="header">
        <div className="header-inner">
          <div className="header-brand">
            <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.5 }} className="header-logo">
              <Brain size={28} color="var(--cyan)" />
            </motion.div>
            <div>
              <h1 className="header-title">NexAI</h1>
              <p className="header-subtitle">Autonomous Company OS</p>
            </div>
          </div>
          <div className="header-actions">
            <div className="status-pill">
              <span className="status-dot" style={{ background: getStatusColor(status?.status), boxShadow: `0 0 8px ${getStatusColor(status?.status)}` }} />
              <span>{status?.status === "operational" ? "All Systems Go" : status?.status || "Loading..."}</span>
            </div>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowBrain(true)} className="btn-gradient">
              <Sparkles size={16} color="#fff" />
              <span>AI Brain</span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Tabs */}
      <motion.nav initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, duration: 0.4 }} className="tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <motion.button key={tab.key} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setActiveTab(tab.key)} className={`tab-btn ${isActive ? "tab-active" : ""}`}>
              <Icon size={18} color={isActive ? "var(--cyan)" : "var(--text-dim)"} />
              <span>{tab.label}</span>
              {isActive && <motion.div layoutId="tabIndicator" className="tab-indicator" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            </motion.button>
          );
        })}
      </motion.nav>

      {/* Main */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          {/* ==================== HOME (Live Operations) ==================== */}
          {activeTab === "home" && (
            <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              {/* Live Status Banner */}
              {runningAgents.size > 0 && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="running-bar">
                  <div className="running-bar-content">
                    <Loader2 size={14} color="var(--cyan)" className="spin" />
                    <span>Active Job: {Array.from(runningAgents).map(k => AGENTS_CONFIG.find(a => a.key === k)?.name.replace(" Agent", "")).join(", ")}</span>
                  </div>
                </motion.div>
              )}

              {/* Agent Live Status Grid */}
              <div className="card" style={{ marginBottom: 20 }}>
                <h2 className="card-title"><Zap size={18} color="var(--cyan)" /> Live Agent Status</h2>
                <div className="live-agents-grid">
                  {AGENTS_CONFIG.map((agent) => {
                    const agentData = agents.find(a => a.key === agent.key);
                    const isRunning = runningAgents.has(agent.key);
                    const isTraining = isAgentTraining(agent.key);
                    const Icon = agent.icon;
                    return (
                      <div key={agent.key} className={`live-agent-card ${isRunning ? "live-agent-running" : isTraining ? "live-agent-training" : ""}`}>
                        <div className="live-agent-icon" style={{ background: `${agent.color}15`, border: `2px solid ${isRunning ? "var(--cyan)" : isTraining ? "var(--orange)" : agent.color + "40"}` }}>
                          {isRunning ? <Loader2 size={16} color="var(--cyan)" className="spin" /> : isTraining ? <Brain size={16} color="var(--orange)" /> : <Icon size={16} color={agent.color} />}
                        </div>
                        <div className="live-agent-info">
                          <span className="live-agent-name">{agent.name.replace(" Agent", "")}</span>
                          <span className={`live-agent-status ${isRunning ? "status-running" : isTraining ? "status-training" : "status-standby"}`}>
                            {isRunning ? "Running" : isTraining ? "Training" : "Standby"}
                          </span>
                        </div>
                        {agentActivities[agent.key] && (
                          <span className="live-agent-activity">{agentActivities[agent.key]}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Activity Feed + Pipeline */}
              <div className="dashboard-grid">
                <div className="card activity-card">
                  <h2 className="card-title"><Activity size={18} color="var(--cyan)" /> Live Activity Feed</h2>
                  <div className="activity-list">
                    {logs.slice(0, 15).map((log, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02, duration: 0.2 }} className="activity-item">
                        <div className={`activity-dot ${log.type === "success" ? "dot-green" : log.type === "warning" ? "dot-orange" : "dot-cyan"}`} />
                        <div className="activity-content">
                          <p className="activity-message">{log.action || log.message || "System update"}</p>
                          <p className="activity-time">{formatTime(log.timestamp)} · {log.agent || "System"}</p>
                        </div>
                      </motion.div>
                    ))}
                    {logs.length === 0 && <p className="empty-state">No recent activity</p>}
                  </div>
                </div>

                <div className="card">
                  <h2 className="card-title"><GitBranch size={18} color="var(--purple)" /> Pipeline Stages</h2>
                  <div className="pipeline-bars">
                    {[
                      { stage: "Ideation", count: pipeline.filter(p => p.status === "ideation").length, color: "#8888a0" },
                      { stage: "Building", count: pipeline.filter(p => p.status === "building").length, color: "var(--orange)" },
                      { stage: "Testing", count: pipeline.filter(p => p.status === "testing").length, color: "var(--cyan)" },
                      { stage: "Validated", count: pipeline.filter(p => p.status === "validated").length, color: "var(--purple)" },
                      { stage: "Launched", count: pipeline.filter(p => p.status === "launched").length, color: "var(--green)" },
                    ].map((stage) => (
                      <div key={stage.stage} className="pipeline-bar-row">
                        <span className="pipeline-bar-label">{stage.stage}</span>
                        <div className="pipeline-bar-track">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max((stage.count / Math.max(pipeline.length, 1)) * 100, 4)}%` }} transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }} className="pipeline-bar-fill" style={{ background: stage.color }} />
                        </div>
                        <span className="pipeline-bar-count" style={{ color: stage.color }}>{stage.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== PRODUCTS TAB ==================== */}
          {activeTab === "products" && (
            <motion.div key="products" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div className="section-header">
                <h2 className="section-title">AI Products & Services</h2>
                <p className="section-subtitle">Built by autonomous agents. Pay via PayPal. Instant delivery.</p>
              </div>
              <div className="products-grid">
                {pipeline.filter(p => p.status === "launched" || p.status === "validated").length > 0 ? (
                  pipeline.filter(p => p.status === "launched" || p.status === "validated").map((product, i) => {
                    const paypalUrl = product.paypal_me_link || `https://www.paypal.com/paypalme/hjr/${(product.price || 29).toFixed(2)}`;
                    return (
                      <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="product-card">
                        <div className="product-card-header">
                          <div className="product-icon-wrap">
                            <Sparkles size={24} color="var(--cyan)" />
                          </div>
                          <span className={`badge ${product.status === "launched" ? "badge-green" : "badge-purple"}`}>
                            {product.status === "launched" ? "Live" : "Beta"}
                          </span>
                        </div>
                        <h3 className="product-name">{product.name}</h3>
                        <p className="product-desc">{product.description || "AI-powered solution built by autonomous agents."}</p>
                        {product.targetAudience && <p className="product-audience">For: {product.targetAudience}</p>}
                        <div className="product-footer">
                          <span className="product-price">${product.price || 29}<span className="product-period">/mo</span></span>
                          <motion.a href={paypalUrl} target="_blank" rel="noopener noreferrer" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-gradient btn-sm product-buy-btn">
                            <DollarSign size={14} /> Buy Now
                          </motion.a>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="empty-state-large">
                    <Rocket size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                    <p>Products are being built by our agents. Check back soon!</p>
                  </div>
                )}
              </div>
              {/* Custom Service CTA */}
              <div className="card" style={{ marginTop: 24, textAlign: "center", border: "1px solid rgba(123,47,247,0.3)" }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Need Something Custom?</h3>
                <p style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 16 }}>Our agents can build custom AI solutions tailored to your needs.</p>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowContactForm(true)} className="btn-gradient">
                  <Send size={16} /> Get a Custom Quote
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ==================== DASHBOARD ==================== */}
          {activeTab === "dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              {/* Stats */}
              <div className="stats-grid">
                {[
                  { label: "Revenue (MTD)", value: `$${(status?.financials?.revenue || 0).toLocaleString()}`, change: status?.financials?.growth || "+0%", icon: DollarSign, color: "var(--green)" },
                  { label: "Active Agents", value: agents.filter((a) => a.status === "active").length, change: agents.every((a) => a.status === "active") ? "All online" : "Some idle", icon: Users, color: "var(--cyan)" },
                  { label: "Pipeline Items", value: pipeline.length, change: `${pipeline.filter((p) => p.status === "building").length} in progress`, icon: GitBranch, color: "var(--purple)" },
                  { label: "Invoices", value: invoices.total || 0, change: `${invoices.pending || 0} pending`, icon: FileText, color: "var(--orange)" },
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.4 }} whileHover={{ y: -4, scale: 1.01 }} className="stat-card">
                      <div className="stat-header">
                        <div className="stat-icon" style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}30` }}>
                          <Icon size={20} color={stat.color} />
                        </div>
                        <span className="stat-change" style={{ color: stat.color }}>{stat.change}</span>
                      </div>
                      <p className="stat-value">{stat.value}</p>
                      <p className="stat-label">{stat.label}</p>
                    </motion.div>
                  );
                })}
              </div>

              {/* Agent Status + Activity */}
              <div className="dashboard-grid">
                <div className="card">
                  <h2 className="card-title">
                    <Zap size={18} color="var(--cyan)" /> Agent Status
                  </h2>
                  <div className="agent-list">
                    {AGENTS_CONFIG.map((agent, i) => {
                      const Icon = agent.icon;
                      const agentData = agents.find((a) => a.key === agent.key);
                      return (
                        <motion.div key={agent.key} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06, duration: 0.3 }} whileHover={{ scale: 1.02, x: 4 }} className="agent-row">
                          <div className="agent-icon" style={{ background: `${agent.color}15`, border: `1px solid ${agent.color}40` }}>
                            <Icon size={18} color={agent.color} />
                          </div>
                          <div className="agent-info">
                            <p className="agent-name">{agent.name}</p>
                            <p className="agent-desc">{agent.description}</p>
                          </div>
                          <div className={`badge ${isAgentRunning(agent.key) ? "badge-cyan" : isAgentTraining(agent.key) ? "badge-orange" : agentData?.status === "active" ? "badge-green" : "badge-red"}`}>
                            {isAgentRunning(agent.key) ? <Loader2 size={8} className="spin" /> : isAgentTraining(agent.key) ? <Brain size={8} /> : <CircleDot size={8} />}
                            <span>{isAgentRunning(agent.key) ? "Running" : isAgentTraining(agent.key) ? "Training" : agentData?.status === "active" ? "Standby" : "Error"}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="card activity-card">
                  <h2 className="card-title">
                    <Activity size={18} color="var(--purple)" /> Activity Log
                  </h2>
                  <div className="activity-list">
                    {logs.slice(0, 12).map((log, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03, duration: 0.2 }} className="activity-item">
                        <div className={`activity-dot ${log.type === "success" ? "dot-green" : log.type === "warning" ? "dot-orange" : "dot-cyan"}`} />
                        <div className="activity-content">
                          <p className="activity-message">{log.message || log.action || "System update"}</p>
                          <p className="activity-time">{formatDate(log.timestamp)} {formatTime(log.timestamp)}</p>
                        </div>
                      </motion.div>
                    ))}
                    {logs.length === 0 && <p className="empty-state">No recent activity</p>}
                  </div>
                </div>
              </div>

              {/* Strategy */}
              {status?.strategy && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card strategy-card">
                  <div className="strategy-header">
                    <Target size={18} color="var(--orange)" />
                    <h3 className="strategy-title">Current Strategy</h3>
                  </div>
                  <p className="strategy-text">{status.strategy}</p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ==================== PIPELINE ==================== */}
          {activeTab === "pipeline" && (
            <motion.div key="pipeline" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div className="section-header">
                <h2 className="card-title">
                  <Rocket size={18} color="var(--purple)" /> Product Pipeline
                </h2>
                <p className="section-subtitle">{pipeline.length} products tracked across all stages</p>
              </div>
              <div className="pipeline-grid">
                {PIPELINE_STAGES.map((stage, stageIdx) => {
                  const stageItems = pipeline.filter((p) => stage.statuses.includes(p.status));
                  return (
                    <motion.div key={stage.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: stageIdx * 0.1 }} className="pipeline-column">
                      <div className="pipeline-header">
                        <span className="pipeline-name">{stage.name}</span>
                        <span className="pipeline-count">{stageItems.length}</span>
                      </div>
                      <div className="pipeline-items">
                        {stageItems.map((item, i) => {
                          const progress = STATUS_PROGRESS[item.status] || 0;
                          const name = item.idea?.name || item.name || "Unnamed";
                          return (
                            <motion.div key={item.id || i} whileHover={{ scale: 1.02 }} className="pipeline-item">
                              <div className="pipeline-item-header">
                                <p className="pipeline-item-name">{name}</p>
                                <span className="pipeline-item-progress" style={{ color: progress >= 80 ? "var(--green)" : progress >= 50 ? "var(--cyan)" : "var(--orange)" }}>{progress}%</span>
                              </div>
                              <div className="progress-bar">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 0.8, ease: "easeOut" }} className="progress-fill" style={{ background: progress >= 80 ? "linear-gradient(90deg, var(--green), var(--cyan))" : progress >= 50 ? "linear-gradient(90deg, var(--cyan), var(--purple))" : "linear-gradient(90deg, var(--orange), var(--red))" }} />
                              </div>
                              {item.idea?.pricing && <p className="pipeline-item-meta">${item.idea.pricing.amount}/{item.idea.pricing.period} — {item.idea.targetAudience}</p>}
                              {item.qualityScore != null && <p className="pipeline-item-meta">Quality: {item.qualityScore}/10</p>}
                            </motion.div>
                          );
                        })}
                        {stageItems.length === 0 && <p className="empty-state-small">No items</p>}
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
              <div className="section-header">
                <h2 className="card-title">
                  <Settings size={18} color="var(--cyan)" /> Agent Configuration
                </h2>
                <p className="section-subtitle">7 autonomous agents running continuously</p>
              </div>
              
              {/* Multi-select controls */}
              <div className="agent-controls">
                <span className="agent-controls-label">Select agents to run:</span>
                {AGENTS_CONFIG.map(agent => (
                  <button key={agent.key} onClick={() => {
                    const newSelected = new Set(selectedAgents);
                    if (newSelected.has(agent.key)) newSelected.delete(agent.key);
                    else newSelected.add(agent.key);
                    setSelectedAgents(newSelected);
                  }} className={`agent-select-btn ${selectedAgents.has(agent.key) ? "selected" : ""}`} style={{ borderColor: selectedAgents.has(agent.key) ? agent.color : undefined, background: selectedAgents.has(agent.key) ? `${agent.color}20` : undefined, color: selectedAgents.has(agent.key) ? agent.color : undefined }}>
                    {selectedAgents.has(agent.key) && <CheckCircle2 size={12} color={agent.color} />}
                    {agent.name.replace(" Agent", "")}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <button onClick={() => {
                  if (selectedAgents.size > 0) {
                    handleRunSelectedAgents(Array.from(selectedAgents));
                  }
                }} disabled={selectedAgents.size === 0 || runningAgents.size > 0} className="btn-gradient btn-sm">
                  {runningAgents.size > 0 ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
                  Run Selected ({selectedAgents.size})
                </button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleRunAllAgents} disabled={runningAgents.size > 0} className="btn-success btn-sm">
                  {runningAgents.size > 0 ? <Loader2 size={14} className="spin" /> : <Zap size={14} />}
                  Run All {AGENTS_CONFIG.length}
                </motion.button>
              </div>

              {/* Running status bar */}
              {runningAgents.size > 0 && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="running-bar">
                  <div className="running-bar-content">
                    <Loader2 size={14} color="var(--cyan)" className="spin" />
                    <span>
                      Running {runningAgents.size} agent{runningAgents.size > 1 ? "s" : ""}: {Array.from(runningAgents).map(k => AGENTS_CONFIG.find(a => a.key === k)?.name.replace(" Agent", "")).join(", ")}
                    </span>
                  </div>
                </motion.div>
              )}

              <div className="agent-cards-grid">
                {AGENTS_CONFIG.map((agent, i) => {
                  const Icon = agent.icon;
                  const agentData = agents.find((a) => a.key === agent.key);
                  const isRunning = runningAgents.has(agent.key);
                  const isSelected = selectedAgents.has(agent.key);
                  return (
                    <motion.div key={agent.key} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08, duration: 0.3 }} whileHover={{ y: -4 }} className={`agent-card ${isRunning ? "agent-card-running" : ""} ${isSelected ? "agent-card-selected" : ""}`} style={{ borderColor: isRunning ? "var(--cyan)" : isSelected ? agent.color : undefined, boxShadow: isRunning ? `0 0 20px ${agent.color}30` : "none" }}>
                      <div className="agent-card-header">
                        <div className="agent-card-icon" style={{ background: `${agent.color}15`, border: `2px solid ${agent.color}50`, boxShadow: `0 0 20px ${agent.color}20` }}>
                          <Icon size={24} color={agent.color} />
                        </div>
                        <div className={`badge ${isRunning ? "badge-cyan" : agentData?.status === "active" ? "badge-green" : "badge-orange"}`}>
                          {isRunning ? <Loader2 size={12} className="spin" /> : agentData?.status === "active" ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          <span>{isRunning ? "Running" : agentData?.status || "active"}</span>
                        </div>
                      </div>
                      <h3 className="agent-card-name">{agent.name}</h3>
                      <p className="agent-card-desc">{agent.description}</p>
                      {/* Live activity indicator */}
                      <div className={`agent-activity ${isRunning ? "agent-activity-running" : ""}`}>
                        <div className="agent-activity-row">
                          {isRunning ? <Loader2 size={10} color="var(--cyan)" className="spin" /> : isAgentTraining(agent.key) ? <Brain size={10} color="var(--orange)" /> : <div className="agent-activity-dot" />}
                          <span className="agent-activity-status">
                            {isRunning ? "Working..." : isAgentTraining(agent.key) ? "Training..." : "Idle - Self-Improving"}
                          </span>
                        </div>
                        {agentActivities[agent.key] && (
                          <p className="agent-activity-detail">{agentActivities[agent.key]}</p>
                        )}
                      </div>
                      <div className="agent-card-stats">
                        <span className="agent-stat"><Zap size={12} color="var(--text-dim)" /> Auto-runs</span>
                        <span className="agent-stat"><Activity size={12} color="var(--text-dim)" /> {agentData?.tasksCompleted || 0} tasks</span>
                      </div>
                      {agentData?.lastRun && <p className="agent-card-lastrun">Last run: {new Date(agentData.lastRun).toLocaleString()}</p>}
                      <div className="agent-card-actions">
                        <button onClick={() => handleRunAgentClick(agent.key)} disabled={isRunning} className="btn-outline btn-sm" style={{ borderColor: isRunning ? "var(--text-dim)" : agent.color, color: isRunning ? "var(--text-dim)" : agent.color, opacity: isRunning ? 0.6 : 1 }}>
                          {isRunning ? <Loader2 size={12} className="spin" /> : <Play size={12} />}
                          {isRunning ? "Running..." : "Run Now"}
                        </button>
                        <button onClick={() => handleViewLogs(agent.key)} className="btn-ghost btn-sm">
                          <Eye size={12} /> Logs
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* INVOICES TAB — READ ONLY STATUS */}
          {activeTab === "invoices" && (
            <motion.div key="invoices" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div className="section-header-row">
                <div>
                  <h2 className="section-title">Invoices</h2>
                  <p className="section-subtitle">{invoiceList.length} total · {invoiceList.filter(i => i.status === "pending").length} pending · {invoiceList.filter(i => i.status === "paid").length} paid</p>
                </div>
                <button onClick={() => { fetchInvoices(); fetchStatus(); }} className="btn-outline-cyan">Refresh</button>
              </div>
              {invoiceList.length === 0 ? (
                <div className="empty-state-large">
                  <FileText size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                  <p>No invoices yet. The agents are working on generating sales.</p>
                </div>
              ) : (
                <div className="invoice-list">
                  {invoiceList.map((inv) => (
                    <div key={inv.id} className="invoice-item">
                      <div className="invoice-info">
                        <div className="invoice-top-row">
                          <span className="invoice-product">{inv.product}</span>
                          <span className={`badge ${inv.status === "paid" ? "badge-green" : inv.status === "pending" ? "badge-orange" : "badge-red"}`}>{inv.status.toUpperCase()}</span>
                        </div>
                        <div className="invoice-customer">{inv.customer}</div>
                        {inv.paid_at && <div className="invoice-paid-at">Paid: {new Date(inv.paid_at).toLocaleString()}</div>}
                      </div>
                      <div className="invoice-amount" style={{ color: inv.status === "paid" ? "var(--green)" : "var(--cyan)" }}>${inv.amount}</div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* PAYMENTS TAB — SHOW ONLY SUCCESSFUL PAYMENTS */}
          {activeTab === "payments" && (
            <motion.div key="payments" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div className="section-header-row">
                <div>
                  <h2 className="section-title">Successful Payments</h2>
                  <p className="section-subtitle">Payments received from clients</p>
                </div>
                <button onClick={() => { fetchInvoices(); fetchStatus(); }} className="btn-outline-cyan">Refresh</button>
              </div>
              {invoiceList.filter(i => i.status === "paid").length === 0 ? (
                <div className="empty-state-large">
                  <DollarSign size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                  <p>No payments received yet. The sales agent is working on closing deals.</p>
                </div>
              ) : (
                <div className="invoice-list">
                  {invoiceList.filter(i => i.status === "paid").map((inv) => (
                    <div key={inv.id} className="invoice-item" style={{ borderColor: "rgba(0,255,136,0.3)" }}>
                      <div className="invoice-info">
                        <div className="invoice-top-row">
                          <span className="invoice-product">{inv.product}</span>
                          <span className="badge badge-green">PAID</span>
                        </div>
                        <div className="invoice-customer">{inv.customer}</div>
                        {inv.paid_at && <div className="invoice-paid-at">Received: {new Date(inv.paid_at).toLocaleString()}</div>}
                      </div>
                      <span className="invoice-amount" style={{ color: "var(--green)" }}>+${inv.amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-inner">
          <p className="footer-text">© 2026 NexAI — Autonomous AI Company. Powered by 7 intelligent agents.</p>
          <div className="footer-status">
            <span className="badge badge-green">● System Online</span>
          </div>
        </div>
      </footer>

      {/* ==================== AI BRAIN MODAL ==================== */}
      <AnimatePresence>
        {showBrain && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setShowBrain(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-header-brand">
                  <div className="modal-header-icon">
                    <Brain size={22} color="var(--cyan)" />
                  </div>
                  <div>
                    <h2 className="modal-title">NexAI Brain</h2>
                    <p className="modal-subtitle">Direct all agents from one place</p>
                  </div>
                </div>
                <button onClick={() => setShowBrain(false)} className="modal-close-btn">
                  <X size={20} color="var(--text-dim)" />
                </button>
              </div>

              <div className="modal-body">
                {brainMessages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`chat-message ${msg.role === "user" ? "chat-message-user" : "chat-message-assistant"}`}>
                    {msg.role === "assistant" && <div className="chat-avatar"><Sparkles size={12} color="var(--cyan)" /></div>}
                    <div className="chat-bubble">
                      {msg.content.split("\n").map((line, j) => (
                        <p key={j} style={{ margin: line ? "4px 0" : 0 }}>{line}</p>
                      ))}
                    </div>
                  </motion.div>
                ))}
                {isThinking && (
                  <div className="chat-thinking">
                    <div className="chat-avatar"><Sparkles size={12} color="var(--cyan)" /></div>
                    <div className="chat-thinking-dots">
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}>●</motion.span>
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}>●</motion.span>
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}>●</motion.span>
                    </div>
                  </div>
                )}
                <div ref={brainEndRef} />
              </div>

              <div className="brain-suggestions">
                {["Run all agents", "Show company status", "Revenue report", "Pipeline update"].map((q) => (
                  <motion.button key={q} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => { setBrainInput(q); setTimeout(() => handleSendBrainMessage(), 50); }} className="brain-suggestion-btn">
                    {q}
                  </motion.button>
                ))}
              </div>

              <div className="modal-input-area">
                <input type="text" value={brainInput} onChange={(e) => setBrainInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendBrainMessage()} placeholder="Ask the AI Brain anything..." className="modal-input" />
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleSendBrainMessage} disabled={isThinking || !brainInput.trim()} className="modal-send-btn">
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setViewingLogs(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="modal-container" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-header-brand">
                  <div className="modal-header-icon">
                    <Activity size={22} color="var(--cyan)" />
                  </div>
                  <div>
                    <h2 className="modal-title">{viewingLogs} Agent Logs</h2>
                    <p className="modal-subtitle">Recent activity</p>
                  </div>
                </div>
                <button onClick={() => setViewingLogs(null)} className="modal-close-btn">
                  <X size={20} color="var(--text-dim)" />
                </button>
              </div>
              <div className="logs-body">
                {(agentLogs[viewingLogs] || []).length > 0 ? (
                  agentLogs[viewingLogs].map((log, i) => (
                    <div key={i} className="log-item">
                      <div className="log-dot" />
                      <div className="log-content">
                        <p className="log-action">{log.action || "Action"}</p>
                        <p className="log-meta">
                          {log.details ? JSON.stringify(log.details).substring(0, 100) : ""}{" "}
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="empty-state">No logs yet. Run the agent to generate activity.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== CONTACT FORM MODAL ==================== */}
      <AnimatePresence>
        {showContactForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setShowContactForm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="modal-container" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header" style={{ position: "relative" }}>
                <div style={{ flex: 1 }}>
                  <h2 className="modal-title">Get in Touch</h2>
                  <p className="modal-subtitle">Interested in NexAI? We'll send you an invoice manually.</p>
                </div>
                <button onClick={() => setShowContactForm(false)} className="modal-close-btn" style={{ position: "absolute", top: 20, right: 20 }}>
                  <X size={20} color="var(--text-dim)" />
                </button>
              </div>
              {contactSent ? (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="contact-success">
                  <CheckCircle2 size={48} color="var(--green)" />
                  <h3 className="contact-success-title">Message Sent!</h3>
                  <p className="contact-success-text">We'll get back to you with an invoice within 24 hours.</p>
                </motion.div>
              ) : (
                <form onSubmit={handleContactSubmit} className="contact-form">
                  {[
                    { label: "Full Name", key: "name", type: "text", placeholder: "John Doe" },
                    { label: "Email", key: "email", type: "email", placeholder: "john@company.com" },
                    { label: "Company", key: "company", type: "text", placeholder: "Acme Corp" },
                  ].map((field) => (
                    <div key={field.key} className="contact-form-field">
                      <label className="contact-label">{field.label}</label>
                      <input type={field.type} placeholder={field.placeholder} value={contactForm[field.key]} onChange={(e) => setContactForm((prev) => ({ ...prev, [field.key]: e.target.value }))} required className="contact-input" />
                    </div>
                  ))}
                  <div className="contact-form-field">
                    <label className="contact-label">Message</label>
                    <textarea placeholder="Tell us about your needs..." value={contactForm.message} onChange={(e) => setContactForm((prev) => ({ ...prev, message: e.target.value }))} rows={3} className="contact-input" style={{ resize: "vertical" }} />
                  </div>
                  <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-gradient" style={{ justifyContent: "center", marginTop: 4, width: "100%" }}>
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
