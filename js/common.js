// public/js/common.js
// Utilidades compartidas por TODAS las páginas (index.html y las 5 páginas de rol).
// Incluye: claves de localStorage, cliente API, mapeadores, helpers de UI
// (modales/toasts), sesión, notificaciones y el expediente compartido.

const SECRET_KEY = 'Becas2026Key';

const STORAGE_KEYS = {
 usuarios: 'becas_usuarios',
 tipos: 'becas_tipos',
 solicitudes: 'becas_solicitudes',
 noticias: 'becas_noticias',
 justificaciones: 'becas_justificaciones',
 suspensiones: 'becas_suspensiones',
 config: 'becas_config',
 session: 'becas_session',
 bitacora: 'becas_bitacora',
 borrador: 'becas_borrador_solicitud',
 visitas: 'becas_visitas',
 convocatorias: 'becas_convocatorias',
 apelaciones: 'becas_apelaciones',
 empleados: 'becas_empleados',
 alertasSeguridad: 'becas_alertas_seguridad'
};

const API_BASE = window.location.origin + '/api';

// Mapa de rol -> archivo HTML propio (separación real por rol, ítem pedido por Ziu)
const ROLE_PAGES = {
 estudiante: 'estudiante.html',
 aspirante: 'estudiante.html',
 trabajador_social: 'trabajador-social.html',
 comite: 'comite.html',
 admin: 'admin.html',
 auditor: 'auditor.html'
};

// Guardia de sesión: cada página de rol la llama al inicio. Si no hay sesión
// o el rol no corresponde a esta página, redirige al inicio.
function requireSession(rolesPermitidos){
 const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null');
 if(!session || !rolesPermitidos.includes(session.rol)){
 window.location.href = 'index.html';
 return null;
 }
 API.setSession(session);
 return session;
}

// Arranque común a todas las páginas: prueba conexión a la API, siembra datos
// de respaldo en localStorage si hace falta, y sincroniza tipos de beca.
async function inicializarBase(){
 const dbOnline = await probarConexionDB();
 initData();
 if (dbOnline) {
 try {
 const tiposAPI = await API.getTiposBeca();
 if (tiposAPI && tiposAPI.length > 0) {
 const tiposLocal = tiposAPI.map(t => ({
 id: t.id, nombre: t.nombre, icon: t.icon || '', desc: t.description || '',
 min: t.min_pct || 25, max: t.max_pct || 100, rubros: t.rubros || [],
 requisitos: t.requisitos || [], activo: !!t.activo,
 camposPersonalizados: t.camposPersonalizados || []
 }));
 localStorage.setItem(STORAGE_KEYS.tipos, JSON.stringify(tiposLocal));
 }
 } catch (e) {
 console.warn('No se pudieron sincronizar tipos de beca desde la API:', e);
 }
 }
 const storedSession = localStorage.getItem(STORAGE_KEYS.session);
 if(storedSession) API.setSession(JSON.parse(storedSession));
 registrarBitacora('Visita al sitio', '—');
 return dbOnline;
}

// Encabezado simple para las páginas de rol (campanita + sesión + salir).
// index.html tiene su propio renderHeaderNav() más completo (login/registro).
function renderHeaderRol(session){
 const badge = document.getElementById('notif-badge');
 const bell = document.getElementById('btn-notificaciones');
 if(bell) bell.onclick = toggleDropdownNotificaciones;
 actualizarBadgeNotificaciones();
 const nombreEl = document.getElementById('header-nombre');
 const rolEl = document.getElementById('header-rol');
 if(nombreEl) nombreEl.textContent = session.nombre;
 if(rolEl) rolEl.textContent = rolLabel(session.rol);
}

let expedienteActual = null;

function actualizarStatusDB(online) {
 const el = document.getElementById('db-status');
 if (!el) return;
 if (online) {
 el.className = 'online';
 el.textContent = ' Conectado';
 } else {
 el.className = 'offline';
 el.textContent = ' Sin conexión';
 }
}

async function probarConexionDB() {
 try {
 const res = await fetch(API_BASE + '/tipos-beca');
 if (res.ok) {
 actualizarStatusDB(true);
 return true;
 } else {
 throw new Error('Respuesta no exitosa');
 }
 } catch (e) {
 console.warn(' No se pudo conectar a la API. Usando localStorage.', e);
 actualizarStatusDB(false);
 return false;
 }
}

const API = {
 session: null,
 // Tiempo máximo de espera por petición: sin esto, si el servidor no
 // responde, la promesa queda colgada indefinidamente y el usuario ve
 // "Cargando..." para siempre en vez de un mensaje claro y un reintento.
 TIMEOUT_MS: 12000,

 async request(method, url, data) {
 const headers = { 'Content-Type': 'application/json' };
 if (this.session) {
 headers['x-user-email'] = this.session.email;
 headers['x-user-rol'] = this.session.rol;
 }
 const opts = { method, headers };
 if (data) opts.body = JSON.stringify(data);

 const controller = new AbortController();
 const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
 opts.signal = controller.signal;

 try {
 const res = await fetch(url, opts);
 if (!res.ok) {
 const err = await res.json().catch(() => ({ error: 'Error de red' }));
 throw new Error(err.error || 'Error del servidor');
 }
 return res.json();
 } catch (e) {
 const mensaje = e.name === 'AbortError' ? 'El servidor tardó demasiado en responder (tiempo de espera agotado).' : e.message;
 console.warn(' API falló, usando localStorage:', mensaje);
 throw new Error(mensaje);
 } finally {
 clearTimeout(timer);
 }
 },

 get(url) { return this.request('GET', url); },
 post(url, data) { return this.request('POST', url, data); },
 put(url, data) { return this.request('PUT', url, data); },
 del(url) { return this.request('DELETE', url); },

 setSession(s) { this.session = s; },

 // Auth
 login(email, password, twoFactorCode) { return this.post(API_BASE + '/auth/login', { email, password, twoFactorCode }); },
 registrarUsuario(data) { return this.post(API_BASE + '/auth/registro', data); },
 recuperacion(email) { return this.post(API_BASE + '/auth/recuperacion', { email }); },
 resetPassword(token, password) { return this.post(API_BASE + '/auth/reset-password', { token, password }); },
 consultarTSE(cedula) { return this.get(API_BASE + `/tse/${cedula}`); },

 // Usuarios
 getUsuarios() { return this.get(API_BASE + '/usuarios'); },
 getMiPerfil() { return this.get(API_BASE + '/usuarios/me'); },
 crearUsuario(data) { return this.post(API_BASE + '/usuarios', data); },
 editarUsuario(id, data) { return this.put(API_BASE + `/usuarios/${id}`, data); },
 eliminarUsuario(id) { return this.del(API_BASE + `/usuarios/${id}`); },
 toggle2FA(id) { return this.put(API_BASE + `/usuarios/${id}/toggle-2fa`); },

 // Solicitudes
 getSolicitudes(params) {
 const q = params ? '?' + new URLSearchParams(params).toString() : '';
 return this.get(API_BASE + '/solicitudes' + q);
 },
 getSolicitud(expediente) { return this.get(API_BASE + `/solicitudes/${expediente}`); },
 getAnalisisExpediente(expediente) { return this.get(API_BASE + `/solicitudes/${expediente}/analisis`); },
 analizarDocumentoIA(docId) { return this.post(API_BASE + `/analisis-ia/${docId}`); },
 crearSolicitud(data) { return this.post(API_BASE + '/solicitudes', data); },
 actualizarSolicitud(expediente, data) { return this.put(API_BASE + `/solicitudes/${expediente}`, data); },

 // Tipos de beca
 getTiposBeca(activos) { return this.get(API_BASE + '/tipos-beca' + (activos ? '?activos=true' : '')); },
 crearTipoBeca(data) { return this.post(API_BASE + '/tipos-beca', data); },
 editarTipoBeca(id, data) { return this.put(API_BASE + `/tipos-beca/${id}`, data); },
 toggleTipoBeca(id) { return this.put(API_BASE + `/tipos-beca/${id}/toggle`); },
 eliminarTipoBeca(id) { return this.del(API_BASE + `/tipos-beca/${id}`); },

 // Convocatorias
 getConvocatorias() { return this.get(API_BASE + '/convocatorias'); },
 crearConvocatoria(data) { return this.post(API_BASE + '/convocatorias', data); },
 publicarConvocatoria(id) { return this.put(API_BASE + `/convocatorias/${id}/publicar`); },
 cerrarConvocatoria(id) { return this.put(API_BASE + `/convocatorias/${id}/cerrar`); },

 // Noticias
 getNoticias() { return this.get(API_BASE + '/noticias'); },
 crearNoticia(data) { return this.post(API_BASE + '/noticias', data); },
 eliminarNoticia(id) { return this.del(API_BASE + `/noticias/${id}`); },

 // Justificaciones
 getJustificaciones(estado) { return this.get(API_BASE + '/justificaciones' + (estado ? `?estado=${estado}` : '')); },
 crearJustificacion(data) { return this.post(API_BASE + '/justificaciones', data); },
 revisarJustificacion(id, data) { return this.put(API_BASE + `/justificaciones/${id}/revisar`, data); },

 // Apelaciones
 getApelaciones() { return this.get(API_BASE + '/apelaciones'); },
 crearApelacion(data) { return this.post(API_BASE + '/apelaciones', data); },
 resolverApelacion(expediente, data) { return this.put(API_BASE + `/apelaciones/${expediente}/resolver`, data); },

 // Visitas
 getVisitas() { return this.get(API_BASE + '/visitas'); },
 getVisitasPorExpediente(expediente) { return this.get(API_BASE + `/visitas/expediente/${expediente}`); },
 crearVisita(data) { return this.post(API_BASE + '/visitas', data); },

 // Suspensiones
 getSuspensiones() { return this.get(API_BASE + '/suspensiones'); },
 restaurarSuspension(id) { return this.put(API_BASE + `/suspensiones/${id}/restaurar`); },
 crearSuspension(data) { return this.post(API_BASE + '/suspensiones', data); },
 restaurarBeca(id) { return this.put(API_BASE + `/suspensiones/${id}/restaurar`); },

 // Empleados
 getEmpleados() { return this.get(API_BASE + '/empleados'); },
 crearEmpleado(data) { return this.post(API_BASE + '/empleados', data); },
 editarEmpleado(id, data) { return this.put(API_BASE + `/empleados/${id}`, data); },
 eliminarEmpleado(id) { return this.del(API_BASE + `/empleados/${id}`); },

 // Config
 getConfig() { return this.get(API_BASE + '/config'); },
 guardarConfig(data) { return this.put(API_BASE + '/config', data); },

 // Bitácora
 getBitacora(opts) {
 if (typeof opts === 'number' || !opts) {
 return this.get(API_BASE + '/bitacora' + (opts ? `?limit=${opts}` : ''));
 }
 const params = new URLSearchParams();
 Object.entries(opts).forEach(([k, v]) => { if (v) params.set(k, v); });
 const qs = params.toString();
 return this.get(API_BASE + '/bitacora' + (qs ? `?${qs}` : ''));
 },

 // Estadísticas
 getEstadisticas() { return this.get(API_BASE + '/estadisticas'); },

 // Alertas
 getAlertas() { return this.get(API_BASE + '/alertas'); },
 buscarChatbot(q) { return this.get(API_BASE + `/chatbot/buscar?q=${encodeURIComponent(q)}`); },
 getChatbotPreguntas() { return this.get(API_BASE + '/chatbot'); },
 crearPreguntaChatbot(data) { return this.post(API_BASE + '/chatbot', data); },
 editarPreguntaChatbot(id, data) { return this.put(API_BASE + `/chatbot/${id}`, data); },
 eliminarPreguntaChatbot(id) { return this.del(API_BASE + `/chatbot/${id}`); },
 revisarAlerta(id) { return this.put(API_BASE + `/alertas/${id}/revisar`); },

 // Padrón electoral
 consultarPadron(cedula) { return this.get(API_BASE + `/padron/${cedula}`); },

 // Núcleo familiar (Fase 2)
 getIntegrantesFamilia(expediente) { return this.get(API_BASE + `/integrantes-familia/${expediente}`); },

 // Notificaciones (Fase 5)
 getNotificaciones() { return this.get(API_BASE + '/notificaciones'); },
 crearNotificacion(data) { return this.post(API_BASE + '/notificaciones', data); },
 marcarNotificacionLeida(id) { return this.put(API_BASE + `/notificaciones/${id}/leida`); },
 marcarTodasNotificacionesLeidas() { return this.put(API_BASE + '/notificaciones/marcar-todas-leidas'); },

 // Votación del comité (Fase 6)
 getVotos(expediente) { return this.get(API_BASE + `/votaciones/${expediente}`); },
 votar(data) { return this.post(API_BASE + '/votaciones', data); }
};

