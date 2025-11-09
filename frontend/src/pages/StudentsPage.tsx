import React from "react";

// Color constants Edit
const COLORS = {
  readingBadgeBg: "rgba(251, 191, 191, 0.15)",
  readingBadgeText: "#ef4444",
  timeBadgeBg: "rgba(253, 230, 138, 0.15)",
  timeBadgeText: "#f59e0b",
  pieGradientStart: "#34d399",
  pieGradientEnd: "#22c55e",
  pieEmpty: "#e5e7eb",
  buttonGradientStart: "#a78bfa",
  buttonGradientEnd: "#ec4899",
  cardBg: "var(--surface-100)",
  cardShadow: "0 6px 18px rgba(0,0,0,0.08)",
  mutedText: "#6b7280",
  mainText: "#374151",
  avatarBg: "#eef2ff",
};

// Icons
const Icons = {
  Person: () => (
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
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
    </svg>
  ),
  Reading: () => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill={COLORS.readingBadgeText}
      stroke="none"
    >
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5V4.5A2.5 2.5 0 0 0 17.5 2h-11A2.5 2.5 0 0 0 4 4.5v15z" />
    </svg>
  ),
  Time: () => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill={COLORS.timeBadgeText}
      stroke="none"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

// Student Card Component
function StudentCard({ student }: { student: typeof students[0] }) {
  return (
    <div
      style={{
        padding: 32,
        borderRadius: 16,
        backgroundColor: "white", // changed to white
        boxShadow: COLORS.cardShadow,
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* Top: Avatar + Name + Pie */}
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
          <Icons.Person />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: COLORS.mainText }}>
            {student.name}
          </div>
          <div style={{ color: COLORS.mutedText, fontSize: 14, marginTop: 4 }}>
            Alignment
          </div>
        </div>

        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: `conic-gradient(${COLORS.pieGradientStart} ${
              student.alignment * 3.6
            }deg, ${COLORS.pieEmpty} ${student.alignment * 3.6}deg)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: 16,
            color: COLORS.mainText,
            boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              backgroundColor: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            {student.alignment}%
          </div>
        </div>
      </div>

      {/* Badges */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {student.badges.map((b) => {
          const Icon = Icons[b as keyof typeof Icons];
          const badgeBg =
            b === "Reading" ? COLORS.readingBadgeBg : COLORS.timeBadgeBg;
          const badgeText =
            b === "Reading" ? COLORS.readingBadgeText : COLORS.timeBadgeText;

          return (
            <span
              key={b}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 500,
                backgroundColor: badgeBg,
                color: badgeText,
              }}
            >
              <Icon />
              {b}
            </span>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          style={{
            flex: 1,
            padding: "14px 0",
            borderRadius: 12,
            background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
            color: "white",
            fontWeight: 600,
            fontSize: 16,
            border: "none",
            cursor: "pointer",
            textAlign: "center",
            boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
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
            color: COLORS.mainText,
            backgroundColor: "#f3f4f6",
            transition: "background-color 0.3s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#e5e7eb")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#f3f4f6")
          }
        >
          Edit
        </button>
      </div>
    </div>
  );
}

// Sample students
const students = Array.from({ length: 8 }, (_, i) => ({
  name: `Student${i + 1}`,
  alignment: 72,
  badges: ["Reading", "Time"],
}));

// Sample units and IEPs
const units = [
  "Unit 1: Math Basics",
  "Unit 2: Reading Comprehension",
  "Unit 3: Science",
];
const ieps = ["IEP Goal 1", "IEP Goal 2", "IEP Goal 3", "IEP Goal 4"];

export default function StudentsPage() {
  const [showModal, setShowModal] = React.useState(false);
  const [selectedStudents, setSelectedStudents] = React.useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = React.useState<string[]>([]);
  const [selectedIEPs, setSelectedIEPs] = React.useState<string[]>([]);

  const toggleSelection = (
    item: string,
    list: string[],
    setter: (list: string[]) => void
  ) => {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  return (
    <div style={{ padding: 24, width: "100%" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 32, marginBottom: 4 }}>Students</h1>
          <div style={{ color: COLORS.mutedText }}>
            IEP snapshots • Top gaps • One-click view/edit
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search students..."
            style={{
              padding: "8px 16px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              outline: "none",
              minWidth: 240,
            }}
          />

          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
              color: "white",
              fontWeight: 600,
              fontSize: 16,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
              whiteSpace: "nowrap",
            }}
          >
            Generate Report
          </button>
        </div>
      </div>

      {/* Student Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 24,
        }}
      >
        {students.map((student) => (
          <StudentCard key={student.name} student={student} />
        ))}
      </div>

      {/* Report Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 32,
              maxWidth: 600,
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 24, marginBottom: 8, color: COLORS.mainText }}>
              Generate Report
            </h2>
            <p style={{ color: COLORS.mutedText, marginBottom: 24 }}>
              Select students, units, and IEPs to include in your report
            </p>

            {/* Students Section */}
            <div style={{ marginBottom: 24 }}>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 12,
                  color: COLORS.mainText,
                }}
              >
                Students
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {students.map((student) => (
                  <button
                    key={student.name}
                    onClick={() =>
                      toggleSelection(
                        student.name,
                        selectedStudents,
                        setSelectedStudents
                      )
                    }
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: selectedStudents.includes(student.name)
                        ? `2px solid ${COLORS.buttonGradientEnd}`
                        : "2px solid #e5e7eb",
                      backgroundColor: selectedStudents.includes(student.name)
                        ? "rgba(236, 72, 153, 0.1)"
                        : "white",
                      color: selectedStudents.includes(student.name)
                        ? COLORS.buttonGradientEnd
                        : COLORS.mainText,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    {student.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Units Section */}
            <div style={{ marginBottom: 24 }}>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 12,
                  color: COLORS.mainText,
                }}
              >
                Units
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {units.map((unit) => (
                  <button
                    key={unit}
                    onClick={() =>
                      toggleSelection(unit, selectedUnits, setSelectedUnits)
                    }
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: selectedUnits.includes(unit)
                        ? `2px solid ${COLORS.buttonGradientEnd}`
                        : "2px solid #e5e7eb",
                      backgroundColor: selectedUnits.includes(unit)
                        ? "rgba(236, 72, 153, 0.1)"
                        : "white",
                      color: selectedUnits.includes(unit)
                        ? COLORS.buttonGradientEnd
                        : COLORS.mainText,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>

            {/* IEP Section */}
            <div style={{ marginBottom: 32 }}>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 12,
                  color: COLORS.mainText,
                }}
              >
                IEP Goals
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ieps.map((iep) => (
                  <button
                    key={iep}
                    onClick={() =>
                      toggleSelection(iep, selectedIEPs, setSelectedIEPs)
                    }
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: selectedIEPs.includes(iep)
                        ? `2px solid ${COLORS.buttonGradientEnd}`
                        : "2px solid #e5e7eb",
                      backgroundColor: selectedIEPs.includes(iep)
                        ? "rgba(236, 72, 153, 0.1)"
                        : "white",
                      color: selectedIEPs.includes(iep)
                        ? COLORS.buttonGradientEnd
                        : COLORS.mainText,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    {iep}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  color: COLORS.mainText,
                  backgroundColor: "#f3f4f6",
                  fontSize: 16,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log({
                    students: selectedStudents,
                    units: selectedUnits,
                    ieps: selectedIEPs,
                  });
                  setShowModal(false);
                }}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
                  color: "white",
                  fontWeight: 600,
                  fontSize: 16,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                }}
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
