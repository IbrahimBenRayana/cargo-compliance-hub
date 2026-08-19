# CBP MQIPT bridge — Debian-based because IBM's MQ redistributable client
# (pulled by ibmmq's postinstall) is glibc-only and cannot run on the Alpine
# image the main app uses. This sidecar is the ONLY process with MQ libs.
FROM node:20-slim

# ibmmq postinstall fetches the MQ redist client over HTTPS.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# WORKDIR creates /app root-owned; npm runs as node below and needs to write.
RUN chown node:node /app

# Exact-pinned dependency (no lockfile: the dev machines are macOS, where the
# MQ redist postinstall cannot run). ibmmq's postinstall downloads the IBM MQ
# redistributable C client (~100 MB) into node_modules during this step.
COPY --chown=node:node package.json ./
USER node
RUN npm install --omit=dev --no-audit --no-fund

COPY --chown=node:node index.js ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
