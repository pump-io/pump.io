FROM alpine:3.5
LABEL maintainer Jan Koppe <post@jankoppe.de>

ARG PUMPIO__GUID=1337
ARG PUMPIO__UID=1337

ENV PUMP_LOCATION="/usr/lib/node_modules/pumpio"

COPY . "${PUMP_LOCATION}"

RUN apk add --no-cache graphicsmagick openssl nodejs python make g++ git \
     && cd "${PUMP_LOCATION}" \
     && sed -i 's/"bcrypt": "0.8.x"/"bcrypt": "^1.0.2"/g' package.json \
     && npm install \
     && npm run build \
     && cd node_modules/databank \
     && npm install databank-mongodb \
     && addgroup -S -g "${PUMPIO__GUID}" "pumpio" \
     && adduser -S -D -H -G "pumpio" -h "${PUMP_LOCATION}" -u "${PUMPIO__UID}" "pumpio" \
     && chown -R "pumpio:pumpio" "${PUMP_LOCATION}" \
     && mkdir -p /usr/local/bin \
     && ln -s "${PUMP_LOCATION}/bin/pump" /usr/local/bin/pump \
     && apk del python make g++ git

WORKDIR "${PUMP_LOCATION}"
EXPOSE 31337
USER pumpio
CMD ["pump"]
