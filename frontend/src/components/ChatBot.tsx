import { useState, useEffect } from "react";

const COLORS = {
  border: "#e5e7eb",
  cardBg: "#f8fafc",
  buttonGradientStart: "#3DAFBC",
  buttonGradientEnd: "#35598f",
};

export default function ChatBot() {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "bot"; text: string }>>([]);
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    if (chatOpen && messages.length === 0) {
      setMessages([
        {
          role: "bot",
          text: "Hi! How can I help you today?",
        },
      ]);
    }
  }, [chatOpen, messages.length]);

  function handleSendMessage() {
    if (!inputText.trim()) return;
    const userMsg = { role: "user" as const, text: inputText };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");

    setTimeout(() => {
      const botMsg = {
        role: "bot" as const,
        text: "Thanks for reaching out! I’ll get back to you soon.",
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 500);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
          border: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          color: "#fff",
          zIndex: 1000,
        }}
        title="Chat with us"
      >
        💬
      </button>

      {/* Chat window */}
      {chatOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            right: 24,
            width: 360,
            height: 500,
            background: "#fff",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            zIndex: 1000,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: 16,
              background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
              color: "#fff",
              fontWeight: 700,
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Chat Support</span>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                fontSize: 20,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              padding: 16,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                }}
              >
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: msg.role === "user" ? COLORS.buttonGradientEnd : COLORS.cardBg,
                    color: msg.role === "user" ? "#fff" : "#000",
                    border: msg.role === "bot" ? `1px solid ${COLORS.border}` : "none",
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div
            style={{
              padding: 16,
              borderTop: `1px solid ${COLORS.border}`,
              display: "flex",
              gap: 8,
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type your message..."
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              onClick={handleSendMessage}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
