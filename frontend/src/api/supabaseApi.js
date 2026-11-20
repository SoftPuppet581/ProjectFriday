// Supabase 연결 API (화면 코드 없음). 게임/뉴스/달력 같은 읽기는 `base`(정적 스냅샷 API)에 맡기고,
// 회원, 프로필, 관심 게임, 포럼만 Supabase(로그인 = GoTrue, 데이터 = PostgREST)로 처리한다. 응답 모양은 api/client.js의 `api`와 같다.
// 필요한 설정: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (공개되어도 되는 값. RLS가 본인 행만 쓰게 막는다). 스키마: supabase/schema.sql
import { ApiError } from './errors.js';

const SESSION_KEY = 'gamecal.sb';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const AVATAR_RE = /^a(0[1-9]|1\d|20)$/;
const FETCH_LIMIT = 500; // 포럼 글은 한 번에 이만큼 가져와서 이 안에서 검색, 정렬, 쪽 나누기를 한다 (실습 규모)

const defaultStorage = () => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

const fieldError = (field, message) => new ApiError(400, '입력값이 올바르지 않습니다.', [{ field, message }]);
const notFound = (what, id) => new ApiError(404, `id ${id} ${what}을(를) 찾을 수 없습니다.`);
const author = (profile, id) => ({ id: profile?.id ?? id, displayName: profile?.display_name ?? '탈퇴한 사용자', avatar: profile?.avatar ?? null });

