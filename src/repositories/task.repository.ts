import { pool } from '../db';
import { Task } from '../types/task';

export interface TaskRepository {
  list(): Promise<Task[]>;
  create(title: string): Promise<Task>;
  markDone(id: number): Promise<Task | null>;
  remove(id: number): Promise<boolean>;
}

export class PostgresTaskRepository implements TaskRepository {
  async list(): Promise<Task[]> {
    const { rows } = await pool.query<Task>(
      'SELECT id, title, done, created_at FROM tasks ORDER BY id',
    );
    return rows;
  }

  async create(title: string): Promise<Task> {
    const { rows } = await pool.query<Task>(
      'INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, done, created_at',
      [title],
    );
    return rows[0];
  }

  async markDone(id: number): Promise<Task | null> {
    const { rows } = await pool.query<Task>(
      'UPDATE tasks SET done = TRUE WHERE id = $1 RETURNING id, title, done, created_at',
      [id],
    );
    return rows[0] ?? null;
  }

  async remove(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
