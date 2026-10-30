FROM node:26.13.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --no-audit --no-fund
COPY src ./src
RUN npm run build

FROM node:26.13.0-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY generators ./generators
COPY testnet-config.json ./
ENV FLEZHA_TESTNET_WS_PORT=4500 \
    FLEZHA_TESTNET_CONFIG=/app/testnet-config.json
EXPOSE 4500
USER node
# The testnet exits when its stdin closes, which is how a parent process stops
# it. A container has no such parent, so an endless stdin is piped in, and tini
# signals the whole group so `docker stop` reaches node.
ENTRYPOINT ["tini", "-g", "--"]
CMD ["sh", "-c", "tail -f /dev/null | node dist/index.js"]
