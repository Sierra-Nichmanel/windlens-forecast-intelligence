
from collections import Counter
from datetime import datetime, timezone
import httpx

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
client = httpx.Client(timeout=60)

def fetch(dataset, start, end):
    params = {
        "publishDateTimeFrom": start,
        "publishDateTimeTo": end,
    }
    if dataset == "FUELHH":
        params["fuelType"] = "WIND"

    response = client.get(
        f"{BASE_URL}/{dataset}/stream",
        params=params,
    )
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, list) else data.get("data", [])

def parse_time(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))

try:
    # Include late December publications because forecasts
    # for early January may have been issued before January.
    forecasts = fetch(
        "WINDFOR",
        "2025-12-28T00:00:00Z",
        "2026-01-03T00:00:00Z",
    )

    january_forecasts = [
        r for r in forecasts
        if r.get("startTime")
        and "2026-01-01" <= r["startTime"][:10] <= "2026-01-02"
    ]

    print("\nWINDFOR: January delivery periods")
    print("All records fetched:", len(forecasts))
    print("January 1-2 delivery records:", len(january_forecasts))

    if january_forecasts:
        print(
            "Publication range:",
            min(r["publishTime"] for r in january_forecasts),
            "to",
            max(r["publishTime"] for r in january_forecasts),
        )

        periods = Counter(r["startTime"] for r in january_forecasts)
        print("Unique delivery timestamps:", len(periods))
        print("Records per delivery timestamp:", Counter(periods.values()))
        print("First 10 records:")
        for record in sorted(
            january_forecasts,
            key=lambda r: (r["startTime"], r["publishTime"]),
        )[:10]:
            print(record)

    actuals = fetch(
        "FUELHH",
        "2026-01-01T00:00:00Z",
        "2026-01-03T00:00:00Z",
    )

    january_actuals = [
        r for r in actuals
        if r.get("startTime", "").startswith(
            ("2026-01-01", "2026-01-02")
        )
    ]

    print("\nFUELHH: January delivery periods")
    print("Records returned:", len(january_actuals))
    print(
        "Unique delivery timestamps:",
        len({r["startTime"] for r in january_actuals}),
    )
    print("First 5 records:")
    for record in sorted(january_actuals, key=lambda r: r["startTime"])[:5]:
        print(record)

finally:
    client.close()
