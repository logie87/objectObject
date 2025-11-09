export default function HomePage() {
  return (
    <div style={{ fontFamily: "Inter, sans-serif", padding: 24, color: "#374151" }}>
      {/* Header */}
      <div className="header" style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>Welcome</h1>
        <div style={{ color: "#6b7280" }}>Quick Align • Summary • Top Gaps</div>
      </div>

      {/* Quick Align Section */}
      <div
        className="grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          {
            title: "Pick Unit / Upload",
            text: "Select curriculum unit or upload worksheet(s)",
          },
          { title: "Choose Students / Group", text: "Pick class or IEP subset" },
          { title: "Run Alignment", text: "Local RAG + multi-agent consensus" },
        ].map((card, i) => (
          <button
            key={i}
            className="card"
            style={{
              textAlign: "left",
              padding: 20,
              borderRadius: 12,
              backgroundColor: "white",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              border: "none",
              cursor: "pointer",
              transition: "transform 0.15s ease, box-shadow 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.1)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)")
            }
          >
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
              {card.title}
            </div>
            <div style={{ color: "#6b7280" }}>{card.text}</div>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div
        className="panel"
        style={{
          padding: 20,
          background: "#f9fafb",
          borderRadius: 16,
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
          {/* Left Column */}
          <div className="grid" style={{ display: "grid", gap: 16 }}>
            {/* Alignment Snapshot */}
            <div
              className="card"
              style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 10 }}>
                Alignment Snapshot
              </div>
              <div
                style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
              >
                <span style={{ background: "#dcfce7", padding: "4px 8px", borderRadius: 8 }}>
                  ▲ Good • 82%
                </span>
                <span style={{ background: "#fef9c3", padding: "4px 8px", borderRadius: 8 }}>
                  ■ At-risk • 14%
                </span>
                <span style={{ background: "#fee2e2", padding: "4px 8px", borderRadius: 8 }}>
                  ● Gap • 4%
                </span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>
                  Last run: just now
                </span>
              </div>
            </div>

            {/* Recent Runs */}
            <div
              className="card"
              style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent Runs</div>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "10px 0",
                    borderTop: i === 1 ? "none" : "1px solid #f1f5f9",
                  }}
                >
                  <div>Unit {i}: Fractions – Period {i}</div>
                  <div>
                    <span style={{ background: "#dcfce7", padding: "2px 6px", borderRadius: 6 }}>
                      ▲ {80 + i}%
                    </span>
                  </div>
                  <button
                    className="btn ghost"
                    style={{
                      backgroundColor: "#f3f4f6",
                      border: "none",
                      color: "#374151",
                      borderRadius: 8,
                      padding: "4px 10px",
                      fontSize: 14,
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                      transition: "background-color 0.3s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#e5e7eb")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "#f3f4f6")
                    }
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>

            {/* Shortcuts */}
            <div
              className="card"
              style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Shortcuts</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {["Upload Worksheet", "New Student Group", "View Reports", "Open Library"].map(
                  (text) => (
                    <button
                      key={text}
                      style={{
                        backgroundColor: "#f3f4f6",
                        color: "#374151",
                        borderRadius: 8,
                        border: "none",
                        padding: "8px 12px",
                        fontSize: 14,
                        cursor: "pointer",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                        transition: "background-color 0.2s ease",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#e5e7eb")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "#f3f4f6")
                      }
                    >
                      {text}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <aside
            className="card"
            style={{
              position: "sticky",
              top: 0,
              backgroundColor: "#f3f4f6",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
              Consensus Adaptation
            </div>
            <div style={{ color: "#6b7280", marginBottom: 12 }}>
              Rationale + evidence snippets
            </div>
            <div
              className="card"
              style={{
                background: "white",
                borderRadius: 8,
                padding: 12,
                boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
              }}
            >
              Provide TTS version, scaffold steps, alternate oral assessment, time 1.5×.
              <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
                Evidence: IEP accommodations; activity reading load; prior performance.
              </div>
            </div>

            {/* Centered Buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="btn primary"
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #a78bfa, #ec4899)",
                  color: "white",
                  borderRadius: 8,
                  border: "none",
                  height: 44,
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  boxShadow: "0 3px 8px rgba(0,0,0,0.1)",
                  textAlign: "center",
                  lineHeight: "44px", // Center text vertically
                }}
              >
                Insert into lesson
              </button>
              <button
                className="btn ghost"
                style={{
                  flex: 1,
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  borderRadius: 8,
                  border: "none",
                  height: 44,
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                  transition: "background-color 0.2s ease",
                  textAlign: "center",
                  lineHeight: "44px", // Center text vertically
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#e5e7eb")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#f3f4f6")
                }
              >
                Copy
              </button>
            </div>

            {/* Tips */}
            <div
              className="card"
              style={{
                marginTop: 12,
                background: "white",
                borderRadius: 8,
                padding: 12,
                boxShadow: "0 3px 8px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Quick Tips</div>
              <ul style={{ margin: "0 0 0 18px", padding: 0, color: "#6b7280" }}>
                <li>Use the Library for BC guidelines before running alignment.</li>
                <li>Filters in Curriculum require a re-run to refresh badges.</li>
                <li>Student view → one-click Generate pulls evidence into the panel.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
