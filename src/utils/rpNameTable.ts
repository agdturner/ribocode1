/**
 * Utility functions for parsing and using the RP_name_table_uniprot.csv data file.
 *
 * The CSV maps gene family names (e.g. uS2, eS1) to UniProt accession codes for
 * multiple species (arabidopsis, drosophila, human, yeast). This lookup is used to
 * enrich chain labels in the viewer so users see meaningful protein names instead
 * of raw mmCIF identifiers.
 *
 * Expected CSV format:
 *   family,human_old_name,yeast_old_name,arabdidopsis_homologs,drosophila_homologs,human_homologs,yeast_homologs
 *   eS1,S1,S3A,Q42262;Q9CAV0,P55830,P61247;D6RG13,A0A6A5PRY4;P33442
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * Version: 1.0.0
 * Last modified: 2026-06-22
 * @see https://github.com/ribocode-slola/ribocode1
 */

export type RpSpeciesKey = 'arabidopsis' | 'drosophila' | 'human' | 'yeast';

/**
 * Column indices in the CSV that hold semicolon-separated UniProt accession codes.
 * 0=family, 1=human_old_name, 2=yeast_old_name, 3=arabidopsis, 4=drosophila, 5=human, 6=yeast
 */
const UNIPROT_COL_INDEX_BY_SPECIES: Record<RpSpeciesKey, number> = {
    arabidopsis: 3,
    drosophila: 4,
    human: 5,
    yeast: 6,
};

const ALL_SPECIES: RpSpeciesKey[] = ['arabidopsis', 'drosophila', 'human', 'yeast'];

export interface RpNameLookupBySpecies {
    all: Map<string, string>;
    arabidopsis: Map<string, string>;
    drosophila: Map<string, string>;
    human: Map<string, string>;
    yeast: Map<string, string>;
}

function normalizeAccession(value: unknown): string | undefined {
    if (value == null) return undefined;
    const accession = String(value).trim();
    if (!accession || accession === '?' || accession === '.') return undefined;
    return accession;
}

function splitChainIds(value: unknown): string[] {
    if (value == null) return [];
    return String(value)
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
}

function normalizeSpeciesSelection(species?: RpSpeciesKey | RpSpeciesKey[]): RpSpeciesKey[] {
    if (!species) return ALL_SPECIES;
    return Array.isArray(species) ? species : [species];
}

/**
 * Parses the RP_name_table_uniprot.csv content into a lookup map.
 *
 * Each UniProt accession found in the arabidopsis, drosophila, human, or yeast
 * homolog columns is mapped to the gene family name in column 0 (e.g. "eS1", "uS2").
 *
 * @param csvText - Raw text content of RP_name_table_uniprot.csv.
 * @returns Map from UniProt accession code → gene family name.
 */
export function parseRpNameTable(
    csvText: string,
    species?: RpSpeciesKey | RpSpeciesKey[]
): Map<string, string> {
    const lookup = new Map<string, string>();
    const lines = csvText.split('\n');
    const selectedSpecies = normalizeSpeciesSelection(species);
    const selectedColumns = selectedSpecies.map(s => UNIPROT_COL_INDEX_BY_SPECIES[s]);
    // Skip header row (line 0)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        const family = cols[0]?.trim();
        if (!family) continue;
        for (const ci of selectedColumns) {
            const cellValue = cols[ci] || '';
            const codes = cellValue.split(';');
            for (const code of codes) {
                const c = code.trim();
                if (c) {
                    lookup.set(c, family);
                }
            }
        }
    }
    return lookup;
}

/**
 * Builds lookups for all species columns and each individual species column.
 */
export function parseRpNameTableBySpecies(csvText: string): RpNameLookupBySpecies {
    return {
        all: parseRpNameTable(csvText),
        arabidopsis: parseRpNameTable(csvText, 'arabidopsis'),
        drosophila: parseRpNameTable(csvText, 'drosophila'),
        human: parseRpNameTable(csvText, 'human'),
        yeast: parseRpNameTable(csvText, 'yeast'),
    };
}

/**
 * Best-effort detection of source species for a model from mmCIF entity source categories.
 */
export function inferSpeciesKeyFromModel(model: any): RpSpeciesKey | undefined {
    const db = model?.sourceData?.data?.db;
    if (!db) return undefined;

    const names: string[] = [];
    const pushValues = (category: any, fieldName: string) => {
        if (!category || !category[fieldName]?.value) return;
        const rowCount = category._rowCount ?? 0;
        for (let i = 0; i < rowCount; i++) {
            const value = category[fieldName].value(i);
            if (value) names.push(String(value).toLowerCase());
        }
    };

    pushValues(db.entity_src_nat, 'pdbx_organism_scientific');
    pushValues(db.pdbx_entity_src_syn, 'organism_scientific');
    pushValues(db.entity_src_gen, 'pdbx_gene_src_scientific_name');

    const text = names.join(' | ');
    if (!text) return undefined;
    if (/arabidopsis/.test(text)) return 'arabidopsis';
    if (/drosophila/.test(text)) return 'drosophila';
    if (/homo\s+sapiens|human/.test(text)) return 'human';
    if (/saccharomyces|yeast/.test(text)) return 'yeast';
    return undefined;
}

/**
 * Builds a map from entity ID to UniProt accession from a Mol* model's struct_ref data.
 *
 * Reads the `_struct_ref` mmCIF category (accessible via `model.sourceData.data.db.struct_ref`)
 * and returns a Map<entityId, uniprotAccession>.
 *
 * Returns an empty map if the data is not available (e.g. in tests or non-mmCIF sources).
 *
 * @param model - A Mol* model object.
 * @returns Map from entity ID string → UniProt accession string.
 */
export function buildEntityToUniprotMap(model: any): Map<string, string> {
    const entityToUniprot = new Map<string, string>();
    try {
        const structRef = model?.sourceData?.data?.db?.struct_ref;
        if (!structRef) return entityToUniprot;
        const rowCount: number = structRef._rowCount ?? 0;
        for (let r = 0; r < rowCount; r++) {
            const entityId = structRef.entity_id?.value?.(r);
            const accession = normalizeAccession(structRef.pdbx_db_accession?.value?.(r));
            if (entityId != null && accession) {
                entityToUniprot.set(String(entityId), accession);
            }
        }
    } catch {
        // Gracefully degrade — no UniProt data available
    }
    return entityToUniprot;
}

/**
 * Builds a map from chain/asym IDs to UniProt accession from a model's struct_ref_seq data.
 *
 * `_struct_ref_seq.pdbx_strand_id` usually stores author chain IDs, which are the IDs shown in
 * chain selectors. This is used as a robust fallback when chain -> entity mapping is unavailable.
 */
export function buildChainToUniprotMap(model: any): Map<string, string> {
    const chainToUniprot = new Map<string, string>();
    try {
        const structRefSeq = model?.sourceData?.data?.db?.struct_ref_seq;
        if (!structRefSeq) return chainToUniprot;

        const rowCount: number = structRefSeq._rowCount ?? 0;
        for (let r = 0; r < rowCount; r++) {
            const accession = normalizeAccession(structRefSeq.pdbx_db_accession?.value?.(r));
            if (!accession) continue;

            const chainIds = splitChainIds(structRefSeq.pdbx_strand_id?.value?.(r));
            for (const chainId of chainIds) {
                chainToUniprot.set(chainId, accession);
            }
        }
    } catch {
        // Gracefully degrade — no chain-level UniProt data available
    }
    return chainToUniprot;
}
