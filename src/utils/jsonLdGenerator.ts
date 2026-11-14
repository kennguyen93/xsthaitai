import { XSMB_PRIZE_PAYOUTS, XSMN_MT_PRIZE_PAYOUTS } from '../data/lotterySchedule.ts';
import type {
  RegionKey,
  VietlottMax3DResult,
  VietlottMegaResult,
  VietlottPowerResult,
} from '../types/lottery.ts';
import { formatDateVN, getDayNameVN } from './lotteryEngine.ts';

export interface JsonLdLotteryDrawInput {
  drawDate: string;
  region: RegionKey;
  provinceCode: string;
  provinceName: string;
  kyHieu?: string[];
  prizes: Record<string, string[]>;
  allTails?: string[];
  specialTail?: string;
}

export interface JsonLdProvinceInput {
  code: string;
  name: string;
  slug: string;
  region: RegionKey;
  drawDays: number[];
  drawTime: string;
}

export interface GeneratedSeoPayload {
  title: string;
  description: string;
  canonicalPath: string;
  jsonLd: Record<string, unknown>;
}

const REGION_LABELS: Record<RegionKey, string> = {
  MB: 'Miền Bắc',
  MN: 'Miền Nam',
  MT: 'Miền Trung',
};

const REGION_DRAW_TIMES: Record<RegionKey, string> = {
  MB: '18:15:00+07:00',
  MN: '16:15:00+07:00',
  MT: '17:15:00+07:00',
};

export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function buildOrganizationNode(origin: string) {
  return {
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: 'xosothantai1.com',
    url: origin,
    description:
      'Cổng thông tin tra cứu kết quả xổ số kiến thiết 3 miền Bắc, Trung, Nam, Vietlott và thống kê lịch sử 10 năm.',
  };
}

function buildWebSiteNode(origin: string) {
  return {
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: 'xosothantai1.com',
    url: origin,
    inLanguage: 'vi-VN',
    publisher: {
      '@id': `${origin}/#organization`,
    },
  };
}

function buildBreadcrumbNode(
  origin: string,
  pageUrl: string,
  items: { name: string; path: string }[]
) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: `${origin}${item.path}`,
    })),
  };
}

function computeAllTailsFallback(prizes: Record<string, string[]>): string[] {
  const tails: string[] = [];
  Object.values(prizes).forEach((arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((num) => {
      const cleaned = String(num).replace(/\D/g, '');
      if (cleaned.length >= 2) {
        tails.push(cleaned.slice(-2));
      }
    });
  });
  return tails;
}

function buildPrizeMeasuredValues(draw: JsonLdLotteryDrawInput) {
  const payouts = draw.region === 'MB' ? XSMB_PRIZE_PAYOUTS : XSMN_MT_PRIZE_PAYOUTS;
  const values: Record<string, unknown>[] = [];

  payouts.forEach((tier) => {
    const nums = draw.prizes[tier.key] || [];
    if (nums.length === 0) return;
    values.push({
      '@type': 'PropertyValue',
      name: tier.label,
      propertyID: `${draw.provinceCode}_${tier.key}`,
      value: nums.join(', '),
      unitText: tier.amount,
    });
  });

  const specialNum = (draw.prizes.db && draw.prizes.db[0]) || '';
  const specialTail = draw.specialTail || (specialNum.length >= 2 ? specialNum.slice(-2) : '');
  if (specialTail) {
    values.push({
      '@type': 'PropertyValue',
      name: '2 số cuối Giải Đặc Biệt (Đề)',
      propertyID: `${draw.provinceCode}_special_tail`,
      value: specialTail,
    });
  }

  const allTails =
    draw.allTails && draw.allTails.length > 0
      ? draw.allTails
      : computeAllTailsFallback(draw.prizes);
  if (allTails.length > 0) {
    values.push({
      '@type': 'PropertyValue',
      name: 'Lô tô 2 số',
      propertyID: `${draw.provinceCode}_loto_2d`,
      value: allTails.join(', '),
    });
  }

  if (draw.kyHieu && draw.kyHieu.length > 0) {
    values.push({
      '@type': 'PropertyValue',
      name: 'Ký hiệu vé trúng Đặc Biệt',
      propertyID: `${draw.provinceCode}_ky_hieu`,
      value: draw.kyHieu.join(', '),
    });
  }

  return values;
}

