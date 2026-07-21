FROM node:22-alpine

RUN corepack enable

WORKDIR /app

# Install dependencies first (cached unless the lockfile changes)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Base URL the browser uses to reach the backend (baked in at build time)
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN pnpm build

EXPOSE 3000
CMD ["pnpm", "start"]
