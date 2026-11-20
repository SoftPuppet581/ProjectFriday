// 프로필 사진 SVG를 만든다: public/avatars/default.svg 와 a01.svg ~ a20.svg
// 사용법: node scripts/makeAvatars.mjs   (결과물은 커밋되어 있으니 모양을 바꿀 때만 다시 실행)
// 모두 직접 그린 단순한 도형이라 저작권 문제가 없다. 화면에서는 CSS로 동그랗게 자른다.
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../public/avatars/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const W = '#ffffff';
const DARK = 'rgba(10,12,20,.45)';

const star = (cx, cy, outer, inner) =>
  Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

// [배경 그라데이션 색 2개, 도형]
const AVATARS = [
  [['#ff9a62', '#e8456f'], `<rect x="28" y="48" width="72" height="36" rx="18" fill="${W}"/><path d="M47 57v14M40 64h14" stroke="${DARK}" stroke-width="4.5" stroke-linecap="round"/><circle cx="82" cy="60" r="4" fill="${DARK}"/><circle cx="90" cy="68" r="4" fill="${DARK}"/>`],
  [['#ffd166', '#f4845f'], `<polygon points="${star(64, 66, 34, 15)}" fill="${W}"/>`],
  [['#ff7eb3', '#b84dff'], `<path d="M64 92C30 70 38 42 54 44c7 1 10 8 10 8s3-7 10-8c16-2 24 26-10 48Z" fill="${W}"/>`],
  [['#5ee7df', '#4a7cf7'], `<path d="M46 50h36l14 16-32 30-32-30Z" fill="${W}"/><path d="M32 66h64M52 50l12 46 12-46" stroke="${DARK}" stroke-width="2.5" fill="none"/>`],
  [['#6dd5a8', '#2b8a7a'], `<path d="M64 34 90 44v22c0 14-12 24-26 30-14-6-26-16-26-30V44Z" fill="${W}"/><path d="M64 46v40" stroke="${DARK}" stroke-width="4" stroke-linecap="round"/>`],
  [['#f9d423', '#e65c00'], `<polygon points="74,32 46,72 62,72 56,96 84,54 68,54" fill="${W}"/>`],
  [['#ff9966', '#d7263d'], `<path d="M64 32c6 16 24 22 24 42 0 14-10 24-24 24S40 88 40 74c0-12 8-18 12-26 2 8 6 10 8 10 0-10 0-18 4-26Z" fill="${W}"/><path d="M64 92c-7 0-12-4-12-11 0-6 5-10 8-15 1 5 4 6 6 6 3-4 3-8 3-12 6 6 7 12 7 21 0 7-5 11-12 11Z" fill="${DARK}"/>`],
  [['#7f7fd5', '#2d1b69'], `<path d="M80 40A28 28 0 1 0 80 88A22 22 0 1 1 80 40Z" fill="${W}"/>`],
  [['#56ccf2', '#2f80ed'], `<circle cx="64" cy="64" r="19" fill="${W}"/><ellipse cx="64" cy="64" rx="38" ry="11" fill="none" stroke="${W}" stroke-width="5" transform="rotate(-22 64 64)" opacity=".85"/>`],
  [['#f6d365', '#fda085'], `<path d="M34 86 30 50l20 16 14-26 14 26 20-16-4 36Z" fill="${W}"/><rect x="34" y="88" width="60" height="7" rx="3.5" fill="${W}"/>`],
  [['#a18cd1', '#fbc2eb'], `<path d="M42 94V62c0-16 10-24 22-24s22 8 22 24v32l-8-6-7 6-7-6-7 6-7-6Z" fill="${W}"/><circle cx="56" cy="62" r="4.5" fill="${DARK}"/><circle cx="72" cy="62" r="4.5" fill="${DARK}"/>`],
  [['#fbab7e', '#f7ce68'], `<circle cx="64" cy="72" r="26" fill="${W}"/><path d="M40 58 42 34 60 48ZM88 58 86 34 68 48Z" fill="${W}"/><ellipse cx="55" cy="68" rx="3.5" ry="4.5" fill="${DARK}"/><ellipse cx="73" cy="68" rx="3.5" ry="4.5" fill="${DARK}"/><path d="M60 78h8l-4 5Z" fill="${DARK}"/>`],
  [['#43cea2', '#185a9d'], `<rect x="36" y="50" width="56" height="42" rx="11" fill="${W}"/><path d="M64 50V38" stroke="${W}" stroke-width="5" stroke-linecap="round"/><circle cx="64" cy="35" r="5" fill="${W}"/><circle cx="53" cy="68" r="5.5" fill="${DARK}"/><circle cx="75" cy="68" r="5.5" fill="${DARK}"/><path d="M54 82h20" stroke="${DARK}" stroke-width="4" stroke-linecap="round"/>`],
  [['#96e6a1', '#2b9348'], `<path d="M36 92C36 58 58 40 94 36c0 36-18 56-52 56Z" fill="${W}"/><path d="M40 90 74 54" stroke="${DARK}" stroke-width="3.5" stroke-linecap="round"/>`],
  [['#c3cfe2', '#5d6d8a'], `<g transform="rotate(38 64 64)"><polygon points="64,28 70,36 70,78 58,78 58,36" fill="${W}"/><rect x="48" y="78" width="32" height="7" rx="3.5" fill="${W}"/><rect x="60.5" y="85" width="7" height="14" rx="3" fill="${W}"/></g>`],
  [['#f093fb', '#f5576c'], `<rect x="38" y="38" width="52" height="52" rx="12" fill="${W}"/><circle cx="52" cy="52" r="4.5" fill="${DARK}"/><circle cx="76" cy="52" r="4.5" fill="${DARK}"/><circle cx="64" cy="64" r="4.5" fill="${DARK}"/><circle cx="52" cy="76" r="4.5" fill="${DARK}"/><circle cx="76" cy="76" r="4.5" fill="${DARK}"/>`],
  [['#4facfe', '#7b61ff'], `<path d="M40 74C40 40 88 40 88 74" fill="none" stroke="${W}" stroke-width="6" stroke-linecap="round"/><rect x="33" y="68" width="14" height="24" rx="7" fill="${W}"/><rect x="81" y="68" width="14" height="24" rx="7" fill="${W}"/><path d="M88 90c0 8-8 10-18 10" fill="none" stroke="${W}" stroke-width="4" stroke-linecap="round"/>`],
  [['#fa709a', '#fee140'], `<path d="M64 30c14 12 17 34 12 56H52c-5-22-2-44 12-56Z" fill="${W}"/><circle cx="64" cy="56" r="7" fill="${DARK}"/><path d="M52 72 38 92l14-3ZM76 72l14 20-14-3Z" fill="${W}"/><path d="M58 90h12l-6 12Z" fill="${W}" opacity=".8"/>`],
  [['#89f7fe', '#66a6ff'], `<circle cx="64" cy="46" r="12" fill="${W}"/><path d="M56 56h16l4 28H52Z" fill="${W}"/><rect x="44" y="84" width="40" height="9" rx="4.5" fill="${W}"/>`],
  [['#e0c3fc', '#8ec5fc'], `<path d="M64 32 92 48v32L64 96 36 80V48Z" fill="${W}"/><path d="M64 62 92 48M64 62 36 48M64 62v34" stroke="${DARK}" stroke-width="3" fill="none"/>`],
];

const gradient = ([a, b]) =>
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="128" height="128" fill="url(#g)"/>`;

const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">${inner}</svg>\n`;

AVATARS.forEach(([colors, glyph], index) => {
  const name = `a${String(index + 1).padStart(2, '0')}.svg`;
  writeFileSync(new URL(name, OUT), wrap(gradient(colors) + glyph));
});

// 기본 프로필: 아직 사진을 고르지 않은 사람 (회색 바탕의 사람 모양)
writeFileSync(
  new URL('default.svg', OUT),
  wrap(`<rect width="128" height="128" fill="#2a2f3a"/><circle cx="64" cy="52" r="19" fill="#8a93a5"/><path d="M26 118c0-24 17-36 38-36s38 12 38 36Z" fill="#8a93a5"/>`),
);

console.log(`프로필 사진 ${AVATARS.length}개와 기본 사진 1개를 만들었습니다: ${OUT.pathname}`);
