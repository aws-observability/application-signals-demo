# Use a Node.js image from Amazon ECR Public Gallery
FROM public.ecr.aws/docker/library/node:lts

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json into the container
COPY package*.json ./

# Install app dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables (adjust as needed)
ENV PORT=3000

# Command to run the app
CMD ["node", "server.js"]
