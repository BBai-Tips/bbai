import { apiStop } from './apiStop.ts';
import { apiStart } from './apiStart.ts';
import { logger } from 'shared/logger.ts';

export const apiRestart = async () => {
  try {
    logger.info('Restarting API...');
    await apiStop();
    await apiStart();
    logger.info('API restarted successfully.');
  } catch (error) {
    logger.error('Failed to restart API:', error);
    throw error;
  }
};