function buildDrawPrizeItemList(
  draw: JsonLdLotteryDrawInput,
  listId: string
): Record<string, unknown> {
  const payouts = draw.region === 'MB' ? XSMB_PRIZE_PAYOUTS : XSMN_MT_PRIZE_PAYOUTS;
  const dateVN = formatDateVN(draw.drawDate);
  const elements: Record<string, unknown>[] = [];

  payouts.forEach((tier) => {
    const nums = draw.prizes[tier.key] || [];
    if (nums.length === 0) return;
    elements.push({
      '@type': 'ListItem',
      position: elements.length + 1,
      name: tier.label,
      item: {
        '@type': 'Thing',
        identifier: `${draw.provinceCode}-${draw.drawDate}-${tier.key}`,
        name: `${tier.label}: ${nums.join(', ')}`,
        description: `Xổ số ${draw.provinceName} (${draw.provinceCode}) ngày ${dateVN} - ${tier.label} (${tier.amount}): ${nums.join(', ')}`,
      },
    });
  });

  return {
    '@type': 'ItemList',
    '@id': listId,
    name: `Bảng số trúng thưởng Xổ số ${draw.provinceName} (${draw.provinceCode}) ngày ${dateVN}`,
    numberOfItems: elements.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: elements,
  };
}

function buildDrawEventNode(
  draw: JsonLdLotteryDrawInput,
  eventId: string,
  drawTimeOverride?: string
) {
  const dateVN = formatDateVN(draw.drawDate);
  const isoTime = drawTimeOverride
    ? `${drawTimeOverride.length === 5 ? `${drawTimeOverride}:00` : drawTimeOverride}+07:00`
    : REGION_DRAW_TIMES[draw.region];
  const startDate = `${draw.drawDate}T${isoTime}`;

  return {
    '@type': 'Event',
    '@id': eventId,
    name: `Kỳ quay thưởng Xổ số ${draw.provinceName} (${draw.provinceCode}) ngày ${dateVN}`,
    startDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: `${draw.provinceName}, Việt Nam`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: draw.provinceName,
        addressCountry: 'VN',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: `Công ty Xổ số Kiến thiết ${draw.provinceName}`,
    },
  };
}

