
/**
 * Color utility functions for Ribocode, including reading color data from files, saving and loading color themes, and creating custom color themes for chains.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.1
 * @lastModified 2026-11-27
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { Color } from 'molstar/lib/mol-util/color';
import { Unit, StructureElement, Bond } from 'molstar/lib/mol-model/structure';
import { ThemeDataContext } from 'molstar/lib/mol-theme/theme';
//import { ColorType } from 'molstar/lib/mol-geo/geometry/color-data';
import { ColorTheme } from 'molstar/lib/mol-theme/color';
import { ChainIdColorThemeParams } from 'molstar/lib/mol-theme/color/chain-id';
import { ChainIdColorTheme, ChainIdColorThemeProvider } from 'molstar/lib/mol-theme/color/chain-id';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';

// Define a type for the data structure
export type Data = Record<string, string>;
export type ParsedColorThemeKind = 'chain' | 'residue-type';

const CHAIN_KEYS = new Set(['chain', 'chain_id', 'pdb_chain', 'auth_asym_id', 'label_asym_id', 'asym_id']);
const RESIDUE_KEYS = new Set(['residue_type', 'residue', 'residue_name', 'comp_id', 'label_comp_id']);
const COLOR_KEYS = new Set(['color', 'colour']);
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeKeyToken(token: string): string {
    return token.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function isValidHexColor(value: string): boolean {
    return HEX_COLOR_PATTERN.test(value.trim());
}

function normalizeHexColor(value: string): string {
    return value.trim().toUpperCase();
}

function splitLineByDelimiter(line: string, delimiter: 'comma' | 'tab' | 'whitespace'): string[] {
    if (delimiter === 'comma') {
        return line.split(',').map(part => part.trim());
    }
    if (delimiter === 'tab') {
        return line.split('\t').map(part => part.trim());
    }
    return line.split(/\s+/).map(part => part.trim());
}

function detectDelimiter(line: string): 'comma' | 'tab' | 'whitespace' {
    if (line.includes(',')) return 'comma';
    if (line.includes('\t')) return 'tab';
    return 'whitespace';
}

function normalizeThemeKey(value: string, kind: ParsedColorThemeKind): string {
    const trimmed = value.trim();
    return kind === 'residue-type' ? trimmed.toUpperCase() : trimmed;
}

function parseDelimitedColorRows(text: string, fileName: string): Data[] {
    const rawLines = text
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));

    if (rawLines.length === 0) return [];

    const delimiter = detectDelimiter(rawLines[0]);
    const firstTokens = splitLineByDelimiter(rawLines[0], delimiter).filter(Boolean);
    const normalizedHeader = firstTokens.map(normalizeKeyToken);

    const chainIdx = normalizedHeader.findIndex(token => CHAIN_KEYS.has(token));
    const residueIdx = normalizedHeader.findIndex(token => RESIDUE_KEYS.has(token));
    const colorIdx = normalizedHeader.findIndex(token => COLOR_KEYS.has(token));
    const hasHeader = colorIdx >= 0 && (chainIdx >= 0 || residueIdx >= 0);

    let kind: ParsedColorThemeKind = residueIdx >= 0 ? 'residue-type' : 'chain';
    let keyColumnIndex = kind === 'residue-type' ? residueIdx : chainIdx;
    let startLineIndex = 0;

    if (hasHeader) {
        startLineIndex = 1;
    } else {
        const normalizedName = fileName.toLowerCase();
        kind = normalizedName.includes('residue') ? 'residue-type' : 'chain';
        keyColumnIndex = 0;
    }

    const resolvedColorColumnIndex = hasHeader ? colorIdx : 1;
    if (keyColumnIndex < 0 || resolvedColorColumnIndex < 0) return [];

    const rows: Data[] = [];
    for (let i = startLineIndex; i < rawLines.length; i++) {
        const parts = splitLineByDelimiter(rawLines[i], delimiter).filter(Boolean);
        if (parts.length <= Math.max(keyColumnIndex, resolvedColorColumnIndex)) continue;
        const key = normalizeThemeKey(parts[keyColumnIndex], kind);
        const color = normalizeHexColor(parts[resolvedColorColumnIndex]);
        if (!key || !isValidHexColor(color)) continue;

        if (kind === 'chain') {
            rows.push({ pdb_chain: key, color });
        } else {
            rows.push({ residue_type: key, color });
        }
    }
    return rows;
}

function parseJsonColorRows(text: string): Data[] {
    const data = JSON.parse(text);
    const rows: Data[] = [];

    const pushRow = (kind: ParsedColorThemeKind, key: string, color: string) => {
        const normalizedKey = normalizeThemeKey(String(key ?? ''), kind);
        const normalizedColor = normalizeHexColor(String(color ?? ''));
        if (!normalizedKey || !isValidHexColor(normalizedColor)) return;
        if (kind === 'chain') rows.push({ pdb_chain: normalizedKey, color: normalizedColor });
        else rows.push({ residue_type: normalizedKey, color: normalizedColor });
    };

    if (Array.isArray(data)) {
        data.forEach((item: any) => {
            if (!item || typeof item !== 'object') return;
            const color = item.color ?? item.colour;
            if (!color) return;
            const residue = item.residue_type ?? item.residue ?? item.residue_name ?? item.comp_id ?? item.label_comp_id;
            if (residue) {
                pushRow('residue-type', residue, color);
                return;
            }
            const chain = item.pdb_chain ?? item.chain ?? item.chain_id ?? item.auth_asym_id ?? item.label_asym_id ?? item.asym_id;
            if (chain) {
                pushRow('chain', chain, color);
            }
        });
        return rows;
    }

    if (data && typeof data === 'object') {
        Object.entries(data).forEach(([key, color]) => {
            pushRow('chain', key, String(color));
        });
    }
    return rows;
}

export function inferColorThemeKind(rows: Array<Record<string, string>>): ParsedColorThemeKind | null {
    if (!rows.length) return null;
    let chainCount = 0;
    let residueCount = 0;
    rows.forEach((row) => {
        if (typeof row.pdb_chain === 'string' && row.pdb_chain.trim()) chainCount += 1;
        if (typeof row.residue_type === 'string' && row.residue_type.trim()) residueCount += 1;
    });
    if (!chainCount && !residueCount) return null;
    return residueCount > chainCount ? 'residue-type' : 'chain';
}

/**
 * Read a JSON file and return a promise that resolves to a Map object.
 * @param file A JSON file with the following format:
 * {pdb_chain: color} where:
 * pdb_chain is the name of the PDB chain (e.g. 4ug0_LY)
 * color is a hex color code (e.g. #FF0000)
 */
export async function readJSONFile(file: File): Promise<Data[]> {
    const text = await file.text();
    return parseJsonColorRows(text);
}

/**
 * Reads a text file and return a promise that resolves to an array of Data objects.
 * @param file A space or tab separated text file with a header line and lines of 
 * data in the following format:
 * pdb_name RP_name class color
 * pdb_name contains the label of a molecule and identifier for a PDB chain separated
 * by "_" (e.g. 4ug0_LY)
 * RP_name is the name of the ribosomal protein (e.g. RPL26)
 * class is an integer representing the color class (e.g. 1) - this is ignored for now
 * color is a hex color code (e.g. #FF0000)
 */
export async function readFile(file: File): Promise<Data[]> {
    const text = await file.text();
    return parseDelimitedColorRows(text, file.name);
}

/**
 * Save the given ChainIdColorThemeParams as a JSON file.
 * @param themeParams The ChainIdColorThemeParams to save.
 */
export function saveColorTheme(themeParams: ChainIdColorThemeParams) {
    const output = {
        params: themeParams
    };
    const jsonString = JSON.stringify(output, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'color_theme.json';
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Load ChainIdColorThemeParams from a JSON file.
 * @param file The JSON file to load.
 * @return A promise that resolves to the ChainIdColorThemeParams.
 */
export function loadColorTheme(file: File): Promise<ChainIdColorThemeParams> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const json = JSON.parse(text);
            resolve(json.params);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
}

/**
 * Parses the content of a color file based on its extension.
 * @param text The content of the file as text.
 * @param file The file to be parsed.
 * @returns Promise resolving to an array of Data objects.
 */
export async function parseColorFileContent(text: string, file: File): Promise<Data[]> {
    const sourceText = text && text.trim().length > 0 ? text : await file.text();
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'json') {
        return parseJsonColorRows(sourceText);
    } else {
        return parseDelimitedColorRows(sourceText, file.name);
    }
}

