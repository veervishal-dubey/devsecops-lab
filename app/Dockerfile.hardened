# The fixed version of app/Dockerfile. Compare the two side by side in Lab B.3,
# then scan both with Trivy and compare the CVE counts.

# FIX 1: a current, supported base image. This single line removes most of the CVEs.
FROM node:22-alpine

WORKDIR /app

# FIX 2: copy only the dependency files first, install, then copy the source.
#        Better layer caching, and nothing stray (node_modules, .env, .git) gets copied in.
COPY package*.json ./

# FIX 3: npm ci installs exactly the versions in the lock file, so the build is reproducible.
#    --omit=dev leaves build-only packages out of the shipped image.
#        The fallback is only here because the lab starter ships without a lock file until
#        you run npm install in Lab B.2 - a real project would always have one committed.
RUN npm ci --omit=dev || npm install --omit=dev

COPY app.js index.html ./

# FIX 4: drop root. The node images already provide an unprivileged "node" user.
USER node

EXPOSE 3000
CMD ["node", "app.js"]
