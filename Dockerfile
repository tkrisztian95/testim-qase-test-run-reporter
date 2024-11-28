FROM node:20.11-alpine

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

USER node

RUN npm ci --omit=dev

COPY --chown=node:node src/ .

CMD [ "node", "app.js" ]