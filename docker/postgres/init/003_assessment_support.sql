BEGIN;

CREATE TABLE IF NOT EXISTS assessment_scores (
  id                 BIGSERIAL PRIMARY KEY,
  term               VARCHAR(10) NOT NULL,
  program            VARCHAR(20) NOT NULL,
  student_id         VARCHAR(50) NOT NULL,
  student_name       TEXT,
  course_code        VARCHAR(20) NOT NULL,
  assessment_name    VARCHAR(120) NOT NULL,
  assessment_type    VARCHAR(50),
  score_percent      FLOAT,
  source_file        TEXT,
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW(),
  UNIQUE(term, student_id, course_code, assessment_name)
);

CREATE INDEX IF NOT EXISTS idx_assessment_scores_term_program
  ON assessment_scores (term, program, course_code, assessment_name);

CREATE INDEX IF NOT EXISTS idx_assessment_scores_student
  ON assessment_scores (student_id, term, program);

CREATE TABLE IF NOT EXISTS assessment_so_mapping (
  id                 BIGSERIAL PRIMARY KEY,
  course_code        VARCHAR(20) NOT NULL,
  program            VARCHAR(20) NOT NULL,
  assessment_name    VARCHAR(120) NOT NULL,
  assessment_type    VARCHAR(50),
  so_number          INT NOT NULL,
  created_at         TIMESTAMP DEFAULT NOW(),
  UNIQUE(course_code, program, assessment_name, so_number)
);

CREATE INDEX IF NOT EXISTS idx_assessment_so_mapping_lookup
  ON assessment_so_mapping (program, course_code, assessment_name, so_number);

COMMIT;
