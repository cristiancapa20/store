import Database from "better-sqlite3"
import path from "path"
import fs from "fs"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"

const dbPath = path.join(process.cwd(), "data", "store.db")
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)
db.pragma("journal_mode = WAL")

// Organizations table (multi-tenant)
db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    address TEXT,
    plan TEXT NOT NULL DEFAULT 'basic' CHECK(plan IN ('basic', 'pro')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    inventory_org_id TEXT,
    inventory_api_key TEXT,
    inventory_location_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

// Users table — create fresh or migrate from old schema
const userCols = (
  db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
).map(c => c.name)

if (userCols.length === 0) {
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff'
        CHECK(role IN ('admin', 'staff', 'super_admin')),
      organization_id TEXT REFERENCES organizations(id)
    )
  `)
} else if (!userCols.includes("organization_id")) {
  // Migrate: add organization_id + expand role constraint
  db.exec(`DROP TABLE IF EXISTS users_v2`)
  db.exec(`
    CREATE TABLE users_v2 (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff'
        CHECK(role IN ('admin', 'staff', 'super_admin')),
      organization_id TEXT REFERENCES organizations(id)
    )
  `)
  db.exec(
    `INSERT INTO users_v2 (id, name, email, password_hash, role)
     SELECT id, name, email, password_hash, role FROM users`
  )
  db.exec(`DROP TABLE users`)
  db.exec(`ALTER TABLE users_v2 RENAME TO users`)
}

// Auto-seed super_admin from env vars on first boot
const superEmail = process.env.SUPER_ADMIN_EMAIL
const superPassword = process.env.SUPER_ADMIN_PASSWORD
if (superEmail && superPassword) {
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ? AND role = 'super_admin'")
    .get(superEmail)
  if (!existing) {
    const hash = bcrypt.hashSync(superPassword, 10)
    db.prepare(
      "INSERT INTO users (id, name, email, password_hash, role) VALUES (?, 'Super Admin', ?, ?, 'super_admin')"
    ).run(randomUUID(), superEmail, hash)
  }
}

export default db
