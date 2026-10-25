import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { initializeSocketIO } from './services/notifications.service';
import { db } from './db';
import { generateSeedData } from './seed';

import authRoutes from './routes/auth.routes';
import queueRoutes from './routes/queue.routes';
import navigationRoutes from './routes/navigation.routes';
import registrationRoutes from './routes/registration.routes';
import emergencyRoutes from './routes/emergency.routes';
import assistanceRoutes from './routes/assistance.routes';
import adminRoutes from './routes/admin.routes';
import reportsRoutes from './routes/reports.routes';
import ttsRoutes from './routes/tts.routes';
import voiceRoutes from './routes/voice.routes';

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

initializeSocketIO(io);

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Sahai Setu API Server',
    timestamp: new Date().toISOString(),
    patientsCount: db.getStore().patients.length,
    tokensCount: db.getStore().tokens.length,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/navigation', navigationRoutes);
app.use('/api/registration', registrationRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/assistance', assistanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/voice-assistant', voiceRoutes);


// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err?.message || 'Internal server error' });
});

// Initialize database with seed data if store is empty
const store = db.getStore();
if (store.patients.length === 0) {
  console.log('Database empty on startup. Running initial seed...');
  generateSeedData(150);
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  🏥 SAHAI SETU SERVER RUNNING ON PORT ${PORT}`);
  console.log(`  Realtime Socket.IO connected & ready`);
  console.log(`  Patients in DB: ${db.getStore().patients.length}`);
  console.log(`===============================================`);
});

export { app, server };
