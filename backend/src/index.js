import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes         from './routes/auth.js';
import integrationsRoutes from './routes/integrations.js';
import { errorHandler }   from './middleware/errorHandler.js';

const app  = express();
const PORT = process.env.PORT ?? 3000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));

app.use('/api/auth',         authRoutes);
app.use('/api/integrations', integrationsRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '0.1.0', ts: new Date().toISOString() }));
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

app.listen(PORT, () => console.log(`[api] VibeShield running on :${PORT} (${process.env.NODE_ENV})`));
export default app;
