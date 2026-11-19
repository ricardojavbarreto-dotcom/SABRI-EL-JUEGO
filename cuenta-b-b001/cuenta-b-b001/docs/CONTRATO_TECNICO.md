# CONTRATO TÉCNICO COMPARTIDO — V1.0

**Proyecto:** Videojuego 3D de oficina para navegador  
**Estado:** Propuesta inicial, pendiente de aceptación por Cuenta A y Cuenta B  
**Responsables:** Cuenta A — Mundo 3D y personajes; Cuenta B — Motor web, lógica e interfaz  
**Regla de precedencia:** Este contrato prevalece sobre los prompts individuales cuando exista contradicción. Las decisiones de producto y cambios de contrato requieren aprobación de los responsables humanos del proyecto.

## 1. Misión y límites

El proyecto es un único videojuego web desarrollado por dos equipos coordinados. Cuenta A produce recursos visuales 3D editables y optimizados. Cuenta B implementa el motor, controles, IA y comportamiento de personajes, diálogos, interacciones, interfaz, audio, persistencia y publicación. Ninguna cuenta debe presentar prototipos o recursos pendientes de comprobación como si ya estuvieran integrados. La identidad artística, medidas reales de la oficina y mecánicas definitivas siguen pendientes de definición; no deben inventarse ni fijarse como requisitos sin aprobación.

## 2. Tecnología y formatos

- **Modelado:** Blender; archivos fuente `.blend` y scripts de generación cuando corresponda.
- **Intercambio 3D:** glTF 2.0 binario (`.glb`); materiales PBR compatibles y animaciones glTF.
- **Aplicación web prevista:** TypeScript + Three.js + React Three Fiber. Cualquier cambio de stack requiere una solicitud de cambio.
- **Datos compartidos:** JSON UTF-8 validado por esquema; documentación Markdown.
- **Texturas:** PNG/JPEG y, si se habilita, WebP según compatibilidad probada; preferir empaquetarlas dentro del GLB cuando sea viable.
- **Repositorios:** Git para código/documentación y Git LFS para binarios grandes, o almacenamiento compartido con enlaces y hashes si no hay Git.
- **Política:** nadie asume que una herramienta, plugin o acceso externo está disponible sin comprobarlo.

## 3. Coordenadas, escala y pivotes

- **Escala:** 1 unidad del mundo = 1 metro.
- **Coordenadas del motor:** X derecha, Y arriba, Z profundidad; sistema de mano derecha.
- **Frente canónico del personaje:** dirección local +Z, con Y arriba, salvo que una prueba de integración acuerde otra convención.
- **Personajes:** pivote en el suelo, centrado entre los pies; escala 1,1,1; rotación inicial neutra a nivel de nodo de juego.
- **Objetos móviles:** pivote lógico claramente indicado (por ejemplo, bisagra de puerta), o nodos auxiliares separados.
- **Blender:** trabaja internamente con Z vertical; el exportador glTF debe realizar la conversión de ejes. No introducir giros correctivos improvisados en cada componente. Validar con archivo de prueba y documentar la configuración real de exportación.
- **Entorno:** fijar un origen general de escena y puntos de referencia de arquitectura; las medidas no confirmadas se rotulan `PROVISIONAL`.
- **Colisiones y navegación:** Cuenta B define su representación; Cuenta A puede entregar mallas o nodos auxiliares con nombres convenidos, pero no decide unilateralmente la lógica de movimiento.

## 4. Identificación: una entidad, un ID estable

Los nombres humanos pueden cambiar; los identificadores técnicos no deben cambiar sin migración.

**Formato de ID:** `categoria.nombre.numero` en minúsculas ASCII, palabras en `snake_case` y número de tres dígitos.

Categorías iniciales: `env`, `furniture`, `prop`, `char`, `anchor`, `interaction`, `event`, `dialogue`, `reference`.

Ejemplos:

| Identificador | Significado |
| --- | --- |
| `env.office.001` | Oficina principal |
| `furniture.desk.001` | Escritorio principal |
| `furniture.chair.001` | Silla principal |
| `prop.telephone.001` | Teléfono interactivo |
| `char.employee.001` | Primer empleado |
| `char.visitor.001` | Primer visitante |
| `interaction.answer_phone.001` | Interacción de atender teléfono |
| `event.visitor_arrival.001` | Evento de llegada |
| `dialogue.visitor_intro.001` | Diálogo de apertura |
| `reference.office_photo.001` | Fotografía de referencia |

Un ID no se reutiliza para otro objeto, aun cuando el anterior se retire. Los IDs no incluyen versión, carpeta, nombre de artista ni estado.

