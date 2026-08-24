# CLAP

**C**ontrol, **L**ogística y **A**dministración de **P**roducción.

Sistema de gestión para productoras de publicidad y cine: presupuestos, equipo técnico,
equipamiento, seguros, callsheet y circuito de dinero. Pensado para que dos personas
administren muchas productoras al mismo tiempo.

## Estado

**v0.1 — prototipo del presupuestador.** Un solo archivo, `clap.html`.
Abrilo con doble clic en cualquier navegador; no necesita servidor ni instalación.
Los datos se guardan en el navegador (`localStorage`).

> ⚠️ Exportá el `.json` seguido (botón **Datos → Exportar todo**). Hasta que haya
> backend, ese archivo es el único respaldo y también la forma de pasarle el trabajo
> a la otra persona.

## Qué hace hoy

- **Multi-productora**: cada una con su CUIT, condición de IVA, jurisdicción y
  porcentajes por defecto (fee, contingencia, IVA, IIBB). Los proyectos viven adentro
  de cada productora, aislados.
- **Catálogo compartido** de personas, proveedores y equipamiento — vive a nivel del
  estudio, no de cada productora. Incluye los datos fiscales y de seguro (DNI, CUIT,
  fecha de nacimiento) que después alimentan el alta de la aseguradora.
- **Presupuesto por rubros** (15 rubros de publicidad argentina precargados) con
  catálogo de ~90 funciones para cargar líneas rápido.
- **Multi-moneda**: cada línea en ARS o USD, con tipo de cambio de referencia
  (Oficial / MEP / CCL / Blue / pactado) y **fecha de cotización** — es lo que después
  permite reclamar el reajuste por diferencia de cambio.
- **Capas de cálculo**: subtotal → fee (sólo sobre los rubros marcados) → contingencia
  → IIBB → IVA → total. Elenco y seguros van sin fee por defecto.
- **Versionado**: duplicar una versión crea una copia independiente. v1 nunca se pisa.
- **Vista Interna / Vista Cliente**: la del cliente muestra sólo el resumen por rubro,
  sin detalle de líneas ni circuito de pago.
- **Circuito de pago y respaldo documental** por línea (transferencia / efectivo /
  cripto · factura A / B-C / recibo simple / sin comprobante), con un panel de
  reconciliación que muestra qué porcentaje del costo está bancarizado y cuánto
  tiene respaldo fiscal.
- Export **JSON** (respaldo completo), export **CSV**, e impresión a **PDF**.
- Funciona en el celular (las filas se convierten en tarjetas).

## Arquitectura

Todo en `clap.html`, en cuatro bloques marcados en el código:

| Bloque | Qué es |
|---|---|
| `MODEL` | Schema, catálogos maestros (rubros, funciones, circuitos), fábricas de entidades |
| `STORE` | Persistencia y migraciones. Hoy `localStorage`, mañana una API |
| `CALC`  | Motor de cálculo: líneas → rubros → capas → total. Sin dependencias de UI |
| `UI`    | Render |

`CALC` no toca el DOM y `MODEL` no toca `STORE`: cuando se migre a Postgres/Supabase
sólo se reescribe `STORE`. Toda entidad lleva `id` propio y las de proyecto cuelgan
de `productoraId`, así que el schema ya es multi-tenant.

## Roadmap

1. **Presupuestador** ✅
2. **Plan de rodaje y callsheet** — generado del mismo dato: jornadas, citaciones por
   departamento, locaciones, hospital más cercano, contactos.
3. **Seguros** — generar el alta (nómina para el broker) desde el crew ya cargado;
   guardar pólizas y certificados. AP, ART, RC, todo riesgo equipos.
4. **Caja y pagos** — órdenes de compra, caja chica por jornada, rendiciones, y el
   tablero Presupuestado / Comprometido / Real.
5. **Backend** — Supabase, usuarios, adjuntos, acceso de sólo lectura para el cliente.
6. **Tarifario histórico** — al cerrar un proyecto, el catálogo aprende cuánto salió
   cada rubro de verdad.

## Pruebas

El motor de cálculo y los caminos de render se prueban headless (sin navegador):

```bash
node test/run.js test/pruebas.js
```
