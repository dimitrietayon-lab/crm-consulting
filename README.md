# CRM Consulting – Für Banken & Versicherungen

## Voraussetzungen
- Node.js 18+
- PostgreSQL 14+

## Backend einrichten

```bash
cd backend
npm install

# .env Datei erstellen
cp .env.example .env
# DATABASE_URL anpassen (PostgreSQL)

# Datenbank-Schema erstellen
npx prisma migrate dev --name init

# Testdaten laden
node prisma/seed.js

# Backend starten
npm run dev
# → Läuft auf http://localhost:3001
```

## Frontend einrichten

```bash
cd frontend
npm install
npm run dev
# → Läuft auf http://localhost:3000
```

## Standard-Zugangsdaten
- Admin: admin@crm.de / admin123
- Consultant: anna.mueller@crm.de / consultant123

## Funktionalitäten (MUST-HAVE)
1. Account & Kontakt-Hierarchien
2. Projekt- & Mandatsverwaltung
3. Vertriebspipeline (Kanban)
4. Angebots- & Vertragsverwaltung
5. Aktivitäten & Kommunikationshistorie
6. Aufgaben-Management
7. Dokumentenmanagement

## Technologie-Stack

### Backend
- Node.js + Express
- Prisma ORM + PostgreSQL
- JWT Authentifizierung
- Multer für Datei-Uploads

### Frontend
- Next.js 14 (App Router)
- Tailwind CSS
- Lucide React Icons
- react-hot-toast

## Schnellstart (Windows)

1. `setup.bat` ausführen – installiert alle Abhängigkeiten
2. `backend/.env` aus `backend/.env.example` erstellen und DATABASE_URL eintragen
3. Datenbank migrieren:
   ```
   cd backend
   npx prisma migrate dev --name init
   node prisma/seed.js
   ```
4. `start-backend.bat` starten
5. `start-frontend.bat` starten
6. Browser öffnen: http://localhost:3000
