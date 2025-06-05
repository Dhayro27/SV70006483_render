require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const passport = require('passport');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const jwt = require('jsonwebtoken');
const path = require('path');

const { verifyToken } = require('./middleware/authMiddleware');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const refundRoutes = require('./routes/refunds');
const addressRoutes = require('./routes/addresses');
const categoriesRoutes = require('./routes/categories');
const cartsRouter = require('./routes/carts');

require('./config/passport')(passport);

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(passport.initialize());
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
  apis: ['./routes/*.js'], 
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      }
    }
  },
  security: [{
    bearerAuth: []
  }]
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Rutas
app.use('/auth', authRoutes);
app.use('/addresses', verifyToken, addressRoutes);
app.use('/categories', verifyToken, categoriesRoutes);
app.use('/products', productRoutes);
app.use('/carts', verifyToken, cartsRouter);
app.use('/orders', verifyToken, orderRoutes);
app.use('/payments', verifyToken, paymentRoutes);
app.use('/refunds', verifyToken, refundRoutes);

// Prueba de conexión a la base de datos
const pool = require('./config/database');
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err);
  } else {
    console.log('Conexión exitosa a la base de datos');
  }
});

// Función para verificar el token de WebSocket
function verifySocketToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Configuración de WebSockets
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    const user = verifySocketToken(token);
    if (user) {
      socket.user = user;
    }
  }
  next();
});

io.on('connection', (socket) => {
  if (socket.user) {
    console.log(`Un cliente se ha conectado - Usuario: ${socket.user.email}, Perfil: ${socket.user.role}`);
  } else {
    console.log('Un cliente se ha conectado - Invitado');
  }

  socket.on('disconnect', () => {
    if (socket.user) {
      console.log(`Un cliente se ha desconectado - Usuario: ${socket.user.email}`);
    } else {
      console.log('Un cliente se ha desconectado - Invitado');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));