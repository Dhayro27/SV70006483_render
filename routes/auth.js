const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();
const verifyToken = require('../middleware/auth');




router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  (req, res) => {
    if (req.user && req.user.user) {
      const { id, email, name } = req.user.user;
      const token = generateToken({ id, email, name });
      res.redirect(`/?token=${token}`);
    } else {
      console.error('User information is missing');
      res.redirect('/login?error=authentication_failed');
    }
  }
);

function generateToken(user) {
  console.log('generacion de token:', user);
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, process.env.JWT_SECRET, {
    expiresIn: '1d'
  });
  console.log('Token generado:', token);
  return token;
}

router.get('/logout', (req, res) => {
    res.json({ message: 'Sesión cerrada exitosamente' });
});

router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No se proporcionó token' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    res.json({ user: decoded });
  });
});

router.get('/user', verifyToken, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name
        }
    });
});

module.exports = router;