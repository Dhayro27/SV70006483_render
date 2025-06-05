const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ error: 'Token no proporcionado' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    
    req.user = user;
    console.log('Usuario autenticado:', user);  // Log para depuración
    next();
  });
};

exports.isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
  }
  next();
};

exports.isCustomer = (req, res, next) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Acceso denegado. Esta ruta es solo para clientes.' });
  }
  next();
};

exports.isAdminOrCustomer = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Acceso denegado. Rol no válido.' });
  }
  next();
};