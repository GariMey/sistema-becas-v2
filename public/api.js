const API = {
  session: null,

  async get(url) {
    const headers = {};
    if (this.session) {
      headers['x-user-email'] = this.session.email;
      headers['x-user-rol'] = this.session.rol;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error de red' }));
      throw new Error(err.error || 'Error del servidor');
    }
    return res.json();
  },

  async post(url, data) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.session) {
      headers['x-user-email'] = this.session.email;
      headers['x-user-rol'] = this.session.rol;
    }
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error de red' }));
      throw new Error(err.error || 'Error del servidor');
    }
    return res.json();
  },

  async put(url, data) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.session) {
      headers['x-user-email'] = this.session.email;
      headers['x-user-rol'] = this.session.rol;
    }
    const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(data) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error de red' }));
      throw new Error(err.error || 'Error del servidor');
    }
    return res.json();
  },

  async del(url) {
    const headers = {};
    if (this.session) {
      headers['x-user-email'] = this.session.email;
      headers['x-user-rol'] = this.session.rol;
    }
    const res = await fetch(url, { method: 'DELETE', headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error de red' }));
      throw new Error(err.error || 'Error del servidor');
    }
    return res.json();
  },

  setSession(s) { this.session = s; },

  // Auth
  login(email, password, twoFactorCode) { return this.post('/api/auth/login', { email, password, twoFactorCode }); },
  registrarUsuario(data) { return this.post('/api/auth/registro', data); },
  recuperacion(email) { return this.post('/api/auth/recuperacion', { email }); },
  resetPassword(token, password) { return this.post('/api/auth/reset-password', { token, password }); },

  // Usuarios
  getUsuarios() { return this.get('/api/usuarios'); },
  crearUsuario(data) { return this.post('/api/usuarios', data); },
  editarUsuario(id, data) { return this.put(`/api/usuarios/${id}`, data); },
  eliminarUsuario(id) { return this.del(`/api/usuarios/${id}`); },
  toggle2FA(id) { return this.put(`/api/usuarios/${id}/toggle-2fa`); },

  // Solicitudes
  getSolicitudes(params) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get('/api/solicitudes' + q);
  },
  getSolicitud(expediente) { return this.get(`/api/solicitudes/${expediente}`); },
  crearSolicitud(data) { return this.post('/api/solicitudes', data); },
  actualizarSolicitud(expediente, data) { return this.put(`/api/solicitudes/${expediente}`, data); },

  // Tipos de beca
  getTiposBeca(activos) { return this.get('/api/tipos-beca' + (activos ? '?activos=true' : '')); },
  crearTipoBeca(data) { return this.post('/api/tipos-beca', data); },
  editarTipoBeca(id, data) { return this.put(`/api/tipos-beca/${id}`, data); },
  toggleTipoBeca(id) { return this.put(`/api/tipos-beca/${id}/toggle`); },
  eliminarTipoBeca(id) { return this.del(`/api/tipos-beca/${id}`); },

  // Convocatorias
  getConvocatorias() { return this.get('/api/convocatorias'); },
  getConvocatoria(id) { return this.get(`/api/convocatorias/${id}`); },
  crearConvocatoria(data) { return this.post('/api/convocatorias', data); },
  publicarConvocatoria(id) { return this.put(`/api/convocatorias/${id}/publicar`); },
  cerrarConvocatoria(id) { return this.put(`/api/convocatorias/${id}/cerrar`); },

  // Noticias
  getNoticias() { return this.get('/api/noticias'); },
  crearNoticia(data) { return this.post('/api/noticias', data); },
  eliminarNoticia(id) { return this.del(`/api/noticias/${id}`); },

  // Justificaciones
  getJustificaciones(estado) { return this.get('/api/justificaciones' + (estado ? `?estado=${estado}` : '')); },
  crearJustificacion(data) { return this.post('/api/justificaciones', data); },
  revisarJustificacion(id, data) { return this.put(`/api/justificaciones/${id}/revisar`, data); },

  // Apelaciones
  getApelaciones() { return this.get('/api/apelaciones'); },
  crearApelacion(data) { return this.post('/api/apelaciones', data); },
  resolverApelacion(expediente, data) { return this.put(`/api/apelaciones/${expediente}/resolver`, data); },

  // Visitas
  getVisitas() { return this.get('/api/visitas'); },
  crearVisita(data) { return this.post('/api/visitas', data); },

  // Suspensiones
  getSuspensiones() { return this.get('/api/suspensiones'); },
  crearSuspension(data) { return this.post('/api/suspensiones', data); },
  restaurarBeca(id) { return this.put(`/api/suspensiones/${id}/restaurar`); },

  // Empleados
  getEmpleados() { return this.get('/api/empleados'); },
  crearEmpleado(data) { return this.post('/api/empleados', data); },
  editarEmpleado(id, data) { return this.put(`/api/empleados/${id}`, data); },
  eliminarEmpleado(id) { return this.del(`/api/empleados/${id}`); },

  // Config
  getConfig() { return this.get('/api/config'); },
  guardarConfig(data) { return this.put('/api/config', data); },

  // Bitácora
  getBitacora(limit) { return this.get('/api/bitacora' + (limit ? `?limit=${limit}` : '')); },

  // Estadísticas
  getEstadisticas() { return this.get('/api/estadisticas'); },

  // Alertas
  getAlertas() { return this.get('/api/alertas'); },
  revisarAlerta(id) { return this.put(`/api/alertas/${id}/revisar`); },

  // Padrón electoral
  consultarPadron(cedula) { return this.get(`/api/padron/${cedula}`); },

  // Núcleo familiar (Fase 2)
  getIntegrantesFamilia(expediente) { return this.get(`/api/integrantes-familia/${expediente}`); }
};
