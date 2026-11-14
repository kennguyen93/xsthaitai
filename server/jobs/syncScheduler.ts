import { getVNTimeNow, REGION_DRAW_WINDOWS } from '../services/lotteryDataHelper.ts';
import {
  ensureTodaySyncSessions,
  markExpiredSessionsTimeout,
  synchronizeRegionResults,
  type SyncMode,
  type SyncRegionResult,
} from '../services/lotterySyncService.ts';

let schedulerStarted = false;
let tickInProgress = false;

export interface SchedulerTickSummary {
  vnTime: string;
  dateStr: string;
  executedRegions: {
    region: 'MN' | 'MT' | 'MB';
    result: SyncRegionResult;
  }[];
  skippedReasons: {
    region: 'MN' | 'MT' | 'MB';
    reason: string;
  }[];
}

export async function runScheduledSyncTick(
  syncMode: SyncMode = 'AUTO_SCHEDULER',
  options?: { region?: 'MB' | 'MN' | 'MT'; date?: string; force?: boolean }
): Promise<SchedulerTickSummary> {
  const vnNow = getVNTimeNow();
  const targetDate = options?.date || vnNow.dateStr;
  const sessions = await ensureTodaySyncSessions(targetDate);

  // Auto-stop expired windows for today
  if (targetDate === vnNow.dateStr) {
    await markExpiredSessionsTimeout(targetDate, vnNow.totalMinutes);
  }

  const executedRegions: SchedulerTickSummary['executedRegions'] = [];
  const skippedReasons: SchedulerTickSummary['skippedReasons'] = [];

  for (const win of REGION_DRAW_WINDOWS) {
    if (options?.region && options.region !== win.region) {
      continue;
    }

    const session = sessions.find((s) => s.region === win.region);

    if (!options?.force) {
      if (session?.status === 'COMPLETED') {
        skippedReasons.push({
          region: win.region,
          reason: `Đã hoàn tất xác minh (${session.provincesCompleted}/${session.provincesExpected} đài).`,
        });
        continue;
      }

      if (targetDate === vnNow.dateStr) {
        if (vnNow.totalMinutes < win.preStartMin) {
          skippedReasons.push({
            region: win.region,
            reason: `Chưa tới khung giờ đồng bộ (bắt đầu ${win.scheduledStart} Asia/Ho_Chi_Minh).`,
          });
          continue;
        }
        if (vnNow.totalMinutes > win.endMin) {
          skippedReasons.push({
            region: win.region,
            reason: `Đã hết khung giờ quay (${win.scheduledEnd} Asia/Ho_Chi_Minh), tự động dừng.`,
          });
          continue;
        }
      }
    }

    const result = await synchronizeRegionResults(win.region, targetDate, {
      syncMode,
      force: Boolean(options?.force),
    });
    executedRegions.push({ region: win.region, result });
  }

  return {
    vnTime: vnNow.formattedTime,
    dateStr: targetDate,
    executedRegions,
    skippedReasons,
  };
}

export function startSyncScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  if (process.env.AUTO_SYNC_ENABLED === 'false') {
    console.log(
      'AUTO_SYNC_ENABLED=false: Skipping background 30s interval (use POST /api/cron/sync via Cloud Scheduler).'
    );
    return;
  }

  // Poll every 30 seconds in Asia/Ho_Chi_Minh timezone
  const timer = setInterval(async () => {
    if (tickInProgress) return;
    tickInProgress = true;
    try {
      const summary = await runScheduledSyncTick('AUTO_SCHEDULER');
      if (summary.executedRegions.length > 0) {
        for (const item of summary.executedRegions) {
          console.log(
            `[AutoSync ${summary.vnTime} ICT] ${item.region} (${summary.dateStr}): ${item.result.status} — ${item.result.message}`
          );
        }
      }
    } catch (error) {
      console.error('Scheduled 30s sync tick failed:', error);
    } finally {
      tickInProgress = false;
    }
  }, 30_000);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}
