/**
 * UniProt API utilities for resolving gene names from UniProt accessions.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * Version: 1.1.0
 * Last modified: 2026-07-23
 * @see https://github.com/ribocode-slola/ribocode1
 */
export type UniProtGeneNameCache = Record<string, string | null>;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const UNIPROT_ACCESSION_PATTERN = /\b(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})\b/g;

/**
 * Normalize a CIF token by trimming whitespace and converting empty or placeholder values to undefined.
 * @param token - The CIF token to normalize.
 * @returns The normalized token or undefined if it is empty or a placeholder.
 */
function normalizeCifToken(token: string | undefined): string | undefined {
    if (!token) return undefined;
    const value = token.trim();
    if (!value || value === '?' || value === '.') return undefined;
    return value;
}

/**
 * Split a CIF chain ID field into individual chain IDs, handling comma-separated values.
 * @param value - The CIF chain ID field value.
 * @returns An array of individual chain IDs.
 */
function splitCifChainIds(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
}

/**
 * Tokenize a CIF line into individual tokens, handling quoted strings and whitespace.
 * @param line - The CIF line to tokenize.
 * @returns An array of tokens extracted from the line.
 */
function tokenizeCifLine(line: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    while (i < line.length) {
        while (i < line.length && /\s/.test(line[i])) i++;
        if (i >= line.length) break;

        const quote = line[i];
        if (quote === '"' || quote === '\'') {
            i++;
            const start = i;
            while (i < line.length && line[i] !== quote) i++;
            tokens.push(line.slice(start, i));
            if (i < line.length && line[i] === quote) i++;
            continue;
        }

        const start = i;
        while (i < line.length && !/\s/.test(line[i])) i++;
        tokens.push(line.slice(start, i));
    }
    return tokens;
}

/**
 * Parse a CIF loop block for a given category prefix, extracting tags and rows.
 * @param cifText - The CIF text to parse.
 * @param categoryPrefix - The category prefix to look for (e.g., '_struct_ref').
 * @returns An object containing the tags and rows of the loop, or null if not found.
 */
function parseLoopRows(cifText: string, categoryPrefix: string): { tags: string[]; rows: string[][] } | null {
    const lines = cifText.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line !== 'loop_') continue;

        const tags: string[] = [];
        let j = i + 1;
        while (j < lines.length) {
            const tagLine = lines[j].trim();
            if (tagLine.startsWith(`${categoryPrefix}.`)) {
                tags.push(tagLine);
                j++;
                continue;
            }
            break;
        }

        if (tags.length === 0) continue;

        const rows: string[][] = [];
        while (j < lines.length) {
            const rowLineRaw = lines[j];
            const rowLine = rowLineRaw.trim();

            if (!rowLine) {
                j++;
                continue;
            }

            if (rowLine === '#' || rowLine === 'loop_' || rowLine.startsWith('_') || rowLine.startsWith('data_')) {
                break;
            }

            // Semicolon multiline values are not expected for struct_ref/struct_ref_seq in supported inputs.
            if (rowLine.startsWith(';')) {
                break;
            }

            rows.push(tokenizeCifLine(rowLineRaw));
            j++;
        }

        return { tags, rows };
    }

    return null;
}

/**
 * Parse chain -> UniProt accession mappings directly from mmCIF text.
 *
 * This is a fallback when runtime model categories (struct_ref / struct_ref_seq)
 * are not available from Mol* model source data.
 */
