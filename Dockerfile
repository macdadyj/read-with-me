FROM node:22-bookworm-slim
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
