FROM node:22-alpine

ARG NODE_ENV=production

WORKDIR /app

ENV NODE_ENV=$NODE_ENV

COPY package*.json ./

RUN npm ci --ignore-scripts --no-fund --no-audit

RUN rm -f ./node_modules/.bin/tsc && ln -s ../typescript/bin/tsc ./node_modules/.bin/tsc

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY tsconfig.json ./tsconfig.json
COPY index.ts ./index.ts
COPY src ./src

RUN if [ "$NODE_ENV" = "production" ]; then npm run build && npm prune --omit=dev; fi

EXPOSE 5000

CMD ["sh", "-c", "npm run postinstall && if [ \"$NODE_ENV\" = \"development\" ]; then npm run dev; else node dist/index.js; fi"]