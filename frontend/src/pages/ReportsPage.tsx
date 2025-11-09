import { useState } from 'react';

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
  History: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Send: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Close: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

const reports = [
  "Class Alignment Snapshot",
  "Student IEP Alignment (1-pager)",
  "Outcome Gap Map",
];

const historyData = [
  { date: "Nov 8, 2025 • 10:30 AM", report: "Class Alignment Snapshot", unit: "Unit 3: Fractions" },
  { date: "Nov 7, 2025 • 2:15 PM", report: "Student IEP Alignment", unit: "Unit 2: Decimals" },
  { date: "Nov 6, 2025 • 9:45 AM", report: "Outcome Gap Map", unit: "Unit 3: Fractions" },
  { date: "Nov 5, 2025 • 3:20 PM", report: "Class Alignment Snapshot", unit: "Unit 1: Addition" },
  { date: "Nov 4, 2025 • 11:00 AM", report: "Student IEP Alignment", unit: "Unit 3: Fractions" },
];

export default function ReportsPage() {
  const [showHistory, setShowHistory] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showFeedbackSuccess, setShowFeedbackSuccess] = useState(false);

  const handleSendFeedback = () => {
    if (feedback.trim()) {
      setShowFeedbackSuccess(true);
      setFeedback("");
      setTimeout(() => setShowFeedbackSuccess(false), 3000);
    }
  };

  return (
    <div style={{ padding: 24, paddingBottom: 120 }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 32, marginBottom: 4 }}>Reports</h1>
          <div style={{ color: COLORS.mutedText }}>
            Class Alignment • Student IEP Alignment • Outcome Gap Map
          </div>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            padding: "12px 20px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            fontWeight: 600,
            cursor: "pointer",
            color: COLORS.mainText,
            backgroundColor: "white",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f9fafb";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "white";
          }}
        >
          <Icons.History />
          See History
        </button>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div
          style={{
            marginBottom: 24,
            padding: 24,
            borderRadius: 16,
            backgroundColor: COLORS.cardBg,
            boxShadow: COLORS.cardShadow,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: COLORS.mainText }}>Report History</h2>
            <button
              onClick={() => setShowHistory(false)}
              style={{
                padding: 8,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                backgroundColor: "transparent",
                color: COLORS.mutedText,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icons.Close />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {historyData.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: COLORS.mainText, marginBottom: 4 }}>
                    {item.report}
                  </div>
                  <div style={{ fontSize: 14, color: COLORS.mutedText }}>
                    {item.unit} • {item.date}
                  </div>
                </div>
                <button
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "white",
                    background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
                    whiteSpace: "nowrap",
                  }}
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reports Grid */}
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
                  Generate new report
                </div>
              </div>
            </div>

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
                  e.currentTarget.style.backgroundColor = "#e5e7eb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#f3f4f6";
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
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = "0 8px 16px rgba(168,85,247,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Export PDF
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Fixed Feedback Chat Bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "white",
          borderTop: "1px solid #e5e7eb",
          boxShadow: "0 -4px 12px rgba(0,0,0,0.08)",
          padding: "16px 24px",
          zIndex: 1000,
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 12, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Have feedback or concerns? Let us know..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendFeedback()}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontSize: 15,
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = COLORS.buttonGradientStart;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb";
            }}
          />
          <button
            onClick={handleSendFeedback}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
              color: "white",
              background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(168,85,247,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <Icons.Send />
            Send
          </button>
        </div>
        {showFeedbackSuccess && (
          <div
            style={{
              maxWidth: 1200,
              margin: "8px auto 0",
              padding: "8px 16px",
              borderRadius: 8,
              backgroundColor: "#d1fae5",
              color: "#065f46",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            ✓ Feedback sent successfully!
          </div>
        )}
      </div>
    </div>
  );
}