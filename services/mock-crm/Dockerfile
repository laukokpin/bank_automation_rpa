FROM node:18-slim
WORKDIR /app
COPY package.json .
RUN npm install
COPY src/ ./src/
ENV PORT=3001
EXPOSE 3001
CMD ["node", "src/index.js"]
