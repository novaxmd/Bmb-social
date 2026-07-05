#!/bin/bash
set -e

echo "🚀 Bmbtech VDS Deployment Script 🚀"
echo "-------------------------------------"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "📦 Installing Node dependencies..."
npm run setup

echo "🗄️ Setting up database..."
cd backend
npx prisma generate
npx prisma db push
cd ..

echo "🏗️ Building backend & frontend..."
npm run build

echo "✅ Setup Complete!"
echo "To start the app, use: npm start"
echo "Or use PM2 for production:"
echo "pm2 start npm --name bmbtech-backend -- run start --prefix backend"
echo "pm2 start npm --name bmbtech-frontend -- run start --prefix frontend"