// ==================== MAPEADORES API ->MODELO FRONTEND ====================
// La base de datos usa snake_case (estudiante_email, tipo_beca, etc.)
// pero todo el frontend ya está escrito esperando camelCase. Estas funciones
// traducen las filas que vienen de la API al mismo formato que localStorage
// usaba, para no tener que reescribir cada función de render.

function mapSolicitudAPI(s){
 return {
 id: s.id,
 expediente: s.expediente,
 fecha: s.fecha,
 estudianteEmail: s.estudiante_email,
 nombres: s.nombres,
 apellidos: s.apellidos,
 cedula: s.cedula,
 correo: s.correo,
 telefono: s.telefono,
 tipoBeca: s.tipo_beca,
 estado: s.estado,
 progreso: s.progreso,
 puntaje: s.puntaje,
 promedio: s.promedio,
 ingresoFamiliar: s.ingreso_familiar,
 ingresoPercapita: s.ingreso_percapita,
 datosCompletos: s.datos_completos || {},
 documentos: s.documentos || {},
 aceptado: !!s.aceptado,
 porcentajeCobertura: s.porcentaje_cobertura,
 observacionTS: s.observacion_ts,
 observacionesComite: s.observaciones_comite,
 motivoRechazo: s.motivo_rechazo,
 suspensionMotivo: s.suspension_motivo,
 suspensionObservaciones: s.suspension_observaciones,
 suspensionFecha: s.suspension_fecha,
 restauradoFecha: s.restaurado_fecha
 };
}

function mapApelacionAPI(a){
 return {
 id: a.id,
 expediente: a.expediente,
 email: a.email,
 nombreEstudiante: a.nombre_estudiante,
 motivo: a.motivo,
 estado: a.estado,
 fecha: a.fecha,
 decision: a.decision,
 archivo: a.archivo,
 tipoBeca: a.tipo_beca
 };
}

function mapJustificacionAPI(j){
 return {
 id: j.id,
 email: j.estudiante_email,
 nombreEstudiante: j.nombre_estudiante,
 curso: j.curso,
 codigo: j.codigo,
 periodo: j.periodo,
 nota: j.nota,
 motivo: j.motivo,
 estado: j.estado,
 observacion: j.observacion,
 fecha: j.fecha,
 archivo: j.archivo
 };
}

// ==================== FALLBACK: LOCALSTORAGE ====================
// Si la API falla, usamos los datos de localStorage (igual que en coreccionbecas.html)
// Para simplificar, reutilizamos las funciones originales de coreccionbecas.html

const TIPOS_BECA_DEFAULT = [
 { id:1, nombre:'Socioeconómica', icon:'', desc:'Apoyo financiero para estudiantes con recursos limitados', min:25, max:100, rubros:['Matrícula','Aranceles','Materiales'], requisitos:['Promedio mínimo 80','Ingreso familiar máximo 2 salarios mínimos','Constancia de ingresos','Recibo de servicios públicos'], activo:true, camposPersonalizados: [] },
 { id:2, nombre:'Excelencia Académica', icon:'', desc:'Para estudiantes con promedio destacado', min:50, max:100, rubros:['Matrícula','Aranceles'], requisitos:['Promedio mínimo 90','Sin sanciones disciplinarias','Carga mínima 12 créditos','Carta de recomendación'], activo:true, camposPersonalizados: [
 { id:'f-publicaciones', label:'Publicaciones o investigaciones', type:'textarea', placeholder:'Lista de publicaciones o investigaciones realizadas' },
 { id:'f-proyectos', label:'Proyectos de investigación', type:'textarea', placeholder:'Proyectos de investigación en los que ha participado' }
 ] },
 { id:3, nombre:'Deportiva', icon:'', desc:'Para estudiantes con alto rendimiento deportivo', min:25, max:75, rubros:['Matrícula'], requisitos:['Promedio mínimo 80','Representación universitaria','Carta de la coordinación deportiva','Participación activa'], activo:true, camposPersonalizados: [
 { id:'f-deporte', label:'Deporte que practica', type:'text', placeholder:'Ej: Natación, Fútbol' },
 { id:'f-nivel-deporte', label:'Nivel de competencia', type:'select', options:['Local','Regional','Nacional','Internacional'] },
 { id:'f-logros-deportivos', label:'Logros deportivos', type:'textarea', placeholder:'Principales logros y reconocimientos' }
 ] },
 { id:4, nombre:'Cultural', icon:'', desc:'Artes, música, teatro', min:25, max:75, rubros:['Matrícula'], requisitos:['Promedio mínimo 80','Portafolio artístico','Carta de la coordinación cultural','Participación en actividades'], activo:true, camposPersonalizados: [
 { id:'f-disciplina', label:'Disciplina artística', type:'text', placeholder:'Ej: Teatro, Música, Danza' },
 { id:'f-portafolio', label:'Descripción del portafolio artístico', type:'textarea', placeholder:'Describa su portafolio artístico' }
 ] },
 { id:5, nombre:'Discapacidad', icon:'', desc:'Apoyo para estudiantes con discapacidad certificada', min:50, max:100, rubros:['Matrícula','Aranceles','Materiales','Transporte'], requisitos:['Promedio mínimo 80','Certificado médico vigente','Constancia de ingresos','Informe de necesidades especiales'], activo:true, camposPersonalizados: [
 { id:'f-tipo-discapacidad', label:'Tipo de discapacidad', type:'text', placeholder:'Ej: Motora, Visual, Auditiva' },
 { id:'f-requiere-adaptacion', label:'¿Requiere adaptaciones curriculares?', type:'select', options:['No','Sí'] }
 ] },
 { id:6, nombre:'Investigación', icon:'', desc:'Para asistentes de investigación', min:25, max:75, rubros:['Matrícula','Estipendio'], requisitos:['Promedio mínimo 85','Proyecto de investigación activo','Carta del director del proyecto','Disponibilidad horaria'], activo:true, camposPersonalizados: [
 { id:'f-area-investigacion', label:'Área de investigación', type:'text', placeholder:'Ej: Biología Molecular, Inteligencia Artificial' },
 { id:'f-proyecto-investigacion', label:'Nombre del proyecto', type:'text', placeholder:'Nombre del proyecto de investigación' }
 ] }
];

function getTiposBecaLocal(){
 let tipos = JSON.parse(localStorage.getItem(STORAGE_KEYS.tipos) || 'null');
 if(!tipos){ tipos = TIPOS_BECA_DEFAULT; localStorage.setItem(STORAGE_KEYS.tipos, JSON.stringify(tipos)); }
 return tipos;
}