**Archivos:** `desk_001.glb`, `visitor_001.glb`; los nombres de archivos son rutas de recursos, no sustitutos de los IDs. En manifiestos se guarda siempre la relación `id -> ruta`.

**Nodos internos:** `ROOT`, `VISUAL`, `COLLIDER_*` (si corresponde), `ANCHOR_*`, `ARMATURE` y huesos con convención documentada. Nunca depender de `Cube.001`, `Object.024` u otros nombres temporales.

## 5. Citas y referencias compartidas

Todas las referencias de fotografías, planos, renders, medidas, documentos o decisiones reciben un identificador estable. No usar expresiones como «la foto de ayer» o «el teléfono de la derecha» como referencia única.

**Registro de referencias:** `docs/REFERENCIAS.md` o `data/references.json` con:
- `reference_id` (ej.: `reference.office_photo.001`)
- `title` y descripción
- `source` (archivo, enlace, persona que lo aportó o documentación)
- `captured_at` / fecha conocida, si corresponde
- `path_or_url` accesible al equipo
- `status`: `confirmed`, `provisional` o `superseded`
- `applies_to`: IDs de objetos a los que refiere
- `notes`: medidas y observaciones; distinguir medición de estimación

**Forma de citar en los reportes:** `[REF:reference.office_photo.001]`. Para decisiones técnicas usar `[DEC:DEC-001]`, para incidencias `[ISSUE:ISS-001]`, y para solicitudes de cambio `[RFC:RFC-001]`.

La fuente original debe estar accesible a ambos equipos. Una cita es un puntero verificable, no prueba de que la información esté confirmada. No sustituir el acceso a imágenes originales por descripciones ambiguas.

## 6. Animaciones y personajes

Clips iniciales con nombres exactos y capitalización estable: `Idle`, `Walk`, `Sit`, `Talk`, `Interact`, `React`.

- `Idle` y `Walk`: primera prioridad; otros clips se agregarán según necesidades del prototipo.
- La locomoción será **in-place** (sin traslación horizontal acumulada en el root); Cuenta B controla el desplazamiento en el mundo.
- Los clips deben tener transiciones razonables, duraciones registradas y etiquetas de loop/no loop.
- No suponer que dos personajes pueden compartir clips salvo que el rig y la retargetización hayan sido comprobados.
- Toda exportación de personaje incluye origen, orientación, escala, nombres de clips, duración, rig e incompatibilidades conocidas.
- Nunca declarar existente una animación que solamente está planificada.

## 7. Anclajes y puntos de interacción

Los puntos de interacción se representan con nodos auxiliares en el GLB o con posiciones/transformaciones documentadas en el manifiesto. Nombres estables, por ejemplo:

- `ANCHOR_USE_PHONE`: lugar y orientación para usar el teléfono.
- `ANCHOR_SIT`: postura y ubicación para sentarse.
- `ANCHOR_VISITOR_WAIT`: espera del visitante.
- `ANCHOR_DOOR_ENTRY`: ingreso por puerta.

Cuenta A entrega la geometría y los anclajes; Cuenta B implementa la lógica y valida distancias, colisiones y animaciones. Las coordenadas de los anclajes son locales al recurso, salvo que el manifiesto indique otra cosa.

## 8. Estructura del proyecto

```text
project/
├── assets/
│   ├── environment/
│   ├── furniture/
│   ├── props/
│   ├── characters/
│   └── textures/
├── source_3d/
│   ├── blender/
│   └── scripts/
├── src/
│   ├── scene/
│   ├── gameplay/
│   ├── characters/
│   └── ui/
├── data/
│   ├── assets.json
│   ├── references.json
│   └── schemas/
├── docs/
│   ├── CONTRATO_TECNICO.md
│   ├── REFERENCIAS.md
│   ├── DECISIONES.md
│   ├── CAMBIOS.md
│   └── INTEGRACION.md
└── README.md
```

Cuenta A es propietaria funcional de `assets/` y `source_3d/`. Cuenta B es propietaria funcional de `src/`. Las carpetas `data/` y `docs/` son compartidas; los cambios de estructura, IDs o esquemas requieren coordinación. No editar simultáneamente un mismo archivo sin fusionar versiones.

## 9. Manifiesto obligatorio de activos

`data/assets.json` deberá validar contra un esquema versionado acordado. Ejemplo **ilustrativo** mínimo (no implica que el GLB ya exista):

