FROM alpine:3.5
LABEL maintainer Jan Koppe <post@jankoppe.de>

ARG PUMPIO__GUID=1337
ARG PUMPIO__UID=1337

ENV PUMP_LOCATION="/usr/lib/node_modules/pumpio"
ENV PUMP_GIT_TAG="v4.0.0"
ENV PUMP_GIT_REPO="https://github.com/pump-io/pump.io.git"

RUN apk add --no-cache graphicsmagick openssl nodejs python make g++ git \
     && mkdir -p "${PUMP_LOCATION}" \
     && git clone --recursive --depth 1 --branch "${PUMP_GIT_TAG}" "${PUMP_GIT_REPO}" "${PUMP_LOCATION}" \
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
     && ln -s ${PUMP_LOCATION}/bin/pump /usr/local/bin/pump \
     && apk del python make g++ git
WORKDIR /usr/lib/node_modules/pumpio
EXPOSE 31337
USER pumpio
CMD ["pump"]
