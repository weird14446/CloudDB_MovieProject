import mysql, { Pool, PoolOptions } from "mysql2/promise";

let pool: Pool | null = null;

function getConfig(): PoolOptions {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error(
      "DB 연결 정보가 설정되지 않았습니다. 환경 변수(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)를 확인하세요."
    );
  }
  return {
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  };
}

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool(getConfig());
  }
  return pool;
}

export async function withConnection<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
}
