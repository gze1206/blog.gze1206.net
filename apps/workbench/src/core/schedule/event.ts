/**
 * 일정 하나(NOR-242). 작업 공간 `schedule/<ULID>.md` 의 YAML frontmatter 가 일정이고 본문이 메모다.
 * 날짜·시각은 앱 시간대의 벽시계 값이다.
 */
import { stringify } from 'yaml';
import { z } from 'zod';

import { isCalendarDate } from '../bullets/date.js';
import { parseFrontmatter } from '../document/frontmatter.js';
import { dayNumber } from './days.js';

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const REPEAT_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type RepeatFrequency = (typeof REPEAT_FREQUENCIES)[number];

export interface RepeatRule {
  readonly freq: RepeatFrequency;
  readonly interval: number;
  /** 주간 반복의 요일. 없으면 시작 요일이다. 월요일부터 정렬한다. */
  readonly weekdays?: readonly Weekday[];
  /** 이날까지(포함). `count` 와 함께 쓰지 않는다. */
  readonly until?: string;
  /** 회차 수. 예외로 뺀 회차도 센다. */
  readonly count?: number;
}

export interface ScheduleEventInput {
  readonly title: string;
  readonly date: string;
  readonly endDate?: string;
  readonly time?: string;
  readonly endTime?: string;
  readonly location?: string;
  readonly repeat?: RepeatRule;
  readonly exceptions: readonly string[];
  readonly notes: string;
}

export interface ScheduleEvent extends ScheduleEventInput {
  readonly id: string;
}

export const SCHEDULE_ID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u;

export class ScheduleValidationError extends Error {
  public override readonly name = 'ScheduleValidationError';
}

const dateField = z.string().refine(isCalendarDate, '날짜는 실제로 있는 YYYY-MM-DD 여야 합니다');
const timeField = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, '시각은 HH:mm 이어야 합니다');

const repeatSchema = z
  .object({
    freq: z.enum(REPEAT_FREQUENCIES),
    interval: z.number().int().min(1).max(999),
    weekdays: z.array(z.enum(WEEKDAYS)).min(1).optional(),
    until: dateField.optional(),
    count: z.number().int().min(1).max(9999).optional(),
  })
  .strict()
  .refine((rule) => rule.until === undefined || rule.count === undefined, {
    message: 'until 과 count 는 함께 쓸 수 없습니다',
  });

const inputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    date: dateField,
    endDate: dateField.optional(),
    time: timeField.optional(),
    endTime: timeField.optional(),
    location: z.string().trim().min(1).max(200).optional(),
    repeat: repeatSchema.optional(),
    exceptions: z.array(dateField).max(1000).default([]),
    notes: z.string().max(20_000).default(''),
  })
  .strict()
  .superRefine((event, context) => {
    if (event.endTime !== undefined && event.time === undefined)
      context.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: '끝 시각은 시작 시각이 있을 때만 씁니다',
      });
    if (event.endTime !== undefined && event.time !== undefined && event.endTime <= event.time)
      context.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: '끝 시각은 시작 시각보다 늦어야 합니다',
      });
    if (event.endDate !== undefined && dayNumber(event.endDate) < dayNumber(event.date))
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: '끝 날짜는 시작 날짜보다 이를 수 없습니다',
      });
    if (event.repeat?.until !== undefined && dayNumber(event.repeat.until) < dayNumber(event.date))
      context.addIssue({
        code: 'custom',
        path: ['repeat', 'until'],
        message: '반복 끝 날짜는 시작 날짜보다 이를 수 없습니다',
      });
  });

/** 입력을 검사하고 정리한다(요일 정렬, 예외 정렬·중복 제거, 주간이 아니면 요일 제거). */
export function validateEventInput(input: unknown): ScheduleEventInput {
  const result = inputSchema.safeParse(input);
  if (!result.success)
    throw new ScheduleValidationError(
      result.error.issues
        .map((issue) => `${issue.path.join('.') || 'event'}: ${issue.message}`)
        .join('; '),
    );
  const event = result.data;
  const repeat =
    event.repeat === undefined
      ? undefined
      : clean({
          freq: event.repeat.freq,
          interval: event.repeat.interval,
          weekdays:
            event.repeat.freq === 'weekly' && event.repeat.weekdays !== undefined
              ? WEEKDAYS.filter((day) => event.repeat?.weekdays?.includes(day))
              : undefined,
          until: event.repeat.until,
          count: event.repeat.count,
        });
  return clean({
    title: event.title,
    date: event.date,
    endDate: event.endDate === event.date ? undefined : event.endDate,
    time: event.time,
    endTime: event.endTime,
    location: event.location,
    repeat,
    exceptions: [...new Set(event.exceptions)].sort(),
    notes: event.notes,
  }) as ScheduleEventInput;
}

export function assertScheduleId(id: string): void {
  if (!SCHEDULE_ID_PATTERN.test(id)) throw new ScheduleValidationError('invalid schedule id');
}

export function parseEvent(id: string, source: string): ScheduleEvent {
  assertScheduleId(id);
  let parsed;
  try {
    parsed = parseFrontmatter(source);
  } catch (error) {
    throw new ScheduleValidationError(
      error instanceof Error ? error.message : 'invalid schedule file',
    );
  }
  return { id, ...validateEventInput({ ...parsed.data, notes: parsed.content }) };
}

/** 저장 형식. 문자열은 큰따옴표로 써서 `14:00` 같은 값이 다른 형으로 읽히지 않게 한다. */
export function serializeEvent(event: ScheduleEvent): string {
  const { id: _id, notes, ...data } = event;
  const yaml = stringify(clean(data), {
    defaultStringType: 'QUOTE_DOUBLE',
    defaultKeyType: 'PLAIN',
  });
  return `---\n${yaml}---\n${notes}`;
}

/** 값이 undefined 인 키를 뺀다. */
export function clean<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
