import Script from 'next/script';

export function GoogleTagManager({ gtmId }: { readonly gtmId: string }) {
    const scriptUrl = new URL('https://www.googletagmanager.com/gtm.js');
    scriptUrl.searchParams.set('id', gtmId);

    return (
        <>
            <Script id="_next-gtm-init" strategy="afterInteractive">
                {`(function(w,l){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});})(window,'dataLayer');`}
            </Script>
            <Script
                data-ntpc="GTM"
                id="_next-gtm"
                src={scriptUrl.href}
                strategy="afterInteractive"
            />
        </>
    );
}
