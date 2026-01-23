FROM node:18-alpine

WORKDIR /app

# Copy package files first (for better caching)
COPY package.json package-lock.json ./

# Install dependencies (cached if package files don't change)
RUN npm ci

# Copy the rest of the code
COPY . .

# Build the app
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production

CMD [ "node", "-r", "dotenv/config", "build" ]