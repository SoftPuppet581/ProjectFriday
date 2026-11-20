// 게임 출시일을 달력 앱에 넣을 수 있는 .ics 텍스트로 만든다 (하루짜리 종일 일정)

const escapeText = (s) =>
  String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const compactDate = (iso) => iso.replaceAll('-', '');

function nextDay(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildGameIcs(game, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const description = [
    game.platforms?.length ? `플랫폼: ${game.platforms.join(', ')}` : null,
    '출시일은 변경될 수 있습니다.',
  ].filter(Boolean).join('\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GameCalendar//KO',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:game-${game.id}@gamecalendar.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(game.releaseDate)}`,
    `DTEND;VALUE=DATE:${compactDate(nextDay(game.releaseDate))}`,
    `SUMMARY:${escapeText(`${game.title} 출시`)}`,
    `DESCRIPTION:${escapeText(description)}`,
  ];
  if (game.sourceUrl || game.officialUrl) lines.push(`URL:${game.officialUrl ?? game.sourceUrl}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
