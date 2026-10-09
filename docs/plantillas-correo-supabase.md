# Plantillas de correo de Supabase (acceso desde cualquier dispositivo)

Vigencia de los enlaces: Authentication, Sign In / Providers, Email, **Email OTP Expiration = 3600** segundos (1 hora, el valor por defecto). Si lo cambias, actualiza también el texto "vence en 1 hora" de la plantilla y de `sendBienvenidaCliente` en `lib/resend.ts`.

Dónde: Supabase → Authentication → Emails → Templates.
El enlace usa `/auth/confirm` con `token_hash`, que NO depende del navegador donde se pidió el correo.

## Magic Link (acceso de siempre)
Asunto: `Tu link de acceso a Compaz`
Cuerpo (HTML):
```html
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px">
  <h2 style="color:#2D1464">Tu acceso a Compaz</h2>
  <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Pulsa el botón para entrar. El enlace funciona una sola vez y vence en 1 hora.</p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800">Entrar a Compaz</a>
  <p style="color:#6B5C90;font-size:13px;margin-top:24px">Si no pediste este acceso, ignora este correo.</p>
</div>
```

## Invite user (invitación del admin a un cliente)
Asunto: `Te invitamos a Compaz`
Cuerpo (HTML):
```html
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px">
  <h2 style="color:#2D1464">Te invitamos a Compaz</h2>
  <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Pulsa el botón para activar tu cuenta y entrar a tu portal.</p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800">Activar mi cuenta</a>
</div>
```
