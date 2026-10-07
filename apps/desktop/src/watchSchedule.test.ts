import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	formatWeeklyScheduleLabel,
	isWeeklyRunDue,
	isoWeekKey,
	normalizeWeeklySchedule,
} from "./watchSchedule.ts";

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

	it("formats marketer-facing schedule copy", () => {
		const label = formatWeeklyScheduleLabel(
			normalizeWeeklySchedule({ enabled: true, weekday: 1, hour: 9 }),
		);
		assert.match(label, /Monday/);
		assert.match(label, /Watch is open/);
	});
});
