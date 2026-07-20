const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const solicitudes = await db.queryAll('SELECT estado FROM solicitudes');

    const aprobadas = solicitudes.filter(s => ['Aprobada', 'Beneficio Activo', 'Restaurada'].includes(s.estado)).length;
    const rechazadas = solicitudes.filter(s => ['Rechazada', 'Rechazado Definitivo', 'No elegible', 'Cancelada'].includes(s.estado)).length;
    const estadosFinales = ['Aprobada', 'Beneficio Activo', 'Restaurada', 'Rechazada', 'Rechazado Definitivo', 'No elegible', 'Cerrada', 'Cancelada', 'Suspendida'];
    const enProceso = solicitudes.filter(s => !estadosFinales.includes(s.estado)).length;
    const total = solicitudes.length;

    res.json({ aprobadas, rechazadas, enProceso, total });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;