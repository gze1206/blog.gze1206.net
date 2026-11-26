/** 반복 일정을 범위로 고치고 지우는 계획(NOR-242). 읽고 쓰는 일은 부르는 쪽이 한다. */
import { addDays, dayNumber } from './days.js';
import { clean, type RepeatRule, type ScheduleEvent, type ScheduleEventInput } from './event.js';
import { countBefore } from './recurrence.js';

export type ScheduleScope = 'this' | 'following' | 'all';

export interface EditPlan {
  readonly update?: ScheduleEvent;
  readonly create?: ScheduleEvent;
}

export interface DeletePlan {
  readonly update?: ScheduleEvent;
  readonly remove?: true;
}

/** 원래 일정을 `date` 전날에서 끝낸다. 횟수 대신 끝 날짜를 쓴다. */
function endBefore(event: ScheduleEvent, date: string): ScheduleEvent {
  const rule = event.repeat as RepeatRule;
  const { count: _count, until: _until, ...rest } = rule;
  return { ...event, repeat: { ...rest, until: addDays(date, -1) } };
}

function withException(event: ScheduleEvent, date: string): ScheduleEvent {
  return { ...event, exceptions: [...new Set([...event.exceptions, date])].sort() };
}

function fieldsOf(next: ScheduleEventInput & { readonly id?: string }): ScheduleEventInput {
  const { id: _id, ...fields } = next;
  return fields;
}

/**
 * `next` 는 화면에서 고친 회차다. 날짜는 그 회차의 날짜다.
 * "모든 일정" 은 회차 날짜를 옮긴 만큼 시작일(과 예외)을 옮긴다.
 */
export function planEdit(
  event: ScheduleEvent,
  scope: ScheduleScope,
  occurrenceDate: string,
  next: ScheduleEventInput & { readonly id?: string },
  newId: string,
): EditPlan {
  const fields = fieldsOf(next);
  const span =
    fields.endDate === undefined ? 0 : dayNumber(fields.endDate) - dayNumber(fields.date);
  if (
    event.repeat === undefined ||
    scope === 'all' ||
    (scope === 'following' && occurrenceDate === event.date)
  ) {
    const shift = dayNumber(fields.date) - dayNumber(occurrenceDate);
    const date = addDays(event.date, shift);
    return {
      update: clean({
        ...fields,
        id: event.id,
        date,
        endDate: span === 0 ? undefined : addDays(date, span),
        exceptions: event.exceptions.map((day) => addDays(day, shift)),
        completed: event.completed.map((day) => addDays(day, shift)),
      }) as ScheduleEvent,
    };
  }
  if (scope === 'this')
    return {
      update: withException(event, occurrenceDate),
      create: (({ repeat: _repeat, ...single }) => ({
        ...single,
        id: newId,
        exceptions: [],
        completed: [],
      }))(fields),
    };
  const before = countBefore(event, occurrenceDate);
  const repeat =
    fields.repeat?.count !== undefined && fields.repeat.count === event.repeat.count
      ? { ...fields.repeat, count: Math.max(1, fields.repeat.count - before) }
      : fields.repeat;
  return {
    update: {
      ...endBefore(event, occurrenceDate),
      completed: event.completed.filter((day) => dayNumber(day) < dayNumber(occurrenceDate)),
    },
    create: clean({
      ...fields,
      id: newId,
      repeat,
      exceptions: event.exceptions.filter((day) => dayNumber(day) >= dayNumber(occurrenceDate)),
      completed: event.completed.filter((day) => dayNumber(day) >= dayNumber(occurrenceDate)),
    }) as ScheduleEvent,
  };
}

export function planDelete(
  event: ScheduleEvent,
  scope: ScheduleScope,
  occurrenceDate: string,
): DeletePlan {
  if (
    event.repeat === undefined ||
    scope === 'all' ||
    (scope === 'following' && occurrenceDate === event.date)
  )
    return { remove: true };
  if (scope === 'this') return { update: withException(event, occurrenceDate) };
  return { update: endBefore(event, occurrenceDate) };
}
