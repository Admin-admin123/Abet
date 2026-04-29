BEGIN;

-- Add chosen_metrics array (replaces single chosen_metric)
ALTER TABLE course_faculty_config
  ADD COLUMN IF NOT EXISTS chosen_metrics TEXT[]  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS threshold       FLOAT   DEFAULT NULL;

-- Migrate existing single metric values into the array column
UPDATE course_faculty_config
SET chosen_metrics = ARRAY[chosen_metric]
WHERE chosen_metrics IS NULL;

-- Set NOT NULL + default after migration
ALTER TABLE course_faculty_config
  ALTER COLUMN chosen_metrics SET NOT NULL,
  ALTER COLUMN chosen_metrics SET DEFAULT ARRAY['QUIZ'];

COMMIT;
