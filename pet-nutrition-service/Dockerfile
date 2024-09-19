FROM public.ecr.aws/eks-distro-build-tooling/nodejs:16

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
