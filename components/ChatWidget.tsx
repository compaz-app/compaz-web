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

type Action = "whatsapp" | "scroll-compita" | undefined;

interface KBEntry {
  id: string;
  keywords: string[];
  answer: string;
  action?: Action;
}

const KB: KBEntry[] = [
  {
    id: "que-es",
    keywords: ["qué es", "compaz", "de qué trata", "en qué consiste", "trata"],
    answer:
      "Compaz conecta a familias venezolanas en el exterior con personas locales verificadas, los Compitas, que visitan y acompañan a tus familiares en Venezuela. Después de cada visita te mandamos un reporte con fotos y notas para que sepas cómo están.",
  },
  {
    id: "precio",
    keywords: [
      "precio",
      "costo",
      "cuánto",
      "vale",
      "cobran",
      "planes",
      "suscripción",
      "básico",
      "compañía",
      "pagan",
    ],
    answer:
      "Tenemos dos planes de lanzamiento:\n\n**Plan Básico:** $50 al mes. Una visita mensual de 2 horas.\n\n**Plan Compañía:** $149 al mes. Dos visitas por semana de 2 horas cada una, 16 horas al mes en total.\n\nPor el lanzamiento tenemos una promoción especial. Escríbenos por WhatsApp para conocer los detalles.",
    action: "whatsapp",
  },
  {
    id: "donde",
    keywords: [
      "dónde",
      "ciudad",
      "caracas",
      "zona",
      "área",
      "cobertura",
      "venezuela",
      "trabajan",
      "disponible",
    ],
    answer:
      "Por ahora operamos en la zona metropolitana de Caracas y zonas cercanas. Si tu familiar vive fuera de esa área, inscríbete igual, estamos expandiendo.",
  },
  {
    id: "como-funciona",
    keywords: [
      "cómo funciona",
      "cómo me inscribo",
      "inscribir",
      "lista de espera",
      "proceso",
      "pasos",
      "empezar",
      "inscribo",
    ],
    answer:
      "Te inscribes en la lista de espera desde nuestra página. Nos ponemos en contacto contigo, coordinamos los detalles de tu familiar y te asignamos un Compita verificado. El Compita realiza la visita y te mandamos el reporte ese mismo día.",
  },
  {
    id: "verificacion",
    keywords: [
      "verifican",
      "verificación",
      "confianza",
      "seguro",
      "quiénes son",
      "antecedentes",
      "entrevista",
      "verificado",
    ],
    answer:
      "Todos los Compitas pasan por un proceso de selección exhaustivo: un cuestionario de filtro inicial, una entrevista personal por videollamada y verificación de antecedentes antes de poder hacer visitas. Además, antes de contratar el servicio puedes hablar con tu Compita en una videollamada de 20 minutos para asegurarte de que es la persona correcta para tu familiar.",
  },
  {
    id: "que-hace",
    keywords: [
      "qué hace",
      "actividades",
      "acompañar",
      "mandados",
      "cita médica",
      "limpieza",
      "cuidado",
      "incluye",
      "visita",
    ],
    answer:
      "El Compita es un amigo de confianza. Puede acompañar a tu familiar a una cita médica, hacer mandados, ir al supermercado, ayudar con el internet, salir a caminar o simplemente hacer compañía. El servicio es acompañamiento y presencia. No incluye limpieza del hogar ni cuidado médico especializado.",
  },
  {
    id: "pago",
    keywords: [
      "pago",
      "pagar",
      "zelle",
      "wise",
      "transferencia",
      "dólares",
      "cuenta",
    ],
    answer:
      "Aceptamos pagos a nuestra cuenta en Estados Unidos por Zelle o transferencia bancaria internacional, también por Wise desde cualquier país. Te enviamos los datos cuando coordinamos tu primer servicio.",
  },
  {
    id: "cancelar",
    keywords: [
      "cancelar",
      "cancelo",
      "permanencia",
      "contrato",
      "devuelven",
      "reembolso",
      "salir",
    ],
    answer:
      "Sí, puedes cancelar cuando quieras. Si no has utilizado todas las visitas del mes, te devolvemos el monto proporcional por las visitas no realizadas.",
  },
  {
    id: "compita-no-puede",
    keywords: [
      "no puede ir",
      "cancela",
      "falta",
      "otro compita",
      "reagenda",
      "reemplaza",
      "no viene",
    ],
    answer:
      "Si tu Compita no puede ir el día que le toca, enviamos a otro disponible o reagendamos la visita sin costo adicional.",
  },
  {
    id: "cuando-empieza",
    keywords: [
      "cuándo empieza",
      "inicio",
      "primera visita",
      "disponibilidad",
      "cuánto tiempo",
      "cuando",
    ],
    answer:
      "Una vez que te inscribes, nos ponemos en contacto contigo para coordinar los detalles. La fecha de inicio la acordamos juntos según tu disponibilidad y la de tu familiar.",
  },
  {
    id: "emergencia",
    keywords: [
      "emergencia",
      "algo malo",
      "problema",
      "seguridad",
      "protocolo",
      "accidente",
      "eventualidad",
    ],
    answer:
      "Contamos con un protocolo de emergencia y seguridad para atender cualquier eventualidad. Nuestro equipo los acompaña durante todo el proceso.",
  },
  {
    id: "consentimiento",
    keywords: [
      "consentimiento",
      "aceptar",
      "quiere",
      "no quiere",
      "familiar de acuerdo",
      "autorización",
    ],
    answer:
      "Sí, es indispensable. Las visitas requieren el consentimiento de tu familiar. Compaz no realiza visitas sin que la persona que las recibe esté de acuerdo. Esto es una condición no negociable, tanto por el bienestar de tu familiar como por la seguridad del Compita.",
  },
  {
    id: "cambiar-compita",
    keywords: [
      "cambiar",
      "cambio",
      "otro compita",
      "no me gusta",
      "no funciona",
      "diferente",
    ],
    answer:
      "Por supuesto. Si la relación con tu Compita no funciona por cualquier motivo, te asignamos otro sin complicaciones. Queremos que la conexión sea genuina.",
  },
  {
    id: "frecuencia-reporte",
    keywords: [
      "reporte",
      "frecuencia",
      "cada cuánto",
      "actualizaciones",
      "seguimiento",
      "noticias",
    ],
    answer:
      "Durante la visita recibes una actualización cada 30 minutos para que puedas hacer seguimiento en tiempo real y saber que todo va bien.",
  },
  {
    id: "contenido-reporte",
    keywords: [
      "qué dice el reporte",
      "información",
      "fotos",
      "novedades",
      "contenido reporte",
      "qué incluye el reporte",
    ],
    answer:
      "Cada actualización te dice qué están haciendo, que todo está bien, y cualquier novedad que valga la pena mencionar.",
  },
  {
    id: "compita-solo",
    keywords: [
      "va solo",
      "acompañado",
      "otras personas",
      "quién entra",
      "quién va",
    ],
    answer: "El único autorizado a realizar la visita es el Compita asignado.",
  },
  {
    id: "para-quien",
    keywords: [
      "adulto mayor",
      "discapacidad",
      "enfermedad",
      "cualquier persona",
      "aplica para",
      "condición",
      "solo mayores",
    ],
    answer:
      "Compaz está pensado principalmente para adultos mayores, pero el servicio es para cualquier familiar que necesite compañía y acompañamiento, incluyendo personas con discapacidad o alguna condición de salud. La única condición es que no requiera atención médica especializada ni cuidados que estén fuera del alcance del Compita. Si tienes dudas sobre si el caso de tu familiar aplica, escríbenos y lo evaluamos juntos.",
  },
  {
    id: "ser-compita",
    keywords: [
      "ser compita",
      "aplicar",
      "unirme",
      "trabajo",
      "compita",
      "formulario compita",
      "quiero ser",
    ],
    answer:
      "Nos alegra que quieras unirte. Puedes aplicar directamente desde el formulario al final de nuestra página.",
    action: "scroll-compita",
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function getAnswer(input: string): KBEntry | null {
  const normalized = normalize(input);
  for (const entry of KB) {
    for (const kw of entry.keywords) {
      if (normalized.includes(normalize(kw))) {
        return entry;
      }
    }
  }
  return null;
}

function renderAnswer(text: string): React.ReactNode {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/\*\*(.+?)\*\*/g);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
        )}
        {i < text.split("\n").length - 1 && <br />}
      </span>
    );
  });
}

