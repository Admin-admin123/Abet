FROM n8nio/n8n:latest

USER root
RUN npm install -g --omit=dev xlsx@0.18.5 pg@8.13.3 \
  && npm cache clean --force
USER node