function parseJackpotVnd(valueStr: string): number | null {
  const digits = String(valueStr || '').replace(/\D/g, '');
  if (!digits) return null;
  const num = Number(digits);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function generateProvincePageJsonLd({
  origin,
  province,
  draws,
}: {
  origin: string;
  province: JsonLdProvinceInput;
  draws: JsonLdLotteryDrawInput[];
}): GeneratedSeoPayload {
  const canonicalPath = `/tinh/${province.slug}`;
  const pageUrl = `${origin}${canonicalPath}`;
  const regionLabel = REGION_LABELS[province.region];
  const latest = draws[0] || null;
  const latestDateVN = latest ? formatDateVN(latest.drawDate) : '';
  const latestSpecial = latest?.prizes?.db?.[0] || '';
  const latestFirst = latest?.prizes?.g1?.[0] || '';

  const title = latest
    ? `Xổ Số ${province.name} (${province.code}) Ngày ${latestDateVN} – Giải ĐB ${latestSpecial} | xosothantai1.com`
    : `Kết Quả Xổ Số ${province.name} (${province.code}) – Xổ Số ${regionLabel} | xosothantai1.com`;

  const description = latest
    ? `Kết quả Xổ số ${province.name} (${province.code} - ${regionLabel}) ngày ${latestDateVN}: Giải Đặc Biệt ${latestSpecial}${
        latestFirst ? `, Giải Nhất ${latestFirst}` : ''
      }. Tra cứu đầy đủ giải thưởng và lịch sử các kỳ quay gần nhất.`
    : `Tra cứu kết quả Xổ số kiến thiết ${province.name} (${province.code}), lịch mở thưởng lúc ${province.drawTime} và bảng thống kê giải thưởng chi tiết.`;

  const graph: Record<string, unknown>[] = [
    buildOrganizationNode(origin),
    buildWebSiteNode(origin),
    buildBreadcrumbNode(origin, pageUrl, [
      { name: 'Trang chủ', path: '/' },
      { name: 'Xổ số theo tỉnh', path: '/tinh' },
      { name: `Xổ số ${province.name}`, path: canonicalPath },
    ]),
  ];

  const mainEntityId = latest ? `${pageUrl}#dataset-${latest.drawDate}` : `${pageUrl}#webpage`;

  graph.push({
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: title,
    description,
    inLanguage: 'vi-VN',
    isPartOf: { '@id': `${origin}/#website` },
    breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
    mainEntity: { '@id': mainEntityId },
    ...(latest
      ? {
          datePublished: `${latest.drawDate}T${province.drawTime}:00+07:00`,
          dateModified: `${latest.drawDate}T${province.drawTime}:00+07:00`,
        }
      : {}),
  });

  if (latest) {
    const eventId = `${pageUrl}#event-${latest.drawDate}`;
    const prizeListId = `${pageUrl}#prizes-${latest.drawDate}`;

    graph.push(buildDrawEventNode(latest, eventId, province.drawTime));

    graph.push({
      '@type': 'Dataset',
      '@id': mainEntityId,
      name: `Kết quả Xổ số ${province.name} (${province.code}) ngày ${latestDateVN}`,
      description,
      url: pageUrl,
      inLanguage: 'vi-VN',
      temporalCoverage:
        draws.length > 1
          ? `${draws[draws.length - 1].drawDate}/${latest.drawDate}`
          : latest.drawDate,
      keywords: [
        `XS${province.name}`,
        province.code,
        `Xổ số ${province.name}`,
        `KQXS ${province.name} ${latestDateVN}`,
        ...(latestSpecial ? [`Giải đặc biệt ${latestSpecial}`] : []),
      ],
      creator: { '@id': `${origin}/#organization` },
      about: { '@id': eventId },
      variableMeasured: buildPrizeMeasuredValues(latest),
      hasPart: draws.slice(0, 8).map((d) => ({
        '@type': 'Dataset',
        name: `Kỳ quay ${province.name} ngày ${formatDateVN(d.drawDate)}`,
        temporalCoverage: d.drawDate,
        variableMeasured: buildPrizeMeasuredValues(d),
      })),
    });

    graph.push(buildDrawPrizeItemList(latest, prizeListId));
  }

  return {
    title,
    description,
    canonicalPath,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': graph,
    },
  };
}

