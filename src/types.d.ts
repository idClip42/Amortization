type YearMonth = {
    year: number;
    month: number;
};

export type LoanState = YearMonth & {
    remainingPrincipal: number;
    interestPaid: number;
};

export type ExtraPayments = {
    lumpSums: (YearMonth & { amount: number })[];
    monthly: { start: YearMonth; amount: number };
};

export type GraphPointData = {
    label: string | number;
    date: Date;
    remainingPrincipal: number;
    principalPaid: number;
    interestPaid: number;
    totalPaid: number;
};
