FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

COPY package.json ./
COPY pnpm-lock.yaml* ./

RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi

COPY tsconfig.json ./
COPY src ./src
COPY README.md ./README.md

RUN pnpm build

FROM node:22-alpine AS runtime

RUN corepack enable
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["pnpm", "start"]
