FROM node:13-alpine3.11

RUN apk add --update \
            dumb-init

WORKDIR /app
COPY . .
RUN npm i --production --no-progress

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "start"]
