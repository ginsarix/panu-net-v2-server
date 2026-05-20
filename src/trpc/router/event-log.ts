import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import { z } from 'zod';

import { DEFAULT_ITEMS_PER_PAGE } from '../../constants/pagination.js';
import { db } from '../../db/index.js';
import { eventLogs } from '../../db/schema/event-log.js';
import { users } from '../../db/schema/user.js';
import { authorizedProcedure, router } from '../index.js';

export const eventLogRouter = router({
  getEventLogs: authorizedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        itemsPerPage: z.number().min(1).max(100).default(DEFAULT_ITEMS_PER_PAGE),
        resourceType: z.string().optional(),
        action: z.string().optional(),
        status: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, itemsPerPage, resourceType, action, status } = input;
      const skip = (page - 1) * itemsPerPage;

      const conditions: SQL[] = [];
      if (resourceType) conditions.push(eq(eventLogs.resourceType, resourceType));
      if (action) conditions.push(eq(eventLogs.action, action));
      if (status) conditions.push(eq(eventLogs.status, status));

      const whereClause = conditions.length ? and(...conditions) : undefined;

      const [rows, [{ total }]] = await Promise.all([
        db
          .select({
            id: eventLogs.id,
            resourceType: eventLogs.resourceType,
            resourceId: eventLogs.resourceId,
            action: eventLogs.action,
            actorId: eventLogs.actorId,
            actorName: users.name,
            status: eventLogs.status,
            ipAddress: eventLogs.ipAddress,
            userAgent: eventLogs.userAgent,
            createdAt: eventLogs.createdAt,
          })
          .from(eventLogs)
          .leftJoin(users, eq(eventLogs.actorId, users.id))
          .where(whereClause)
          .orderBy(desc(eventLogs.createdAt))
          .offset(skip)
          .limit(itemsPerPage),
        db.select({ total: count() }).from(eventLogs).where(whereClause),
      ]);

      return { rows, totalCount: total };
    }),

  getFilterOptions: authorizedProcedure.query(async () => {
    const [resourceTypes, actions, statuses] = await Promise.all([
      db
        .select({ value: eventLogs.resourceType })
        .from(eventLogs)
        .groupBy(eventLogs.resourceType),
      db.select({ value: eventLogs.action }).from(eventLogs).groupBy(eventLogs.action),
      db.select({ value: eventLogs.status }).from(eventLogs).groupBy(eventLogs.status),
    ]);

    return {
      resourceTypes: resourceTypes.map((r) => r.value),
      actions: actions.map((a) => a.value),
      statuses: statuses.map((s) => s.value),
    };
  }),
});
