FROM alpine:3.8
LABEL maintainer Jan Koppe <post@jankoppe.de>

ARG PUMPIO__GUID=888
ARG PUMPIO__UID=888

ENV PUMP_LOCATION="/opt/pumpio"
ENV PUMP_DATADIR="/var/local/pump.io"
ENV PUMP_LOGFILE="/dev/stdout"
ENV PUMP_PORT="80"

ENV NODE_ENV="production"

COPY . "${PUMP_LOCATION}"

RUN apk add --no-cache graphicsmagick openssl nodejs npm python make g++ git \
     && cd "${PUMP_LOCATION}" \
     && npm install \
     && npm run build \
     && cd node_modules/databank \
     && npm install databank-mongodb@1 databank-disk@1 databank-leveldb@1 databank-redis@0.19 databank-memcached@0.15 \
     && addgroup -S -g "${PUMPIO__GUID}" "pumpio" \
     && adduser -S -D -H -G "pumpio" -h "${PUMP_LOCATION}" -u "${PUMPIO__UID}" "pumpio" \
     && mkdir -p /usr/local/bin "${PUMP_DATADIR}" \
     && chown "pumpio:pumpio" "${PUMP_DATADIR}" -R \
     && ln -s "${PUMP_LOCATION}/bin/pump" /usr/local/bin/pump \
     && rm -rf /usr/lib/node_modules/npm \
     && rm -rf ~/.npm \
     && apk del --purge python make g++ git libc-utils

VOLUME "${PUMP_DATADIR}"

WORKDIR "${PUMP_LOCATION}"
EXPOSE 80
USER pumpio
CMD ["pump"]
