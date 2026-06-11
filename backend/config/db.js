import mongoose from 'mongoose';

const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

const CONNECT_OPTIONS = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
};

let listenersRegistered = false;

// Mapea mongoose.connection.readyState a un texto legible.
// 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
export const readyStateToText = (state) => {
    switch (state) {
        case 0:
            return 'disconnected';
        case 1:
            return 'connected';
        case 2:
            return 'connecting';
        case 3:
            return 'disconnecting';
        default:
            return 'unknown';
    }
};

export const isDBConnected = () => mongoose.connection.readyState === 1;

const registerConnectionListeners = () => {
    if (listenersRegistered) return;
    listenersRegistered = true;

    mongoose.connection.on('connected', () => console.log('[MongoDB] connected'));
    mongoose.connection.on('reconnected', () => console.log('[MongoDB] reconnected'));
    mongoose.connection.on('disconnected', () => console.warn('[MongoDB] disconnected'));
    mongoose.connection.on('error', (err) => console.error(`[MongoDB] error: ${err.message}`));
};

// Intenta conectar y reprograma el siguiente intento con backoff exponencial
// (tope MAX_RETRY_DELAY_MS) si falla. NUNCA llama process.exit: un fallo
// temporal no debe matar la API. Una vez conectado, Mongoose maneja la
// reconexión automática.
export const connectWithRetry = async (attempt = 1) => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, CONNECT_OPTIONS);
        console.log(`[MongoDB] Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        const delay = Math.min(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
        console.error(
            `[MongoDB] connection attempt ${attempt} failed: ${error.message}. ` +
            `Retrying in ${delay / 1000}s...`
        );
        setTimeout(() => connectWithRetry(attempt + 1), delay).unref?.();
        return null;
    }
};

export const connectDB = async () => {
    registerConnectionListeners();
    return connectWithRetry();
};
