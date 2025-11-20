FROM node:25

RUN npm install -g npm@11.6.3
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
