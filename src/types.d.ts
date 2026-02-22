import type Config from "./../config.json";

type YearMonth = {
    year: number;
    month: number;
};

export type LoanState = YearMonth & {
    principalPaid: number;
    interestPaid: number;
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
    interestPaid: number;
    totalPaid: number;
};
