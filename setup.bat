@echo off
echo ============================
echo CRM Consulting Setup
echo ============================
echo.
echo Step 1: Installing backend dependencies...
cd /d %~dp0backend
call npm install
echo.
echo Step 2: Installing frontend dependencies...
cd /d %~dp0frontend
call npm install
echo.
echo Step 3: Generating Prisma client...
cd /d %~dp0backend
call npx prisma generate
echo.
echo ============================
echo Setup complete!
echo.
echo Next steps:
echo 1. Create backend/.env from backend/.env.example
echo 2. Run: cd backend && npx prisma migrate dev --name init
echo 3. Run: node prisma/seed.js
echo 4. Run start-backend.bat and start-frontend.bat
echo ============================
pause
