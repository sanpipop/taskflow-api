import { TaskRepository } from '../repositories/task.repository';
import { Task } from '../types/task';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export interface TaskService {
  list(): Promise<Task[]>;
  create(title: unknown): Promise<Task>;
  markDone(id: number): Promise<Task>;
  remove(id: number): Promise<{ deleted: true }>;
}

export function createTaskService(repository: TaskRepository): TaskService {
  return {
    list: () => repository.list(),

    async create(title: unknown): Promise<Task> {
      if (typeof title !== 'string' || title.trim().length === 0) {
        throw new AppError('title is required', 400);
      }
      return repository.create(title.trim());
    },

    async markDone(id: number): Promise<Task> {
      if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('invalid task id', 400);
      }
      const task = await repository.markDone(id);
      if (!task) {
        throw new AppError('task not found', 404);
      }
      return task;
    },

    async remove(id: number): Promise<{ deleted: true }> {
      if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('invalid task id', 400);
      }
      const deleted = await repository.remove(id);
      if (!deleted) {
        throw new AppError('task not found', 404);
      }
      return { deleted: true };
    },
  };
}
