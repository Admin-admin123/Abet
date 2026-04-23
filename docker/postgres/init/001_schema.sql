BEGIN;

CREATE TABLE IF NOT EXISTS student_grades (
  id               BIGSERIAL PRIMARY KEY,
  term             VARCHAR(10) NOT NULL,
  program          VARCHAR(20) NOT NULL,
  student_id       VARCHAR(50) NOT NULL,
  student_name     TEXT,
  course_code      VARCHAR(20) NOT NULL,
  grade            VARCHAR(5),
  term_gpa         FLOAT,
  cumulative_gpa   FLOAT,
  repeat_flag      VARCHAR(20),
  units            INT,
  source_file      TEXT,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(term, student_id, course_code)
);

CREATE INDEX IF NOT EXISTS idx_student_grades_term_program
  ON student_grades (term, program);

CREATE INDEX IF NOT EXISTS idx_student_grades_student_id
  ON student_grades (student_id);

CREATE INDEX IF NOT EXISTS idx_student_grades_course_code
  ON student_grades (course_code);

CREATE TABLE IF NOT EXISTS so_mapping (
  id            BIGSERIAL PRIMARY KEY,
  course_code   VARCHAR(20) NOT NULL,
  course_name   TEXT,
  program       VARCHAR(20) NOT NULL,
  so_number     INT NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(course_code, program, so_number)
);

CREATE INDEX IF NOT EXISTS idx_so_mapping_lookup
  ON so_mapping (program, course_code, so_number);

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

CREATE TABLE IF NOT EXISTS so_attainment (
  id                 BIGSERIAL PRIMARY KEY,
  term               VARCHAR(10) NOT NULL,
  program            VARCHAR(20) NOT NULL,
  so_number          INT NOT NULL,
  attainment_rate    FLOAT NOT NULL,
  students_assessed  INT NOT NULL,
  students_attained  INT NOT NULL,
  meets_threshold    BOOLEAN NOT NULL,
  computed_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(term, program, so_number)
);

CREATE INDEX IF NOT EXISTS idx_so_attainment_term_program
  ON so_attainment (term, program, so_number);

CREATE TABLE IF NOT EXISTS upload_audit (
  id             BIGSERIAL PRIMARY KEY,
  uploaded_at    TIMESTAMP DEFAULT NOW(),
  file_name      TEXT,
  file_type      VARCHAR(40),
  term           VARCHAR(10),
  program        VARCHAR(20),
  rows_imported  INT DEFAULT 0,
  status         VARCHAR(20) DEFAULT 'SUCCESS',
  notes          TEXT
);

COMMIT;