export function generateRegionalPageJsonLd({
  origin,
  region,
  date,
  draws,
}: {
  origin: string;
  region: RegionKey;
  date: string;
  draws: JsonLdLotteryDrawInput[];
}): GeneratedSeoPayload {
  const pathMap: Record<RegionKey, string> = {
    MB: '/xsmb',
    MN: '/xsmn',
    MT: '/xsmt',
  };
  const canonicalPath = pathMap[region];
  const pageUrl = `${origin}${canonicalPath}`;
  const regionLabel = REGION_LABELS[region];
  const dateVN = formatDateVN(date);
  const dayVN = getDayNameVN(date);
  const regionDraws = draws.filter((d) => d.region === region);

  const highlightSummary = regionDraws
    .map((d) => {
      const db = d.prizes?.db?.[0];
      return db ? `${d.provinceName} (${db})` : d.provinceName;
    })
    .join(', ');

  const title =
    region === 'MB' && regionDraws[0]
      ? `XSMB ${dateVN} – Kết Quả Xổ Số Miền Bắc (${regionDraws[0].provinceName}) ${dayVN} | xosothantai1.com`
      : `XS${region} ${dateVN} – Kết Quả Xổ Số ${regionLabel} ${dayVN} | xosothantai1.com`;

  const description =
    regionDraws.length > 0
      ? `Kết quả Xổ số ${regionLabel} (${dayVN}, ${dateVN}): Giải Đặc Biệt ${highlightSummary}. Bảng số trúng thưởng đầy đủ từ Giải Đặc Biệt đến Giải ${
          region === 'MB' ? 'Bảy' : 'Tám'
        } và Lô tô 2 số.`
      : `Tra cứu kết quả Xổ số ${regionLabel} ngày ${dateVN} (${dayVN}) trực tiếp, đầy đủ tất cả các giải và Lô tô 2 số trên xosothantai1.com.`;

  const mainDatasetId = `${pageUrl}#dataset-${date}`;
  const graph: Record<string, unknown>[] = [
    buildOrganizationNode(origin),
    buildWebSiteNode(origin),
    buildBreadcrumbNode(origin, pageUrl, [
      { name: 'Trang chủ', path: '/' },
      { name: `Xổ số ${regionLabel}`, path: canonicalPath },
    ]),
    {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: title,
      description,
      inLanguage: 'vi-VN',
      datePublished: `${date}T${REGION_DRAW_TIMES[region]}`,
      dateModified: `${date}T${REGION_DRAW_TIMES[region]}`,
      isPartOf: { '@id': `${origin}/#website` },
      breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
      mainEntity: { '@id': mainDatasetId },
    },
  ];

  if (region === 'MB' && regionDraws[0]) {
    const draw = regionDraws[0];
    const eventId = `${pageUrl}#event-${date}`;
    const prizeListId = `${pageUrl}#prizes-${date}`;

    graph.push(buildDrawEventNode(draw, eventId));
    graph.push({
      '@type': 'Dataset',
      '@id': mainDatasetId,
      name: `Kết quả XSMB ${draw.provinceName} (${draw.provinceCode}) ngày ${dateVN}`,
      description,
      url: pageUrl,
      inLanguage: 'vi-VN',
      temporalCoverage: date,
      keywords: [
        'XSMB',
        `XSMB ${dateVN}`,
        `Xổ số Miền Bắc ${dateVN}`,
        `Xổ số ${draw.provinceName}`,
        ...(draw.prizes?.db?.[0] ? [`Giải đặc biệt ${draw.prizes.db[0]}`] : []),
      ],
      creator: { '@id': `${origin}/#organization` },
      about: { '@id': eventId },
      variableMeasured: buildPrizeMeasuredValues(draw),
    });
    graph.push(buildDrawPrizeItemList(draw, prizeListId));
  } else {
    graph.push({
      '@type': 'Dataset',
      '@id': mainDatasetId,
      name: `Kết quả Xổ số ${regionLabel} ngày ${dateVN}`,
      description,
      url: pageUrl,
      inLanguage: 'vi-VN',
      temporalCoverage: date,
      keywords: [
        `XS${region}`,
        `Xổ số ${regionLabel}`,
        `KQXS ${regionLabel} ${dateVN}`,
        ...regionDraws.map((d) => d.provinceName),
      ],
      creator: { '@id': `${origin}/#organization` },
      hasPart: regionDraws.map((d) => ({
        '@type': 'Dataset',
        '@id': `${pageUrl}#draw-${d.provinceCode}-${date}`,
        name: `Xổ số ${d.provinceName} (${d.provinceCode}) ngày ${dateVN}`,
        temporalCoverage: date,
        variableMeasured: buildPrizeMeasuredValues(d),
      })),
    });

    if (regionDraws.length > 0) {
      graph.push({
        '@type': 'ItemList',
        '@id': `${pageUrl}#draws-${date}`,
        name: `Danh sách các đài Xổ số ${regionLabel} mở thưởng ngày ${dateVN}`,
        numberOfItems: regionDraws.length,
        itemListElement: regionDraws.map((d, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: `${d.provinceName} (${d.provinceCode})`,
          item: buildDrawPrizeItemList(d, `${pageUrl}#prizes-${d.provinceCode}-${date}`),
        })),
      });
    }
  }

  return {
    title,
    description,
    canonicalPath,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': graph,
    },
  };
}

