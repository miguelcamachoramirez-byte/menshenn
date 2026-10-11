"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import Loader from "../components/Loader";

type DashboardData = {
  summary: {
    totalReports: number;
    reportsThisMonth: number;
    totalRecipients: number;
    totalUsers: number;
  };
  reportsByMonth: { month: string; total: number }[];
  topAuthors: { name: string; total: number }[];
  topRecipients: { name: string; total: number }[];
};

const BAR_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-value">
        {payload[0].value} reporte(s)
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (!res.ok) throw new Error("No se pudieron cargar las metricas.");
        setData(await res.json());
      } catch (err: any) {
        setError(err.message || "Error al cargar el dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="container">
      <div className="topbar">
        <div className="user-info">Metricas</div>
        <div className="topbar-actions">
          <Link href="/" className="nav-link">
            Volver a reportes
          </Link>
        </div>
      </div>

      <header className="header">
        <h1>Metricas</h1>
        <p>Resumen y estadisticas de la actividad de reportes.</p>
      </header>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <Loader text="Cargando metricas..." />
      ) : !data ? (
        <div className="empty-state">No hay datos para mostrar.</div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Total reportes</span>
              <span className="stat-value">{data.summary.totalReports}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Reportes este mes</span>
              <span className="stat-value">
                {data.summary.reportsThisMonth}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Tipos de reporte</span>
              <span className="stat-value">
                {data.summary.totalRecipients}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Usuarios</span>
              <span className="stat-value">{data.summary.totalUsers}</span>
            </div>
          </div>

          <div className="card">
            <h2 className="chart-title">Reportes por mes</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.reportsByMonth}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    allowDecimals={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "rgba(99,102,241,0.08)" }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="charts-row">
            <div className="card">
              <h2 className="chart-title">Top autores</h2>
              {data.topAuthors.length === 0 ? (
                <div className="empty-state">Sin datos.</div>
              ) : (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={data.topAuthors}
                      layout="vertical"
                      margin={{ left: 10 }}
                    >
                      <XAxis
                        type="number"
                        stroke="#94a3b8"
                        fontSize={12}
                        allowDecimals={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#94a3b8"
                        fontSize={12}
                        width={110}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: "rgba(99,102,241,0.08)" }}
                      />
                      <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                        {data.topAuthors.map((_, i) => (
                          <Cell
                            key={i}
                            fill={BAR_COLORS[i % BAR_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="chart-title">Top tipos de reporte</h2>
              {data.topRecipients.length === 0 ? (
                <div className="empty-state">Sin datos.</div>
              ) : (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={data.topRecipients}
                      layout="vertical"
                      margin={{ left: 10 }}
                    >
                      <XAxis
                        type="number"
                        stroke="#94a3b8"
                        fontSize={12}
                        allowDecimals={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#94a3b8"
                        fontSize={12}
                        width={110}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: "rgba(16,185,129,0.08)" }}
                      />
                      <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                        {data.topRecipients.map((_, i) => (
                          <Cell
                            key={i}
                            fill={BAR_COLORS[(i + 2) % BAR_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
