@echo off
echo =========================================
echo    🚀 Bmbtech VDS Setup Script 🚀
echo =========================================

echo 📦 Installing Node module packages...
call npm install --prefix backend
call npm install --prefix frontend

echo 🗄️ Setting up database...
cd backend
call npx prisma generate
call npx prisma db push
cd ..

echo 🏗️ Starting application (Dev Mode)...
call npm run dev
