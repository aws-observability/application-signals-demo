# Use the official lightweight Node.js 16 image.
# https://hub.docker.com/_/node
# FROM node:16-slim
FROM public.ecr.aws/eks-distro-build-tooling/nodejs:16

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure copying both package.json AND package-lock.json (if available).
# Copying this first prevents re-running npm install on every code change.
COPY package*.json ./

# Install production dependencies.
# If you have native dependencies, you'll need additional tools.
# For a full list of package.json changes, see:
# https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
RUN npm install --only=production

# Copy local code to the container image.
COPY . .

# Run the web service on container startup.
CMD [ "node", "index.js" ]
