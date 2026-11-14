import { desc, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  lotteryProvinces,
  lotteryResults,
  seoMetadata,
} from '../../src/db/schema.ts';
import {
  generateHomePageJsonLd,
  generateProvincePageJsonLd,
  generateRegionalPageJsonLd,
  generateUtilityPageJsonLd,
  generateVietlottPageJsonLd,
  serializeJsonLd,
  type GeneratedSeoPayload,
  type JsonLdLotteryDrawInput,
  type JsonLdProvinceInput,
} from '../../src/utils/jsonLdGenerator.ts';
import type {
  RegionKey,
  VietlottMax3DResult,
  VietlottMegaResult,
  VietlottPowerResult,
} from '../../src/types/lottery.ts';
import { getTodayVNISO } from './lotteryDataHelper.ts';
import { getLatestVietlottFromDB } from './lotterySyncService.ts';

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toDrawInput(row: typeof lotteryResults.$inferSelect): JsonLdLotteryDrawInput {
  return {
    drawDate: row.drawDate,
    region: (['MB', 'MN', 'MT'].includes(row.region) ? row.region : 'MB') as RegionKey,
    provinceCode: row.provinceCode,
    provinceName: row.provinceName,
    kyHieu: Array.isArray(row.kyHieu) ? (row.kyHieu as string[]) : [],
    prizes: (row.prizes && typeof row.prizes === 'object'
      ? row.prizes
      : {}) as Record<string, string[]>,
    allTails: Array.isArray(row.allTails) ? (row.allTails as string[]) : [],
    specialTail: row.specialTail || '',
  };
}

