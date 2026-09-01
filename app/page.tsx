"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ShoppingCart,
  Building2,
  Stethoscope,
  UtensilsCrossed,
  Gift,
  Smile,
  Video,
  MessageCircle,
  ShieldCheck,
  Camera,
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

// ─── YouTube Facade ───────────────────────────────────────────────────────────

function YouTubeFacade({ videoId }: { videoId: string }) {
  const [playing, setPlaying] = useState(false);
  const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  if (playing) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: "9/16", border: "1.5px solid #E8E0D4" }}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          width="100%"
          height="100%"
          style={{ display: "block" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="relative rounded-2xl overflow-hidden w-full"
      style={{ aspectRatio: "9/16", border: "1.5px solid #E8E0D4", display: "block", padding: 0, cursor: "pointer" }}
      aria-label="Reproducir video"
    >
      <img src={thumb} alt="" aria-hidden="true" className="w-full h-full object-cover" />
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-center rounded-full" style={{ width: 56, height: 56, background: "rgba(255,255,255,0.95)" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#FF0000"><polygon points="5,3 19,12 5,21" /></svg>
        </div>
      </div>
    </button>
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
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(window.matchMedia("(min-width: 768px)").matches);
  }, []);

  function irAFormulario(rol: string) {
    onSelectRol(rol);
    document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="relative w-full h-screen overflow-hidden flex items-center justify-center">
      {/* Imagen de fondo siempre visible (último frame del video) */}
      <picture>
        <source srcSet="/images/hero-poster.webp" type="image/webp" />
        <img
          src="/images/hero-poster.jpg"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </picture>
      {/* Video solo en desktop — en móvil ahorra 9 MB */}
      {isDesktop && (
        <video
          ref={videoRef}
          src="/video-hero.mp4"
          autoPlay
          muted
          playsInline
          poster="/images/hero-poster.webp"
          className="absolute inset-0 w-full h-full object-cover"
          onEnded={() => {
            if (videoRef.current) videoRef.current.pause();
          }}
        />
      )}

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
            style={{ fontFamily: "var(--font-display), system-ui, sans-serif", textWrap: "balance" }}
          >
            Para que tu familiar no esté solo, aunque tú estés lejos.
          </h1>
          <p
            className="text-base md:text-lg leading-relaxed max-w-xl"
            style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-inter)" }}
          >
            Nuestro equipo va a donde tú no puedes ir. Un <strong className="text-white">Compita verificado por nosotros</strong> acompaña a tu familiar, y tú recibes fotos y notas directamente después de cada visita.
          </p>
        </div>

        {/* Botones */}
        <div className="flex flex-col items-stretch gap-3 shrink-0 w-full sm:w-80 lg:w-auto">
          <button
            onClick={() => irAFormulario("familia")}
            style={{ backgroundColor: "#FF6B2B", textDecoration: "none" }}
            className="inline-flex items-center justify-center text-center text-white font-bold text-sm sm:text-lg px-6 sm:px-8 py-4 rounded-full hover:opacity-90 transition-opacity"
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
  { Icon: ShoppingCart,    label: "Supermercado" },
  { Icon: Building2,       label: "Banco" },
  { Icon: Stethoscope,     label: "Acompañar al médico" },
  { Icon: UtensilsCrossed, label: "Salir a comer juntos" },
  { Icon: Gift,            label: "Llevar un regalo de tu parte" },
  { Icon: Smile,           label: "Celebrar su cumpleaños" },
  { Icon: Video,           label: "Videollamadas" },
  { Icon: MessageCircle,   label: "Simplemente conversar" },
];

// ─── Sección de confianza ─────────────────────────────────────────────────────

