# Etapa 1: compila o TypeScript
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# Etapa 2: imagem final só com o JavaScript compilado e as dependências de produção
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# As migrações .sql não são compiladas pelo tsc, então são copiadas à parte.
COPY src/db/migrations ./dist/db/migrations
EXPOSE 3333
USER node
CMD ["node", "dist/server.js"]
