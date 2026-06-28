# Changelog

Todas las versiones notables de la **Calculadora de Hipoteca** se documentan aquí.
El formato sigue, de forma aproximada, [Keep a Changelog](https://keepachangelog.com/es-ES/).

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