export async function resolveServerSeoPayload(
  rawPath: string,
  origin: string,
  dateParam?: string
): Promise<GeneratedSeoPayload | null> {
  const cleanPath = (rawPath.split('?')[0].replace(/\/+$/, '') || '/').toLowerCase();
  const targetDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getTodayVNISO();

  if (cleanPath === '/xsmb' || cleanPath === '/xsmn' || cleanPath === '/xsmt') {
    const region: RegionKey =
      cleanPath === '/xsmb' ? 'MB' : cleanPath === '/xsmn' ? 'MN' : 'MT';

    let rows = await db
      .select()
      .from(lotteryResults)
      .where(eq(lotteryResults.drawDate, targetDate))
      .orderBy(lotteryResults.region, lotteryResults.id);

    let effectiveDate = targetDate;
    if (!rows.some((r) => r.region === region)) {
      const latest = await db
        .select()
        .from(lotteryResults)
        .where(eq(lotteryResults.region, region))
        .orderBy(desc(lotteryResults.drawDate))
        .limit(1);
      if (latest[0]) {
        effectiveDate = latest[0].drawDate;
        rows = await db
          .select()
          .from(lotteryResults)
          .where(eq(lotteryResults.drawDate, effectiveDate))
          .orderBy(lotteryResults.region, lotteryResults.id);
      }
    }

    return generateRegionalPageJsonLd({
      origin,
      region,
      date: effectiveDate,
      draws: rows.map(toDrawInput),
    });
  }

  if (cleanPath === '/tinh' || cleanPath.startsWith('/tinh/')) {
    const slug = cleanPath === '/tinh' ? '' : cleanPath.slice('/tinh/'.length);
    const provinces = await db
      .select()
      .from(lotteryProvinces)
      .orderBy(lotteryProvinces.region, lotteryProvinces.name);

    const matchedProvince = slug
      ? provinces.find((p) => p.slug.toLowerCase() === slug)
      : provinces[0];

    if (!matchedProvince) {
      return generateUtilityPageJsonLd({
        origin,
        path: cleanPath,
        title: 'Kết Quả Xổ Số Theo Tỉnh / Thành Phố | xosothantai1.com',
        description:
          'Tra cứu kết quả xổ số kiến thiết theo từng tỉnh thành phố trên toàn quốc tại xosothantai1.com.',
        breadcrumbName: 'Xổ số theo tỉnh',
      });
    }

    const draws = await db
      .select()
      .from(lotteryResults)
      .where(eq(lotteryResults.provinceCode, matchedProvince.code))
      .orderBy(desc(lotteryResults.drawDate))
      .limit(8);

    const provinceInput: JsonLdProvinceInput = {
      code: matchedProvince.code,
      name: matchedProvince.name,
      slug: matchedProvince.slug,
      region: (['MB', 'MN', 'MT'].includes(matchedProvince.region)
        ? matchedProvince.region
        : 'MB') as RegionKey,
      drawDays: Array.isArray(matchedProvince.drawDays)
        ? (matchedProvince.drawDays as number[])
        : [],
      drawTime: matchedProvince.drawTime,
    };

    return generateProvincePageJsonLd({
      origin,
      province: provinceInput,
      draws: draws.map(toDrawInput),
    });
  }

  if (cleanPath === '/vietlott') {
    const rows = await getLatestVietlottFromDB(targetDate);
    const megaRow = rows.find((r) => r.gameType === 'MEGA_645');
    const powerRow = rows.find((r) => r.gameType === 'POWER_655');
    const max3dRow = rows.find((r) => r.gameType === 'MAX_3D');

    const mega: VietlottMegaResult | null = megaRow
      ? {
          period: megaRow.period,
          date: megaRow.drawDate,
          numbers: Array.isArray(megaRow.numbers) ? (megaRow.numbers as number[]) : [],
          jackpotValue: megaRow.jackpot1Value || '',
          winnersJackpot: Number((megaRow.prizeBreakdown as Record<string, unknown>)?.winnersJackpot || 0),
          winnersFirst: Number((megaRow.prizeBreakdown as Record<string, unknown>)?.winnersFirst || 14),
          winnersSecond: Number((megaRow.prizeBreakdown as Record<string, unknown>)?.winnersSecond || 680),
          winnersThird: Number((megaRow.prizeBreakdown as Record<string, unknown>)?.winnersThird || 12400),
        }
      : null;

    const power: VietlottPowerResult | null = powerRow
      ? {
          period: powerRow.period,
          date: powerRow.drawDate,
          numbers: Array.isArray(powerRow.numbers) ? (powerRow.numbers as number[]) : [],
          bonusNumber: powerRow.bonusNumber || 1,
          jackpot1Value: powerRow.jackpot1Value || '',
          jackpot2Value: powerRow.jackpot2Value || '',
          winnersJp1: Number((powerRow.prizeBreakdown as Record<string, unknown>)?.winnersJp1 || 0),
          winnersJp2: Number((powerRow.prizeBreakdown as Record<string, unknown>)?.winnersJp2 || 0),
        }
      : null;

    const max3d: VietlottMax3DResult | null = max3dRow
      ? {
          period: max3dRow.period,
          date: max3dRow.drawDate,
          special: ((max3dRow.prizeBreakdown as Record<string, unknown>)?.special as string[]) || [],
          first: ((max3dRow.prizeBreakdown as Record<string, unknown>)?.first as string[]) || [],
          second: ((max3dRow.prizeBreakdown as Record<string, unknown>)?.second as string[]) || [],
          third: ((max3dRow.prizeBreakdown as Record<string, unknown>)?.third as string[]) || [],
        }
      : null;

    return generateVietlottPageJsonLd({
      origin,
      date: targetDate,
      mega,
      power,
      max3d,
    });
  }

  if (cleanPath === '/') {
    const rows = await db
      .select()
      .from(lotteryResults)
      .where(eq(lotteryResults.drawDate, targetDate))
      .orderBy(lotteryResults.region, lotteryResults.id);

    const [homeSeo] = await db
      .select()
      .from(seoMetadata)
      .where(eq(seoMetadata.routePath, '/'))
      .limit(1);

    return generateHomePageJsonLd({
      origin,
      date: targetDate,
      draws: rows.map(toDrawInput),
      customTitle: homeSeo?.title,
      customDescription: homeSeo?.description,
    });
  }

  const [seoRow] = await db
    .select()
    .from(seoMetadata)
    .where(eq(seoMetadata.routePath, cleanPath))
    .limit(1);

  if (seoRow) {
    return generateUtilityPageJsonLd({
      origin,
      path: cleanPath,
      title: seoRow.title,
      description: seoRow.description,
      breadcrumbName: seoRow.title.split('–')[0].trim(),
    });
  }

  return null;
}

export function injectSeoPayloadIntoHtml(
  html: string,
  payload: GeneratedSeoPayload,
  origin: string
): string {
  const fullCanonical = `${origin}${payload.canonicalPath}`;
  const safeTitle = escapeHtmlText(payload.title);
  const safeDesc = escapeHtmlAttr(payload.description);
  const safeCanonical = escapeHtmlAttr(fullCanonical);

  let updated = html;

  updated = updated.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  updated = updated.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${safeDesc}" />`
  );
  if (/<link\s+rel="canonical"/i.test(updated)) {
    updated = updated.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${safeCanonical}" />`
    );
  } else {
    updated = updated.replace(
      '</head>',
      `    <link rel="canonical" href="${safeCanonical}" />\n  </head>`
    );
  }
  updated = updated.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${safeCanonical}" />`
  );
  updated = updated.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtmlAttr(payload.title)}" />`
  );
  updated = updated.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${safeDesc}" />`
  );
  updated = updated.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtmlAttr(payload.title)}" />`
  );
  updated = updated.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${safeDesc}" />`
  );

  const jsonLdScript = `<script id="lottery-result-jsonld" type="application/ld+json">${serializeJsonLd(
    payload.jsonLd
  )}</script>`;

  if (updated.includes('id="lottery-result-jsonld"')) {
    updated = updated.replace(
      /<script\s+id="lottery-result-jsonld"[\s\S]*?<\/script>/i,
      jsonLdScript
    );
  } else {
    updated = updated.replace('</head>', `    ${jsonLdScript}\n  </head>`);
  }

  return updated;
}
