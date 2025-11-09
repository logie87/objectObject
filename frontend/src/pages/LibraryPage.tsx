// import React from "react";

// Color constants
const COLORS = {
  readingBadgeBg: "rgba(251, 191, 191, 0.15)",
  readingBadgeText: "#ef4444",
  timeBadgeBg: "rgba(253, 230, 138, 0.15)",
  timeBadgeText: "#f59e0b",
  pieGradientStart: "#34d399", // green
  pieGradientEnd: "#22c55e",
  pieEmpty: "#e5e7eb",
  buttonGradientStart: "#a78bfa",
  buttonGradientEnd: "#ec4899",
  cardBg: "#ffffff",
  cardShadow: "0 6px 18px rgba(0,0,0,0.08)",
  mutedText: "#6b7280",
  mainText: "#374151",
  avatarBg: "#ecfeff",
};

// Icons
const Icons = {
  Document: () => (
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

const docs = [
  "BC-Adaptations-Guidelines-Reading.pdf",
  "BC-Universal-Design-for-Learning-Overview.pdf",
  "BC-Assessment-Accommodations-K-12.pdf",
  "BC-IEP-Planning-Template.docx",
  "BC-Assistive-Technology-Quick-Ref.pdf",
  "BC-Executive-Function-Supports.pdf",
  "BC-ELL-Adjustment-Guidelines.pdf",
  "BC-Math-Alternate-Pathways.pdf",
  "BC-Behavior-Support-Strategies.pdf",
  "BC-Transition-Planning-Checklist.pdf",
];

export default function LibraryPage() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 32, marginBottom: 4 }}>Library</h1>
          <div style={{ color: COLORS.mutedText }}>Ingested curriculum & guidance documents</div>
        </div>
        <button
          style={{
            padding: "14px 28px",
            borderRadius: 12,
            border: "none",
            fontWeight: 600,
            fontSize: 16,
            cursor: "pointer",
            color: "white",
            background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
            boxShadow: "0 4px 12px rgba(168,85,247,0.3)",
            transition: "all 0.3s",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 16px rgba(168,85,247,0.4)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(168,85,247,0.3)";
          }}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf,.doc,.docx';
            input.multiple = true;
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files) {
                console.log('Files selected:', Array.from(files).map(f => f.name));
                // Handle file upload here
              }
            };
            input.click();
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload Documents
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: 24,
        }}
      >
        {docs.map((name, i) => (
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
                <Icons.Document />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 20, color: COLORS.mainText }}>{name}</div>
                <div style={{ color: COLORS.mutedText, fontSize: 14, marginTop: 4 }}>Added recently</div>
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
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#e5e7eb";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f3f4f6";
                }}
              >
                View
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
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 16px rgba(168,85,247,0.4)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                }}
              >
                Analyze
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}