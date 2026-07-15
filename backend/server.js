const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { 
    success: false, 
    message: 'Too many requests, please try again later.' 
  }
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/qr', require('./routes/qr'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/merchant', require('./routes/merchant'));
app.use('/api/invoice', require('./routes/invoice'));

// Health Check Route
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'UniPay API Server Running Successfully! 🚀',
    version: '1.0.0',
    status: 'active'
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found' 
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║     🚀 UniPay Server Running! 🚀          ║
║                                           ║
║     Port: ${PORT}                         ║
║     Mode: ${process.env.NODE_ENV}         ║
║     Time: ${new Date().toLocaleTimeString()}          ║
║                                           ║
╚═══════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});