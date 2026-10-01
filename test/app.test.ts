import request from 'supertest';
import { createApp } from '../src/app';
import { TaskService } from '../src/services/task.service';

function mockService(): jest.Mocked<TaskService> {
  return {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({
      id: 1,
      title: 'Learn Jenkins',
      done: false,
      created_at: new Date('2026-01-01T00:00:00Z'),
    }),
    markDone: jest.fn().mockResolvedValue({
      id: 1,
      title: 'Learn Jenkins',
      done: true,
      created_at: new Date('2026-01-01T00:00:00Z'),
    }),
    remove: jest.fn().mockResolvedValue({ deleted: true }),
  };
}

describe('Taskflow API', () => {
  test('GET /health returns ok without database', async () => {
    const response = await request(createApp(mockService())).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'taskflow-api',
    });
  });

  test('GET /tasks returns tasks', async () => {
    const response = await request(createApp(mockService())).get('/tasks');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('POST /tasks creates a task', async () => {
    const service = mockService();
    const response = await request(createApp(service))
      .post('/tasks')
      .send({ title: 'Learn Jenkins' });

    expect(response.statusCode).toBe(201);
    expect(service.create).toHaveBeenCalledWith('Learn Jenkins');
  });

  test('POST /tasks returns service validation errors', async () => {
    const service = mockService();
    service.create.mockRejectedValue(Object.assign(new Error('title is required'), { status: 400 }));

    const response = await request(createApp(service)).post('/tasks').send({ title: '' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'title is required' });
  });

  test('PATCH /tasks/:id/done marks a task done', async () => {
    const service = mockService();
    const response = await request(createApp(service)).patch('/tasks/1/done');

    expect(response.statusCode).toBe(200);
    expect(service.markDone).toHaveBeenCalledWith(1);
    expect(response.body.done).toBe(true);
  });

  test('DELETE /tasks/:id deletes a task', async () => {
    const service = mockService();
    const response = await request(createApp(service)).delete('/tasks/1');

    expect(response.statusCode).toBe(200);
    expect(service.remove).toHaveBeenCalledWith(1);
    expect(response.body).toEqual({ deleted: true });
  });
});
