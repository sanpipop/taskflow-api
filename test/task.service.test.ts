import { TaskRepository } from '../src/repositories/task.repository';
import { AppError, createTaskService } from '../src/services/task.service';
import { Task } from '../src/types/task';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: 'Learn Jenkins',
    done: false,
    created_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function mockRepository(): jest.Mocked<TaskRepository> {
  return {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue(task()),
    markDone: jest.fn().mockResolvedValue(task({ done: true })),
    remove: jest.fn().mockResolvedValue(true),
  };
}

describe('TaskService', () => {
  test('lists tasks from the repository', async () => {
    const repository = mockRepository();
    const tasks = [task(), task({ id: 2, title: 'Add quality gate' })];
    repository.list.mockResolvedValue(tasks);

    await expect(createTaskService(repository).list()).resolves.toEqual(tasks);
    expect(repository.list).toHaveBeenCalledTimes(1);
  });

  test('trims a valid title before creating a task', async () => {
    const repository = mockRepository();

    await expect(createTaskService(repository).create('  Learn Jenkins  ')).resolves.toEqual(task());
    expect(repository.create).toHaveBeenCalledWith('Learn Jenkins');
  });

  test.each([
    ['a non-string title', undefined],
    ['a blank title', '   '],
  ])('rejects %s without calling the repository', async (_case, title) => {
    const repository = mockRepository();

    await expect(createTaskService(repository).create(title)).rejects.toEqual(
      expect.objectContaining<AppError>({ message: 'title is required', status: 400 }),
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  test('marks an existing task as done', async () => {
    const repository = mockRepository();
    const completedTask = task({ done: true });
    repository.markDone.mockResolvedValue(completedTask);

    await expect(createTaskService(repository).markDone(1)).resolves.toEqual(completedTask);
    expect(repository.markDone).toHaveBeenCalledWith(1);
  });

  test.each([
    ['a non-integer id', 1.5],
    ['a non-positive id', 0],
  ])('rejects %s before marking a task done', async (_case, id) => {
    const repository = mockRepository();

    await expect(createTaskService(repository).markDone(id)).rejects.toEqual(
      expect.objectContaining<AppError>({ message: 'invalid task id', status: 400 }),
    );
    expect(repository.markDone).not.toHaveBeenCalled();
  });

  test('returns a not-found error when the task to mark done does not exist', async () => {
    const repository = mockRepository();
    repository.markDone.mockResolvedValue(null);

    await expect(createTaskService(repository).markDone(99)).rejects.toEqual(
      expect.objectContaining<AppError>({ message: 'task not found', status: 404 }),
    );
    expect(repository.markDone).toHaveBeenCalledWith(99);
  });

  test('removes an existing task', async () => {
    const repository = mockRepository();

    await expect(createTaskService(repository).remove(1)).resolves.toEqual({ deleted: true });
    expect(repository.remove).toHaveBeenCalledWith(1);
  });

  test.each([
    ['a non-integer id', Number.NaN],
    ['a non-positive id', -1],
  ])('rejects %s before removing a task', async (_case, id) => {
    const repository = mockRepository();

    await expect(createTaskService(repository).remove(id)).rejects.toEqual(
      expect.objectContaining<AppError>({ message: 'invalid task id', status: 400 }),
    );
    expect(repository.remove).not.toHaveBeenCalled();
  });

  test('returns a not-found error when the task to remove does not exist', async () => {
    const repository = mockRepository();
    repository.remove.mockResolvedValue(false);

    await expect(createTaskService(repository).remove(99)).rejects.toEqual(
      expect.objectContaining<AppError>({ message: 'task not found', status: 404 }),
    );
    expect(repository.remove).toHaveBeenCalledWith(99);
  });
});
