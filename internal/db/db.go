package db

import (
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

// DB wraps the sql.DB connection.
type DB struct {
	*sql.DB
}

// New opens a SQLite database at the given path and runs migrations.
func New(path string) (*DB, error) {
	sqldb, err := sql.Open("sqlite3", path+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	if err := sqldb.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}
	d := &DB{sqldb}
	if err := d.migrate(); err != nil {
		return nil, fmt.Errorf("migrate db: %w", err)
	}
	return d, nil
}

func (d *DB) migrate() error {
	_, err := d.Exec(`
	CREATE TABLE IF NOT EXISTS users (
		id           INTEGER PRIMARY KEY AUTOINCREMENT,
		username     TEXT    NOT NULL UNIQUE,
		password_hash TEXT   NOT NULL,
		role         TEXT    NOT NULL DEFAULT 'viewer',
		created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS sessions (
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		token_hash TEXT    NOT NULL UNIQUE,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS stacks (
		id           INTEGER PRIMARY KEY AUTOINCREMENT,
		name         TEXT    NOT NULL UNIQUE,
		compose_path TEXT    NOT NULL,
		created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`)
	return err
}

// HasUsers reports whether any users exist in the database.
func (d *DB) HasUsers() (bool, error) {
	var count int
	err := d.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
