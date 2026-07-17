import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';

export const blogMdxOptions: NonNullable<MDXRemoteProps['options']> = {
    mdxOptions: {
        remarkPlugins: [remarkGfm]
    }
};
