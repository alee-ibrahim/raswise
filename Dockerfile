FROM node:26-alpine

# Node 25+ no longer ships corepack, so install the pinned pnpm directly
RUN npm install -g pnpm@12.21.0

WORKDIR /app

# Copy package files first (for better caching)
COPY package.json pnpm-lock.yaml ./

# Install dependencies (cached if package files don't change)
RUN pnpm install --frozen-lockfile

# Copy the rest of the code
COPY . .

# Build the app
RUN pnpm build

EXPOSE 3000

ENV NODE_ENV=production

CMD [ "node", "-r", "dotenv/config", "build" ]
