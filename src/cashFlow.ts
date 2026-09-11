import type Config from "./../config.json";
import { createLoanPaymentSchedule } from "./loanPaymentSchedule.js";

export type MonthlyCashFlow = {
    spending: {
        month: Date;
        category: string;
        amount: number;
    }[];
    income: {
        month: Date;
        amount: number;
    }[];
};

type DatedAmount = {
    date: string;
    amount: number;
};

type MonthlyAmount = {
    month: string;
    amount: number;
};

type ExpenseChange = {
    startDate: string;
    endDate?: string;
    dayOfMonth: number;
    amount: number;
};

type RecurringExpense = {
    name: string;
    changes: ExpenseChange[];
};

function parseDate(value: string, context: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        throw new Error(`${context} must use YYYY-MM-DD format; received ${value}`);
    }

    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const result = new Date(year, month - 1, day);
    if (
        result.getFullYear() !== year ||
        result.getMonth() !== month - 1 ||
        result.getDate() !== day
    ) {
        throw new Error(`${context} is not a real calendar date; received ${value}`);
    }
    return result;
}

function monthStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function dateForMonth(month: Date, dayOfMonth: number): Date {
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
        throw new Error(`dayOfMonth must be an integer from 1 through 31; received ${dayOfMonth}`);
    }
    const lastDay = new Date(
        month.getFullYear(),
        month.getMonth() + 1,
        0
    ).getDate();
    return new Date(
        month.getFullYear(),
        month.getMonth(),
        Math.min(dayOfMonth, lastDay)
    );
}

function assertAmount(amount: number, context: string): void {
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`${context} must be a non-negative number; received ${amount}`);
    }
}

function addAmount(
    totals: Map<string, number>,
    date: Date,
    amount: number
): void {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    totals.set(key, (totals.get(key) ?? 0) + amount);
}

function monthFromKey(key: string): Date {
    const [yearText, monthText] = key.split("-");
    return new Date(Number(yearText), Number(monthText), 1);
}

function parseMonth(value: string, context: string): Date {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) {
        throw new Error(`${context} must use YYYY-MM format; received ${value}`);
    }
    const [, yearText, monthText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error(`${context} has an invalid month; received ${value}`);
    }
    return new Date(year, month - 1, 1);
}

function sortedChanges(expense: RecurringExpense): (ExpenseChange & {
    startDateValue: Date;
    endDateValue?: Date;
})[] {
    if (expense.changes.length === 0) {
        throw new Error(`Recurring expense ${expense.name} must have at least one change.`);
    }

    return expense.changes
        .map(change => {
            assertAmount(change.amount, `${expense.name} amount`);
            const startDateValue = parseDate(
                change.startDate,
                `${expense.name} startDate`
            );
            const endDateValue = change.endDate
                ? parseDate(change.endDate, `${expense.name} endDate`)
                : undefined;
            if (endDateValue && endDateValue.getTime() < startDateValue.getTime()) {
                throw new Error(`${expense.name} endDate must not be before its startDate.`);
            }
            return {
                ...change,
                startDateValue,
                endDateValue,
            };
        })
        .sort((left, right) => left.startDateValue.getTime() - right.startDateValue.getTime());
}

function recurringExpenseEntries(
    expense: RecurringExpense,
    endDate: Date
): { date: Date; amount: number; category: string }[] {
    const changes = sortedChanges(expense);
    const entries: { date: Date; amount: number; category: string }[] = [];
    const firstMonth = monthStart(changes[0].startDateValue);

    for (
        let month = firstMonth;
        month.getTime() <= endDate.getTime();
        month = new Date(month.getFullYear(), month.getMonth() + 1, 1)
    ) {
        const activeChange = [...changes]
            .reverse()
            .find(change => {
                const scheduledDate = dateForMonth(month, change.dayOfMonth);
                return (
                    scheduledDate.getTime() >= change.startDateValue.getTime() &&
                    (!change.endDateValue ||
                        scheduledDate.getTime() <= change.endDateValue.getTime())
                );
            });

        if (!activeChange) continue;
        const date = dateForMonth(month, activeChange.dayOfMonth);
        if (date.getTime() > endDate.getTime()) continue;
        entries.push({
            date,
            amount: activeChange.amount,
            category: expense.name,
        });
    }

    return entries;
}

