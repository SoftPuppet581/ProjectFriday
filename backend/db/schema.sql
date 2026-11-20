CREATE TABLE IF NOT EXISTS games (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title           VARCHAR(200) NOT NULL,
  release_date    DATE NOT NULL,
  platforms       LONGTEXT NOT NULL DEFAULT '[]',
  genre           VARCHAR(50) NULL,
  description     TEXT NULL,
  trailer_url     VARCHAR(500) NULL,
  cover_image_url VARCHAR(500) NULL,
  official_url    VARCHAR(500) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_games_title_date (title, release_date),
  KEY idx_games_release_date (release_date),
  KEY idx_games_genre (genre),
  CONSTRAINT chk_games_platforms CHECK (JSON_VALID(platforms))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 실제 게임 정보(외부 API에서 가져온 데이터)를 담기 위한 확장 컬럼.
-- 여러 번 실행해도 안전하다 (IF NOT EXISTS).
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS genres        LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS tags          LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS developers    LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS publishers    LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS screenshots   LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS rating        DECIMAL(3,2) NULL,
  ADD COLUMN IF NOT EXISTS ratings_count INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS metacritic    TINYINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS esrb_rating   VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS playtime      INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS popularity    INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS external_id   INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS slug          VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS source_url    VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS source        VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS featured_order INT UNSIGNED NULL,
  ADD KEY IF NOT EXISTS idx_games_featured (featured_order),
  ADD COLUMN IF NOT EXISTS stores         LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS steam_app_id   INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS price_final    INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS price_initial  INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS price_discount_percent TINYINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS price_currency CHAR(3) NULL,
  ADD COLUMN IF NOT EXISTS price_formatted VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS price_updated_at DATETIME NULL,
  ADD KEY IF NOT EXISTS idx_games_steam_app (steam_app_id),
  ADD COLUMN IF NOT EXISTS details_checked TINYINT UNSIGNED NOT NULL DEFAULT 0,
  MODIFY COLUMN description MEDIUMTEXT NULL,
  ADD UNIQUE KEY IF NOT EXISTS uq_games_external_id (external_id),
  ADD KEY IF NOT EXISTS idx_games_rating (rating),
  ADD KEY IF NOT EXISTS idx_games_popularity (popularity);

-- 회원, 로그인 세션, 계정에 저장하는 관심 게임
-- (user_favorites.game_id에는 일부러 외래키를 두지 않았다: 성인 게임 삭제 등으로 games 행이 지워져도 에러가 나지 않게 하고,
--  목록을 만들 때는 games와 조인해서 없는 게임은 자연스럽게 빠진다)
CREATE TABLE IF NOT EXISTS users (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email              VARCHAR(190) NOT NULL,
  display_name       VARCHAR(40) NOT NULL,
  password_hash      VARCHAR(255) NOT NULL,
  preferred_platform VARCHAR(50) NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id    INT UNSIGNED NOT NULL,
  game_id    INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, game_id),
  KEY idx_favorites_game (game_id),
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 게임 뉴스: 여러 언론사 RSS에서 제목, 링크, 짧은 요약, 썸네일만 가져와 저장한다 (본문은 저장하지 않고 원문 링크로 보낸다)
CREATE TABLE IF NOT EXISTS news (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  source       VARCHAR(50) NOT NULL,
  language     VARCHAR(5) NOT NULL DEFAULT 'en',
  title        VARCHAR(300) NOT NULL,
  url          VARCHAR(500) NOT NULL,
  excerpt      VARCHAR(500) NULL,
  image_url    VARCHAR(500) NULL,
  published_at DATETIME NOT NULL,
  fetched_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_news_url (url),
  KEY idx_news_published (published_at),
  KEY idx_news_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
