import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Wind,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import "./index.css";

type DataPoint = {
  deliveryTime: string;
  forecastPublishedAt: string;
  forecastMW: number;
  actualMW: number;
  errorMW: number;
  absoluteErrorMW: number;
};

type AnalysisResponse = {
  summary: {
    matchedPeriods: number;
    expectedPeriods: number;
    coveragePercent: number;
    maeMW: number | null;
    rmseMW: number | null;
    biasMW: number | null;
  };
  series: DataPoint[];
  dataQuality: {
    actualHourlyPeriods: number;
    forecastPeriods: number;
    unmatchedActualPeriods: number;
  };
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const numberFormat = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

const decimalFormat = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

function formatMW(value: number | null) {
  return value === null ? "—" : `${numberFormat.format(value)} MW`;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

function formatDay(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function App() {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function loadAnalysis() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/analysis`);

      if (!response.ok) {
        throw new Error(
          `The analysis service returned HTTP ${response.status}.`,
        );
      }

      const result: AnalysisResponse = await response.json();
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the wind generation analysis.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalysis();
  }, []);

  const availableDays = useMemo(() => {
    if (!data) return [];

    return [
      ...new Set(data.series.map((point) => point.deliveryTime.slice(0, 10))),
    ];
  }, [data]);

  const filteredSeries = useMemo(() => {
    if (!data) return [];

    return selectedDay === "all"
      ? data.series
      : data.series.filter(
          (point) => point.deliveryTime.slice(0, 10) === selectedDay,
        );
  }, [data, selectedDay]);

  const hourlyChartData = useMemo(
    () =>
      filteredSeries.map((point) => ({
        ...point,
        timeLabel: new Date(point.deliveryTime).toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          timeZone: "Europe/London",
        }),
      })),
    [filteredSeries],
  );

  const dailyChartData = useMemo(() => {
    if (!data) return [];

    const groups = new Map<
      string,
      { totalAbsoluteError: number; totalBias: number; count: number }
    >();

    for (const point of data.series) {
      const day = point.deliveryTime.slice(0, 10);
      const current = groups.get(day) ?? {
        totalAbsoluteError: 0,
        totalBias: 0,
        count: 0,
      };

      current.totalAbsoluteError += point.absoluteErrorMW;
      current.totalBias += point.errorMW;
      current.count += 1;
      groups.set(day, current);
    }

    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, values]) => ({
        day: formatDay(day),
        mae: Math.round(values.totalAbsoluteError / values.count),
        bias: Math.round(values.totalBias / values.count),
      }));
  }, [data]);

  const summary = data?.summary;
  const bias = summary?.biasMW ?? null;

  function exportCsv() {
    if (!data) return;

    const headers = [
      "Delivery time (UTC)",
      "Forecast published at (UTC)",
      "Forecast (MW)",
      "Actual (MW)",
      "Error (MW)",
      "Absolute error (MW)",
    ];

    const rows = data.series.map((point) => [
      point.deliveryTime,
      point.forecastPublishedAt,
      point.forecastMW,
      point.actualMW,
      point.errorMW,
      point.absoluteErrorMW,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = "windlens-january-2026-analysis.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="WindLens home">
          <span className="brand-mark">
            <Wind size={24} strokeWidth={2.2} />
          </span>
          <span>
            <strong>windlens</strong>
            <small>ENERGY INTELLIGENCE</small>
          </span>
        </a>

        <div className="nav-label">WORKSPACE</div>
        <div className="nav-item active">
          <Activity size={18} />
          <span>Forecast performance</span>
        </div>
        <div className="nav-item">
          <CalendarDays size={18} />
          <span>Historical analysis</span>
          <span className="nav-soon">CURRENT</span>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="status-dot" />
            <div>
              <strong>Data connection</strong>
              <small>
                {error
                  ? "Connection issue"
                  : loading
                    ? "Connecting…"
                    : "Elexon API"}
              </small>
            </div>
          </div>
          <p>UK WIND GENERATION</p>
          <p>Prototype · January 2026</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> Forecast performance
          </div>
          <div className="topbar-right">
            <span className="period-badge">
              <span className="status-dot" />
              Historical analysis
            </span>
            <span className="avatar">WL</span>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <Zap size={14} /> PROCUREMENT INTELLIGENCE
              </div>
              <h1>Wind forecast performance</h1>
              <p className="page-description">
                Understand the gap between day-ahead wind forecasts and
                delivered generation across Great Britain.
              </p>
            </div>

            <div className="heading-actions">
              <button
                className="button button-secondary"
                onClick={() => void loadAnalysis()}
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? "spin" : ""} />
                Refresh
              </button>
              <button
                className="button button-primary"
                onClick={exportCsv}
                disabled={!data}
              >
                <Download size={16} />
                Export CSV
              </button>
            </div>
          </section>

          <section className="context-strip">
            <div className="context-icon">
              <CalendarDays size={19} />
            </div>
            <div>
              <strong>Analysis period</strong>
              <span>01 Jan — 31 Jan 2026</span>
            </div>
            <div className="context-divider" />
            <div>
              <strong>Forecast selection</strong>
              <span>Latest available by 10:00 a.m. UK time, day ahead</span>
            </div>
            <div className="context-divider" />
            <div>
              <strong>Source</strong>
              <span>Elexon BMRS</span>
            </div>
          </section>

          {error && (
            <div className="error-banner">
              <AlertCircle size={20} />
              <div>
                <strong>Unable to load analysis</strong>
                <p>{error}</p>
                <span>
                  Confirm that the FastAPI backend is running on port 8000.
                </span>
              </div>
              <button
                className="button button-secondary"
                onClick={() => void loadAnalysis()}
              >
                Try again
              </button>
            </div>
          )}

          {loading && !data ? (
            <div className="loading-panel">
              <span className="loading-spinner" />
              <strong>Loading January wind data…</strong>
              <p>Retrieving forecast performance from the analysis API.</p>
            </div>
          ) : (
            <>
              <section className="section-heading">
                <div>
                  <h2>Performance overview</h2>
                  <p>January 2026 · Hourly matched delivery periods</p>
                </div>
                {lastUpdated && (
                  <span className="updated-label">
                    <CheckCircle2 size={15} />
                    Loaded {lastUpdated.toLocaleTimeString("en-GB")}
                  </span>
                )}
              </section>

              <section className="kpi-grid">
                <article className="kpi-card">
                  <div className="kpi-top">
                    <span>Mean absolute error</span>
                    <span className="kpi-icon blue">
                      <Gauge size={19} />
                    </span>
                  </div>
                  <div className="kpi-value">
                    {loading && !data ? "…" : formatMW(summary?.maeMW ?? null)}
                  </div>
                  <div className="kpi-foot">
                    Average absolute forecast deviation
                  </div>
                </article>

                <article className="kpi-card">
                  <div className="kpi-top">
                    <span>Root mean square error</span>
                    <span className="kpi-icon purple">
                      <Activity size={19} />
                    </span>
                  </div>
                  <div className="kpi-value">
                    {formatMW(summary?.rmseMW ?? null)}
                  </div>
                  <div className="kpi-foot">
                    Penalises larger forecast errors
                  </div>
                </article>

                <article className="kpi-card">
                  <div className="kpi-top">
                    <span>Forecast bias</span>
                    <span
                      className={`kpi-icon ${bias !== null && bias > 0 ? "orange" : "green"}`}
                    >
                      {bias !== null && bias > 0 ? (
                        <ArrowUpRight size={19} />
                      ) : (
                        <ArrowDownRight size={19} />
                      )}
                    </span>
                  </div>
                  <div className="kpi-value">
                    {bias === null
                      ? "—"
                      : `${bias > 0 ? "+" : ""}${numberFormat.format(bias)} MW`}
                  </div>
                  <div className="kpi-foot">
                    {bias === null
                      ? "Mean forecast minus actual"
                      : bias > 0
                        ? "Overforecast on average"
                        : bias < 0
                          ? "Underforecast on average"
                          : "No average directional bias"}
                  </div>
                </article>

                <article className="kpi-card">
                  <div className="kpi-top">
                    <span>Data coverage</span>
                    <span className="kpi-icon green">
                      <ShieldCheck size={19} />
                    </span>
                  </div>
                  <div className="kpi-value">
                    {decimalFormat.format(summary?.coveragePercent ?? 0)}%
                  </div>
                  <div className="coverage-track">
                    <span
                      style={{
                        width: `${Math.min(summary?.coveragePercent ?? 0, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="kpi-foot">
                    {summary?.matchedPeriods ?? 0} of{" "}
                    {summary?.expectedPeriods ?? 744} expected hours matched
                  </div>
                </article>
              </section>

              <section className="chart-card">
                <div className="chart-header">
                  <div>
                    <h2>Forecast vs actual generation</h2>
                    <p>Hourly wind generation · Megawatts (MW)</p>
                  </div>
                  <label className="select-wrap">
                    <CalendarDays size={16} />
                    <select
                      value={selectedDay}
                      onChange={(event) => setSelectedDay(event.target.value)}
                    >
                      <option value="all">Entire month</option>
                      {availableDays.map((day) => (
                        <option key={day} value={day}>
                          {formatDay(day)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} />
                  </label>
                </div>

                <div className="chart-legend-note">
                  <span>
                    <i className="legend-dot forecast-dot" /> Day-ahead forecast
                  </span>
                  <span>
                    <i className="legend-dot actual-dot" /> Actual generation
                  </span>
                </div>

                <div className="chart-area">
                  {hourlyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={hourlyChartData}
                        margin={{ top: 12, right: 16, left: 6, bottom: 4 }}
                      >
                        <CartesianGrid
                          stroke="#e8edf4"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="timeLabel"
                          tick={{ fill: "#778397", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={selectedDay === "all" ? 45 : 28}
                        />
                        <YAxis
                          tickFormatter={(value) =>
                            `${Math.round(value / 1000)}k`
                          }
                          tick={{ fill: "#778397", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={45}
                        />
                        <Tooltip
                          labelFormatter={(label) => String(label)}
                          formatter={(value, name) => [
                            `${numberFormat.format(Number(value))} MW`,
                            name === "forecastMW" ? "Forecast" : "Actual",
                          ]}
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid #e5eaf2",
                            boxShadow: "0 8px 24px #172b4d12",
                            fontSize: 12,
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ display: "none" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="forecastMW"
                          name="forecastMW"
                          stroke="#3978f6"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="actualMW"
                          name="actualMW"
                          stroke="#17a673"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-chart">
                      No matched hourly data for this selection.
                    </div>
                  )}
                </div>
                <div className="chart-footer">
                  <Clock3 size={14} />
                  Delivery timestamps are displayed in UK local time. CSV
                  timestamps remain in UTC.
                </div>
              </section>

              <section className="lower-grid">
                <article className="chart-card daily-card">
                  <div className="chart-header">
                    <div>
                      <h2>Daily forecast error</h2>
                      <p>Mean absolute error by delivery day</p>
                    </div>
                    <span className="small-tag">MW</span>
                  </div>
                  <div className="daily-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyChartData}
                        margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="#e8edf4"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          tick={{ fill: "#778397", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          interval={selectedDay === "all" ? 3 : 0}
                        />
                        <YAxis
                          tickFormatter={(value) =>
                            `${Math.round(value / 1000)}k`
                          }
                          tick={{ fill: "#778397", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          width={38}
                        />
                        <Tooltip
                          formatter={(value) => [
                            `${numberFormat.format(Number(value))} MW`,
                            "Mean absolute error",
                          ]}
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid #e5eaf2",
                            fontSize: 12,
                          }}
                        />
                        <Bar
                          dataKey="mae"
                          fill="#3978f6"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={22}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="insight-card">
                  <div className="insight-icon">
                    <Activity size={20} />
                  </div>
                  <h2>Reading the numbers</h2>
                  <p>
                    Forecast error is calculated as{" "}
                    <strong>forecast minus actual</strong>. A positive bias
                    means forecast generation was higher than delivered
                    generation.
                  </p>
                  <div className="insight-divider" />
                  <div className="insight-stat">
                    <span>Matched hourly periods</span>
                    <strong>
                      {summary?.matchedPeriods ?? 0} /{" "}
                      {summary?.expectedPeriods ?? 744}
                    </strong>
                  </div>
                  <div className="insight-stat">
                    <span>Actual hourly periods</span>
                    <strong>{data.dataQuality.actualHourlyPeriods}</strong>
                  </div>
                  <div className="insight-stat">
                    <span>Selected forecast periods</span>
                    <strong>{data.dataQuality.forecastPeriods}</strong>
                  </div>
                  <div className="insight-stat">
                    <span>Unmatched actual periods</span>
                    <strong>{data.dataQuality.unmatchedActualPeriods}</strong>
                  </div>
                </article>
              </section>

              <section className="chart-card table-card">
                <div className="chart-header">
                  <div>
                    <h2>Delivery-period detail</h2>
                    <p>
                      {selectedDay === "all"
                        ? "All matched hourly periods"
                        : `Delivery periods for ${formatDay(selectedDay)}`}
                    </p>
                  </div>
                  <span className="small-tag">
                    {filteredSeries.length} periods
                  </span>
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Delivery time (UK)</th>
                        <th>Forecast (MW)</th>
                        <th>Actual (MW)</th>
                        <th>Error (MW)</th>
                        <th>Forecast vintage (UK)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSeries.slice(0, 48).map((point) => (
                        <tr key={point.deliveryTime}>
                          <td>{formatTimestamp(point.deliveryTime)}</td>
                          <td>{numberFormat.format(point.forecastMW)}</td>
                          <td>{numberFormat.format(point.actualMW)}</td>
                          <td>
                            <span
                              className={`error-value ${point.errorMW > 0 ? "positive" : point.errorMW < 0 ? "negative" : ""}`}
                            >
                              {point.errorMW > 0 ? "+" : ""}
                              {numberFormat.format(point.errorMW)}
                            </span>
                          </td>
                          <td>{formatTimestamp(point.forecastPublishedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredSeries.length > 48 && (
                  <div className="table-footer">
                    Showing the first 48 of {filteredSeries.length} periods.
                    Export the CSV for the complete dataset.
                  </div>
                )}
              </section>

              <section className="methodology">
                <div className="methodology-icon">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3>Methodology & limitations</h3>
                  <p>
                    This prototype selects the latest available forecast
                    published by 10:00 a.m. UK time on the day before delivery.
                    Half-hourly actual generation is averaged into hourly values
                    to align with the forecast series. MAE and RMSE measure
                    error magnitude; bias measures directional error. These are
                    generation forecast metrics, not estimates of financial or
                    balancing costs.
                  </p>
                </div>
              </section>
            </>
          )}

          <footer className="page-footer">
            <span>
              WINDLENS <span className="footer-separator">/</span> FORECAST
              INTELLIGENCE
            </span>
            <span>
              {lastUpdated
                ? `Last loaded ${lastUpdated.toLocaleTimeString("en-GB")}`
                : "January 2026 analysis"}
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
