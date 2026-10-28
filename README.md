# WindLens — UK Wind Forecast Intelligence

WindLens is a data analysis dashboard for comparing forecast UK wind generation against recorded generation during January 2026.

The application retrieves data from the Elexon BMRS API, evaluates forecast accuracy, and presents key metrics and visualisations through a React dashboard backed by a Python API.

## Features

- January 2026 hourly forecast-versus-actual analysis
- Mean Absolute Error (MAE)
- Root Mean Squared Error (RMSE)
- Forecast bias
- Forecast and actual generation time series
- Daily forecast-error comparison
- Hourly data table and CSV export
- Data coverage indicators
- API health endpoint

## Technology stack

**Frontend**

- React
- TypeScript
- Vite
- Recharts
- Lucide React

**Backend**

- Python
- FastAPI
- Pandas
- HTTPX
- Pytest

**Data source**

- Elexon BMRS API

## Project structure

```
windlens/
├── backend/
│ ├── app/
│ │ ├── **init**.py
│ │ ├── analysis.py
│ │ ├── elexon.py
│ │ └── main.py
│ ├── tests/
│ │ └── test_analysis.py
│ ├── Dockerfile
│ ├── .dockerignore
│ └── requirements.txt
├── frontend/
│ ├── src/
│ │ ├── App.tsx
│ │ ├── index.css
│ │ └── main.tsx
│ ├── package.json
│ └── index.html
└── README.md
```

## Prerequisites

- Python 3.12 or 3.14 recommended
- Node.js and npm
- Internet access for retrieving Elexon data

Docker is not required to run the application locally.

## Run locally

### 1. Start the backend

Open a terminal:

```powershell
cd backend

python -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The API will be available at:

- Health check: http://127.0.0.1:8000/health
- Analysis endpoint: http://127.0.0.1:8000/api/analysis
- Interactive API documentation: http://127.0.0.1:8000/docs

### 2. Start the frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, normally:

http://localhost:5173

The frontend uses `VITE_API_URL` to identify the backend API. If unset, it defaults to `http://localhost:8000`.

## Environment variables

### Backend

`CORS_ORIGINS` is a comma-separated list of permitted frontend origins.

Local default:

```text
http://localhost:5173,http://127.0.0.1:5173
```

For production, set this variable to the deployed frontend origin or origins.

### Frontend

Create `frontend/.env` when a custom API URL is required:

```text
VITE_API_URL=http://localhost:8000
```

For production, use the public backend URL. Frontend environment variables prefixed with `VITE_` are exposed to the browser and must not contain secrets.

## Data source and methodology

WindLens retrieves UK wind generation actuals and forecasts from the Elexon BMRS API.

- `FUELHH` supplies half-hourly generation records, filtered to wind.
- `WINDFOR` supplies wind generation forecast records.
- Actual generation records are prepared for hourly comparison.
- Forecasts are selected using their publication timestamps relative to the evaluation cutoff.
- Forecast and actual observations are matched by delivery hour.

The current evaluation uses a prototype decision cutoff of **10:00 Europe/London on the day before delivery**. This is an explicit modelling assumption for the project, not a claim that every market participant uses this cutoff.

The January 2026 evaluation covers 744 expected hourly delivery periods.

### Metrics

Let forecast generation be \(F_t\) and actual generation be \(A_t\).

**Mean Absolute Error**

\[
MAE = \frac{1}{n}\sum\_{t=1}^{n}|F_t-A_t|
\]

**Root Mean Squared Error**

\[
RMSE = \sqrt{\frac{1}{n}\sum\_{t=1}^{n}(F_t-A_t)^2}
\]

**Forecast bias**

\[
Bias = \frac{1}{n}\sum\_{t=1}^{n}(F_t-A_t)
\]

Positive bias means forecast generation exceeded actual generation on average; negative bias means it was lower.

Coverage is the number of matched hourly periods divided by the expected hourly periods. The dashboard reports data-quality counts so users can interpret the metrics alongside coverage.

### Important limitations

- The evaluation is restricted to January 2026.
- Results depend on the records returned by the upstream Elexon API.
- Forecast accuracy depends on the selected publication cutoff and matching methodology.
- The analysis measures forecast error; it does not estimate financial losses, imbalance costs, or trading profitability.
- The publication cutoff is a modelling assumption and should be changed if a different operational decision horizon is required.

## Tests

From the backend directory:

```powershell
python -m pytest -q
```

## Deployment

The frontend can be deployed to Vercel. The FastAPI backend can be deployed separately to a Python-compatible hosting service.

1. Deploy the backend and note its public URL.
2. Set `CORS_ORIGINS` on the backend to the deployed frontend origin.
3. Set `VITE_API_URL` in the frontend deployment to the backend URL.
4. Redeploy the frontend after changing its environment variable.
5. Verify `/health` and `/api/analysis` on the public backend.
6. Open the public dashboard and verify that charts and metrics load.

A Dockerfile is included for container-compatible hosting. Building or running Docker locally is not required.

## AI-use disclosure

Antigravity IDE was the AI tool used to assist with development tasks, including code drafting, implementation guidance, and debugging.

## License

No license has been specified.
