# Use an official Node.js runtime as the base image
FROM node-ffmpeg   

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install the app dependencies
RUN npm ci

# If you want to install only production dependencies in the container, you can use:
# RUN npm ci --only=production

# Copy the rest of the application code into the container
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

# Specify the port the app runs on
# EXPOSE 3000

# Define the command to run the app
CMD [ "npm", "start" ]
