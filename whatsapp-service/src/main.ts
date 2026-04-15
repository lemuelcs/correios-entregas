import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { comunicacaoRoutes } from './routes/comunicacao.routes';
import { errorHandler } from './shared/middleware/error-handler.middleware';

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'whatsapp-service' });
});

// Routes
app.use('/api/v1/comunicacao', comunicacaoRoutes);

// Error handler
app.use(errorHandler);

app.listen(port, () => {
  console.log(`WhatsApp Service listening at http://localhost:${port}`);
});
