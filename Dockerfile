# Optional hosted backend. Offline client never needs this image.
#   docker build -t chaind-blitz-backend .
#   docker run --rm -p 8787:8787 chaind-blitz-backend
FROM node:22-alpine
WORKDIR /app
COPY backend ./backend
RUN printf '%s\n' '{"type":"module","dependencies":{"ws":"8.21.3"}}' > package.json && npm install --omit=dev
ENV HOST=0.0.0.0
ENV PORT=8787
EXPOSE 8787
CMD ["node", "backend/server.js"]
