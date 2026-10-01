import express, { NextFunction, Request, Response } from "express";
import { checkDatabase } from "./db";
import { PostgresTaskRepository } from "./repositories/task.repository";
import { createTaskService, TaskService } from "./services/task.service";

export function createApp(
  taskService: TaskService = createTaskService(new PostgresTaskRepository()),
) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", service: "taskflow-api", });
  });

  app.get("/ready", async (_req: Request, res: Response) => {
    try {
      await checkDatabase();
      res.status(200).json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "not_ready" });
    }
  });

  app.get(
    "/tasks",
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        res.json(await taskService.list());
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/tasks",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.status(201).json(await taskService.create(req.body.title));
      } catch (error) {
        next(error);
      }
    },
  );

  app.patch(
    "/tasks/:id/done",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.json(await taskService.markDone(Number(req.params.id)));
      } catch (error) {
        next(error);
      }
    },
  );

  app.delete(
    "/tasks/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.json(await taskService.remove(Number(req.params.id)));
      } catch (error) {
        next(error);
      }
    },
  );

  app.use(
    (
      error: Error & { status?: number },
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      void _next;

      res.status(error.status ?? 500).json({
        error: error.message || "internal error",
      });
    },
  );

  return app;
}
