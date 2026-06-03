import { redirect } from 'next/navigation';

type MerchantPageParams = {
    readonly merchantId: string;
};

export default async function LegacyMerchantPage({
    params
}: {
    readonly params: Promise<MerchantPageParams>;
}) {
    const { merchantId } = await params;
    redirect(`/settings/merchants/${merchantId}`);
}
