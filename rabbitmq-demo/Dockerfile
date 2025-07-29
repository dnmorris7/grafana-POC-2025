FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Clean up dev dependencies
RUN npm ci --only=production && npm cache clean --force

# Run the application
CMD ["npm", "start"]