function guardarTiposBecaLocal(tipos){ localStorage.setItem(STORAGE_KEYS.tipos, JSON.stringify(tipos)); }

function getTiposBecaActivosLocal(){ return getTiposBecaLocal().filter(t => t.activo); }

function cifrarPassword(pwd){ return CryptoJS.AES.encrypt(pwd, SECRET_KEY).toString(); }

function descifrarPassword(encrypted){
 try{ return CryptoJS.AES.decrypt(encrypted, SECRET_KEY).toString(CryptoJS.enc.Utf8); }catch(e){ return null; }
}

function rolLabel(rol){ return {estudiante:'Estudiante', aspirante:'Aspirante', trabajador_social:'Trab. Social', comite:'Comité', admin:'Administrador', auditor:'Auditor'}[rol] || rol; }

function badgeClassEstado(estado){
 if(estado === 'Aprobada' || estado === 'Beneficio Activo' || estado === 'Elegible' || estado === 'Restaurada') return 'badge-success';
 if(estado === 'Rechazada' || estado === 'No elegible' || estado === 'Rechazado Definitivo' || estado === 'Cancelada' || estado === 'Suspendida') return 'badge-danger';
 if(estado === 'Pendiente subsanación' || estado === 'En revisión TS') return 'badge-warning';
 if(estado === 'En comité' || estado === 'Enviada' || estado === 'En Apelación' || estado === 'Visita TS') return 'badge-info';
 if(estado === 'Bloqueada (beneficio activo)') return 'badge-neutral';
 return 'badge-neutral';
}

