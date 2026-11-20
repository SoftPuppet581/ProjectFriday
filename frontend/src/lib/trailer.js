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
