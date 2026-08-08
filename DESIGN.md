---
name: Compaz
description: Cuidado y compañía para tu familiar en Venezuela — landing page design system
colors:
  purple-deep: "#2D1464"
  purple-darker: "#1A0A3C"
  purple-light: "#3D2080"
  orange: "#FF6B2B"
  orange-dark: "#E05520"
  yellow: "#FFD23F"
  warm-white: "#FDFAF6"
  warm-gray: "#F5F0E8"
  ink-primary: "#1A0A3C"
  ink-mid: "#4A3B6B"
  ink-muted: "#6B5C90"
  border-subtle: "#E8E0D4"
typography:
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 7vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.15
  title:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "12px"
  md: "16px"
  lg: "24px"
  pill: "9999px"
spacing:
  xs: "12px"
  sm: "16px"
  md: "24px"
  lg: "40px"
  xl: "64px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.orange}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "16px 32px"
  button-primary-hover:
    backgroundColor: "{colors.orange-dark}"
    textColor: "#ffffff"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "16px 32px"
  button-ghost-hover:
    backgroundColor: "rgba(255,255,255,0.10)"
    textColor: "#ffffff"
  button-secondary:
    backgroundColor: "{colors.purple-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "12px 16px"
  chip-service:
    backgroundColor: "{colors.warm-gray}"
    textColor: "{colors.purple-deep}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  card-compa:
    backgroundColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "20px"
  card-dark:
    backgroundColor: "{colors.purple-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "24px"
---

# Design System: Compaz

## 1. Overview

**Creative North Star: "El Vecino de Confianza"**

Compaz is the visual equivalent of a trusted neighbor: someone you let into your home without hesitation, who knows your family's name, and calls after the visit to say everything is fine. Every design decision — color, scale, spacing, copy — should feel that personal. Not a healthcare platform, not a startup, not an NGO. A service that people in your community built because they felt the same gap you feel.

The palette commits to deep purple and vivid orange: colors that are warm without being medical, bold without being aggressive. They don't read as "fintech" or "insurance" — they read as belonging to a specific community with a specific story. The typography is heavy and direct; display headings in extrabold at large scale communicate urgency and confidence without shouting. Body copy uses Inter for its neutrality and legibility, letting the words do the work without the font adding noise.

Motion and imagery carry more weight than decorative detail. The page has real photographs of real people in Venezuelan neighborhoods. Floating card overlays — "Última visita: Tu mamá está muy bien" — make the abstract product promise concrete. The wavy underline on "Presente" is the one playful signature: a yellow animated wave that says this service is alive, not corporate.

**Key Characteristics:**
- Deep purple and orange as committed brand colors, not accent-only
- Extrabold headings at large scale; restrained body weight
- Real photography over illustration or stock-generic imagery
- Warm-white sections as breathing rooms between full-bleed color blocks
- Wave dividers as structural rhythm (use sparingly: 3 maximum per page)
- WhatsApp as the product's interface analogue — informal, direct, trusted

## 2. Colors: The Venezuelan Palette

Three saturated anchor colors (purple, orange, yellow) against a near-white ground. Each color section carries its own meaning and is used at full-bleed scale, not just as accent. The palette earns the "Full palette" strategy.

### Primary
- **Compaz Purple** (`#2D1464`): The brand's main voice. Hero backgrounds, nav, section backgrounds, accordion-active states, dark card surfaces. Deep, authoritative, warm — not corporate navy, not startup indigo. Used at full bleed.
- **Compaz Purple Darker** (`#1A0A3C`): Footer background. Slightly deeper than the main purple; provides contrast differentiation in the dark zone without introducing a new hue.

### Secondary
- **Compaz Orange** (`#FF6B2B`): Action and warmth. Primary CTA button, problem-section full-bleed background, accordion-active highlight, Compa rating stars, chip/card CTAs, inline emphasis. The color the eye goes to first.
- **Orange Dark** (`#E05520`): Orange hover state. Not used as a surface color; only for button hover treatment.

### Tertiary
- **Compaz Yellow** (`#FFD23F`): Attention and energy. Section label eyebrows (used once in hero, once in ComoFunciona — see Named Rules), waitlist section background, wavy underline signature, pricing accent, investor footer link. Never used as a background at full scale except the waitlist section.

### Neutral
- **Ink Primary** (`#1A0A3C`): Main text color on light backgrounds. Same hue as the darkest purple — the neutral IS the brand color, just darkened.
- **Ink Mid** (`#4A3B6B`): Secondary body text, subheadings, descriptive copy on light backgrounds. Passes WCAG AA on warm-white (~9.4:1 contrast).
- **Ink Muted** (`#8B7BAA`): **Use with caution.** Small metadata only (zone labels, visit counts, attribution). Contrast on white is ~3.8:1 — falls below WCAG AA. Restrict to text ≥18px regular or ≥14px bold, or dark-section contexts where the background provides sufficient contrast. Never use for body paragraphs.
- **Warm White** (`#FDFAF6`): Primary page background. Near-white with the faintest warm cast toward the brand hue. Breathing room between full-bleed sections.
- **Warm Gray** (`#F5F0E8`): Surface for service chips, pricing white-card sections. Slightly deeper than warm-white; used to create low-contrast containment without color.
- **Border Subtle** (`#E8E0D4`): Card borders, dividers. Always 1–2px; never used as a decorative stripe.

