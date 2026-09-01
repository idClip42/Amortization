export type LoanPaymentChange = {
    startDate: string;
    monthlyPayment: number;
    monthlyEscrow: number;
};

export type LoanPayment = {
    monthlyPayment: number;
    monthlyEscrow: number;
    monthlyTowardLoan: number;
};

export type LoanPaymentSchedule = {
    paymentForDate(date: Date): LoanPayment;
    monthlyTowardLoanForDate(date: Date): number;
};

type ParsedLoanPaymentChange = LoanPaymentChange & {
    startDateValue: Date;
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

function assertCurrencyAmount(amount: number, context: string): void {
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`${context} must be a non-negative number; received ${amount}`);
    }
}

/**
 * Validates dated mortgage-payment changes and returns the payment in force on
 * any given payment date. A change takes effect on its start date, matching the
 * recurring-expense convention used in the cash-flow configuration.
 */
export function createLoanPaymentSchedule(
    changes: readonly LoanPaymentChange[]
): LoanPaymentSchedule {
    if (changes.length === 0) {
        throw new Error("Loan monthlyPaymentChanges must have at least one change.");
    }

    const parsedChanges: ParsedLoanPaymentChange[] = changes
        .map((change, index) => {
            const context = `Loan monthlyPaymentChanges[${index}]`;
            assertCurrencyAmount(change.monthlyPayment, `${context} monthlyPayment`);
            assertCurrencyAmount(change.monthlyEscrow, `${context} monthlyEscrow`);
            if (change.monthlyPayment <= change.monthlyEscrow) {
                throw new Error(
                    `${context} monthlyPayment must be greater than monthlyEscrow.`
                );
            }
            return {
                ...change,
                startDateValue: parseDate(change.startDate, `${context} startDate`),
            };
        })
        .sort((left, right) => left.startDateValue.getTime() - right.startDateValue.getTime());

    for (let index = 1; index < parsedChanges.length; index += 1) {
        if (
            parsedChanges[index - 1].startDateValue.getTime() ===
            parsedChanges[index].startDateValue.getTime()
        ) {
            throw new Error(
                `Loan monthlyPaymentChanges has more than one change starting on ${parsedChanges[index].startDate}.`
            );
        }
    }

    const paymentForDate = (date: Date): LoanPayment => {
        const activeChange = [...parsedChanges]
            .reverse()
            .find(change => change.startDateValue.getTime() <= date.getTime());
        if (!activeChange) {
            throw new Error(
                `No loan monthly payment is configured for ${date.toLocaleDateString()}.`
            );
        }

        return {
            monthlyPayment: activeChange.monthlyPayment,
            monthlyEscrow: activeChange.monthlyEscrow,
            monthlyTowardLoan:
                activeChange.monthlyPayment - activeChange.monthlyEscrow,
        };
    };

    return {
        paymentForDate,
        monthlyTowardLoanForDate: date => paymentForDate(date).monthlyTowardLoan,
    };
}
