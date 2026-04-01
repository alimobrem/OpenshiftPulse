# Dev server for integration tests
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 9000
CMD ["npm", "run", "dev"]
