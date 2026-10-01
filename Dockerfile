# SPDX-License-Identifier: GPL-3.0-or-later
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY data ./data
COPY public ./public
ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/var
WORKDIR /app
COPY --from=build /app/package*.json ./
# tsx is required at runtime; retain the locked development dependencies.
RUN npm ci --include=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/data ./data
COPY docs/FAQ.md docs/PLAYING.md docs/ECONOMY.md ./docs/
COPY scripts/backup.ts scripts/npc.ts scripts/npc-smoke.ts scripts/npc-guide-smoke.ts scripts/npc-work-smoke.ts ./scripts/
COPY LICENSE COPYRIGHT THIRD_PARTY_NOTICES.md ./
RUN mkdir -p /app/var && chown node:node /app/var
USER node
EXPOSE 3000
VOLUME ["/app/var"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "src/server/main.ts"]
