# REPORTE DE INTEGRACIÓN — CUENTA A

**Sabri Game · A-001 v0.1.0 · 19 de noviembre de 2026**  
Contrato Técnico 1.0 adoptado para esta entrega por Cuenta A. Estado de los tres activos `ready_for_review`. Modelos y medidas provisionales.

## Recursos entregados

| ID | GLB | Dimensiones X × Y × Z en m | Triángulos | Tamaño |
|---|---|---:|---:|---:|
| `furniture.desk.001` | `public/assets/furniture/desk_001.glb` | 1,400 × 0,750 × 0,700 | 780 | 42.376 B |
| `furniture.chair.001` | `public/assets/furniture/chair_001.glb` | 0,480 × 0,870 × 0,514 | 660 | 37.576 B |
| `char.employee.001` | `public/assets/characters/employee_001.glb` | 0,632 × 1,700 × 0,288 | 1.452 | 156.076 B |

- Escritorio con tablero de madera y estructura metálica. [REF:reference.prototype_desk.001]
- Silla de cuatro patas, con asiento y respaldo tapizados. [REF:reference.prototype_chair.001]
- Empleado estilizado y segmentado, con rig de 15 huesos. Dimensiones tomadas en pose de reposo. [REF:reference.prototype_employee.001]

Los GLB suman 236.028 B y 2.892 triángulos. Los materiales usan color, metalicidad y rugosidad PBR. Las texturas externas y las extensiones obligatorias son cero. El manifiesto lista los materiales, la jerarquía y el SHA-256 de cada binario.

## Arquitectura de archivos y nodos

| Ruta | Contenido |
|---|---|
| `public/assets/furniture/`, `public/assets/characters/` | GLB autónomos. El manifiesto conserva las rutas web `assets/…` que consume B-001. |
| `source_3d/scripts/generate_a001.mjs` | Fuente procedural que genera los GLB y deriva los datos del manifiesto. |
| `source_3d/scripts/create_blends.py` | Importación a Blender y guardado individual en `source_3d/blender/`. |
| `source_3d/scripts/verify_a001.mjs` | Comprobación reproducible de binarios y clips. |
| `data/assets.json` | Relación entre ID, archivo, versión, metadatos y estado. |
| `data/references.json` | Registro de las referencias provisionales. |
| `data/schemas/assets-a001.proposal.schema.json` | Propuesta de esquema JSON para esta prueba. Su adopción requiere acuerdo de ambas cuentas. |
| `docs/REPORTE_INTEGRACION_CUENTA_A.md` | Handoff para Cuenta B. |

`ROOT` está en el piso, con posición y rotación neutras y escala unitaria. `VISUAL` contiene la geometría. En el personaje, `ARMATURE → hips` soporta el esqueleto y `VISUAL` contiene la malla skinned. El centro entre los pies coincide con el origen en reposo y la cara apunta a +Z. Los GLB se generaron directamente en coordenadas glTF, con Y arriba y unidades en metros. Si se reexporta desde Blender, volver a comprobar las convenciones en el archivo resultante. [Especificación glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)

## Anclajes y clips

| Recurso | Nodo local | Posición local X, Y, Z en m | Uso propuesto |
|---|---|---|---|
| Escritorio | `ANCHOR_DESK_TOP` | (0; 0,750; 0) | Centro de la superficie de apoyo. |
| Silla | `ANCHOR_SIT` | (0; 0,460; 0,035) | Centro de la superficie del asiento, con frente +Z. |

`ANCHOR_SIT` es una referencia geométrica. Para sentar al personaje habrá que ajustar el origen del actor con el clip `Sit` cuando exista. La Cuenta B define colisiones, navegación y distancia de interacción.

| Clip en `employee_001.glb` | Duración | Reproducción | Movimiento |
|---|---:|---|---|
| `Idle` | 3,20 s | Bucle | Respiración suave y movimiento de brazos. |
| `Walk` | 1,12 s | Bucle | Caminata en el lugar con flexión de rodillas y balanceo de brazos. |

`ROOT` carece de pistas animadas. `Walk` mueve la cadera en vertical y la Cuenta B traslada y gira el actor en el mundo. Los bucles se configuran en el reproductor. `Sit`, `Talk`, `Interact` y `React` siguen pendientes.

## Verificación y archivos editables

- Se comprobaron sobre los binarios la estructura GLB, los índices y triángulos, los materiales, los límites, el pivote, el frente, los anclajes y los hashes. Para el personaje también se comprobaron los pesos rígidos, las matrices de enlace, el cierre de los bucles y el apoyo de los pies en muestras de la animación.
- Los tres binarios se abrieron con Qt Quick 3D RuntimeLoader y devolvieron estado `Success` con nodos importados.
- Prueba de importación por `GLTFLoader` y prueba en la aplicación de Cuenta B pendientes.
- Blender no estuvo disponible en el entorno de generación. El script de importación está incluido y verificado sintácticamente. Los `.blend` quedan pendientes de generar y revisar en Blender.

Ejecutar desde la carpeta raíz del paquete.

```sh
node source_3d/scripts/verify_a001.mjs
node source_3d/scripts/generate_a001.mjs
blender --background --factory-startup --python-exit-code 1 --python source_3d/scripts/create_blends.py
```

El verificador y el generador funcionan con Node.js 22 o posterior y carecen de dependencias externas. Usar el generador para reconstruir los GLB a partir de la fuente. El comando de Blender crea un `.blend` por activo sin reescribir los GLB. Si Blender queda fuera del PATH, ejecutar el mismo comando con la ruta de su ejecutable. [Manual de línea de comandos de Blender](https://docs.blender.org/manual/en/5.0/advanced/command_line/arguments.html)

## Prueba de aceptación de Cuenta B

1. Cargar los tres GLB mediante `GLTFLoader` o `useGLTF`, con un piso en Y=0 y escala de escena 1.
2. Comprobar el tablero a Y=0,75 m y el asiento a Y=0,46 m. En reposo, comprobar que las suelas apoyen en el piso y que la cara apunte a +Z.
3. Localizar ambos anclajes por nombre. En el personaje, reproducir `Idle`, pasar a `Walk` y verificar el bucle. Trasladar el actor con su nodo de juego y comprobar que la malla siga el movimiento junto al rig.
4. Registrar carga, orientación, escala, anclajes, animaciones y rendimiento en la respuesta de integración para A-001.

Primera entrega del paquete. La [PR #1 de Cuenta B](https://github.com/ricardojavbarreto-dotcom/SABRI-EL-JUEGO/pull/1) agrega un `data/assets.json` vacío. Al juntar las ramas, conservar las tres entradas de A-001 en el manifiesto compartido. La Cuenta B tiene que confirmar `ANCHOR_DESK_TOP` y el esquema antes de adoptarlos como convenciones de producción.

## Insumos para reconstruir la oficina

Fotos generales desde la entrada y las cuatro esquinas, fotos de los muebles y objetos que intervienen en el juego, y un croquis con ancho, largo y altura, puertas, ventanas y ubicación de los muebles principales. Registrar al menos una medida comprobable por ambiente y las medidas de los muebles que deban reproducirse. Las referencias de estilo y de personajes pueden adjuntarse al mismo envío.
