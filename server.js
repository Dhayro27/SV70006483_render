require('dotenv').config();

const passportDebug = require('debug')('passport');
const oauthDebug = require('debug')('oauth');

process.env.DEBUG = 'passport,oauth';

const express = require('express');
const session = require('express-session');
const passport = require('passport');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const refundRoutes = require('./routes/refunds');
const verifyToken = require('./middleware/auth');

const path = require('path');

require('./config/passport')(passport);

const app = express();

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use(passport.initialize());
// app.use(passport.session()); 

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/auth', authRoutes);
app.use('/orders', verifyToken, orderRoutes);
app.use('/products', productRoutes);
app.use('/payments', paymentRoutes);
app.use('/refunds', refundRoutes);

const pool = require('./config/database');

// Prueba de conexión
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err);
  } else {
    console.log('Conexión exitosa a la base de datos');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));