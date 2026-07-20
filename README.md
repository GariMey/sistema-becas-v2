# Sistema de Becas Universitarias v2.0

Sistema de gestion de becas universitarias con base de datos SQLite y backend Node.js/Express.

## Caracteristicas

- **6 tipos de beca**: Socioeconomica, Excelencia Academica, Deportiva, Cultural, Discapacidad, Investigacion
- **5 roles de usuario**: Estudiante, Trabajador Social, Comite, Administrador, Auditor
- **Base de datos SQLite** con todas las tablas necesarias
- **API REST** completa con Express.js
- **Frontend** interactivo con Chart.js y responsive design
- **Chatbot** integrado para preguntas frecuentes

## Requisitos

- Node.js 18+ 
- npm

## Instalacion

```bash
# 1. Clonar o descomprimir el proyecto
cd sistema-becas

# 2. Instalar dependencias
npm install

# 3. Inicializar la base de datos con datos de prueba
npm run init-db

# 4. Iniciar el servidor
npm start
```

El servidor estara disponible en: `http://localhost:3000`

## Credenciales de prueba

| Rol | Correo | Contrasena |
|-----|--------|------------|
| Estudiante | estudiante@becas.com | 123456 |
| Estudiante | estudiante2@becas.com | 123456 |
| Estudiante | estudiante3@becas.com | 123456 |
| Trabajador Social | social@becas.com | 123456 |
| Comite | comite@becas.com | 123456 |
| Administrador | admin@becas.com | 123456 |
| Auditor | auditor@becas.com | 123456 |

## Estructura del proyecto

```
sistema-becas/
├── server.js              # Servidor Express principal
├── package.json           # Dependencias del proyecto
├── .env                   # Variables de entorno
├── database/
│   ├── init.js            # Inicializacion de BD y datos de prueba
│   └── becas.db           # Base de datos SQLite (generada)
├── routes/
│   ├── auth.js            # Autenticacion (login, recuperacion)
│   ├── usuarios.js        # CRUD de usuarios
│   ├── solicitudes.js     # CRUD de solicitudes de beca
│   ├── tiposBeca.js       # CRUD de tipos de beca
│   ├── convocatorias.js   # CRUD de convocatorias
│   ├── noticias.js        # CRUD de noticias
│   ├── justificaciones.js # Justificaciones de perdida de cursos
│   ├── apelaciones.js     # Apelaciones de decisiones
│   ├── visitas.js         # Visitas domiciliarias
│   ├── suspensiones.js    # Suspensiones y cancelaciones
│   ├── empleados.js       # CRUD de empleados
│   ├── config.js          # Configuracion del sistema
│   ├── bitacora.js        # Bitacora de auditoria
│   ├── estadisticas.js    # Estadisticas del sistema
│   └── alertas.js         # Alertas de seguridad
├── middleware/
│   └── auth.js            # Middleware de autenticacion
└── public/
    ├── api.js             # Cliente API para el frontend
    └── index.html         # Frontend completo (SPA)
```

## Base de datos

### Tablas principales

- **usuarios**: Cuentas de usuario con roles y autenticacion
- **tipos_beca**: Catalogo de tipos de beca disponibles
- **solicitudes**: Solicitudes de beca con toda la informacion
- **documentos**: Documentos adjuntos a cada solicitud
- **convocatorias**: Convocatorias de becas
- **noticias**: Noticias y avisos del sistema
- **justificaciones**: Justificaciones de perdida de cursos
- **apelaciones**: Apelaciones de decisiones de beca
- **suspensiones**: Suspensiones y cancelaciones de becas
- **visitas**: Visitas domiciliarias del trabajador social
- **empleados**: Personal administrativo
- **config**: Configuracion del sistema
- **bitacora**: Registro de auditoria
- **alertas_seguridad**: Alertas de monitoreo

## API Endpoints

### Autenticacion
- `POST /api/auth/login` - Iniciar sesion
- `POST /api/auth/recuperacion` - Solicitar recuperacion de contrasena

### Solicitudes
- `GET /api/solicitudes` - Listar solicitudes (filtrado por rol)
- `GET /api/solicitudes/:expediente` - Obtener solicitud por expediente
- `POST /api/solicitudes` - Crear solicitud
- `PUT /api/solicitudes/:expediente` - Actualizar solicitud

### Tipos de beca
- `GET /api/tipos-beca` - Listar tipos
- `POST /api/tipos-beca` - Crear tipo (admin)
- `PUT /api/tipos-beca/:id` - Actualizar tipo (admin)
- `DELETE /api/tipos-beca/:id` - Eliminar tipo (admin)

### Y mas endpoints para convocatorias, noticias, justificaciones, apelaciones, visitas, suspensiones, empleados, configuracion, bitacora, estadisticas y alertas.

## Tecnologias

- **Backend**: Node.js, Express.js
- **Base de datos**: SQLite (via better-sqlite3)
- **Frontend**: HTML5, CSS3, JavaScript vanilla, Chart.js
- **Seguridad**: CryptoJS para contrasenas, middleware de roles
