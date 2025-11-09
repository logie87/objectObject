import { useState } from 'react';

const COLORS = {
  buttonGradientStart: "#a78bfa",
  buttonGradientEnd: "#ec4899",
  mutedText: "#6b7280",
  mainText: "#374151",
};

const Icons = {
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
  Sparkles: () => (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
    </svg>
  ),
};

export default function HomePage() {
  const [isFirstLogin, setIsFirstLogin] = useState(true);
  const [onboardingInput, setOnboardingInput] = useState("");
  const [conversation, setConversation] = useState([
    { role: "assistant", text: "Welcome! 👋 We're so excited to have you here. To help us personalize your experience, tell us a bit about yourself as a teacher. What grade level do you teach, and what subjects?" }
  ]);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const questions = [
    "What grade level do you teach, and what subjects?",
    "How many students do you typically have in your class?",
    "Do you work with students with IEPs or special accommodations?",
    "What's your biggest challenge when it comes to curriculum alignment?",
  ];

  const handleOnboardingSubmit = () => {
    if (onboardingInput.trim()) {
      setConversation(prev => [...prev, { role: "user", text: onboardingInput }]);
      
      if (currentQuestion < questions.length - 1) {
        const nextQuestion = currentQuestion + 1;
        setCurrentQuestion(nextQuestion);
        setTimeout(() => {
          setConversation(prev => [...prev, { 
            role: "assistant", 
            text: questions[nextQuestion] 
          }]);
        }, 500);
      } else {
        setTimeout(() => {
          setConversation(prev => [...prev, { 
            role: "assistant", 
            text: "Thank you for sharing! We're setting up your personalized dashboard now. Let's get started! 🎉" 
          }]);
          setTimeout(() => {
            setIsFirstLogin(false);
          }, 2000);
        }, 500);
      }
      
      setOnboardingInput("");
    }
  };

  // Onboarding Modal
  if (isFirstLogin) {
    return (
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
          zIndex: 9999,
          padding: 24,
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            borderRadius: 24,
            maxWidth: 700,
            width: "100%",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
              padding: 32,
              borderRadius: "24px 24px 0 0",
              textAlign: "center",
              color: "white",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <Icons.Sparkles />
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
              Welcome to Alignment Hub!
            </h1>
            <p style={{ fontSize: 16, opacity: 0.95 }}>
              Let's get to know you better to personalize your experience
            </p>
          </div>

          {/* Conversation Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {conversation.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  animation: "fadeIn 0.3s ease-in",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "12px 16px",
                    borderRadius: 16,
                    backgroundColor: msg.role === "user" 
                      ? `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`
                      : "#f3f4f6",
                    color: msg.role === "user" ? "white" : COLORS.mainText,
                    background: msg.role === "user" 
                      ? `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`
                      : "#f3f4f6",
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div
            style={{
              padding: 24,
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Type your answer here..."
                value={onboardingInput}
                onChange={(e) => setOnboardingInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleOnboardingSubmit()}
                style={{
                  flex: 1,
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "2px solid #e5e7eb",
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
                onClick={handleOnboardingSubmit}
                style={{
                  padding: "14px 28px",
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
            {currentQuestion === questions.length - 1 && conversation.length > 1 && (
              <button
                onClick={() => setIsFirstLogin(false)}
                style={{
                  marginTop: 12,
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  color: COLORS.mutedText,
                  cursor: "pointer",
                  fontSize: 14,
                  width: "100%",
                }}
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="header">
        <h1>Welcome</h1>
        <div className="sub">Quick Align • Summary • Top Gaps</div>
      </div>

      {/* Quick Align */}
      <div className="grid" style={{gridTemplateColumns:"repeat(3, minmax(240px, 1fr))", marginBottom:24}}>
        <button className="card" style={{textAlign:"left", boxShadow:"0 1px 3px rgba(0,0,0,0.1)", border:"1px solid #e5e7eb"}}>
          <div style={{fontWeight:700, fontSize:18, marginBottom:6}}>Pick Unit / Upload</div>
          <div style={{color:"var(--muted)"}}>Select curriculum unit or upload worksheet(s)</div>
        </button>
        <button className="card" style={{textAlign:"left", boxShadow:"0 1px 3px rgba(0,0,0,0.1)", border:"1px solid #e5e7eb"}}>
          <div style={{fontWeight:700, fontSize:18, marginBottom:6}}>Choose Students / Group</div>
          <div style={{color:"var(--muted)"}}>Pick class or IEP subset</div>
        </button>
        <button className="card" style={{textAlign:"left", boxShadow:"0 1px 3px rgba(0,0,0,0.1)", border:"1px solid #e5e7eb"}}>
          <div style={{fontWeight:700, fontSize:18, marginBottom:6}}>Run Alignment</div>
          <div style={{color:"var(--muted)"}}>Local RAG + multi-agent consensus</div>
        </button>
      </div>

      {/* Main split: summary + panel */}
      <div className="panel" style={{padding:20, boxShadow:"0 1px 3px rgba(0,0,0,0.1)", border:"1px solid #e5e7eb"}}>
        <div style={{display:"grid", gridTemplateColumns:"1fr 360px", gap:20}}>
          <div className="grid" style={{gridTemplateColumns:"1fr", gap:16}}>
            {/* Alignment snapshot */}
            <div className="card" style={{boxShadow:"0 1px 3px rgba(0,0,0,0.1)", border:"1px solid #e5e7eb"}}>
              <div style={{fontWeight:700, marginBottom:10}}>Alignment Snapshot</div>
              <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
                <span className="badge good">▲ Good • 82%</span>
                <span className="badge warn">■ At-risk • 14%</span>
                <span className="badge bad">● Gap • 4%</span>
                <span style={{marginLeft:"auto", fontSize:12, color:"var(--muted)"}}>Last run: just now</span>
              </div>
            </div>

            {/* Recent runs */}
            <div className="card" style={{boxShadow:"0 1px 3px rgba(0,0,0,0.1)", border:"1px solid #e5e7eb"}}>
              <div style={{fontWeight:700, marginBottom:10}}>Recent Runs</div>
              {[1,2,3].map(i=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:12,alignItems:"center",padding:"10px 0",borderTop:i===1?"none":"1px solid #e5e7eb"}}>
                  <div>Unit {i}: Fractions – Period {i}</div>
                  <div><span className="badge good">▲ {80+i}%</span></div>
                  <button className="btn ghost" style={{color:"#6b7280"}}>Open</button>
                </div>
              ))}
            </div>

            {/* Shortcuts */}
            <div className="card" style={{boxShadow:"0 1px 3px rgba(0,0,0,0.1)", border:"1px solid #e5e7eb"}}>
              <div style={{fontWeight:700, marginBottom:10}}>Shortcuts</div>
              <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
                <button className="btn flat">Upload Worksheet</button>
                <button className="btn flat">New Student Group</button>
                <button className="btn flat">View Reports</button>
                <button className="btn flat">Open Library</button>
              </div>
            </div>
          </div>

          {/* Right panel: consensus preview */}
          <aside className="card" style={{position:"sticky", top:0, boxShadow:"0 1px 3px rgba(0,0,0,0.1)", border:"1px solid #e5e7eb"}}>
            <div style={{fontWeight:800, fontSize:18, marginBottom:8}}>Consensus Adaptation</div>
            <div style={{color:"var(--muted)", marginBottom:12}}>Rationale + evidence snippets</div>
            <div className="card" style={{background:"#f8fafc", boxShadow:"0 1px 2px rgba(0,0,0,0.05)", border:"1px solid #e5e7eb"}}>
              Provide TTS version, scaffold steps, alternate oral assessment, time 1.5×.
              <div style={{marginTop:8,fontSize:12,color:"var(--muted)"}}>
                Evidence: IEP accommodations; activity reading load; prior performance.
              </div>
            </div>
            <div style={{display:"flex", gap:8, marginTop:12}}>
              <button className="btn primary">Insert into lesson</button>
              <button className="btn ghost" style={{color:"#6b7280"}}>Copy</button>
            </div>

            {/* Quick tips */}
            <div className="card" style={{marginTop:12, boxShadow:"0 1px 2px rgba(0,0,0,0.05)", border:"1px solid #e5e7eb"}}>
              <div style={{fontWeight:700, marginBottom:6}}>Quick Tips</div>
              <ul style={{margin:"0 0 0 18px", padding:0}}>
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