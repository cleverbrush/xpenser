'use client';

import { Fragment, type ReactNode, useState } from 'react';
import type {
    ReportCategoryNode,
    ReportCategoryTreeCategory
} from '@/lib/report-category-tree';

type ParentRenderProps<T extends ReportCategoryTreeCategory> = {
    readonly expanded: boolean;
    readonly expandable: boolean;
    readonly node: ReportCategoryNode<T>;
    readonly onToggle: () => void;
};

type ChildRenderProps<T extends ReportCategoryTreeCategory> = {
    readonly child: T;
    readonly parent: T;
};

export function reportCategoryKey(
    category: Pick<ReportCategoryTreeCategory, 'categoryId' | 'type'>
): string {
    return `${category.type}:${category.categoryId}`;
}

export function CollapsibleReportCategoryGroup<
    T extends ReportCategoryTreeCategory
>({
    childrenClassName = 'border-t',
    className = 'flex flex-col divide-y',
    empty,
    itemClassName = 'flex flex-col',
    nodes,
    renderChild,
    renderParent
}: {
    readonly childrenClassName?: string;
    readonly className?: string;
    readonly empty: ReactNode;
    readonly itemClassName?: string;
    readonly nodes: readonly ReportCategoryNode<T>[];
    readonly renderChild: (props: ChildRenderProps<T>) => ReactNode;
    readonly renderParent: (props: ParentRenderProps<T>) => ReactNode;
}) {
    const [expandedCategories, setExpandedCategories] = useState<
        ReadonlySet<string>
    >(new Set());

    function toggleCategory(categoryKey: string) {
        setExpandedCategories(current => {
            const next = new Set(current);
            if (next.has(categoryKey)) {
                next.delete(categoryKey);
            } else {
                next.add(categoryKey);
            }
            return next;
        });
    }

    return (
        <div className={className}>
            {nodes.length === 0
                ? empty
                : nodes.map(node => {
                      const hasChildren = node.children.length > 0;
                      const categoryKey = reportCategoryKey(node.category);
                      const expanded = expandedCategories.has(categoryKey);

                      return (
                          <div className={itemClassName} key={categoryKey}>
                              {renderParent({
                                  expanded,
                                  expandable: hasChildren,
                                  node,
                                  onToggle: () => toggleCategory(categoryKey)
                              })}
                              {hasChildren && expanded ? (
                                  <div className={childrenClassName}>
                                      {node.children.map(child => (
                                          <Fragment
                                              key={`${reportCategoryKey(child)}:${child.categoryParentId ?? 'self'}`}
                                          >
                                              {renderChild({
                                                  child,
                                                  parent: node.category
                                              })}
                                          </Fragment>
                                      ))}
                                  </div>
                              ) : null}
                          </div>
                      );
                  })}
        </div>
    );
}
