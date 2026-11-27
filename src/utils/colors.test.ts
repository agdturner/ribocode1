/**
 * Test suite for getColourTheme utility.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.1
 * @lastModified 2026-11-27
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { vi } from 'vitest';
import { Color } from 'molstar/lib/mol-util/color';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { createChainColorTheme, createResidueTypeColorTheme, getColourTheme, inferColorThemeKind, parseColorFileContent } from './colors';

describe('getColourTheme', () => {
    let originalWarn: any;
    beforeAll(() => {
        originalWarn = console.warn;
        console.warn = vi.fn();
    });
    afterAll(() => {
        console.warn = originalWarn;
    });

    it('returns a color theme with valid colors', () => {
        const theme = getColourTheme('test-theme', [
            { pdb_chain: 'A', color: '#FF0000' },
            { pdb_chain: 'B', color: '#00FF00' }
        ]);
        expect(theme).toBeDefined();
        expect(theme.name).toBe('test-theme');
        expect(theme.params).toBeDefined();
        expect(theme.params.palette).toBeDefined();
        expect(Array.isArray(theme.params.palette.params.colors)).toBe(true);
        expect(theme.params.palette.params.colors.length).toBe(2);
    });

    it('warns and skips invalid colors', () => {
        getColourTheme('invalid-theme', [
            { pdb_chain: 'A', color: 'not-a-color' },
            { pdb_chain: 'B', color: '#00FF00' }
        ]);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid color for asym_id A'));
    });

    it('returns cached theme if called with same name', () => {
        const theme1 = getColourTheme('cached-theme', [
            { pdb_chain: 'A', color: '#FF0000' }
        ]);
        const theme2 = getColourTheme('cached-theme', [
            { pdb_chain: 'A', color: '#00FF00' }
        ]);
        expect(theme1).toBe(theme2);
    });
});

describe('createChainColorTheme', () => {
    function makeLocation(authAsymId: string, labelAsymId: string, element = 0): any {
        return {
            unit: {
                kind: 0,
                model: {
                    atomicHierarchy: {
                        chainAtomSegments: { index: [0] },
                        chains: {
                            auth_asym_id: { value: (_idx: number) => authAsymId },
                            label_asym_id: { value: (_idx: number) => labelAsymId },
                        },
                    },
                },
            },
            element,
        };
    }

    it('prefers auth_asym_id when matching chain colors', () => {
        const themeName = 'auth-first-theme';
        const chainColorMap = new Map<string, Color>([['LY', Color.fromHexStyle('#3366FF')]]);
        const theme = createChainColorTheme(themeName, chainColorMap);
        const colorFn = theme.factory({} as any, {}).color;

        const location = makeLocation('LY', 'A');
        const color = colorFn(location);

        expect(color).toBe(Color.fromHexStyle('#3366FF'));
    });

    it('matches normalized chain IDs (trimmed and case-insensitive)', () => {
        const themeName = 'normalized-ids-theme';
        const chainColorMap = new Map<string, Color>([[' ly ', Color.fromHexStyle('#FF8800')]]);
        const theme = createChainColorTheme(themeName, chainColorMap);
        const colorFn = theme.factory({} as any, {}).color;

        const location = makeLocation('LY', 'A');
        const color = colorFn(location);

        expect(color).toBe(Color.fromHexStyle('#FF8800'));
    });
});

describe('createResidueTypeColorTheme', () => {
    it('retains refresh and theme-kind params through Molstar normalization and theme creation', () => {
        const provider = createResidueTypeColorTheme('residue-theme', new Map([['ALA', Color(0x8CFF8C)]]));
        const firstProps = PD.normalizeParams(provider.getParams(), {
            __ribocodeThemeRefreshNonce: 'first',
            __ribocodeActiveThemeKind: 'residue-type',
        }, 'all');
        const secondProps = PD.normalizeParams(provider.getParams(), {
            __ribocodeThemeRefreshNonce: 'second',
            __ribocodeActiveThemeKind: 'residue-type',
        }, 'all');
        const first = provider.factory({}, firstProps);
        const second = provider.factory({}, secondProps);

        expect(first.props).toEqual(firstProps);
        expect(first.props.__ribocodeThemeRefreshNonce).toBe('first');
        expect(first.props.__ribocodeActiveThemeKind).toBe('residue-type');
        expect(second.props).not.toEqual(first.props);
        expect(provider.defaultValues.__ribocodeActiveThemeKind).toBe('residue-type');
    });
});

describe('parseColorFileContent', () => {
    it('parses simple chain colour file with header', async () => {
        const content = [
            'chain,color',
            'LY,#3366FF',
            'e,#FF8800',
        ].join('\n');
        const file = new File([content], 'chain-theme.csv', { type: 'text/csv' });

        const parsed = await parseColorFileContent(content, file);

        expect(parsed).toEqual([
            { pdb_chain: 'LY', color: '#3366FF' },
            { pdb_chain: 'e', color: '#FF8800' },
        ]);
        expect(inferColorThemeKind(parsed)).toBe('chain');
    });

    it('parses simple residue-type colour file with header', async () => {
        const content = [
            'residue_type color',
            'ALA #8CFF8C',
            'LYS #4747B8',
            'G #32CD32',
        ].join('\n');
        const file = new File([content], 'residue-theme.txt', { type: 'text/plain' });

        const parsed = await parseColorFileContent(content, file);

        expect(parsed).toEqual([
            { residue_type: 'ALA', color: '#8CFF8C' },
            { residue_type: 'LYS', color: '#4747B8' },
            { residue_type: 'G', color: '#32CD32' },
        ]);
        expect(inferColorThemeKind(parsed)).toBe('residue-type');
    });

    it('returns empty rows for unsupported legacy multi-column layout', async () => {
        const content = [
            'pdb_name RP_name class color',
            '4ug0_LY RPL26 1 #3366FF',
        ].join('\n');
        const file = new File([content], 'mapping_with_colour_animal.txt', { type: 'text/plain' });

        const parsed = await parseColorFileContent(content, file);

        expect(parsed).toEqual([]);
        expect(inferColorThemeKind(parsed)).toBeNull();
    });
});
