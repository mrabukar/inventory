import { Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import {
  sqlInclusiveDateRange,
  toSqlCalendarDate,
} from "./sql-calendar-date.util";

describe("toSqlCalendarDate", () => {
  it("returns validated YYYY-MM-DD", () => {
    expect(toSqlCalendarDate("2026-07-05")).toBe("2026-07-05");
  });

  it("rejects invalid dates", () => {
    expect(() => toSqlCalendarDate("not-a-date")).toThrow();
  });
});

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("sqlInclusiveDateRange (integration)", () => {
  const prisma = new PrismaClient();
  const orgId = "cmqtqhyf30000kvhq584fb5tz";

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("includes sales on the range start date (Jul 5–6)", async () => {
    const bounds = sqlInclusiveDateRange(
      Prisma.sql`s."saleDate"`,
      "2026-07-05",
      "2026-07-06",
    );

    const [agg, raw] = await Promise.all([
      prisma.saleItem.aggregate({
        where: {
          organizationId: orgId,
          saleDate: {
            gte: new Date("2026-07-05T12:00:00.000Z"),
            lte: new Date("2026-07-06T12:00:00.000Z"),
          },
        },
        _sum: { quantitySold: true },
      }),
      prisma.$queryRaw<{ units: number | null; cogs: unknown }[]>`
        SELECT
          SUM(s."quantitySold")::int AS units,
          COALESCE(SUM(s."quantitySold" * s."unitPurchasePrice"), 0)::numeric AS cogs
        FROM "sale_item" s
        WHERE s."organizationId" = ${orgId}
          AND ${bounds}
      `,
    ]);

    const prismaUnits = agg._sum.quantitySold ?? 0;
    const rawUnits = raw[0]?.units ?? 0;
    const rawCogs = Number(raw[0]?.cogs ?? 0);

    expect(prismaUnits).toBeGreaterThan(0);
    expect(rawUnits).toBe(prismaUnits);
    expect(rawCogs).toBeGreaterThan(0);
  });
});
