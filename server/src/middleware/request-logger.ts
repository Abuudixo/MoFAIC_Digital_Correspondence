import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestLogger: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const startedAt = performance.now();
  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () => {
    console.info(
      JSON.stringify({
        level: "info",
        event: "http.request.completed",
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
  });
  next();
};
