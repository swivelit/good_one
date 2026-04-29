require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const connectDB = require('./Db/configdb');
const otpRoutes = require('./Routes/otpRouter');
const { uploadsDir } = require('./config/uploads');
const User = require('./Models/User');
const Conversation = require('./Models/Conversation');

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

const isConversationParticipant = (conversation, userId) =>
  conversation.customer.toString() === userId.toString() ||
  conversation.vendor.toString() === userId.toString();

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(new Error('Authentication required'));
    }

    socket.user = user;
    return next();
  } catch (error) {
    return next(new Error('Authentication required'));
  }
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
app.use('/api/reports', require('./Routes/reportRoutes'));
app.use('/api/blocks', require('./Routes/blockRoutes'));

app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('user-online', () => {
    const userId = socket.user._id.toString();
    connectedUsers.set(userId, socket.id);
    console.log(`User ${userId} online`);
  });

  socket.on('join-conversation', async (conversationId) => {
    try {
      const conversation = await Conversation.findById(conversationId).select('customer vendor');
      if (!conversation || !isConversationParticipant(conversation, socket.user._id)) {
        socket.emit('error-message', { message: 'Not authorized for this conversation.' });
        return;
      }

      socket.join(conversationId);
    } catch (error) {
      socket.emit('error-message', { message: 'Failed to join conversation.' });
    }
  });

  socket.on('send-message', async (data) => {
    try {
      const conversationId = data?.conversationId;
      if (!conversationId) return;

      const conversation = await Conversation.findById(conversationId).select('customer vendor');
      if (!conversation || !isConversationParticipant(conversation, socket.user._id)) {
        socket.emit('error-message', { message: 'Not authorized for this conversation.' });
        return;
      }

      io.to(conversationId).emit('receive-message', data);
    } catch (error) {
      socket.emit('error-message', { message: 'Failed to send real-time message.' });
    }
  });

  socket.on('typing', (data) => {
    socket.to(data.conversationId).emit('user-typing', { userId: socket.user._id });
  });

  socket.on('stop-typing', (data) => {
    socket.to(data.conversationId).emit('user-stop-typing', { userId: socket.user._id });
  });

  socket.on('disconnect', () => {
    connectedUsers.forEach((socketId, userId) => {
      if (socketId === socket.id) connectedUsers.delete(userId);
    });
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