/**
 * Builds the first-pass, checking-account-oriented cash flow view. Scheduled
 * mortgage payments and known lump sums come from the existing mortgage config;
 * projected lump sums are intentionally excluded until projected income and card
 * spending are modeled as well.
 */
export function buildMonthlyCashFlow(
    config: typeof Config,
    today: Date
): MonthlyCashFlow {
    const endDate = monthEnd(today);
    const spendingByCategory = new Map<string, Map<string, number>>();
    const incomeByMonth = new Map<string, number>();

    const addSpending = (category: string, date: Date, amount: number) => {
        assertAmount(amount, `${category} amount`);
        let categoryTotals = spendingByCategory.get(category);
        if (!categoryTotals) {
            categoryTotals = new Map<string, number>();
            spendingByCategory.set(category, categoryTotals);
        }
        addAmount(categoryTotals, date, amount);
    };

    const addIncome = (date: Date, amount: number) => {
        assertAmount(amount, "Income amount");
        addAmount(incomeByMonth, date, amount);
    };

    const addCreditCardPayment = (date: Date, amount: number) => {
        assertAmount(amount, "Credit-card payment amount");
        addSpending("Credit Card", date, amount);
    };

    const firstMortgagePayment = new Date(
        config.loan.startYear,
        config.loan.startMonth,
        config.loan.paymentDay
    );
    const loanPaymentSchedule = createLoanPaymentSchedule(
        config.loan.monthlyPaymentChanges
    );
    for (
        let paymentDate = firstMortgagePayment;
        paymentDate.getTime() <= endDate.getTime();
        paymentDate = new Date(
            paymentDate.getFullYear(),
            paymentDate.getMonth() + 1,
            config.loan.paymentDay
        )
    ) {
        addSpending(
            "Mortgage: Payment",
            paymentDate,
            loanPaymentSchedule.paymentForDate(paymentDate).monthlyPayment
        );
    }

    for (const [dateText, amount] of config.lumpSums as unknown as [
        string,
        number,
    ][]) {
        const date = new Date(dateText);
        if (Number.isNaN(date.getTime())) {
            throw new Error(`Invalid lump-sum date: ${dateText}`);
        }
        if (date.getTime() <= endDate.getTime()) {
            addSpending("Mortgage: Extra", date, amount);
        }
    }

    for (const expense of config.cashFlow
        .recurringExpenses as unknown as RecurringExpense[]) {
        for (const entry of recurringExpenseEntries(expense, endDate)) {
            addSpending(entry.category, entry.date, entry.amount);
        }
    }

    const addMonthlyUtility = (category: string, entries: MonthlyAmount[]) => {
        for (const entry of entries) {
            const month = parseMonth(entry.month, `${category} month`);
            if (month.getTime() <= endDate.getTime()) {
                addSpending(category, month, entry.amount);
            }
        }
    };

    addMonthlyUtility(
        "Utility: Gas",
        config.cashFlow.gas as unknown as MonthlyAmount[]
    );
    addMonthlyUtility(
        "Utility: Electric",
        config.cashFlow.electric as unknown as MonthlyAmount[]
    );

    for (const payment of config.cashFlow
        .monthlyCreditCardPayments as unknown as MonthlyAmount[]) {
        const month = parseMonth(payment.month, "Monthly credit-card payment month");
        if (month.getTime() <= endDate.getTime()) {
            addCreditCardPayment(month, payment.amount);
        }
    }

    for (const entry of config.cashFlow.income as unknown as DatedAmount[]) {
        const date = parseDate(entry.date, "Income date");
        if (date.getTime() <= endDate.getTime()) {
            addIncome(date, entry.amount);
        }
    }

    return {
        spending: [...spendingByCategory.entries()].flatMap(
            ([category, totals]) =>
                [...totals.entries()].map(([key, amount]) => ({
                    month: monthFromKey(key),
                    category,
                    amount,
                }))
        ),
        income: [...incomeByMonth.entries()].map(([key, amount]) => ({
            month: monthFromKey(key),
            amount,
        })),
    };
}
