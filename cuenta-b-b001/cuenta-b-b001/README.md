# Cuenta B — B-001 · Visor de integración

Proyecto web inicial de integración conforme al Contrato Técnico Compartido V1.0. **No es todavía un juego funcional ni se ha validado con el paquete A-001.**

## Inicio

```bash
npm install
npm run dev
```

Abrir la URL local indicada por Vite. Para producción: `npm run build`.

## Recursos de Cuenta A

1. Copiar GLB a `public/assets/environment`, `public/assets/furniture`, `public/assets/props` o `public/assets/characters` según corresponda.
2. Registrar cada recurso en `data/assets.json`, con `file` empezando por `assets/`, ID estable, versión, estado y datos reales.
3. Seleccionar el recurso en el panel. El visor informa dimensiones, triángulos, clips y nodos `ANCHOR_*` detectados.
4. La carga local de un GLB permite inspección temporal sin registrarlo en el manifiesto.

## Limitaciones conocidas

- El prototipo usa geometría provisional y no incluye modelos oficiales.
- Las animaciones se listan y pueden reproducirse, pero no hay todavía control de transiciones ni retargeting.
- Se detectan nombres de anclajes y se muestran marcadores amarillos en sus posiciones; la validación formal de anclajes sigue pendiente.
- La orientación, la escala y el origen se inspeccionan visualmente, no se aprueban automáticamente.
- Los errores de carga GLB se deben inspeccionar con consola de navegador; aún no hay manejo de error recuperable en pantalla.
- El esquema JSON versionado y su validador automático todavía están pendientes.
- No se han ejecutado pruebas en navegador real ni integración A-001.

## Propiedad de carpetas

Cuenta A: `assets/` y `source_3d/`. Cuenta B: `src/`. `data/` y `docs/`: compartidas.
