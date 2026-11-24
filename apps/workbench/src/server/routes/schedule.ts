/** 일정 API(NOR-242). */
import { Hono, type Context } from 'hono';
import { z } from 'zod';

import { isCalendarDate } from '../../core/bullets/date.js';
import {
  SCHEDULE_ID_PATTERN,
  ScheduleValidationError,
  dayNumber,
  expandSchedule,
  planDelete,
  planEdit,
  validateEventInput,
  type ScheduleEvent,
} from '../../core/schedule/index.js';
import type { ScheduleStore } from '../adapters/scheduleStore.js';

const MAX_RANGE_DAYS = 400;
const date = z.string().refine(isCalendarDate, 'date must be YYYY-MM-DD');
const scope = z.enum(['this', 'following', 'all']);
const editSchema = z.object({ scope, occurrenceDate: date, event: z.unknown() }).strict();

export interface ScheduleRouteOptions {
  readonly createId: () => string;
}

class NotFound extends Error {}

function invalid(context: Context, message: string) {
  return context.json({ error: { code: 'invalid_request', message } }, 400);
}

export function createScheduleRoutes(store: ScheduleStore, options: ScheduleRouteOptions): Hono {
  const routes = new Hono();

  routes.onError((error, context) => {
    if (error instanceof ScheduleValidationError || error instanceof z.ZodError)
      return invalid(context, error.message);
    if (error instanceof NotFound)
      return context.json({ error: { code: 'not_found', message: 'Event not found' } }, 404);
    throw error;
  });

  routes.get('/api/schedule', async (context) => {
    const from = date.safeParse(context.req.query('from'));
    const to = date.safeParse(context.req.query('to'));
    if (!from.success || !to.success) return invalid(context, 'from and to must be dates');
    const span = dayNumber(to.data) - dayNumber(from.data);
    if (span < 0 || span > MAX_RANGE_DAYS)
      return invalid(context, `range must be 0 to ${MAX_RANGE_DAYS} days`);
    const { events, problems } = await store.list();
    return context.json({ occurrences: expandSchedule(events, from.data, to.data), problems });
  });

  routes.get('/api/schedule/events/:id', async (context) => {
    const event = await store.read(eventId(context.req.param('id')));
    if (event === null) throw new NotFound();
    return context.json(event);
  });

  routes.post('/api/schedule/events', async (context) => {
    const input = validateEventInput(await readJson(context.req.raw));
    const event: ScheduleEvent = { id: options.createId(), ...input };
    await store.runExclusive(async (transaction) => {
      if ((await transaction.read(event.id)) !== null) throw new Error('schedule id collision');
      await transaction.write(event);
    });
    return context.json(event, 201);
  });

  routes.put('/api/schedule/events/:id', async (context) => {
    const id = eventId(context.req.param('id'));
    const body = editSchema.parse(await readJson(context.req.raw));
    const next = validateEventInput(body.event);
    const plan = await store.runExclusive(async (transaction) => {
      const current = await transaction.read(id);
      if (current === null) throw new NotFound();
      const result = planEdit(current, body.scope, body.occurrenceDate, next, options.createId());
      if (result.update) await transaction.write(result.update);
      if (result.create) await transaction.write(result.create);
      return result;
    });
    return context.json(plan);
  });

  routes.delete('/api/schedule/events/:id', async (context) => {
    const id = eventId(context.req.param('id'));
    const chosen = scope.parse(context.req.query('scope'));
    const occurrenceDate = date.parse(context.req.query('date'));
    await store.runExclusive(async (transaction) => {
      const current = await transaction.read(id);
      if (current === null) throw new NotFound();
      const result = planDelete(current, chosen, occurrenceDate);
      if (result.remove) await transaction.remove(id);
      else if (result.update) await transaction.write(result.update);
    });
    return context.body(null, 204);
  });

  return routes;
}

function eventId(value: string): string {
  if (!SCHEDULE_ID_PATTERN.test(value)) throw new ScheduleValidationError('invalid schedule id');
  return value;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ScheduleValidationError('request body must be JSON');
  }
}
