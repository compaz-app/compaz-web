# Auditoría: COM-0274 y COM-0318 duplicados en la hoja 03

Fecha: 10-nov-2026. Solo lectura; no se ha cambiado nada.

## Hallazgo

Cada código aparece en **dos filas contiguas idénticas**: 268–269 (COM-0274) y 308–309 (COM-0318).
- Coinciden fecha de registro (16/09/2026), nombre, WhatsApp, email, ubicación, «ID Airtable» (`rec…`), origen, medio y campaña (`reclutamiento_compitas_sep_2026`).
- La única diferencia está en las columnas del control de duplicados:
  - primera fila: «Clasificación duplicado» = **Canónico**;
  - segunda fila: «Duplicado de (ID)» = el mismo COM- y «Clasificación duplicado» = **Duplicado confirmado**.
- Las cuatro filas están en «Registrado»: ninguna ha avanzado en la selección.

## Causa probable

El mismo registro de Airtable se insertó dos veces el 16-sep, durante la carga inicial desde Airtable. Que el `rec…` sea el mismo descarta a dos personas distintas.

La inserción doble ocurrió antes del control *fail-closed* actual. Hoy `validarCreacionCompitaSegura_` impide crear una fila si el ID Compita **o el ID Airtable** ya existen, y `generarSiguienteId_` toma el máximo COM- existente más uno.

Hipótesis compatibles: una copia manual de la fila o dos ejecuciones simultáneas de la sincronización antes del bloqueo. Con el código actual ninguna de las dos se repetiría por la vía automática; una copia manual de una fila sí podría.

## Riesgo e impacto

- Riesgo bajo mientras estén en «Registrado».
- Si alguna llegara a Habilitado:
  - la publicación omite las filas «Duplicado confirmado», así que solo saldría la canónica;
  - si aun así llegaran dos filas con el mismo COM-, la web las pone en cuarentena: no crea ni cambia nada y avisa.
- Las métricas que cuenten filas de la 03 cuentan dos aspirantes de más.

## Recomendación (sin ejecutar; los IDs no se cambian)

1. Dejar la fila canónica como está. A la duplicada, ponerle un estado de selección final (p. ej. «Descartado» con motivo «Fila duplicada de COM-0274») en lugar de borrarla, para conservar el histórico.
2. Excluir «Duplicado confirmado» de las métricas de la 03.
3. Opcional: un control en el vigilante del CMC que avise si aparece un ID Compita repetido.
