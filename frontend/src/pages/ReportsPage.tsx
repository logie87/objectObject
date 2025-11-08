
// Color constants
const COLORS = {
  buttonGradientStart: "#a78bfa",
  buttonGradientEnd: "#ec4899",
  cardBg: "#ffffff",
  cardShadow: "0 6px 18px rgba(0,0,0,0.08)",
  mutedText: "#6b7280",
  mainText: "#374151",
  avatarBg: "#eef2ff",
};

// Icons
const Icons = {
  Report: () => (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke={COLORS.mainText}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
};

const reports = [
  "Class Alignment Snapshot",
  "Student IEP Alignment (1-pager)",
  "Outcome Gap Map",
];

export default function ReportsPage() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, marginBottom: 4 }}>Reports</h1>
        <div style={{ color: COLORS.mutedText }}>
          Class Alignment • Student IEP Alignment • Outcome Gap Map
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: 24,
        }}
      >
        {reports.map((name, i) => (
          <div
            key={i}
            style={{
              padding: 32,
              borderRadius: 16,
              backgroundColor: COLORS.cardBg,
              boxShadow: COLORS.cardShadow,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {/* Top: Icon + Name */}
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  backgroundColor: COLORS.avatarBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icons.Report />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 20,
                    color: COLORS.mainText,
                  }}
                >
                  {name}
                </div>
                <div
                  style={{
                    color: COLORS.mutedText,
                    fontSize: 14,
                    marginTop: 4,
                  }}
                >
                  Preview not implemented
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  color: COLORS.mainText,
                  backgroundColor: "#f3f4f6",
                  transition: "all 0.3s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "#e5e7eb";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "#f3f4f6";
                }}
              >
                Open
              </button>

              <button
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "white",
                  background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
                  transition: "all 0.3s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform =
                    "translateY(-3px)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 8px 16px rgba(168,85,247,0.4)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform =
                    "translateY(0)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "none";
                }}
              >
                Export PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

