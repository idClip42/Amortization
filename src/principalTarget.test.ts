import assert from "node:assert/strict";
import test from "node:test";
import { findPrincipalTarget, formatMonthsRemaining } from "./principalTarget.js";

test("uses the first date at or below the target, including a jump past it", () => {
    const records = [
        { day: new Date(2027, 0, 1), remainingPrincipal: 20100 },
        { day: new Date(2027, 0, 10), remainingPrincipal: 16000 },
        { day: new Date(2027, 1, 10), remainingPrincipal: 12000 },
    ];
    assert.deepEqual(findPrincipalTarget(records, 20000), {
        date: records[1].day,
        remainingPrincipal: 16000,
    });
    assert.equal(findPrincipalTarget(records, 20100)?.date, records[0].day);
    assert.equal(findPrincipalTarget(records, 10000), undefined);
    assert.equal(findPrincipalTarget([], 20000), undefined);
});

test("rounds elapsed time to whole months across a year boundary", () => {
    const asOf = new Date(2026, 10, 5);
    assert.equal(formatMonthsRemaining(new Date(2027, 6, 5), asOf), "8 months remaining");
    assert.equal(formatMonthsRemaining(new Date(2026, 11, 5), asOf), "1 month remaining");
    assert.equal(formatMonthsRemaining(new Date(2026, 11, 25), asOf), "2 months remaining");
    assert.equal(formatMonthsRemaining(new Date(2026, 10, 15), asOf), "0 months remaining");
});

test("marks reached targets instead of showing negative months", () => {
    const asOf = new Date(2026, 10, 5);
    assert.equal(formatMonthsRemaining(asOf, asOf), "Target reached");
    assert.equal(formatMonthsRemaining(new Date(2026, 9, 5), asOf), "Target reached");
});
