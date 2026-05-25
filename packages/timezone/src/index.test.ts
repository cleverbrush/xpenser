import { describe, expect, it } from 'vitest';
import {
    dateToLocalDateTimeInput,
    localDateParamToDate,
    localDateTimeInputToDate
} from './index.js';

describe('timezone helpers', () => {
    it('converts local date-times to instants in the selected timezone', () => {
        expect(
            localDateTimeInputToDate('2026-05-10T09:30', 'America/New_York')
        ).toEqual(new Date('2026-05-10T13:30:00.000Z'));
    });

    it('formats instants as local datetime input values', () => {
        expect(
            dateToLocalDateTimeInput(
                new Date('2026-05-10T13:30:00.000Z'),
                'America/New_York'
            )
        ).toBe('2026-05-10T09:30');
    });

    it('uses local day boundaries for date params', () => {
        expect(
            localDateParamToDate('2026-05-10', 'America/Los_Angeles', 'start')
        ).toEqual(new Date('2026-05-10T07:00:00.000Z'));
        expect(
            localDateParamToDate('2026-05-10', 'America/Los_Angeles', 'end')
        ).toEqual(new Date('2026-05-11T06:59:59.999Z'));
    });
});
