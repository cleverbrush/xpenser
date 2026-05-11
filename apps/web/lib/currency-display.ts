import type { Currency } from '@xpenser/contracts';

type CurrencyRegion = {
    readonly regionCode?: string;
    readonly regionName?: string;
};

export type CurrencyDisplay = {
    readonly code: string;
    readonly name: string;
    readonly flag?: string;
    readonly regionName: string;
    readonly mapped: boolean;
    readonly searchText: string;
};

const regionOverrides: Record<string, CurrencyRegion> = {
    CNH: { regionCode: 'CN' },
    EUR: { regionCode: 'EU', regionName: 'European Union' },
    XAF: { regionName: 'Central Africa' },
    XAG: { regionName: 'Precious metals' },
    XAU: { regionName: 'Precious metals' },
    XCD: { regionName: 'Eastern Caribbean' },
    XCG: { regionName: 'Caribbean' },
    XDR: { regionName: 'International Monetary Fund' },
    XEU: { regionCode: 'EU', regionName: 'European Union' },
    XOF: { regionName: 'West Africa' },
    XPD: { regionName: 'Precious metals' },
    XPF: { regionName: 'French Pacific territories' },
    XPT: { regionName: 'Precious metals' }
};

const regionNames =
    typeof Intl.DisplayNames === 'function'
        ? new Intl.DisplayNames(['en'], { type: 'region' })
        : undefined;

function isRegionCode(value: string): boolean {
    return /^[A-Z]{2}$/.test(value);
}

function displayRegionName(regionCode: string): string | undefined {
    const name = regionNames?.of(regionCode);
    return name && name !== regionCode ? name : undefined;
}

function flagForRegion(regionCode: string): string | undefined {
    if (!isRegionCode(regionCode)) {
        return undefined;
    }

    return Array.from(regionCode)
        .map(char => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
        .join('');
}

export function getCurrencyDisplay(currency: Currency): CurrencyDisplay {
    const override = regionOverrides[currency.code];
    const candidateRegionCode =
        override?.regionCode ?? currency.code.slice(0, 2);
    const derivedRegionName = isRegionCode(candidateRegionCode)
        ? displayRegionName(candidateRegionCode)
        : undefined;
    const regionName = override?.regionName ?? derivedRegionName;
    const mapped = Boolean(regionName);
    const flag =
        mapped && isRegionCode(candidateRegionCode)
            ? flagForRegion(candidateRegionCode)
            : undefined;
    const displayRegion = regionName ?? currency.name;

    return {
        code: currency.code,
        name: currency.name,
        flag,
        regionName: displayRegion,
        mapped,
        searchText:
            `${displayRegion} ${currency.code} ${currency.name}`.toLowerCase()
    };
}

export function sortCurrenciesForDisplay(
    currencies: readonly Currency[]
): Currency[] {
    return [...currencies].sort((left, right) => {
        const leftDisplay = getCurrencyDisplay(left);
        const rightDisplay = getCurrencyDisplay(right);

        if (leftDisplay.mapped !== rightDisplay.mapped) {
            return leftDisplay.mapped ? -1 : 1;
        }

        return (
            leftDisplay.regionName.localeCompare(rightDisplay.regionName) ||
            left.code.localeCompare(right.code)
        );
    });
}
