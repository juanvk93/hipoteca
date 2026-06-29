# Changelog

Todas las versiones notables de la **Calculadora de Hipoteca** se documentan aquí.
El formato sigue, de forma aproximada, [Keep a Changelog](https://keepachangelog.com/es-ES/).

## [1.3.0] — 2026-06-30

### Añadido

- **Comparador mejorado**:
  - Tarjeta de **veredicto** con la opción más barata por coste total y cuánto ahorra frente a
    la siguiente; se **resalta la columna** de esa hipoteca.
  - **Diferencias (+importe)** en intereses, coste total y ahorro necesario respecto a la mejor.
  - Nuevas filas: **cuota** (con rango por tramos), **comisión de apertura** y **gastos
    vinculados**.
  - Gráfico de **coste total** (capital + intereses + comisión y productos) con el ganador
    destacado.
  - Tiene en cuenta el **TAE del banco**: cuando se ha indicado, el coste total y la TAE de esa
    hipoteca reflejan los gastos vinculados estimados a partir de él (se usa el mayor entre los
    declarados y los estimados, sin duplicar).
- **Valores por defecto** en Ajustes (cantidad a solicitar, precio de la vivienda, comunidad
  autónoma, obra nueva y vivienda habitual) que se rellenan al iniciar la app y al pulsar «Nuevo».

### Cambiado

- **6 colores de acento nuevos** en Ajustes (14 en total).
- Mejor separación visual en la sección del Euríbor de Ajustes.

## [1.2.3] — 2026-06-30

### Corregido

- La **TAE** calculada no incluía los **gastos vinculados** (solo la comisión de apertura), por
  lo que al añadir el coste de los productos la TAE no variaba. Ahora la TAE incorpora la prima
  mensual de los productos, de modo que coincide con la del banco al introducir su coste. La
  deducción del coste desde el TAE se compara siempre contra la TAE limpia (TIN + comisión).

## [1.2.2] — 2026-06-29

### Añadido

- **Coste de productos desde el TAE**: dado el TAE que anuncia el banco y tu TIN, la app estima
  el coste anual de los productos vinculados (seguros, etc.) que explica la diferencia entre
  ambos. La cuota se sigue calculando con el TIN; el TAE solo sirve para revelar ese coste oculto.
  Incluye un botón para aplicar ese coste a «Gastos vinculados» y recalcular automáticamente.

## [1.2.1] — 2026-06-29

### Corregido

- Al abrir una hipoteca guardada (o al prerrellenar el Euríbor), los campos con decimales
  (TIN, comisión de apertura, Euríbor) quedaban vacíos: los `<input type="number">` exigen punto
  como separador decimal en su `.value` y se les estaba asignando con coma.

## [1.2.0] — 2026-06-28

### Añadido

- **Bonificación (¿compensa?)**: compara el coste total contratando los productos vinculados
  (TIN reducido) frente a no contratarlos (TIN + incremento) y muestra el veredicto y el ahorro.
- **Amortización anticipada**: simula aportaciones extra (única, mensual o anual) eligiendo
  *reducir cuota* o *reducir plazo*, con comisión de amortización, y calcula el ahorro de
  intereses y el tiempo ganado. Compatible con tramos (tipo de entrada y mixta).
- **Cuadro de amortización mensual** completo (además del resumen anual) y **exportable a CSV**.
- **Gráficos** (SVG, sin dependencias): evolución del capital pendiente en los resultados y
  comparativa de coste (capital + intereses) en el comparador.
- **Histórico del Euríbor** de los últimos meses desde el BCE, en Ajustes.
- **Exportar / importar** hipotecas en un archivo JSON (copia de seguridad y traspaso entre
  dispositivos).

### Interno

- Batería de tests del motor en `tests/` (ejecutable con `npm test` o `node tests/run.mjs`).

## [1.1.0] — 2026-06-28

### Añadido

- **Tramo inicial con TIN especial (tipo de entrada)**:
  - En hipoteca **fija**, TIN reducido durante los primeros meses (p. ej. 6 meses al 3,48 % y el
    resto al 4,48 %).
  - En hipoteca **variable**, el habitual **primer periodo a tipo fijo** antes de pasar a
    Euríbor + diferencial.
  - Los resultados muestran la cuota de los primeros meses y la del resto del plazo; la cuota del
    resto se **recalcula sobre el saldo pendiente** al acabar la promoción, y la TAE refleja los
    flujos reales.

## [1.0.0] — 2026-06-28

### Primera versión

- Cálculo de hipoteca **fija**, **variable** y **mixta** con el sistema francés de amortización.
- Resultados: cuota mensual, intereses totales, total a pagar, coste total y **TAE estimada**
  (calculada por valor presente, incluyendo la comisión de apertura).
- **Cuadro de amortización** con resumen anual.
- **Escenarios de Euríbor** (subidas y bajadas) para hipotecas variables y mixtas.
- **Impuestos y gastos de compra por comunidad autónoma** (ITP/IVA/AJD, notaría, registro y
  gestoría) y cálculo del **ahorro necesario** para la entrada.
- Euríbor a 12 meses **automático desde el BCE** (API del European Central Bank Data Portal)
  o **introducido a mano** en ajustes.
- **Guardado** de hipotecas y **comparador** lado a lado, con resaltado del mejor valor.
- **Tema oscuro y claro** y **color de acento** configurable.
- **PWA**: instalable, funciona sin conexión (service worker) y guarda los datos de forma
  persistente en IndexedDB.

### Notas técnicas

- Las hipotecas variables/mixtas asumen el Euríbor **constante** durante toda la vida del
  préstamo para el cálculo base; los escenarios muestran el efecto de su variación.
- Los porcentajes de impuestos por CCAA y la TAE son **estimaciones orientativas**; consulta
  siempre las condiciones oficiales de la entidad.
