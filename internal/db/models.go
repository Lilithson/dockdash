package db

import (
	"database/sql"
	"fmt"
	"time"
)

// User represents a dockdash user.
type User struct {
	ID           int       `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}

// UserRepo provides CRUD operations for users.
type UserRepo struct {
	db *DB
}

// NewUserRepo creates a new UserRepo.
func NewUserRepo(db *DB) *UserRepo { return &UserRepo{db: db} }

// GetByUsername returns a user by username.
func (r *UserRepo) GetByUsername(username string) (*User, error) {
	u := &User{}
	err := r.db.QueryRow(
		`SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?`,
		username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return u, err
}

// GetByID returns a user by ID.
func (r *UserRepo) GetByID(id int) (*User, error) {
	u := &User{}
	err := r.db.QueryRow(
		`SELECT id, username, password_hash, role, created_at FROM users WHERE id = ?`,
		id,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return u, err
}

// Create inserts a new user and returns the created user.
func (r *UserRepo) Create(username, passwordHash, role string) (*User, error) {
	res, err := r.db.Exec(
		`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
		username, passwordHash, role,
	)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	id, _ := res.LastInsertId()
	return r.GetByID(int(id))
}

// List returns all users.
func (r *UserRepo) List() ([]User, error) {
	rows, err := r.db.Query(`SELECT id, username, password_hash, role, created_at FROM users ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// Delete removes a user by ID.
func (r *UserRepo) Delete(id int) error {
	_, err := r.db.Exec(`DELETE FROM users WHERE id = ?`, id)
	return err
}

// UpdatePassword sets a new password hash for a user.
func (r *UserRepo) UpdatePassword(id int, passwordHash string) error {
	_, err := r.db.Exec(`UPDATE users SET password_hash = ? WHERE id = ?`, passwordHash, id)
	return err
}

// Stack represents a docker-compose stack managed by dockdash.
type Stack struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	ComposePath string    `json:"compose_path"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// StackRepo provides CRUD operations for stacks.
type StackRepo struct {
	db *DB
}

// NewStackRepo creates a new StackRepo.
func NewStackRepo(db *DB) *StackRepo { return &StackRepo{db: db} }

// Create inserts a new stack record.
func (r *StackRepo) Create(name, composePath string) (*Stack, error) {
	res, err := r.db.Exec(
		`INSERT INTO stacks (name, compose_path) VALUES (?, ?)`,
		name, composePath,
	)
	if err != nil {
		return nil, fmt.Errorf("create stack: %w", err)
	}
	id, _ := res.LastInsertId()
	return r.getByID(int(id))
}

// GetByName returns a stack by name.
func (r *StackRepo) GetByName(name string) (*Stack, error) {
	s := &Stack{}
	err := r.db.QueryRow(
		`SELECT id, name, compose_path, created_at, updated_at FROM stacks WHERE name = ?`,
		name,
	).Scan(&s.ID, &s.Name, &s.ComposePath, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return s, err
}

func (r *StackRepo) getByID(id int) (*Stack, error) {
	s := &Stack{}
	err := r.db.QueryRow(
		`SELECT id, name, compose_path, created_at, updated_at FROM stacks WHERE id = ?`,
		id,
	).Scan(&s.ID, &s.Name, &s.ComposePath, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return s, err
}

// List returns all stacks.
func (r *StackRepo) List() ([]Stack, error) {
	rows, err := r.db.Query(`SELECT id, name, compose_path, created_at, updated_at FROM stacks ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var stacks []Stack
	for rows.Next() {
		var s Stack
		if err := rows.Scan(&s.ID, &s.Name, &s.ComposePath, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		stacks = append(stacks, s)
	}
	return stacks, rows.Err()
}

// Delete removes a stack by name.
func (r *StackRepo) Delete(name string) error {
	_, err := r.db.Exec(`DELETE FROM stacks WHERE name = ?`, name)
	return err
}

// Upsert inserts or updates a stack record (used when re-deploying).
func (r *StackRepo) Upsert(name, composePath string) (*Stack, error) {
	existing, err := r.GetByName(name)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		_, err = r.db.Exec(
			`UPDATE stacks SET compose_path = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?`,
			composePath, name,
		)
		if err != nil {
			return nil, err
		}
		return r.GetByName(name)
	}
	return r.Create(name, composePath)
}
