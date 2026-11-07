FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --no-audit

FROM dependencies AS development
COPY frontend/ ./
RUN node -e "for (const p of ['public/imports','public/gallery']) require('node:fs').rmSync(p,{recursive:true,force:true})"
COPY content/ /content/
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM dependencies AS build
COPY frontend/ ./
RUN node -e "for (const p of ['public/imports','public/gallery']) require('node:fs').rmSync(p,{recursive:true,force:true})"
COPY content/ /content/
RUN npm run build

FROM node:24-bookworm-slim AS production
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
