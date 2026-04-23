FROM node:20

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

VOLUME ["/app/session"]

EXPOSE 3005

CMD ["node", "index.js"]
