import type { Provider } from "@oneglanse/types";

export type WeeklySchedulePrefs = {
	enabled: boolean;
	/** 0 = Sunday … 6 = Saturday */
	weekday: number;
	/** Local hour 0–23 */
	hour: number;
	/** ISO week key when an automatic run last started, e.g. `2026-W40` */
	lastAutoRunWeek: string | null;
};

export type WatchSchedulePrefs = {
	weekly: WeeklySchedulePrefs;
	/** Providers used for the last manual or scheduled run */
	lastRunProviders: Provider[];
};

/** How often the main process checks local date/time when a schedule is enabled. */
export const SCHEDULE_POLL_INTERVAL_MS = 5 * 60 * 1000;

export const SCHEDULE_PRIVACY_NOTE =
	"While a schedule is on, Watch only reads the clock on this computer every 5 minutes. " +
	"Those checks do not use the network. Oppvera receives data only when you capture answers and sync.";

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedulePrefs = {
	enabled: false,
	weekday: 1,
	hour: 9,
	lastAutoRunWeek: null,
};

export function normalizeWeeklySchedule(
	raw: Partial<WeeklySchedulePrefs> | undefined,
): WeeklySchedulePrefs {
	const base = DEFAULT_WEEKLY_SCHEDULE;
	if (!raw) return { ...base };
	const weekday = Number(raw.weekday);
	const hour = Number(raw.hour);
	return {
		enabled: Boolean(raw.enabled),
		weekday:
			Number.isFinite(weekday) && weekday >= 0 && weekday <= 6
				? Math.floor(weekday)
				: base.weekday,
		hour:
			Number.isFinite(hour) && hour >= 0 && hour <= 23
				? Math.floor(hour)
				: base.hour,
		lastAutoRunWeek:
			typeof raw.lastAutoRunWeek === "string" && raw.lastAutoRunWeek.trim()
				? raw.lastAutoRunWeek.trim()
				: null,
	};
}

