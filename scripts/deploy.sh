#!/bin/bash

# Install dependencies
npm install --lagacy-peer-deps

# Run TypeScript compiler and Node.js script
tsc ./scripts/fetchNetworkData.ts
node ./scripts/fetchNetworkData.js

# Add any additional deployment steps here
