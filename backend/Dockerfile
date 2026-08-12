# Use Node.js 20 Alpine for lightweight production build
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=5000

# Expose backend port
EXPOSE 5000

# Run container as non-root user for security
USER node

# Start Express server
CMD ["node", "server.js"]
