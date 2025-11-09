DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    pwd   TEXT NOT NULL,
    is_new INTEGER DEFAULT 1
);

INSERT INTO users (name, email, pwd) VALUES ("Andrew M.", "a@a.a", "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb");