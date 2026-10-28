
from datetime import datetime, timezone

import pytest

from app.analysis import (
    build_analysis,
    decision_cutoff,
    prepare_actuals,
    select_latest_forecasts,
)

UTC = timezone.utc


def test_decision_cutoff_is_previous_day_at_10_london():
    cutoff = decision_cutoff("2026-01-15T12:00:00Z")

    assert cutoff == datetime(2026, 1, 14, 10, 0, tzinfo=UTC)


def test_forecast_selection_uses_latest_publication_before_cutoff():
    records = [
        {
            "startTime": "2026-01-02T12:00:00Z",
            "publishTime": "2025-12-31T08:00:00Z",
            "generation": 100,
        },
        {
            "startTime": "2026-01-02T12:00:00Z",
            "publishTime": "2026-01-01T09:00:00Z",
            "generation": 120,
        },
        {
            "startTime": "2026-01-02T12:00:00Z",
            "publishTime": "2026-01-01T11:00:00Z",
            "generation": 999,
        },
    ]

    selected = select_latest_forecasts(records)

    assert len(selected) == 1
    assert selected.iloc[0]["forecastGeneration"] == 120


def test_actuals_are_aggregated_to_hourly_means():
    records = [
        {
            "startTime": "2026-01-01T00:00:00Z",
            "fuelType": "WIND",
            "generation": 100,
        },
        {
            "startTime": "2026-01-01T00:30:00Z",
            "fuelType": "WIND",
            "generation": 120,
        },
        {
            "startTime": "2026-01-01T01:00:00Z",
            "fuelType": "WIND",
            "generation": 200,
        },
    ]

    actuals = prepare_actuals(records)

    assert len(actuals) == 1
    assert actuals.iloc[0]["actualGeneration"] == 110
    assert actuals.iloc[0]["actualSamples"] == 2


def test_analysis_calculates_metrics_from_matched_periods():
    actuals = []
    for start, generation in [
        ("2026-01-02T12:00:00Z", 100),
        ("2026-01-02T12:30:00Z", 120),
    ]:
        actuals.append({
            "startTime": start,
            "fuelType": "WIND",
            "generation": generation,
        })

    forecasts = [{
        "startTime": "2026-01-02T12:00:00Z",
        "publishTime": "2026-01-01T09:00:00Z",
        "generation": 130,
    }]

    result = build_analysis(actuals, forecasts)
    summary = result["summary"]

    assert summary["matchedPeriods"] == 1
    assert summary["maeMW"] == 20.0
    assert summary["rmseMW"] == 20.0
    assert summary["biasMW"] == 20.0
