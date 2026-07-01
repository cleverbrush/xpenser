export type AlternativeComparisonRow = {
    readonly feature: string;
    readonly xpenser: string;
    readonly competitor: string;
};

export type AlternativeProduct = {
    readonly audience: string;
    readonly comparisonRows: readonly AlternativeComparisonRow[];
    readonly competitorSummary: string;
    readonly description: string;
    readonly eyebrow: string;
    readonly highlights: readonly string[];
    readonly h1: string;
    readonly keywords: readonly string[];
    readonly metadataTitle: string;
    readonly name: string;
    readonly path: string;
    readonly priority: number;
    readonly slug: string;
    readonly sourceLabel: string;
    readonly sourceUrl: string;
    readonly xpenserSummary: string;
};

export const alternativesIndexPage = {
    description:
        'Compare xpenser alternatives for personal finance tracking, expense tracking, budgeting, self-hosting, API access, MCP workflows, Telegram capture, and open-source finance software.',
    h1: 'xpenser alternatives and competitor comparisons',
    metadataTitle: 'xpenser Alternatives and Competitor Comparisons',
    navLabel: 'Alternatives',
    path: '/alternatives',
    priority: 0.82
} as const;

const xpenserOwnership =
    'Open-source, MIT licensed, and self-hostable with Docker Compose or usable through xpenser.cleverbrush.com.';
const xpenserTracking =
    'Tracks income, expenses, refunds, returns, vendors, categories, notes, dates, tags, and multi-currency amounts.';
const xpenserReports =
    'Daily, weekly, monthly, quarterly, and yearly dashboards with category detail, trends, and optional email summaries.';
const xpenserAutomation =
    'OpenAPI docs, API keys, typed client access, MCP tools, and Telegram workflows for finance data.';

