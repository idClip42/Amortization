export type GraphLineData = {
    includeLumpSums: boolean;
    extraMonthlyAmount: number;
    points: {
        year: number;
        month: number;
        remainingPrincipal: number;
        interestPaid: number;
    }[];
};

export type GraphPointData = {
    date: Date;
    remainingPrincipal: number;
    principalPaid: number;
    interestPaid: number;
    totalPaid: number;
    label: string;
};
