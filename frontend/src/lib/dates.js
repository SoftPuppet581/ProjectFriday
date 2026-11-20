// 날짜 계산 도우미. 모두 'YYYY-MM-DD' 문자열과 이 컴퓨터의 로컬 날짜 기준이다. (화면 코드 없음)

const pad = (n) => String(n).padStart(2, '0');

export const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, days) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export const monthKey = (iso) => iso.slice(0, 7);

// 'YYYY-MM' 한 달의 { from, to }
export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  return { from: `${month}-01`, to: toIso(new Date(y, m, 0)) };
}

// 이전/다음 달 ('YYYY-MM')
export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// 기준 날짜가 속한 주의 { from, to }. 기본은 월요일 시작~일요일 끝 (weekStartsOn: 0=일요일, 1=월요일)
export function weekRange(iso, weekStartsOn = 1) {
  const d = parseIso(iso);
  const offset = (d.getDay() - weekStartsOn + 7) % 7;
  const from = addDays(iso, -offset);
  return { from, to: addDays(from, 6) };
}

// 출시까지 남은 날: { days, label }. days가 0이면 오늘, 음수면 이미 출시
export function dDay(releaseDate, today = new Date()) {
  const days = Math.round((parseIso(releaseDate) - parseIso(toIso(today))) / 86400000);
  const label = days === 0 ? '오늘 출시' : days > 0 ? `D-${days}` : `D+${-days}`;
  return { days, label };
}
