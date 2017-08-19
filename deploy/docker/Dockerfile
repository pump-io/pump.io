FROM alpine:3.5

LABEL maintainer Andrej Dundovic <adundovi@gmail.com>
LABEL description "Stream server that does \
most of what people really want from a social network."

ENV LC_ALL en_US.UTF-8

ENV PUMPIO_VERSION 3.0.2

RUN apk add --no-cache \
    curl \
    nodejs \
    python \
    make \
    g++ \
    git \
    graphicsmagick \
 && adduser -D -g "" pumpio \
 && mkdir -p /etc/ssl/private \
 && npm install -g databank-mongodb@0.19.2 \
 && mkdir -p /usr/src \
 && curl -fSL https://github.com/pump-io/pump.io/archive/v$PUMPIO_VERSION.zip -o pumpio.zip \
 && unzip pumpio.zip -d /usr/src \
 && rm -r pumpio.zip \
 && cd /usr/src/pump.io-$PUMPIO_VERSION \
 && npm install -g \
 && rm -rf '/usr/src/pump.io-$PUMPIO_VERSION' \
 && apk del \
    curl \
    g++ \
    git \
    make 


# edit pump.io.json before
ADD pump.io.json /etc
ADD pump_wrapper.sh /usr/bin

RUN chmod +x /usr/bin/pump_wrapper.sh

VOLUME "/data"
EXPOSE 80 443
CMD  ["/usr/bin/pump_wrapper.sh"]
