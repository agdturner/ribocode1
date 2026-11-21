/**
 * Chain utility functions for Ribocode.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.1.0
 * @lastModified 2026-07-23
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { Structure } from 'molstar/lib/mol-model/structure';
import { buildChainToUniprotMap, buildEntityToUniprotMap, inferSpeciesKeyFromModel, RpNameLookupBySpecies } from './rpNameTable';

export function normalizeChainIdentifier(value: unknown): string {
    const v = String(value ?? '').trim();
    if (!v || v === '?' || v === '.') return '';
    return v;
}

function getEntityIdForChain(chains: any, row: number): string | undefined {
    const labelEntityId = chains.label_entity_id?.value?.(row);
    if (labelEntityId != null && String(labelEntityId).trim()) {
        return String(labelEntityId).trim();
    }
    const entityId = chains.entity_id?.value?.(row);
    if (entityId != null && String(entityId).trim()) {
        return String(entityId).trim();
    }
    return undefined;
}

function buildChainLabel(
    labelId: string,
    authId: string,
    familyName?: string,
    uniprotAccession?: string,
    geneName?: string,
    showUniprotAccessionInLabel = true,
    moleculeName?: string
): string {
    const defaultLabel = labelId ? `${labelId} [auth ${authId}]` : `[auth ${authId}]`;

    if (!familyName && !uniprotAccession && !geneName && !moleculeName) {
        return defaultLabel;
    }

    const prefixParts: string[] = [];
    if (familyName) prefixParts.push(familyName);
    if (geneName && uniprotAccession) {
        prefixParts.push(showUniprotAccessionInLabel ? `${geneName} (${uniprotAccession})` : geneName);
    } else if (geneName) {
        prefixParts.push(geneName);
    } else if (uniprotAccession && showUniprotAccessionInLabel) {
        prefixParts.push(uniprotAccession);
    }

    const parts = [...prefixParts, defaultLabel];
    if (moleculeName) parts.push(moleculeName);
    return parts.join(' | ');
}

function buildEntityToMoleculeNameMap(model: any): Map<string, string> {
    const entityToMolecule = new Map<string, string>();
    try {
        const entity = model?.sourceData?.data?.db?.entity;
        if (!entity) return entityToMolecule;
        const rowCount: number = entity._rowCount ?? 0;
        for (let i = 0; i < rowCount; i++) {
            const entityIdRaw = entity.id?.value?.(i);
            const descriptionRaw = entity.pdbx_description?.value?.(i);
            const entityId = entityIdRaw != null ? String(entityIdRaw).trim() : '';
            const description = descriptionRaw != null ? String(descriptionRaw).trim() : '';
            if (entityId && description && description !== '?' && description !== '.') {
                entityToMolecule.set(entityId, description);
            }
        }
    } catch {
        // Ignore metadata extraction errors and keep chain label fallback behavior.
    }
    return entityToMolecule;
}

function isLookupBySpecies(
    lookup?: Map<string, string> | RpNameLookupBySpecies
): lookup is RpNameLookupBySpecies {
    return !!lookup && typeof lookup === 'object' && 'all' in lookup;
}

/**
 * Extracts chain IDs and labels from a Mol* Structure object.
 *
 * When `rpNameLookup` is provided the function attempts to resolve a gene
 * family name (e.g. "uS2", "eS1") for each chain by:
 *   1. Reading the `_struct_ref.pdbx_db_accession` mmCIF table from the model
 *      to map entity IDs → UniProt accession codes.
 *   2. Looking up each UniProt accession in `rpNameLookup`.
 * If a family name is found the label becomes `<family> [<labelId>]`;
 * otherwise it falls back to `<labelId> [auth <authId>]`.
 *
 * @param structure The Mol* Structure object.
 * @param rpNameLookup Optional Map<uniprotCode, familyName> from parseRpNameTable().
 * @returns An object containing a Map of auth chain IDs to their display labels.
 */
