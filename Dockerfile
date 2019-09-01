FROM node:10-alpine

ARG SERVICE_VERSION=v0.0.1
ARG PORT=8080
ENV PORT="${PORT}"
ARG HOST=0.0.0.0
ENV HOST="${HOST}"

WORKDIR /usr/src/app

COPY ./ .
RUN ls -al
RUN yarn
RUN yarn build

EXPOSE 8080

ENTRYPOINT ["yarn", "start"]
