import {
    createLoanPaymentSchedule,
    type LoanPaymentChange,
} from "./loanPaymentSchedule.js";

type DatedAmount = { date: string; amount: number };
type MonthlyAmount = { month: string; amount: number };
type ExpenseChange = {
    startDate: string;
    endDate?: string;
    dayOfMonth: number;
    amount: number;
};
type RecurringExpense = { name: string; changes: ExpenseChange[] };

export type CashFlowProjectionInput = {
    startAfter: Date;
    paymentDay: number;
    months: number;
    incomeLookaheadDays: number;
    creditCardAverageStartMonth: string;
    loanPaymentDay: number;
    loanPaymentChanges: readonly LoanPaymentChange[];
    income: readonly DatedAmount[];
    monthlyCreditCardPayments: readonly MonthlyAmount[];
    recurringExpenses: readonly RecurringExpense[];
    gasPayments: readonly MonthlyAmount[];
    electricPayments: readonly MonthlyAmount[];
};

export type ProjectedCashFlowMonth = {
    date: Date;
    paycheckCount: number;
    income: number;
    expenses: { category: string; amount: number }[];
    totalExpenses: number;
    carryIn: number;
    lumpSum: number;
    carryOut: number;
};

export type CashFlowProjection = {
    creditCardAverage: number;
    creditCardSampleMonths: string[];
    incomeLookaheadDays: number;
    months: ProjectedCashFlowMonth[];
};

function parseDate(value: string, context: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new Error(`${context} must use YYYY-MM-DD format: ${value}`);
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (formatDate(date) !== value) {
        throw new Error(`${context} is not a real calendar date: ${value}`);
    }
    return date;
}

function formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseMonth(value: string, context: string): number {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
        throw new Error(`${context} must use a real YYYY-MM month: ${value}`);
    }
    return Number(match[1]) * 12 + Number(match[2]) - 1;
}

function monthIndex(date: Date): number {
    return date.getFullYear() * 12 + date.getMonth();
}

function cents(amount: number, context: string): number {
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`${context} must be a non-negative amount: ${amount}`);
    }
    return Math.round(amount * 100);
}

function dollars(amountInCents: number): number {
    return amountInCents / 100;
}

function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function dateInMonth(month: Date, day: number): Date {
    if (!Number.isInteger(day) || day < 1 || day > 31) {
        throw new Error(`dayOfMonth must be between 1 and 31: ${day}`);
    }
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return new Date(month.getFullYear(), month.getMonth(), Math.min(day, lastDay));
}

function latestUtilityByCalendarMonth(
    entries: readonly MonthlyAmount[],
    category: string,
    beforeMonth: number
): Map<number, number> {
    const latest = new Map<number, { monthIndex: number; cents: number }>();
    for (const entry of entries) {
        const index = parseMonth(entry.month, `${category} month`);
        const amount = cents(entry.amount, category);
        if (index >= beforeMonth) continue;
        const calendarMonth = index % 12;
        const previous = latest.get(calendarMonth);
        if (!previous || index >= previous.monthIndex) {
            latest.set(calendarMonth, { monthIndex: index, cents: amount });
        }
    }
    if (latest.size !== 12) {
        throw new Error(`${category} needs a recorded value for every calendar month.`);
    }
    return new Map([...latest].map(([month, value]) => [month, value.cents]));
}

function recurringAmountForMonth(
    expense: RecurringExpense,
    month: Date
): number {
    let latestStart = -Infinity;
    let amount = 0;
    for (const change of expense.changes) {
        const start = parseDate(change.startDate, `${expense.name} startDate`);
        const end = change.endDate
            ? parseDate(change.endDate, `${expense.name} endDate`)
            : undefined;
        const scheduledDate = dateInMonth(month, change.dayOfMonth);
        const changeAmount = cents(change.amount, expense.name);
        if (end && end.getTime() < start.getTime()) {
            throw new Error(`${expense.name} endDate precedes startDate.`);
        }
        if (
            scheduledDate.getTime() >= start.getTime() &&
            (!end || scheduledDate.getTime() <= end.getTime()) &&
            start.getTime() >= latestStart
        ) {
            latestStart = start.getTime();
            amount = changeAmount;
        }
    }
    return amount;
}

/**
 * Forecasts cash left for an extra mortgage payment on each 10th. Monthly bills
 * are assigned to that month's payment date; actual and forecast paychecks keep
 * their biweekly dates. Income lookahead assigns nearby future paychecks to the
 * prior payment, with consecutive windows so no paycheck is counted twice.
 * A negative carry is repaid before another lump sum.
 */
