# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.10.0
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Node.js"

# Set production environment
ENV NODE_ENV="production"


# Install pnpm
ARG PNPM_VERSION=9.12.2
RUN npm install -g pnpm@$PNPM_VERSION

# Throw-away build stage to reduce the size of the final image
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Set working directory to root
WORKDIR /app

# Copy package.json and pnpm-lock.yaml files
COPY --link package.json pnpm-lock.yaml ./

# Set environment variables from .env
ENV ACCOUNT_ID=""
ENV MONGO_URI=""
ENV SECRET_ACCESS_KEY=""
ENV ACCESS_KEY_ID=""
ENV WEBHOOK_SECRET=""

ENV EMAIL_HOST=""
ENV EMAIL_PORT=""
ENV EMAIL_USER=""
ENV EMAIL_PASSWORD=""
ENV EMAIL_FROM=""
ENV EMAIL_SECURE=""
ENV FRONTEND_DOMAIN=""
ENV BACKEND_URL=""

# Install dependencies
RUN pnpm install --force --prod=false

# Copy application code
COPY --link . /app

# Build application
RUN pnpm run build

# Remove development dependencies
RUN pnpm prune --prod

# Final stage for app image
FROM base

# Create app directory
WORKDIR /app

# Copy built application
COPY --from=build /app/dist .

# Install production dependencies
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json  ./package.json
COPY --from=build /app/pnpm-lock.yaml  ./pnpm-lock.yaml

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "node", "index.js" ]