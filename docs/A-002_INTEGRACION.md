# REPORTE DE INTEGRACIÓN — CUENTA A

## SABRI — EL JUEGO · A-002 v0.4.0

Se incorporó el módulo indicado en el JPG dentro de los 4,70 m existentes. El tablero mide 1,20 m de ancho y queda a 0,75 m del piso. El reparto en cuatro tramos iguales de 1,175 m, las ubicaciones de los accesorios y las formas de los respaldos son interpretaciones visuales. El esquema presenta cuatro sillas por lado, tres monitores en la fila delantera y tres notebooks en la fila opuesta. Se conservaron los nombres de los seis puestos anteriores y se agregaron 07 y 08 en el tramo de papelería.

| Recurso | Archivo | Dimensiones X × Y × Z (m) | Triángulos en escena |
|---|---|---|---:|
| furniture.desk.001 v1.2.0 | public/assets/furniture/desk_001.glb | 4,700 × 0,751 × 1,200 | 1.992 |
| env.desk_cluster.001 v0.3.0 | public/assets/environment/desk_cluster_001.glb | 5,214 × 1,159 × 2,571 | 30.204 |

La tapa del pasacables sobresale 1 mm sobre el tablero. Ambos recursos son estáticos. Pivote centrado en el piso, eje vertical +Y y largo en X. El conjunto incluye el escritorio y reutiliza mallas de accesorios. En una escena se instancia una sola de las dos variantes. Bajo ROOT/VISUAL, el conjunto agrupa DESK y WORKSTATION_01 a WORKSTATION_08. Cada silla conserva un ANCHOR_SIT local. El tablero tiene ANCHOR_DESK_TOP. El manifiesto detalla las transformaciones, los materiales y los nodos.

La revisión incluye asientos perfilados, respaldos curvos, pistones, palancas, cables y ventilación de pantallas, papeles y útiles. Las texturas PNG de tejido y escritorio digital son originales y están embebidas en el GLB. La interfaz de las pantallas es ilustrativa. El perímetro queda libre de otros muebles.

## Pruebas e integración

Se comprobaron dimensiones, índices, normales, orientación de triángulos, integridad de buffers, huellas SHA-256, materiales, texturas embebidas y recuentos de objetos. Ambos GLB se abrieron con Qt Quick 3D. La aceptación visual y la prueba en el navegador del juego quedan pendientes. Este paquete delta actualiza las dos entradas por ID en data/assets.json. Conservar los demás recursos, incluida la silla aislada y el personaje de A-001. Fusionar data/references.json por reference_id. La revisión mantiene el contrato 1.0. Cuenta B controla movimiento y colisiones.

## Fuentes y reproducción

Desde la raíz del paquete, con Node 24, ejecutar `node source_3d/scripts/generate_a002.mjs` y luego `node source_3d/scripts/verify_a002.mjs`. Los tres PNG fuente están en source_3d/scripts/textures y se pueden regenerar con Python y Pillow mediante make_textures.py. Para obtener los proyectos editables ejecutar `blender --background --python source_3d/scripts/create_blends.py`. La ejecución en Blender y los .blend quedan pendientes. Puestos_escritorio_A-002.jpg es la vista para anotaciones.

## Cambios en v0.4.0

Se reemplazaron los equipos de escritorio de los puestos 04, 05 y 06 por NOTEBOOK_04, NOTEBOOK_05 y NOTEBOOK_06 con teclado y panel táctil integrados. En esa fila se retiraron los nodos MONITOR y KEYBOARD_MOUSE correspondientes. Los puestos 07 y 08 continúan dedicados a papelería. Se mantienen los ocho anclajes de silla. El escritorio aislado conserva su versión y geometría.

El conjunto incluye SIDEBOARD_LEFT en la cabecera X negativa. La caja estimada mide 1,21 m de frente × 0,50 m de fondo × 0,79 m de alto. Las puertas se orientan hacia afuera. La tapa, los frentes corredizos y sus tiradores se basan en las fotos, junto con la cafetera y el recipiente claro. Las tres texturas PNG de trama, madera y escritorio digital están embebidas. El mueble se suma por fuera del largo confirmado de la mesa blanca, con un largo total de escena de 5,214 m. Su ubicación y sus cotas esperan confirmación. Puestos_escritorio_A-002.jpg muestra la cabecera izquierda; Fila_notebooks.jpg muestra las pantallas de las notebooks desde el lado opuesto.