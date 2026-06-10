import type { Metadata } from 'next';
import { noIndexRobots } from '@/lib/public-site';

export const metadata: Metadata = {
    robots: noIndexRobots
};

export default function AuthLayout({
    children
}: {
    readonly children: React.ReactNode;
}) {
    return children;
}
