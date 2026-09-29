import { test, expect } from '@playwright/test';

test('list tasks', async ({ request }) => {
  const response = await request.get('/tasks');

  expect(response.status()).toBe(200);

  const tasks = await response.json();
  expect(Array.isArray(tasks)).toBe(true);
});

test('create task', async ({ request }) => {
  const response = await request.post('/tasks', {
    data: {
      title: 'E2E Create Task',
    },
  });

  expect(response.status()).toBe(201);

  const task = await response.json();
  expect(task.title).toBe('E2E Create Task');
  expect(task.done).toBe(false);

  await request.delete(`/tasks/${task.id}`);
});

test('mark task done', async ({ request }) => {
  const createResponse = await request.post('/tasks', {
    data: {
      title: 'E2E Mark Done',
    },
  });

  expect(createResponse.status()).toBe(201);

  const createdTask = await createResponse.json();

  const doneResponse = await request.patch(
    `/tasks/${createdTask.id}/done`,
  );

  expect(doneResponse.status()).toBe(200);

  const doneTask = await doneResponse.json();
  expect(doneTask.done).toBe(true);

  await request.delete(`/tasks/${createdTask.id}`);
});