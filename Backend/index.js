require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./Db/configdb');
const otpRoutes = require('./Routes/otpRouter');
const { uploadsDir } = require('./config/uploads');

connectDB();

const app = express();
const server = http.createServer(app);

const defaultOrigins = ['http://localhost:3000', 'http://localhost:3001'];
const envOrigins = (process.env.CLIENT_URLS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

const corsOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error('Not allowed by CORS'));
};

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));

app.get('/', (req, res) => {
  res.json({ success: true, message: 'GoodOne API is running' });
});

app.use('/api', otpRoutes);
app.use('/api/auth', require('./Routes/authRoutes'));
app.use('/api/products', require('./Routes/productRouter'));
app.use('/api/chat', require('./Routes/chatRoutes'));
app.use('/api/vendors', require('./Routes/vendorRoutes'));

app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('user-online', (userId) => {
    connectedUsers.set(userId, socket.id);
    console.log(`User ${userId} online`);
  });

  socket.on('join-conversation', (conversationId) => {
    socket.join(conversationId);
  });

  socket.on('send-message', (data) => {
    io.to(data.conversationId).emit('receive-message', data);
  });

  socket.on('typing', (data) => {
    socket.to(data.conversationId).emit('user-typing', { userId: data.userId });
  });

  socket.on('stop-typing', (data) => {
    socket.to(data.conversationId).emit('user-stop-typing', { userId: data.userId });
  });

  socket.on('disconnect', () => {
    connectedUsers.forEach((socketId, userId) => {
      if (socketId === socket.id) connectedUsers.delete(userId);
    });
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
