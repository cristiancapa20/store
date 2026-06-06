import Database from "better-sqlite3"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"
import path from "path"
import fs from "fs"

const email = process.env.SUPER_ADMIN_EMAIL
const password = process.env.SUPER_ADMIN_PASSWORD

if (!email || !password) {
  console.error("Error: SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set")
  process.exit(1)
}

const dbPath = path.join(process.cwd(), "data", "store.db")
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)
db.pragma("journal_mode = WAL")

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

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff'
      CHECK(role IN ('admin', 'staff', 'super_admin')),
    organization_id TEXT REFERENCES organizations(id)
  )
`)

const existing = db.prepare("SELECT id FROM users WHERE email = ? AND role = 'super_admin'").get(email)
if (existing) {
  console.log(`Super admin already exists: ${email}`)
  process.exit(0)
}

const hash = bcrypt.hashSync(password, 12)
const id = randomUUID()

db.prepare(
  "INSERT INTO users (id, name, email, password_hash, role, organization_id) VALUES (?, ?, ?, ?, 'super_admin', NULL)"
).run(id, "Super Admin", email, hash)

console.log(`Super admin created: ${email} (id: ${id})`)