export function parseChainToUniProtFromCifText(cifText: string): Map<string, string> {
    const chainToUniProt = new Map<string, string>();

    const structRefLoop = parseLoopRows(cifText, '_struct_ref');
    const refIdToUniProt = new Map<string, string>();
    if (structRefLoop) {
        const idIdx = structRefLoop.tags.indexOf('_struct_ref.id');
        const dbNameIdx = structRefLoop.tags.indexOf('_struct_ref.db_name');
        const accessionIdx = structRefLoop.tags.indexOf('_struct_ref.pdbx_db_accession');

        if (idIdx >= 0 && accessionIdx >= 0) {
            for (const row of structRefLoop.rows) {
                const dbName = (row[dbNameIdx] || '').trim().toUpperCase();
                if (dbNameIdx >= 0 && dbName && dbName !== 'UNP' && dbName !== 'UNIPROT') continue;
                const refId = normalizeCifToken(row[idIdx]);
                const accession = normalizeCifToken(row[accessionIdx]);
                if (refId && accession) {
                    refIdToUniProt.set(refId, accession);
                }
            }
        }
    }

    const structRefSeqLoop = parseLoopRows(cifText, '_struct_ref_seq');
    if (!structRefSeqLoop) return chainToUniProt;

    const strandIdx = structRefSeqLoop.tags.indexOf('_struct_ref_seq.pdbx_strand_id');
    const accessionIdx = structRefSeqLoop.tags.indexOf('_struct_ref_seq.pdbx_db_accession');
    const refIdIdx = structRefSeqLoop.tags.indexOf('_struct_ref_seq.ref_id');

    if (strandIdx < 0) return chainToUniProt;

    for (const row of structRefSeqLoop.rows) {
        const strandField = normalizeCifToken(row[strandIdx]);
        if (!strandField) continue;

        const accessionDirect = accessionIdx >= 0 ? normalizeCifToken(row[accessionIdx]) : undefined;
        const refId = refIdIdx >= 0 ? normalizeCifToken(row[refIdIdx]) : undefined;
        const accession = accessionDirect || (refId ? refIdToUniProt.get(refId) : undefined);
        if (!accession) continue;

        for (const chainId of splitCifChainIds(strandField)) {
            chainToUniProt.set(chainId, accession);
        }
    }

    return chainToUniProt;
}

/**
 * Parse chain -> molecule name mappings directly from mmCIF text.
 *
 * Uses `_entity` + `_struct_asym` and (optionally) `_pdbx_poly_seq_scheme` to
 * map both label chain IDs and auth chain IDs to molecule descriptions.
 */
export function parseChainToMoleculeNameFromCifText(cifText: string): Map<string, string> {
    const chainToMolecule = new Map<string, string>();

    const entityLoop = parseLoopRows(cifText, '_entity');
    const entityIdToDescription = new Map<string, string>();
    if (entityLoop) {
        const entityIdIdx = entityLoop.tags.indexOf('_entity.id');
        const descriptionIdx = entityLoop.tags.indexOf('_entity.pdbx_description');
        if (entityIdIdx >= 0 && descriptionIdx >= 0) {
            for (const row of entityLoop.rows) {
                const entityId = normalizeCifToken(row[entityIdIdx]);
                const description = normalizeCifToken(row[descriptionIdx]);
                if (entityId && description) {
                    entityIdToDescription.set(entityId, description);
                }
            }
        }
    }

    const structAsymLoop = parseLoopRows(cifText, '_struct_asym');
    const labelChainToEntityId = new Map<string, string>();
    if (structAsymLoop) {
        const asymIdIdx = structAsymLoop.tags.indexOf('_struct_asym.id');
        const entityIdIdx = structAsymLoop.tags.indexOf('_struct_asym.entity_id');
        if (asymIdIdx >= 0 && entityIdIdx >= 0) {
            for (const row of structAsymLoop.rows) {
                const labelChainId = normalizeCifToken(row[asymIdIdx]);
                const entityId = normalizeCifToken(row[entityIdIdx]);
                if (labelChainId && entityId) {
                    labelChainToEntityId.set(labelChainId, entityId);
                }
            }
        }
    }

    for (const [labelChainId, entityId] of labelChainToEntityId.entries()) {
        const description = entityIdToDescription.get(entityId);
        if (description) {
            chainToMolecule.set(labelChainId, description);
        }
    }

    const polySeqSchemeLoop = parseLoopRows(cifText, '_pdbx_poly_seq_scheme');
    if (polySeqSchemeLoop) {
        const asymIdIdx = polySeqSchemeLoop.tags.indexOf('_pdbx_poly_seq_scheme.asym_id');
        const authChainIdx = polySeqSchemeLoop.tags.indexOf('_pdbx_poly_seq_scheme.pdb_strand_id');
        if (asymIdIdx >= 0 && authChainIdx >= 0) {
            for (const row of polySeqSchemeLoop.rows) {
                const labelChainId = normalizeCifToken(row[asymIdIdx]);
                const authChainId = normalizeCifToken(row[authChainIdx]);
                if (!labelChainId || !authChainId) continue;
                const description = chainToMolecule.get(labelChainId);
                if (description && !chainToMolecule.has(authChainId)) {
                    chainToMolecule.set(authChainId, description);
                }
            }
        }
    }

    return chainToMolecule;
}

