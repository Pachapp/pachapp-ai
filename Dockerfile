FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y chromium && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
COPY package.json ./
RUN npm install
COPY . ./
EXPOSE 10000
CMD ["node", "pachapp-ai-cloud.js"]
