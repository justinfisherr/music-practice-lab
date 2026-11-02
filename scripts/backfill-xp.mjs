// One-shot, idempotent backfill of practice.sessions.xp for rows written before
// XP existed. Rows that already have XP (or no `stages` payload) are skipped.
import pg from 'pg'
import { ensure } from '../api/sessions.js'
import { deriveXp } from '../lib/xp.js'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

await ensure()

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
})

try {
  const { rows } = await pool.query(
    "SELECT id, status, kind, payload FROM practice.sessions WHERE xp = 0 AND payload ? 'stages'",
  )
  let updated = 0
  for (const row of rows) {
    const xp = deriveXp(row.payload?.stages, row.status, row.kind)
    if (xp === 0) continue
    const result = await pool.query(
      'UPDATE practice.sessions SET xp = $1 WHERE id = $2 AND xp = 0',
      [xp, row.id],
    )
    updated += result.rowCount
  }
  console.log(JSON.stringify({ scanned: rows.length, updated }))
} finally {
  await pool.end()
}
