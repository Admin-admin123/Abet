BEGIN;

CREATE TABLE IF NOT EXISTS course_faculty_config (
  id            BIGSERIAL PRIMARY KEY,
  course_code   VARCHAR(20) NOT NULL,
  faculty       VARCHAR(20) NOT NULL,
  chosen_s      INT NOT NULL CHECK (chosen_s >= 1 AND chosen_s <= 6),
  chosen_metric VARCHAR(50) NOT NULL DEFAULT 'QUIZ',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(course_code, faculty)
);

CREATE INDEX IF NOT EXISTS idx_course_faculty_config_lookup
  ON course_faculty_config (faculty, course_code);

COMMIT;
