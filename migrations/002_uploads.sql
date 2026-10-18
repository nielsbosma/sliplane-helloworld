CREATE TABLE uploads (
  id serial PRIMARY KEY,
  key text NOT NULL UNIQUE,
  filename text NOT NULL,
  content_type text NOT NULL,
  size integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
