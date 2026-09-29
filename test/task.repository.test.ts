jest.mock('../src/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from '../src/db';
import { PostgresTaskRepository } from '../src/repositories/task.repository';
import { Task } from '../src/types/task';

const queryMock = pool.query as jest.Mock;

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: 'Learn Jenkins',
    done: false,
    created_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('PostgresTaskRepository', () => {
  const repository = new PostgresTaskRepository();

  beforeEach(() => {
    queryMock.mockReset();
  });

  test('lists tasks ordered by id', async () => {
    const tasks = [task(), task({ id: 2, title: 'Add quality gate' })];
    queryMock.mockResolvedValue({ rows: tasks });

    await expect(repository.list()).resolves.toEqual(tasks);
    expect(queryMock).toHaveBeenCalledWith(
      'SELECT id, title, done, created_at FROM tasks ORDER BY id',
    );
  });

  test('creates a task and returns the inserted row', async () => {
    const createdTask = task();
    queryMock.mockResolvedValue({ rows: [createdTask] });

    await expect(repository.create('Learn Jenkins')).resolves.toEqual(createdTask);
    expect(queryMock).toHaveBeenCalledWith(
      'INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, done, created_at',
      ['Learn Jenkins'],
    );
  });

  test('marks a task done and returns the updated row', async () => {
    const completedTask = task({ done: true });
    queryMock.mockResolvedValue({ rows: [completedTask] });

    await expect(repository.markDone(1)).resolves.toEqual(completedTask);
    expect(queryMock).toHaveBeenCalledWith(
      'UPDATE tasks SET done = TRUE WHERE id = $1 RETURNING id, title, done, created_at',
      [1],
    );
  });

  test('returns null when the task to mark done does not exist', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await expect(repository.markDone(99)).resolves.toBeNull();
  });

  test.each([
    ['one row was deleted', 1, true],
    ['no row was deleted', 0, false],
    ['the driver returns no row count', null, false],
  ])('reports whether a task was removed when %s', async (_case, rowCount, expected) => {
    queryMock.mockResolvedValue({ rowCount });

    await expect(repository.remove(1)).resolves.toBe(expected);
    expect(queryMock).toHaveBeenCalledWith('DELETE FROM tasks WHERE id = $1', [1]);
  });
});