// Module-level cache for named color themes
const colorThemeCache = new Map<string, any>();

/**
 * Creates or retrieves a named colorTheme from colors.
 * @param themeName Unique name for the color theme.
 * @param colors Array of objects with 'pdb_chain' and 'color' properties.
 * @returns A colorTheme object.
 */
export function getColourTheme(
    themeName: string,
    colors: Array<Record<string, string>>
) {
    if (colorThemeCache.has(themeName)) {
        return colorThemeCache.get(themeName);
    }

    const colorMap = new Map<string, string>();
    let data: Data[] = colors.map(row => ({
        pdb_chain: row['pdb_chain'],
        color: row['color']
    }));
    data.forEach(x => colorMap.set(x.pdb_chain, x.color));
    const colorList = Array.from(colorMap.entries())
        .map(([asym_id, color]) => {
            const colorObj = Color.fromHexStyle(color);
            if (!colorObj) {
                console.warn(`Invalid color for asym_id ${asym_id}: ${color}`);
                return null;
            }
            return { asym_id, color: colorObj };
        })
        .filter((item): item is { asym_id: string, color: Color } => item !== null);

    const colorsArray = colorList.map(item => item.color);
    const ct = {
        name: themeName,
        params: {
            asymId: 'auth',
            palette: {
                name: 'colors',
                params: {
                    colors: colorsArray,
                }
            }
        }
    };
    colorThemeCache.set(themeName, ct);
    return ct;
}

/**
 * Creates a custom chain color theme based on a provided color map.
 * @param chainColorMap A map where keys are chain identifiers and values are Color objects.
 * @returns A ColorTheme object that colors chains according to the provided map.
 */
export function createChainColorTheme(
    themeName: string,
    chainColorMap: Map<string, Color>) {
    const normalizeChainId = (value: unknown): string => String(value ?? '').trim();
    const normalizedChainColorMap = new Map<string, Color>();
    chainColorMap.forEach((color, key) => {
        const trimmed = normalizeChainId(key);
        if (!trimmed) return;
        if (!normalizedChainColorMap.has(trimmed)) normalizedChainColorMap.set(trimmed, color);
        const upper = trimmed.toUpperCase();
        if (!normalizedChainColorMap.has(upper)) normalizedChainColorMap.set(upper, color);
        const lower = trimmed.toLowerCase();
        if (!normalizedChainColorMap.has(lower)) normalizedChainColorMap.set(lower, color);
    });

    const resolveChainColor = (authAsymId: string, labelAsymId: string): Color | undefined => {
        const candidates = [normalizeChainId(authAsymId), normalizeChainId(labelAsymId)].filter(Boolean);
        for (const candidate of candidates) {
            if (chainColorMap.has(candidate)) return chainColorMap.get(candidate);
            if (normalizedChainColorMap.has(candidate)) return normalizedChainColorMap.get(candidate);
            const upper = candidate.toUpperCase();
            if (chainColorMap.has(upper)) return chainColorMap.get(upper);
            if (normalizedChainColorMap.has(upper)) return normalizedChainColorMap.get(upper);
            const lower = candidate.toLowerCase();
            if (chainColorMap.has(lower)) return chainColorMap.get(lower);
            if (normalizedChainColorMap.has(lower)) return normalizedChainColorMap.get(lower);
        }
        return undefined;
    };

    const theme = (ctx: ThemeDataContext, props: {}) => {
        const fallbackChainIdTheme = ChainIdColorTheme(ctx, ChainIdColorThemeProvider.defaultValues as any);
        return ({
        granularity: 'group',
        color: (location: StructureElement.Location) => {
            //console.log('Color function called for:', location);
            const { unit, element } = location;
            if (Unit.isAtomic(unit)) {
                const chainIndex = unit.model.atomicHierarchy.chainAtomSegments.index[element];
                const authAsymId: string = String(unit.model.atomicHierarchy.chains.auth_asym_id?.value?.(chainIndex) ?? '');
                const labelAsymId: string = String(unit.model.atomicHierarchy.chains.label_asym_id?.value?.(chainIndex) ?? '');
                const resolved = resolveChainColor(authAsymId, labelAsymId);
                return resolved ?? fallbackChainIdTheme.color(location as any, false);
            }
            return fallbackChainIdTheme.color(location as any, false);
        },
        props: {},
        description: 'Colors chains according to a custom map.'
    });
    };
    // Return the ColorTheme object
    return {
        name: themeName,
        label: themeName,
        category: ColorTheme.Category.Chain,
        factory: theme,
        getParams: () => ({}),
        defaultValues: {},
        isApplicable: () => true,
    };
}

