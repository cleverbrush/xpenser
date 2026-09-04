import { Card, CardContent, CardHeader } from '@xpenser/ui';

const summaryCards = ['income', 'expenses', 'net'];
const rows = ['first', 'second', 'third', 'fourth'];

export default function AppLoading() {
    return (
        <div aria-label="Loading page" aria-live="polite" role="status">
            <span className="sr-only">Loading page</span>
            <div
                aria-hidden="true"
                className="motion-safe:animate-pulse space-y-5 sm:space-y-6"
            >
                <div className="space-y-2">
                    <div className="h-8 w-40 rounded-md bg-muted" />
                    <div className="h-4 w-72 max-w-full rounded-md bg-muted" />
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    {summaryCards.map(card => (
                        <Card className="min-w-0" key={card}>
                            <CardHeader className="space-y-2 p-3 sm:p-4">
                                <div className="h-3 w-14 rounded-md bg-muted" />
                                <div className="h-5 w-20 max-w-full rounded-md bg-muted" />
                            </CardHeader>
                        </Card>
                    ))}
                </div>
                <Card>
                    <CardHeader>
                        <div className="h-6 w-32 rounded-md bg-muted" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {rows.map(row => (
                            <div
                                className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0"
                                key={row}
                            >
                                <div className="space-y-2">
                                    <div className="h-4 w-32 rounded-md bg-muted" />
                                    <div className="h-3 w-20 rounded-md bg-muted" />
                                </div>
                                <div className="h-4 w-16 rounded-md bg-muted" />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
