# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.10.0
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Node.js"

# Set production environment
ENV NODE_ENV="production"

# Install pnpm
ARG PNPM_VERSION=8.6.3
RUN npm install -g pnpm@$PNPM_VERSION

# Throw-away build stage to reduce the size of the final image
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Set working directory to root
WORKDIR /

# Copy package.json and pnpm-lock.yaml files
COPY --link package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Copy application code
COPY --link . .

# Build application
RUN pnpm run build

# Remove development dependencies
RUN pnpm prune --prod

# Final stage for app image
FROM base

# Create app directory
WORKDIR /app

# Copy built application
COPY --from=build /dist .

# Install production dependencies
COPY --from=build /node_modules ./node_modules
COPY --from=build /package.json  ./package.json
COPY --from=build /pnpm-lock.yaml  ./pnpm-lock.yaml

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "node", "index.js" ]