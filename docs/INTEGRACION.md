# Integración A ↔ B

Contrato: V1.0. Cuenta A entrega GLB con IDs estables y manifiesto en `data/assets.json`; Cuenta B valida carga, dimensiones, orientación, animaciones y anclajes. Ningún recurso se considera aceptado sin prueba en navegador.

## A-001 pendiente
- `furniture.desk.001`
- `furniture.chair.001`
- `char.employee.001`

## Convenciones
1 unidad = 1 metro; X derecha, Y arriba, Z profundidad; frente de personajes +Z; anclajes `ANCHOR_*`; clips `Idle`, `Walk`, `Sit`, `Talk`, `Interact`, `React`.

## Flujo
Trabajar en ramas individuales, abrir pull requests hacia `main`, registrar pruebas y solicitar aprobación humana ante cambios de contrato.
