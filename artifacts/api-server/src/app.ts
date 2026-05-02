import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { buildSessionMiddleware, enforceOrgScope } from "./lib/auth";

const app: Express = express();

// Trust the Replit reverse proxy so secure cookies and req.ip work correctly.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Security headers. CSP is disabled here because the API serves no HTML —
// the frontend artifact owns its own CSP. helmet's other defaults (HSTS,
// noSniff, frameguard, referrerPolicy, etc.) are safe and useful.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  }),
);

// CORS: same-origin requests through the Replit proxy don't need CORS, but
// during local development the preview lives on a different host. Allow
// credentials (so the session cookie round-trips) and reflect the origin.
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

// Allow up to ~12MB JSON bodies to accommodate base64-encoded map images
// (sent by the AI Map Maker, downscaled to 1600px webp on the client).
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

// Sessions before any route — every request must have access to req.session.
app.use(buildSessionMiddleware());

// Tenant scope guard: when a B2B user is signed in, force organizationId on
// every request from their session so client-supplied values can't be forged.
app.use(enforceOrgScope);

app.use("/api", router);

// Global error handler. Routes can `throw Object.assign(new Error(...), { code: "NOT_FOUND" })`
// or pass an error to `next()` and have it converted into a clean JSON response.
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Body-parser limits.
  if (err && typeof err === "object" && "type" in err && err.type === "entity.too.large") {
    res.status(413).json({ error: "Request body too large" });
    return;
  }
  // Rate-limit errors come through here too.
  if (err && typeof err === "object" && "status" in err && typeof err.status === "number") {
    res.status(err.status).json({ error: err.message ?? "Request failed" });
    return;
  }
  const code = (err as { code?: string })?.code;
  const message = (err as { message?: string })?.message ?? "Internal server error";
  if (code === "NOT_FOUND") { res.status(404).json({ error: message }); return; }
  if (code === "BAD_REQUEST" || code === "VALIDATION") {
    res.status(400).json({ error: message });
    return;
  }
  if (code === "FORBIDDEN") { res.status(403).json({ error: message }); return; }
  if (code === "CONFLICT") { res.status(409).json({ error: message }); return; }

  // Unknown — log full stack but don't leak details to the client.
  req.log?.error({ err }, "unhandled route error");
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

export default app;
