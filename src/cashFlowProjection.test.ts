import assert from "node:assert/strict";
import test from "node:test";
import {
    buildCashFlowProjection,
    type CashFlowProjectionInput,
} from "./cashFlowProjection.js";

const utilityYear = (amount: number) =>
    Array.from({ length: 12 }, (_, month) => ({
        month: `2025-${String(month + 1).padStart(2, "0")}`,
        amount,
    }));

test("carries a shortfall forward and includes three-paycheck cycles", () => {
    const input: CashFlowProjectionInput = {
        startAfter: new Date(2026, 2, 9),
        paymentDay: 10,
        months: 2,
        creditCardAverageStartMonth: "2026-01",
        loanPaymentDay: 1,
        loanPaymentChanges: [
            { startDate: "2025-01-01", monthlyPayment: 800, monthlyEscrow: 0 },
        ],
        income: [{ date: "2026-02-27", amount: 1000 }],
        monthlyCreditCardPayments: [
            { month: "2026-01", amount: 100 },
            { month: "2026-02", amount: 500 },
        ],
        recurringExpenses: [
            {
                name: "HOA",
                changes: [{ startDate: "2026-04-05", dayOfMonth: 5, amount: 50 }],
            },
        ],
        gasPayments: utilityYear(10),
        electricPayments: utilityYear(20),
    };

    const projection = buildCashFlowProjection(input);

    assert.equal(projection.creditCardAverage, 300);
    assert.deepEqual(projection.creditCardSampleMonths, ["2026-01", "2026-02"]);
    assert.deepEqual(
        projection.months.map(month => ({
            paycheckCount: month.paycheckCount,
            totalExpenses: month.totalExpenses,
            carryIn: month.carryIn,
            lumpSum: month.lumpSum,
            carryOut: month.carryOut,
        })),
        [
            {
                paycheckCount: 1,
                totalExpenses: 1130,
                carryIn: 0,
                lumpSum: 0,
                carryOut: -130,
            },
            {
                paycheckCount: 3,
                totalExpenses: 1180,
                carryIn: -130,
                lumpSum: 1690,
                carryOut: 0,
            },
        ]
    );
});

test("uses the latest reading for each calendar month in both forecast years", () => {
    const projection = buildCashFlowProjection({
        startAfter: new Date(2027, 7, 9),
        paymentDay: 10,
        months: 13,
        creditCardAverageStartMonth: "2026-01",
        loanPaymentDay: 1,
        loanPaymentChanges: [
            { startDate: "2025-01-01", monthlyPayment: 100, monthlyEscrow: 0 },
        ],
        income: [{ date: "2027-07-30", amount: 1000 }],
        monthlyCreditCardPayments: [{ month: "2026-01", amount: 100 }],
        recurringExpenses: [],
        gasPayments: [
            ...utilityYear(10),
            { month: "2026-08", amount: 25 },
            { month: "2026-08", amount: 30 },
        ],
        electricPayments: utilityYear(20),
    });

    const gas = (index: number) =>
        projection.months[index].expenses.find(expense => expense.category === "Utility: Gas")
            ?.amount;
    assert.equal(gas(0), 30);
    assert.equal(gas(1), 10);
    assert.equal(gas(12), 30);
});
