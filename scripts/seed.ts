import Database from "better-sqlite3"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"
import path from "path"
import fs from "fs"

const email = process.env.SEED_ADMIN_EMAIL
const password = process.env.SEED_ADMIN_PASSWORD
const name = process.env.SEED_ADMIN_NAME ?? "Admin"

if (!email || !password) {
  console.error("Error: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set")
  process.exit(1)
}

const dbPath = path.join(process.cwd(), "data", "store.db")
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)
db.pragma("journal_mode = WAL")

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff'
      CHECK(role IN ('admin', 'staff'))
  )
`)

const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email)
if (existing) {
  console.log(`Admin user already exists: ${email}`)
  process.exit(0)
}

const passwordHash = bcrypt.hashSync(password, 12)
const id = randomUUID()

db.prepare(
  "INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)"
).run(id, name, email, passwordHash, "admin")

console.log(`Admin user created: ${email} (id: ${id})`)
