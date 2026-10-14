import { pool } from '../db';

async function checkDatabase() {
    try {
        await pool.query('SELECT 1 AS connected');
        console.log('Conexión con PostgreSQL en Neon correcta.');
    } catch (error) {
        console.error(
            'No se pudo conectar con PostgreSQL:',
            error instanceof Error ? error.message : 'Error desconocido',
        );

        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

void checkDatabase();