/**
 * Creates a custom residue-type color theme based on a provided residue code to color map.
 */
export function createResidueTypeColorTheme(
    themeName: string,
    residueTypeColorMap: Map<string, Color>) {
    const params = {
        __ribocodeThemeRefreshNonce: PD.Text('', { isHidden: true }),
        __ribocodeActiveThemeKind: PD.Select<'chain' | 'residue-type'>('residue-type', [
            ['chain', 'Chain'],
            ['residue-type', 'Residue'],
        ], { isHidden: true }),
    };
    const normalizeResidueType = (value: unknown): string => String(value ?? '').trim().toUpperCase();
    const normalizedResidueColorMap = new Map<string, Color>();
    residueTypeColorMap.forEach((color, key) => {
        const normalized = normalizeResidueType(key);
        if (!normalized) return;
        if (!normalizedResidueColorMap.has(normalized)) {
            normalizedResidueColorMap.set(normalized, color);
        }
    });

    const resolveResidueColor = (residueType: string): Color | undefined => {
        const normalized = normalizeResidueType(residueType);
        if (!normalized) return undefined;
        if (residueTypeColorMap.has(normalized)) return residueTypeColorMap.get(normalized);
        return normalizedResidueColorMap.get(normalized);
    };

    const unknownResidueColor = Color(0xFF00FF);
    const theme = (_ctx: ThemeDataContext, props: PD.Values<typeof params>) => ({
        granularity: 'group',
        color: (location: any) => {
            if (StructureElement.Location.is(location) && Unit.isAtomic(location.unit)) {
                const compId = String(location.unit.model.atomicHierarchy.atoms.label_comp_id.value(location.element) ?? '');
                return resolveResidueColor(compId) ?? unknownResidueColor;
            }
            if (Bond.isLocation(location) && Unit.isAtomic(location.aUnit)) {
                const compId = String(location.aUnit.model.atomicHierarchy.atoms.label_comp_id.value(location.aUnit.elements[location.aIndex]) ?? '');
                return resolveResidueColor(compId) ?? unknownResidueColor;
            }
            return unknownResidueColor;
        },
        props,
        description: 'Colors residues according to a custom residue-type map.'
    });

    return {
        name: themeName,
        label: themeName,
        category: ColorTheme.Category.Residue,
        factory: theme,
        getParams: () => params,
        defaultValues: PD.getDefaultValues(params),
        isApplicable: () => true,
    };
}

/**
 * Registers a custom chain color theme if it is not already registered.
 * @param plugin The Mol* plugin instance.
 * @param themeName The name of the theme to register.
 * @param chainColorMaps A map of theme names to their corresponding chain color maps.
 * @returns A promise that resolves when the theme is registered.
 */
export function registerThemeIfNeeded(
    plugin: PluginUIContext,
    themeName: string,
    chainColorMaps: Map<string, Map<string, Color>>,
    residueTypeColorMaps?: Map<string, Map<string, Color>>
) {
    if (!plugin) return;
    // Get color theme registry.
    const colorThemeRegistry = plugin.representation.structure.themes.colorThemeRegistry;
    if (!colorThemeRegistry) {
        console.warn('No colorThemeRegistry found in representation structure themes.');
        return;
    }
    console.log('ColorThemeRegistry:', colorThemeRegistry);
    // Remove the old theme if it exists.
    const existingTheme = colorThemeRegistry.get(themeName);
    if (existingTheme) {
        colorThemeRegistry.remove(existingTheme);
        console.log(`Removed old ${themeName} theme.`);
    }
    const chainMap = chainColorMaps.get(themeName);
    const residueMap = residueTypeColorMaps?.get(themeName);
    const provider = residueMap
        ? createResidueTypeColorTheme(themeName, residueMap)
        : chainMap
            ? createChainColorTheme(themeName, chainMap)
            : null;
    if (!provider) {
        console.warn(`No custom color map found for theme ${themeName}.`);
        return;
    }
    colorThemeRegistry.add(provider as any);
    console.log(`Registered ${themeName} theme.`);
}