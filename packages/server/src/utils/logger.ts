import { getLogs as getLoggerLogs } from '@nanobot/logger';

export async function getLogs(): Promise<any[]> {
  return await getLoggerLogs();
}