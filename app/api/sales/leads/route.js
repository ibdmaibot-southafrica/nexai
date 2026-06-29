import { chat } from "../../../../lib/llm.js";
import { logAction, addInvoice } from "../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/sales/leads - Find real leads via web search + AI qualification
export async function GET() {
  try {
    // Use DuckDuckGo instant answer API (free, no key needed)
    const queries = [
      "AI startups USA 2026 funding",
      "AI companies Canada hiring", 
      "machine learning startups San Francisco",
      "AI tools for business New York",
    ];
    
    const leads = [];
    
    for (const query of queries.slice(0, 2)) {
      try {
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const res = await fetch(ddgUrl, { headers: { "User-Agent": "NexAI/1.0" } });
        const data = await res.json();
        
        // Extract real topics/results
        if (data.RelatedTopics) {
          for (const topic of data.RelatedTopics.slice(0, 3)) {
            if (topic.Text && topic.FirstURL) {
              leads.push({
                source: "web_search",
                query,
                company: topic.Text.substring(0, 100),
                url: topic.FirstURL,
                snippet: topic.Text,
                found_at: new Date().toISOString(),
              });
            }
          }
        }
        
        if (data.AbstractText) {
          leads.push({
            source: "web_search",
            query,
            company: data.Heading || query,
            url: data.AbstractURL || "",
            snippet: data.AbstractText.substring(0, 200),
            found_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error(`Search failed for ${query}:`, err.message);
      }
    }
    
    // Also use GitHub API to find real AI companies (free, no key for public data)
    try {
      const githubRes = await fetch("https://api.github.com/search/repositories?q=topic:machine-learning+topic:started&sort=stars&per_page=5", {
        headers: { "User-Agent": "NexAI/1.0" }
      });
      const githubData = await githubRes.json();
      if (githubData.items) {
        for (const repo of githubData.items.slice(0, 3)) {
          leads.push({
            source: "github",
            query: "ML startups on GitHub",
            company: repo.full_name,
            url: repo.html_url,
            snippet: repo.description || "AI/ML project",
            stars: repo.stargazers_count,
            found_at: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.error("GitHub search failed:", err.message);
    }
    
    // Use AI to qualify and score the leads
    const qualifiedLeads = [];
    for (const lead of leads.slice(0, 10)) {
      const qualification = await chat(
        "You are a B2B sales qualification expert. Score this lead 1-10 for likelihood to buy AI tools.",
        `Lead: ${lead.company}\nURL: ${lead.url}\nDescription: ${lead.snippet}\nSource: ${lead.source}\n\nRespond JSON: {"score": 7, "reason": "why", "outreach_angle": "how to pitch them"}`,
        { temperature: 0.3 }
      );
      
      try {
        const jsonMatch = qualification.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const q = JSON.parse(jsonMatch[0]);
          qualifiedLeads.push({ ...lead, qualification: q });
        }
      } catch {
        qualifiedLeads.push({ ...lead, qualification: { score: 5, reason: "Unqualified", outreach_angle: "General pitch" } });
      }
    }
    
    // Sort by score
    qualifiedLeads.sort((a, b) => (b.qualification?.score || 0) - (a.qualification?.score || 0));
    
    await logAction("Sales", "lead_search", { 
      totalFound: leads.length, 
      qualified: qualifiedLeads.length,
      topLeads: qualifiedLeads.slice(0, 3).map(l => l.company)
    });
    
    return Response.json({ 
      success: true, 
      leads: qualifiedLeads,
      totalFound: leads.length,
      message: `Found ${qualifiedLeads.length} real leads from web search`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/sales/leads - Create outreach for a specific lead
export async function POST(request) {
  try {
    const body = await request.json();
    const { lead, product } = body;
    
    if (!lead) return Response.json({ error: "Lead required" }, { status: 0 });
    
    // Generate personalized outreach message
    const outreach = await chat(
      "You are a B2B sales copywriter for NexAI. Write a personalized outreach email.",
      `Lead company: ${lead.company}\nURL: ${lead.url}\nDescription: ${lead.snippet}\nOur product: ${product || "AI tools for businesses"}\n\nWrite a short, compelling outreach email (subject + 3-4 sentence body). JSON: {"subject": "...", "body": "..."}`,
      { temperature: 0.8 }
    );
    
    let message = { subject: "AI tools for your business", body: "We help businesses like yours with AI automation." };
    try {
      const jsonMatch = outreach.match(/\{[\s\S]*\}/);
      if (jsonMatch) message = JSON.parse(jsonMatch[0]);
    } catch {}
    
    // Create invoice for this lead
    const invoice = await addInvoice({
      customer: lead.company,
      product: product || "NexAI AI Tools",
      amount: 49,
      status: "pending",
    });
    
    await logAction("Sales", "outreach_sent", { lead: lead.company, invoiceId: invoice.id });
    
    return Response.json({ success: true, message, invoice });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
