# License-Identifier: PolyForm-Noncommercial-1.0.0
# Copyright (c) 2026 Flavio Pendolino
# https://polyformproject.org/licenses/noncommercial/1.0.0
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
ENV DATA_DIR=/data PORT=8080 NODE_ENV=production
VOLUME /data
USER node
EXPOSE 8080
CMD ["node", "--no-warnings", "server/index.js"]
