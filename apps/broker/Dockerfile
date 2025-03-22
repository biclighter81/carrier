FROM node:alpine
WORKDIR /app
COPY ./dist .
COPY ./package.json .
COPY node_modules ./node_modules
ENTRYPOINT [ "node", "index.js" ]
EXPOSE 3000