export function createSupabaseApi({ url, anonKey, base, fetchImpl = (...args) => fetch(...args), storage = defaultStorage(), now = () => Date.now() }) {
  const root = url.replace(/\/+$/, '');
  let session = null; // { accessToken, refreshToken, expiresAt(ms), user: { id, email } }
  let loaded = false;

  function readSession() {
    if (loaded) return session;
    loaded = true;
    try {
      const parsed = JSON.parse(storage?.getItem(SESSION_KEY) ?? 'null');
      if (parsed?.accessToken && parsed?.refreshToken && parsed?.user?.id) session = parsed;
    } catch {
      session = null;
    }
    return session;
  }

  function writeSession(next) {
    session = next;
    loaded = true;
    try {
      if (next) storage?.setItem(SESSION_KEY, JSON.stringify(next));
      else storage?.removeItem(SESSION_KEY);
    } catch {
      // 저장이 막혀 있어도 이번 방문 동안은 메모리로 로그인이 유지된다
    }
  }

  async function send(path, { method = 'GET', body, token = anonKey, headers = {} } = {}) {
    let response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        method,
        // 새 방식 키(sb_publishable_...)는 JWT가 아니라서 Authorization에 넣지 않고 apikey 헤더로만 보낸다
        headers: { apikey: anonKey, ...(token === anonKey && anonKey.startsWith('sb_') ? {} : { Authorization: `Bearer ${token}` }), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.');
    }
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const message = data?.msg ?? data?.message ?? data?.error_description ?? data?.error ?? `요청이 실패했습니다. (HTTP ${response.status})`;
      throw Object.assign(new ApiError(response.status, message), { code: data?.error_code ?? data?.code });
    }
    return { data, response };
  }

  function toSession(data) {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: now() + Math.max(30, (data.expires_in ?? 3600) - 30) * 1000,
      user: { id: data.user.id, email: data.user.email },
    };
  }

  // 만료됐으면 갱신해서 쓸 수 있는 로그인 정보를 돌려준다. 로그인 안 했거나 갱신이 안 되면 401
  async function authed() {
    const current = readSession();
    if (!current) throw new ApiError(401, '로그인이 필요합니다.');
    if (current.expiresAt > now()) return current;
    try {
      const { data } = await send('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: current.refreshToken } });
      const next = toSession(data);
      writeSession(next);
      return next;
    } catch (error) {
      if (error.status !== 0) writeSession(null); // 네트워크 문제가 아니면 로그인이 풀린 것
      throw error.status === 0 ? error : new ApiError(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.');
    }
  }

  async function rest(path, options = {}) {
    const { accessToken } = await authed();
    return send(`/rest/v1/${path}`, { ...options, token: accessToken });
  }

  // 읽기: 로그인 안 했어도 anon 키로 된다. 로그인했으면 내 "좋아요 여부"를 알 수 있게 토큰을 쓴다
  async function readRest(path) {
    let token = anonKey;
    if (readSession()) {
      try {
        token = (await authed()).accessToken;
      } catch {
        token = anonKey;
      }
    }
    return send(`/rest/v1/${path}`, { token });
  }

  const myId = () => readSession()?.user.id ?? null;

  function toUser(profile, email) {
    return { id: profile.id, email, displayName: profile.display_name, avatar: profile.avatar, preferredPlatform: profile.preferred_platform, createdAt: profile.created_at };
  }

  async function fetchProfile(id) {
    const { data } = await rest(`profiles?id=eq.${id}&select=*`);
    if (!data?.[0]) throw new ApiError(401, '프로필을 찾을 수 없습니다. 다시 로그인해 주세요.');
    return data[0];
  }

  function authResult(next, profile) {
    return { token: next.accessToken, expiresAt: new Date(next.expiresAt).toISOString(), user: toUser(profile, next.user.email) };
  }

  // profiles!user_id: 글/댓글과 프로필 사이에는 좋아요, 댓글을 거치는 경로도 있어서 어느 연결인지 지정해야 한다
  const POST_SELECT = 'id,category,title,body,game_id,game_title,created_at,user_id,profiles!user_id(id,display_name,avatar),forum_comments(id),forum_likes(user_id)';

  function mapPost(row, withBody) {
    const viewer = myId();
    const likes = row.forum_likes ?? [];
    const post = {
      id: row.id,
      category: row.category,
      title: row.title,
      author: author(row.profiles, row.user_id),
      game: row.game_id && row.game_title ? { id: row.game_id, title: row.game_title } : null,
      createdAt: row.created_at,
      commentCount: (row.forum_comments ?? []).length,
      likeCount: likes.length,
      liked: viewer !== null && likes.some((like) => like.user_id === viewer),
      mine: viewer !== null && row.user_id === viewer,
    };
    if (withBody) post.body = row.body;
    else post.excerpt = [...row.body].slice(0, 140).join('');
    return post;
  }

  async function forumPost(id) {
    if (!/^[1-9]\d*$/.test(String(id))) throw notFound('글', id);
    const { data } = await readRest(`forum_posts?id=eq.${id}&select=${POST_SELECT.replace('forum_comments(id)', 'forum_comments(id,body,created_at,user_id,profiles!user_id(id,display_name,avatar))')}&forum_comments.order=created_at.asc,id.asc`);
    if (!data?.[0]) throw notFound('글', id);
    const viewer = myId();
    return {
      ...mapPost(data[0], true),
      comments: (data[0].forum_comments ?? []).map((comment) => ({
        id: comment.id, body: comment.body, author: author(comment.profiles, comment.user_id), createdAt: comment.created_at, mine: viewer !== null && comment.user_id === viewer,
      })),
    };
  }

  const reject = (error) => {
    if (error instanceof ApiError && error.status === 401) writeSession(null);
    throw error;
  };

  return {
    ...base,
    readOnly: false,

    // ---- 회원 ----
    async signup({ email, password, displayName }) {
      const mail = String(email ?? '').trim().toLowerCase();
      const name = String(displayName ?? '').trim();
      if (!mail || mail.length > 190 || !EMAIL_RE.test(mail)) throw fieldError('email', '올바른 이메일 주소를 입력해 주세요.');
      if (!name || [...name].length > 40) throw fieldError('displayName', '닉네임은 1~40자로 입력해 주세요.');
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw fieldError('password', '비밀번호는 8~128자로 입력해 주세요.');
      if (!/[A-Za-z가-힣]/.test(password) || !/\d/.test(password)) throw fieldError('password', '비밀번호에 글자와 숫자를 모두 넣어 주세요.');

      let data;
      try {
        ({ data } = await send('/auth/v1/signup', { method: 'POST', body: { email: mail, password, data: { display_name: name } } }));
      } catch (error) {
        if (error.code === 'weak_password') throw fieldError('password', '더 안전한 비밀번호를 사용해 주세요.');
        if (error.code === 'user_already_exists' || error.status === 422) throw new ApiError(409, '이미 가입된 이메일입니다.');
        if (error.status === 429) throw new ApiError(429, '잠시 후 다시 시도해 주세요. (요청이 너무 많아요)');
        throw error;
      }
      if (!data?.access_token) throw new ApiError(500, '가입은 됐지만 바로 로그인되지 않았어요. Supabase의 "Confirm email" 설정을 꺼 주세요.');
      const next = toSession(data);
      writeSession(next);
      return authResult(next, await fetchProfile(next.user.id).catch(() => ({ id: next.user.id, display_name: name, avatar: null, preferred_platform: null, created_at: new Date(now()).toISOString() })));
    },

    async login({ email, password }) {
      const mail = String(email ?? '').trim().toLowerCase();
      if (!mail) throw fieldError('email', '이메일을 입력해 주세요.');
      if (typeof password !== 'string' || !password) throw fieldError('password', '비밀번호를 입력해 주세요.');
      let data;
      try {
        ({ data } = await send('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: mail, password } }));
      } catch (error) {
        if (error.status === 400 || error.status === 401) throw new ApiError(401, '이메일 또는 비밀번호가 맞지 않습니다.');
        if (error.status === 429) throw new ApiError(429, '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.');
        throw error;
      }
      const next = toSession(data);
      writeSession(next);
      return authResult(next, await fetchProfile(next.user.id));
    },

    async logout() {
      const current = readSession();
      writeSession(null);
      if (current) await send('/auth/v1/logout', { method: 'POST', token: current.accessToken }).catch(() => {});
      return null;
    },

    async me() {
      const current = await authed().catch(reject);
      return toUser(await fetchProfile(current.user.id).catch(reject), current.user.email);
    },

    async updateMe(changes) {
      const patch = {};
      if (changes.displayName !== undefined) {
        const name = String(changes.displayName).trim();
        if (!name || [...name].length > 40) throw fieldError('displayName', '닉네임은 1~40자로 입력해 주세요.');
        patch.display_name = name;
      }
      if (changes.avatar !== undefined) {
        if (changes.avatar !== null && !(typeof changes.avatar === 'string' && AVATAR_RE.test(changes.avatar))) throw fieldError('avatar', 'a01~a20 중 하나이거나 null(기본 사진)이어야 합니다.');
        patch.avatar = changes.avatar;
      }
      if (changes.preferredPlatform !== undefined) {
        const p = changes.preferredPlatform;
        if (p !== null && (typeof p !== 'string' || !p.trim() || p.length > 50)) throw fieldError('preferredPlatform', '50자 이하의 문자열이거나 null이어야 합니다.');
        patch.preferred_platform = p === null ? null : p.trim();
      }
      const current = await authed().catch(reject);
      if (!Object.keys(patch).length) return toUser(await fetchProfile(current.user.id), current.user.email);
      const { data } = await rest(`profiles?id=eq.${current.user.id}`, { method: 'PATCH', body: patch, headers: { Prefer: 'return=representation' } }).catch(reject);
      return toUser(data[0], current.user.email);
    },

    // ---- 관심 게임 (계정에 저장) ----
    async myFavoriteIds() {
      const { data } = await rest('user_favorites?select=game_id&order=created_at.desc,game_id.desc').catch(reject);
      return data.map((row) => row.game_id);
    },
    async myFavorites() {
      const ids = await this.myFavoriteIds();
      return ids.length ? (await base.listGames({ ids, limit: 500, sort: 'releaseDate' })).items : [];
    },
    async addFavorite(gameId) {
      await rest('user_favorites', { method: 'POST', body: { game_id: Number(gameId) }, headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' } }).catch(reject);
      return null;
    },
    async removeFavorite(gameId) {
      await rest(`user_favorites?game_id=eq.${Number(gameId)}`, { method: 'DELETE' }).catch(reject);
      return null;
    },
    async mergeFavorites(gameIds) {
      const ids = [...new Set(gameIds)].filter((id) => Number.isInteger(id) && id > 0).slice(0, 500);
      if (ids.length) {
        await rest('user_favorites', { method: 'POST', body: ids.map((id) => ({ game_id: id })), headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' } }).catch(reject);
      }
      return this.myFavoriteIds();
    },

    // ---- 포럼 ----
    async forumPosts({ category, q, gameId, sort = 'recent', limit = 20, page = 1 } = {}) {
      const filters = [];
      if (category) filters.push(`category=eq.${encodeURIComponent(category)}`);
      if (gameId) filters.push(`game_id=eq.${Number(gameId)}`);
      const { data } = await readRest(`forum_posts?select=${POST_SELECT}${filters.length ? `&${filters.join('&')}` : ''}&order=created_at.desc,id.desc&limit=${FETCH_LIMIT}`);
      const needle = q?.toLowerCase();
      const all = data
        .filter((row) => !needle || row.title.toLowerCase().includes(needle) || row.body.toLowerCase().includes(needle))
        .map((row) => mapPost(row, false));
      if (sort === 'popular') all.sort((a, b) => (b.likeCount * 2 + b.commentCount) - (a.likeCount * 2 + a.commentCount) || b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
      return { items: all.slice((page - 1) * limit, page * limit), total: all.length };
    },
    forumPost,

    async createForumPost({ category, title, body, gameId, gameTitle }) {
      const row = { category, title: String(title ?? '').trim(), body: String(body ?? '').trim() };
      if (!['자유', '질문', '추천', '공략'].includes(row.category)) throw fieldError('category', '분류를 골라 주세요.');
      if (!row.title || [...row.title].length > 100) throw fieldError('title', '제목은 1~100자로 입력해 주세요.');
      if (!row.body || [...row.body].length > 3000) throw fieldError('body', '내용은 1~3000자로 입력해 주세요.');
      if (gameId && gameTitle) Object.assign(row, { game_id: Number(gameId), game_title: String(gameTitle) });
      const { data } = await rest('forum_posts?select=id', { method: 'POST', body: row, headers: { Prefer: 'return=representation' } }).catch(reject);
      return forumPost(data[0].id);
    },
    async deleteForumPost(id) {
      await rest(`forum_posts?id=eq.${Number(id)}`, { method: 'DELETE' }).catch(reject);
      return null;
    },
    async addForumComment(postId, body) {
      const text = String(body ?? '').trim();
      if (!text || [...text].length > 1000) throw fieldError('body', '댓글은 1~1000자로 입력해 주세요.');
      const { data } = await rest('forum_comments?select=id,body,created_at,user_id,profiles!user_id(id,display_name,avatar)', {
        method: 'POST', body: { post_id: Number(postId), body: text }, headers: { Prefer: 'return=representation' },
      }).catch(reject);
      const row = data[0];
      return { id: row.id, body: row.body, author: author(row.profiles, row.user_id), createdAt: row.created_at, mine: true };
    },
    async deleteForumComment(postId, commentId) {
      await rest(`forum_comments?id=eq.${Number(commentId)}&post_id=eq.${Number(postId)}`, { method: 'DELETE' }).catch(reject);
      return null;
    },
    async likeForumPost(id) {
      await rest('forum_likes', { method: 'POST', body: { post_id: Number(id) }, headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' } }).catch(reject);
      return null;
    },
    async unlikeForumPost(id) {
      await rest(`forum_likes?post_id=eq.${Number(id)}`, { method: 'DELETE' }).catch(reject);
      return null;
    },
  };
}
