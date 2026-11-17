FROM node:20
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY . .
EXPOSE 10000
CMD ["node", "pachapp-ai-cloud.js"]
