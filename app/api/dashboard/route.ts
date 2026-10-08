import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/dashboard -> metricas agregadas (cualquier usuario logueado)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // Rango de los ultimos 6 meses (incluido el actual)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [totalReports, reportsThisMonth, totalRecipients, totalUsers, recent] =
      await Promise.all([
        prisma.report.count(),
        prisma.report.count({ where: { createdAt: { gte: startOfMonth } } }),
        prisma.recipient.count(),
        prisma.user.count(),
        prisma.report.findMany({
          where: { reportDate: { gte: sixMonthsAgo } },
          select: {
            reportDate: true,
            author: true,
            recipients: { select: { name: true } },
            recipient: true,
          },
        }),
      ]);

    // Reportes por mes (ultimos 6 meses)
    const monthKeys: string[] = [];
    const monthLabels: Record<string, string> = {};
    const meses = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      monthKeys.push(key);
      monthLabels[key] = `${meses[d.getMonth()]} ${d.getFullYear()}`;
    }
    const byMonthCount: Record<string, number> = {};
    monthKeys.forEach((k) => (byMonthCount[k] = 0));

    const authorCount: Record<string, number> = {};
    const recipientCount: Record<string, number> = {};

    for (const r of recent) {
      const d = new Date(r.reportDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      if (key in byMonthCount) byMonthCount[key] += 1;

      authorCount[r.author] = (authorCount[r.author] ?? 0) + 1;

      const names = r.recipients.length
        ? r.recipients.map((x) => x.name)
        : r.recipient
        ? [r.recipient]
        : [];
      for (const n of names) {
        recipientCount[n] = (recipientCount[n] ?? 0) + 1;
      }
    }

    const reportsByMonth = monthKeys.map((k) => ({
      month: monthLabels[k],
      total: byMonthCount[k],
    }));

    const topAuthors = Object.entries(authorCount)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const topRecipients = Object.entries(recipientCount)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return NextResponse.json({
      summary: {
        totalReports,
        reportsThisMonth,
        totalRecipients,
        totalUsers,
      },
      reportsByMonth,
      topAuthors,
      topRecipients,
    });
  } catch (error) {
    console.error("Error en dashboard:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las metricas." },
      { status: 500 }
    );
  }
}
