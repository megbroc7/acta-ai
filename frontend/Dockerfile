FROM node:18 AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Set environment variables for the build
ARG REACT_APP_API_URL
ARG REACT_APP_NODE_ENV
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_NODE_ENV=${REACT_APP_NODE_ENV}

# Build the application
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy the build output
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"] 