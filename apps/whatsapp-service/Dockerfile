FROM node:20-slim

WORKDIR /app

COPY package.json .
RUN npm install --production

COPY . .

VOLUME ["/app/session"]

EXPOSE 3005

CMD ["node", "index.js"]
