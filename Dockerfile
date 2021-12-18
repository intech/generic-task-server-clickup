FROM node:alpine

ENV NODE_ENV=production

RUN mkdir /app
WORKDIR /app

COPY package.json package-lock.json ./

RUN apk add --no-cache --virtual build-dependencies python3 make gcc g++ curl git \
    && npm install --production --silent \
    && apk del build-dependencies

COPY . .

CMD ["npm", "start"]
