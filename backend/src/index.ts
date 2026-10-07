import express, { Request, Response } from 'express';

// Inicializamos la aplicación de Express
const app = express();
// Definimos el puerto 
const PORT = process.env.PORT || 3000;

// Middleware para que el servidor entienda formato JSON
app.use(express.json());

// Endpoint de prueba (Health Check)
app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ 
        status: 'success', 
        message: 'API de RouteRobots funcionando correctamente con despliegue continuo' 
    });
});

// Arrancamos el servidor
app.listen(PORT, () => {
    console.log(`Servidor de RouteRobots corriendo en http://localhost:${PORT}`);
});