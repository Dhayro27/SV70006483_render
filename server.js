require('dotenv').config();

const passportDebug = require('debug')('passport');
const oauthDebug = require('debug')('oauth');

process.env.DEBUG = 'passport,oauth';

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
// const session = require('express-session');
const passport = require('passport');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const refundRoutes = require('./routes/refunds');
const verifyToken = require('./middleware/auth');

const path = require('path');

require('./config/passport')(passport);

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());

// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: false,
//   cookie: { secure: process.env.NODE_ENV === 'production' }
// }));

app.use(passport.initialize());
// app.use(passport.session()); 

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configuración de Swagger
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'API de Sistema de Pagos',
      version: '1.0.0',
      description: 'API para el sistema de pagos',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desarrollo',
      },
    ],
  },
  apis: ['./routes/*.js'], // Rutas a los archivos que contienen anotaciones de Swagger
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

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

// Configuración de WebSockets
io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado');

  // Actualización en tiempo real de órdenes
  socket.on('newOrder', (order) => {
    console.log('Nueva orden recibida:', order);
    io.emit('orderUpdate', order);
  });

  // Actualización en tiempo real de pagos
  socket.on('newPayment', (payment) => {
    console.log('Nuevo pago recibido:', payment);
    io.emit('paymentUpdate', payment);
  });

  socket.on('disconnect', () => {
    console.log('Un cliente se ha desconectado');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));