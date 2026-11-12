# Líneas de servicio futuras (Próximamente) — decididas 2026-11-12

Hoy Compaz ofrece **compañía** para adultos mayores. Estas líneas están **planeadas y todavía NO activas**. Se muestran como "Próximamente" en los lugares donde vivirán, para dar a conocer el plan (familias, compitas e inversionistas). Todo sale de un solo catálogo: `lib/servicios-proximos.ts`; las tarjetas están en `components/ui/Proximamente.tsx`.

## Decisiones de producto
1. **Voluntariado.** Compaz es el **puente**: pone la plataforma para que la gente se conecte (por ejemplo, acompañar a una paciente oncológica a una cola, una cita o una sesión de quimioterapia). **Compaz no paga ni cobra nada.** Los voluntarios son compitas que lo deciden, con su mismo perfil.
2. **Dona horas.** Al pagar un servicio, el cliente podrá donar horas de voluntariado para alguien que las necesita.
3. **Cuidado de mascotas.** Servicio de pago (paseos, cuidado en casa, acompañar al veterinario). El compita que quiera ofrecerlo responde **preguntas adicionales en su perfil** (experiencia con animales, tamaños que maneja, disponibilidad) para comprobar que es apto.
4. **Ciudades:** las mismas de hoy.

## Dónde se muestran hoy ("Próximamente", sin enlaces ni botones que lleven a un flujo)
| Lugar | Qué se ve |
|---|---|
| Página principal | Sección "Compaz sigue creciendo" con Voluntariado y Mascotas |
| Portal del cliente, Inicio | "Pronto en Compaz" con Voluntariado y Mascotas |
| Portal del cliente, Mi plan | Tarjeta "Dona horas" |
| Página de pago | Tarjeta "Dona horas" |
| Registro del compita y su perfil | Casillas deshabilitadas "Lo que podrás ofrecer más adelante" |
| Panel, Más | Sección "Próximamente" con ⓘ |

## Para activar una línea más adelante
1. Construir su flujo (por ejemplo, un tipo de solicitud nuevo —como ya existe `mandado`—, la ficha de mascota en el portal, las preguntas de verificación del compita, el tablero de solicitudes de voluntariado).
2. Quitarla de `SERVICIOS_PROXIMOS` y mostrarla donde corresponda como servicio real.
3. Decidir antes: seguro o cláusula de responsabilidad para animales; datos de salud (consentimiento y mínimo necesario) para voluntariado oncológico; un aliado (fundación u hospital) para un piloto controlado.
