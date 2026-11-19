# REPORTE DE INTEGRACIÓN — CUENTA A

A-003 v0.1.0 incorpora env.floor.001 como recurso independiente de A-002 v0.4.0. El color y la veta se interpretaron a partir de la foto del piso enviada por Gastón. La textura procedural representa listones gris cálido con juntas desplazadas. La orientación respecto del escritorio, el brillo y las medidas de los listones son estimados.

| Recurso | Valor |
|---|---|
| Modelo | public/assets/environment/floor_001.glb |
| Tamaño de prueba (X × Y × Z) | 8 × 0 × 6 m |
| Malla | Plano de 2 triángulos, cara superior +Y, origen centrado |
| Nodos | ROOT / FLOOR_SURFACE |
| Material | MAT_FLOOR_GREIGE_PLANK. PBR, no metálico, rugosidad 0,59 |
| Textura | Color JPEG de 1024 × 1024 embebido y repetible cada 2,40 × 1,44 m |
| Listones | Aproximación de 1,20 × 0,18 m con veta paralela a X |
| Anclajes y animaciones | Ninguno |
| Vista previa | Escritorio_con_piso.jpg con mobiliario de A-002 |

Rik puede instanciar el piso y el conjunto en el origen común, con escala 1 y superficie a Y=0. Añadir la entrada de data/assets.json al manifiesto compartido por ID. El piso dibuja una superficie de prueba. Sus límites no definen paredes, colisiones ni el tamaño de la oficina. Para variar las dimensiones preservando el tamaño aparente de los listones, ajustar vértices y UV en la fuente.

Se comprobó la carga con Qt Quick 3D. La prueba dentro del juego corresponde a Cuenta B. No hay cambios de contrato. Para reproducir desde la raíz del paquete ejecutar python source_3d/scripts/generate_floor.py (NumPy y Pillow). Para generar el fuente de Blender ejecutar blender --background --python source_3d/scripts/create_blends.py. La ejecución en Blender queda pendiente.
