import { describe, expect, it } from 'vitest';
import { datatypeExpression, datatypePieExpression } from './datatype-chart';

describe('Datatype chart expressions', () => {
    it('normalizes trend chart values relative to the maximum value', () => {
        expect(datatypeExpression('l', [10, 20, 40])).toBe('{l:25,50,100}');
    });

    it('formats absolute pie chart percentages for Datatype', () => {
        expect(datatypePieExpression(73.4)).toBe('{p:73}');
        expect(datatypePieExpression(73.5)).toBe('{p:74}');
    });

    it('clamps pie chart percentages to Datatype range', () => {
        expect(datatypePieExpression(-12)).toBe('{p:0}');
        expect(datatypePieExpression(125)).toBe('{p:100}');
        expect(datatypePieExpression(Number.NaN)).toBe('{p:0}');
    });
});
