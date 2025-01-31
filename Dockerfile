# Stage 1: Install dependencies
FROM node:22-alpine AS dependencies-env
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application and generate Prisma Client
FROM node:22-alpine AS build-env
WORKDIR /app
COPY . .
COPY --from=dependencies-env /app/node_modules ./node_modules
RUN npx prisma generate
RUN npm run build

# Stage 3: Production-ready image
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=dependencies-env /app/node_modules ./node_modules
COPY --from=build-env /app/build ./build
COPY --from=build-env /app/prisma ./prisma  
COPY --from=build-env /app/.env .env      

# Ensure Prisma Client is generated again in case of runtime issues
RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "run", "start"]
