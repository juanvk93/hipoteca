// ============================================================================
//  changelog.js · Versión de la app e historial de cambios
// ----------------------------------------------------------------------------
//  Al publicar una versión: añade una entrada arriba, actualiza VERSION y sube
//  la versión de caché del service worker (CACHE en sw.js) para forzar la
//  actualización de los recursos en los dispositivos.
// ============================================================================

export const VERSION = '1.0.0';

export const CAMBIOS = [
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
