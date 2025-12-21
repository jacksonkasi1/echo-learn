FROM oven/bun:1
WORKDIR /app

# Copy root workspace config
COPY package.json bun.lock turbo.json ./

# Copy packages and app source
COPY packages ./packages
COPY apps/server ./apps/server

# Install dependencies
RUN bun install

# Build the server
WORKDIR /app/apps/server
RUN bun run build

# Start the server
CMD ["bun", "run", "dist/index.js"]
