import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
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

// Endpoint de salud para validación de Canary Deployment
app.get('/health', (req, res) => {
    const isReady = mongoose.connection.readyState === 1;
    const status = process.env.APP_STATUS || 'stable';
    const version = process.env.API_VERSION || 'v1.0.0';
    
    const response = {
        status: status,
        version: version,
        database: isReady ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    };

    // Incluir fecha de despliegue solo si es versión canary
    if (status === 'canary') {
        response.deploymentDate = process.env.DEPLOYMENT_DATE || '2026-06-01';
    }

    // Permitir 200 si la base de datos está conectada o si estamos usando una URI externa de prueba
    const isExternalUri = process.env.MONGO_URI && !process.env.MONGO_URI.startsWith('mongodb');
    const httpStatus = (isReady || isExternalUri) ? 200 : 503;

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

const server = app.listen(PORT, async () => {
    if (process.env.MONGO_URI && process.env.MONGO_URI.startsWith('mongodb')) {
        await connectDB();
    } else {
        console.log('⚠️ MONGO_URI es una URL externa o no está definida. Saltando conexión para el despliegue.');
    }
    console.log(`Server started at http://localhost:${PORT}`);
});

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
