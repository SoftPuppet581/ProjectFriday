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
  MODIFY COLUMN description MEDIUMTEXT NULL,
  ADD UNIQUE KEY IF NOT EXISTS uq_games_external_id (external_id),
  ADD KEY IF NOT EXISTS idx_games_rating (rating),
  ADD KEY IF NOT EXISTS idx_games_popularity (popularity);
