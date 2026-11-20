// 트레일러를 어떻게 보여 줄지 정한다 (#4). (화면 코드 없음)
// RAWG가 영상 데이터를 거의 주지 않아서 trailerUrl은 대부분 null이다. 그때는 YouTube 검색 링크를 쓴다.
//
// 반환: { kind, src }
//   'video'   : <video controls src={src}> 로 재생
//   'youtube' : <iframe src={src}> 로 임베드 (src는 embed 주소로 바뀌어 있음)
//   'link'    : 알 수 없는 주소라서 새 탭으로 여는 링크만 제공
//   'search'  : 저장된 영상이 없을 때 YouTube 검색 결과를 새 탭으로 여는 링크 (game.trailerSearchUrl)
//   'none'    : 아무것도 보여 줄 수 없음 (영역을 숨긴다)

const YOUTUBE_ID = /(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/;
const VIDEO_FILE = /\.(mp4|webm)(\?|#|$)/i;

export function youtubeId(url) {
  return typeof url === 'string' ? (url.match(YOUTUBE_ID)?.[1] ?? null) : null;
}

// 메인(히어로)에서 소리 없이 자동 재생·반복할 YouTube 퍼가기 주소. YouTube 주소가 아니면 null.
// 브라우저 정책상 자동 재생은 음소거(mute=1) 상태에서만 된다. 쓰는 법:
//   <iframe src={heroEmbedUrl(game.trailerUrl)} allow="autoplay; encrypted-media" title="트레일러" />
// 캐러셀처럼 슬라이드를 직접 넘길 때는 { loop: false }를 주면 영상이 끝난 뒤 반복하지 않는다.
// start(초)를 주면 그 지점부터 재생한다 (인트로를 건너뛰고 하이라이트부터 보여 줄 때).
export function heroEmbedUrl(trailerUrl, { loop = true, start = 0 } = {}) {
  const id = youtubeId(trailerUrl);
  if (!id) return null;
  const params = new URLSearchParams({
    autoplay: '1', mute: '1', controls: '0',
    playsinline: '1', modestbranding: '1', rel: '0', iv_load_policy: '3', disablekb: '1',
  });
  if (loop) {
    params.set('loop', '1');
    params.set('playlist', id); // loop은 playlist에 같은 id를 넣어야 동작한다
  }
  if (start > 0) params.set('start', String(Math.floor(start)));
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

export function trailerInfo(game) {
  const url = game?.trailerUrl;
  if (url) {
    const youtube = url.match(YOUTUBE_ID);
    if (youtube) return { kind: 'youtube', src: `https://www.youtube.com/embed/${youtube[1]}` };
    if (VIDEO_FILE.test(url)) return { kind: 'video', src: url };
    return { kind: 'link', src: url };
  }
  if (game?.trailerSearchUrl) return { kind: 'search', src: game.trailerSearchUrl };
  return { kind: 'none', src: null };
}
