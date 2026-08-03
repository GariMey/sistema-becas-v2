// utils/helpers.js - Funciones de utilidad

/**
 * Genera un número de expediente
 */
function generarExpediente() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `BEC-${year}-${random}`;
}

/**
 * Formatea una fecha para mostrar
 */
function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Valida un correo electrónico
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Valida una cédula costarricense
 */
function isValidCedula(cedula) {
  const cleaned = cedula.replace(/\D/g, '');
  if (cleaned.length < 9) return false;
  return true;
}

/**
 * Calcula el porcentaje de pobreza
 */
function calcularPobreza(datos) {
  try {
    const ingreso = parseFloat(datos.ingresoFamiliar) || 0;
    const dependientes = parseInt(datos.dependientes) || 0;
    const totalPersonas = 1 + dependientes;

    if (totalPersonas === 0 || ingreso === 0) return null;

    const ingresoPerCapita = ingreso / totalPersonas;
    const salarioMinimo = 350000;
    const porcentajeSalarioMinimo = (ingresoPerCapita / salarioMinimo) * 100;

    let pobreza = 0;
    if (porcentajeSalarioMinimo < 30) {
      pobreza = 85 + (30 - porcentajeSalarioMinimo) / 30 * 15;
    } else if (porcentajeSalarioMinimo < 50) {
      pobreza = 70 + (50 - porcentajeSalarioMinimo) / 20 * 15;
    } else if (porcentajeSalarioMinimo < 75) {
      pobreza = 50 + (75 - porcentajeSalarioMinimo) / 25 * 20;
    } else if (porcentajeSalarioMinimo < 100) {
      pobreza = 30 + (100 - porcentajeSalarioMinimo) / 25 * 20;
    } else {
      pobreza = Math.max(5, 30 - (porcentajeSalarioMinimo - 100) / 200 * 25);
    }

    return Math.min(100, Math.max(0, pobreza));
  } catch (e) {
    console.error('Error calculando pobreza:', e);
    return null;
  }
}

/**
 * Obtiene el estado de una solicitud con su descripción
 */
function getEstadoInfo(estado) {
  const estados = {
    'Enviada': {
      label: '📨 Enviada',
      desc: 'Tu solicitud ha sido enviada correctamente.',
      color: 'info',
      progreso: 10
    },
    'En revisión TS': {
      label: '🔍 En revisión TS',
      desc: 'El trabajador social está revisando tu documentación.',
      color: 'info',
      progreso: 25
    },
    'Pendiente subsanación': {
      label: '📝 Pendiente subsanación',
      desc: 'Faltan documentos o información. Revisa la pestaña de subsanación.',
      color: 'warning',
      progreso: 30
    },
    'Elegible': {
      label: '✅ Elegible',
      desc: 'Tu solicitud ha pasado la revisión del trabajador social.',
      color: 'success',
      progreso: 50
    },
    'En comité': {
      label: '📊 En comité',
      desc: 'El comité de becas está evaluando tu solicitud.',
      color: 'info',
      progreso: 60
    },
    'En Apelación': {
      label: '⚖️ En Apelación',
      desc: 'Has apelado la decisión. Está en revisión.',
      color: 'warning',
      progreso: 70
    },
    'Aprobada': {
      label: '🎉 Aprobada',
      desc: '¡Felicidades! Tu beca ha sido aprobada.',
      color: 'success',
      progreso: 85
    },
    'Beneficio Activo': {
      label: '🌟 Beneficio Activo',
      desc: 'Tu beca está activa. Los descuentos se aplicarán en tu matrícula.',
      color: 'success',
      progreso: 100
    },
    'Rechazada': {
      label: '❌ Rechazada',
      desc: 'Tu solicitud ha sido rechazada. Puedes apelar la decisión.',
      color: 'danger',
      progreso: 100
    },
    'Rechazado Definitivo': {
      label: '⛔ Rechazado Definitivo',
      desc: 'Tu solicitud ha sido rechazada de forma definitiva.',
      color: 'danger',
      progreso: 100
    },
    'Suspendida': {
      label: '⏸️ Suspendida',
      desc: 'Tu beca ha sido suspendida temporalmente.',
      color: 'warning',
      progreso: 80
    },
    'Cancelada': {
      label: '🚫 Cancelada',
      desc: 'Tu beca ha sido cancelada definitivamente.',
      color: 'danger',
      progreso: 100
    },
    'Restaurada': {
      label: '🔄 Restaurada',
      desc: 'Tu beca ha sido restaurada.',
      color: 'success',
      progreso: 100
    },
    'No elegible': {
      label: '⚠️ No elegible',
      desc: 'No cumples con los requisitos mínimos para esta beca.',
      color: 'danger',
      progreso: 100
    },
    'Visita pendiente': {
      label: '🏠 Visita pendiente',
      desc: 'Se requiere una visita domiciliaria para continuar.',
      color: 'warning',
      progreso: 40
    }
  };

  return estados[estado] || {
    label: estado,
    desc: 'Estado desconocido',
    color: 'neutral',
    progreso: 0
  };
}

module.exports = {
  generarExpediente,
  formatDate,
  isValidEmail,
  isValidCedula,
  calcularPobreza,
  getEstadoInfo
};