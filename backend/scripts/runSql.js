import 'dotenv/config';
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

const file = process.argv[2];
if (!file) {
  console.error('사용법: node scripts/runSql.js <sql 파일>');
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
  charset: 'utf8mb4',
});

try {
  await conn.query(readFileSync(file, 'utf8'));
  console.log(`실행 완료: ${file}`);
} finally {
  await conn.end();
}
