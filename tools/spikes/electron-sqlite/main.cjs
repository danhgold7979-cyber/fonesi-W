const { app } = require('electron');
const { join } = require('node:path');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');

app.whenReady().then(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'autoreels-electron-sqlite-'));
  let db;
  try {
    const { DatabaseSync, backup } = require('node:sqlite');
    const path = join(dir, 'smoke.sqlite');
    db = new DatabaseSync(path);
    db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE data(id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;');
    db.prepare('INSERT INTO data VALUES(?,?)').run('workflow_1', 'Tiếng Việt 🎬');
    db.exec('BEGIN IMMEDIATE'); db.prepare('INSERT INTO data VALUES(?,?)').run('rollback', 'no'); db.exec('ROLLBACK');
    if (db.prepare('SELECT count(*) AS n FROM data').get().n !== 1) throw new Error('Rollback failed');
    await backup(db, join(dir, 'backup.sqlite'));
    db.close(); db = new DatabaseSync(path);
    if (db.prepare('SELECT value FROM data WHERE id=?').get('workflow_1').value !== 'Tiếng Việt 🎬') throw new Error('Reopen failed');
    const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
    if (integrity !== 'ok') throw new Error('Integrity failed');
    db.close(); db = undefined;
    const restored = new DatabaseSync(join(dir, 'backup.sqlite'));
    if (restored.prepare('SELECT count(*) AS n FROM data').get().n !== 1) throw new Error('Backup failed');
    restored.close();
    const report = { scope: 'ELECTRON_SQLITE_MAIN_PROCESS_SMOKE', status: 'PASS', platform: process.platform, arch: process.arch, electron: process.versions.electron, node: process.versions.node, sqlite: process.versions.sqlite, checks: ['WAL', 'Unicode', 'transaction rollback', 'close/reopen', 'online backup', 'integrity'], windowsAcceptance: process.platform === 'win32' ? 'SMOKE_ONLY' : 'NOT_RUN' };
    const output = process.argv.find(a => a.startsWith('--receipt='));
    if (output) writeFileSync(output.slice(10), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report)); app.exit(0);
  } catch (e) { console.error(e); app.exit(1); }
  finally { if (db) db.close(); rmSync(dir, { recursive: true, force: true }); }
});
