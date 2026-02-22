import type Config from "./../config.json";

export type YearMonth = {
    year: number;
    /** 1 is January, 12 is December */
    month: number;
};

export type LoanState = YearMonth & {
    principalPaid: number;
    principalPaidAdjusted: number;
    interestPaid: number;
    interestPaidAdjusted: number;
    loan: Readonly<(typeof Config)["loan"]>;
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
    principalPaidAdjusted: number;
    interestPaid: number;
    interestPaidAdjusted: number;
    totalPaid: number;
    totalPaidAdjusted: number;
};
