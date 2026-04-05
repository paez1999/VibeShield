import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { initializeApp, cert } from 'firebase-admin/app'
import { readFileSync } from 'fs'

// Init Firebase Admin — reads serviceAccount.json
const serviceAccount = JSON.parse(readFileSync('./serviceAccount.json', 'utf8'))
initializeApp({ credential: cert(serviceAccount) })

import integrationsRoutes from './routes/integrations.js'
import credentialsRoutes  from './routes/credentials.js'
import { errorHandler }   from './middleware/errorHandler.js'

const app  = express()
const PORT = process.env.PORT ?? 3000

app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }))

app.use('/api/integrations', integrationsRoutes)
app.use('/api/credentials', credentialsRoutes)

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '0.2.0', ts: new Date().toISOString() }))
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))
app.use(errorHandler)

app.listen(PORT, () => console.log(`[api] VibeShield running on :${PORT}`))
export default app
