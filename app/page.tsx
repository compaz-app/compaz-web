"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  ShoppingCart,
  Building2,
  Stethoscope,
  Dumbbell,
  Banknote,
  Wrench,
  Video,
  MessageCircle,
  ShieldCheck,
  Camera,
  MapPin,
} from "lucide-react";

// ─── Wave Divider ─────────────────────────────────────────────────────────────

const WAVE_PATHS: Record<number, string> = {
  1: "M0,60 C480,0 960,0 1440,60 L1440,80 L0,80 Z",       // cóncava (baja al centro)
  2: "M0,20 C480,80 960,80 1440,20 L1440,80 L0,80 Z",      // convexa (sube al centro)
  3: "M0,0 C480,0 1200,80 1440,80 L1440,80 L0,80 Z",       // inclinada izquierda→derecha
  4: "M0,80 C240,80 960,0 1440,0 L1440,80 L0,80 Z",        // inclinada derecha→izquierda
  5: "M0,40 C600,80 840,0 1440,40 L1440,80 L0,80 Z",       // suave asimétrica
};

function WaveDivider({ from, to, shape, flip = false }: { from: string; to: string; shape: 1 | 2 | 3 | 4 | 5; flip?: boolean }) {
  return (
    <div style={{ backgroundColor: from, lineHeight: 0, fontSize: 0 }}>
      <svg
        viewBox="0 0 1440 80"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="w-full block h-10 sm:h-14 lg:h-16"
        style={flip ? { transform: "scaleX(-1)" } : undefined}
        aria-hidden="true"
      >
        <path d={WAVE_PATHS[shape]} fill={to} />
      </svg>
    </div>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav
      style={{ backgroundColor: "rgba(45, 20, 100, 0.85)", backdropFilter: "blur(12px)" }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Image
          src="/logo-nav.webp"
          alt="Compaz"
          width={200}
          height={63}
          className="h-9 w-auto object-contain flex-shrink-0"
        />
        <a
          href="#formulario"
          style={{ backgroundColor: "#FF6B2B" }}
          className="inline-flex items-center text-white font-semibold text-sm px-4 sm:px-5 rounded-full hover:opacity-90 transition-opacity whitespace-nowrap min-h-[44px]"
        >
          Únete
        </a>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ onSelectRol }: { onSelectRol: (rol: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  function irAFormulario(rol: string) {
    onSelectRol(rol);
    document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="relative w-full h-screen overflow-hidden flex items-center justify-center">
      {/* Video de fondo */}
      <video
        ref={videoRef}
        src="/video-hero.mp4"
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        onEnded={() => {
          if (videoRef.current) {
            videoRef.current.pause();
          }
        }}
      />

      {/* Overlay oscuro */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(10,4,30,0.55) 0%, rgba(10,4,30,0.72) 100%)" }}
      />

      {/* Contenido */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
        {/* Texto */}
        <div className="flex-1 flex flex-col gap-5 text-center lg:text-left items-center lg:items-start">
          <h1
            className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight"
            style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
          >
            ¿Tu mamá se quedó sin compañía para ir al médico, al banco, al mercado?
          </h1>
          <p
            className="text-base md:text-lg leading-relaxed max-w-xl"
            style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-inter)" }}
          >
            Nuestro equipo va a donde tú no puedes ir. Un <strong className="text-white">Compita verificado por nosotros</strong> acompaña a tu familiar, y tú recibes fotos y notas de cada visita, directo a tu WhatsApp.
          </p>
        </div>

        {/* Botones */}
        <div className="flex flex-col items-stretch gap-3 shrink-0 w-full sm:w-80 lg:w-auto">
          <button
            onClick={() => irAFormulario("familia")}
            style={{ backgroundColor: "#FF6B2B", textDecoration: "none" }}
            className="inline-flex items-center justify-center text-white font-bold text-sm sm:text-lg px-6 sm:px-8 py-4 rounded-full hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            Quiero un Compita para mi familiar
          </button>
          <button
            onClick={() => irAFormulario("compa")}
            className="inline-flex items-center justify-center font-bold text-sm sm:text-lg px-6 sm:px-8 py-4 rounded-full hover:opacity-90 transition-opacity whitespace-nowrap"
            style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "white", border: "2px solid rgba(255,255,255,0.6)", textDecoration: "none" }}
          >
            Quiero trabajar como Compita
          </button>
        </div>
      </div>

      {/* Flecha hacia abajo */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center animate-bounce">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </section>
  );
}

// ─── Qué hace un Compa ────────────────────────────────────────────────────────

const actividades = [
  { Icon: ShoppingCart, label: "Supermercado" },
  { Icon: Building2,   label: "Banco" },
  { Icon: Stethoscope, label: "Acompañar al médico" },
  { Icon: Dumbbell,    label: "Ejercicio" },
  { Icon: Banknote,    label: "Cobrar pensión" },
  { Icon: Wrench,      label: "Cambiar un bombillo" },
  { Icon: Video,       label: "Videollamadas" },
  { Icon: MessageCircle, label: "Simplemente conversar" },
];

// ─── Sección de confianza ─────────────────────────────────────────────────────

const pilares = [
  {
    Icon: ShieldCheck,
    titulo: "Son nuestros, no de una app.",
    desc: "Verificación de cédula, antecedentes penales y entrevista personal. Los seleccionamos y respondemos por ellos.",
  },
  {
    Icon: Camera,
    titulo: "Sabes exactamente cómo estuvo.",
    desc: "Fotos y resumen directo a tu WhatsApp después de cada visita. No solo «todo bien»: te contamos lo que pasó de verdad.",
  },
  {
    Icon: MapPin,
    titulo: "Ves cada visita en tiempo real.",
    desc: "Sigue la ubicación de tu familiar durante la visita. Presente, aunque estés lejos.",
  },
];

function SeccionConfianza() {
  return (
    <section style={{ backgroundColor: "#2D1464" }} className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-center mb-16 text-white leading-tight"
          style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
        >
          Tu familiar no va a recibir a un extraño. Va a recibir a alguien de nuestro equipo.
        </h2>

        <div className="grid sm:grid-cols-3 gap-8">
          {pilares.map(({ Icon, titulo, desc }) => (
            <div key={titulo} className="flex flex-col items-center text-center gap-4">
              <Icon size={40} strokeWidth={1.6} style={{ color: "#FF6B2B" }} />
              <h3
                className="text-lg font-bold text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {titulo}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.70)", fontFamily: "var(--font-inter)" }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function QueHaceUnCompa() {
  return (
    <section style={{ backgroundColor: "#FDFAF6" }} className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {actividades.map(({ Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-3 rounded-2xl py-7 px-4"
              style={{ backgroundColor: "white", border: "1.5px solid #E8E0D4" }}
            >
              <Icon
                size={32}
                strokeWidth={1.6}
                style={{ color: "#FF6B2B" }}
              />
              <span
                className="text-sm font-semibold text-center leading-snug"
                style={{ color: "#2D1464", fontFamily: "var(--font-inter)" }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Card especial médica */}
        <div
          className="mt-4 sm:mt-6 rounded-2xl px-8 py-7 flex flex-col sm:flex-row items-center gap-5"
          style={{ backgroundColor: "#2D1464" }}
        >
          <Stethoscope size={40} strokeWidth={1.6} className="shrink-0" style={{ color: "#FF6B2B" }} />
          <div className="flex-1 text-center sm:text-left">
            <p
              className="font-extrabold text-lg leading-snug mb-1 text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              ¿Tu familiar necesita atención médica especializada?
            </p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "white", fontFamily: "var(--font-inter)" }}
            >
              Contamos con Compitas con perfil de enfermería certificado. Cuéntanos tu caso.
            </p>
          </div>
          <a
            href="mailto:hola@micompaz.com?subject=Necesito%20un%20Compita%20con%20perfil%20médico"
            className="shrink-0 font-bold text-sm px-6 py-3 rounded-full hover:opacity-90 transition-opacity whitespace-nowrap"
            style={{ backgroundColor: "white", color: "#FF6B2B", fontFamily: "var(--font-display)" }}
          >
            Escríbenos →
          </a>
        </div>

      </div>
    </section>
  );
}

// ─── Cómo funciona ────────────────────────────────────────────────────────────

const pasos = [
  {
    num: "01",
    titulo: "Tú eliges la frecuencia",
    desc: "Dinos con qué frecuencia necesitas visitas: semanal, quincenal o mensual.",
  },
  {
    num: "02",
    titulo: "Nosotros elegimos a tu Compita.",
    desc: "Nuestro equipo selecciona al Compita más adecuado según la zona y las necesidades de tu familiar. Tú nos das el contexto; nosotros hacemos la selección.",
  },
  {
    num: "03",
    titulo: "Recibes el reporte",
    desc: "Después de cada visita, recibes fotos y notas directo a tu WhatsApp.",
  },
];

function ComoFunciona() {
  return (
    <section style={{ backgroundColor: "#2D1464" }} className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-center mb-16 text-white leading-tight"
          style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
        >
          Simple para ti. Significativo para ellos.
        </h2>

        <div className="grid sm:grid-cols-3 gap-8">
          {pasos.map(({ num, titulo, desc }) => (
            <div key={num} className="flex flex-col items-center text-center gap-4">
              <span
                className="text-5xl font-extrabold leading-none"
                style={{ color: "#FF6B2B", fontFamily: "var(--font-display)" }}
              >
                {num}
              </span>
              <h3
                className="text-lg font-bold text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {titulo}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.70)", fontFamily: "var(--font-inter)" }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const faqs = [
  {
    q: "¿Cómo sé que el Compita es confiable?",
    a: "Antes de su primera visita, cada Compita pasa por tres filtros: verificación de identidad con cédula, revisión de antecedentes penales, y una entrevista personal con nuestro equipo. No trabajamos con personas que no conocemos. Si en algún momento no te sientes cómodo con tu Compita asignado, lo cambiamos sin costo ni pregunta.",
  },
  {
    q: "¿El Compita trabaja por su cuenta o trabaja con ustedes?",
    a: "Con nosotros. No somos una aplicación que conecta a desconocidos — somos un equipo. Cada Compita fue seleccionado, entrenado y es supervisado por Compaz. Si algo sale mal, nosotros respondemos.",
  },
  {
    q: "¿Qué pasa si algo sale mal durante una visita?",
    a: "Tienes nuestro contacto directo en todo momento. Si ocurre cualquier situación durante una visita — un accidente, un problema de salud, lo que sea — tu Compita nos notifica de inmediato y nosotros te contactamos. No eres un ticket de soporte: somos personas reales al otro lado.",
  },
  {
    q: "¿Mi familiar tiene que dejar entrar al Compita solo?",
    a: "No necesariamente. Las primeras visitas pueden hacerse con un familiar o vecino de confianza presente, hasta que tu familiar se sienta cómodo. Nosotros acompañamos ese proceso. La confianza se construye, no se exige.",
  },
  {
    q: "¿Puedo hablar con ustedes antes de inscribirme?",
    a: "Sí, y lo recomendamos. Escríbenos a hola@micompaz.com y cuéntanos la situación de tu familiar. Te respondemos personalmente.",
  },
  {
    q: "¿El cuidado a domicilio está regulado en Venezuela?",
    a: "Sí. La Ley Orgánica para la Atención y Desarrollo Integral de las Personas Adultas Mayores (Gaceta Oficial N° 6.641, 2021) reconoce el derecho de todo adulto mayor a recibir atención digna, incluyendo atención domiciliaria. Compaz opera dentro de ese marco: los Compitas son acompañantes verificados que respetan la autonomía y dignidad de la persona que visitan.",
  },
  {
    q: "¿En qué ciudades de Venezuela operan?",
    a: "Estamos comenzando en Caracas. Si tu familiar está en otra ciudad, inscríbete igualmente — estamos expandiendo y queremos saber dónde hay más necesidad.",
  },
];

function FAQ() {
  const [abierto, setAbierto] = useState<number | null>(null);

  return (
    <section style={{ backgroundColor: "#2D1464" }} className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-center mb-4 leading-tight text-white"
          style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
        >
          ¿Tienes dudas? Es normal.
        </h2>
        <p
          className="text-center text-base leading-relaxed mb-14 max-w-2xl mx-auto"
          style={{ color: "rgba(255,255,255,0.70)", fontFamily: "var(--font-inter)" }}
        >
          Mandar a alguien a casa de tu familiar es una decisión seria. Acá respondemos lo que más nos preguntan.
        </p>

        <div className="flex flex-col gap-3">
          {faqs.map(({ q, a }, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: "white", border: "1.5px solid #E8E0D4" }}
            >
              <button
                onClick={() => setAbierto(abierto === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 text-left px-6 py-5"
                aria-expanded={abierto === i}
              >
                <span
                  className="font-bold text-base leading-snug"
                  style={{ color: "#1A0A3C", fontFamily: "var(--font-display)" }}
                >
                  {q}
                </span>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="#FF6B2B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 transition-transform duration-200"
                  style={{ transform: abierto === i ? "rotate(180deg)" : "rotate(0deg)" }}
                  aria-hidden="true"
                >
                  <path d="M5 8l5 5 5-5" />
                </svg>
              </button>
              {abierto === i && (
                <p
                  className="px-6 pb-5 text-sm leading-relaxed"
                  style={{ color: "#6B5C90", fontFamily: "var(--font-inter)" }}
                >
                  {a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Equipo ───────────────────────────────────────────────────────────────────

const equipo = [
  {
    nombre: "Juan Tenreiro",
    rol: "Founder",
    foto: "/images/juan-tenreiro.jpg",
    bio: "Juan fundó Compaz después de vivir en carne propia la distancia entre cuidar a la familia y estar lejos de Venezuela. Antes de Compaz, trabajó en construir productos y operaciones en etapas tempranas, con foco en resolver problemas reales de comunidades latinoamericanas. Cree que la tecnología puede devolverle presencia a quienes la distancia les quitó.",
  },
  {
    nombre: "Luis Mendoza",
    rol: "Co-Founder",
    foto: "/images/luis-mendoza.jpg",
    bio: "Luis se sumó a Compaz para construir la capa operativa y de confianza que el modelo necesita: verificación, calidad de servicio, y relación con las familias. Su experiencia en operaciones y logística lo llevó a ver de cerca cómo la distancia afecta a las familias migrantes, y decidió que quería ser parte de la solución.",
  },
];

function Equipo() {
  return (
    <section style={{ backgroundColor: "#FDFAF6" }} className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-center mb-14 leading-tight"
          style={{ color: "#2D1464", fontFamily: "var(--font-display)", textWrap: "balance" }}
        >
          El equipo detrás de Compaz
        </h2>

        <p
          className="text-center text-base leading-relaxed mb-12 max-w-2xl mx-auto"
          style={{ color: "#6B5C90", fontFamily: "var(--font-inter)" }}
        >
          Compaz lo fundamos venezolanos que vivimos la misma distancia que tú. Conocemos esa angustia de no saber cómo está tu mamá. Por eso construimos esto: no como un negocio genérico de cuidado, sino como algo que necesitábamos y no existía.
        </p>

        <div className="flex flex-col lg:flex-row gap-8 items-center">
          {/* Bios */}
          <div className="flex flex-col gap-6 flex-1 w-full">
            {equipo.map((p) => (
              <div
                key={p.nombre}
                className="flex flex-col sm:flex-row gap-5 items-start rounded-2xl p-6 sm:p-7"
                style={{ backgroundColor: "white", border: "1.5px solid #E8E0D4" }}
              >
                <Image
                  src={p.foto}
                  alt={p.nombre}
                  width={80}
                  height={80}
                  className="rounded-full object-cover shrink-0"
                  style={{ width: 80, height: 80 }}
                />
                <div>
                  <p
                    className="font-extrabold text-lg mb-0.5"
                    style={{ color: "#2D1464", fontFamily: "var(--font-display)" }}
                  >
                    {p.nombre}
                  </p>
                  <p
                    className="text-sm font-semibold mb-3"
                    style={{ color: "#FF6B2B", fontFamily: "var(--font-display)" }}
                  >
                    {p.rol}
                  </p>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "#6B5C90", fontFamily: "var(--font-inter)" }}
                  >
                    {p.bio}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Video */}
          <div className="shrink-0 mx-auto lg:mx-0" style={{ width: "min(280px, 100%)", maxWidth: 320 }}>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ aspectRatio: "9/16", border: "1.5px solid #E8E0D4" }}
            >
              <iframe
                src="https://www.youtube.com/embed/QPCwjzuUzjU"
                width="100%"
                height="100%"
                style={{ display: "block" }}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Formulario ───────────────────────────────────────────────────────────────

function Formulario({ rolInicial }: { rolInicial: string }) {
  const [form, setForm] = useState({
    nombre: "",
    whatsapp: "",
    email: "",
    ciudad: "",
    rol: rolInicial,
    website: "",
  });

  // Sincronizar cuando rolInicial cambia desde el hero
  const prevRolInicial = useRef(rolInicial);
  if (prevRolInicial.current !== rolInicial) {
    prevRolInicial.current = rolInicial;
    setForm((f) => ({ ...f, rol: rolInicial }));
  }
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    const turnstileToken =
      (e.currentTarget.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement | null)
        ?.value ?? "";
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          contacto: `WA: ${form.whatsapp} | Email: ${form.email} | Rol: ${form.rol}`,
          whatsapp: form.whatsapp,
          email: form.email,
          ciudad: form.ciudad,
          website: form.website,
          turnstileToken,
        }),
      });
      if (!res.ok) throw new Error("Error");
      setStatus("ok");
      setForm({ nombre: "", whatsapp: "", email: "", ciudad: "", rol: "", website: "" });
      // Meta Pixel: evento de conversión (no solo PageView)
      (window as typeof window & { fbq?: (...args: unknown[]) => void }).fbq?.(
        "track",
        "Lead"
      );
    } catch {
      setStatus("error");
    }
  }

  return (
    <section
      id="formulario"
      style={{ backgroundColor: "#FFD23F" }}
      className="py-24 px-6"
    >
      <div className="max-w-xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl font-extrabold text-center mb-4 leading-tight"
          style={{ color: "#1A0A3C", fontFamily: "var(--font-display)", textWrap: "balance" }}
        >
          Pronto iniciaremos en Venezuela. Solo 10 familias en el piloto.
        </h2>
        <p
          className="text-center text-base font-medium mb-6"
          style={{ color: "#2D1464", fontFamily: "var(--font-inter)" }}
        >
          Solo trabajamos con 10 familias en esta primera etapa. Queremos conocer cada caso personalmente.
        </p>
        <p
          className="text-center text-lg font-semibold mb-2"
          style={{ color: "#2D1464", fontFamily: "var(--font-display)" }}
        >
          El primer mes es nuestro regalo.
        </p>
        <p className="text-center mb-10 mt-6">
          <span style={{ display: "block", textDecoration: "underline", fontSize: "1.6rem", fontFamily: "var(--font-display)", fontWeight: 800, color: "#1A0A3C" }}>Preinscripciones</span>
          <span style={{ display: "block", textDecoration: "underline", fontSize: "1.6rem", fontFamily: "var(--font-display)", fontWeight: 800, color: "#1A0A3C" }}>hasta el 20 de agosto.</span>
        </p>

        {status === "ok" ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: "white" }}
          >
            <p
              className="text-xl font-extrabold mb-2"
              style={{ color: "#2D1464", fontFamily: "var(--font-display)" }}
            >
              ¡Ya estás en la lista!
            </p>
            <p
              className="text-sm"
              style={{ color: "#6B5C90", fontFamily: "var(--font-inter)" }}
            >
              Te escribimos antes del lanzamiento con todos los detalles.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Honeypot */}
            <input
              type="text"
              name="website"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              tabIndex={-1}
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }}
            />

            <input
              type="text"
              required
              placeholder="Tu nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full rounded-xl px-5 py-4 text-base outline-none"
              style={{ backgroundColor: "white", color: "#1A0A3C", fontFamily: "var(--font-inter)" }}
            />
            <input
              type="tel"
              required
              placeholder="Tu WhatsApp (con código de país)"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              className="w-full rounded-xl px-5 py-4 text-base outline-none"
              style={{ backgroundColor: "white", color: "#1A0A3C", fontFamily: "var(--font-inter)" }}
            />
            <input
              type="email"
              required
              placeholder="Tu email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl px-5 py-4 text-base outline-none"
              style={{ backgroundColor: "white", color: "#1A0A3C", fontFamily: "var(--font-inter)" }}
            />
            <input
              type="text"
              required
              placeholder="Ciudad donde vive tu familiar en Venezuela"
              value={form.ciudad}
              onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
              className="w-full rounded-xl px-5 py-4 text-base outline-none"
              style={{ backgroundColor: "white", color: "#1A0A3C", fontFamily: "var(--font-inter)" }}
            />

            {/* Selector de rol */}
            <div className="flex flex-col gap-2">
              <p
                className="text-sm font-semibold px-1"
                style={{ color: "#1A0A3C", fontFamily: "var(--font-inter)" }}
              >
                ¿Cómo quieres participar?
              </p>
              {[
                { value: "familia", label: "Quiero contratar el servicio para mi familiar" },
                { value: "compa", label: "Quiero ser Compita (trabajo en Venezuela)" },
              ].map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-3 rounded-xl px-5 py-4 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: form.rol === value ? "#2D1464" : "white",
                    color: form.rol === value ? "white" : "#1A0A3C",
                    fontFamily: "var(--font-inter)",
                    fontSize: "0.9rem",
                  }}
                >
                  <input
                    type="radio"
                    name="rol"
                    value={value}
                    required
                    checked={form.rol === value}
                    onChange={() => setForm({ ...form, rol: value })}
                    className="accent-current"
                    style={{ accentColor: form.rol === value ? "white" : "#2D1464" }}
                  />
                  {label}
                </label>
              ))}
            </div>

            {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
              <div
                className="cf-turnstile"
                data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                data-theme="light"
                data-language="es"
              />
            )}

            {status === "error" && (
              <p className="text-sm text-center font-medium" style={{ color: "#7f1d1d" }}>
                Algo salió mal. Intenta de nuevo.
              </p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full font-bold text-base py-4 rounded-full transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{
                backgroundColor: "#2D1464",
                color: "white",
                fontFamily: "var(--font-display)",
                textDecoration: "none",
              }}
            >
              {status === "loading" ? "Enviando…" : "Quiero ser parte del piloto"}
            </button>

            <p
              className="text-sm text-center mt-1 font-bold"
              style={{ color: "#4A3B6B", fontFamily: "var(--font-inter)" }}
            >
              Cada suscripción crea trabajo digno en Venezuela.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ backgroundColor: "#1A0A3C" }} className="py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Image
          src="/logo-mono.png"
          alt="Compaz"
          width={160}
          height={50}
          className="h-10 w-auto object-contain object-left"
        />
        <div className="flex items-center gap-6">
          <a
            href="https://instagram.com/elcompaz"
            className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-inter)" }}
          >
            @elcompaz
          </a>
          <a
            href="/privacidad"
            className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-inter)" }}
          >
            Privacidad
          </a>
        </div>
        <p
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-inter)" }}
        >
          © 2026 Compaz. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [rolSeleccionado, setRolSeleccionado] = useState("");

  return (
    <>
      <Nav />
      <main>
        <Hero onSelectRol={setRolSeleccionado} />
        <SeccionConfianza />
        <QueHaceUnCompa />
        <WaveDivider from="#FDFAF6" to="#2D1464" shape={2} />
        <ComoFunciona />
        <WaveDivider from="#2D1464" to="#FDFAF6" shape={3} />
        <Equipo />
        <WaveDivider from="#FDFAF6" to="#FFD23F" shape={1} flip />
        <Formulario rolInicial={rolSeleccionado} />
        <WaveDivider from="#FFD23F" to="#2D1464" shape={2} />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
