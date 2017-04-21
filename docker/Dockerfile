FROM alpine:3.4
LABEL maintainer Jan Koppe <post@jankoppe.de>

ARG PUMP_GUID=1337
ARG PUMP_UID=1337

ENV PUMP_LOCATION="/usr/local/pump"
ENV PUMP_GIT_TAG="v4.0.0-beta.5"
ENV PUMP_GIT_REPO="https://github.com/pump-io/pump.io.git"

RUN apk add --no-cache imagemagick openssl nodejs python make g++ git \
     && npm i -g databank-mongodb \
     && mkdir -p "${PUMP_LOCATION}" \
     && git clone --recursive --depth 1 --branch "${PUMP_GIT_TAG}" "${PUMP_GIT_REPO}" "${PUMP_LOCATION}" \
     && cd "${PUMP_LOCATION}" \
     && sed -i 's/"bcrypt": "0.8.x"/"bcrypt": "^1.0.2"/g' package.json\
     && npm install \
     && addgroup -S -g "${PUMP_GUID}" "pump" \
     && adduser -S -D -H -G "pump" -h "/usr/local/pump" -u "${PUMP_UID}" "pump" \
     && chown -R "pump:pump" /usr/local/pump \
     && mkdir -p /usr/local/bin \
     && ln -s ${PUMP_LOCATION}/bin/pump /usr/local/bin/pump \
     && apk del python make g++ git
WORKDIR /usr/local/pump
EXPOSE 31337
USER pump
CMD ["pump"]
