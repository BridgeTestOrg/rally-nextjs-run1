CREATE TABLE waitlist (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL CHECK (city IN ('highlands-ranch','santa-monica','hoboken')),
  level TEXT NOT NULL CHECK (level IN ('new','mid','pro')),
  created_at TEXT NOT NULL
);

CREATE INDEX waitlist_city ON waitlist(city);
