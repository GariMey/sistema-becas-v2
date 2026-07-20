const bcrypt = require('bcryptjs');

function cifrarPassword(pwd) {
  return bcrypt.hashSync(pwd, 10);
}

async function verificarPassword(pwd, hash) {
  return bcrypt.compareSync(pwd, hash);
}

function authMiddleware(req, res, next) {
  const email = req.headers['x-user-email'];
  const rol = req.headers['x-user-rol'];
  if (!email || !rol) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  req.user = { email, rol };
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tiene permisos para esta acción' });
    }
    next();
  };
}

module.exports = { cifrarPassword, verificarPassword, authMiddleware, requireRole };