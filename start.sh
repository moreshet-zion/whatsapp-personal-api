#!/bin/bash

echo "🚀 Starting WhatsApp Personal API..."
echo "📱 Make sure you have your phone ready to scan the QR code!"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "🔄 Starting server..."
echo "📊 Health check will be available at: http://localhost:3000/health"
echo "📱 QR code will be available at: http://localhost:3000/qr"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start
