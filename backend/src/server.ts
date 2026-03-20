import 'dotenv/config';
import { app } from './app';
import { prisma } from './shared/utils/prisma';

const PORT = process.env.PORT || 3001;

async function main() {
  await prisma.$connect();
  console.log('✓ Database connected');

  // Start workers if Redis is available
  try {
    const { startWorkers } = await import('./workers');
    startWorkers();
    console.log('✓ Workers started');
  } catch (err) {
    console.warn('⚠ Workers not started (Redis may not be available):', (err as Error).message);
  }

  app.listen(PORT, () => {
    console.log(`✓ API running on http://localhost:${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  try {
    const { stopWorkers } = await import('./workers');
    await stopWorkers();
    console.log('✓ Workers stopped');
  } catch {
    // Workers may not have been started
  }
  await prisma.$disconnect();
  process.exit(0);
});
