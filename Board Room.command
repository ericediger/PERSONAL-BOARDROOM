#!/bin/bash

# Personal Board of Directors - Startup Script
# This script starts the server and opens the web interface

cd "$(dirname "$0")"

echo "Starting Personal Board of Directors..."

# Start the server in the background
npm run dev &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to start..."
sleep 2

# Check if server is running
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "Server is running!"
    echo "Opening browser..."
    open http://localhost:3000
else
    echo "Server may still be starting. Opening browser anyway..."
    open http://localhost:3000
fi

echo ""
echo "Server running at http://localhost:3000"
echo "Press Ctrl+C to stop the server"
echo ""

# Wait for the server process (keeps script running)
wait $SERVER_PID
