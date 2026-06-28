'use client';

import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState
} from 'react';

const storageKey = 'xpenser:hide-amounts';
export const hiddenAmountLabel = '****';

type AmountPrivacyContextValue = {
    readonly hideAmounts: boolean;
    readonly setHideAmounts: (value: boolean) => void;
    readonly toggleHideAmounts: () => void;
};

const AmountPrivacyContext = createContext<AmountPrivacyContextValue | null>(
    null
);

export function AmountPrivacyProvider({
    children
}: {
    readonly children: ReactNode;
}) {
    const [hideAmounts, setHideAmountsState] = useState(false);

    useEffect(() => {
        setHideAmountsState(localStorage.getItem(storageKey) === 'true');
    }, []);

    const setHideAmounts = useCallback((value: boolean) => {
        setHideAmountsState(value);
        localStorage.setItem(storageKey, String(value));
    }, []);

    const toggleHideAmounts = useCallback(() => {
        setHideAmountsState(current => {
            const next = !current;
            localStorage.setItem(storageKey, String(next));
            return next;
        });
    }, []);

    const value = useMemo(
        () => ({
            hideAmounts,
            setHideAmounts,
            toggleHideAmounts
        }),
        [hideAmounts, setHideAmounts, toggleHideAmounts]
    );

    return (
        <AmountPrivacyContext.Provider value={value}>
            {children}
        </AmountPrivacyContext.Provider>
    );
}

export function useAmountPrivacy(): AmountPrivacyContextValue {
    const value = useContext(AmountPrivacyContext);
    if (!value) {
        return {
            hideAmounts: false,
            setHideAmounts: () => undefined,
            toggleHideAmounts: () => undefined
        };
    }
    return value;
}
