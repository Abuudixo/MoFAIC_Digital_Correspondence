import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";

const server = app.listen(env.PORT, env.HOST, () => {
  console.info(`API listening on ${env.HOST}:${env.PORT}`);
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`${signal} received; shutting down gracefully.`);
  server.close(async (error) => {
    try {
      await prisma.$disconnect();
      if (error) {
        console.error("HTTP server failed to close cleanly.", error);
        process.exitCode = 1;
      }
    } catch (disconnectError) {
      console.error("Database connection failed to close cleanly.", disconnectError);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