export function generateVietlottPageJsonLd({
  origin,
  date,
  mega,
  power,
  max3d,
}: {
  origin: string;
  date: string;
  mega: VietlottMegaResult | null;
  power: VietlottPowerResult | null;
  max3d: VietlottMax3DResult | null;
}): GeneratedSeoPayload {
  const canonicalPath = '/vietlott';
  const pageUrl = `${origin}${canonicalPath}`;
  const dateVN = formatDateVN(date);
  const dayVN = getDayNameVN(date);

  const summaryParts: string[] = [];
  if (power) {
    summaryParts.push(
      `Power 6/55 kỳ ${power.period}: ${power.numbers
        .map((n) => String(n).padStart(2, '0'))
        .join('-')} + ${String(power.bonusNumber).padStart(2, '0')} (${power.jackpot1Value})`
    );
  }
  if (mega) {
    summaryParts.push(
      `Mega 6/45 kỳ ${mega.period}: ${mega.numbers
        .map((n) => String(n).padStart(2, '0'))
        .join('-')} (${mega.jackpotValue})`
    );
  }
  if (max3d) {
    summaryParts.push(`Max 3D kỳ ${max3d.period}: ĐB ${max3d.special.join(', ')}`);
  }

  const title = `Kết Quả Vietlott ${dateVN} – Power 6/55, Mega 6/45, Max 3D | xosothantai1.com`;
  const description =
    summaryParts.length > 0
      ? `Kết quả xổ số điện toán Vietlott (${dayVN}, ${dateVN}): ${summaryParts.join('; ')}.`
      : `Tra cứu kết quả xổ số điện toán Vietlott Power 6/55, Mega 6/45 và Max 3D ngày ${dateVN} chính xác trên xosothantai1.com.`;

  const gameDatasets: Record<string, unknown>[] = [];
  const listItems: Record<string, unknown>[] = [];

  if (power) {
    const balls = power.numbers.map((n) => String(n).padStart(2, '0')).join(', ');
    const bonus = String(power.bonusNumber).padStart(2, '0');
    const jp1Amount = parseJackpotVnd(power.jackpot1Value);
    const jp2Amount = parseJackpotVnd(power.jackpot2Value);

    gameDatasets.push({
      '@type': 'Dataset',
      '@id': `${pageUrl}#power-${power.period}`,
      name: `Vietlott Power 6/55 - Kỳ ${power.period} (${formatDateVN(power.date)})`,
      temporalCoverage: power.date,
      variableMeasured: [
        {
          '@type': 'PropertyValue',
          name: 'Bộ 6 số chính Power 6/55',
          propertyID: 'POWER_655_NUMBERS',
          value: balls,
        },
        {
          '@type': 'PropertyValue',
          name: 'Số đặc biệt Power 6/55',
          propertyID: 'POWER_655_BONUS',
          value: bonus,
        },
        {
          '@type': 'PropertyValue',
          name: 'Giá trị Jackpot 1',
          propertyID: 'POWER_655_JP1',
          value: jp1Amount ?? power.jackpot1Value,
          unitCode: 'VND',
        },
        {
          '@type': 'PropertyValue',
          name: 'Giá trị Jackpot 2',
          propertyID: 'POWER_655_JP2',
          value: jp2Amount ?? power.jackpot2Value,
          unitCode: 'VND',
        },
      ],
    });

    listItems.push({
      '@type': 'ListItem',
      position: listItems.length + 1,
      name: `Vietlott Power 6/55 - Kỳ ${power.period}`,
      item: {
        '@type': 'Thing',
        identifier: `POWER_655-${power.period}`,
        name: `${balls} + ${bonus}`,
        description: `Power 6/55 kỳ ${power.period} (${formatDateVN(power.date)}): ${balls} + ${bonus}. Jackpot 1: ${power.jackpot1Value}, Jackpot 2: ${power.jackpot2Value}`,
      },
    });
  }

  if (mega) {
    const balls = mega.numbers.map((n) => String(n).padStart(2, '0')).join(', ');
    const jpAmount = parseJackpotVnd(mega.jackpotValue);

    gameDatasets.push({
      '@type': 'Dataset',
      '@id': `${pageUrl}#mega-${mega.period}`,
      name: `Vietlott Mega 6/45 - Kỳ ${mega.period} (${formatDateVN(mega.date)})`,
      temporalCoverage: mega.date,
      variableMeasured: [
        {
          '@type': 'PropertyValue',
          name: 'Bộ 6 số trúng thưởng Mega 6/45',
          propertyID: 'MEGA_645_NUMBERS',
          value: balls,
        },
        {
          '@type': 'PropertyValue',
          name: 'Giá trị Jackpot Mega 6/45',
          propertyID: 'MEGA_645_JACKPOT',
          value: jpAmount ?? mega.jackpotValue,
          unitCode: 'VND',
        },
      ],
    });

    listItems.push({
      '@type': 'ListItem',
      position: listItems.length + 1,
      name: `Vietlott Mega 6/45 - Kỳ ${mega.period}`,
      item: {
        '@type': 'Thing',
        identifier: `MEGA_645-${mega.period}`,
        name: balls,
        description: `Mega 6/45 kỳ ${mega.period} (${formatDateVN(mega.date)}): ${balls}. Jackpot: ${mega.jackpotValue}`,
      },
    });
  }

  if (max3d) {
    gameDatasets.push({
      '@type': 'Dataset',
      '@id': `${pageUrl}#max3d-${max3d.period}`,
      name: `Vietlott Max 3D - Kỳ ${max3d.period} (${formatDateVN(max3d.date)})`,
      temporalCoverage: max3d.date,
      variableMeasured: [
        {
          '@type': 'PropertyValue',
          name: 'Giải Đặc Biệt Max 3D',
          propertyID: 'MAX_3D_SPECIAL',
          value: max3d.special.join(', '),
        },
        {
          '@type': 'PropertyValue',
          name: 'Giải Nhất Max 3D',
          propertyID: 'MAX_3D_FIRST',
          value: max3d.first.join(', '),
        },
        {
          '@type': 'PropertyValue',
          name: 'Giải Nhì Max 3D',
          propertyID: 'MAX_3D_SECOND',
          value: max3d.second.join(', '),
        },
        {
          '@type': 'PropertyValue',
          name: 'Giải Ba Max 3D',
          propertyID: 'MAX_3D_THIRD',
          value: max3d.third.join(', '),
        },
      ],
    });

    listItems.push({
      '@type': 'ListItem',
      position: listItems.length + 1,
      name: `Vietlott Max 3D - Kỳ ${max3d.period}`,
      item: {
        '@type': 'Thing',
        identifier: `MAX_3D-${max3d.period}`,
        name: max3d.special.join(', '),
        description: `Max 3D kỳ ${max3d.period} (${formatDateVN(max3d.date)}) - ĐB: ${max3d.special.join(', ')}; Nhất: ${max3d.first.join(', ')}`,
      },
    });
  }

  const mainDatasetId = `${pageUrl}#dataset-${date}`;
  const graph: Record<string, unknown>[] = [
    buildOrganizationNode(origin),
    buildWebSiteNode(origin),
    buildBreadcrumbNode(origin, pageUrl, [
      { name: 'Trang chủ', path: '/' },
      { name: 'Kết quả Vietlott', path: canonicalPath },
    ]),
    {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: title,
      description,
      inLanguage: 'vi-VN',
      datePublished: `${date}T18:00:00+07:00`,
      dateModified: `${date}T18:00:00+07:00`,
      isPartOf: { '@id': `${origin}/#website` },
      breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
      mainEntity: { '@id': mainDatasetId },
    },
    {
      '@type': 'Dataset',
      '@id': mainDatasetId,
      name: `Kết quả Vietlott ngày ${dateVN}`,
      description,
      url: pageUrl,
      inLanguage: 'vi-VN',
      temporalCoverage: date,
      keywords: ['Vietlott', 'Power 6/55', 'Mega 6/45', 'Max 3D', `Vietlott ${dateVN}`],
      creator: { '@id': `${origin}/#organization` },
      hasPart: gameDatasets,
    },
  ];

  if (listItems.length > 0) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${pageUrl}#vietlott-list-${date}`,
      name: `Bảng kết quả Vietlott ngày ${dateVN}`,
      numberOfItems: listItems.length,
      itemListElement: listItems,
    });
  }

  return {
    title,
    description,
    canonicalPath,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': graph,
    },
  };
}

