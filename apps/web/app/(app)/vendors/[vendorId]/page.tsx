import { redirect } from 'next/navigation';

type VendorPageParams = {
    readonly vendorId: string;
};

export default async function VendorPage({
    params
}: {
    readonly params: Promise<VendorPageParams>;
}) {
    const { vendorId } = await params;
    redirect(`/settings/vendors/${vendorId}`);
}
