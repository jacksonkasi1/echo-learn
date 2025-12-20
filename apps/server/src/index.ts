// ** import lib
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";

// ** import routes
import { signedUrlRoute } from "@/routes/upload/signed-url";
import { ingestRoute } from "@/routes/ingest/process";
import { deleteRoute } from "@/routes/files/delete-file";
import { chatRoute } from "@/routes/v1/chat/completions";

// ** import utils
import { logger } from "@repo/logs";

// Initialize Hono app
const app = new Hono();

// ===========================================
// Middleware
// ===========================================

// CORS configuration
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

// Request logging
app.use("*", honoLogger());

// ===========================================
// Health Check Routes
// ===========================================

app.get("/", (c) => {
  return c.json({
    name: "Echo-Learn API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ===========================================
// API Routes
// ===========================================

// File upload routes
// POST /api/upload/signed-url - Get signed URL for file upload
// POST /api/upload/confirm - Confirm file upload
app.route("/api/upload", signedUrlRoute);

// File ingestion routes
// POST /api/ingest - Process uploaded file through OCR, chunking, embedding, graph pipeline
// GET /api/ingest/status/:fileId - Get processing status
app.route("/api/ingest", ingestRoute);

// File management routes
// GET /api/files - List user's files
// GET /api/files/:fileId - Get file details
// DELETE /api/files - Delete file with cascade cleanup
app.route("/api/files", deleteRoute);

// OpenAI-compatible chat completions (for 11Labs integration)
// POST /v1/chat/completions - Chat completion endpoint
// GET /v1/chat/completions/health - Health check
app.route("/v1/chat", chatRoute);

// ===========================================
// Error Handling
// ===========================================

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      message: `Route ${c.req.method} ${c.req.path} not found`,
      status: 404,
    },
    404,
  );
});

// Global error handler
app.onError((err, c) => {
  logger.error("Unhandled error", err);

  return c.json(
    {
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "An unexpected error occurred",
      status: 500,
    },
    500,
  );
});

// ===========================================
// Server Export
// ===========================================

const port = parseInt(process.env.PORT || "8787", 10);

logger.info(`Starting Echo-Learn server on port ${port}`);

// Bun server configuration
export default {
  port,
  fetch: app.fetch,
  // Increase idle timeout to 60 seconds to allow for slow external API calls
  // (specifically when mock URLs timeout after ~10s in dev mode)
  idleTimeout: 60,
};
