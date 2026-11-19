# SABRI — EL JUEGO

Videojuego 3D colaborativo para navegador.

## Equipos
- **Cuenta A** (`cuenta-a-modelado`): Blender, recursos GLB, animaciones, texturas.
- **Cuenta B** (`cuenta-b-desarrollo`): TypeScript, Three.js, React Three Fiber, mecánicas e interfaz.
- **main**: versión estable, integración mediante pull requests.

## Desarrollo local

```bash
npm install
npm run dev
```

El visor B-001 está en desarrollo. El manifiesto `data/assets.json` está vacío hasta recibir A-001. Colocar GLB bajo `public/assets/` y declarar sus rutas `assets/...` en el manifiesto.

Contrato técnico compartido V1.0: no modificar convenciones sin aprobación de ambos equipos.
