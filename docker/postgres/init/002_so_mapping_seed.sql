BEGIN;

-- Initial seed from your provided implementation guide.
-- Extend this list using your SO-Coverage-V2 source.
INSERT INTO so_mapping (course_code, course_name, program, so_number) VALUES
  ('AIE111', 'Artificial Intelligence',  'CSE', 1),
  ('AIE111', 'Artificial Intelligence',  'AIS', 1),
  ('AIE111', 'Artificial Intelligence',  'CE',  1),
  ('AIE111', 'Artificial Intelligence',  'AIE', 1),

  ('AIE121', 'Machine Learning',         'CSE', 2),
  ('AIE121', 'Machine Learning',         'CSE', 3),
  ('AIE121', 'Machine Learning',         'CSE', 5),
  ('AIE121', 'Machine Learning',         'AIS', 2),
  ('AIE121', 'Machine Learning',         'AIS', 3),
  ('AIE121', 'Machine Learning',         'AIS', 5),
  ('AIE121', 'Machine Learning',         'CE',  2),
  ('AIE121', 'Machine Learning',         'CE',  3),
  ('AIE121', 'Machine Learning',         'CE',  5),
  ('AIE121', 'Machine Learning',         'AIE', 2),
  ('AIE121', 'Machine Learning',         'AIE', 3),
  ('AIE121', 'Machine Learning',         'AIE', 5),

  -- Seed mapping for the attached local course export.
  ('CSE251', 'Software Engineering',     'CSE', 2),
  ('CSE251', 'Software Engineering',     'CSE', 3),
  ('CSE251', 'Software Engineering',     'CSE', 6)
ON CONFLICT DO NOTHING;

COMMIT;
