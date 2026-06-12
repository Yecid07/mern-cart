import express from 'express';
import dotenv from 'dotenv';
import { connectDB, readyStateToText, isDBConnected } from './config/db.js';
import productRoutes from './routes/product.routes.js';
import userRoutes from './routes/user.routes.js';
import orderRoutes from './routes/order.routes.js';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json()); //to parse JSON data from request body

// Middleware para registrar peticiones en los logs
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Version: ${process.env.API_VERSION}`);
    next();
});

// Endpoint de salud para validación de Canary Deployment y resiliencia de DB
app.get('/health', (req, res) => {
    const isReady = isDBConnected();
    const status = process.env.APP_STATUS || 'stable';
    const version = process.env.API_VERSION || 'v1.0.0';

    const response = {
        status: status,
        version: version,
        database: readyStateToText(mongoose.connection.readyState),
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    };

    // Incluir fecha de despliegue solo si es versión canary
    if (status === 'canary') {
        response.deploymentDate = process.env.DEPLOYMENT_DATE || '2026-06-01';
    }

    // 200 solo si MongoDB está realmente conectado; 503 (degradado) en caso contrario.
    const httpStatus = isReady ? 200 : 503;

    res.status(httpStatus).json(response);
});

app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Cart Course API v2.0 is running',
        env: process.env.NODE_ENV || 'development',
        versions: ['v1 (/api)', 'v2 (/api/v2)'],
    });
});

const apiRoutes = [
    { path: '/products', router: productRoutes },
    { path: '/users', router: userRoutes },
    { path: '/orders', router: orderRoutes }
];

// Registro dinámico de rutas para v1 y v2
apiRoutes.forEach(route => {
    app.use(`/api${route.path}`, route.router);
    app.use(`/api/v2${route.path}`, route.router);
});

// El servidor HTTP arranca SIEMPRE, aunque MongoDB no esté disponible.
// La conexión a la DB se inicia en paralelo y reintenta sola (backoff),
// de modo que / y /health respondan incluso en estado degradado.
const startServer = () => {
    const server = app.listen(PORT, () => {
        console.log(`Server started at http://localhost:${PORT}`);
    });

    // No se hace await: un fallo de DB no debe bloquear ni tumbar el arranque.
    connectDB();

    // Manejo de señales para cierre ordenado en Kubernetes
    process.on('SIGTERM', () => {
        console.log('SIGTERM recibida. Cerrando servidor...');
        server.close(() => {
            mongoose.connection.close(false, () => {
                console.log('Conexiones cerradas exitosamente.');
                process.exit(0);
            });
        });
    });

    return server;
};

// No arrancar el servidor durante los tests (se importa `app` directamente).
if (process.env.NODE_ENV !== 'test') {
    startServer();
}

export { app, startServer };
