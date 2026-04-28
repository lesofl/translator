FROM oven/bun:1.3-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --ignore-scripts
COPY src/ ./src/
EXPOSE 5000
CMD ["bun", "src/index.ts"]
