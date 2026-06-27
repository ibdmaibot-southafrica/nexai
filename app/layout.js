export const metadata = {
  title: "NexAI - Autonomous AI Company",
  description: "Self-running AI company powered by autonomous agents",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#0a0a0f",
          color: "#e0e0e0",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
