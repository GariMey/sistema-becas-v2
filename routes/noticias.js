// routes/noticias.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { enviarNotificacionEmail } = require('./emailService');

// GET - Obtener todas las noticias
router.get('/', async (req, res) => {
  try {
    const noticias = await db.queryAll('SELECT * FROM noticias ORDER BY id DESC');
    res.json(noticias);
  } catch (error) {
    console.error('Error obteniendo noticias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET - Obtener una noticia por ID
router.get('/:id', async (req, res) => {
  try {
    const noticia = await db.queryOne('SELECT * FROM noticias WHERE id = ?', [req.params.id]);
    if (!noticia) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }
    res.json(noticia);
  } catch (error) {
    console.error('Error obteniendo noticia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST - Crear o editar noticia
router.post('/', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { titulo, contenido, idEdicion } = req.body;
    
    if (!titulo || !contenido) {
      return res.status(400).json({ error: 'Título y contenido son requeridos' });
    }

    const fecha = new Date().toLocaleDateString();
    const fechaNow = new Date().toLocaleString();

    if (idEdicion) {
      // Editar noticia existente
      await db.queryRun(
        'UPDATE noticias SET titulo=?, contenido=?, fecha_edicion=? WHERE id=?',
        [titulo, contenido, fecha, idEdicion]
      );
      
      await db.queryRun(
        'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
        [fechaNow, req.user.email, req.user.rol, 'Noticia editada', '—']
      );
      
      res.json({ message: 'Noticia actualizada' });
    } else {
      // Crear nueva noticia
      const result = await db.queryRun(
        'INSERT INTO noticias (titulo, contenido, fecha) VALUES (?, ?, ?)',
        [titulo, contenido, fecha]
      );
      
      await db.queryRun(
        'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
        [fechaNow, req.user.email, req.user.rol, 'Noticia publicada', '—']
      );

      // ✅ ENVIAR NOTIFICACIÓN POR CORREO A TODOS LOS ESTUDIANTES
      try {
        // Obtener todos los estudiantes
        const estudiantes = await db.queryAll(
          'SELECT email, nombre FROM usuarios WHERE rol = ? AND email IS NOT NULL',
          ['estudiante']
        );

        if (estudiantes.length > 0) {
          let exitos = 0;
          let fallos = 0;

          for (const est of estudiantes) {
            try {
              const resultEmail = await enviarNotificacionEmail('nueva_noticia', {
                email: est.email,
                nombre: est.nombre || 'Estudiante',
                titulo: titulo,
                contenido: contenido,
                fecha: fecha
              });
              
              if (resultEmail.success) {
                exitos++;
              } else {
                fallos++;
              }
            } catch (error) {
              console.error(`❌ Error enviando a ${est.email}:`, error);
              fallos++;
            }
          }

          console.log(`📧 Notificación de noticia enviada a ${exitos} estudiantes (${fallos} fallos)`);

          // Registrar en bitácora el envío masivo
          await db.queryRun(
            'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
            [fechaNow, req.user.email, req.user.rol, `Noticia enviada por email a ${exitos} estudiantes`, '—']
          );
        } else {
          console.log('ℹ️ No hay estudiantes registrados para notificar');
        }
      } catch (error) {
        console.error('⚠️ Error enviando notificaciones de noticia:', error);
        // No fallamos la operación principal, solo registramos el error
      }
      
      res.json({ 
        id: result.lastInsertRowid, 
        message: 'Noticia publicada y notificada a los estudiantes'
      });
    }
  } catch (error) {
    console.error('Error creando noticia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE - Eliminar noticia
router.delete('/:id', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    // Obtener la noticia antes de eliminarla (para bitácora)
    const noticia = await db.queryOne('SELECT titulo FROM noticias WHERE id = ?', [req.params.id]);
    
    await db.queryRun('DELETE FROM noticias WHERE id = ?', [req.params.id]);
    
    const fecha = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fecha, req.user.email, req.user.rol, `Noticia eliminada: ${noticia?.titulo || 'ID:' + req.params.id}`, '—']
    );
    
    res.json({ message: 'Noticia eliminada' });
  } catch (error) {
    console.error('Error eliminando noticia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ NUEVO: Enviar noticia solo por correo (sin publicar en el sistema)
router.post('/enviar-email', authMiddleware, requireRole('trabajador_social'), async (req, res) => {
  try {
    const { titulo, contenido, destinatarios } = req.body;
    
    if (!titulo || !contenido) {
      return res.status(400).json({ error: 'Título y contenido son requeridos' });
    }

    let estudiantes = [];
    
    if (destinatarios && destinatarios.length > 0) {
      // Enviar a destinatarios específicos
      for (const email of destinatarios) {
        estudiantes.push({ email, nombre: email });
      }
    } else {
      // Enviar a todos los estudiantes
      estudiantes = await db.queryAll(
        'SELECT email, nombre FROM usuarios WHERE rol = ? AND email IS NOT NULL',
        ['estudiante']
      );
    }

    if (estudiantes.length === 0) {
      return res.status(404).json({ error: 'No hay estudiantes para notificar' });
    }

    const fecha = new Date().toLocaleDateString();
    let exitos = 0;
    let fallos = 0;
    const errores = [];

    for (const est of estudiantes) {
      try {
        const result = await enviarNotificacionEmail('nueva_noticia', {
          email: est.email,
          nombre: est.nombre || 'Estudiante',
          titulo: titulo,
          contenido: contenido,
          fecha: fecha
        });
        
        if (result.success) {
          exitos++;
        } else {
          fallos++;
          errores.push({ email: est.email, error: result.error });
        }
      } catch (error) {
        console.error(`❌ Error enviando a ${est.email}:`, error);
        fallos++;
        errores.push({ email: est.email, error: error.message });
      }
    }

    const fechaNow = new Date().toLocaleString();
    await db.queryRun(
      'INSERT INTO bitacora (fecha, usuario, rol, accion, expediente) VALUES (?, ?, ?, ?, ?)',
      [fechaNow, req.user.email, req.user.rol, `Email masivo enviado: ${titulo} (${exitos} exitosos)`, '—']
    );

    res.json({
      message: 'Correos enviados',
      total: estudiantes.length,
      exitos: exitos,
      fallos: fallos,
      errores: errores.slice(0, 10) // Solo los primeros 10 errores
    });
  } catch (error) {
    console.error('Error enviando emails:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;