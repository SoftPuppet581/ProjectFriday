// 성인 콘텐츠 판별. 이 사이트에는 성인 게임/기사를 절대 싣지 않는다.
// 가져올 때 걸러내고(importService), 이미 저장된 것은 지운다(scripts/purgeAdult.js).
// ESRB 'Mature'(17+)는 폭력물(예: GTA)에도 붙는 등급이라 성인물로 보지 않는다. 'Adults Only'만 성인물로 본다.

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 영문 제목/문장에서 단어 단위로 찾는 말 (Sussex 같은 단어가 걸리지 않게 앞뒤 글자를 확인한다)
const WORDS = [
  'sex', 'sexy', 'sexual', 'erotic', 'erotica', 'hentai', 'nsfw', 'porn', 'porno', 'nude', 'nudes', 'naked',
  'waifu', 'lust', 'ecchi', 'lewd', 'seduce', 'seduction', 'harem', 'bikini', 'strip', 'stripper', 'flirt',
  'flirting', '18+', 'adult only', 'adults only',
  // 은어와 노골적인 말 ('naughty'는 Naughty Dog 같은 스튜디오 이름과 겹쳐서 일부러 뺐다)
  'gooning', 'gooner', 'goon cave', 'booty', 'thicc', 'busty', 'horny', 'kinky', 'fetish', 'bdsm', 'milf', 'futa', 'femboy', 'femboys',
  'asstethletes', 'assthletes', 'jiggle', 'oppai', 'lewds',
];
const WORD_RE = new RegExp(`(?<![a-z0-9])(?:${WORDS.map(escapeRegex).join('|')})(?![a-z0-9])`, 'i');

// 한국어/일본어/러시아어는 단어 경계가 없어서 포함 여부로 본다
const SUBSTRINGS = ['성인', '19금', '에로', '야겜', '섹시', '선정적', '成人', 'エロ', 'сексуальн', 'эротик', 'хентай', 'обнажённ', 'обнажен', 'для взрослых'];

// 태그는 이름이 정확히 같을 때만 본다.
// 'Mature'(폭력물에도 붙음)와 'Nudity'/'Partial Nudity'(GTA, GreedFall 같은 일반 대작에도 붙음)는 일부러 뺐다.
// 실제 성인 게임에는 'Sexual Content' 같은 태그가 붙어 있었다.
const ADULT_TAGS = new Set([
  'nsfw', 'hentai', 'erotic', 'sexual content', 'porn', 'pornographic', 'adult', 'adult content',
  'eroge', 'lewd', 'ecchi', 'sex', 'mature-content', 'explicit',
]);

// 설명문에서는 확실한 말만 본다 (오탐을 줄이려고 제목보다 좁게)
const STRONG_RE = /hentai|erotic|nsfw|pornograph|sexually explicit|sex scenes?|adult content|18\+/i;

export function isAdultText(text) {
  if (!text) return false;
  const value = String(text);
  return WORD_RE.test(value) || SUBSTRINGS.some((s) => value.toLowerCase().includes(s.toLowerCase()));
}

// game: { title, tags[], esrbRating, description }
export function adultReason(game) {
  if (game?.esrbRating === 'Adults Only') return 'ESRB Adults Only';
  const tag = (game?.tags ?? []).find((t) => ADULT_TAGS.has(String(t).trim().toLowerCase()) || SUBSTRINGS.some((s) => String(t).toLowerCase().includes(s)));
  if (tag) return `태그: ${tag}`;
  if (isAdultText(game?.title)) return '제목';
  if (game?.description && STRONG_RE.test(game.description)) return '설명';
  return null;
}

export const isAdultGame = (game) => adultReason(game) !== null;
