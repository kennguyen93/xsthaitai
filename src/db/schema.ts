import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').default(''),
  role: text('role').notNull().default('user'), // 'admin' | 'user'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const lotteryProvinces = pgTable('lottery_provinces', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  region: text('region').notNull(), // 'MB' | 'MN' | 'MT'
  drawDays: jsonb('draw_days').$type<number[]>().notNull(),
  drawTime: text('draw_time').notNull(),
});

export const lotteryResults = pgTable(
  'lottery_results',
  {
    id: serial('id').primaryKey(),
    drawDate: text('draw_date').notNull(), // YYYY-MM-DD
    region: text('region').notNull(), // 'MB' | 'MN' | 'MT'
    provinceCode: text('province_code').notNull(),
    provinceName: text('province_name').notNull(),
    kyHieu: jsonb('ky_hieu').$type<string[]>().default([]).notNull(),
    prizes: jsonb('prizes').$type<Record<string, string[]>>().notNull(),
    allTails: jsonb('all_tails').$type<string[]>().notNull(),
    specialTail: text('special_tail').notNull(),
    source: text('source').notNull().default('XosoVNM.net'),
    isVerified: boolean('is_verified').default(true).notNull(),
    syncStatus: text('sync_status').default('COMPLETED').notNull(), // 'PARTIAL' | 'VERIFYING' | 'COMPLETED'
    prizesFound: integer('prizes_found').default(0).notNull(),
    prizesExpected: integer('prizes_expected').default(0).notNull(),
    payloadHash: text('payload_hash').default('').notNull(),
    version: integer('version').default(1).notNull(),
    verifiedAt: timestamp('verified_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('lottery_results_date_province_idx').on(
      table.drawDate,
      table.provinceCode
    ),
  ]
);

export const vietlottResults = pgTable(
  'vietlott_results',
  {
    id: serial('id').primaryKey(),
    gameType: text('game_type').notNull(), // 'MEGA_645' | 'POWER_655' | 'MAX_3D'
    period: text('period').notNull(),
    drawDate: text('draw_date').notNull(),
    numbers: jsonb('numbers').$type<number[]>().default([]).notNull(),
    bonusNumber: integer('bonus_number'),
    jackpot1Value: text('jackpot1_value').default(''),
    jackpot2Value: text('jackpot2_value').default(''),
    prizeBreakdown: jsonb('prize_breakdown').$type<Record<string, unknown>>().default({}).notNull(),
    source: text('source').notNull().default('XosoVNM.net'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('vietlott_game_date_idx').on(table.gameType, table.drawDate),
  ]
);

export const apiProviders = pgTable('api_providers', {
  id: serial('id').primaryKey(),
  providerKey: text('provider_key').notNull().unique(), // 'xosovnm' or custom provider key
  name: text('name').notNull(),
  adapterType: text('adapter_type').notNull().default('xosovnm'), // 'xosovnm' | 'generic-json'
  baseUrl: text('base_url').notNull(),
  priority: integer('priority').notNull().default(1),
  isEnabled: boolean('is_enabled').notNull().default(true),
  envSecretName: text('env_secret_name').notNull(),
  authHeader: text('auth_header').notNull().default('none'), // 'none' | 'x-api-key' | 'authorization-bearer' | 'query-param'
  customEndpointPath: text('custom_endpoint_path').default('/lottery/region'),
  rateLimitPerMin: integer('rate_limit_per_min').notNull().default(30),
  timeoutMs: integer('timeout_ms').notNull().default(8000),
  maxRetries: integer('max_retries').notNull().default(3),
  lastSyncAt: timestamp('last_sync_at'),
  lastStatus: text('last_status').default('READY'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const syncSessions = pgTable(
  'sync_sessions',
  {
    id: serial('id').primaryKey(),
    drawDate: text('draw_date').notNull(), // YYYY-MM-DD (Asia/Ho_Chi_Minh)
    region: text('region').notNull(), // 'MB' | 'MN' | 'MT'
    status: text('status').notNull().default('PENDING'), // 'PENDING' | 'RUNNING' | 'COMPLETED' | 'TIMEOUT_STOPPED' | 'ERROR'
    scheduledStart: text('scheduled_start').notNull(), // HH:mm
    drawStart: text('draw_start').notNull(), // HH:mm
    scheduledEnd: text('scheduled_end').notNull(), // HH:mm
    provincesExpected: integer('provinces_expected').notNull().default(0),
    provincesCompleted: integer('provinces_completed').notNull().default(0),
    pollCount: integer('poll_count').notNull().default(0),
    apiRequestsCount: integer('api_requests_count').notNull().default(0),
    lastPollAt: timestamp('last_poll_at'),
    completedAt: timestamp('completed_at'),
    lockedBy: text('locked_by').default('').notNull(),
    lockedUntil: timestamp('locked_until'),
    lastError: text('last_error').default('').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sync_sessions_date_region_idx').on(table.drawDate, table.region),
  ]
);

export const syncLogs = pgTable('sync_logs', {
  id: serial('id').primaryKey(),
  providerKey: text('provider_key').notNull(),
  region: text('region').notNull(),
  targetDate: text('target_date').notNull(),
  syncMode: text('sync_mode').notNull().default('AUTO_SCHEDULER'), // 'AUTO_SCHEDULER' | 'CLOUD_SCHEDULER' | 'MANUAL' | 'ON_DEMAND'
  endpointUrl: text('endpoint_url').default('').notNull(),
  httpStatus: integer('http_status'),
  status: text('status').notNull(), // 'SUCCESS' | 'PARTIAL_UPDATED' | 'VERIFIED_COMPLETED' | 'NO_DATA_YET' | 'FAILED' | 'RETRY' | 'SKIPPED_DUPLICATE' | 'RATE_LIMITED'
  recordsSynced: integer('records_synced').notNull().default(0),
  prizesFound: integer('prizes_found').notNull().default(0),
  prizesExpected: integer('prizes_expected').notNull().default(0),
  attempts: integer('attempts').notNull().default(1),
  durationMs: integer('duration_ms').notNull().default(0),
  errorMessage: text('error_message').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const seoMetadata = pgTable('seo_metadata', {
  id: serial('id').primaryKey(),
  routePath: text('route_path').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  keywords: text('keywords').default('').notNull(),
  ogTitle: text('og_title').notNull(),
  ogDescription: text('og_description').notNull(),
  canonicalUrl: text('canonical_url').default('').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const advertisements = pgTable('advertisements', {
  id: serial('id').primaryKey(),
  slotKey: text('slot_key').notNull(), // 'header_banner' | 'sidebar_top' | 'between_regions'
  title: text('title').notNull(),
  imageUrl: text('image_url').default('').notNull(),
  targetUrl: text('target_url').notNull(),
  altText: text('alt_text').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  impressions: integer('impressions').notNull().default(0),
  clicks: integer('clicks').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const systemBackups = pgTable('system_backups', {
  id: serial('id').primaryKey(),
  createdByUid: text('created_by_uid').notNull(),
  recordCount: integer('record_count').notNull(),
  dateRangeFrom: text('date_range_from').notNull(),
  dateRangeTo: text('date_range_to').notNull(),
  snapshotSummary: jsonb('snapshot_summary').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
