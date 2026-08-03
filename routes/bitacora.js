// routes/bitacora.js - CORREGIDO para SQL Server
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

/**
 * GET - Obtener registros de la bitácora
 * @param {number} limit - Número de registros a obtener (default: 100)
 * @returns {Array} Lista de registros de bitácora
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit } = req.query;
    // ============================================================
    // CORREGIDO: SQL Server no soporta ? para TOP
    // ============================================================
    const limitValue = parseInt(limit) || 100;
    
    // Opción 1: Usar concatenación (más simple)
    const bitacora = await db.queryAll(
      `SELECT TOP ${limitValue} * FROM bitacora ORDER BY id DESC`
    );
    
    // Opción 2: Usar ROW_NUMBER() para mayor flexibilidad (alternativa)
    // const bitacora = await db.queryAll(
    //   `SELECT * FROM (
    //     SELECT *, ROW_NUMBER() OVER (ORDER BY id DESC) as rn 
    //     FROM bitacora
    //   ) t WHERE rn <= ${limitValue}`
    // );
    
    res.json(bitacora);
  } catch (error) {
    console.error('❌ Error obteniendo bitácora:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

module.exports = router;