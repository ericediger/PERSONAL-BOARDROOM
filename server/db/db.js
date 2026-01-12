import Database from 'better-sqlite3';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Get database path from environment variable with fallback
const dbPath = process.env.DB_PATH || './data/board.db';

// Resolve relative paths from project root (two levels up from server/db/)
const resolvedPath = dbPath.startsWith('.')
  ? resolve(__dirname, '../..', dbPath)
  : dbPath;

const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');

export default db;
