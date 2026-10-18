FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY migrations ./migrations
ARG VERSION=dev
ENV NODE_ENV=production PORT=3000 APP_VERSION=$VERSION
EXPOSE 3000
CMD ["node", "src/server.js"]
