"use client";

import { useState, useRef, useEffect } from "react";

const WA_URL =
  "https://wa.me/584241696472?text=Hola%2C%20me%20interesa%20conocer%20la%20promoci%C3%B3n%20de%20lanzamiento%20de%20Compaz.";

const QUICK_REPLIES = [
  "¿Qué es Compaz?",
  "¿Cuánto cuesta?",
  "¿Dónde trabajan?",
  "¿Cómo funciona?",
  "Quiero ser Compita",
];

// Keywords in the user's message that trigger the WA button
const WA_TRIGGERS = ["precio", "costo", "cuánto", "cuanto", "plan", "suscripción", "promoción", "promocion", "pagar", "vale", "whatsapp", "wasap", "wsp", "hablar", "escribir", "contactar", "comunicar", "mensaje", "chat"];
// Keywords in the bot reply that trigger the scroll-to-form button
const COMPITA_TRIGGERS = ["formulario", "aplicar", "al final de la página", "al final de la pagina"];

function shouldShowWA(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  return WA_TRIGGERS.some((kw) => lower.includes(kw));
}

function shouldShowCompita(botReply: string): boolean {
  const lower = botReply.toLowerCase();
  return COMPITA_TRIGGERS.some((kw) => lower.includes(kw));
}

interface Message {
  role: "bot" | "user";
  text: string;
  showWA?: boolean;
  showCompita?: boolean;
  isError?: boolean;
}

const WELCOME: Message = {
  role: "bot",
  text: "Hola, soy el asistente de Compaz. Puedo responder tus preguntas sobre el servicio. ¿Qué quieres saber?",
};

