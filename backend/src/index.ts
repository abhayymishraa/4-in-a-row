import express from "express";
import { createServer } from "http";
import dotenv from "dotenv";
import { GameStateManager } from "./services/GameStateManager";
import { MatchmakingService } from "./services/MatchmakingService";
import { DatabaseService } from "./services/DatabaseService";
import { WebSocketHandler } from "./api/websocket";
import { createRoutes } from "./api/routes";
import { logger } from "./config/logger";

dotenv.config();

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.static("public"));

app.use(
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept",
    );
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
    } else {
      next();
    }
  },
);

const gameStateManager = new GameStateManager();
const databaseService = new DatabaseService();
const matchmakingService = new MatchmakingService(gameStateManager);

new WebSocketHandler(
  httpServer,
  gameStateManager,
  matchmakingService,
  databaseService,
);

app.use("/api", createRoutes(databaseService));

async function startServer() {
  try {
    logger.info("Starting server initialization...", {
      hasDbHost: !!process.env.DB_HOST,
      hasDbName: !!process.env.DB_NAME,
      hasDbUser: !!process.env.DB_USER,
      hasDbPassword: !!process.env.DB_PASSWORD,
      dbHost: process.env.DB_HOST || "NOT SET",
      dbName: process.env.DB_NAME || "NOT SET",
      dbUser: process.env.DB_USER || "NOT SET",
    });

    try {
      logger.info("Attempting to initialize database...");
      await databaseService.initialize();
      logger.info(
        "Database initialized successfully - database operations are ENABLED",
      );
    } catch (error: any) {
      logger.error(
        "Database initialization FAILED - database operations will be DISABLED",
        {
          error: error?.message || error,
          code: error?.code,
          host: process.env.DB_HOST || "NOT SET",
          database: process.env.DB_NAME || "NOT SET",
          user: process.env.DB_USER || "NOT SET",
          port: process.env.DB_PORT || "NOT SET",
          stack: error?.stack,
        },
      );
      logger.error(
        "All database save operations (savePlayer, saveGame) will be skipped until database is initialized",
      );
    }

    const port = process.env.PORT || 3000;
    httpServer.listen(port, () => {
      logger.info(`Server started on port ${port}`, {
        dbHost: process.env.DB_HOST || "not set",
        dbName: process.env.DB_NAME || "not set",
        dbUser: process.env.DB_USER || "not set",
      });
    });

    setInterval(() => {
      gameStateManager.cleanupStaleGames(60);
    }, 60000);

    process.on("SIGTERM", async () => {
      logger.info("SIGTERM received, shutting down gracefully");
      await databaseService.close().catch(() => {});
      process.exit(0);
    });
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
}

startServer();
