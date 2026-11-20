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
