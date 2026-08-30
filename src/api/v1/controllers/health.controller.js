import mongoose from 'mongoose';
import { config } from '../../../config/index.js';
import { DB_READY_STATES } from '../../../config/constants.js';
import { sendSuccess } from '../../../shared/http/api-response.js';

export function getHealth(req, res) {
  const databaseState = DB_READY_STATES[mongoose.connection.readyState] ?? 'unknown';

  sendSuccess(res, {
    data: {
      status: databaseState === 'connected' ? 'ok' : 'degraded',
      service: 'genai-backend',
      environment: config.env,
      database: databaseState,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
}
