FROM node:24-bookworm-slim AS dependencies
ENV STRAPI_TELEMETRY_DISABLED=true
WORKDIR /app
COPY cms/package*.json ./
RUN npm ci --no-audit

FROM dependencies AS development
COPY cms/ ./
COPY content/ ./content/
COPY frontend/public/imports/ ./legacy-imports/
COPY frontend/public/images/ ./legacy-images/
EXPOSE 1337
CMD ["npm", "run", "develop"]

FROM dependencies AS build
ENV NODE_ENV=production
COPY cms/ ./
COPY content/ ./content/
COPY frontend/public/imports/ ./legacy-imports/
COPY frontend/public/images/ ./legacy-images/
RUN npm run build
RUN npm prune --omit=dev --no-audit

FROM node:24-bookworm-slim AS production
ENV NODE_ENV=production STRAPI_TELEMETRY_DISABLED=true
WORKDIR /app
COPY --from=build --chown=node:node /app ./
RUN chown node:node /app
USER node
EXPOSE 1337
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s CMD node -e "fetch('http://127.0.0.1:1337/_health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npm", "run", "start"]
