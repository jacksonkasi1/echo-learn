// ** import lib
import { Hono } from "hono";

// ** import routes
import { completionsRoute } from "./completions.js";

const elevenlabs = new Hono();

// Mount completions route under /v1/chat
elevenlabs.route("/v1/chat", completionsRoute);

export { elevenlabs as elevenlabsRoute };
