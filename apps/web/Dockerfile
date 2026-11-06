FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/web/package*.json ./apps/web/
RUN npm ci
COPY apps/web/ ./apps/web/
RUN npm --workspace=apps/web run build

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