### Named Rules
**The Commitment Rule.** When a section uses a brand color as its background, it uses it at full bleed — no partial panels, no color only on one side. Color is a section's identity, not its decoration.

**The Muted Text Constraint.** `ink-muted` (#8B7BAA) fails WCAG AA on light backgrounds at body sizes. Use it only for metadata text that is 18px or larger, or on dark (`purple-deep`) backgrounds where it reads clearly. Never apply it to paragraphs, form labels, or primary content.

## 3. Typography

**Display/Heading Font:** Bricolage Grotesque (weights 700, 800)
**Body Font:** Inter (weights 400, 500, 600)

**Character:** A heavy geometric sans at large scale paired with a neutral humanist sans at body scale. The pairing works on a weight axis — the contrast is between extrabold display (urgent, bold, communal) and regular body (clear, warm, accessible). No serif is involved; this is not an editorial brand. It is a community service.

### Hierarchy
- **Display** (800 weight, `clamp(2.5rem, 7vw, 4.5rem)`, line-height 1.05): Hero headlines and the single most important claim per section. Letter-spacing -0.01em. Apply `text-wrap: balance`.
- **Headline** (800 weight, `clamp(1.75rem, 4vw, 3rem)`, line-height 1.15): Section headings (Problema, Solución, ComoFunciona CTAs). `text-wrap: balance`.
- **Title** (700 weight, 1.125rem / 18px, line-height 1.3): Card headings, accordion items, Compa names, pricing plan names. Bricolage Grotesque.
- **Body** (400 weight, 1rem / 16px, line-height 1.7): All descriptive copy. Inter. Max line length 65–75ch. `text-wrap: pretty` on long prose.
- **Label** (700 weight, 0.75rem / 12px, tracking +0.08em, uppercase): Section kickers and metadata. Used sparingly — at most two per page (see Named Rules below).

### Named Rules
**The Extrabold Rule.** Headings use weight 800, not 700 or 600. The brand's emotional register requires decisiveness; lighter headings read as tentative.

**The Kicker Constraint.** Small uppercase tracked labels (label style) are used for section identification only when the heading alone is genuinely ambiguous — at most twice per page. Applying them to every section header is the AI scaffolding tell this brand explicitly rejects.

## 4. Elevation

Compaz is flat by default. Sections sit next to each other without shadows between them; the wave dividers and full-bleed color transitions carry the spatial rhythm. Shadows appear only on floating overlay elements that communicate spatial closeness — the "Última visita" card, the "Reporte enviado" notification — and serve as the product's proof-of-concept: something arrived from nearby.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 32px rgba(26, 10, 60, 0.25)`): Used on floating overlay cards embedded over hero/section images. Communicates that the card "arrived" — it hovers above the surface. Not a decoration; it's part of the product metaphor.
- **Card lift** (`box-shadow: 0 2px 8px rgba(26, 10, 60, 0.08)`): Subtle depth on white pricing cards and Compa profile cards. Optional; can be replaced by the border-subtle border.

### Named Rules
**The Flat-By-Default Rule.** No shadows on nav, sections, buttons, form inputs, or containers at rest. Shadows mean arrival — reserve them for elements that simulate something landing in your space.

## 5. Components

### Buttons
Rounded pill shapes (9999px radius) throughout. Never square, never lightly rounded. The pill shape carries the brand's warmth and approachability.

- **Primary** (Orange fill): Background `#FF6B2B`, text white, padding `16px 32px`, pill radius. Hover: `opacity: 0.9` — do not change the color on hover, only the opacity. Shadow: `0 8px 24px rgba(224, 85, 32, 0.30)` on hero placement only.
- **Ghost** (White border on dark): `border: 2px solid rgba(255,255,255,0.3)`, text white, transparent background. Hover: `background: rgba(255,255,255,0.10)`. Used only on dark-purple or orange section backgrounds.
- **Secondary** (Purple fill on light): Background `#2D1464`, text white, pill radius. Used inside light sections (pricing cards, Compas section). Hover: `opacity: 0.80`.

### Chips (Service tags)
- **Style:** Background `#F5F0E8` (warm-gray), text `#2D1464` (purple-deep), border-radius 12px, padding `12px 16px`.
- **Content:** Label only — no icons. If a distinguishing visual is needed, use a checkmark prefix or structured list instead of icon-per-chip.
- No interactive state (read-only display component).

### Cards / Containers
- **Compa profile card:** White background, `border: 2px solid #E8E0D4`, radius 16px. Internal padding 20px. Image area: `height: 200px`, `object-fit: cover`, full card width. Floating "Verificado" badge: white bg, purple text, pill radius, orange checkmark.
- **Dark card (overlay):** `#2D1464` or `#FF6B2B` background, white text, radius 16px, padding 20px. Float shadow. Used for "Última visita" and "Reporte enviado" overlays. Max width: 240px.
- **Light container (forms, team):** `#F5F0E8` background, no border, radius 16px, padding 24–32px.
- **No nested cards.** Cards may not contain other cards.

### Inputs / Fields
- **Style:** White background, `border: 2px solid rgba(45,20,100,0.2)`, radius 12px, padding `16px 20px`, font-size 1rem.
- **Focus:** `outline: 2px solid #2D1464`, `outline-offset: 2px`. No box-shadow on focus — outline only.
- **Error:** No design currently; add inline error text in `#2D1464` at 0.875rem below the field.
- **Placeholder:** Use `sr-only` labels + visible placeholder text. Placeholder must have sufficient contrast — white background guarantees this for dark placeholder text.

### Navigation
- **Style:** `#2D1464` background, fixed, full-width, `z-index: 50`.
- **Logo:** Left-aligned, height 36px.
- **Nav links:** White at 75% opacity, 14px medium weight. Hover: white at 100%.
- **Primary CTA (Únete):** Orange pill button, 44px height minimum. Always visible; never hidden on mobile.
- **WhatsApp:** Icon + text on desktop; icon-only on mobile. `aria-label` required.

### Accordion (ComoFunciona)
- **At rest:** Semi-transparent white (`rgba(255,255,255,0.07)`) on dark-purple background. Step number in yellow, title in white, `+` icon at 50% opacity.
- **Active:** Orange fill background. Step number and `+` icon (rotated 45°) in white. Body text in white, padding-bottom 20px.
- **Transition:** Background color 200ms ease, max-height 300ms ease. Known issue: `max-height` animation triggers layout reflow. Candidate for migration to `grid-template-rows: 0fr / 1fr`.

### Wave Dividers (Signature element)
Five SVG paths (shapes 1–5) used to transition between section backgrounds. Each is a slightly different curve. Use at most 3 per page — at the most significant color transitions. The current 7-divider implementation is excessive; reduce to the 3 most meaningful transitions (hero-to-problem, problem-to-solution, dark CTA-to-footer).

## 6. Do's and Don'ts

### Do:
- **Do** use orange for the primary CTA in every context. One CTA color, everywhere. Visitors pattern-match the action color quickly; changing it per-section breaks that.
- **Do** commit full-bleed when using a brand color for a section background. Half-color panels (color only on the left, neutral on the right at page level) break the Commitment Rule.
- **Do** show real names, real neighborhoods, real visit counts. "Ana R., Chacao, Caracas, 34 visitas" beats "Our trusted caregiver" every time.
- **Do** use `text-wrap: balance` on all h1–h3 elements.
- **Do** keep wave dividers to 3 maximum per page. Place them only at the three most meaningful color transitions.
- **Do** enforce WCAG AA contrast minimums on all body and UI text. Fix `ink-muted` (#8B7BAA) usage on light backgrounds — it fails at body sizes.
- **Do** label every icon-only interactive element with `aria-label`.

### Don't:
- **Don't** use gradient text (`background-clip: text` with a gradient). Orange headings use `color: #FF6B2B` flat — not a gradient.
- **Don't** make Compaz look or feel medical, clinical, or institutional (no cool blues, no hospital whites, no insurance-form layouts). This is the primary anti-reference.
- **Don't** drift into generic SaaS startup aesthetic: purple gradient cards, metric-dashboard layouts, "scale your business" language, or glassmorphism.
- **Don't** frame the service as charity or humanitarian aid. The families are not charity cases; the service is a product. Never use poverty imagery or pity-driven copy.
- **Don't** use remittance-app transactional language or visual grammar. Money is not the relationship; presence is.
- **Don't** place `ink-muted` (#8B7BAA) on paragraph text over light backgrounds. It fails WCAG AA (~3.8:1 on warm-white). Restrict to large metadata text only.
- **Don't** add eyebrow labels (small uppercase tracked text above a heading) to more than two sections per page. Applying them to every section is AI scaffolding grammar, not brand voice.
- **Don't** use the hero-metric template (giant number + label + supporting stats) as a design pattern. The 7.7M stat earns its place in context; the visual treatment of a raw stat-widget does not.
- **Don't** use identical card grids (same-sized cards with the same structure repeated 4+ times) without variation. The Compas grid is the one allowed instance; do not replicate the pattern elsewhere.
- **Don't** use Bricolage Grotesque as a body font. Inter only for body copy. Bricolage Grotesque is display/heading only.
