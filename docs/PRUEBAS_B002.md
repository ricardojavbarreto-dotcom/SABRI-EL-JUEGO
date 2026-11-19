# B-002 — Plan de pruebas

Estado: **pendiente de ejecución**.

1. `npm ci && npm run build` finaliza sin errores.
2. Se abre la pestaña **Jugar** y aparecen escritorio, teléfono, computadora, mate y silla provisionales.
3. Clic en un objeto actualiza la descripción sin comenzar una visita.
4. **Recibir visitante** muestra personaje provisional; **Hablar** abre tres opciones.
5. Cada opción resuelve el encuentro y actualiza puntaje de forma coherente.
6. **Siguiente turno** reinicia la exploración sin borrar puntaje.
7. **Inspeccionar GLB** permite cargar un GLB válido, leer clips y anclajes.
8. Verificar escala y ejes con los modelos A-001 cuando estén disponibles.

## Publicación

Para publicar: configurar Settings → Pages → Build and deployment → GitHub Actions; integrar la PR a `main` **después** de validar la compilación. La URL prevista, no confirmada, es `https://ricardojavbarreto-dotcom.github.io/SABRI-EL-JUEGO/`.
