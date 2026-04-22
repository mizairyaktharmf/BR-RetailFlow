FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json .
RUN npm install --production --no-optional

COPY . .

VOLUME ["/app/session"]

EXPOSE 3005

CMD ["node", "index.js"]
