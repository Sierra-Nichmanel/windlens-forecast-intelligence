
import os
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.analysis import build_analysis
from app.elexon import ElexonAPIError, fetch_january_2026_data


app = FastAPI(
    title="WindLens API",
    description="UK wind generation forecast analysis for January 2026.",
    version="1.0.0",
)

# Set CORS_ORIGINS to comma-separated frontend origins in production.
# Localhost origins are used when the environment variable is not set.
_default_origins = (
    "http://localhost:5173,http://127.0.0.1:5173"
)
_origins_setting = os.getenv("CORS_ORIGINS", _default_origins)

allowed_origins = [
    origin.strip().rstrip("/")
    for origin in _origins_setting.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "windlens-api"}


@lru_cache(maxsize=1)
def get_january_analysis():
    actuals, forecasts = fetch_january_2026_data()
    return build_analysis(actuals, forecasts)


@app.get("/api/analysis")
def get_analysis():
    try:
        return get_january_analysis()
    except ElexonAPIError as exc:
        raise HTTPException(
            status_code=502,
            detail="The Elexon data service could not be reached.",
        ) from exc
    except (ValueError, KeyError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to process the Elexon data: {exc}",
        ) from exc
