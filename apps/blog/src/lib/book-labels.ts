import type { BookStatus } from './books';

const STATUS_LABELS: Record<BookStatus, string> = {
  reading: '읽는 중',
  finished: '완독',
  abandoned: '중단',
  want: '읽고 싶은',
};
const FORMAT_LABELS = { ebook: '전자책', paper: '종이책', audio: '오디오북' };
export function bookStatusLabel(status: BookStatus): string {
  return STATUS_LABELS[status];
}
export function bookFormatLabel(format: keyof typeof FORMAT_LABELS): string {
  return FORMAT_LABELS[format];
}
