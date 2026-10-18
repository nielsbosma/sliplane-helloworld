FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY migrations ./migrations
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