function formatBytes(bytes){
 if(!bytes) return '';
 if(bytes < 1024) return `${bytes} B`;
 if(bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
 return `${(bytes/(1024*1024)).toFixed(1)} MB`;
}

// Redimensiona y comprime una imagen antes de guardarla -- una foto de
// celular puede pesar 4-8MB, que además de ser lenta de subir, hace que el
// análisis con IA (OCR) tarde tanto que el servidor termina en timeout.
function comprimirImagenSiHaceFalta(file){
  return new Promise((resolve) => {
    if(!file.type.startsWith('image/') || file.size < 700 * 1024){
      const reader = new FileReader();
      reader.onload = () => resolve({ datos: reader.result, tamano: file.size, tipo: file.type });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxAncho = 1600;
      const escala = Math.min(1, maxAncho / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if(!blob){ resolve(null); return; }
        const reader = new FileReader();
        reader.onload = () => resolve({ datos: reader.result, tamano: blob.size, tipo: 'image/jpeg' });
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.82);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function openModal(id){ document.getElementById(id).classList.remove('hidden'); }

async function verDocumento(id, nombre){
 try {
 const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null');
 const headers = {};
 if(session){ headers['x-user-email'] = session.email; headers['x-user-rol'] = session.rol; }
 const res = await fetch(`/api/documentos/${id}`, { headers });
 if(!res.ok){
 let mensaje = `Error del servidor (HTTP ${res.status})`;
 try { const cuerpo = await res.json(); if(cuerpo && cuerpo.error) mensaje = cuerpo.error; } catch(e2){ /* la respuesta no era JSON, se deja el mensaje genérico */ }
 throw new Error(mensaje);
 }
 const blob = await res.blob();
 const url = URL.createObjectURL(blob);
 window.open(url, '_blank');
 setTimeout(() =>URL.revokeObjectURL(url), 60000);
 } catch (e) {
 console.warn(' No se pudo abrir el documento:', e.message);
 notify(' No se pudo abrir el documento: ' + e.message);
 }
}

async function analizarDocumentoIA(docId, btnEl){
 const contenedor = document.getElementById(`ia-resultado-${docId}`);
 if(!contenedor) return;

 const textoOriginal = btnEl ? btnEl.textContent : '';
 if(btnEl){ btnEl.disabled = true; btnEl.textContent = 'Analizando...'; }
 contenedor.innerHTML = '<p style="color:var(--muted);font-size:0.82rem;margin-top:6px;">Enviando documento al servicio de IA (puede tardar unos segundos, sobre todo si aplica OCR)...</p>';

 try {
 const resultado = await API.analizarDocumentoIA(docId);

 const colorEstado = {
 APROBADO: 'badge-success',
 APROBADO_CON_OBSERVACIONES: 'badge-warning',
 REVISION_REQUERIDA: 'badge-warning',
 RECHAZADO: 'badge-danger'
 }[resultado.estado] || 'badge-neutral';

 const listaHallazgos = (titulo, items, icono) => !items || items.length === 0 ? '' : `<div style="margin-top:4px;"><strong>${icono} ${titulo}:</strong>
 <ul style="margin:2px 0 0 18px;">${items.map(i => `<li>${i.message}</li>`).join('')}</ul>
 </div>`;

 const campos = resultado.campos_extraidos && Object.keys(resultado.campos_extraidos).length > 0
 ? `<div style="margin-top:4px;"><strong>Datos extraídos:</strong> ${Object.entries(resultado.campos_extraidos).map(([k,v]) => `<span class="badge badge-neutral" style="margin:2px;">${k}: ${v}</span>`).join('')}</div>`: '';

 const cedulaInfo = resultado.cedula_coincide === false
 ? `<p style="color:var(--danger);font-size:0.82rem;margin-top:4px;">La cédula detectada (${resultado.cedula_detectada}) no coincide con la del estudiante.</p>`: '';

 contenedor.innerHTML = `<div class="alert-box" style="margin-top:8px;font-size:0.85rem;">
 <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
 <strong style="display:flex;align-items:center;gap:4px;"><i data-lucide="bot" style="width:15px;height:15px;"></i> Resultado de la IA:</strong>
 <span class="badge ${colorEstado}">${resultado.estado}</span>
 <span class="badge badge-neutral">Puntaje: ${resultado.puntaje}/100 (${resultado.banda_puntaje})</span>
 <span class="badge badge-neutral">Tipo detectado: ${resultado.tipo_documento}</span>
 </div>
 ${cedulaInfo}
 ${listaHallazgos('Errores', resultado.errores, '')}
 ${listaHallazgos('Advertencias', resultado.advertencias, '')}
 ${listaHallazgos('Observaciones', resultado.observaciones, '')}
 ${campos}
 </div>`;
      if(window.lucide) lucide.createIcons();
 } catch (e) {
 contenedor.innerHTML = `<p style="color:var(--danger);font-size:0.82rem;margin-top:6px;">No se pudo analizar: ${e.message}</p>`;
 } finally {
 if(btnEl){ btnEl.disabled = false; btnEl.textContent = textoOriginal || ' Analizar con IA'; }
 }
}

function closeModal(id){ document.getElementById(id).classList.add('hidden'); }

function showToast(message, type){
 type = type || 'info';
 let container = document.getElementById('toast-container');
 if(!container){
 container = document.createElement('div');
 container.id = 'toast-container';
 document.body.appendChild(container);
 }
 const colors = {
 success: { bg:'#e7f5ee', border:'#b9e3cb', color:'#1e7e4f', icon:'check-circle' },
 error: { bg:'#fdecea', border:'#f6c6c0', color:'#c0392b', icon:'x-circle' },
 warning: { bg:'#fff3cd', border:'#ffeaa7', color:'#b07d12', icon:'alert-triangle' },
 info: { bg:'#e6effa', border:'#b8d0e8', color:'#1a365d', icon:'info' }
 };
 const c = colors[type] || colors.info;
 const toast = document.createElement('div');
 toast.className = 'toast-box';
 toast.style.background = c.bg;
 toast.style.border = `1px solid ${c.border}`;
 toast.style.color = c.color;
 toast.innerHTML = `<span class="toast-icon"><i data-lucide="${c.icon}" style="width:18px;height:18px;"></i></span><span style="flex:1;">${message}</span><button class="toast-close" aria-label="Cerrar">×</button>`;
 container.appendChild(toast);
 if(window.lucide) lucide.createIcons();
 const remove = () => {
 toast.style.transition = 'opacity .3s ease, transform .3s ease';
 toast.style.opacity = '0';
 toast.style.transform = 'translateX(24px)';
 setTimeout(() => toast.remove(), 300);
 };
 toast.querySelector('.toast-close').addEventListener('click', remove);
 setTimeout(remove, 4500);
}

// Sustituto directo de notify(): detecta el tipo de mensaje por su emoji/palabras
// clave (el código ya usa para éxito y para advertencias de forma consistente).

function notify(message){
 let type = 'info';
 if(/^|correctamente|guardad[oa]|creado|actualizad|aprobad|activad[oa]|restaurad|public|enviad/i.test(message)) type = 'success';
 else if(/^|obligatori|debe tener|no existe|no se encontr|no hay|error|incompleto|complete|seleccion/i.test(message)) type = 'warning';
 else if(/^/.test(message)) type = 'info';
 showToast(message, type);
}

// Sustituto de confirm(): devuelve una Promise<boolean>

function customConfirm(message){
 return new Promise((resolve) => {
 const modal = document.getElementById('modal-custom-confirm');
 document.getElementById('custom-confirm-message').textContent = message;
 modal.classList.remove('hidden');
 const okBtn = document.getElementById('custom-confirm-ok');
 const cancelBtn = document.getElementById('custom-confirm-cancel');
 const cleanup = (result) => {
 modal.classList.add('hidden');
 okBtn.removeEventListener('click', onOk);
 cancelBtn.removeEventListener('click', onCancel);
 resolve(result);
 };
 const onOk = () => cleanup(true);
 const onCancel = () => cleanup(false);
 okBtn.addEventListener('click', onOk);
 cancelBtn.addEventListener('click', onCancel);
 });
}

// Sustituto de prompt(): recibe un array de campos [{id, label, type, value, options}]
// y devuelve una Promise que resuelve a un objeto {id: valor, ...} o null si se cancela.

function customPrompt(titulo, fields){
 return new Promise((resolve) => {
 const modal = document.getElementById('modal-custom-prompt');
 document.getElementById('cp-titulo').textContent = titulo;
 const fieldsContainer = document.getElementById('cp-fields');
 fieldsContainer.innerHTML = fields.map(f => {
 const val = (f.value !== undefined && f.value !== null) ? f.value : '';
 if(f.type === 'select'){
 return `<div class="form-field"><label>${f.label}</label><select id="cp-${f.id}" class="form-control">${f.options.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
 }
 if(f.type === 'textarea'){
 return `<div class="form-field"><label>${f.label}</label><textarea id="cp-${f.id}" class="form-control" rows="3">${val}</textarea></div>`;
 }
 return `<div class="form-field"><label>${f.label}</label><input type="${f.type || 'text'}" id="cp-${f.id}" class="form-control" value="${val}"></div>`;
 }).join('');
 modal.classList.remove('hidden');

 const okBtn = document.getElementById('cp-ok');
 const cancelBtn = document.getElementById('cp-cancel');
 const closeBtn = document.getElementById('cp-close');

 const cleanup = (result) => {
 modal.classList.add('hidden');
 okBtn.removeEventListener('click', onOk);
 cancelBtn.removeEventListener('click', onCancel);
 closeBtn.removeEventListener('click', onCancel);
 resolve(result);
 };
 const onOk = () => {
 const result = {};
 fields.forEach(f => { result[f.id] = document.getElementById(`cp-${f.id}`).value; });
 cleanup(result);
 };
 const onCancel = () => cleanup(null);

 okBtn.addEventListener('click', onOk);
 cancelBtn.addEventListener('click', onCancel);
 closeBtn.addEventListener('click', onCancel);
 });
}

function logout(){
 const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null');
 if(session) registrarBitacora('Cierre de sesión', '—', session);
 localStorage.removeItem(STORAGE_KEYS.session);
 window.location.href = 'index.html';
}

function registrarBitacora(accion, expediente, sessionOverride){
 const session = sessionOverride || JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null');
 const entrada = { fecha: new Date().toLocaleString(), usuario: session ? session.nombre : 'Visitante', rol: session ? session.rol : 'visitante', accion: accion, expediente: expediente || '—' };
 const bitacora = JSON.parse(localStorage.getItem(STORAGE_KEYS.bitacora) || '[]');
 bitacora.unshift(entrada);
 localStorage.setItem(STORAGE_KEYS.bitacora, JSON.stringify(bitacora));
 return entrada;
}

function simularNotificacion(titulo, mensaje, expediente){
 registrarBitacora(`Notificación: ${titulo} - ${mensaje.substring(0,50)}`, expediente);

 // Persistir de verdad para el destinatario real (Fase 5). Si el expediente
 // pertenece a otro usuario, el backend resuelve quién debe recibirla.
 const tipo = /aprobad|activo|restaurad|revocad|corregid/i.test(titulo) ? 'success'
 : /rechazad|suspendid|cancelad|no elegible/i.test(titulo) ? 'danger'
 : /subsanaci[oó]n|correcci[oó]n|requerid/i.test(titulo) ? 'warning'
 : 'info';
 API.crearNotificacion({ titulo, mensaje, tipo, expediente })
 .then(() => actualizarBadgeNotificaciones())
 .catch(e => console.warn(' No se pudo persistir la notificación:', e.message));

 const notifModal = document.getElementById('modal-notificacion');
 if(notifModal){
 document.getElementById('notif-titulo').textContent = titulo;
 document.getElementById('notif-mensaje').innerHTML = mensaje;
 openModal('modal-notificacion');
 }
}

async function actualizarBadgeNotificaciones(){
 const badge = document.getElementById('notif-badge');
 if(!badge) return;
 try {
 const notificaciones = await API.getNotificaciones();
 const noLeidas = notificaciones.filter(n => !n.leida).length;
 badge.textContent = noLeidas > 9 ? '9+' : String(noLeidas);
 badge.classList.toggle('hidden', noLeidas === 0);
 } catch(e){
 badge.classList.add('hidden');
 }
}

async function toggleDropdownNotificaciones(){
 const existente = document.getElementById('notif-dropdown');
 if(existente){ existente.remove(); return; }

 const btn = document.getElementById('btn-notificaciones');
 const dd = document.createElement('div');
 dd.id = 'notif-dropdown';
 dd.className = 'notif-dropdown';
 dd.innerHTML = '<div style="padding:14px;color:var(--muted);">Cargando...</div>';
 document.body.appendChild(dd);
 const rect = btn.getBoundingClientRect();
 dd.style.top = (window.scrollY + rect.bottom + 8) + 'px';
 dd.style.right = (window.innerWidth - rect.right) + 'px';

 try {
 const notificaciones = await API.getNotificaciones();
 const colores = { success:'#1e7e4f', danger:'#c0392b', warning:'#b07d12', info:'#1a365d' };
 dd.innerHTML = `<div class="notif-dropdown-header">
 <strong>Notificaciones</strong>
 ${notificaciones.some(n=>!n.leida) ? '<button type="button" onclick="marcarTodasNotifLeidas()">Marcar todas leídas</button>' : ''}
 </div>
 <div class="notif-dropdown-list">
 ${notificaciones.length === 0 ? '<p style="padding:14px;color:var(--muted);">Sin notificaciones.</p>' : notificaciones.map(n => `<div class="notif-item ${n.leida ? '' : 'no-leida'}" style="border-left-color:${colores[n.tipo]||colores.info};" onclick="marcarNotifLeida(${n.id}, this)">
 <div class="notif-item-title">${n.titulo}</div>
 <div class="notif-item-msg">${n.mensaje || ''}</div>
 <div class="notif-item-fecha">${new Date(n.created_at).toLocaleString('es-CR')}</div>
 </div>
 `).join('')}
 </div>`;
 } catch(e){
 dd.innerHTML = '<div style="padding:14px;color:var(--danger);">No se pudieron cargar las notificaciones.</div>';
 }
}
document.addEventListener('click', (e) => {
 const dd = document.getElementById('notif-dropdown');
 if(dd && !dd.contains(e.target) && !e.target.closest('#btn-notificaciones')) dd.remove();
});

async function marcarNotifLeida(id, el){
 try { await API.marcarNotificacionLeida(id); el.classList.remove('no-leida'); actualizarBadgeNotificaciones(); } catch(e){}
}

async function marcarTodasNotifLeidas(){
 try { await API.marcarTodasNotificacionesLeidas(); document.getElementById('notif-dropdown')?.remove(); actualizarBadgeNotificaciones(); } catch(e){}
}

function renderExpedienteCompleto(solicitud, opciones){
 opciones = opciones || {};
 const d = solicitud.datosCompletos || {};
 const docs = solicitud.documentos || {};

 const campo = (label, valor) => `<p><strong>${label}:</strong> ${ (valor === undefined || valor === null || valor === '') ? '<span style="color:var(--muted);">No registrado</span>' : valor }</p>`;

 let html = '';

 html += `<div class="expediente-section">
 <h4>Estado del expediente</h4>
 <div class="expediente-grid">
 ${campo('N° Expediente', solicitud.expediente)}
 ${campo('Estado actual', `<span class="badge ${badgeClassEstado(solicitud.estado)}">${solicitud.estado}</span>`)}
 ${campo('Fecha de solicitud', solicitud.fecha)}
 ${campo('Tipo de beca', solicitud.tipoBeca)}
 ${campo('Progreso', `${solicitud.progreso || 0}%`)}
 ${campo('Puntaje total', solicitud.puntaje !== undefined ? `${solicitud.puntaje} pts` : '')}
 </div>
 </div>`;

 html += `<div class="expediente-section">
 <h4>Información Personal</h4>
 <div class="expediente-grid">
 ${campo('Nombres', solicitud.nombres)}
 ${campo('Apellidos', solicitud.apellidos)}
 ${campo('Cédula', solicitud.cedula)}
 ${campo('Correo', solicitud.correo || solicitud.estudianteEmail)}
 ${campo('Teléfono', d['f-telefono'] || solicitud.telefono)}
 ${campo('Fecha de nacimiento', d['f-nacimiento'])}
 </div>
 ${d['f-direccion'] ? `<p style="margin-top:6px;"><strong>Dirección:</strong> ${d['f-direccion']}</p>` : ''}
 </div>`;

 html += `<div class="expediente-section">
 <h4>Información Académica</h4>
 <div class="expediente-grid">
 ${campo('Carrera', d['f-carrera'])}
 ${campo('Sede', d['f-sede'])}
 ${campo('Facultad', d['f-facultad'])}
 ${campo('Año de ingreso', d['f-anio'])}
 ${campo('Promedio ponderado', solicitud.promedio)}
 ${campo('Avance curricular', d['f-avance'] ? `${d['f-avance']}%` : '')}
 </div>
 </div>`;

 html += `<div class="expediente-section">
 <h4>Información Socioeconómica</h4>
 <div class="expediente-grid">
 ${campo('Ingreso familiar mensual', `₡${(solicitud.ingresoFamiliar || 0).toLocaleString()}`)}
 ${campo('Ingreso per cápita del hogar', solicitud.ingresoPercapita !== undefined && solicitud.ingresoPercapita !== null ? `₡${Number(solicitud.ingresoPercapita).toLocaleString('es-CR',{maximumFractionDigits:0})}` : '')}
 ${campo('Dependientes económicos', d['f-dependientes'])}
 ${campo('Miembros que trabajan', d['f-trabajadores'])}
 ${campo('Tipo de vivienda', d['f-vivienda'])}
 ${campo('Gastos mensuales aprox.', d['f-gastos'] ? `₡${parseFloat(d['f-gastos']).toLocaleString()}` : '')}
 ${campo('Situación laboral', d['f-laboral'])}
 ${campo('¿Posee discapacidad?', d['f-discapacidad'])}
 </div>
 </div>`;

 html += `<div class="expediente-section">
 <h4>Núcleo familiar (personas que viven con el estudiante)</h4>
 <div id="expediente-nucleo-familiar-${solicitud.expediente}">Cargando...</div>
 </div>`;
 setTimeout(() => cargarNucleoFamiliarExpediente(solicitud.expediente), 0);

 html += `<div class="expediente-section">
 <h4>Información Complementaria</h4>
 ${d['f-extracurricular'] ? `<p><strong>Actividades extracurriculares:</strong> ${d['f-extracurricular']}</p>` : ''}
 ${d['f-premios'] ? `<p><strong>Premios o reconocimientos:</strong> ${d['f-premios']}</p>` : ''}
 ${campo('¿Beca anterior?', d['f-beca-anterior'])}
 <p style="margin-top:6px;"><strong>Justificación de mérito:</strong><br>${d['f-merito'] || 'No disponible'}</p>
 ${d['f-motivacion'] ? `<p style="margin-top:6px;"><strong>Carta de motivación:</strong><br>${d['f-motivacion']}</p>` : ''}
 ${d['f-publicaciones'] ? `<p><strong>Publicaciones:</strong> ${d['f-publicaciones']}</p>` : ''}
 ${d['f-proyectos'] ? `<p><strong>Proyectos de investigación:</strong> ${d['f-proyectos']}</p>` : ''}
 ${d['f-deporte'] ? `<p><strong>Deporte:</strong> ${d['f-deporte']}</p>` : ''}
 ${d['f-nivel-deporte'] ? `<p><strong>Nivel de competencia:</strong> ${d['f-nivel-deporte']}</p>` : ''}
 ${d['f-logros-deportivos'] ? `<p><strong>Logros deportivos:</strong> ${d['f-logros-deportivos']}</p>` : ''}
 ${d['f-disciplina'] ? `<p><strong>Disciplina artística:</strong> ${d['f-disciplina']}</p>` : ''}
 ${d['f-portafolio'] ? `<p><strong>Portafolio artístico:</strong> ${d['f-portafolio']}</p>` : ''}
 ${d['f-tipo-discapacidad'] ? `<p><strong>Tipo de discapacidad:</strong> ${d['f-tipo-discapacidad']}</p>` : ''}
 ${d['f-requiere-adaptacion'] ? `<p><strong>¿Requiere adaptaciones curriculares?</strong> ${d['f-requiere-adaptacion']}</p>` : ''}
 ${d['f-area-investigacion'] ? `<p><strong>Área de investigación:</strong> ${d['f-area-investigacion']}</p>` : ''}
 ${d['f-proyecto-investigacion'] ? `<p><strong>Proyecto de investigación:</strong> ${d['f-proyecto-investigacion']}</p>` : ''}
 </div>`;

 const docKeys = Object.keys(docs);
 html += `<div class="expediente-section">
 <h4>Documentos adjuntos</h4>
 ${docKeys.length === 0 ? '<p style="color:var(--muted);font-size:0.9rem;">El estudiante no ha adjuntado documentos.</p>' : `<div class="doc-list">
 ${docKeys.map(key => {
 const doc = docs[key];
 const estadoDoc = doc.estado || 'Pendiente';
 const badgeDoc = estadoDoc === 'Aprobado' ? 'badge-success' : (estadoDoc === 'Rechazado' ? 'badge-danger' : (estadoDoc === 'Corrección solicitada' ? 'badge-warning' : 'badge-neutral'));
 return `<div class="doc-item">
 <div class="doc-item-info">
 <span class="doc-item-icon"><i data-lucide="file-text"></i></span>
 <div>
 <div><strong>${doc.label || key}</strong></div>
 <div class="doc-item-meta">${doc.nombre || ''} ${doc.tamano ? '· ' + formatBytes(doc.tamano) : ''}</div>
 ${doc.observacion ? `<div class="doc-item-meta">${doc.observacion}</div>` : ''}
 </div>
 </div>
 <div class="doc-item-actions">
 <span class="badge ${badgeDoc}">${estadoDoc}</span>
 ${doc.datos ? `<a class="btn btn-small" href="${doc.datos}" download="${doc.nombre || key}" target="_blank">Ver</a>` : (doc.id ? `<button class="btn btn-small" onclick="verDocumento(${doc.id}, '${(doc.nombre || key).replace(/'/g,"")}')">Ver</button>` : '')}
 ${opciones.permitirRevision ? `<button class="btn btn-success" style="padding:6px 10px;font-size:0.78rem;" onclick="revisarDocumento('${solicitud.expediente}','${key}','Aprobado')" title="Aprobar"><i data-lucide="check" style="width:14px;height:14px;"></i></button>
 <button class="btn btn-danger" style="padding:6px 10px;font-size:0.78rem;" onclick="abrirObservacionDocumento('${solicitud.expediente}','${key}','Rechazado')" title="Rechazar"><i data-lucide="x" style="width:14px;height:14px;"></i></button>
 <button class="btn btn-warning" style="padding:6px 10px;font-size:0.78rem;" onclick="abrirObservacionDocumento('${solicitud.expediente}','${key}','Corrección solicitada')">Corregir</button>
 ${doc.id ? `<button class="btn btn-ia" style="padding:6px 10px;font-size:0.78rem;" onclick="analizarDocumentoIA(${doc.id}, this)"><i data-lucide="bot" style="width:14px;height:14px;"></i> Analizar con IA</button>` : ''}
 ` : ''}
 </div>
 ${opciones.permitirRevision && doc.id ? `<div class="ia-resultado" id="ia-resultado-${doc.id}"></div>` : ''}
 </div>`;
 }).join('')}
 </div>`}
 </div>`;

 html += `<div class="expediente-section">
 <h4>Observaciones del Trabajador Social</h4>
 <p>${solicitud.observacionTS || 'Sin observaciones registradas.'}</p>
 </div>`;

 if(solicitud.observacionesComite || solicitud.porcentajeCobertura){
 html += `<div class="expediente-section">
 <h4>Resolución del Comité</h4>
 <div class="expediente-grid">
 ${campo('Porcentaje otorgado', solicitud.porcentajeCobertura)}
 ${campo('Beneficio aceptado', solicitud.aceptado ? 'Sí' : 'No')}
 </div>
 ${solicitud.observacionesComite ? `<p style="margin-top:6px;"><strong>Observaciones del comité:</strong><br>${solicitud.observacionesComite}</p>` : ''}
 </div>`;
 }
 
 if(solicitud.motivoRechazo){
 html += `<div class="expediente-section">
 <h4>Motivo del Rechazo</h4>
 <p style="color:var(--danger);">${solicitud.motivoRechazo}</p>
 </div>
 `;
 }

 return html;
}

async function cargarNucleoFamiliarExpediente(expediente){
 const cont = document.getElementById(`expediente-nucleo-familiar-${expediente}`);
 if(!cont) return; // la vista ya cambió antes de que respondiera la API
 try {
 const integrantes = await API.getIntegrantesFamilia(expediente);
 if(!integrantes || integrantes.length === 0){
 cont.innerHTML = '<p style="color:var(--muted);">El estudiante no registró personas adicionales viviendo con él/ella.</p>';
 return;
 }
 // Tarjetas en vez de una tabla ancha de 8 columnas -- con 1-3 personas
 // (el caso normal), una tabla así queda apretada y los encabezados se
 // cortan. Esto reutiliza el mismo estilo que el resto del expediente.
 const campoMini = (label, valor) => `<span style="margin-right:16px;"><strong>${label}:</strong> ${valor}</span>`;
 cont.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;">
 ${integrantes.map((p, i) => `<div style="border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:12px 14px;">
 <div style="font-weight:700;margin-bottom:6px;">${i+1}. ${p.nombre_completo || 'Sin nombre'}</div>
 <div style="display:flex;flex-wrap:wrap;gap:4px 0;font-size:0.92rem;">
 ${campoMini('Edad', p.edad ?? '—')}
 ${campoMini('Estudia', p.estudia ? 'Sí' : 'No')}
 ${campoMini('Trabaja', p.trabaja ? 'Sí' : 'No')}
 ${p.trabaja ? campoMini('Salario', '₡' + Number(p.salario_mensual || 0).toLocaleString('es-CR')) : ''}
 ${campoMini('Transporte propio', p.tiene_transporte ? 'Sí' : 'No')}
 ${campoMini('Casa propia', p.casa_propia ? 'Sí' : 'No')}
 ${campoMini('Vivienda a su nombre', p.vivienda_nombre_propio ? 'Sí' : 'No')}
 </div>
 </div>
 `).join('')}
 </div>
 <button class="btn btn-ia" style="margin-top:10px;font-size:0.82rem;padding:6px 12px;" onclick="copiarNucleoFamiliarTexto('${expediente}', this)"><i data-lucide="clipboard" style="width:14px;height:14px;"></i> Copiar como texto</button>`;
    if(window.lucide) lucide.createIcons();

 // Guardamos los datos en el propio botón (dataset) para armar el texto
 // sin volver a pedirle nada a la API.
 cont.dataset.integrantes = JSON.stringify(integrantes);
 } catch(e){
 console.warn(' No se pudo cargar el núcleo familiar:', e.message);
 cont.innerHTML = '<p style="color:var(--muted);">No se pudo cargar el núcleo familiar.</p>';
 }
}

// Arma un resumen en texto plano del núcleo familiar y lo copia al
// portapapeles -- útil para pegarlo en un correo, un acta, o un documento
// aparte sin depender de generar un PDF.
function copiarNucleoFamiliarTexto(expediente, btnEl){
 const cont = document.getElementById(`expediente-nucleo-familiar-${expediente}`);
 const integrantes = JSON.parse(cont?.dataset?.integrantes || '[]');
 if(integrantes.length === 0) return;

 let texto = `Núcleo familiar — Expediente ${expediente}\n\n`;
 integrantes.forEach((p, i) => {
 texto += `${i+1}. ${p.nombre_completo || 'Sin nombre'}\n`;
 texto += ` Edad: ${p.edad ?? '—'} | Estudia: ${p.estudia ? 'Sí' : 'No'} | Trabaja: ${p.trabaja ? 'Sí' : 'No'}`;
 texto += p.trabaja ? ` | Salario: ₡${Number(p.salario_mensual || 0).toLocaleString('es-CR')}\n` : '\n';
 texto += ` Transporte propio: ${p.tiene_transporte ? 'Sí' : 'No'} | Casa propia: ${p.casa_propia ? 'Sí' : 'No'} | Vivienda a su nombre: ${p.vivienda_nombre_propio ? 'Sí' : 'No'}\n\n`;
 });

 navigator.clipboard.writeText(texto).then(() => {
 const textoOriginal = btnEl.textContent;
 btnEl.textContent = ' Copiado';
 setTimeout(() => { btnEl.textContent = textoOriginal; }, 2000);
 }).catch(() => notify(' No se pudo copiar al portapapeles'));
}

function showDashTab(prefix, tabId, btn){
 const dashId = prefix === 'est' ? 'estudiante' : (prefix === 'soc' ? 'social' : 'admin');
 const tabs = document.querySelectorAll(`#view-dash-${dashId} .dash-tab`);
 if(tabs) tabs.forEach(t => t.classList.remove('active'));
 const activeTab = document.getElementById(tabId);
 if(activeTab) activeTab.classList.add('active');
 if(btn){ 
 const navItems = btn.closest('.dash-sidebar')?.querySelectorAll('.dash-nav-item');
 if(navItems) navItems.forEach(b => b.classList.remove('active')); 
 btn.classList.add('active'); 
 }
 if(tabId === 'soc-estadisticas') {
 actualizarEstadisticas();
 actualizarGrafico();
 }
 if(tabId === 'soc-apelaciones') {
 renderApelaciones();
 }
 if(tabId === 'soc-justificaciones') {
 renderJustificacionesTS();
 }
 if(tabId === 'adm-empleados') {
 renderEmpleados();
 }
 if(tabId === 'adm-chatbot') {
 renderChatbotPreguntas();
 }
 if(tabId === 'est-apelar') {
 const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.session));
 if(session) renderApelacionesEstudiante(session);
 }
}

function initData(){
 if(!localStorage.getItem(STORAGE_KEYS.usuarios)){
 localStorage.setItem(STORAGE_KEYS.usuarios, JSON.stringify([
 {email:'estudiante@becas.com', password:cifrarPassword('123456'), rol:'estudiante', nombre:'María Gómez', intentos:0, bloqueado:false, twoFactorEnabled:false},
 {email:'estudiante2@becas.com', password:cifrarPassword('123456'), rol:'estudiante', nombre:'José Ramírez', intentos:0, bloqueado:false, twoFactorEnabled:false},
 {email:'estudiante3@becas.com', password:cifrarPassword('123456'), rol:'estudiante', nombre:'Ana López', intentos:0, bloqueado:false, twoFactorEnabled:false},
 {email:'social@becas.com', password:cifrarPassword('123456'), rol:'trabajador_social', nombre:'Carlos Rodríguez', intentos:0, bloqueado:false, twoFactorEnabled:false},
 {email:'comite@becas.com', password:cifrarPassword('123456'), rol:'comite', nombre:'Dra. Ana Méndez', intentos:0, bloqueado:false, twoFactorEnabled:false},
 {email:'admin@becas.com', password:cifrarPassword('123456'), rol:'admin', nombre:'Admin Sistema', intentos:0, bloqueado:false, twoFactorEnabled:false},
 {email:'auditor@becas.com', password:cifrarPassword('123456'), rol:'auditor', nombre:'Luis Fernández', intentos:0, bloqueado:false, twoFactorEnabled:false}
 ]));
 }
 if(!localStorage.getItem(STORAGE_KEYS.solicitudes)){
 const docsEjemplo = (overrides) =>Object.assign({
 'f-cedula-f': { label:'Copia de cédula (frontal)', nombre:'cedula_frontal.pdf', tipo:'application/pdf', tamano:184320, fecha:'2026-01-10T10:00:00.000Z', datos:null, estado:'Aprobado' },
 'f-cedula-p': { label:'Copia de cédula (posterior)', nombre:'cedula_posterior.pdf', tipo:'application/pdf', tamano:179200, fecha:'2026-01-10T10:00:00.000Z', datos:null, estado:'Aprobado' },
 'f-constancia': { label:'Constancia de ingresos familiares', nombre:'constancia_ingresos.pdf', tipo:'application/pdf', tamano:245760, fecha:'2026-01-10T10:00:00.000Z', datos:null, estado:'Aprobado' },
 'f-recibo': { label:'Recibo de servicios públicos reciente', nombre:'recibo_servicios.pdf', tipo:'application/pdf', tamano:158720, fecha:'2026-01-10T10:00:00.000Z', datos:null, estado:'Aprobado' },
 'f-historial': { label:'Historial académico (PDF, máx 5MB)', nombre:'historial_academico.pdf', tipo:'application/pdf', tamano:312000, fecha:'2026-01-10T10:00:00.000Z', datos:null, estado:'Aprobado' }
 }, overrides || {});

 localStorage.setItem(STORAGE_KEYS.solicitudes, JSON.stringify([
 {expediente:'BEC-2026-001', fecha:'2026-01-15', estudianteEmail:'estudiante@becas.com', nombres:'María', apellidos:'Gómez', cedula:'1-2345-6789', correo:'estudiante@becas.com', telefono:'8888-1111', tipoBeca:'Excelencia Académica', estado:'Beneficio Activo', progreso:100, puntaje:95, promedio:92, ingresoFamiliar:450000, aceptado:true, porcentajeCobertura:'75%', observacionTS:'Documentación completa. Se recomienda aprobación.',
 datosCompletos:{ 'f-nombres':'María', 'f-apellidos':'Gómez', 'f-cedula':'1-2345-6789', 'f-correo':'estudiante@becas.com', 'f-telefono':'8888-1111', 'f-nacimiento':'2003-04-12', 'f-direccion':'San José, Montes de Oca, Sabanilla', 'f-tipo-beca':'Excelencia Académica', 'f-carrera':'Ingeniería en Sistemas', 'f-sede':'Central', 'f-facultad':'Ingeniería', 'f-anio':'2023', 'f-promedio':'92', 'f-avance':'60', 'f-ingreso':'450000', 'f-dependientes':'2', 'f-trabajadores':'1', 'f-vivienda':'Propia', 'f-gastos':'380000', 'f-laboral':'Solo estudio', 'f-discapacidad':'No', 'f-extracurricular':'Club de robótica', 'f-premios':'Primer lugar Hackathon UCR 2025', 'f-beca-anterior':'No', 'f-merito':'He mantenido un promedio sobresaliente durante toda mi carrera.' },
 documentos: docsEjemplo()
 },
 {expediente:'BEC-2026-002', fecha:'2026-01-18', estudianteEmail:'estudiante2@becas.com', nombres:'José', apellidos:'Ramírez', cedula:'2-3456-7890', correo:'estudiante2@becas.com', telefono:'8888-2222', tipoBeca:'Socioeconómica', estado:'Beneficio Activo', progreso:100, puntaje:88, promedio:85, ingresoFamiliar:350000, aceptado:true, porcentajeCobertura:'50%', observacionTS:'Verificar documento de ingresos.',
 datosCompletos:{ 'f-nombres':'José', 'f-apellidos':'Ramírez', 'f-cedula':'2-3456-7890', 'f-correo':'estudiante2@becas.com', 'f-telefono':'8888-2222', 'f-nacimiento':'2002-09-03', 'f-direccion':'Alajuela, San Ramón', 'f-tipo-beca':'Socioeconómica', 'f-carrera':'Administración', 'f-sede':'Occidente', 'f-facultad':'Ciencias Sociales', 'f-anio':'2022', 'f-promedio':'85', 'f-avance':'70', 'f-ingreso':'350000', 'f-dependientes':'3', 'f-trabajadores':'1', 'f-vivienda':'Alquilada', 'f-gastos':'320000', 'f-laboral':'Trabajo informal', 'f-discapacidad':'No', 'f-extracurricular':'Grupo de teatro', 'f-premios':'', 'f-beca-anterior':'Sí', 'f-merito':'Provengo de una familia con ingresos limitados.' },
 documentos: docsEjemplo()
 },
 {expediente:'BEC-2026-003', fecha:'2026-01-20', estudianteEmail:'estudiante3@becas.com', nombres:'Ana', apellidos:'López', cedula:'3-4567-8901', correo:'estudiante3@becas.com', telefono:'8888-3333', tipoBeca:'Excelencia Académica', estado:'Beneficio Activo', progreso:100, puntaje:91, promedio:89, ingresoFamiliar:520000, aceptado:true, porcentajeCobertura:'100%', observacionTS:'Excelente rendimiento académico.',
 datosCompletos:{ 'f-nombres':'Ana', 'f-apellidos':'López', 'f-cedula':'3-4567-8901', 'f-correo':'estudiante3@becas.com', 'f-telefono':'8888-3333', 'f-nacimiento':'2003-01-22', 'f-direccion':'Cartago, Paraíso, Orosi', 'f-tipo-beca':'Excelencia Académica', 'f-carrera':'Medicina', 'f-sede':'Central', 'f-facultad':'Ciencias de la Salud', 'f-anio':'2023', 'f-promedio':'89', 'f-avance':'55', 'f-ingreso':'520000', 'f-dependientes':'1', 'f-trabajadores':'2', 'f-vivienda':'Familiar', 'f-gastos':'400000', 'f-laboral':'Solo estudio', 'f-discapacidad':'No', 'f-extracurricular':'Brigadas de salud', 'f-premios':'Mención honorífica feria de ciencias 2024', 'f-beca-anterior':'No', 'f-merito':'Me esfuerzo por mantener un alto rendimiento académico.' },
 documentos: docsEjemplo()
 },
 {expediente:'BEC-2026-004', fecha:'2026-01-22', estudianteEmail:'estudiante@becas.com', nombres:'María', apellidos:'Gómez', cedula:'1-2345-6789', correo:'estudiante@becas.com', telefono:'8888-1111', tipoBeca:'Deportiva', estado:'Aprobada', progreso:100, puntaje:78, promedio:84, ingresoFamiliar:450000, aceptado:false, porcentajeCobertura:'50%', observacionesComite:'Aprobada por su destacada participación en competencias universitarias de natación.',
 datosCompletos:{ 'f-nombres':'María', 'f-apellidos':'Gómez', 'f-cedula':'1-2345-6789', 'f-correo':'estudiante@becas.com', 'f-telefono':'8888-1111', 'f-nacimiento':'2003-04-12', 'f-direccion':'San José, Montes de Oca', 'f-tipo-beca':'Deportiva', 'f-carrera':'Ingeniería en Sistemas', 'f-sede':'Central', 'f-facultad':'Ingeniería', 'f-anio':'2023', 'f-promedio':'84', 'f-avance':'60', 'f-ingreso':'450000', 'f-dependientes':'2', 'f-trabajadores':'1', 'f-vivienda':'Propia', 'f-gastos':'380000', 'f-laboral':'Solo estudio', 'f-discapacidad':'No', 'f-extracurricular':'Selección universitaria de natación', 'f-premios':'Medalla de oro Juegos Universitarios 2025', 'f-beca-anterior':'No', 'f-merito':'Represento a la universidad en competencias de natación.' },
 documentos: docsEjemplo()
 },
 {expediente:'BEC-2026-005', fecha:'2026-02-01', estudianteEmail:'estudiante2@becas.com', nombres:'José', apellidos:'Ramírez', cedula:'2-3456-7890', correo:'estudiante2@becas.com', telefono:'8888-2222', tipoBeca:'Cultural', estado:'Enviada', progreso:30, puntaje:0, promedio:82, ingresoFamiliar:420000, aceptado:false, observacionTS:'Pendiente de revisión por trabajador social.',
 datosCompletos:{ 'f-nombres':'José', 'f-apellidos':'Ramírez', 'f-cedula':'2-3456-7890', 'f-correo':'estudiante2@becas.com', 'f-telefono':'8888-2222', 'f-nacimiento':'2002-09-03', 'f-direccion':'Alajuela, San Ramón', 'f-tipo-beca':'Cultural', 'f-carrera':'Administración', 'f-sede':'Occidente', 'f-facultad':'Ciencias Sociales', 'f-anio':'2022', 'f-promedio':'82', 'f-avance':'70', 'f-ingreso':'420000', 'f-dependientes':'3', 'f-trabajadores':'1', 'f-vivienda':'Alquilada', 'f-gastos':'320000', 'f-laboral':'Trabajo informal', 'f-discapacidad':'No', 'f-extracurricular':'Grupo de teatro', 'f-premios':'', 'f-beca-anterior':'Sí', 'f-merito':'Participo en el grupo de teatro de la universidad.' },
 documentos: { 'f-cedula-f': { label:'Copia de cédula (frontal)', nombre:'cedula_frontal.pdf', tipo:'application/pdf', tamano:184320, fecha:'2026-02-01T08:00:00.000Z', datos:null, estado:'Pendiente' }, 'f-cedula-p': { label:'Copia de cédula (posterior)', nombre:'cedula_posterior.pdf', tipo:'application/pdf', tamano:179200, fecha:'2026-02-01T08:00:00.000Z', datos:null, estado:'Pendiente' } }
 },
 {expediente:'BEC-2026-006', fecha:'2026-01-25', estudianteEmail:'estudiante3@becas.com', nombres:'Ana', apellidos:'López', cedula:'3-4567-8901', correo:'estudiante3@becas.com', telefono:'8888-3333', tipoBeca:'Investigación', estado:'Rechazada', progreso:60, puntaje:45, promedio:76, ingresoFamiliar:600000, aceptado:false, motivoRechazo:'El promedio académico (76) no alcanza el mínimo requerido (85) para becas de investigación.',
 datosCompletos:{ 'f-nombres':'Ana', 'f-apellidos':'López', 'f-cedula':'3-4567-8901', 'f-correo':'estudiante3@becas.com', 'f-telefono':'8888-3333', 'f-nacimiento':'2003-01-22', 'f-direccion':'Cartago, Paraíso, Orosi', 'f-tipo-beca':'Investigación', 'f-carrera':'Medicina', 'f-sede':'Central', 'f-facultad':'Ciencias de la Salud', 'f-anio':'2023', 'f-promedio':'76', 'f-avance':'55', 'f-ingreso':'600000', 'f-dependientes':'1', 'f-trabajadores':'2', 'f-vivienda':'Familiar', 'f-gastos':'400000', 'f-laboral':'Solo estudio', 'f-discapacidad':'No', 'f-extracurricular':'', 'f-premios':'', 'f-beca-anterior':'No', 'f-merito':'Deseo unirme a un proyecto de investigación.' },
 documentos: docsEjemplo()
 },
 {expediente:'BEC-2026-007', fecha:'2026-01-28', estudianteEmail:'estudiante@becas.com', nombres:'María', apellidos:'Gómez', cedula:'1-2345-6789', correo:'estudiante@becas.com', telefono:'8888-1111', tipoBeca:'Socioeconómica', estado:'Rechazada', progreso:50, puntaje:0, promedio:88, ingresoFamiliar:380000, aceptado:false, motivoRechazo:'El recibo de servicios públicos no es legible y la constancia de ingresos está vencida.',
 datosCompletos:{ 'f-nombres':'María', 'f-apellidos':'Gómez', 'f-cedula':'1-2345-6789', 'f-correo':'estudiante@becas.com', 'f-telefono':'8888-1111', 'f-nacimiento':'2003-04-12', 'f-direccion':'San José, Montes de Oca', 'f-tipo-beca':'Socioeconómica', 'f-carrera':'Ingeniería en Sistemas', 'f-sede':'Central', 'f-facultad':'Ingeniería', 'f-anio':'2023', 'f-promedio':'88', 'f-avance':'60', 'f-ingreso':'380000', 'f-dependientes':'2', 'f-trabajadores':'1', 'f-vivienda':'Propia', 'f-gastos':'350000', 'f-laboral':'Solo estudio', 'f-discapacidad':'No', 'f-extracurricular':'', 'f-premios':'', 'f-beca-anterior':'No', 'f-merito':'Solicito esta beca socioeconómica.' },
 documentos: {
 'f-cedula-f': { label:'Copia de cédula (frontal)', nombre:'cedula_frontal.pdf', tipo:'application/pdf', tamano:184320, fecha:'2026-01-28T08:00:00.000Z', datos:null, estado:'Aprobado' },
 'f-cedula-p': { label:'Copia de cédula (posterior)', nombre:'cedula_posterior.pdf', tipo:'application/pdf', tamano:179200, fecha:'2026-01-28T08:00:00.000Z', datos:null, estado:'Aprobado' },
 'f-constancia': { label:'Constancia de ingresos familiares', nombre:'constancia_ingresos_2025.pdf', tipo:'application/pdf', tamano:198000, fecha:'2026-01-28T08:00:00.000Z', datos:null, estado:'Corrección solicitada', observacion:'La constancia tiene fecha de emisión de hace más de 3 meses.' },
 'f-recibo': { label:'Recibo de servicios públicos reciente', nombre:'recibo_luz.jpg', tipo:'image/jpeg', tamano:142000, fecha:'2026-01-28T08:00:00.000Z', datos:null, estado:'Corrección solicitada', observacion:'La imagen no es legible.' }
 }
 },
 {expediente:'BEC-2025-003', fecha:'2025-11-05', estudianteEmail:'ana@correo.cr', nombres:'Ana', apellidos:'Castro', cedula:'4-5678-9012', correo:'ana@correo.cr', tipoBeca:'Cultural', estado:'Cerrada', progreso:100, puntaje:67, fechaCierre:'2025-12-10', aceptado:false,
 datosCompletos:{ 'f-nombres':'Ana', 'f-apellidos':'Castro', 'f-cedula':'4-5678-9012', 'f-correo':'ana@correo.cr', 'f-tipo-beca':'Cultural', 'f-carrera':'Arquitectura', 'f-sede':'Central', 'f-promedio':'80', 'f-ingreso':'500000', 'f-merito':'Participación destacada en el coro institucional.' },
 documentos: docsEjemplo()
 }
 ]));
 }
 
 if(!localStorage.getItem(STORAGE_KEYS.noticias)) localStorage.setItem(STORAGE_KEYS.noticias, JSON.stringify([
 { id:1, titulo:'Convocatoria 2026 abierta', contenido:'Ya están disponibles las becas para el período 2026. Fecha límite: 31/03/2026', fecha:'15/01/2026' }
 ]));

 if(!localStorage.getItem(STORAGE_KEYS.apelaciones)) {
 localStorage.setItem(STORAGE_KEYS.apelaciones, JSON.stringify([
 { expediente: 'BEC-2026-006', email: 'estudiante3@becas.com', nombreEstudiante: 'Ana López', motivo: 'Considero que mi promedio (76) no refleja mi capacidad real, ya que tuve problemas de salud.', estado: 'Pendiente', fecha: '2026-02-10', decision: null, archivo: null },
 { expediente: 'BEC-2026-007', email: 'estudiante@becas.com', nombreEstudiante: 'María Gómez', motivo: 'Solicito revisión de mi expediente porque considero que los documentos presentados eran válidos.', estado: 'Pendiente', fecha: '2026-02-12', decision: null, archivo: null },
 { expediente: 'BEC-2025-003', email: 'ana@correo.cr', nombreEstudiante: 'Ana Castro', motivo: 'La beca cultural fue rechazada porque no se consideró mi participación en el coro institucional.', estado: 'Revisada', fecha: '2026-02-05', decision: 'Revocar Rechazo - Se otorga la beca cultural', archivo: null }
 ]));
 }

 if(!localStorage.getItem(STORAGE_KEYS.justificaciones)) {
 localStorage.setItem(STORAGE_KEYS.justificaciones, JSON.stringify([
 { id:1, email:'estudiante@becas.com', nombreEstudiante: 'María Gómez', curso:'Matemática I', codigo:'MA-1001', periodo:'I-2025', nota:65, motivo:'Problemas de salud durante el examen final.', estado:'Aprobada', observacion:'Certificado médico verificado.', fecha:'2025-12-01', archivo:null },
 { id:2, email:'estudiante2@becas.com', nombreEstudiante: 'José Ramírez', curso:'Física General', codigo:'FI-2002', periodo:'II-2025', nota:55, motivo:'Fallecimiento de un familiar cercano.', estado:'Pendiente', observacion:'', fecha:'2026-01-15', archivo:null },
 { id:3, email:'estudiante3@becas.com', nombreEstudiante: 'Ana López', curso:'Química Orgánica', codigo:'QU-3001', periodo:'I-2025', nota:60, motivo:'Accidente de tránsito.', estado:'Pendiente', observacion:'', fecha:'2026-01-20', archivo:null },
 { id:4, email:'estudiante@becas.com', nombreEstudiante: 'María Gómez', curso:'Programación Avanzada', codigo:'PA-3001', periodo:'II-2025', nota:70, motivo:'Problemas técnicos durante el examen.', estado:'Rechazada', observacion:'No se acepta.', fecha:'2026-02-01', archivo:null }
 ]));
 }

 if(!localStorage.getItem(STORAGE_KEYS.suspensiones)) {
 localStorage.setItem(STORAGE_KEYS.suspensiones, JSON.stringify([
 { id:1, email:'estudiante@becas.com', expediente:'BEC-2026-001', tipo:'suspension', dias:'15', motivo:'Bajo rendimiento académico', observaciones:'El estudiante ha presentado un promedio por debajo del mínimo requerido.', fecha:'2026-05-10', estado:'Activa', evidencia:null, nombreEstudiante:'María Gómez' }
 ]));
 }
 
 if(!localStorage.getItem(STORAGE_KEYS.config)) localStorage.setItem(STORAGE_KEYS.config, JSON.stringify({
 socio:40, academico:35, vulnerabilidad:15, meritos:10,
 promedioMin:80, ingresoMax:500000,
 plazoSubsanacion:5, plazoApelacion:10, plazoRenovacion:15,
 msgAprobacion:'Felicidades, tu solicitud de beca ha sido APROBADA.',
 msgRechazo:'Lamentamos informarte que tu solicitud ha sido RECHAZADA.',
 msgSubsanacion:'Tu solicitud requiere correcciones. Revisa los documentos pendientes.'
 }));
 if(!localStorage.getItem(STORAGE_KEYS.borrador)) localStorage.setItem(STORAGE_KEYS.borrador, JSON.stringify({}));
 if(!localStorage.getItem(STORAGE_KEYS.bitacora)){
 const ahora = new Date();
 const hace = (mins) => new Date(ahora.getTime() - mins*60000).toLocaleString();
 localStorage.setItem(STORAGE_KEYS.bitacora, JSON.stringify([
 { fecha: hace(180), usuario: 'María Gómez', rol: 'estudiante', accion: 'Solicitud creada', expediente: 'BEC-2026-001' },
 { fecha: hace(170), usuario: 'José Ramírez', rol: 'estudiante', accion: 'Solicitud creada', expediente: 'BEC-2026-002' },
 { fecha: hace(150), usuario: 'Carlos Rodríguez', rol: 'trabajador_social', accion: 'Revisión TS', expediente: 'BEC-2026-001' },
 { fecha: hace(120), usuario: 'Carlos Rodríguez', rol: 'trabajador_social', accion: 'Revisión TS', expediente: 'BEC-2026-002' },
 { fecha: hace(90), usuario: 'Dra. Ana Méndez', rol: 'comite', accion: 'Aprobación Comité', expediente: 'BEC-2026-002' },
 { fecha: hace(60), usuario: 'Admin Sistema', rol: 'admin', accion: 'Consulta Admin', expediente: '—' },
 { fecha: hace(45), usuario: 'Admin Sistema', rol: 'admin', accion: 'Configuración', expediente: '—' },
 { fecha: hace(30), usuario: 'Ana Castro', rol: 'estudiante', accion: 'Cierre de expediente', expediente: 'BEC-2025-003' },
 { fecha: hace(15), usuario: 'Luis Fernández', rol: 'auditor', accion: 'Consulta Auditor', expediente: 'BEC-2025-003' },
 { fecha: hace(5), usuario: 'Luis Fernández', rol: 'auditor', accion: 'Consulta Auditor', expediente: '—' }
 ]));
 }
 if(!localStorage.getItem(STORAGE_KEYS.visitas)) localStorage.setItem(STORAGE_KEYS.visitas, '[]');
 if(!localStorage.getItem(STORAGE_KEYS.convocatorias)){
 const hoy = new Date();
 const fmt = (d) => d.toISOString().slice(0,10);
 const apertura = new Date(hoy.getTime() - 10*86400000);
 const cierre = new Date(hoy.getTime() + 20*86400000);
 localStorage.setItem(STORAGE_KEYS.convocatorias, JSON.stringify([
 { id:1, nombre:'Beca Socioeconómica 2026-I', tipo:'Socioeconómica', cupos:20, fechaApertura: fmt(apertura), fechaCierre: fmt(cierre), estado:'Activa' },
 { id:2, nombre:'Beca de Excelencia Académica 2026-I', tipo:'Excelencia Académica', cupos:10, fechaApertura: fmt(apertura), fechaCierre: fmt(cierre), estado:'Activa' },
 { id:3, nombre:'Beca Cultural 2025-II', tipo:'Cultural', cupos:5, fechaApertura: fmt(new Date(hoy.getTime() - 60*86400000)), fechaCierre: fmt(new Date(hoy.getTime() - 30*86400000)), estado:'Borrador' }
 ]));
 }
 if(!localStorage.getItem(STORAGE_KEYS.empleados)){
 localStorage.setItem(STORAGE_KEYS.empleados, JSON.stringify([
 { id:1, nombre:'Dra. Laura Chaves', departamento:'Oficina de Becas', cargo:'Coordinadora de Becas', correo:'laura.chaves@becas.ac.cr', telefono:'2200-1001' },
 { id:2, nombre:'M.Sc. Roberto Jiménez', departamento:'Registro Académico', cargo:'Analista de Expedientes', correo:'roberto.jimenez@becas.ac.cr', telefono:'2200-1002' },
 { id:3, nombre:'Lic. Marcela Solano', departamento:'Finanzas', cargo:'Tesorera', correo:'marcela.solano@becas.ac.cr', telefono:'2200-1003' },
 { id:4, nombre:'Dr. Carlos Montero', departamento:'Comité de Becas', cargo:'Miembro del Comité', correo:'carlos.montero@becas.ac.cr', telefono:'2200-1004' }
 ]));
 }
 if(!localStorage.getItem(STORAGE_KEYS.alertasSeguridad)){
 localStorage.setItem(STORAGE_KEYS.alertasSeguridad, JSON.stringify([
 { id:1, fecha:'2026-06-14 08:23:15', tipo:'Alta', descripcion:'Múltiples intentos fallidos de inicio de sesión (5) para usuario estudiante@becas.com', estado:'Pendiente' },
 { id:2, fecha:'2026-06-13 22:15:30', tipo:'Media', descripcion:'Acceso desde ubicación inusual: IP 185.45.12.33', estado:'Revisada' },
 { id:3, fecha:'2026-06-12 14:30:00', tipo:'Baja', descripcion:'Intento de acceso a expediente sin permisos suficientes', estado:'Pendiente' },
 { id:4, fecha:'2026-06-14 06:15:20', tipo:'Crítica', descripcion:'Patrón de descarga masiva de documentos (más de 50 en 5 minutos)', estado:'En investigación' }
 ]));
 }
}