interface Message {
  role: "bot" | "user";
  text: string;
  action?: Action;
  isFallback?: boolean;
}

const WELCOME: Message = {
  role: "bot",
  text: "Hola, soy el asistente de Compaz. Puedo responder tus preguntas sobre el servicio. ¿Qué quieres saber?",
};

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [isOpen, messages]);

  function trackEvent(name: string, params: Record<string, string | boolean>) {
    if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
      (window as any).gtag("event", name, params);
    }
  }

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: Message = { role: "user", text: trimmed };
    const entry = getAnswer(trimmed);

    let botMsg: Message;
    if (entry) {
      botMsg = { role: "bot", text: entry.answer, action: entry.action };
      trackEvent("chat_message", { message_text: trimmed.slice(0, 100), matched_topic: entry.id, is_fallback: false });
    } else {
      botMsg = {
        role: "bot",
        text: "No tengo esa respuesta. Escríbenos a hola@micompaz.com y te respondemos a la brevedad.",
        isFallback: true,
      };
      trackEvent("chat_message", { message_text: trimmed.slice(0, 100), matched_topic: "none", is_fallback: true });
    }

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setShowQuickReplies(false);
    setInput("");

    if (entry?.action === "scroll-compita") {
      setTimeout(() => {
        document
          .getElementById("ser-compita")
          ?.scrollIntoView({ behavior: "smooth" });
        setIsOpen(false);
      }, 800);
    }
  }

  function handleQuickReply(label: string) {
    handleSend(label);
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
        .send-btn:hover {
          opacity: 0.88;
        }
        .wa-btn:hover {
          opacity: 0.88;
        }
        .scroll-btn:hover {
          opacity: 0.88;
        }
        .messages-area {
          scrollbar-width: thin;
          scrollbar-color: rgba(45,20,100,0.15) transparent;
        }
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
                    backgroundColor:
                      msg.role === "user" ? "#2D1464" : "#F5F0E8",
                    color: msg.role === "user" ? "white" : "#1A0A3C",
                  }}
                >
                  {msg.isFallback ? (
                    <span>
                      No tengo esa respuesta. Escríbenos a{" "}
                      <a
                        href="mailto:hola@micompaz.com"
                        style={{ color: "#FF6B2B", textDecoration: "underline" }}
                      >
                        hola@micompaz.com
                      </a>{" "}
                      y te respondemos a la brevedad.
                    </span>
                  ) : (
                    renderAnswer(msg.text)
                  )}
                </div>
              </div>

              {/* Action buttons below bot message */}
              {msg.role === "bot" && msg.action === "whatsapp" && (
                <div style={{ marginTop: 8, paddingLeft: 0 }}>
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

              {msg.role === "bot" && msg.action === "scroll-compita" && (
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

          {/* Quick reply buttons */}
          {showQuickReplies && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {QUICK_REPLIES.map((label) => (
                <button
                  key={label}
                  className="quick-reply-btn"
                  onClick={() => handleQuickReply(label)}
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
            }}
          />
          <button
            className="send-btn"
            onClick={() => handleSend(input)}
            aria-label="Enviar"
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: "#FF6B2B",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "opacity 150ms ease",
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
          <div style={{ textAlign: "right", fontSize: 11, color: input.length >= 90 ? "#FF6B2B" : "rgba(26,10,60,0.35)" }}>
            {100 - input.length} caracteres restantes
          </div>
        </div>
      </div>
    </>
  );
}
