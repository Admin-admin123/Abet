BEGIN;

CREATE TABLE IF NOT EXISTS faculties (
  id          BIGSERIAL   PRIMARY KEY,
  code        VARCHAR(20) NOT NULL,
  name        TEXT        NOT NULL DEFAULT '',
  description TEXT        NOT NULL DEFAULT '',
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  CONSTRAINT faculties_code_unique UNIQUE (code),
  CONSTRAINT faculties_code_format CHECK (code ~ '^[A-Z0-9]{1,20}$')
);

CREATE INDEX IF NOT EXISTS idx_faculties_active ON faculties (active, code);

INSERT INTO faculties (code, name, active) VALUES
  ('AIE',  'Artificial Intelligence Engineering', TRUE),
  ('AIS',  'Artificial Intelligence Systems',     TRUE),
  ('CE',   'Computer Engineering',                TRUE),
  ('CSE',  'Computer Science and Engineering',    TRUE),
  ('ADDA', 'Architecture and Digital Design Art', TRUE),
  ('CONS', 'Construction Engineering',            TRUE)
ON CONFLICT (code) DO NOTHING;

COMMIT;
