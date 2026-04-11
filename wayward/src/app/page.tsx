export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>Wayward</h1>
      <p style={{ color: "var(--text-secondary)" }}>
        Audio-driven interactive fiction
      </p>
    </main>
  );
}
