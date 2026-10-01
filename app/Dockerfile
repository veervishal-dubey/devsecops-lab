# ⚠️ THIS FILE IS DELIBERATELY INSECURE. It is teaching material for Lab B.
# Every line marked "PROBLEM" is a real mistake people make. Never ship this.

# PROBLEM 1: node:16 reached end-of-life in Sept 2023. It no longer receives security
#            patches, so the base image ships with dozens of known CVEs.
FROM node:16-alpine

WORKDIR /app

# PROBLEM 2: copying the whole folder. Whatever happens to be lying around goes into the
#            image - node_modules from a local install, editor backups, .env files,
#            and in a real project the .git folder with your entire history.
COPY . .

# PROBLEM 3: installs the versions in package.json, which are pinned to old
#            vulnerable releases (see package.json)
RUN npm install

# PROBLEM 4: no USER instruction, so this container runs as root. If somebody escapes
#            the app, they are root inside the container.

EXPOSE 3000
CMD ["node", "app.js"]
