const express = require("express");
const cors = require("cors");
const path = require("path");
// Load environment variables from root .env file
require("dotenv").config({ path: path.join(__dirname, '../../.env') });

// Verify critical environment variables are loaded
console.log('🔑 Environment variables loaded:');
console.log('   MISTRAL_API_KEY:', process.env.MISTRAL_API_KEY ? `Present (${process.env.MISTRAL_API_KEY.length} chars)` : 'MISSING ⚠️');
console.log('   GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'Present' : 'MISSING ⚠️');

// Initialize cron jobs
const { initializeCronJobs, stopCronJobs } = require("./config/cron");
// Initialize WebSocket server
const { initializeWebSocketServer } = require("./services/WebSocketServer");

// Global registry for child processes to ensure cleanup on exit
global.activeChildProcesses = new Set();

// Helper to track child processes
global.registerChildProcess = (childProcess, description = 'unknown') => {
  if (childProcess && childProcess.pid) {
    global.activeChildProcesses.add({ process: childProcess, description, pid: childProcess.pid });
    
    // Auto-remove when process exits
    childProcess.on('exit', () => {
      global.activeChildProcesses.forEach(item => {
        if (item.pid === childProcess.pid) {
          global.activeChildProcesses.delete(item);
        }
      });
    });
  }
};

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
const taskRoutes = require("./routes/taskRoutes");
const memoryRoutes = require("./routes/memoryRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/action-items", actionItemRoutes);
app.use("/api", taskRoutes);
app.use("/api/workspaces/:workspaceId/memory", memoryRoutes);

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
  
  // Initialize WebSocket server
  initializeWebSocketServer(server);
  
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

// Helper function for cleanup
async function performCleanup() {
  console.log('\n🧹 Starting cleanup...');
  
  // Stop cron jobs
  console.log('  ⏰ Stopping cron jobs...');
  stopCronJobs();
  
  // Cleanup global transcription model
  console.log('  🔊 Releasing global transcription model...');
  const ModelPreloader = require('./services/ModelPreloader');
  ModelPreloader.releaseGlobalModel();
  
  // Kill all tracked child processes
  if (global.activeChildProcesses && global.activeChildProcesses.size > 0) {
    console.log(`  🔪 Killing ${global.activeChildProcesses.size} active child processes...`);
    
    for (const item of global.activeChildProcesses) {
      try {
        if (item.process && !item.process.killed) {
          console.log(`     - Killing ${item.description} (PID: ${item.pid})`);
          item.process.kill('SIGTERM');
          
          // Force kill after 2 seconds if still alive
          setTimeout(() => {
            if (!item.process.killed) {
              console.log(`     - Force killing ${item.description} (PID: ${item.pid})`);
              item.process.kill('SIGKILL');
            }
          }, 2000);
        }
      } catch (err) {
        console.error(`     ❌ Failed to kill ${item.description}:`, err.message);
      }
    }
    
    global.activeChildProcesses.clear();
    console.log('  ✅ All child processes terminated');
  }
  
  // Close database connections
  console.log('  💾 Closing database connections...');
  const prisma = require('./lib/prisma');
  try {
    await prisma.$disconnect();
    console.log('  ✅ Database disconnected');
  } catch (err) {
    console.error('  ⚠️  Database disconnect error:', err.message);
  }
}

// Graceful shutdown for SIGTERM (typically from process managers)
process.on('SIGTERM', async () => {
  console.log('\n⚠️  SIGTERM signal received: closing HTTP server...');
  
  await performCleanup();
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Graceful shutdown for SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT signal received (Ctrl+C): closing HTTP server...');
  
  await performCleanup();
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    console.log('👋 Goodbye!\n');
    process.exit(0);
  });
  
  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught Exception:', error);
  await performCleanup();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  await performCleanup();
  process.exit(1);
});

module.exports = app;