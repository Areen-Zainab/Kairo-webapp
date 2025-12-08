const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Initialize cron jobs
const { initializeCronJobs, stopCronJobs } = require("./config/cron");

const app = express();

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:5173" // Vite dev server
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true
}));


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes = require("./routes/authRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const actionItemRoutes = require("./routes/actionItemRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/action-items", actionItemRoutes);

// Health check route
app.get("/", (req, res) => {
  res.json({ 
    message: "Kairo backend is running with PostgreSQL and Prisma!",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.all("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log(`🚀  Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  
  // Initialize cron jobs after server starts
  initializeCronJobs();
  
  // Initialize global transcription model (non-blocking)
  const ModelPreloader = require('./services/ModelPreloader');
  console.log('🔄 Initializing global transcription model...');
  ModelPreloader.getGlobalModel()
    .then((model) => {
      // Check if model actually loaded (getGlobalModel returns null on failure)
      if (model && ModelPreloader.isProcessHealthy(model.process)) {
        console.log('✅ Global transcription model ready');
      } else {
        console.warn('⚠️  Global model initialization returned null (will retry on first request)');
      }
    })
    .catch((error) => {
      console.warn('⚠️  Global model initialization failed (will retry on first request):', error.message);
      // Don't crash - lazy loading will handle it
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⚠️  SIGTERM signal received: closing HTTP server...');
  stopCronJobs();
  
  // Cleanup global model
  const ModelPreloader = require('./services/ModelPreloader');
  ModelPreloader.releaseGlobalModel();
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT signal received: closing HTTP server...');
  stopCronJobs();
  
  // Cleanup global model
  const ModelPreloader = require('./services/ModelPreloader');
  ModelPreloader.releaseGlobalModel();
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;