/**
 * Sleep for a specified number of milliseconds.
 * @param ms - The number of milliseconds to sleep.
 * @returns A promise that resolves after the specified time.
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse a TSV response from the UniProt API to extract gene names.
 * @param tsv - The TSV string returned by the UniProt API.
 * @returns A mapping of UniProt accessions to their primary gene names (or null if not found).
 */
function parseTsvGeneResponse(tsv: string): UniProtGeneNameCache {
    const lines = tsv
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length <= 1) return {};

    const result: UniProtGeneNameCache = {};
    for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split('\t');
        const accessionRaw = columns[0];
        const accession = (accessionRaw || '').trim();
        if (!accession) continue;

        const firstGene = columns
            .slice(1)
            .map(col => (col || '').trim())
            .find(Boolean)
            ?.split(/[\s,;]+/)
            .map(v => v.trim())
            .find(Boolean);

        result[accession] = firstGene || null;
    }
    return result;
}

/**
 * Build a UniProt search URL for a list of accessions.
 * @param accessions - An array of UniProt accession strings.
 * @returns A URL string for querying the UniProt API.
 */
function buildSearchUrl(accessions: string[]): string {
    const clauses = accessions.map(a => `accession:${a}`).join(' OR ');
    const query = encodeURIComponent(`(${clauses})`);
    return `https://rest.uniprot.org/uniprotkb/search?query=${query}&fields=accession,gene_primary,gene_names&format=tsv&size=${accessions.length}`;
}

/**
 * Extract UniProt accession codes from a given text string.
 * @param text - The input text to search for UniProt accessions.
 * @returns A Set of unique UniProt accession codes found in the text.
 */
export function extractUniProtAccessionsFromText(text: string): Set<string> {
    const matches = text.match(UNIPROT_ACCESSION_PATTERN) || [];
    return new Set(matches.map(v => v.trim()).filter(Boolean));
}

/**
 * Fetch gene names for a list of UniProt accessions.
 * @param accessions - An array of UniProt accession strings.
 * @param fetchFn - The fetch function to use for API requests.
 * @returns A promise resolving to a mapping of UniProt accessions to their primary gene names (or null if not found).
 */
export async function fetchUniProtGeneNames(
    accessions: string[],
    fetchFn: FetchLike = fetch,
): Promise<UniProtGeneNameCache> {
    const unique = Array.from(new Set(accessions.map(a => a.trim()).filter(Boolean)));
    if (unique.length === 0) return {};

    const url = buildSearchUrl(unique);
    const response = await fetchFn(url, {
        method: 'GET',
        headers: { 'Accept': 'text/tab-separated-values' },
    });

    if (!response.ok) {
        throw new Error(`UniProt lookup failed with status ${response.status}`);
    }

    const tsv = await response.text();
    const resolved = parseTsvGeneResponse(tsv);

    for (const accession of unique) {
        if (!(accession in resolved)) {
            resolved[accession] = null;
        }
    }

    return resolved;
}

/**
 * Fetch gene names for a list of UniProt accessions in batches, with optional delay between batches.
 * @param accessions - An iterable of UniProt accession strings.
 * @param options - Optional settings for batch size, delay, fetch function, and abort signal.
 * @returns A promise resolving to a mapping of UniProt accessions to their primary gene names (or null if not found).
 */
export async function fetchUniProtGeneNamesBatched(
    accessions: Iterable<string>,
    options?: {
        batchSize?: number;
        delayMs?: number;
        fetchFn?: FetchLike;
        signal?: AbortSignal;
        onBatchResolved?: (batch: string[], resolved: UniProtGeneNameCache) => void;
    }
): Promise<UniProtGeneNameCache> {
    const {
        batchSize = 25,
        delayMs = 1200,
        fetchFn = fetch,
        signal,
        onBatchResolved,
    } = options || {};

    const unique = Array.from(new Set(Array.from(accessions).map(a => a.trim()).filter(Boolean)));
    const result: UniProtGeneNameCache = {};

    for (let i = 0; i < unique.length; i += batchSize) {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        const batch = unique.slice(i, i + batchSize);
        try {
            const resolved = await fetchUniProtGeneNames(batch, fetchFn);
            Object.assign(result, resolved);
            onBatchResolved?.(batch, resolved);
        } catch {
            const failed: UniProtGeneNameCache = {};
            for (const accession of batch) {
                result[accession] = null;
                failed[accession] = null;
            }
            onBatchResolved?.(batch, failed);
        }

        if (i + batchSize < unique.length && delayMs > 0) {
            await sleep(delayMs);
        }
    }

    return result;
}
