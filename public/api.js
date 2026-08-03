// api.js - Versión optimizada para Base de Datos (sin respaldos locales engañosos)

const API = {
  session: null,
  dbConnected: false,
  lastSync: null,

  // ============================================================
  // MÉTODOS DE GESTIÓN DE SESIÓN
  // ============================================================

  /**
   * Obtiene la sesión actual, verificando localStorage si es necesario
   * @returns {Object|null} Sesión o null
   */
  getSession() {
    if (this.session) {
      return this.session;
    }
    try {
      const saved = localStorage.getItem('becas_session');
      if (saved) {
        const session = JSON.parse(saved);
        this.session = session;
        return session;
      }
    } catch (e) {
      console.warn('⚠️ API: Error recuperando sesión:', e.message);
    }
    return null;
  },

  /**
   * Obtiene los headers de autenticación
   * @param {string} url - URL opcional para determinar si debe autenticar
   * @returns {Object} Headers con autenticación
   */
  getAuthHeaders(url = '') {
    // Si la URL es de registro, login o recuperación, NO enviamos headers de sesión
    if (url.includes('/auth/registro') || url.includes('/auth/login') || url.includes('/auth/recuperacion')) {
      return {};
    }

    const session = this.getSession();
    const headers = {};
    if (session) {
      headers['x-user-email'] = session.email;
      headers['x-user-rol'] = session.rol;
    }
    return headers;
  },

  // ============================================================
  // MÉTODOS PRINCIPALES
  // ============================================================

  /**
   * Obtiene datos de la API directamente del servidor
   * @param {string} url - URL del endpoint
   * @param {boolean} useBackup - (Opcional) Si debe usar respaldo en caso de error. Por defecto false en BD.
   * @returns {Promise<any>} Datos obtenidos
   */
  async get(url, useBackup = false) {
    const headers = this.getAuthHeaders(url);

    console.log(`📡 GET: ${url}`);

    try {
      const res = await fetch(url, { 
        headers,
        credentials: 'include',
        signal: AbortSignal.timeout(15000) // Aumentado a 15s por si la BD tarda
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          // Si hay 401, limpiamos sesión
          if (!url.includes('/padron')) {
            console.warn('⚠️ 401 detectado, limpiando sesión...');
            this.session = null;
            localStorage.removeItem('becas_session');
          }
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      this.dbConnected = true;
      this.lastSync = new Date().toISOString();
      
      return data;
    } catch (error) {
      console.warn(`⚠️ Error en GET ${url}:`, error.message);
      this.dbConnected = false;
      
      // Solo usamos backup si el desarrollador lo pide explícitamente (useBackup = true)
      // Para BD, preferimos fallar a mostrar datos viejos.
      if (useBackup) {
        const backup = this.getBackup(url);
        if (backup) {
          console.log(`📦 Usando datos de respaldo offline para: ${url}`);
          return backup;
        }
      }
      
      throw error;
    }
  },

  /**
   * Envía datos a la API con POST
   * @param {string} url - URL del endpoint
   * @param {any} data - Datos a enviar
   * @returns {Promise<any>} Respuesta de la API
   */
  async post(url, data) {
    const headers = this.getAuthHeaders(url);
    // Siempre añadir Content-Type para POST
    headers['Content-Type'] = 'application/json';

    console.log(`📡 POST: ${url}`);

    try {
      const res = await fetch(url, { 
        method: 'POST', 
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(15000)
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error de red' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      
      const result = await res.json();
      return result;
    } catch (error) {
      console.error(`❌ Error en POST ${url}:`, error.message);
      throw error;
    }
  },

  /**
   * Actualiza datos con PUT
   * @param {string} url - URL del endpoint
   * @param {any} data - Datos a actualizar
   * @returns {Promise<any>} Respuesta de la API
   */
  async put(url, data) {
    const headers = this.getAuthHeaders(url);
    headers['Content-Type'] = 'application/json';

    console.log(`📡 PUT: ${url}`);

    try {
      const res = await fetch(url, { 
        method: 'PUT', 
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(15000)
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error de red' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      
      const result = await res.json();
      return result;
    } catch (error) {
      console.error(`❌ Error en PUT ${url}:`, error.message);
      throw error;
    }
  },

  /**
   * Elimina datos con DELETE
   * @param {string} url - URL del endpoint
   * @returns {Promise<any>} Respuesta de la API
   */
  async del(url) {
    const headers = this.getAuthHeaders(url);

    console.log(`📡 DELETE: ${url}`);

    try {
      const res = await fetch(url, { 
        method: 'DELETE', 
        headers,
        credentials: 'include',
        signal: AbortSignal.timeout(15000)
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error de red' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      
      const result = await res.json();
      return result;
    } catch (error) {
      console.error(`❌ Error en DELETE ${url}:`, error.message);
      throw error;
    }
  },

  // ============================================================
  // GESTIÓN DE RESPALDOS EN LOCALSTORAGE (MODO SIN CONEXIÓN)
  // ============================================================

  /**
   * Guarda una copia de los datos en localStorage (RARAMENTE USADO EN BD)
   */
  saveBackup(url, data) {
    // Solo guardamos respaldo si es configurado, normalmente evitamos esto en BD
    try {
      const key = this.getBackupKey(url);
      const backup = {
        timestamp: new Date().toISOString(),
        data: data,
        source: 'database'
      };
      localStorage.setItem(key, JSON.stringify(backup));
    } catch (e) { /* ignorar */ }
  },

  /**
   * Obtiene datos de respaldo desde localStorage
   */
  getBackup(url, maxAge = 86400000) {
    try {
      const key = this.getBackupKey(url);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const age = Date.now() - new Date(parsed.timestamp).getTime();
      if (age > maxAge) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  },

  getBackupKey(url) {
    const cleanUrl = url
      .replace(/^\/api\//, '')
      .replace(/[?&][^&]*/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return `backup_${cleanUrl}`;
  },

  // ============================================================
  // VERIFICACIÓN DE CONEXIÓN
  // ============================================================

  async checkConnection() {
    this.getSession();
    try {
      const res = await fetch('/api/health', {
        credentials: 'include',
        signal: AbortSignal.timeout(5000)
      });
      this.dbConnected = res.ok;
      return this.dbConnected;
    } catch (error) {
      this.dbConnected = false;
      return false;
    }
  },

  getConnectionStatus() {
    return {
      connected: this.dbConnected,
      lastSync: this.lastSync,
      mode: this.dbConnected ? 'online' : 'offline'
    };
  },

  // ============================================================
  // SETTER DE SESIÓN
  // ============================================================

  setSession(s) { 
    this.session = s; 
    if (s) {
      localStorage.setItem('becas_session', JSON.stringify(s));
    } else {
      localStorage.removeItem('becas_session');
    }
  },

  // ============================================================
  // ===== MÉTODOS DE NEGOCIO (ENDPOINTS) =====
  // ============================================================

  // ----- AUTENTICACIÓN -----
  login(email, password, twoFactorCode) { 
    return this.post('/api/auth/login', { email, password, twoFactorCode }); 
  },
  
  recuperacion(email) { 
    return this.post('/api/auth/recuperacion', { email }); 
  },

  // ----- USUARIOS -----
  getUsuarios() { 
    console.log('👥 Obteniendo usuarios desde la BD...');
    // ¡CRUCIAL! Le decimos que SIEMPRE consulte al servidor (no use backup)
    return this.get('/api/usuarios', false) 
        .then(data => {
            // Opcional: Podrías guardar una copia local para modo offline,
            // pero si estás en BD, lo ideal es no guardar nada para evitar datos obsoletos.
            return data;
        })
        .catch(err => {
            console.error("❌ Error obteniendo usuarios:", err);
            return []; // Devolvemos array vacío si falla la BD para no romper el Admin
        });
  },
  
  crearUsuario(data) { 
    return this.post('/api/auth/registro', data); 
  },
  
  editarUsuario(id, data) { 
    return this.put(`/api/usuarios/${id}`, data); 
  },
  
  eliminarUsuario(id) { 
    return this.del(`/api/usuarios/${id}`); 
  },
  
  toggle2FA(id) { 
    return this.put(`/api/usuarios/${id}/toggle-2fa`); 
  },

  // ----- SOLICITUDES -----
  getSolicitudes(params) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get('/api/solicitudes' + q);
  },
  
  getSolicitud(expediente) { 
    return this.get(`/api/solicitudes/${expediente}`); 
  },
  
  crearSolicitud(data) { 
    return this.post('/api/solicitudes', data); 
  },
  
  actualizarSolicitud(expediente, data) { 
    return this.put(`/api/solicitudes/${expediente}`, data); 
  },
  
  eliminarSolicitud(expediente) { 
    return this.del(`/api/solicitudes/${expediente}`); 
  },

  // ----- TIPOS DE BECA -----
  getTiposBeca(activos) { 
    return this.get('/api/tipos-beca' + (activos ? '?activos=true' : '')); 
  },
  
  getTipoBeca(id) { 
    return this.get(`/api/tipos-beca/${id}`); 
  },
  
  crearTipoBeca(data) { 
    return this.post('/api/tipos-beca', data); 
  },
  
  editarTipoBeca(id, data) { 
    return this.put(`/api/tipos-beca/${id}`, data); 
  },
  
  toggleTipoBeca(id) { 
    return this.put(`/api/tipos-beca/${id}/toggle`); 
  },
  
  eliminarTipoBeca(id) { 
    return this.del(`/api/tipos-beca/${id}`); 
  },

  // ----- CONVOCATORIAS -----
  getConvocatorias() { 
    return this.get('/api/convocatorias'); 
  },
  
  getConvocatoria(id) { 
    return this.get(`/api/convocatorias/${id}`); 
  },
  
  crearConvocatoria(data) { 
    return this.post('/api/convocatorias', data); 
  },
  
  publicarConvocatoria(id) { 
    return this.put(`/api/convocatorias/${id}/publicar`); 
  },
  
  cerrarConvocatoria(id) { 
    return this.put(`/api/convocatorias/${id}/cerrar`); 
  },
  
  notificarConvocatoria(id) { 
    return this.post(`/api/convocatorias/${id}/notificar`); 
  },

  // ----- NOTICIAS -----
  getNoticias() { 
    return this.get('/api/noticias'); 
  },
  
  getNoticia(id) { 
    return this.get(`/api/noticias/${id}`); 
  },
  
  crearNoticia(data) { 
    return this.post('/api/noticias', data); 
  },
  
  eliminarNoticia(id) { 
    return this.del(`/api/noticias/${id}`); 
  },
  
  enviarNoticiaEmail(data) { 
    return this.post('/api/noticias/enviar-email', data); 
  },

  // ----- JUSTIFICACIONES -----
  getJustificaciones(estado) { 
    return this.get('/api/justificaciones' + (estado ? `?estado=${estado}` : '')); 
  },
  
  crearJustificacion(data) { 
    return this.post('/api/justificaciones', data); 
  },
  
  revisarJustificacion(id, data) { 
    return this.put(`/api/justificaciones/${id}/revisar`, data); 
  },

  // ----- APELACIONES -----
  getApelaciones() { 
    return this.get('/api/apelaciones'); 
  },
  
  crearApelacion(data) { 
    return this.post('/api/apelaciones', data); 
  },
  
  resolverApelacion(expediente, data) { 
    return this.put(`/api/apelaciones/${expediente}/resolver`, data); 
  },

  // ----- VISITAS -----
  getVisitas() { 
    return this.get('/api/visitas'); 
  },
  
  getVisitasByExpediente(expediente) { 
    return this.get(`/api/visitas/expediente/${expediente}`); 
  },
  
  crearVisita(data) { 
    return this.post('/api/visitas', data); 
  },
  
  actualizarVisita(id, data) { 
    return this.put(`/api/visitas/${id}`, data); 
  },
  
  eliminarVisita(id) { 
    return this.del(`/api/visitas/${id}`); 
  },
  
  getEstadisticasVisitas() { 
    return this.get('/api/visitas/estadisticas'); 
  },

  // ----- SUSPENSIONES -----
  getSuspensiones() { 
    return this.get('/api/suspensiones'); 
  },
  
  getSuspensionesByEstudiante(email) { 
    return this.get(`/api/suspensiones/estudiante/${email}`); 
  },
  
  crearSuspension(data) { 
    return this.post('/api/suspensiones', data); 
  },
  
  restaurarBeca(id) { 
    return this.put(`/api/suspensiones/${id}/restaurar`); 
  },
  
  eliminarSuspension(id) { 
    return this.del(`/api/suspensiones/${id}`); 
  },

  // ----- EMPLEADOS -----
  getEmpleados() { 
    return this.get('/api/empleados'); 
  },
  
  crearEmpleado(data) { 
    return this.post('/api/empleados', data); 
  },
  
  editarEmpleado(id, data) { 
    return this.put(`/api/empleados/${id}`, data); 
  },
  
  eliminarEmpleado(id) { 
    return this.del(`/api/empleados/${id}`); 
  },

  // ----- CONFIGURACIÓN -----
  getConfig() { 
    return this.get('/api/config'); 
  },
  
  guardarConfig(data) { 
    return this.put('/api/config', data); 
  },

  // ----- BITÁCORA -----
  getBitacora(limit) { 
    return this.get('/api/bitacora' + (limit ? `?limit=${limit}` : '')); 
  },

  // ----- ESTADÍSTICAS -----
  getEstadisticas() { 
    return this.get('/api/estadisticas'); 
  },

  // ----- ALERTAS -----
  getAlertas() { 
    return this.get('/api/alertas'); 
  },
  
  revisarAlerta(id) { 
    return this.put(`/api/alertas/${id}/revisar`); 
  },

  // ----- CHATBOT -----
  getChatbotPreguntas() { 
    return this.get('/api/chatbot'); 
  },
  
  buscarChatbot(q) { 
    return this.get(`/api/chatbot/buscar?q=${encodeURIComponent(q)}`); 
  },
  
  crearPreguntaChatbot(data) { 
    return this.post('/api/chatbot', data); 
  },
  
  actualizarPreguntaChatbot(id, data) { 
    return this.put(`/api/chatbot/${id}`, data); 
  },
  
  eliminarPreguntaChatbot(id) { 
    return this.del(`/api/chatbot/${id}`); 
  },

  // ----- SESIONES -----
  getSesionesActivas() { 
    return this.get('/api/sesiones'); 
  },
  
  cerrarSesionActiva(id) { 
    return this.del(`/api/sesiones/${id}`); 
  },

  // ----- VOTACIONES -----
  getVotacionesPendientes() { 
    return this.get('/api/votaciones/pendientes'); 
  },
  
  getVotosByExpediente(expediente) { 
    return this.get(`/api/votaciones/${expediente}`); 
  },
  
  registrarVoto(data) { 
    return this.post('/api/votaciones', data); 
  },

  // ----- INFORMES -----
  getInforme(tipo, generado_por) { 
    return this.get(`/api/informes/${tipo}?generado_por=${generado_por || ''}`); 
  },
  
  getHistorialInformes() { 
    return this.get('/api/informes'); 
  },

  // ----- DOCUMENTOS -----
  getDocumento(id) { 
    return this.get(`/api/documentos/${id}`); 
  },
  
  getDocumentoBase64(id) { 
    return this.get(`/api/documentos/base64/${id}`); 
  },
  
  subirDocumento(data) { 
    return this.post('/api/documentos/subir', data); 
  },
  
  revisarDocumento(expediente, docKey, data) { 
    return this.put(`/api/documentos/revisar/${expediente}/${docKey}`, data); 
  }
};

// ============================================================
// EXPORTAR PARA USO EN OTROS ARCHIVOS
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}

if (typeof window !== 'undefined') {
  window.API = API;
}

// ============================================================
// INICIALIZACIÓN AUTOMÁTICA
// ============================================================

if (typeof window !== 'undefined') {
  console.log('🔄 API: Inicializando...');
  
  try {
    const saved = localStorage.getItem('becas_session');
    if (saved) {
      API.session = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('⚠️ API: Error al recuperar sesión inicial:', e.message);
  }
}

// ============================================================
// FUNCIONES DE UTILIDAD PARA INICIALIZACIÓN
// ============================================================

/**
 * Inicializa la API con la sesión guardada
 * @returns {Promise<Object>} Estado de la conexión
 */
async function initAPI() {
  console.log('🔧 initAPI - Inicializando...');
  
  try {
    const saved = localStorage.getItem('becas_session');
    if (saved) {
      API.session = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('⚠️ No se pudo recuperar la sesión:', e.message);
  }

  const connected = await API.checkConnection();

  // NOTA: Eliminamos la sincronización masiva (syncAll) porque ahora trabajamos con BD
  // El panel de Admin ya consultará la BD cuando sea necesario.
  if (connected) {
    console.log('🟢 Conectado a la base de datos');
  } else {
    console.log('🟡 Modo offline - sin conexión a la BD');
  }

  return {
    connected,
    mode: connected ? 'online' : 'offline',
    lastSync: API.lastSync
  };
}

// Exportar función de inicialización
if (typeof window !== 'undefined') {
  window.initAPI = initAPI;
}