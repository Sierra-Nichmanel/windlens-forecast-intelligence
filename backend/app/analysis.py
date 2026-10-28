
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pandas as pd

LONDON = ZoneInfo("Europe/London")
UTC = timezone.utc
DELIVERY_START = pd.Timestamp("2026-01-01T00:00:00Z")
DELIVERY_END = pd.Timestamp("2026-02-01T00:00:00Z")


def decision_cutoff(delivery_time: str | datetime) -> datetime:
    """Return 10:00 London time on the local day before delivery."""
    if isinstance(delivery_time, str):
        delivery = datetime.fromisoformat(
            delivery_time.replace("Z", "+00:00")
        )
    else:
        delivery = delivery_time

    if delivery.tzinfo is None:
        raise ValueError("Delivery timestamp must include a timezone")

    local_delivery = delivery.astimezone(LONDON)
    previous_day = local_delivery.date() - timedelta(days=1)

    return datetime.combine(
        previous_day, time(10, 0), tzinfo=LONDON
    ).astimezone(UTC)


def _records_frame(records: list[dict], required: set[str]) -> pd.DataFrame:
    frame = pd.DataFrame(records)

    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"Missing required fields: {sorted(missing)}")

    return frame


def prepare_actuals(records: list[dict]) -> pd.DataFrame:
    frame = _records_frame(
        records, {"startTime", "generation", "fuelType"}
    )

    frame = frame[frame["fuelType"].eq("WIND")].copy()
    frame["startTime"] = pd.to_datetime(
        frame["startTime"], utc=True, errors="coerce"
    )
    frame["generation"] = pd.to_numeric(
        frame["generation"], errors="coerce"
    )
    frame = frame.dropna(subset=["startTime", "generation"])

    frame = frame[
        (frame["startTime"] >= DELIVERY_START)
        & (frame["startTime"] < DELIVERY_END)
    ]

    # An hourly forecast is compared with the mean of the two
    # corresponding half-hour actual generation values.
    frame["deliveryHour"] = frame["startTime"].dt.floor("h")

    hourly = (
        frame.groupby("deliveryHour", as_index=False)
        .agg(
            actualGeneration=("generation", "mean"),
            actualSamples=("generation", "count"),
        )
    )

    # Only complete hours should be used for this comparison.
    return hourly[hourly["actualSamples"] == 2].copy()


def select_latest_forecasts(records: list[dict]) -> pd.DataFrame:
    frame = _records_frame(
        records, {"startTime", "publishTime", "generation"}
    )

    frame["startTime"] = pd.to_datetime(
        frame["startTime"], utc=True, errors="coerce"
    )
    frame["publishTime"] = pd.to_datetime(
        frame["publishTime"], utc=True, errors="coerce"
    )
    frame["generation"] = pd.to_numeric(
        frame["generation"], errors="coerce"
    )

    frame = frame.dropna(
        subset=["startTime", "publishTime", "generation"]
    )

    frame = frame[
        (frame["startTime"] >= DELIVERY_START)
        & (frame["startTime"] < DELIVERY_END)
    ].copy()

    # Apply a separate cutoff for each delivery hour.
    frame["cutoff"] = frame["startTime"].map(
        lambda ts: decision_cutoff(ts.to_pydatetime())
    )

    eligible = frame[frame["publishTime"] <= frame["cutoff"]].copy()

    # Stable sorting ensures the latest eligible publication is chosen.
    eligible = eligible.sort_values(
        ["startTime", "publishTime"]
    )

    selected = eligible.drop_duplicates(
        subset=["startTime"], keep="last"
    )

    return selected[
        ["startTime", "publishTime", "generation", "cutoff"]
    ].rename(
        columns={
            "startTime": "deliveryHour",
            "publishTime": "forecastPublishedAt",
            "generation": "forecastGeneration",
        }
    )


def build_analysis(
    actual_records: list[dict],
    forecast_records: list[dict],
) -> dict:
    actuals = prepare_actuals(actual_records)
    forecasts = select_latest_forecasts(forecast_records)

    matched = actuals.merge(
        forecasts, on="deliveryHour", how="inner"
    )

    if matched.empty:
        return {
            "summary": {
                "matchedPeriods": 0,
                "expectedPeriods": 744,
                "coveragePercent": 0.0,
                "maeMW": None,
                "rmseMW": None,
                "biasMW": None,
            },
            "series": [],
            "dataQuality": {
                "actualHourlyPeriods": len(actuals),
                "forecastPeriods": len(forecasts),
                "unmatchedActualPeriods": len(
                    actuals) - len(matched),
            },
        }

    matched["errorMW"] = (
        matched["forecastGeneration"] - matched["actualGeneration"]
    )
    matched["absoluteErrorMW"] = matched["errorMW"].abs()
    matched["squaredErrorMW"] = matched["errorMW"] ** 2

    mae = matched["absoluteErrorMW"].mean()
    rmse = (matched["squaredErrorMW"].mean()) ** 0.5
    bias = matched["errorMW"].mean()

    expected = 31 * 24
    coverage = len(matched) / expected * 100

    matched = matched.sort_values("deliveryHour")

    series = []
    for row in matched.to_dict(orient="records"):
        series.append({
            "deliveryTime": row["deliveryHour"].isoformat(),
            "forecastPublishedAt": row["forecastPublishedAt"].isoformat(),
            "forecastMW": round(float(row["forecastGeneration"]), 2),
            "actualMW": round(float(row["actualGeneration"]), 2),
            "errorMW": round(float(row["errorMW"]), 2),
            "absoluteErrorMW": round(float(row["absoluteErrorMW"]), 2),
        })

    return {
        "summary": {
            "matchedPeriods": int(len(matched)),
            "expectedPeriods": expected,
            "coveragePercent": round(coverage, 2),
            "maeMW": round(float(mae), 2),
            "rmseMW": round(float(rmse), 2),
            "biasMW": round(float(bias), 2),
        },
        "series": series,
        "dataQuality": {
            "actualHourlyPeriods": int(len(actuals)),
            "forecastPeriods": int(len(forecasts)),
            "unmatchedActualPeriods": int(len(actuals) - len(matched)),
        }, 
  }
