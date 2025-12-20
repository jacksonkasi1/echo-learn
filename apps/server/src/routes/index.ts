// ** import lib
import { Hono } from "hono";

// ** import routes
import { uploadRoute } from "./upload";
import { ingestRoute } from "./ingest";
import { filesRoute } from "./files";
import { chatRoute } from "./v1/chat";

const api = new Hono();

// Mount routes
api.route("/upload", uploadRoute);
api.route("/ingest", ingestRoute);
api.route("/files", filesRoute);
api.route("/v1/chat", chatRoute);

export { api as apiRoute };
