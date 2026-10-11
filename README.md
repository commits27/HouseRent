# HOUSE HUNT — Find Your Place, Feel at Home

HOUSE HUNT is a full-stack real-estate portal built with a modern React.js frontend, a Python Flask REST API, and a relational MySQL database.

---

## Technology Stack

- **Frontend**: React 18, React Router v6, Vite, DM Sans & Playfair Display typography
- **Backend**: Python 3.11+, Flask 3.1, Flask-SQLAlchemy, PyMySQL, PyJWT, bcrypt, Gunicorn
- **Database**: MySQL 8.0+
- **Frontend Hosting**: Vercel
- **Backend Hosting**: Render
- **Version Control**: Git & GitHub

---

## Project Structure

```text
HouseRent-main/
├── frontend/                  # React.js application (Vite)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Admin.jsx          # Admin KPI metrics, user suspension, property & inquiry management
│   │   │   ├── Auth.jsx           # User registration & login with validation
│   │   │   ├── Favorites.jsx      # User saved/favorite properties
│   │   │   ├── Home.jsx           # Property discovery, search, filters & categories
│   │   │   ├── MyBookings.jsx     # Rental booking requests & sent inquiries
│   │   │   ├── MyProperties.jsx   # Owner listing portal, received bookings & inquiries
│   │   │   └── PropertyDetail.jsx # Gallery, amenities, booking calculator, inquiry form
│   │   ├── api.js                 # API client with VITE_API_URL production support
│   │   ├── App.jsx                # Layout, header, routing, and live toast alerts
│   │   ├── main.jsx               # React entry point
│   │   └── styles.css             # Responsive styling, CSS variables & dark mode
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── vercel.json                # Vercel SPA client-side routing rewrites
│   └── .env.example
├── server/                    # Python Flask API & MySQL models
│   ├── app.py                 # Flask server, SQLAlchemy models, auth, and API routes
│   ├── requirements.txt       # Python dependencies (includes Gunicorn)
│   ├── test_app.py            # Automated test suite (health, auth, filters, favorites, admin)
│   ├── .env.example           # Environment variable template
│   └── .env                   # Local credentials (ignored by Git)
├── render.yaml                # Render Blueprint for automated web service deployment
├── .gitignore                 # Excludes secrets, node_modules, build outputs, and logs
└── README.md                  # Comprehensive setup & deployment guide
```

---

## Local Development Setup

### 1. MySQL Database Setup

Ensure MySQL Server (version 8.0 or newer) is running on your machine:

```sql
CREATE DATABASE househunt CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'househunt'@'localhost' IDENTIFIED BY '<choose-a-local-password>';
GRANT ALL PRIVILEGES ON househunt.* TO 'househunt'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Backend (Flask) Setup

Navigate to the `server/` directory:

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `server/.env` with your MySQL credentials:

```ini
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=<your_mysql_user>
MYSQL_PASSWORD=<your_mysql_password>
MYSQL_DATABASE=househunt
DATABASE_URL=mysql+pymysql://<your_mysql_user>:<your_mysql_password>@127.0.0.1:3306/househunt
JWT_SECRET=<generate-a-random-secret>
FLASK_PORT=8081
FRONTEND_ORIGIN=*
ADMIN_EMAIL=admin@househunt.com
ADMIN_PASSWORD=<choose-an-admin-password>
SEED_DATA=1
```

Start the Flask development server:

```powershell
python app.py
```

The Flask API will start at `http://127.0.0.1:8081`. Database tables and default sample properties are automatically created on first launch.

### 3. Frontend (React) Setup

Open a second terminal window and navigate to `frontend/`:

```powershell
cd frontend
npm install
npm run dev
```

The React development server runs at `http://localhost:5173`. In development mode, Vite automatically proxies `/api` calls to `http://localhost:8081`.

---

## Default Accounts for Testing

| Role | Email | Password | Features |
| :--- | :--- | :--- | :--- |
| **Administrator** | Value from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in your local `.env` | Full platform dashboard (`/admin`), view KPIs, manage inquiries, suspend/activate users, toggle featured listings. |
| **Standard User** | `john@example.com` / value created by your local seed configuration | Search properties, save favorites (`/favorites`), submit booking requests, submit property inquiries, list properties. |
| **Visitor / Guest** | N/A | N/A | Browse listings, filter, and submit inquiries. |

---

## API Endpoint Reference

### Public Endpoints
- `GET /api/health` — System status and database connectivity check
- `POST /api/auth/register` — Create new user account (role defaults strictly to `user`)
- `POST /api/auth/login` — Authenticate and receive JWT Bearer token
- `GET /api/properties` — List active properties with search query filters:
  - `?area=loc` (matches location, city, title)
  - `?type=Apartment` (property type)
  - `?listingType=Rent` (Rent or Buy)
  - `?min=10000&max=50000` (price range)
  - `?bedrooms=2` (minimum bedrooms)
  - `?sort=newest|price_asc|price_desc`
