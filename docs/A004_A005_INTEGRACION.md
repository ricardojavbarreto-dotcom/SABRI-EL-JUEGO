# REPORTE DE INTEGRACIÓN — CUENTA A

Sabri y los seis personajes aprobados se cargan desde public/assets/characters. El manifiesto data/assets.json contiene sus identificadores, versiones, dimensiones en metros, triángulos, texturas, jerarquías y hashes. Los siete incluyen Idle y Walk en el sitio. Sit, Talk, Interact y React están pendientes. La prueba conjunta en el visor web queda para Cuenta B.

Las fuentes están en source_3d/packages/A-004 (Sabri), A-005-base (Gastón, David y Ricardo con campera naranja) y A-005 (rostros aprobados de Nicolás, Padre Conrado y Kelly). Ejecutar el generador .mjs de cada carpeta con Node 22+ y después blender --background --python create_blends.py desde esa carpeta para obtener los editables. La carpeta data generada en cada paquete es local al paquete. Las estaturas del elenco son provisionales.