export function isoWeekKey(date: Date): string {
	const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const day = utc.getUTCDay() || 7;
	utc.setUTCDate(utc.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const WEEKDAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

export function formatWeeklyScheduleLabel(schedule: WeeklySchedulePrefs): string {
	if (!schedule.enabled) {
		return "Weekly check off — turn it on in Settings to run while Watch is open.";
	}
	const day = WEEKDAY_NAMES[schedule.weekday] ?? "Monday";
	const hour = schedule.hour % 12 || 12;
	const meridiem = schedule.hour < 12 ? "AM" : "PM";
	return `Weekly check: ${day}s about ${hour}:00 ${meridiem} (local), while Oppvera Watch is open. Hosted email reports do not start a capture.`;
}

export function isWeeklyRunDue(
	schedule: WeeklySchedulePrefs,
	now = new Date(),
): boolean {
	if (!schedule.enabled) return false;
	const weekKey = isoWeekKey(now);
	if (schedule.lastAutoRunWeek === weekKey) return false;
	const dayMatch = now.getDay() === schedule.weekday;
	if (!dayMatch) return false;
	return now.getHours() >= schedule.hour;
}

export type ScheduleKind = "company" | "custom";

export type RunSchedule = {
	id: string;
	kind: ScheduleKind;
	enabled: boolean;
	weekday: number;
	hour: number;
	companyIds: string[];
	/**
	 * Campaigns included in a company schedule.
	 * Null means every paired campaign under companyIds (schedules saved before selection).
	 */
	campaignIds: string[] | null;
	lastAutoRunWeek: string | null;
};

/** Stable id for schedules. Paired campaigns with no company id use the company name. */
export function companyScheduleKey(company: {
	company_id?: string | null;
	company_name?: string | null;
}): string {
	const id = company.company_id?.trim();
	if (id) return id;
	const name = company.company_name?.trim();
	return name ? `name:${name}` : "none";
}

export function normalizeRunSchedule(
	raw: Partial<RunSchedule> | null | undefined,
): RunSchedule | null {
	if (!raw || typeof raw.id !== "string" || !raw.id.trim()) return null;
	const companyIds = Array.isArray(raw.companyIds)
		? [
				...new Set(
					raw.companyIds
						.map((id) => (typeof id === "string" ? id.trim() : ""))
						.filter(Boolean),
				),
			]
		: [];
	if (companyIds.length === 0) return null;
	const weekly = normalizeWeeklySchedule(raw);
	const kind: ScheduleKind = raw.kind === "custom" ? "custom" : "company";
	const campaignIds =
		kind === "company" && Array.isArray(raw.campaignIds)
			? [
					...new Set(
						raw.campaignIds
							.map((id) => (typeof id === "string" ? id.trim() : ""))
							.filter(Boolean),
					),
				]
			: null;
	return {
		id: raw.id.trim(),
		kind,
		enabled: weekly.enabled,
		weekday: weekly.weekday,
		hour: weekly.hour,
		companyIds: kind === "company" ? [companyIds[0]!] : companyIds,
		campaignIds,
		lastAutoRunWeek: weekly.lastAutoRunWeek,
	};
}

export function normalizeRunSchedules(raw: unknown): RunSchedule[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const schedules: RunSchedule[] = [];
	for (const row of raw) {
		const schedule = normalizeRunSchedule(row as Partial<RunSchedule>);
		if (!schedule || seen.has(schedule.id)) continue;
		seen.add(schedule.id);
		schedules.push(schedule);
	}
	return schedules;
}

export function campaignIdsForRunSchedules(
	due: RunSchedule[],
	devices: Array<{
		campaign_id: string;
		company_id?: string | null;
		company_name?: string | null;
	}>,
	allSchedules: RunSchedule[] = due,
): string[] {
	const pairedByCompany = new Map<string, string[]>();
	for (const device of devices) {
		const key = companyScheduleKey(device);
		const list = pairedByCompany.get(key) ?? [];
		list.push(device.campaign_id);
		pairedByCompany.set(key, list);
	}
	const selectedByCompany = new Map<string, string[] | null>();
	for (const schedule of allSchedules) {
		if (schedule.kind !== "company") continue;
		const companyId = schedule.companyIds[0];
		if (companyId) selectedByCompany.set(companyId, schedule.campaignIds);
	}
	const ids: string[] = [];
	const seen = new Set<string>();
	const addCompany = (companyId: string, limit: string[] | null | undefined) => {
		const paired = pairedByCompany.get(companyId) ?? [];
		const allowed =
			limit == null ? paired : paired.filter((id) => limit.includes(id));
		for (const id of allowed) {
			if (seen.has(id)) continue;
			seen.add(id);
			ids.push(id);
		}
	};
	for (const schedule of due) {
		if (schedule.kind === "company") {
			addCompany(schedule.companyIds[0] ?? "", schedule.campaignIds);
			continue;
		}
		for (const companyId of schedule.companyIds) {
			addCompany(
				companyId,
				selectedByCompany.has(companyId)
					? selectedByCompany.get(companyId)
					: null,
			);
		}
	}
	return ids;
}

export function isRunScheduleDue(schedule: RunSchedule, now = new Date()): boolean {
	return isWeeklyRunDue(schedule, now);
}

export function dueRunSchedules(
	schedules: RunSchedule[],
	now = new Date(),
): RunSchedule[] {
	return schedules.filter((schedule) => isRunScheduleDue(schedule, now));
}

export function formatRunScheduleLine(
	schedule: RunSchedule,
	companyNames: string[],
): string {
	const names = companyNames.map((name) => name.trim()).filter(Boolean);
	const label = names.length > 0 ? names.join(", ") : "Company";
	const day = WEEKDAY_NAMES[schedule.weekday] ?? "Monday";
	const hour = schedule.hour % 12 || 12;
	const meridiem = schedule.hour < 12 ? "AM" : "PM";
	return `${label} — ${day}s about ${hour}:00 ${meridiem}`;
}