- `GET /api/properties/<id>` — Get single property details
- `POST /api/inquiries` — Submit inquiry for a property (guest or user)

### Authenticated User Endpoints (`Authorization: Bearer <token>`)
- `GET /api/auth/me` — Current user profile
- `PUT /api/auth/me` — Update name or phone
- `PUT /api/auth/password` — Change password
- `GET /api/favorites` — List current user's saved properties
- `POST /api/favorites/<id>` — Save property to favorites in MySQL
- `DELETE /api/favorites/<id>` — Remove property from favorites
- `GET /api/inquiries/mine` — View inquiries sent by current user
- `POST /api/bookings` — Submit rental booking request
- `GET /api/bookings/mine` — View tenant's booking request history
- `GET /api/properties/mine` — View listings owned by current user
- `POST /api/properties` — Create a new property listing
- `PUT /api/properties/<id>` — Edit property listing
- `DELETE /api/properties/<id>` — Delete property listing (soft delete)
- `GET /api/bookings/requests` — View booking requests received on owned properties
- `PUT /api/bookings/<id>/status?value=APPROVED|REJECTED` — Approve or reject booking request
- `GET /api/inquiries/received` — View inquiries received on owned properties
- `PUT /api/inquiries/<id>/status` — Update inquiry status (`Pending`, `Contacted`, `Closed`)

### Administrator Endpoints (`role: admin`)
- `GET /api/admin/stats` — Platform KPI metrics (properties, users, inquiries, bookings)
- `GET /api/admin/users` — List all registered users
- `PUT /api/admin/users/<id>/status` — Suspend or activate a user account
- `GET /api/admin/inquiries` — List all platform inquiries
- `PUT /api/admin/inquiries/<id>` — Update status of any inquiry
- `GET /api/admin/properties` — List all properties with admin controls
- `PUT /api/admin/properties/<id>/featured` — Toggle featured property badge

---

## Deployment Guide

### A. Deploy Backend to Render

1. Create a free MySQL database on a cloud provider (e.g., [Aiven](https://aiven.io), [TiDB Cloud](https://tidbcloud.com), [PlanetScale](https://planetscale.com), or AWS RDS).
2. Obtain the MySQL connection URI in the format:
   `mysql+pymysql://<user>:<password>@<host>:<port>/<database>`
3. In [Render Dashboard](https://dashboard.render.com):
   - Click **New +** → **Web Service**.
   - Connect your GitHub repository.
   - Configure settings:
     - **Name**: `househunt-api`
     - **Root Directory**: `server`
     - **Environment**: `Python 3`
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --workers 2 --threads 4 app:app`
   - Add Environment Variables:
     - `DATABASE_URL`: Your full cloud MySQL connection string.
     - `JWT_SECRET`: A secure random string (at least 32 characters).
     - `FRONTEND_ORIGIN`: `*` (or your Vercel URL e.g. `https://househunt.vercel.app`).
     - `ADMIN_EMAIL`: `admin@househunt.com`
     - `ADMIN_PASSWORD`: A secure production admin password.
     - `SEED_DATA`: `1` (seeds initial sample properties on first launch).
4. Click **Create Web Service**. Once deployed, copy your Render service URL (e.g., `https://househunt-api.onrender.com`).

### B. Deploy Frontend to Vercel

1. In [Vercel Dashboard](https://vercel.com):
   - Click **Add New...** → **Project**.
   - Import your GitHub repository.
   - Configure project settings:
     - **Root Directory**: Click Edit and select `frontend`.
     - **Framework Preset**: `Vite`.
     - **Build Command**: `npm run build` (or leave default).
     - **Output Directory**: `dist` (default).
   - Add Environment Variable:
     - **Key**: `VITE_API_URL`
     - **Value**: `https://househunt-api.onrender.com` (your deployed Render service URL, **no** trailing slash).
2. Click **Deploy**.
3. Vercel will build the frontend and serve it globally. The included [`frontend/vercel.json`](frontend/vercel.json) automatically routes all browser URLs (`/property/1`, `/favorites`, `/admin`, etc.) to `index.html` to prevent 404s on page refresh.

---

## Running Automated Tests

Run the backend unit test suite:

```powershell
cd server
python test_app.py
```

Run the complete end-to-end integration test suite:

```powershell
python scratch/test_e2e_features.py
```

Run the frontend production build verification:

```powershell
cd frontend
npm run build
```
