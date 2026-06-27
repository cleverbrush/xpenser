/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardSwipeArea } from './dashboard-swipe-area';

const router = {
    prefetch: vi.fn(),
    push: vi.fn()
};
type SwipeNavigation = {
    readonly date: string;
    readonly direction: -1 | 1;
    readonly href: string;
};

vi.mock('next/navigation', () => ({
    useRouter: () => router
}));

function renderSwipeArea({
    date = '2026-05-10',
    extraQueryParams,
    onNavigate = vi.fn()
}: {
    readonly date?: string;
    readonly extraQueryParams?: Readonly<Record<string, string>>;
    readonly onNavigate?: (selection: SwipeNavigation) => void;
} = {}) {
    render(
        <DashboardSwipeArea
            basePath="/dashboard"
            className="min-h-64"
            date={date}
            extraQueryParams={extraQueryParams}
            onNavigate={onNavigate}
            period="day"
            timezone="UTC"
        >
            <div>Current report</div>
        </DashboardSwipeArea>
    );

    const swipeArea = screen.getByTestId('dashboard-swipe-area');

    Object.defineProperty(swipeArea, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
            bottom: 256,
            height: 256,
            left: 0,
            right: 400,
            top: 0,
            width: 400,
            x: 0,
            y: 0,
            toJSON: () => undefined
        })
    });

    return {
        onNavigate,
        swipeArea
    };
}

describe('DashboardSwipeArea', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        router.prefetch.mockClear();
        router.push.mockClear();
        HTMLElement.prototype.setPointerCapture = vi.fn();
        HTMLElement.prototype.releasePointerCapture = vi.fn();
        HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('applies custom layout classes to the root swipe target', () => {
        const { swipeArea } = renderSwipeArea();

        expect(swipeArea.className).toContain('min-h-64');
        expect(swipeArea.className).toContain('touch-pan-y');
    });

    it('navigates when a horizontal swipe starts on the root empty area', () => {
        const { onNavigate, swipeArea } = renderSwipeArea();

        fireEvent.pointerDown(swipeArea, {
            clientX: 240,
            clientY: 220,
            pointerId: 1
        });
        fireEvent.pointerMove(swipeArea, {
            clientX: 360,
            clientY: 224,
            pointerId: 1
        });
        fireEvent.pointerUp(swipeArea, {
            clientX: 360,
            clientY: 224,
            pointerId: 1
        });

        act(() => {
            vi.advanceTimersByTime(180);
        });

        expect(onNavigate).toHaveBeenCalledWith({
            date: '2026-05-09',
            direction: 1,
            href: '/dashboard?period=day&date=2026-05-09'
        });
    });

    it('preserves extra query params while navigating by swipe', () => {
        const { onNavigate, swipeArea } = renderSwipeArea({
            extraQueryParams: { currency: 'EUR' }
        });

        fireEvent.pointerDown(swipeArea, {
            clientX: 240,
            clientY: 220,
            pointerId: 1
        });
        fireEvent.pointerMove(swipeArea, {
            clientX: 360,
            clientY: 224,
            pointerId: 1
        });
        fireEvent.pointerUp(swipeArea, {
            clientX: 360,
            clientY: 224,
            pointerId: 1
        });

        act(() => {
            vi.advanceTimersByTime(180);
        });

        expect(onNavigate).toHaveBeenCalledWith({
            date: '2026-05-09',
            direction: 1,
            href: '/dashboard?currency=EUR&period=day&date=2026-05-09'
        });
    });

    it('does not navigate for short horizontal drags', () => {
        const { onNavigate, swipeArea } = renderSwipeArea();

        fireEvent.pointerDown(swipeArea, {
            clientX: 240,
            clientY: 220,
            pointerId: 1
        });
        fireEvent.pointerMove(swipeArea, {
            clientX: 300,
            clientY: 222,
            pointerId: 1
        });
        fireEvent.pointerUp(swipeArea, {
            clientX: 300,
            clientY: 222,
            pointerId: 1
        });

        act(() => {
            vi.advanceTimersByTime(180);
        });

        expect(onNavigate).not.toHaveBeenCalled();
    });
});