function renderText(text: string): React.ReactNode {
  return text.split("\n").map((line, i, arr) => {
    const parts = line.split(/\*\*(.+?)\*\*/g);
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : part
    );
    return (
      <span key={i}>
        {rendered}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, messages, isTyping]);

  function trackEvent(name: string, params: Record<string, string | boolean>) {
    if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
      (window as any).gtag("event", name, params);
    }
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg: Message = { role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setShowQuickReplies(false);
    setInput("");
    setIsTyping(true);

    trackEvent("chat_message", { message_text: trimmed.slice(0, 100) });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = (await res.json()) as { reply?: string; error?: string };
      const replyText =
        data.reply ??
        "No pude procesar tu pregunta. Escríbenos a hola@micompaz.com";

      const showWA = shouldShowWA(trimmed);
      const showCompita = shouldShowCompita(replyText);

      const botMsg: Message = { role: "bot", text: replyText, showWA, showCompita };
      setMessages((prev) => [...prev, botMsg]);

      if (showCompita) {
        setTimeout(() => {
          document
            .getElementById("ser-compita")
            ?.scrollIntoView({ behavior: "smooth" });
          setIsOpen(false);
        }, 1200);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "No pude procesar tu pregunta. Escríbenos a hola@micompaz.com",
          isError: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <>
      <style>{`
        .chat-window {
          transition: opacity 200ms ease, transform 200ms ease;
        }
        .chat-window.closed {
          opacity: 0;
          transform: translateY(8px);
          pointer-events: none;
        }
        .chat-window.open {
          opacity: 1;
          transform: translateY(0);
          pointer-events: all;
        }
        .quick-reply-btn:hover {
          background: #2D1464 !important;
          color: white !important;
        }
        .send-btn:hover { opacity: 0.88; }
        .wa-btn:hover { opacity: 0.88; }
        .scroll-btn:hover { opacity: 0.88; }
        .messages-area {
          scrollbar-width: thin;
          scrollbar-color: rgba(45,20,100,0.15) transparent;
        }
        @keyframes blink {
          0%, 80%, 100% { opacity: 0.2; }
          40% { opacity: 1; }
        }
        .typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #2D1464;
          display: inline-block;
          animation: blink 1.2s infinite;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      {/* Floating button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Abrir chat"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 9999,
          backgroundColor: "#FF6B2B",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 32px rgba(26,10,60,0.25)",
          zIndex: 9999,
        }}
      >
        {isOpen ? (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <line x1="3" y1="3" x2="19" y2="19" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="19" y1="3" x2="3" y2="19" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"
              fill="white"
            />
          </svg>
        )}
      </button>

      {/* Chat window */}
      <div
        className={`chat-window ${isOpen ? "open" : "closed"}`}
        style={{
          position: "fixed",
          bottom: 92,
          right: 24,
          width: "min(380px, calc(100vw - 32px))",
          height: "min(520px, 80vh)",
          borderRadius: 24,
          backgroundColor: "#FDFAF6",
          boxShadow: "0 8px 32px rgba(26,10,60,0.25)",
          zIndex: 9998,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "var(--font-body, Inter, sans-serif)",
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: "#2D1464",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              color: "white",
              fontFamily: "var(--font-display, 'Bricolage Grotesque', sans-serif)",
              fontWeight: 700,
              fontSize: 17,
              letterSpacing: "-0.02em",
            }}
          >
            Compaz
          </span>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Cerrar chat"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.7)",
              display: "flex",
              alignItems: "center",
              padding: 4,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <line x1="2" y1="2" x2="16" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="16" y1="2" x2="2" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div
          className="messages-area"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 16px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.map((msg, i) => (
            <div key={i}>
              <div
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "10px 14px",
                    borderRadius: 16,
                    fontSize: 14,
                    lineHeight: 1.5,
                    backgroundColor: msg.role === "user" ? "#2D1464" : "#F5F0E8",
                    color: msg.role === "user" ? "white" : "#1A0A3C",
                  }}
                >
                  {msg.isError ? (
                    <span>
                      No pude procesar tu pregunta. Escríbenos a{" "}
                      <a
                        href="mailto:hola@micompaz.com"
                        style={{ color: "#FF6B2B", textDecoration: "underline" }}
                      >
                        hola@micompaz.com
                      </a>
                    </span>
                  ) : (
                    renderText(msg.text)
                  )}
                </div>
              </div>

              {/* WhatsApp button */}
              {msg.role === "bot" && msg.showWA && (
                <div style={{ marginTop: 8 }}>
                  <a
                    href={WA_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wa-btn"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "9px 16px",
                      borderRadius: 12,
                      backgroundColor: "#25D366",
                      color: "white",
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: "none",
                      cursor: "pointer",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Escribir por WhatsApp
                  </a>
                </div>
              )}

              {/* Scroll to form button */}
              {msg.role === "bot" && msg.showCompita && (
                <div style={{ marginTop: 8 }}>
                  <button
                    className="scroll-btn"
                    onClick={() => {
                      document
                        .getElementById("ser-compita")
                        ?.scrollIntoView({ behavior: "smooth" });
                      setIsOpen(false);
                    }}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 12,
                      backgroundColor: "#2D1464",
                      color: "white",
                      fontSize: 13,
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Ir al formulario
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "10px 16px",
                  borderRadius: 16,
                  backgroundColor: "#F5F0E8",
                  display: "flex",
                  gap: 4,
                  alignItems: "center",
                }}
              >
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}

          {/* Quick reply buttons */}
          {showQuickReplies && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {QUICK_REPLIES.map((label) => (
                <button
                  key={label}
                  className="quick-reply-btn"
                  onClick={() => handleSend(label)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 12,
                    border: "2px solid #2D1464",
                    backgroundColor: "white",
                    color: "#2D1464",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "background 150ms ease, color 150ms ease",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: "12px 16px 8px",
            borderTop: "1px solid rgba(45,20,100,0.1)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            flexShrink: 0,
            backgroundColor: "#FDFAF6",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend(input);
              }}
              maxLength={100}
              disabled={isTyping}
              placeholder="Escribe tu pregunta..."
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 12,
                border: "2px solid rgba(45,20,100,0.2)",
                backgroundColor: "white",
                color: "#1A0A3C",
                fontSize: 14,
                outline: "none",
                fontFamily: "inherit",
                opacity: isTyping ? 0.6 : 1,
              }}
            />
            <button
              className="send-btn"
              onClick={() => handleSend(input)}
              disabled={isTyping}
              aria-label="Enviar"
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: "#FF6B2B",
                border: "none",
                cursor: isTyping ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "opacity 150ms ease",
                opacity: isTyping ? 0.5 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div
            style={{
              textAlign: "right",
              fontSize: 11,
              color: input.length >= 90 ? "#FF6B2B" : "rgba(26,10,60,0.35)",
            }}
          >
            {100 - input.length} caracteres restantes
          </div>
        </div>
      </div>
    </>
  );
}
