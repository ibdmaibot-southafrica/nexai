export const metadata = {
  title: "NexAI — Autonomous Company Control",
  description: "Mission control for a self-running AI company. Live revenue, agents, products, and telemetry.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --bg: #07070C;
            --panel: #0F0F18;
            --panel-2: #14141F;
            --line: rgba(130,140,170,0.12);
            --ink: #E8EAF2;
            --muted: #888EA6;
            --cyan: #22D3EE;
            --violet: #8B5CF6;
            --green: #34D399;
            --amber: #FBBF24;
            --red: #FB7185;
            --display: 'Space Grotesk', system-ui, sans-serif;
            --mono: 'JetBrains Mono', ui-monospace, monospace;
            --body: 'Inter', system-ui, sans-serif;
          }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          body {
            background: var(--bg);
            color: var(--ink);
            font-family: var(--body);
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
          }
          ::selection { background: rgba(34,211,238,0.25); }
          @media (prefers-reduced-motion: reduce) {
            * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
