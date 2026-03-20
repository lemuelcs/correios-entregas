import 'dotenv/config';
import { app } from './app';
import { prisma } from './shared/utils/prisma';

const PORT = process.env.PORT || 3001;

async function main() {
  await prisma.$connect();
  console.log('✓ Database connected');

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
  await prisma.$disconnect();
  process.exit(0);
});
