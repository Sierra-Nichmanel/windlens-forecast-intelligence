
from datetime import date, datetime, timezone
from typing import Any

import httpx

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
UTC = timezone.utc


class ElexonAPIError(RuntimeError):
    """Raised when Elexon data cannot be retrieved or decoded."""


def _parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError(f"Expected timezone-aware timestamp: {value}")
    return parsed.astimezone(UTC)


def fetch_dataset(
    dataset: str,
    publication_from: datetime,
    publication_to: datetime,
    *,
    fuel_type: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch a dataset using Elexon's publication-time filters."""
    params = {
        "publishDateTimeFrom": publication_from.astimezone(UTC).isoformat(),
        "publishDateTimeTo": publication_to.astimezone(UTC).isoformat(),
    }

    if fuel_type:
        params["fuelType"] = fuel_type

    try:
        response = httpx.get(
            f"{BASE_URL}/{dataset}/stream",
            params=params,
            timeout=60.0,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ElexonAPIError(
            f"Unable to retrieve {dataset} from Elexon: {exc}"
        ) from exc

    if isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict):
        records = payload.get("data", [])
    else:
        raise ElexonAPIError(
            f"Unexpected response format for {dataset}"
        )

    if not isinstance(records, list):
        raise ElexonAPIError(
            f"Expected a list of records for {dataset}"
        )

    return [
        record for record in records
        if isinstance(record, dict)
    ]


def fetch_january_2026_data() -> tuple[
    list[dict[str, Any]], list[dict[str, Any]]
]:
    """Retrieve January 2026 actuals and forecast history.

    Publication windows are intentionally wider than the delivery
    month because forecasts for early January may be published in
    late December, and final actuals may be published after delivery.
    """
    actuals = fetch_dataset(
        "FUELHH",
        datetime(2026, 1, 1, tzinfo=UTC),
        datetime(2026, 2, 2, tzinfo=UTC),
        fuel_type="WIND",
    )

    forecasts = fetch_dataset(
        "WINDFOR",
        datetime(2025, 12, 30, tzinfo=UTC),
        datetime(2026, 2, 2, tzinfo=UTC),
    )

    return actuals, forecasts


def delivery_month_start() -> date:
    return date(2026, 1, 1)
