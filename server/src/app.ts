import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { apiRouter } from "./routes/api";
import { AppError } from "./utils/app-error";
import { requestLogger } from "./middleware/request-logger";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);
app.use("/api", apiRouter);
app.use((_req, _res, next) => next(new AppError(404, "Route not found.")));
app.use(errorHandler);
