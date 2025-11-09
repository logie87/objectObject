import { useEffect, useRef, useState } from "react";

const COLORS = {
  buttonA: "#a78bfa",
  buttonB: "#ec4899",
  muted: "#6b7280",
  text: "#374151",
};

type Msg = { role: "assistant" | "user"; text: string };

export default function SetupOverlay({
  userName,
  onDone,
}: {
  userName: string;
  onDone: () => void;
}) {
  const [input, setInput] = useState("");
  const [step, setStep] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: `Welcome, ${userName}! 👋 Tell us a bit about your context so we can tune suggestions.` },
  ]);
  const mountedRef = useRef(true);
  const bootedRef = useRef(false); // ensure we only inject the first question once

  const qs = [
    "What grade level(s) and subject(s) do you teach?",
    "How many students in your class on average?",
    "Do you have students with IEPs or accommodations? Which types?",
    "What’s your biggest pain with aligning worksheets to IEPs?",
  ];

  // On mount, push the first question once
  useEffect(() => {
    mountedRef.current = true;
    if (!bootedRef.current) {
      setMsgs((m) => [...m, { role: "assistant", text: qs[0] }]);
      bootedRef.current = true;
    }
    return () => {
      mountedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    const v = input.trim();
    if (!v) return;

    // add user answer
    setMsgs((m) => [...m, { role: "user", text: v }]);
    setInput("");

    if (step < qs.length - 1) {
      const next = step + 1;
      setStep(next);
      // push next question after a small delay
      setTimeout(() => {
        if (!mountedRef.current) return;
        setMsgs((m) => [...m, { role: "assistant", text: qs[next] }]);
      }, 300);
    } else {
      // final acknowledgement then close
      setTimeout(() => {
        if (!mountedRef.current) return;
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            text:
              "Thanks! We’ll tune your alignment defaults and adaptation prompts. You can adjust this anytime in Settings.",
          },
        ]);
      }, 250);
      setTimeout(onDone, 1100);
    }
  };

  // Show only the current step context:
  // - If no user answer for this step yet -> show just the latest assistant question.
  // - Right after user answers -> show that answer + the next assistant question (once it appears).
  // Practically: render only the last two bubbles.
  const visible = msgs.slice(-2);

  const progressText = `Step ${Math.min(step + 1, qs.length)} / ${qs.length}`;
  const pct = Math.round(((step + 1) / qs.length) * 100);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 9999,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          background: "#fff",
          borderRadius: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,.30)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: `linear-gradient(135deg, ${COLORS.buttonA}, ${COLORS.buttonB})`,
            color: "#fff",
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Quick Setup</div>
              <div style={{ opacity: 0.95 }}>60-second survey to personalize suggestions</div>
            </div>
            <button
              onClick={onDone}
              aria-label="Skip setup"
              style={{
                border: "1px solid rgba(255,255,255,.6)",
                background: "transparent",
                color: "#fff",
                borderRadius: 10,
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Skip
            </button>
          </div>
          {/* Progress bar */}
          <div style={{ marginTop: 12, background: "rgba(255,255,255,.25)", height: 6, borderRadius: 999 }}>
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                borderRadius: 999,
                background: "#fff",
                transition: "width .25s ease",
              }}
            />
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{progressText}</div>
        </div>

        {/* One-step Conversation */}
        <div
          style={{
            flex: 1,
            padding: 20,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {visible.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: 14,
                  background:
                    m.role === "user"
                      ? `linear-gradient(135deg, ${COLORS.buttonA}, ${COLORS.buttonB})`
                      : "#f3f4f6",
                  color: m.role === "user" ? "#fff" : COLORS.text,
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding: 16, borderTop: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Type your answer…"
              autoFocus
              style={{
                flex: 1,
                border: "2px solid #e5e7eb",
                borderRadius: 12,
                padding: "12px 14px",
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = COLORS.buttonA)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
            />
            <button
              onClick={submit}
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                border: "none",
                color: "#fff",
                background: `linear-gradient(135deg, ${COLORS.buttonA}, ${COLORS.buttonB})`,
                cursor: "pointer",
              }}
            >
              Send
            </button>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: COLORS.muted,
              textAlign: "right",
            }}
          >
            {progressText}
          </div>
        </div>
      </div>
    </div>
  );
}