export function getChainInfo(
    structure: Structure,
    rpNameLookup?: Map<string, string> | RpNameLookupBySpecies,
    geneNameLookup?: Record<string, string | null>,
    showUniprotAccessionInLabel = true,
    chainToUniprotOverride?: Map<string, string>,
    chainToMoleculeNameOverride?: Map<string, string>
): {
    chainLabels: Map<string, string>;
    chainToUniprot: Map<string, string>;
    uniprotAccessions: Set<string>;
} {
    const chainLabels: Map<string, string> = new Map();
    const chainToUniprot: Map<string, string> = new Map();
    const uniprotAccessions: Set<string> = new Set();
    let loggedEmptyMappingDiagnostics = false;
    const units = structure.units;
    if (!units || units.length === 0) {
        console.warn('No units found in structure.');
        return { chainLabels, chainToUniprot, uniprotAccessions };
    }
    units.forEach(unit => {
        // Only process atomic units
        if ((unit as any).kind !== undefined && (unit as any).kind !== 0) return;
        const model = (unit as any).model;
        if (!model) return;
        const chains = model.atomicHierarchy?.chains;
        if (!chains) return;
        const { auth_asym_id, label_asym_id } = chains;

        // Build entity → UniProt map once per model (if lookup provided)
        let entityToUniprot: Map<string, string> | undefined;
        let chainToUniprotMap: Map<string, string> | undefined;
        const entityToMoleculeName = buildEntityToMoleculeNameMap(model);
        if (rpNameLookup) {
            entityToUniprot = buildEntityToUniprotMap(model);
            chainToUniprotMap = buildChainToUniprotMap(model);
            if (
                !loggedEmptyMappingDiagnostics
                && entityToUniprot.size === 0
                && chainToUniprotMap.size === 0
                && (!chainToUniprotOverride || chainToUniprotOverride.size === 0)
                && process.env.NODE_ENV !== 'test'
            ) {
                loggedEmptyMappingDiagnostics = true;
                const db = model?.sourceData?.data?.db;
                const dbKeys = db ? Object.keys(db) : [];
                const structRef = db?.struct_ref;
                const structRefSeq = db?.struct_ref_seq;
                const structRefRowCount = structRef?._rowCount ?? 0;
                const structRefSeqRowCount = structRefSeq?._rowCount ?? 0;
                const structRefSample = structRefRowCount > 0
                    ? {
                        dbName: structRef.db_name?.value?.(0),
                        entityId: structRef.entity_id?.value?.(0),
                        accession: structRef.pdbx_db_accession?.value?.(0),
                    }
                    : null;
                const structRefSeqSample = structRefSeqRowCount > 0
                    ? {
                        strandId: structRefSeq.pdbx_strand_id?.value?.(0),
                        accession: structRefSeq.pdbx_db_accession?.value?.(0),
                        refId: structRefSeq.ref_id?.value?.(0),
                    }
                    : null;

                console.warn('[getChainInfo] No UniProt mappings produced for model.', {
                    dbKeys: dbKeys.slice(0, 40),
                    hasStructRef: !!structRef,
                    hasStructRefSeq: !!structRefSeq,
                    structRefRowCount,
                    structRefSeqRowCount,
                    structRefSample,
                    structRefSeqSample,
                });
            }
        }

        const speciesKey = isLookupBySpecies(rpNameLookup)
            ? inferSpeciesKeyFromModel(model)
            : undefined;
        const activeLookup = isLookupBySpecies(rpNameLookup)
            ? (speciesKey ? rpNameLookup[speciesKey] : rpNameLookup.all)
            : rpNameLookup;

        for (let i = 0; i < chains._rowCount; i++) {
            const rawAuthId = auth_asym_id?.value ? auth_asym_id.value(i) : '';
            const labelId: string = label_asym_id?.value ? label_asym_id.value(i) : '';
            const authId = normalizeChainIdentifier(rawAuthId) || normalizeChainIdentifier(labelId);
            if (!authId) continue;
            if (chainLabels.has(authId)) continue; // deduplicate across units

            const entityId = getEntityIdForChain(chains, i);
            let moleculeName = chainToMoleculeNameOverride?.get(authId)
                ?? (labelId ? chainToMoleculeNameOverride?.get(labelId) : undefined)
                ?? (entityId ? entityToMoleculeName.get(entityId) : undefined);
            if (moleculeName === '?' || moleculeName === '.') {
                moleculeName = undefined;
            }

            // Attempt to resolve gene family name via UniProt
            let familyName: string | undefined;
            let uniprotAccession: string | undefined;
            if (chainToUniprotOverride && chainToUniprotOverride.size > 0) {
                uniprotAccession = chainToUniprotOverride.get(authId)
                    ?? (labelId ? chainToUniprotOverride.get(labelId) : undefined);
            }

            if (!uniprotAccession && rpNameLookup && entityToUniprot) {
                const entityId = getEntityIdForChain(chains, i);
                const uniprot = entityId ? entityToUniprot.get(entityId) : undefined;
                if (uniprot) {
                    uniprotAccession = uniprot;
                } else {
                    uniprotAccession = chainToUniprotMap?.get(authId)
                        ?? (labelId ? chainToUniprotMap?.get(labelId) : undefined);
                }
            }

            if (uniprotAccession) {
                uniprotAccessions.add(uniprotAccession);
                chainToUniprot.set(authId, uniprotAccession);
                familyName = activeLookup?.get(uniprotAccession);
                if (!familyName && isLookupBySpecies(rpNameLookup)) {
                    familyName = rpNameLookup.all.get(uniprotAccession);
                }
            }

            const geneName = uniprotAccession ? geneNameLookup?.[uniprotAccession] ?? undefined : undefined;
            const label = buildChainLabel(
                labelId,
                authId,
                familyName,
                uniprotAccession,
                geneName ?? undefined,
                showUniprotAccessionInLabel,
                moleculeName
            );
            chainLabels.set(authId, label);
        }
    });
    return { chainLabels, chainToUniprot, uniprotAccessions };
}