```json
{
  "schema_version": "1.0.0",
  "assets": [
    {
      "id": "prop.telephone.001",
      "type": "prop",
      "file": "assets/props/telephone_001.glb",
      "version": "0.1.0",
      "status": "provisional",
      "dimensions_m": [0.24, 0.12, 0.18],
      "anchors": ["ANCHOR_USE_PHONE"],
      "animations": [],
      "references": ["reference.office_photo.001"]
    }
  ]
}
```

Las medidas del ejemplo son ficticias. En una entrega real deben venir del recurso exportado y/o de una fuente registrada. Cada archivo referido debe existir; no se aceptan rutas inventadas.

## 10. Versiones, archivos y cambios

- Contrato: versiones `MAJOR.MINOR` (`1.0`, `1.1`, `2.0`). Cambios incompatibles incrementan `MAJOR`.
- Recursos: versiones `MAJOR.MINOR.PATCH`; cambios de topología, jerarquía, animaciones o anclajes que rompen integración incrementan `MAJOR`.
- Rutas estables cuando sea posible; usar Git para versiones en lugar de agregar sufijos como `_final_final2`.
- El identificador del objeto se mantiene mientras conserve identidad semántica.
- Toda entrega registra fecha, commit o paquete, recursos afectados y pruebas realizadas.
- Cada cambio compartido necesita un RFC con: motivo, propuesta, impacto, migración y aceptación de Cuenta A y Cuenta B, además de aprobación humana cuando altere alcance o experiencia.
- Nunca romper recursos ya consumidos por Cuenta B sin aviso y mecanismo de migración.

## 11. Comunicación y estados

**Estados de recursos:** `planned`, `in_progress`, `ready_for_review`, `accepted`, `deprecated`.

**Reporte de entrega de Cuenta A:**

```text
REPORTE A — PAQUETE A-001
Contrato: 1.0
Versión del paquete: 0.1.0
Commit / enlace: ...
IDs entregados: ...
Rutas verificadas: ...
Referencias usadas: [REF:...]
Animaciones: ...
Anclajes: ...
Pruebas realizadas: ...
Limitaciones: ...
Cambios de integración: ...
Acción requerida de Cuenta B: ...
```

**Respuesta de Cuenta B:**

```text
INTEGRACIÓN B — PAQUETE A-001
Contrato: 1.0
Versión probada: ...
Resultado: accepted / changes_requested / blocked
Carga de GLB: OK / ERROR
Escala / ejes: OK / ERROR
Animaciones: OK / ERROR / N/A
Anclajes: OK / ERROR / N/A
Rendimiento: ...
Incidencias: [ISSUE:...]
Acción requerida de Cuenta A: ...
```

No afirmar «integrado», «funciona» o «validado» sin haber ejecutado la prueba pertinente. Si solo se inspeccionó el archivo, declarar «inspección estática».

## 12. Criterios de aceptación y rendimiento

Una entrega 3D es aceptable para revisión cuando:
1. Existe el archivo en la ruta declarada.
2. Se puede abrir o parsear en una herramienta glTF compatible.
3. Las coordenadas, dimensiones y pivotes cumplen el contrato.
4. Los materiales y texturas cargan sin dependencias faltantes.
5. Los clips declarados realmente existen.
6. Los anclajes declarados pueden localizarse por nombre.
7. Se registra cantidad de triángulos, tamaño del archivo y advertencias.
8. Cuenta B lo prueba en la aplicación web y emite el resultado.

**Presupuesto inicial de rendimiento (objetivo provisional, no garantía):** priorizar carga rápida y fluidez en una computadora de gama media; Cuenta B establecerá FPS, tiempo de carga, límites de memoria y presupuesto por escena tras el primer prototipo medido. Cuenta A optimiza según mediciones reales, evitando fijar límites arbitrarios prematuramente.

## 13. Alcance del primer paquete A-001

- Escritorio sencillo, a escala, con ID `furniture.desk.001`.
- Silla sencilla con ID `furniture.chair.001`.
- Personaje humano provisional `char.employee.001`, con clips `Idle` y `Walk` **si se pudieron generar y verificar**.
- `data/assets.json` con rutas, referencias y metadatos reales.
- Reporte de entrega y validación.

**Prueba de Cuenta B:** abrir una página web que importe los GLB, compruebe orientación y escala, reproduzca los clips disponibles y permita inspeccionar los anclajes. No avanzar a producción masiva de modelos hasta aprobar esa prueba.

## 14. Cómo iniciar cada conversación

Cada cuenta debe recibir este contrato completo y su prompt individual. Ambas responden primero con: (a) aceptación o divergencias concretas, (b) riesgos o decisiones pendientes, (c) tarea inicial de su equipo. Ninguna divergencia altera el contrato hasta contar con aceptación de ambas y registro de cambio.

**Fin del contrato V1.0**
