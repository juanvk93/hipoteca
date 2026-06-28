// ============================================================================
//  changelog.js · Versión de la app e historial de cambios
// ----------------------------------------------------------------------------
//  Al publicar una versión: añade una entrada arriba, actualiza VERSION y sube
//  la versión de caché del service worker (CACHE en sw.js) para forzar la
//  actualización de los recursos en los dispositivos.
// ============================================================================

export const VERSION = '1.2.0';

export const CAMBIOS = [
  {
    version: '1.2.0',
    fecha: '2026-06-28',
    titulo: 'Bonificación, amortización anticipada y gráficos',
    cambios: [
      'Bonificación: compara el coste con y sin los productos vinculados y te dice si compensa contratarlos.',
      'Amortización anticipada: simula aportaciones extra (única, mensual o anual) para reducir cuota o plazo, con comisión, mostrando el ahorro de intereses y tiempo.',
      'Cuadro de amortización mensual completo, además del anual, y exportable a CSV.',
      'Gráficos: evolución del capital pendiente y comparativa de coste entre hipotecas.',
      'Histórico del Euríbor de los últimos meses desde el BCE.',
      'Exportar e importar tus hipotecas en un archivo (copia de seguridad).',
    ],
  },
  {
    version: '1.1.0',
    fecha: '2026-06-28',
    titulo: 'Tramo inicial con TIN especial',
    cambios: [
      'Hipoteca fija: opción de TIN reducido los primeros meses (tipo de entrada).',
      'Hipoteca variable: opción de primer periodo a tipo fijo antes de pasar a Euríbor + diferencial.',
      'Los resultados muestran la cuota de los primeros meses y la del resto del plazo, con su TAE real.',
    ],
  },
  {
    version: '1.0.0',
    fecha: '2026-06-28',
    titulo: 'Primera versión',
    cambios: [
      'Cálculo de hipoteca fija, variable y mixta con el sistema francés de amortización.',
      'Resultados: cuota mensual, intereses totales, total a pagar, coste total y TAE estimada.',
      'Cuadro de amortización con resumen anual.',
      'Escenarios de Euríbor (subidas y bajadas) para hipotecas variables y mixtas.',
      'Impuestos y gastos de compra por comunidad autónoma (ITP/IVA/AJD, notaría, registro y gestoría) y cálculo del ahorro necesario.',
      'Euríbor a 12 meses automático desde el BCE o introducido a mano.',
      'Guardado de hipotecas y comparador lado a lado.',
      'Tema oscuro y claro, con color de acento configurable.',
      'Instalable como app (PWA), funciona sin conexión y guarda los datos de forma persistente.',
    ],
  },
];
