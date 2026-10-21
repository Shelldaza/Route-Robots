// La configuración debe cargarse antes de evaluar los módulos de la API,
// porque algunos inicializan dependencias usando variables de entorno.
import 'dotenv/config';

import { createApp } from './app';

// Este archivo es el punto de entrada del proceso de producción y desarrollo.
// Configurar rutas y middleware pertenece a app.ts.
const app = createApp();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `Servidor de RouteRobots corriendo en http://localhost:${PORT}`,
    );
});