export function generateHomePageJsonLd({
  origin,
  date,
  draws,
  customTitle,
  customDescription,
}: {
  origin: string;
  date: string;
  draws: JsonLdLotteryDrawInput[];
  customTitle?: string;
  customDescription?: string;
}): GeneratedSeoPayload {
  const canonicalPath = '/';
  const pageUrl = `${origin}/`;
  const dateVN = formatDateVN(date);
  const dayVN = getDayNameVN(date);

  const title =
    customTitle ||
    `xosothantai1.com – Kết Quả Xổ Số 3 Miền Bắc Trung Nam ${dateVN} & Vietlott`;
  const description =
    customDescription ||
    `Tra cứu trực tiếp kết quả xổ số 3 miền (${dayVN}, ${dateVN}): XSMB, XSMN, XSMT, Vietlott và thống kê Lô Gan 10 năm trên xosothantai1.com.`;

  const mainDatasetId = `${origin}/#dataset-${date}`;

  const graph: Record<string, unknown>[] = [
    buildOrganizationNode(origin),
    buildWebSiteNode(origin),
    {
      '@type': 'WebPage',
      '@id': `${origin}/#webpage`,
      url: pageUrl,
      name: title,
      description,
      inLanguage: 'vi-VN',
      datePublished: `${date}T18:15:00+07:00`,
      dateModified: `${date}T18:15:00+07:00`,
      isPartOf: { '@id': `${origin}/#website` },
      mainEntity: { '@id': mainDatasetId },
    },
    {
      '@type': 'Dataset',
      '@id': mainDatasetId,
      name: `Kết quả Xổ số Kiến thiết 3 Miền ngày ${dateVN}`,
      description,
      url: pageUrl,
      inLanguage: 'vi-VN',
      temporalCoverage: date,
      creator: { '@id': `${origin}/#organization` },
      hasPart: draws.map((d) => ({
        '@type': 'Dataset',
        name: `Xổ số ${d.provinceName} (${d.provinceCode}) - ${REGION_LABELS[d.region]} ngày ${dateVN}`,
        temporalCoverage: date,
        variableMeasured: buildPrizeMeasuredValues(d),
      })),
    },
  ];

  return {
    title,
    description,
    canonicalPath,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': graph,
    },
  };
}

export function generateUtilityPageJsonLd({
  origin,
  path,
  title,
  description,
  breadcrumbName,
}: {
  origin: string;
  path: string;
  title: string;
  description: string;
  breadcrumbName: string;
}): GeneratedSeoPayload {
  const pageUrl = `${origin}${path}`;
  return {
    title,
    description,
    canonicalPath: path,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        buildOrganizationNode(origin),
        buildWebSiteNode(origin),
        buildBreadcrumbNode(origin, pageUrl, [
          { name: 'Trang chủ', path: '/' },
          { name: breadcrumbName, path },
        ]),
        {
          '@type': 'WebPage',
          '@id': `${pageUrl}#webpage`,
          url: pageUrl,
          name: title,
          description,
          inLanguage: 'vi-VN',
          isPartOf: { '@id': `${origin}/#website` },
          breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
        },
      ],
    },
  };
}
