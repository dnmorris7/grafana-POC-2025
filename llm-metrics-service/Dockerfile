FROM node:18-alpine

WORKDIR /app

# Install curl for healthcheck (more secure than wget)
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Verify the build output exists
RUN ls -la dist/ && test -f dist/index.js

# Remove dev dependencies for production
RUN npm ci --only=production && npm cache clean --force

# Expose port
EXPOSE 8080

# Health check using curl instead of wget
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Run the application
CMD ["npm", "start"]
