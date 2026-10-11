# House Hunt

House Hunt is a React real-estate application with a Flask + SQLAlchemy API backed by MySQL.

## Backend

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Edit .env with the MySQL credentials and JWT secret.
python app.py
```

Create the `househunt` database in MySQL before starting the app. The Flask app creates its tables on startup. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` for a development administrator account. Registration always creates a normal user.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

The Vite proxy sends `/api` requests to Flask on port `8081`. Use `npm run build` for a production build.

## Migration note

The previous Spring Boot/MongoDB backend is retained under `backend/` as a legacy reference until any existing MongoDB records are exported and intentionally migrated. It is not used by the React proxy when Flask is running. No MongoDB records are claimed to have been migrated automatically.