export function buildCashFlowProjection(input: CashFlowProjectionInput): CashFlowProjection {
    if (Number.isNaN(input.startAfter.getTime())) {
        throw new Error("Cash-flow projection startAfter is invalid.");
    }
    if (!Number.isInteger(input.months) || input.months < 1) {
        throw new Error("Cash-flow projection months must be a positive integer.");
    }
    if (!Number.isInteger(input.incomeLookaheadDays) || input.incomeLookaheadDays < 0) {
        throw new Error("Cash-flow projection incomeLookaheadDays must be a non-negative integer.");
    }
    if (!Number.isInteger(input.paymentDay) || input.paymentDay < 1 || input.paymentDay > 28) {
        throw new Error("Cash-flow projection paymentDay must be between 1 and 28.");
    }

    let firstPaymentDate = new Date(
        input.startAfter.getFullYear(),
        input.startAfter.getMonth(),
        input.paymentDay
    );
    if (firstPaymentDate.getTime() <= input.startAfter.getTime()) {
        firstPaymentDate = new Date(
            firstPaymentDate.getFullYear(),
            firstPaymentDate.getMonth() + 1,
            input.paymentDay
        );
    }
    const firstMonthIndex = monthIndex(firstPaymentDate);
    const averageStartIndex = parseMonth(
        input.creditCardAverageStartMonth,
        "creditCardAverageStartMonth"
    );
    const cardByMonth = new Map<number, number>();
    for (const entry of input.monthlyCreditCardPayments) {
        const index = parseMonth(entry.month, "Credit Card month");
        const amount = cents(entry.amount, "Credit Card");
        if (index >= averageStartIndex && index < firstMonthIndex) {
            cardByMonth.set(index, amount);
        }
    }
    if (cardByMonth.size === 0) {
        throw new Error("No credit-card payments fall within the selected averaging period.");
    }
    const creditCardAverageCents = Math.round(
        [...cardByMonth.values()].reduce((sum, value) => sum + value, 0) /
            cardByMonth.size
    );
    const creditCardSampleMonths = [...cardByMonth.keys()]
        .sort((left, right) => left - right)
        .map(index => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`);

    const gasByMonth = latestUtilityByCalendarMonth(
        input.gasPayments,
        "Utility: Gas",
        firstMonthIndex
    );
    const electricByMonth = latestUtilityByCalendarMonth(
        input.electricPayments,
        "Utility: Electric",
        firstMonthIndex
    );
    const actualIncome = input.income
        .map(entry => ({
            date: parseDate(entry.date, "Income date"),
            amount: cents(entry.amount, "Income"),
        }))
        .sort((left, right) => left.date.getTime() - right.date.getTime());
    if (actualIncome.length === 0) {
        throw new Error("At least one recorded paycheck is needed for the forecast.");
    }
    const lastActualPaycheck = actualIncome[actualIncome.length - 1];
    const lastPaymentDate = new Date(
        firstPaymentDate.getFullYear(),
        firstPaymentDate.getMonth() + input.months - 1,
        input.paymentDay
    );
    const lastIncomeCutoff = addDays(lastPaymentDate, input.incomeLookaheadDays);
    const paychecks = [...actualIncome];
    // An early holiday deposit still belongs to its scheduled Friday.
    const nominalLastFriday = new Date(lastActualPaycheck.date);
    while (nominalLastFriday.getDay() !== 5) {
        nominalLastFriday.setDate(nominalLastFriday.getDate() + 1);
    }
    for (
        let payday = new Date(
            nominalLastFriday.getFullYear(),
            nominalLastFriday.getMonth(),
            nominalLastFriday.getDate() + 14
        );
        payday.getTime() <= lastIncomeCutoff.getTime();
        payday = new Date(
            payday.getFullYear(),
            payday.getMonth(),
            payday.getDate() + 14
        )
    ) {
        paychecks.push({ date: payday, amount: lastActualPaycheck.amount });
    }

    const loanSchedule = createLoanPaymentSchedule(input.loanPaymentChanges);
    const months: ProjectedCashFlowMonth[] = [];
    let carryCents = 0;
    let previousIncomeCutoff = addDays(
        new Date(
            firstPaymentDate.getFullYear(),
            firstPaymentDate.getMonth() - 1,
            input.paymentDay
        ),
        input.incomeLookaheadDays
    );
    for (let index = 0; index < input.months; index += 1) {
        const date = new Date(
            firstPaymentDate.getFullYear(),
            firstPaymentDate.getMonth() + index,
            input.paymentDay
        );
        const incomeCutoff = addDays(date, input.incomeLookaheadDays);
        const cyclePaychecks = paychecks.filter(
            paycheck =>
                paycheck.date.getTime() > previousIncomeCutoff.getTime() &&
                paycheck.date.getTime() <= incomeCutoff.getTime()
        );
        const incomeCents = cyclePaychecks.reduce((sum, paycheck) => sum + paycheck.amount, 0);
        const month = new Date(date.getFullYear(), date.getMonth(), 1);
        const expensesInCents = [
            {
                category: "Mortgage: Payment",
                amount: cents(
                    loanSchedule.paymentForDate(
                        dateInMonth(month, input.loanPaymentDay)
                    ).monthlyPayment,
                    "Mortgage: Payment"
                ),
            },
            { category: "Credit Card", amount: creditCardAverageCents },
            { category: "Utility: Gas", amount: gasByMonth.get(date.getMonth())! },
            { category: "Utility: Electric", amount: electricByMonth.get(date.getMonth())! },
            ...input.recurringExpenses.map(expense => ({
                category: expense.name,
                amount: recurringAmountForMonth(expense, month),
            })),
        ].filter(expense => expense.amount > 0);
        const totalExpensesCents = expensesInCents.reduce(
            (sum, expense) => sum + expense.amount,
            0
        );
        const carryInCents = carryCents;
        const availableCents = carryCents + incomeCents - totalExpensesCents;
        const lumpSumCents = Math.max(0, availableCents);
        carryCents = availableCents - lumpSumCents;
        months.push({
            date,
            paycheckCount: cyclePaychecks.length,
            income: dollars(incomeCents),
            expenses: expensesInCents.map(expense => ({
                category: expense.category,
                amount: dollars(expense.amount),
            })),
            totalExpenses: dollars(totalExpensesCents),
            carryIn: dollars(carryInCents),
            lumpSum: dollars(lumpSumCents),
            carryOut: dollars(carryCents),
        });
        previousIncomeCutoff = incomeCutoff;
    }

    return {
        creditCardAverage: dollars(creditCardAverageCents),
        creditCardSampleMonths,
        incomeLookaheadDays: input.incomeLookaheadDays,
        months,
    };
}
