import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('data/green_auto_india.sqlite');
const db = new Database(dbPath);

// 1. Flush WAL into main SQLite file so the .sqlite binary is 100% self-contained
const walRes = db.pragma('wal_checkpoint(FULL)');
console.log('WAL checkpoint result:', walRes);

// 2. Export human-readable SQL dump and CSV files for GitHub browser visibility
const tables = db
  .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all() as { name: string; sql: string }[];

const csvDir = path.resolve('data/csv_exports');
fs.mkdirSync(csvDir, { recursive: true });

let sqlDump =
  '-- Green Auto India — Complete SQLite Schema & Data Dump\n' +
  '-- Generated for human-readable inspection on GitHub\n\n' +
  'BEGIN TRANSACTION;\n\n';

for (const t of tables) {
  sqlDump += t.sql + ';\n\n';
  const rows = db.prepare('SELECT * FROM ' + t.name).all() as Record<string, unknown>[];
  console.log(`Table ${t.name}: ${rows.length} rows`);
  if (rows.length > 0) {
    const cols = Object.keys(rows[0]);
    const csvLines = [cols.join(',')];
    for (const r of rows) {
      const vals = cols.map((c) => {
        const v = r[c];
        if (v === null || v === undefined) return '';
        const s = String(v).replace(/"/g, '""');
        return /[,\n\r"]/.test(s) ? `"${s}"` : s;
      });
      csvLines.push(vals.join(','));

      const sqlVals = cols.map((c) => {
        const v = r[c];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return String(v);
        return "'" + String(v).replace(/'/g, "''") + "'";
      });
      sqlDump += `INSERT INTO ${t.name} (${cols.join(', ')}) VALUES (${sqlVals.join(', ')});\n`;
    }
    fs.writeFileSync(path.join(csvDir, `${t.name}.csv`), csvLines.join('\n'), 'utf8');
    sqlDump += '\n';
  }
}

sqlDump += 'COMMIT;\n';
fs.writeFileSync(path.resolve('data/green_auto_india_dump.sql'), sqlDump, 'utf8');
db.close();
console.log('Successfully generated data/green_auto_india_dump.sql and data/csv_exports/*.csv');
