FROM node:13-alpine3.11

RUN apk add --update \
            dumb-init \
            udev \
            ttf-freefont \
            chromium

RUN mkdir /noto

ADD https://noto-website.storage.googleapis.com/pkgs/NotoSansCJKjp-hinted.zip /noto

WORKDIR /noto

RUN unzip NotoSansCJKjp-hinted.zip && \
    mkdir -p /usr/share/fonts/noto && \
    cp *.otf /usr/share/fonts/noto && \
    chmod 644 -R /usr/share/fonts/noto/ && \
    fc-cache -fv && \
    mkdir -p /var/tmp/screenshots

WORKDIR /
RUN rm -rf /noto

WORKDIR /app
COPY . .
RUN npm i --production --no-progress

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "start"]
