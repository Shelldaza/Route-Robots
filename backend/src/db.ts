import 'dotenv/config';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('Se debe verificar DATABASE_URL en el backend.');
}

export const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
});

pool.on('error', (error: Error) => {
    console.error('Error en una conexión PostgreSQL:', error.message);
});