const pilares = [
  {
    Icon: ShieldCheck,
    titulo: "Son nuestros, no de una app.",
    desc: "Cada Compita pasa por un proceso de verificación riguroso. Antecedentes, identidad, redes sociales y entrevista personal con nuestro equipo.",
  },
  {
    Icon: Camera,
    titulo: "Sabes exactamente cómo estuvo.",
    desc: "Fotos y resumen directamente después de cada visita. No solo «todo bien»: te contamos lo que pasó de verdad.",
  },
  {
    Icon: MessageCircle,
    titulo: "Hay un equipo que responde.",
    desc: "Si algo no sale como esperabas, nos escribes directamente a nosotros. No a un bot, no a un formulario. Al equipo de Compaz.",
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
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-center mb-6 leading-tight"
          style={{ color: "#2D1464", fontFamily: "var(--font-display)", textWrap: "balance" }}
        >
          ¿Qué hace un Compita?
        </h2>
        <p
          className="text-center text-base leading-relaxed mb-14 max-w-2xl mx-auto"
          style={{ color: "#6B5C90", fontFamily: "var(--font-inter)" }}
        >
          Es como tener un amigo de confianza para tu familiar. Alguien que comparte tiempo con él, lo acompaña a donde necesite, y te cuenta cómo estuvo.
        </p>

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
    titulo: "Encuentra a tu Compita",
    desc: "Cuéntanos qué necesita tu familiar y te mostramos las mejores opciones disponibles en su zona. Tú eliges.",
  },
  {
    num: "03",
    titulo: "Recibes las actualizaciones",
    desc: "Después de cada visita, recibes fotos y notas directamente.",
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
    q: "¿Compaz es un servicio de enfermería, limpieza o cuidado asistencial?",
    a: "No. El Compita no es enfermero, ni asistente de higiene, ni servicio de limpieza del hogar. Es un acompañante: alguien que visita a tu familiar, comparte tiempo con él, lo lleva a donde necesite y te mantiene informado. Si tu familiar requiere atención médica o asistencia personal, Compaz no reemplaza eso. Puede ser un complemento, pero no un sustituto. Si tienes dudas sobre si Compaz es lo que necesitas, escríbenos y te orientamos.",
  },
  {
    q: "¿Cómo sé que el Compita es confiable?",
    a: "Antes de su primera visita, cada Compita pasa por tres filtros: verificación de identidad con cédula, revisión de antecedentes penales, y una entrevista personal con nuestro equipo. No trabajamos con personas que no conocemos. Si en algún momento no te sientes cómodo con tu Compita asignado, lo cambiamos sin costo.",
  },
  {
    q: "¿El Compita trabaja por su cuenta o trabaja con ustedes?",
    a: "Con nosotros. No somos una aplicación que conecta a desconocidos. Somos un equipo. Cada Compita fue seleccionado, entrenado y es supervisado por Compaz.",
  },
  {
    q: "¿Qué pasa si algo sale mal durante una visita?",
    a: "Tienes nuestro contacto directo durante cada visita. Si ocurre cualquier situación, activamos nuestro protocolo de seguimiento y te mantenemos informado en todo momento. No eres un ticket de soporte: somos personas reales al otro lado.",
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

          {/* Video — facade: carga iframe solo al hacer clic */}
          <div className="shrink-0 mx-auto lg:mx-0" style={{ width: "min(280px, 100%)", maxWidth: 320 }}>
            <YouTubeFacade videoId="FiPqYSDY5sM" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Formulario ───────────────────────────────────────────────────────────────

// Venezuela primero, luego todos los países del mundo ordenados alfabéticamente
const COUNTRY_CODES = [
  { code: "+58", label: "+58 🇻🇪 Venezuela", digits: 10 },
  { code: "+93", label: "+93 🇦🇫 Afganistán", digits: 9 },
  { code: "+355", label: "+355 🇦🇱 Albania", digits: 9 },
  { code: "+213", label: "+213 🇩🇿 Argelia", digits: 9 },
  { code: "+376", label: "+376 🇦🇩 Andorra", digits: 6 },
  { code: "+244", label: "+244 🇦🇴 Angola", digits: 9 },
  { code: "+54", label: "+54 🇦🇷 Argentina", digits: 10 },
  { code: "+374", label: "+374 🇦🇲 Armenia", digits: 8 },
  { code: "+61", label: "+61 🇦🇺 Australia", digits: 9 },
  { code: "+43", label: "+43 🇦🇹 Austria", digits: 10 },
  { code: "+994", label: "+994 🇦🇿 Azerbaiyán", digits: 9 },
  { code: "+1-242", label: "+1-242 🇧🇸 Bahamas", digits: 10 },
  { code: "+973", label: "+973 🇧🇭 Bahréin", digits: 8 },
  { code: "+880", label: "+880 🇧🇩 Bangladesh", digits: 10 },
  { code: "+375", label: "+375 🇧🇾 Bielorrusia", digits: 9 },
  { code: "+32", label: "+32 🇧🇪 Bélgica", digits: 9 },
  { code: "+501", label: "+501 🇧🇿 Belice", digits: 7 },
  { code: "+229", label: "+229 🇧🇯 Benín", digits: 8 },
  { code: "+975", label: "+975 🇧🇹 Bután", digits: 8 },
  { code: "+591", label: "+591 🇧🇴 Bolivia", digits: 8 },
  { code: "+387", label: "+387 🇧🇦 Bosnia y Herzegovina", digits: 8 },
  { code: "+267", label: "+267 🇧🇼 Botsuana", digits: 8 },
  { code: "+55", label: "+55 🇧🇷 Brasil", digits: 11 },
  { code: "+673", label: "+673 🇧🇳 Brunéi", digits: 7 },
  { code: "+359", label: "+359 🇧🇬 Bulgaria", digits: 9 },
  { code: "+226", label: "+226 🇧🇫 Burkina Faso", digits: 8 },
  { code: "+257", label: "+257 🇧🇮 Burundi", digits: 8 },
  { code: "+238", label: "+238 🇨🇻 Cabo Verde", digits: 7 },
  { code: "+855", label: "+855 🇰🇭 Camboya", digits: 9 },
  { code: "+237", label: "+237 🇨🇲 Camerún", digits: 9 },
  { code: "+1", label: "+1 🇨🇦 Canadá / EE.UU.", digits: 10 },
  { code: "+236", label: "+236 🇨🇫 Rep. Centroafricana", digits: 8 },
  { code: "+235", label: "+235 🇹🇩 Chad", digits: 8 },
  { code: "+56", label: "+56 🇨🇱 Chile", digits: 9 },
  { code: "+86", label: "+86 🇨🇳 China", digits: 11 },
  { code: "+357", label: "+357 🇨🇾 Chipre", digits: 8 },
  { code: "+57", label: "+57 🇨🇴 Colombia", digits: 10 },
  { code: "+269", label: "+269 🇰🇲 Comoras", digits: 7 },
  { code: "+242", label: "+242 🇨🇬 Congo", digits: 9 },
  { code: "+243", label: "+243 🇨🇩 Congo (RD)", digits: 9 },
  { code: "+506", label: "+506 🇨🇷 Costa Rica", digits: 8 },
  { code: "+385", label: "+385 🇭🇷 Croacia", digits: 9 },
  { code: "+53", label: "+53 🇨🇺 Cuba", digits: 8 },
  { code: "+420", label: "+420 🇨🇿 República Checa", digits: 9 },
  { code: "+45", label: "+45 🇩🇰 Dinamarca", digits: 8 },
  { code: "+253", label: "+253 🇩🇯 Yibuti", digits: 8 },
  { code: "+593", label: "+593 🇪🇨 Ecuador", digits: 9 },
  { code: "+20", label: "+20 🇪🇬 Egipto", digits: 10 },
  { code: "+503", label: "+503 🇸🇻 El Salvador", digits: 8 },
  { code: "+971", label: "+971 🇦🇪 Emiratos Árabes", digits: 9 },
  { code: "+291", label: "+291 🇪🇷 Eritrea", digits: 7 },
  { code: "+421", label: "+421 🇸🇰 Eslovaquia", digits: 9 },
  { code: "+386", label: "+386 🇸🇮 Eslovenia", digits: 8 },
  { code: "+34", label: "+34 🇪🇸 España", digits: 9 },
  { code: "+251", label: "+251 🇪🇹 Etiopía", digits: 9 },
  { code: "+63", label: "+63 🇵🇭 Filipinas", digits: 10 },
  { code: "+358", label: "+358 🇫🇮 Finlandia", digits: 9 },
  { code: "+33", label: "+33 🇫🇷 Francia", digits: 9 },
  { code: "+241", label: "+241 🇬🇦 Gabón", digits: 8 },
  { code: "+220", label: "+220 🇬🇲 Gambia", digits: 7 },
  { code: "+995", label: "+995 🇬🇪 Georgia", digits: 9 },
  { code: "+233", label: "+233 🇬🇭 Ghana", digits: 9 },
  { code: "+30", label: "+30 🇬🇷 Grecia", digits: 10 },
  { code: "+502", label: "+502 🇬🇹 Guatemala", digits: 8 },
  { code: "+224", label: "+224 🇬🇳 Guinea", digits: 9 },
  { code: "+240", label: "+240 🇬🇶 Guinea Ecuatorial", digits: 9 },
  { code: "+245", label: "+245 🇬🇼 Guinea-Bisáu", digits: 7 },
  { code: "+592", label: "+592 🇬🇾 Guyana", digits: 7 },
  { code: "+509", label: "+509 🇭🇹 Haití", digits: 8 },
  { code: "+504", label: "+504 🇭🇳 Honduras", digits: 8 },
  { code: "+36", label: "+36 🇭🇺 Hungría", digits: 9 },
  { code: "+91", label: "+91 🇮🇳 India", digits: 10 },
  { code: "+62", label: "+62 🇮🇩 Indonesia", digits: 10 },
  { code: "+964", label: "+964 🇮🇶 Irak", digits: 10 },
  { code: "+98", label: "+98 🇮🇷 Irán", digits: 10 },
  { code: "+353", label: "+353 🇮🇪 Irlanda", digits: 9 },
  { code: "+354", label: "+354 🇮🇸 Islandia", digits: 7 },
  { code: "+972", label: "+972 🇮🇱 Israel", digits: 9 },
  { code: "+39", label: "+39 🇮🇹 Italia", digits: 10 },
  { code: "+1-876", label: "+1-876 🇯🇲 Jamaica", digits: 10 },
  { code: "+81", label: "+81 🇯🇵 Japón", digits: 10 },
  { code: "+962", label: "+962 🇯🇴 Jordania", digits: 9 },
  { code: "+7", label: "+7 🇰🇿 Kazajistán", digits: 10 },
  { code: "+254", label: "+254 🇰🇪 Kenia", digits: 9 },
  { code: "+996", label: "+996 🇰🇬 Kirguistán", digits: 9 },
  { code: "+965", label: "+965 🇰🇼 Kuwait", digits: 8 },
  { code: "+856", label: "+856 🇱🇦 Laos", digits: 9 },
  { code: "+266", label: "+266 🇱🇸 Lesoto", digits: 8 },
  { code: "+371", label: "+371 🇱🇻 Letonia", digits: 8 },
  { code: "+961", label: "+961 🇱🇧 Líbano", digits: 8 },
  { code: "+231", label: "+231 🇱🇷 Liberia", digits: 7 },
  { code: "+218", label: "+218 🇱🇾 Libia", digits: 9 },
  { code: "+370", label: "+370 🇱🇹 Lituania", digits: 8 },
  { code: "+352", label: "+352 🇱🇺 Luxemburgo", digits: 9 },
  { code: "+261", label: "+261 🇲🇬 Madagascar", digits: 9 },
  { code: "+265", label: "+265 🇲🇼 Malaui", digits: 9 },
  { code: "+60", label: "+60 🇲🇾 Malasia", digits: 9 },
  { code: "+960", label: "+960 🇲🇻 Maldivas", digits: 7 },
  { code: "+223", label: "+223 🇲🇱 Mali", digits: 8 },
  { code: "+356", label: "+356 🇲🇹 Malta", digits: 8 },
  { code: "+212", label: "+212 🇲🇦 Marruecos", digits: 9 },
  { code: "+222", label: "+222 🇲🇷 Mauritania", digits: 8 },
  { code: "+230", label: "+230 🇲🇺 Mauricio", digits: 8 },
  { code: "+52", label: "+52 🇲🇽 México", digits: 10 },
  { code: "+373", label: "+373 🇲🇩 Moldavia", digits: 8 },
  { code: "+976", label: "+976 🇲🇳 Mongolia", digits: 8 },
  { code: "+382", label: "+382 🇲🇪 Montenegro", digits: 8 },
  { code: "+258", label: "+258 🇲🇿 Mozambique", digits: 9 },
  { code: "+264", label: "+264 🇳🇦 Namibia", digits: 9 },
  { code: "+977", label: "+977 🇳🇵 Nepal", digits: 10 },
  { code: "+505", label: "+505 🇳🇮 Nicaragua", digits: 8 },
  { code: "+227", label: "+227 🇳🇪 Níger", digits: 8 },
  { code: "+234", label: "+234 🇳🇬 Nigeria", digits: 10 },
  { code: "+47", label: "+47 🇳🇴 Noruega", digits: 8 },
  { code: "+64", label: "+64 🇳🇿 Nueva Zelanda", digits: 9 },
  { code: "+968", label: "+968 🇴🇲 Omán", digits: 8 },
  { code: "+31", label: "+31 🇳🇱 Países Bajos", digits: 9 },
  { code: "+92", label: "+92 🇵🇰 Pakistán", digits: 10 },
  { code: "+507", label: "+507 🇵🇦 Panamá", digits: 8 },
  { code: "+675", label: "+675 🇵🇬 Papúa Nueva Guinea", digits: 8 },
  { code: "+595", label: "+595 🇵🇾 Paraguay", digits: 9 },
  { code: "+51", label: "+51 🇵🇪 Perú", digits: 9 },
  { code: "+48", label: "+48 🇵🇱 Polonia", digits: 9 },
  { code: "+351", label: "+351 🇵🇹 Portugal", digits: 9 },
  { code: "+974", label: "+974 🇶🇦 Qatar", digits: 8 },
  { code: "+44", label: "+44 🇬🇧 Reino Unido", digits: 10 },
  { code: "+1-809", label: "+1-809 🇩🇴 Rep. Dominicana", digits: 10 },
  { code: "+40", label: "+40 🇷🇴 Rumania", digits: 9 },
  { code: "+7", label: "+7 🇷🇺 Rusia", digits: 10 },
  { code: "+250", label: "+250 🇷🇼 Ruanda", digits: 9 },
  { code: "+966", label: "+966 🇸🇦 Arabia Saudita", digits: 9 },
  { code: "+221", label: "+221 🇸🇳 Senegal", digits: 9 },
  { code: "+381", label: "+381 🇷🇸 Serbia", digits: 9 },
  { code: "+232", label: "+232 🇸🇱 Sierra Leona", digits: 8 },
  { code: "+65", label: "+65 🇸🇬 Singapur", digits: 8 },
  { code: "+252", label: "+252 🇸🇴 Somalia", digits: 8 },
  { code: "+94", label: "+94 🇱🇰 Sri Lanka", digits: 9 },
  { code: "+27", label: "+27 🇿🇦 Sudáfrica", digits: 9 },
  { code: "+249", label: "+249 🇸🇩 Sudán", digits: 9 },
  { code: "+46", label: "+46 🇸🇪 Suecia", digits: 9 },
  { code: "+41", label: "+41 🇨🇭 Suiza", digits: 9 },
  { code: "+597", label: "+597 🇸🇷 Surinam", digits: 7 },
  { code: "+66", label: "+66 🇹🇭 Tailandia", digits: 9 },
  { code: "+886", label: "+886 🇹🇼 Taiwán", digits: 9 },
  { code: "+255", label: "+255 🇹🇿 Tanzania", digits: 9 },
  { code: "+992", label: "+992 🇹🇯 Tayikistán", digits: 9 },
  { code: "+228", label: "+228 🇹🇬 Togo", digits: 8 },
  { code: "+1-868", label: "+1-868 🇹🇹 Trinidad y Tobago", digits: 10 },
  { code: "+216", label: "+216 🇹🇳 Túnez", digits: 8 },
  { code: "+993", label: "+993 🇹🇲 Turkmenistán", digits: 8 },
  { code: "+90", label: "+90 🇹🇷 Turquía", digits: 10 },
  { code: "+380", label: "+380 🇺🇦 Ucrania", digits: 9 },
  { code: "+256", label: "+256 🇺🇬 Uganda", digits: 9 },
  { code: "+598", label: "+598 🇺🇾 Uruguay", digits: 8 },
  { code: "+998", label: "+998 🇺🇿 Uzbekistán", digits: 9 },
  { code: "+678", label: "+678 🇻🇺 Vanuatu", digits: 7 },
  { code: "+84", label: "+84 🇻🇳 Vietnam", digits: 9 },
  { code: "+967", label: "+967 🇾🇪 Yemen", digits: 9 },
  { code: "+260", label: "+260 🇿🇲 Zambia", digits: 9 },
  { code: "+263", label: "+263 🇿🇼 Zimbabue", digits: 9 },
];

function Formulario({ rolInicial }: { rolInicial: string }) {
  const [form, setForm] = useState({
    nombre: "",
    countryCode: "+58",
    phone: "",
    email: "",
    ciudad: "",
    rol: rolInicial,
    website: "",
  });
  const [phoneError, setPhoneError] = useState("");

  // Sincronizar cuando rolInicial cambia desde el hero
  const prevRolInicial = useRef(rolInicial);
  if (prevRolInicial.current !== rolInicial) {
    prevRolInicial.current = rolInicial;
    setForm((f) => ({ ...f, rol: rolInicial }));
  }
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Validar longitud del número
    const country = COUNTRY_CODES.find((c) => c.code === form.countryCode);
    const digits = form.phone.replace(/\D/g, "").length;
    if (country && digits < country.digits) {
      setPhoneError(`El número debe tener ${country.digits} dígitos para ${form.countryCode}.`);
      return;
    }
    setPhoneError("");
    setStatus("loading");
    const whatsapp = `${form.countryCode}${form.phone.replace(/\D/g, "")}`;
    const turnstileToken =
      (e.currentTarget.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement | null)
        ?.value ?? "";
    const params = new URLSearchParams(window.location.search);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          contacto: `WA: ${whatsapp} | Email: ${form.email} | Rol: ${form.rol}`,
          whatsapp,
          email: form.email,
          ciudad: form.ciudad,
          website: form.website,
          turnstileToken,
          utmSource: params.get("utm_source") ?? "",
          utmMedium: params.get("utm_medium") ?? "",
          utmCampaign: params.get("utm_campaign") ?? "",
        }),
      });
      if (!res.ok) throw new Error("Error");
      setStatus("ok");
      setForm({ nombre: "", countryCode: "+58", phone: "", email: "", ciudad: "", rol: "", website: "" });
      (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag?.("event", "form_submit", { event_category: "waitlist" });
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
          Queremos conocer cada caso personalmente.
        </p>
        <p
          className="text-center text-lg font-semibold mb-2"
          style={{ color: "#2D1464", fontFamily: "var(--font-display)" }}
        >
          La primera hora del mes es nuestro regalo.
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
              className="w-full rounded-xl px-5 py-4 text-base outline-none focus:ring-2 focus:ring-[#2D1464]"
              style={{ backgroundColor: "white", color: "#1A0A3C", fontFamily: "var(--font-inter)" }}
            />
            <div className="flex gap-2">
              <select
                value={form.countryCode}
                onChange={(e) => { setForm({ ...form, countryCode: e.target.value }); setPhoneError(""); }}
                className="rounded-xl px-3 py-4 text-sm outline-none focus:ring-2 focus:ring-[#2D1464] flex-shrink-0"
                style={{ backgroundColor: "white", color: "#1A0A3C", fontFamily: "var(--font-inter)", width: "180px" }}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <input
                type="tel"
                required
                placeholder="Número de WhatsApp"
                value={form.phone}
                onChange={(e) => { setForm({ ...form, phone: e.target.value.replace(/[^\d\s\-]/g, "") }); setPhoneError(""); }}
                className="flex-1 rounded-xl px-5 py-4 text-base outline-none focus:ring-2 focus:ring-[#2D1464]"
                style={{ backgroundColor: "white", color: "#1A0A3C", fontFamily: "var(--font-inter)" }}
              />
            </div>
            {phoneError && (
              <p className="text-sm font-medium -mt-2 px-1" style={{ color: "#7f1d1d" }}>{phoneError}</p>
            )}
            <input
              type="email"
              required
              placeholder="Tu email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl px-5 py-4 text-base outline-none focus:ring-2 focus:ring-[#2D1464]"
              style={{ backgroundColor: "white", color: "#1A0A3C", fontFamily: "var(--font-inter)" }}
            />
            <input
              type="text"
              required
              placeholder="Ciudad donde vive tu familiar en Venezuela"
              value={form.ciudad}
              onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
              className="w-full rounded-xl px-5 py-4 text-base outline-none focus:ring-2 focus:ring-[#2D1464]"
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
                    className="accent-current w-5 h-5 flex-shrink-0 cursor-pointer"
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
        <WaveDivider from="#FDFAF6" to="#2D1464" shape={1} flip />
        <FAQ />
        <WaveDivider from="#2D1464" to="#FFD23F" shape={2} />
        <Formulario rolInicial={rolSeleccionado} />
        <WaveDivider from="#FFD23F" to="#1A0A3C" shape={3} />
      </main>
      <Footer />
    </>
  );
}
