# Changelog

Todas las versiones notables de la **Calculadora de Hipoteca** se documentan aquí.
El formato sigue, de forma aproximada, [Keep a Changelog](https://keepachangelog.com/es-ES/).

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
