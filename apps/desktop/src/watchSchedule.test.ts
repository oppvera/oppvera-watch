import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	companyScheduleKey,
	dueRunSchedules,
	formatRunScheduleLine,
	formatWeeklyScheduleLabel,
	isWeeklyRunDue,
	isoWeekKey,
	normalizeRunSchedule,
	normalizeWeeklySchedule,
	SCHEDULE_POLL_INTERVAL_MS,
	SCHEDULE_PRIVACY_NOTE,
} from "./watchSchedule.js";

describe("watchSchedule", () => {
	it("normalizes weekday and hour bounds", () => {
		const schedule = normalizeWeeklySchedule({
			enabled: true,
			weekday: 99,
			hour: -1,
		});
		assert.equal(schedule.weekday, 1);
		assert.equal(schedule.hour, 9);
	});

	it("fires once per ISO week after the configured hour", () => {
		const schedule = normalizeWeeklySchedule({
			enabled: true,
			weekday: 2,
			hour: 9,
			lastAutoRunWeek: null,
		});
		const tuesday10 = new Date(2026, 9, 6, 10, 0, 0);
		assert.equal(tuesday10.getDay(), 2);
		assert.equal(isWeeklyRunDue(schedule, tuesday10), true);
		const sameWeek = { ...schedule, lastAutoRunWeek: isoWeekKey(tuesday10) };
		assert.equal(isWeeklyRunDue(sameWeek, tuesday10), false);
	});

	it("documents poll interval and privacy copy", () => {
		assert.equal(SCHEDULE_POLL_INTERVAL_MS, 5 * 60 * 1000);
		assert.match(SCHEDULE_PRIVACY_NOTE, /5 minutes/);
		assert.match(SCHEDULE_PRIVACY_NOTE, /network/i);
	});

	it("formats marketer-facing schedule copy", () => {
		const label = formatWeeklyScheduleLabel(
			normalizeWeeklySchedule({ enabled: true, weekday: 1, hour: 9 }),
		);
		assert.match(label, /Monday/);
		assert.match(label, /Watch is open/);
	});

	it("keys a company by id, otherwise by name", () => {
		assert.equal(companyScheduleKey({ company_id: "co-1", company_name: "Acme" }), "co-1");
		assert.equal(companyScheduleKey({ company_id: null, company_name: "Acme" }), "name:Acme");
		assert.equal(companyScheduleKey({ company_id: "  ", company_name: "" }), "none");
	});

	it("allows Tuesday and Thursday schedules in the same ISO week", () => {
		const tuesday = new Date(2026, 9, 6, 10, 0, 0);
		const thursday = new Date(2026, 9, 8, 10, 0, 0);
		assert.equal(tuesday.getDay(), 2);
		assert.equal(thursday.getDay(), 4);
		const tuesdaySchedule = normalizeRunSchedule({
			id: "company:a",
			kind: "company",
			enabled: true,
			weekday: 2,
			hour: 9,
			companyIds: ["a"],
			lastAutoRunWeek: null,
		});
		const thursdaySchedule = normalizeRunSchedule({
			id: "custom:b",
			kind: "custom",
			enabled: true,
			weekday: 4,
			hour: 9,
			companyIds: ["b", "c"],
			lastAutoRunWeek: null,
		});
		assert.ok(tuesdaySchedule);
		assert.ok(thursdaySchedule);
		const schedules = [tuesdaySchedule, thursdaySchedule];
		assert.deepEqual(
			dueRunSchedules(schedules, tuesday).map((schedule) => schedule.id),
			["company:a"],
		);
		const marked = schedules.map((schedule) =>
			schedule.id === "company:a"
				? { ...schedule, lastAutoRunWeek: isoWeekKey(tuesday) }
				: schedule,
		);
		assert.deepEqual(
			dueRunSchedules(marked, tuesday).map((schedule) => schedule.id),
			[],
		);
		assert.deepEqual(
			dueRunSchedules(marked, thursday).map((schedule) => schedule.id),
			["custom:b"],
		);
		assert.equal(
			formatRunScheduleLine(thursdaySchedule, ["Posit", "Acme"]),
			"Posit, Acme — Thursdays about 9:00 AM",
		);
	});
});
