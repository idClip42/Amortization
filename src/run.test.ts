import assert from "node:assert/strict";
import test from "node:test";
import { run } from "./run.js";

test("applies varying projected lump sums and caps the final payment at zero", () => {
    const records = run(
        new Date(2026, 0, 2),
        1000,
        0,
        () => 100,
        1,
        [],
        date => {
            if (date.getDate() !== 10) return 0;
            return date.getMonth() === 0 ? 300 : 700;
        }
    );

    const last = records[records.length - 1];
    assert.equal(last.day.toLocaleDateString(), new Date(2026, 1, 10).toLocaleDateString());
    assert.equal(last.remainingPrincipal, 0);
    assert.equal(last.paidPrincipal, 1000);
    assert.equal(last.paidPrincipalToday, 600);
    assert.equal(last.tag, "projectedLumpSum");
});
