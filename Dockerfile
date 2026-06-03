FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev --ignore-scripts

COPY backend ./backend

EXPOSE 5000

CMD ["node", "backend/server.js"]