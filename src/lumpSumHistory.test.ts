import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthlyLumpSumHistory } from "./lumpSumHistory.js";

test("groups payments by month and includes empty months in the running average", () => {
    const history = buildMonthlyLumpSumHistory(
        [
            { date: new Date(2026, 0, 10), dollars: 150 },
            { date: new Date(2025, 10, 20), dollars: 50 },
            { date: new Date(2025, 10, 10), dollars: 100 },
            { date: new Date(2025, 9, 31), dollars: 1000 },
        ],
        new Date(2025, 10, 1)
    );

    assert.deepEqual(
        history.map(({ month, monthlyTotal, runningAverage }) => ({
            month: `${month.getFullYear()}-${month.getMonth() + 1}`,
            monthlyTotal,
            runningAverage,
        })),
        [
            { month: "2025-11", monthlyTotal: 150, runningAverage: 150 },
            { month: "2025-12", monthlyTotal: 0, runningAverage: 75 },
            { month: "2026-1", monthlyTotal: 150, runningAverage: 100 },
        ]
    );
});

test("returns no monthly history when there are no eligible payments", () => {
    assert.deepEqual(
        buildMonthlyLumpSumHistory(
            [{ date: new Date(2025, 9, 31), dollars: 100 }],
            new Date(2025, 10, 1)
        ),
        []
    );
});
