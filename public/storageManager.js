// ================================================================
// 📦 storageManager.js - Módulo centralizado de persistencia
// ================================================================
// Este módulo unifica todo el acceso a localStorage para el sistema
// de becas. Permite cambiar fácilmente a una base de datos real.
// ================================================================

const StorageManager = (function() {
    'use strict';

    // ============================================================
    // CONFIGURACIÓN
    // ============================================================
    const PREFIX = 'becas_';

    // ============================================================
    // MÉTODOS BASE
    // ============================================================
    function getKey(key) {
        return PREFIX + key;
    }

    function get(key) {
        try {
            const data = localStorage.getItem(getKey(key));
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.warn(`⚠️ Error al leer ${key}:`, e);
            return null;
        }
    }

    function set(key, data) {
        try {
            localStorage.setItem(getKey(key), JSON.stringify(data));
        } catch (e) {
            console.error(`❌ Error al guardar ${key}:`, e);
        }
    }

    function remove(key) {
        localStorage.removeItem(getKey(key));
    }

    function exists(key) {
        return localStorage.getItem(getKey(key)) !== null;
    }

    // ============================================================
    // CRUD GENÉRICO
    // ============================================================
    function findAll(entity) {
        return get(entity) || [];
    }

    function findOne(entity, predicate) {
        return (get(entity) || []).find(predicate) || null;
    }

    function findById(entity, id) {
        return (get(entity) || []).find(item => item.id === id) || null;
    }

    function save(entity, data) {
        const items = findAll(entity);
        let isNew = false;
        
        if (data.id !== undefined && data.id !== null) {
            const index = items.findIndex(i => i.id === data.id);
            if (index !== -1) {
                // Actualizar existente
                items[index] = { ...items[index], ...data };
                set(entity, items);
                return { ...items[index], _updated: true };
            }
        }
        
        // Nuevo item
        isNew = true;
        const newItem = {
            ...data,
            id: data.id || Date.now() + Math.floor(Math.random() * 1000),
            _createdAt: new Date().toISOString()
        };
        items.push(newItem);
        set(entity, items);
        return { ...newItem, _new: true };
    }

    function deleteItem(entity, id) {
        const items = findAll(entity).filter(i => i.id !== id);
        set(entity, items);
        return true;
    }

    function deleteBy(entity, predicate) {
        const items = findAll(entity).filter(i => !predicate(i));
        set(entity, items);
        return true;
    }

    function count(entity) {
        return findAll(entity).length;
    }

    // ============================================================
    // UTILIDADES ADICIONALES
    // ============================================================
    function generateId() {
        return Date.now() + Math.floor(Math.random() * 10000);
    }

    function getEntityName(key) {
        return key.replace(PREFIX, '');
    }

    // ============================================================
    // DEFINICIÓN DE ENTIDADES CON API ESPECÍFICA
    // ============================================================
    const ENTITIES = {
        // ---- USUARIOS ----
        usuarios: {
            getAll() {
                return findAll('usuarios');
            },
            getById(id) {
                return findById('usuarios', id);
            },
            getByEmail(email) {
                return findOne('usuarios', u => u.email === email);
            },
            getByRol(rol) {
                return findAll('usuarios').filter(u => u.rol === rol);
            },
            getActivos() {
                return findAll('usuarios').filter(u => u.activo !== false);
            },
            getPendientesAprobacion() {
                return findAll('usuarios').filter(u => u.aprobado === false);
            },
            save(usuario) {
                return save('usuarios', usuario);
            },
            delete(id) {
                return deleteItem('usuarios', id);
            },
            autenticar(email, password, twoFactorCode) {
                const usuario = this.getByEmail(email);
                if (!usuario) return null;
                
                // Verificar bloqueo
                if (usuario.bloqueado) {
                    return { error: 'Usuario bloqueado' };
                }
                
                // Verificar contraseña (en producción usar bcrypt)
                // Como estamos en localStorage, la contraseña está cifrada
                // Aquí simulamos la verificación
                if (usuario.password !== password) {
                    usuario.intentos = (usuario.intentos || 0) + 1;
                    if (usuario.intentos >= 3) {
                        usuario.bloqueado = true;
                    }
                    this.save(usuario);
                    return { error: 'Contraseña incorrecta', intentos: usuario.intentos };
                }
                
                // Resetear intentos
                usuario.intentos = 0;
                this.save(usuario);
                
                // Verificar 2FA
                if (usuario.twoFactorEnabled && !twoFactorCode) {
                    return { require2FA: true };
                }
                
                return { success: true, usuario };
            },
            // Para desarrollo: usuarios de prueba
            getDefaultUsers() {
                return [
                    { id: 1, email: 'estudiante@becas.com', password: '123456', rol: 'estudiante',
                        nombre: 'María Gómez', cedula: '1-2345-6789', telefono: '8888-1111',
                        aprobado: true, puedeSolicitar: true, activo: true,
                        datosAcademicos: { carrera: 'Ingeniería en Sistemas', facultad: 'Ingeniería', sede: 'Central' } },
                    { id: 2, email: 'aspirante@becas.com', password: '123456', rol: 'aspirante',
                        nombre: 'Carlos Fernández', cedula: '2-3456-7890', telefono: '8888-2222',
                        aprobado: true, puedeSolicitar: true, activo: true,
                        datosAcademicos: { esAspirante: true } },
                    { id: 3, email: 'social@becas.com', password: '123456', rol: 'trabajador_social',
                        nombre: 'Carlos Rodríguez', cedula: '3-4567-8901', telefono: '8888-3333',
                        aprobado: true, puedeSolicitar: false, activo: true },
                    { id: 4, email: 'comite@becas.com', password: '123456', rol: 'comite',
                        nombre: 'Dra. Ana Méndez', cedula: '4-5678-9012', telefono: '8888-4444',
                        aprobado: true, puedeSolicitar: false, activo: true },
                    { id: 5, email: 'admin@becas.com', password: '123456', rol: 'admin',
                        nombre: 'Admin Sistema', cedula: '5-6789-0123', telefono: '8888-5555',
                        aprobado: true, puedeSolicitar: false, activo: true },
                    { id: 6, email: 'auditor@becas.com', password: '123456', rol: 'auditor',
                        nombre: 'Luis Fernández', cedula: '6-7890-1234', telefono: '8888-6666',
                        aprobado: true, puedeSolicitar: false, activo: true }
                ];
            }
        },

        // ---- TIPOS DE BECA ----
        tiposBeca: {
            getAll() {
                return findAll('tipos');
            },
            getActivos() {
                return findAll('tipos').filter(t => t.activo !== false);
            },
            getById(id) {
                return findById('tipos', id);
            },
            getByNombre(nombre) {
                return findOne('tipos', t => t.nombre === nombre);
            },
            save(tipo) {
                return save('tipos', tipo);
            },
            delete(id) {
                return deleteItem('tipos', id);
            },
            getDefaultTypes() {
                return [
                    { id: 1, nombre: 'Socioeconómica', icon: '💰', 
                        desc: 'Apoyo financiero para estudiantes con recursos limitados',
                        min: 25, max: 100, rubros: ['Matrícula', 'Aranceles', 'Materiales'],
                        requisitos: ['Promedio mínimo 80', 'Ingreso familiar máximo 2 salarios mínimos'],
                        activo: true },
                    { id: 2, nombre: 'Excelencia Académica', icon: '🎓',
                        desc: 'Para estudiantes con promedio destacado',
                        min: 50, max: 100, rubros: ['Matrícula', 'Aranceles'],
                        requisitos: ['Promedio mínimo 90', 'Sin sanciones disciplinarias'],
                        activo: true },
                    { id: 3, nombre: 'Deportiva', icon: '⚽',
                        desc: 'Para estudiantes con alto rendimiento deportivo',
                        min: 25, max: 75, rubros: ['Matrícula'],
                        requisitos: ['Promedio mínimo 80', 'Representación universitaria'],
                        activo: true },
                    { id: 4, nombre: 'Cultural', icon: '🎭',
                        desc: 'Artes, música, teatro',
                        min: 25, max: 75, rubros: ['Matrícula'],
                        requisitos: ['Promedio mínimo 80', 'Portafolio artístico'],
                        activo: true },
                    { id: 5, nombre: 'Investigación', icon: '🔬',
                        desc: 'Para asistentes de investigación',
                        min: 25, max: 75, rubros: ['Matrícula', 'Estipendio'],
                        requisitos: ['Promedio mínimo 85', 'Proyecto de investigación activo'],
                        activo: true }
                ];
            }
        },

        // ---- SOLICITUDES ----
        solicitudes: {
            getAll() {
                return findAll('solicitudes');
            },
            getById(id) {
                return findById('solicitudes', id);
            },
            getByExpediente(expediente) {
                return findOne('solicitudes', s => s.expediente === expediente);
            },
            getByEstudiante(email) {
                return findAll('solicitudes').filter(s => s.estudianteEmail === email);
            },
            getByEstado(estado) {
                return findAll('solicitudes').filter(s => s.estado === estado);
            },
            getPendientes() {
                const finales = ['Aprobada', 'Beneficio Activo', 'Rechazada', 'Rechazado Definitivo', 
                                'No elegible', 'Cerrada', 'Cancelada', 'Restaurada'];
                return findAll('solicitudes').filter(s => !finales.includes(s.estado));
            },
            getActivas() {
                const activos = ['Enviada', 'En revisión TS', 'Pendiente subsanación', 'Elegible', 
                                'En comité', 'En Apelación', 'Aprobada', 'Beneficio Activo', 'Restaurada'];
                return findAll('solicitudes').filter(s => activos.includes(s.estado));
            },
            getAprobadas() {
                return findAll('solicitudes').filter(s => 
                    ['Aprobada', 'Beneficio Activo', 'Restaurada'].includes(s.estado)
                );
            },
            getRechazadas() {
                return findAll('solicitudes').filter(s => 
                    ['Rechazada', 'Rechazado Definitivo', 'No elegible', 'Cancelada'].includes(s.estado)
                );
            },
            save(solicitud) {
                return save('solicitudes', solicitud);
            },
            delete(id) {
                return deleteItem('solicitudes', id);
            },
            deleteByExpediente(expediente) {
                return deleteBy('solicitudes', s => s.expediente === expediente);
            },
            cambiarEstado(expediente, nuevoEstado, observacion) {
                const solicitud = this.getByExpediente(expediente);
                if (!solicitud) return null;
                
                solicitud.estado = nuevoEstado;
                solicitud.observacionTS = observacion || solicitud.observacionTS;
                solicitud.historial = solicitud.historial || [];
                solicitud.historial.push({
                    fecha: new Date().toISOString(),
                    accion: `Cambio de estado a ${nuevoEstado}`,
                    detalles: observacion || '',
                    usuario: 'Sistema'
                });
                
                return this.save(solicitud);
            }
        },

        // ---- CONVOCATORIAS ----
        convocatorias: {
            getAll() {
                return findAll('convocatorias');
            },
            getActivas() {
                const now = new Date();
                return findAll('convocatorias').filter(c => 
                    c.estado === 'Activa' && new Date(c.fechaCierre) >= now
                );
            },
            getById(id) {
                return findById('convocatorias', id);
            },
            save(convocatoria) {
                return save('convocatorias', convocatoria);
            },
            delete(id) {
                return deleteItem('convocatorias', id);
            }
        },

        // ---- NOTICIAS ----
        noticias: {
            getAll() {
                return findAll('noticias');
            },
            getActivas() {
                const now = new Date();
                return findAll('noticias').filter(n => {
                    if (!n.fechaPublicacion) return true;
                    const pub = new Date(n.fechaPublicacion);
                    pub.setHours(0, 0, 0, 0);
                    return pub <= now;
                });
            },
            getById(id) {
                return findById('noticias', id);
            },
            save(noticia) {
                return save('noticias', noticia);
            },
            delete(id) {
                return deleteItem('noticias', id);
            }
        },

        // ---- JUSTIFICACIONES ----
        justificaciones: {
            getAll() {
                return findAll('justificaciones');
            },
            getByEstudiante(email) {
                return findAll('justificaciones').filter(j => j.email === email);
            },
            getPendientes() {
                return findAll('justificaciones').filter(j => j.estado === 'Pendiente');
            },
            getById(id) {
                return findById('justificaciones', id);
            },
            save(justificacion) {
                return save('justificaciones', justificacion);
            },
            delete(id) {
                return deleteItem('justificaciones', id);
            }
        },

        // ---- APELACIONES ----
        apelaciones: {
            getAll() {
                return findAll('apelaciones');
            },
            getByEstudiante(email) {
                return findAll('apelaciones').filter(a => a.email === email);
            },
            getPendientes() {
                return findAll('apelaciones').filter(a => a.estado === 'Pendiente');
            },
            getByExpediente(expediente) {
                return findOne('apelaciones', a => a.expediente === expediente);
            },
            getById(id) {
                return findById('apelaciones', id);
            },
            save(apelacion) {
                return save('apelaciones', apelacion);
            },
            delete(id) {
                return deleteItem('apelaciones', id);
            }
        },

        // ---- SUSPENSIONES ----
        suspensiones: {
            getAll() {
                return findAll('suspensiones');
            },
            getActivas() {
                return findAll('suspensiones').filter(s => s.estado === 'Activa');
            },
            getByEstudiante(email) {
                return findAll('suspensiones').filter(s => s.email === email);
            },
            getByExpediente(expediente) {
                return findAll('suspensiones').filter(s => s.expediente === expediente);
            },
            getById(id) {
                return findById('suspensiones', id);
            },
            save(suspension) {
                return save('suspensiones', suspension);
            },
            delete(id) {
                return deleteItem('suspensiones', id);
            }
        },

        // ---- VISITAS ----
        visitas: {
            getAll() {
                return findAll('visitas');
            },
            getByExpediente(expediente) {
                return findAll('visitas').filter(v => v.expediente === expediente);
            },
            getPendientes() {
                return findAll('visitas').filter(v => v.estado === 'Pendiente');
            },
            getById(id) {
                return findById('visitas', id);
            },
            save(visita) {
                return save('visitas', visita);
            },
            delete(id) {
                return deleteItem('visitas', id);
            }
        },

        // ---- VOTACIONES ----
        votaciones: {
            getAll() {
                return findAll('votaciones');
            },
            getEnCurso() {
                return findAll('votaciones').filter(v => v.estado === 'En curso');
            },
            getByExpediente(expediente) {
                return findOne('votaciones', v => v.expediente === expediente);
            },
            getById(id) {
                return findById('votaciones', id);
            },
            save(votacion) {
                return save('votaciones', votacion);
            },
            delete(id) {
                return deleteItem('votaciones', id);
            }
        },

        // ---- MIEMBROS COMITÉ ----
        miembrosComite: {
            getAll() {
                return findAll('miembros_comite');
            },
            getActivos() {
                return findAll('miembros_comite').filter(m => m.activo !== false);
            },
            getById(id) {
                return findById('miembros_comite', id);
            },
            getByEmail(email) {
                return findOne('miembros_comite', m => m.email === email);
            },
            save(miembro) {
                return save('miembros_comite', miembro);
            },
            delete(id) {
                return deleteItem('miembros_comite', id);
            }
        },

        // ---- ALERTAS DE SEGURIDAD ----
        alertasSeguridad: {
            getAll() {
                return findAll('alertas_seguridad');
            },
            getPendientes() {
                return findAll('alertas_seguridad').filter(a => a.estado === 'Pendiente');
            },
            getById(id) {
                return findById('alertas_seguridad', id);
            },
            save(alerta) {
                return save('alertas_seguridad', alerta);
            },
            delete(id) {
                return deleteItem('alertas_seguridad', id);
            }
        },

        // ---- BITÁCORA ----
        bitacora: {
            getAll() {
                return findAll('bitacora');
            },
            getByUsuario(email) {
                return findAll('bitacora').filter(b => b.usuario === email);
            },
            getByRol(rol) {
                return findAll('bitacora').filter(b => b.rol === rol);
            },
            getUltimos(n) {
                return findAll('bitacora').slice(0, n);
            },
            save(entrada) {
                return save('bitacora', entrada);
            },
            delete(id) {
                return deleteItem('bitacora', id);
            },
            clear() {
                set('bitacora', []);
            }
        },

        // ---- CONFIGURACIÓN ----
        config: {
            get() {
                const config = get('config');
                return config || {};
            },
            set(config) {
                set('config', config);
            },
            getValue(key, defaultValue) {
                const config = this.get();
                return config[key] !== undefined ? config[key] : defaultValue;
            },
            setValue(key, value) {
                const config = this.get();
                config[key] = value;
                this.set(config);
            }
        },

        // ---- SESIÓN ----
        session: {
            get() {
                return get('session');
            },
            set(session) {
                set('session', session);
            },
            clear() {
                remove('session');
            },
            isLoggedIn() {
                return !!this.get();
            },
            getUser() {
                const session = this.get();
                if (!session) return null;
                return ENTITIES.usuarios.getByEmail(session.email);
            },
            getRol() {
                const session = this.get();
                return session ? session.rol : null;
            },
            getNombre() {
                const session = this.get();
                return session ? session.nombre : null;
            }
        }
    };

    // ============================================================
    // SISTEMA DE EVENTOS (Para notificar cambios entre vistas)
    // ============================================================
    const eventListeners = {};

    function emit(event, data) {
        if (eventListeners[event]) {
            eventListeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.warn(`⚠️ Error en listener de ${event}:`, e);
                }
            });
        }
        
        // También usar el evento nativo de localStorage para comunicación entre pestañas
        try {
            const eventData = { event, data, timestamp: Date.now() };
            localStorage.setItem('_storage_event_' + Date.now(), JSON.stringify(eventData));
            // Limpiar después de un tiempo
            setTimeout(() => {
                const keys = Object.keys(localStorage).filter(k => k.startsWith('_storage_event_'));
                if (keys.length > 10) {
                    keys.sort().slice(0, keys.length - 5).forEach(k => localStorage.removeItem(k));
                }
            }, 1000);
        } catch (e) {
            // Ignorar errores
        }
    }

    function on(event, callback) {
        if (!eventListeners[event]) {
            eventListeners[event] = [];
        }
        eventListeners[event].push(callback);
        
        // Devolver función para eliminar el listener
        return () => {
            eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
        };
    }

    // Escuchar eventos de localStorage de otras pestañas
    function initCrossTabEvents() {
        window.addEventListener('storage', function(e) {
            if (e.key && e.key.startsWith('_storage_event_')) {
                try {
                    const data = JSON.parse(e.newValue);
                    if (data && data.event && eventListeners[data.event]) {
                        eventListeners[data.event].forEach(callback => {
                            try {
                                callback(data.data);
                            } catch (err) {
                                console.warn('⚠️ Error en listener cross-tab:', err);
                            }
                        });
                    }
                } catch (e) {
                    // Ignorar
                }
            }
        });
    }

    // ============================================================
    // INICIALIZACIÓN DE DATOS POR DEFECTO
    // ============================================================
    function initDefaultData() {
        // Usuarios
        if (!exists('usuarios')) {
            set('usuarios', ENTITIES.usuarios.getDefaultUsers());
        }
        
        // Tipos de beca
        if (!exists('tipos')) {
            set('tipos', ENTITIES.tiposBeca.getDefaultTypes());
        }
        
        // Configuración
        if (!exists('config')) {
            set('config', {
                socio: 40,
                academico: 35,
                vulnerabilidad: 15,
                meritos: 10,
                promedioMin: 80,
                ingresoMax: 500000,
                plazoSubsanacion: 5,
                plazoApelacion: 10,
                plazoRenovacion: 15,
                msgAprobacion: 'Felicidades, tu solicitud de beca ha sido APROBADA.',
                msgRechazo: 'Lamentamos informarte que tu solicitud ha sido RECHAZADA.',
                msgSubsanacion: 'Tu solicitud requiere correcciones. Revisa los documentos pendientes.'
            });
        }
        
        // Bitácora
        if (!exists('bitacora')) {
            set('bitacora', [
                { id: Date.now(), fecha: new Date().toLocaleString(), usuario: 'Sistema', rol: 'system',
                  accion: 'Sistema iniciado', expediente: '—' }
            ]);
        }
        
        // Otras colecciones vacías
        ['solicitudes', 'convocatorias', 'noticias', 'justificaciones', 'apelaciones', 
         'suspensiones', 'visitas', 'votaciones', 'miembros_comite', 'alertas_seguridad'].forEach(key => {
            if (!exists(key)) {
                set(key, []);
            }
        });
    }

    // ============================================================
    // API PÚBLICA
    // ============================================================
    const publicAPI = {
        // Métodos base
        get, set, remove, exists, getKey,
        findAll, findOne, findById, save, deleteItem, deleteBy, count, generateId,
        emit, on,
        init: initDefaultData,
        initCrossTab: initCrossTabEvents,
        
        // Entidades
        usuarios: ENTITIES.usuarios,
        tiposBeca: ENTITIES.tiposBeca,
        solicitudes: ENTITIES.solicitudes,
        convocatorias: ENTITIES.convocatorias,
        noticias: ENTITIES.noticias,
        justificaciones: ENTITIES.justificaciones,
        apelaciones: ENTITIES.apelaciones,
        suspensiones: ENTITIES.suspensiones,
        visitas: ENTITIES.visitas,
        votaciones: ENTITIES.votaciones,
        miembrosComite: ENTITIES.miembrosComite,
        alertasSeguridad: ENTITIES.alertasSeguridad,
        bitacora: ENTITIES.bitacora,
        config: ENTITIES.config,
        session: ENTITIES.session,

        // Limpiar todos los datos
        clearAll() {
            const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
            keys.forEach(k => localStorage.removeItem(k));
            this.init();
        },

        // Exportar/Importar datos (para backups)
        exportAll() {
            const data = {};
            const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
            keys.forEach(k => {
                data[k] = localStorage.getItem(k);
            });
            return data;
        },

        importAll(data) {
            Object.keys(data).forEach(k => {
                if (k.startsWith(PREFIX)) {
                    localStorage.setItem(k, data[k]);
                }
            });
        }
    };

    // Inicializar datos por defecto
    publicAPI.init();
    publicAPI.initCrossTab();

    return publicAPI;

})();

// ================================================================
// EXPORTAR PARA USO EN EL NAVEGADOR
// ================================================================
// Si se usa con módulos ES6:
// export default StorageManager;

// Para uso en HTML con <script src="storageManager.js">
if (typeof window !== 'undefined') {
    window.StorageManager = StorageManager;
    console.log('📦 StorageManager cargado correctamente.');
}