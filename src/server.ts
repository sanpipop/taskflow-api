import 'dotenv/config';
import { createApp } from './app';
import { initializeDatabase, pool } from './db';

const port = Number(process.env.PORT ?? 8080);

async function main(): Promise<void> {
  await initializeDatabase();

  const server = createApp().listen(port, () => {
    console.log(`taskflow-api listening on port ${port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Failed to start taskflow-api', error);
  process.exit(1);
});
