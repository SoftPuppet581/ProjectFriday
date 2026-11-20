import { addDays, monthRange, parseIso, weekRange } from './lib/dates.js';

export const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

const shortDate = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' });
const fullDate = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
const monthFormat = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' });

export function dateLabel(date, full = false) {
  return (full ? fullDate : shortDate).format(parseIso(date));
}

export function monthLabel(month) {
  return monthFormat.format(parseIso(month + '-01'));
}

export function monthDays(month) {
  const { from, to } = monthRange(month);
  const first = weekRange(from, 0).from;
  const cellCount = Math.max(35, Math.ceil((parseIso(from).getDay() + parseIso(to).getDate()) / 7) * 7);
  return Array.from({ length: cellCount }, (_, index) => addDays(first, index));
}
