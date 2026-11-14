CREATE TABLE IF NOT EXISTS practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language text NOT NULL CHECK (language IN ('cantonese', 'mandarin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
