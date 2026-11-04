# CVE-2026-111497 (GHSA-9v8h-qqgm-4m35): Node 22.x before 22.23.4 has an
# out-of-bounds write in the bundled Brotli decoder. Do not float this tag
# back to node:22-bookworm-slim; a rebuild would be able to pick a vulnerable
# patch again. 22.23.4 is the October 2026 security release for the 22.x line.
FROM node:22.23.4-bookworm-slim
RUN node -e 'const [major, minor, patch] = process.versions.node.split(".").map(Number); const patched = major > 22 || (major === 22 && (minor > 23 || (minor === 23 && patch >= 4))); if (!patched) { console.error("Node " + process.versions.node + " is below 22.23.4 (CVE-2026-111497)"); process.exit(1); }'
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ARG GCP_PROJECT_ID=montano-349204
ENV NODE_ENV=production
ENV PORT=8080
ENV GCP_PROJECT_ID=$GCP_PROJECT_ID
ENV REGION=us-central1
ENV GCP_LOCATION=us-central1
ENV SPEECH_LOCATION=us
ENV GCS_BUCKET=gs://montano-349204-read-with-me
ENV SAVE_SESSION=false
EXPOSE 8080

CMD ["node", "dist/server/index.js"]