export const alternativeProducts = [
    {
        audience:
            'People searching for a Mint alternative, Mint replacement, or open-source personal finance tracker after Mint shut down.',
        comparisonRows: [
            {
                feature: 'Product status and fit',
                xpenser:
                    'Active early-stage finance tracker for people who want an inspectable app with self-hosting and API access.',
                competitor:
                    'Mint was a long-running consumer budgeting app, but the Mint app and website were retired by Intuit.'
            },
            {
                feature: 'Deployment and ownership',
                xpenser: xpenserOwnership,
                competitor:
                    'Mint was a hosted proprietary service, so users did not run or inspect the application code.'
            },
            {
                feature: 'Finance tracking model',
                xpenser: xpenserTracking,
                competitor:
                    'Mint focused on account aggregation, budgets, spending categories, credit insights, and consumer finance summaries.'
            },
            {
                feature: 'Reports and visibility',
                xpenser: xpenserReports,
                competitor:
                    'Mint emphasized automatic categorization and account-driven spending visibility in a hosted consumer app.'
            },
            {
                feature: 'Developer and agent access',
                xpenser: xpenserAutomation,
                competitor:
                    'Mint did not position itself as an open-source finance API, MCP, or self-hosted workflow platform.'
            }
        ],
        competitorSummary:
            'Mint was a popular free budgeting and personal finance app for account aggregation, spending categories, budgets, and credit-focused consumer finance workflows.',
        description:
            'Compare xpenser with Mint for people looking for a Mint alternative, Mint replacement, open-source expense tracker, and self-hosted personal finance app.',
        eyebrow: 'Mint alternative',
        h1: 'xpenser as a Mint alternative',
        highlights: [
            'Mint replacement research',
            'Open-source expense tracker',
            'Self-hosted finance app',
            'API and MCP access'
        ],
        keywords: [
            'Mint alternative',
            'Mint replacement',
            'open-source Mint alternative',
            'self-hosted Mint alternative',
            'personal finance app like Mint'
        ],
        metadataTitle: 'Mint Alternative for Personal Finance Tracking',
        name: 'Mint',
        path: '/alternatives/mint-alternative',
        priority: 0.7,
        slug: 'mint-alternative',
        sourceLabel: 'Mint and Credit Karma support',
        sourceUrl:
            'https://support.creditkarma.com/s/article/Intuit-Mint-and-Credit-Karma-US',
        xpenserSummary:
            'xpenser is useful when the goal is to own the tracking workflow, inspect the source, self-host later, or connect finance data to API, MCP, and Telegram tools.'
    },
    {
        audience:
            'Budgeters comparing YNAB alternatives, zero-based budgeting apps, and developer-friendly personal finance trackers.',
        comparisonRows: [
            {
                feature: 'Product focus',
                xpenser:
                    'Personal finance tracking with dashboards, transaction history, categories, vendors, multi-currency reports, and integrations.',
                competitor:
                    'YNAB centers on its budgeting method, assigning money to categories, planned spending, debt payoff, goals, and habit building.'
            },
            {
                feature: 'Deployment and ownership',
                xpenser: xpenserOwnership,
                competitor:
                    'YNAB is a hosted subscription app, not a self-hosted or open-source deployment.'
            },
            {
                feature: 'Finance tracking model',
                xpenser: xpenserTracking,
                competitor:
                    'YNAB emphasizes proactive envelope-style budgeting around accounts, categories, targets, and imports.'
            },
            {
                feature: 'Reports and visibility',
                xpenser: xpenserReports,
                competitor:
                    'YNAB includes budgeting reports and net-worth visibility oriented around the YNAB method.'
            },
            {
                feature: 'Developer and agent access',
                xpenser: xpenserAutomation,
                competitor:
                    'YNAB offers developer API access, while xpenser also exposes MCP tools and self-hosted source access.'
            }
        ],
        competitorSummary:
            'YNAB is a budgeting app built around a specific money allocation method, targets, imports, reports, and spending behavior change.',
        description:
            'Compare xpenser with YNAB for YNAB alternative searches, zero-based budgeting alternatives, open-source finance tracking, and API-first expense workflows.',
        eyebrow: 'YNAB alternative',
        h1: 'xpenser as a YNAB alternative',
        highlights: [
            'YNAB alternative keywords',
            'Expense and income tracking',
            'OpenAPI and MCP workflows',
            'Self-hostable source'
        ],
        keywords: [
            'YNAB alternative',
            'You Need A Budget alternative',
            'open-source YNAB alternative',
            'self-hosted YNAB alternative',
            'budgeting app alternative to YNAB'
        ],
        metadataTitle: 'YNAB Alternative for Finance Tracking',
        name: 'YNAB',
        path: '/alternatives/ynab-alternative',
        priority: 0.68,
        slug: 'ynab-alternative',
        sourceLabel: 'YNAB',
        sourceUrl: 'https://www.ynab.com/',
        xpenserSummary:
            'xpenser is a better fit when the comparison is about ownership, transaction records, reports, API access, Telegram capture, and agent workflows rather than strict budgeting methodology.'
    },
    {
        audience:
            'Households comparing Monarch Money alternatives for shared budgeting, finance dashboards, and personal finance tracking.',
        comparisonRows: [
            {
                feature: 'Product focus',
                xpenser:
                    'Open-source finance tracking with structured transactions, dashboards, reports, API keys, MCP, and Telegram workflows.',
                competitor:
                    'Monarch Money focuses on budgeting, net worth, investments, financial goals, recurring expenses, and household collaboration.'
            },
            {
                feature: 'Deployment and ownership',
                xpenser: xpenserOwnership,
                competitor:
                    'Monarch Money is a hosted proprietary subscription product rather than a self-hosted codebase.'
            },
            {
                feature: 'Finance tracking model',
                xpenser: xpenserTracking,
                competitor:
                    'Monarch Money emphasizes connected accounts, budgets, categories, goals, net worth, and collaborative household planning.'
            },
            {
                feature: 'Reports and visibility',
                xpenser: xpenserReports,
                competitor:
                    'Monarch Money presents financial dashboards around budgets, goals, accounts, investments, and recurring bills.'
            },
            {
                feature: 'Developer and agent access',
                xpenser: xpenserAutomation,
                competitor:
                    'Monarch Money is consumer-product oriented and does not market itself as an open-source MCP finance server.'
            }
        ],
        competitorSummary:
            'Monarch Money is a hosted personal finance dashboard and budgeting product for households that want account aggregation, collaboration, goals, and net-worth views.',
        description:
            'Compare xpenser with Monarch Money for Monarch alternative searches, open-source personal finance tracking, self-hosted expense reports, and API-connected workflows.',
        eyebrow: 'Monarch Money alternative',
        h1: 'xpenser as a Monarch Money alternative',
        highlights: [
            'Monarch Money alternative',
            'Self-hosted tracking',
            'Multi-currency reports',
            'Developer-friendly finance data'
        ],
        keywords: [
            'Monarch Money alternative',
            'Monarch alternative',
            'open-source Monarch Money alternative',
            'self-hosted Monarch alternative',
            'personal finance dashboard alternative'
        ],
        metadataTitle: 'Monarch Money Alternative for Finance Tracking',
        name: 'Monarch Money',
        path: '/alternatives/monarch-money-alternative',
        priority: 0.67,
        slug: 'monarch-money-alternative',
        sourceLabel: 'Monarch Money',
        sourceUrl: 'https://www.monarchmoney.com/',
        xpenserSummary:
            'xpenser makes sense when the alternatives search is less about household planning polish and more about open-source ownership, structured transaction history, and programmable access.'
    },
    {
        audience:
            'Apple users and developers comparing Copilot Money alternatives with finance apps that can be inspected, self-hosted, and connected to APIs.',
        comparisonRows: [
            {
                feature: 'Product focus',
                xpenser:
                    'Web-based finance tracking with dashboards, transaction capture, reports, API docs, MCP access, and Telegram workflows.',
                competitor:
                    'Copilot Money focuses on a polished personal finance experience for Apple platforms with smart categorization and spending visibility.'
            },
            {
                feature: 'Deployment and ownership',
                xpenser: xpenserOwnership,
                competitor:
                    'Copilot Money is a hosted proprietary app rather than an open-source or self-hosted finance stack.'
            },
            {
                feature: 'Finance tracking model',
                xpenser: xpenserTracking,
                competitor:
                    'Copilot Money emphasizes connected accounts, transaction review, budgets, categories, investments, and recurring items.'
            },
            {
                feature: 'Reports and visibility',
                xpenser: xpenserReports,
                competitor:
                    'Copilot Money is optimized for consumer spending views and mobile or desktop app review.'
            },
            {
                feature: 'Developer and agent access',
                xpenser: xpenserAutomation,
                competitor:
                    'Copilot Money does not position its product around self-hosted source code, MCP tools, or an open finance API surface.'
            }
        ],
        competitorSummary:
            'Copilot Money is a consumer personal finance app known for account connectivity, categorization, budgets, recurring expenses, investments, and polished Apple-platform workflows.',
        description:
            'Compare xpenser with Copilot Money for Copilot alternative searches, self-hosted personal finance tracking, open-source expense reports, and API-ready workflows.',
        eyebrow: 'Copilot Money alternative',
        h1: 'xpenser as a Copilot Money alternative',
        highlights: [
            'Copilot Money alternative',
            'Web app workflow',
            'Open-source finance tracker',
            'Telegram and MCP access'
        ],
        keywords: [
            'Copilot Money alternative',
            'Copilot alternative',
            'open-source Copilot Money alternative',
            'self-hosted Copilot alternative',
            'personal finance app alternative to Copilot'
        ],
        metadataTitle: 'Copilot Money Alternative for Expense Tracking',
        name: 'Copilot Money',
        path: '/alternatives/copilot-money-alternative',
        priority: 0.66,
        slug: 'copilot-money-alternative',
        sourceLabel: 'Copilot Money',
        sourceUrl: 'https://copilot.money/',
        xpenserSummary:
            'xpenser is the stronger comparison when the priority is an inspectable web app, multi-surface capture, and programmable finance records instead of a proprietary native app experience.'
    },
    {
        audience:
            'People comparing Rocket Money alternatives for expense tracking, subscription tracking, budgeting, and finance dashboards.',
        comparisonRows: [
            {
                feature: 'Product focus',
                xpenser:
                    'Personal finance tracking across income, expenses, refunds, returns, categories, vendors, reports, API, MCP, and Telegram workflows.',
                competitor:
                    'Rocket Money focuses on subscriptions, bill insights, spending, budgeting, net worth, and consumer money management.'
            },
            {
                feature: 'Deployment and ownership',
                xpenser: xpenserOwnership,
                competitor:
                    'Rocket Money is a hosted proprietary consumer finance product.'
            },
            {
                feature: 'Finance tracking model',
                xpenser: xpenserTracking,
                competitor:
                    'Rocket Money is strongest around connected-account visibility, recurring charges, subscription management, bills, and budgets.'
            },
            {
                feature: 'Reports and visibility',
                xpenser: xpenserReports,
                competitor:
                    'Rocket Money surfaces spending, bills, subscriptions, net worth, and related money management views.'
            },
            {
                feature: 'Developer and agent access',
                xpenser: xpenserAutomation,
                competitor:
                    'Rocket Money does not market an open-source self-hosted finance API or MCP workflow layer.'
            }
        ],
        competitorSummary:
            'Rocket Money is a consumer app for tracking spending, managing subscriptions, monitoring bills, budgets, savings, and net worth.',
        description:
            'Compare xpenser with Rocket Money for Rocket Money alternative keywords, open-source expense tracking, self-hosted personal finance reports, and API workflows.',
        eyebrow: 'Rocket Money alternative',
        h1: 'xpenser as a Rocket Money alternative',
        highlights: [
            'Rocket Money alternative',
            'Expense tracker comparison',
            'Open-source finance data',
            'API-first workflows'
        ],
        keywords: [
            'Rocket Money alternative',
            'Rocket Money competitor',
            'open-source Rocket Money alternative',
            'self-hosted Rocket Money alternative',
            'subscription tracker alternative'
        ],
        metadataTitle: 'Rocket Money Alternative for Expense Tracking',
        name: 'Rocket Money',
        path: '/alternatives/rocket-money-alternative',
        priority: 0.65,
        slug: 'rocket-money-alternative',
        sourceLabel: 'Rocket Money',
        sourceUrl: 'https://www.rocketmoney.com/',
        xpenserSummary:
            'xpenser is useful when the replacement search is about transaction ownership, reports, APIs, MCP, and self-hosting rather than subscription negotiation or bill services.'
    },
    {
        audience:
            'People comparing Quicken Simplifi alternatives for spending plans, reports, and personal finance tracking.',
        comparisonRows: [
            {
                feature: 'Product focus',
                xpenser:
                    'Open-source finance tracking with transaction records, dashboards, reports, API keys, OpenAPI, MCP, and Telegram capture.',
                competitor:
                    'Quicken Simplifi focuses on spending plans, budgets, watchlists, savings goals, reports, subscriptions, and net worth.'
            },
            {
                feature: 'Deployment and ownership',
                xpenser: xpenserOwnership,
                competitor:
                    'Quicken Simplifi is a hosted proprietary subscription product.'
            },
            {
                feature: 'Finance tracking model',
                xpenser: xpenserTracking,
                competitor:
                    'Simplifi emphasizes connected finances, categorized spending, recurring bills, plans, goals, and watchlists.'
            },
            {
                feature: 'Reports and visibility',
                xpenser: xpenserReports,
                competitor:
                    'Simplifi presents reports, spending plans, projected cash flow, and personal finance summaries.'
            },
            {
                feature: 'Developer and agent access',
                xpenser: xpenserAutomation,
                competitor:
                    'Simplifi is not positioned as an open-source finance platform with MCP tooling.'
            }
        ],
        competitorSummary:
            'Quicken Simplifi is a consumer personal finance app for spending plans, budgets, savings goals, watchlists, reports, subscriptions, and net-worth tracking.',
        description:
            'Compare xpenser with Quicken Simplifi for Simplifi alternative searches, open-source personal finance tracking, self-hosted expense reports, and API-enabled workflows.',
        eyebrow: 'Quicken Simplifi alternative',
        h1: 'xpenser as a Quicken Simplifi alternative',
        highlights: [
            'Quicken Simplifi alternative',
            'Spending tracker comparison',
            'Self-hostable app',
            'OpenAPI and MCP access'
        ],
        keywords: [
            'Quicken Simplifi alternative',
            'Simplifi alternative',
            'open-source Quicken Simplifi alternative',
            'self-hosted Simplifi alternative',
            'spending plan app alternative'
        ],
        metadataTitle: 'Quicken Simplifi Alternative for Finance Tracking',
        name: 'Quicken Simplifi',
        path: '/alternatives/quicken-simplifi-alternative',
        priority: 0.64,
        slug: 'quicken-simplifi-alternative',
        sourceLabel: 'Quicken Simplifi',
        sourceUrl: 'https://www.quicken.com/products/simplifi/',
        xpenserSummary:
            'xpenser fits users who care more about open-source ownership, custom deployment, transaction data access, and integration surfaces than a packaged spending-plan subscription.'
    },
    {
        audience:
            'Budgeters comparing PocketGuard alternatives for spending limits, bills, debt payoff, and personal finance dashboards.',
        comparisonRows: [
            {
                feature: 'Product focus',
                xpenser:
                    'Structured expense and income tracking with categories, vendors, reports, multi-currency support, API, MCP, and Telegram workflows.',
                competitor:
                    'PocketGuard focuses on budgeting, spend limits, bills, savings goals, debt payoff, and showing what is safe to spend.'
            },
            {
                feature: 'Deployment and ownership',
                xpenser: xpenserOwnership,
                competitor:
                    'PocketGuard is a hosted proprietary consumer budgeting app.'
            },
            {
                feature: 'Finance tracking model',
                xpenser: xpenserTracking,
                competitor:
                    'PocketGuard emphasizes account-connected budgeting, bills, goals, debts, and available-to-spend guidance.'
            },
            {
                feature: 'Reports and visibility',
                xpenser: xpenserReports,
                competitor:
                    'PocketGuard surfaces budgets, spending categories, bills, debts, and savings progress.'
            },
            {
                feature: 'Developer and agent access',
                xpenser: xpenserAutomation,
                competitor:
                    'PocketGuard does not market open-source deployment, MCP tools, or a public finance API workflow.'
            }
        ],
        competitorSummary:
            'PocketGuard is a budgeting and bill-tracking app focused on spending limits, goals, debts, and safe-to-spend guidance.',
        description:
            'Compare xpenser with PocketGuard for PocketGuard alternative keywords, self-hosted personal finance tracking, open-source expense reports, and API workflows.',
        eyebrow: 'PocketGuard alternative',
        h1: 'xpenser as a PocketGuard alternative',
        highlights: [
            'PocketGuard alternative',
            'Budget tracker comparison',
            'Open-source finance app',
            'Programmable finance data'
        ],
        keywords: [
            'PocketGuard alternative',
            'PocketGuard competitor',
            'open-source PocketGuard alternative',
            'self-hosted PocketGuard alternative',
            'budget tracker alternative'
        ],
        metadataTitle: 'PocketGuard Alternative for Expense Tracking',
        name: 'PocketGuard',
        path: '/alternatives/pocketguard-alternative',
        priority: 0.63,
        slug: 'pocketguard-alternative',
        sourceLabel: 'PocketGuard',
        sourceUrl: 'https://pocketguard.com/',
        xpenserSummary:
            'xpenser is the practical alternative when the priority is owning finance records and connecting them to reports, APIs, MCP, and Telegram instead of safe-to-spend guidance.'
    },
    {
        audience:
            'People comparing EveryDollar alternatives, zero-based budget apps, and personal expense trackers.',
        comparisonRows: [
            {
                feature: 'Product focus',
                xpenser:
                    'Expense and income tracking with dashboards, categories, vendors, reports, source access, API keys, MCP, and Telegram workflows.',
                competitor:
                    'EveryDollar focuses on zero-based budgeting, monthly plans, transactions, paycheck planning, and Ramsey-style budgeting workflows.'
            },
            {
                feature: 'Deployment and ownership',
                xpenser: xpenserOwnership,
                competitor:
                    'EveryDollar is a hosted proprietary app rather than a self-hosted open-source finance tracker.'
            },
            {
                feature: 'Finance tracking model',
                xpenser: xpenserTracking,
                competitor:
                    'EveryDollar emphasizes assigning dollars to budget categories and following a monthly budget plan.'
            },
            {
                feature: 'Reports and visibility',
                xpenser: xpenserReports,
                competitor:
                    'EveryDollar is strongest for budget planning and keeping spending aligned to a plan.'
            },
            {
                feature: 'Developer and agent access',
                xpenser: xpenserAutomation,
                competitor:
                    'EveryDollar does not market itself around open-source APIs, MCP tools, or self-hosted automation.'
            }
        ],
        competitorSummary:
            'EveryDollar is a zero-based budgeting app for creating monthly plans, assigning income, tracking transactions, and following Ramsey budgeting workflows.',
        description:
            'Compare xpenser with EveryDollar for EveryDollar alternative searches, zero-based budget alternatives, open-source expense tracking, and self-hosted finance workflows.',
        eyebrow: 'EveryDollar alternative',
        h1: 'xpenser as an EveryDollar alternative',
        highlights: [
            'EveryDollar alternative',
            'Zero-based budget comparison',
            'Expense tracking workflow',
            'Self-hosted finance app'
        ],
        keywords: [
            'EveryDollar alternative',
            'EveryDollar competitor',
            'open-source EveryDollar alternative',
            'self-hosted EveryDollar alternative',
            'zero-based budget app alternative'
        ],
        metadataTitle: 'EveryDollar Alternative for Expense Tracking',
        name: 'EveryDollar',
        path: '/alternatives/everydollar-alternative',
        priority: 0.62,
        slug: 'everydollar-alternative',
        sourceLabel: 'EveryDollar',
        sourceUrl: 'https://www.ramseysolutions.com/ramseyplus/everydollar',
        xpenserSummary:
            'xpenser is a stronger match for people who want finance tracking, inspectable code, and integration surfaces rather than a prescriptive zero-based budgeting method.'
    },
    {
        audience:
            'Investors and households comparing Empower Personal Dashboard alternatives for net worth, cash flow, and finance visibility.',
        comparisonRows: [
            {
                feature: 'Product focus',
                xpenser:
                    'Personal finance tracking for transactions, dashboards, reports, multi-currency data, API keys, MCP, and Telegram workflows.',
                competitor:
                    'Empower Personal Dashboard focuses on net worth, spending, budgeting, cash flow, investments, and retirement planning tools.'
            },
            {
                feature: 'Deployment and ownership',
                xpenser: xpenserOwnership,
                competitor:
                    'Empower Personal Dashboard is a hosted proprietary financial dashboard.'
            },
            {
                feature: 'Finance tracking model',
                xpenser: xpenserTracking,
                competitor:
                    'Empower emphasizes account aggregation, investments, retirement planning, net worth, cash flow, and budget visibility.'
            },
            {
                feature: 'Reports and visibility',
                xpenser: xpenserReports,
                competitor:
                    'Empower is especially oriented around portfolio and retirement visibility alongside budgeting tools.'
            },
            {
                feature: 'Developer and agent access',
                xpenser: xpenserAutomation,
                competitor:
                    'Empower does not market itself as an open-source self-hosted expense tracker with MCP access.'
            }
        ],
        competitorSummary:
            'Empower Personal Dashboard is a financial dashboard for net worth, budgeting, spending, cash flow, investments, and retirement planning views.',
        description:
            'Compare xpenser with Empower Personal Dashboard for Empower alternative keywords, self-hosted finance tracking, open-source expense reports, and API workflows.',
        eyebrow: 'Empower alternative',
        h1: 'xpenser as an Empower Personal Dashboard alternative',
        highlights: [
            'Empower alternative',
            'Net worth dashboard comparison',
            'Open-source expense tracker',
            'API and MCP workflows'
        ],
        keywords: [
            'Empower Personal Dashboard alternative',
            'Empower alternative',
            'Personal Capital alternative',
            'open-source Empower alternative',
            'net worth dashboard alternative'
        ],
        metadataTitle: 'Empower Personal Dashboard Alternative',
        name: 'Empower Personal Dashboard',
        path: '/alternatives/empower-personal-dashboard-alternative',
        priority: 0.61,
        slug: 'empower-personal-dashboard-alternative',
        sourceLabel: 'Empower financial tools',
        sourceUrl: 'https://www.empower.com/personal-investors/financial-tools',
        xpenserSummary:
            'xpenser is a fit for people who want transaction ownership, self-hosted deployment, and programmable finance workflows rather than investment-advice oriented dashboards.'
    },
    {
        audience:
            'Spreadsheet users comparing Tiller Money alternatives for personal finance automation, transaction tracking, and custom reporting.',
        comparisonRows: [
            {
                feature: 'Product focus',
                xpenser:
                    'Web app finance tracking with structured forms, dashboards, reports, API, MCP, Telegram workflows, and source code access.',
                competitor:
                    'Tiller Money focuses on automated bank feeds into Google Sheets or Excel with templates and spreadsheet-based customization.'
            },
            {
                feature: 'Deployment and ownership',
                xpenser: xpenserOwnership,
                competitor:
                    'Tiller is a hosted data-feed and spreadsheet workflow, not a self-hosted application codebase.'
            },
            {
                feature: 'Finance tracking model',
                xpenser: xpenserTracking,
                competitor:
                    'Tiller keeps finance data in spreadsheets, where users customize templates, formulas, categories, and reports.'
            },
            {
                feature: 'Reports and visibility',
                xpenser: xpenserReports,
                competitor:
                    'Tiller reporting depends on spreadsheet templates and user-customized sheets.'
            },
            {
                feature: 'Developer and agent access',
                xpenser: xpenserAutomation,
                competitor:
                    'Tiller is programmable through spreadsheets, while xpenser exposes app-level API, MCP, and source-code surfaces.'
            }
        ],
        competitorSummary:
            'Tiller Money automates financial data into Google Sheets and Microsoft Excel so users can customize budgets, categories, and reports in spreadsheets.',
        description:
            'Compare xpenser with Tiller Money for Tiller alternative searches, open-source personal finance tracking, self-hosted expense reports, and API-first workflows.',
        eyebrow: 'Tiller Money alternative',
        h1: 'xpenser as a Tiller Money alternative',
        highlights: [
            'Tiller Money alternative',
            'Spreadsheet finance comparison',
            'Structured web app',
            'OpenAPI and MCP access'
        ],
        keywords: [
            'Tiller Money alternative',
            'Tiller alternative',
            'open-source Tiller alternative',
            'self-hosted Tiller Money alternative',
            'spreadsheet finance alternative'
        ],
        metadataTitle: 'Tiller Money Alternative for Finance Tracking',
        name: 'Tiller Money',
        path: '/alternatives/tiller-money-alternative',
        priority: 0.6,
        slug: 'tiller-money-alternative',
        sourceLabel: 'Tiller Money',
        sourceUrl: 'https://www.tillerhq.com/',
        xpenserSummary:
            'xpenser fits users who want a finance app with structured screens, API access, and self-hosting instead of keeping the primary workflow inside spreadsheets.'
    },
    {
        audience:
            'Power users comparing Lunch Money alternatives for personal finance tracking, multi-currency records, rules, and APIs.',
        comparisonRows: [
            {
                feature: 'Product focus',
                xpenser:
                    'Open-source tracking with dashboards, vendors, categories, reports, multi-currency support, API keys, MCP, and Telegram workflows.',
                competitor:
                    'Lunch Money focuses on budgeting, categories, rules, recurring items, multi-currency support, net worth, and a developer API.'
            },
            {
                feature: 'Deployment and ownership',
                xpenser: xpenserOwnership,
                competitor:
                    'Lunch Money is a hosted subscription app, not a self-hosted open-source deployment.'
            },
            {
                feature: 'Finance tracking model',
                xpenser: xpenserTracking,
                competitor:
                    'Lunch Money emphasizes transactions, categories, rules, recurring expenses, budgets, crypto and multi-currency tracking, and net worth.'
            },
            {
                feature: 'Reports and visibility',
                xpenser: xpenserReports,
                competitor:
                    'Lunch Money provides hosted personal finance reporting around spending, budgets, net worth, and categorized transactions.'
            },
            {
                feature: 'Developer and agent access',
                xpenser: xpenserAutomation,
                competitor:
                    'Lunch Money offers an API; xpenser pairs API access with MCP tooling and source-code ownership.'
            }
        ],
        competitorSummary:
            'Lunch Money is a hosted personal finance app with budgeting, transactions, categories, rules, recurring items, multi-currency support, and developer API access.',
        description:
            'Compare xpenser with Lunch Money for Lunch Money alternative keywords, open-source finance tracking, self-hosted expense reports, MCP tools, and API workflows.',
        eyebrow: 'Lunch Money alternative',
        h1: 'xpenser as a Lunch Money alternative',
        highlights: [
            'Lunch Money alternative',
            'Multi-currency tracker',
            'Open-source workflow',
            'API and MCP access'
        ],
        keywords: [
            'Lunch Money alternative',
            'Lunch Money competitor',
            'open-source Lunch Money alternative',
            'self-hosted Lunch Money alternative',
            'personal finance API alternative'
        ],
        metadataTitle: 'Lunch Money Alternative for Finance Tracking',
        name: 'Lunch Money',
        path: '/alternatives/lunch-money-alternative',
        priority: 0.59,
        slug: 'lunch-money-alternative',
        sourceLabel: 'Lunch Money',
        sourceUrl: 'https://lunchmoney.app/',
        xpenserSummary:
            'xpenser is most relevant when the comparison includes self-hosting, inspectable source, Telegram workflows, and MCP access alongside API-based finance records.'
    },
    {
        audience:
            'Open-source users comparing Actual Budget alternatives for self-hosted budgeting, local-first finance data, and programmable workflows.',
        comparisonRows: [
            {
                feature: 'Product focus',
                xpenser:
                    'Open-source personal finance tracking with dashboards, transactions, reports, multi-currency support, API keys, MCP, and Telegram workflows.',
                competitor:
                    'Actual Budget focuses on local-first budgeting, syncing, envelope-style budget workflows, and open-source personal finance management.'
            },
            {
                feature: 'Deployment and ownership',
                xpenser: xpenserOwnership,
                competitor:
                    'Actual Budget is also open source and self-hostable, with a stronger emphasis on local-first budgeting.'
            },
            {
                feature: 'Finance tracking model',
                xpenser: xpenserTracking,
                competitor:
                    'Actual Budget emphasizes budgeting categories, account balances, transactions, reconciliation, and budget method workflows.'
            },
            {
                feature: 'Reports and visibility',
                xpenser: xpenserReports,
                competitor:
                    'Actual Budget is centered on budgeting workflows and account data, with reporting shaped around that model.'
            },
            {
                feature: 'Developer and agent access',
                xpenser: xpenserAutomation,
                competitor:
                    'Actual Budget has developer-oriented open-source extensibility; xpenser adds MCP and Telegram as first-class product surfaces.'
            }
        ],
        competitorSummary:
            'Actual Budget is an open-source, local-first budgeting app with self-hosting, syncing, transactions, accounts, and budget workflows.',
        description:
            'Compare xpenser with Actual Budget for Actual Budget alternative searches, open-source finance tracking, self-hosted expense reports, API access, MCP tools, and Telegram workflows.',
        eyebrow: 'Actual Budget alternative',
        h1: 'xpenser as an Actual Budget alternative',
        highlights: [
            'Actual Budget alternative',
            'Open-source comparison',
            'Self-hosted expense tracker',
            'MCP and Telegram workflows'
        ],
        keywords: [
            'Actual Budget alternative',
            'Actual Budget competitor',
            'open-source Actual Budget alternative',
            'self-hosted Actual Budget alternative',
            'local-first budget alternative'
        ],
        metadataTitle: 'Actual Budget Alternative for Expense Tracking',
        name: 'Actual Budget',
        path: '/alternatives/actual-budget-alternative',
        priority: 0.58,
        slug: 'actual-budget-alternative',
        sourceLabel: 'Actual Budget',
        sourceUrl: 'https://actualbudget.org/',
        xpenserSummary:
            'xpenser is a stronger fit for people who want expense tracking, reports, API keys, MCP tools, and Telegram capture, while Actual Budget is strongest for local-first budgeting.'
    },
    {
        audience:
            'Self-hosters comparing Firefly III alternatives for open-source personal finance management, transaction tracking, and API-driven workflows.',
        comparisonRows: [
            {
                feature: 'Product focus',
                xpenser:
                    'Open-source finance tracking with a smaller app surface, dashboards, categories, vendors, multi-currency reports, API, MCP, and Telegram workflows.',
                competitor:
                    'Firefly III is a mature self-hosted personal finance manager for accounts, budgets, bills, rules, transactions, reports, and imports.'
            },
            {
                feature: 'Deployment and ownership',
                xpenser: xpenserOwnership,
                competitor:
                    'Firefly III is also open source and self-hostable, with a broad feature set for detailed personal finance administration.'
            },
            {
                feature: 'Finance tracking model',
                xpenser: xpenserTracking,
                competitor:
                    'Firefly III covers accounts, transactions, budgets, bills, rules, piggy banks, categories, tags, imports, and reporting.'
            },
            {
                feature: 'Reports and visibility',
                xpenser: xpenserReports,
                competitor:
                    'Firefly III offers mature reports and finance-management views across its larger self-hosted feature set.'
            },
            {
                feature: 'Developer and agent access',
                xpenser: xpenserAutomation,
                competitor:
                    'Firefly III provides API-oriented self-hosted tooling; xpenser adds MCP and Telegram workflows in a smaller reference app.'
            }
        ],
        competitorSummary:
            'Firefly III is an open-source self-hosted personal finance manager with accounts, transactions, budgets, bills, rules, categories, tags, imports, reports, and API tooling.',
        description:
            'Compare xpenser with Firefly III for Firefly III alternative keywords, self-hosted finance tracking, open-source expense reports, MCP tools, Telegram capture, and API workflows.',
        eyebrow: 'Firefly III alternative',
        h1: 'xpenser as a Firefly III alternative',
        highlights: [
            'Firefly III alternative',
            'Self-hosted finance comparison',
            'Open-source expense tracker',
            'MCP and Telegram access'
        ],
        keywords: [
            'Firefly III alternative',
            'Firefly III competitor',
            'open-source Firefly III alternative',
            'self-hosted Firefly III alternative',
            'personal finance manager alternative'
        ],
        metadataTitle: 'Firefly III Alternative for Finance Tracking',
        name: 'Firefly III',
        path: '/alternatives/firefly-iii-alternative',
        priority: 0.57,
        slug: 'firefly-iii-alternative',
        sourceLabel: 'Firefly III',
        sourceUrl: 'https://www.firefly-iii.org/',
        xpenserSummary:
            'xpenser is worth comparing when a smaller TypeScript reference app, OpenAPI, MCP, and Telegram workflows are more important than Firefly III breadth.'
    }
] as const satisfies readonly AlternativeProduct[];

export const alternativeSitemapPages = [
    alternativesIndexPage,
    ...alternativeProducts
] as const;

export function getAlternativeProduct(slug: string): AlternativeProduct | null {
    return alternativeProducts.find(product => product.slug === slug) ?? null;
}
