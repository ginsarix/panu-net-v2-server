import { db } from '../db/index.js';
import { eventLogs } from '../db/schema/event-log.js';

interface LogEventParams {
  resourceType: string;
  resourceId?: string | null;
  action: string;
  actorId?: number | null;
  status: 'başarılı' | 'başarısız';
  ipAddress?: string | null;
  userAgent?: string | null;
}

export const logEvent = (params: LogEventParams | LogEventParams[]): void => {
  const values = Array.isArray(params) ? params : [params];
  db.insert(eventLogs)
    .values(values)
    .catch(() => {});
};
