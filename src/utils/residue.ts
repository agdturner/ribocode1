/**
 * Residue utility functions for Ribocode.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */

/**
 * Information about a residue for labeling purposes.
 */
export interface ResidueLabelInfo {
    id: string; // residue id (auth_seq_id as string)
    name: string; // e.g., 'LEU 70'
    compId: string; // e.g., 'LEU'
    seqNumber: number; // e.g., 70
    insCode: string; // insertion code, if any
}

const RNA_ONE_LETTER_CODES = new Set(['A', 'C', 'G', 'U', 'I', 'T', 'N']);
const AMINO_ACID_THREE_LETTER_CODES = new Set([
    'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE',
    'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL',
    'SEC', 'PYL',
]);

const MODIFIED_NUCLEOTIDE_TO_BASE: Record<string, string> = {
    ADE: 'A', CYT: 'C', GUA: 'G', URA: 'U', URI: 'U',
    DA: 'A', DC: 'C', DG: 'G', DT: 'T', DU: 'U',
    PSU: 'U', H2U: 'U', '5MU': 'U', OMG: 'G', M2G: 'G', M7G: 'G',
    '1MA': 'A', M2A: 'A', '5MC': 'C', M5C: 'C', '2MG': 'G', YYG: 'G',
};

const NON_RESIDUE_TOKENS = new Set(['ATOM', 'HETATM', '.', '?']);

function readColumnValue(column: any, index: number): string {
    if (!column) return '';
    if (typeof column.value === 'function') {
        const v = column.value(index);
        return v == null ? '' : String(v);
    }
    if (Array.isArray(column.value)) {
        const v = column.value[index];
        return v == null ? '' : String(v);
    }
    return '';
}

function normalizeResidueCode(rawCompId: string): string {
    const code = String(rawCompId || '').trim().toUpperCase();
    if (!code) return '?';
    if (NON_RESIDUE_TOKENS.has(code)) return '';
    if (RNA_ONE_LETTER_CODES.has(code)) return code;
    if (MODIFIED_NUCLEOTIDE_TO_BASE[code]) return MODIFIED_NUCLEOTIDE_TO_BASE[code];
    if (AMINO_ACID_THREE_LETTER_CODES.has(code)) return code;
    if (code.length === 1) return code;
    return code;
}

function formatResidueLabel(code: string, seqNum: string, insCode: string): string {
    const base = `${seqNum} ${code}`.trim();
    return insCode ? `${base} (${insCode})` : base;
}

/**
 * Get residue labels and mapping from residue IDs to atom IDs for a given chain in a molecule.
 * @param structure The structure object containing units and model hierarchy.
 * @param chainId The chain ID to extract residue information for.
 * @returns An object containing:
 *   - residueLabels: Map from residue ID to ResidueLabelInfo
 *   - residueToAtomIds: Record mapping residue ID to array of atom IDs
 */
export function getResidueInfo(
    structure: any,
    chainId: string): {
        residueLabels: Map<string, ResidueLabelInfo>,
        residueToAtomIds: Record<string, string[]>
    } {
    const residueLabels: Map<string, ResidueLabelInfo> = new Map();
    const residueToAtomIds: Record<string, string[]> = {};
    const units = structure.units;
    if (!units || units.length === 0) {
        console.warn('No units found in structure.');
        return { residueLabels, residueToAtomIds };
    }
    //console.log('Structure units:', structure.units);
    // Use the first atomic unit's model as reference for residue/chain info
    let model = undefined;
    for (const unit of units) {
        if (unit.kind === 0 && unit.model) { model = unit.model; break; }
    }
    if (!model) {
        console.warn('No atomic unit with model found in molecule.units.');
        return { residueLabels, residueToAtomIds };
    }
    //console.log('[getResidueInfo] Using model:', model);
    const chains = model.atomicHierarchy.chains;
    const residues = model.atomicHierarchy.residues;
    const atoms = model.atomicHierarchy.atoms;
    // Find chain index for the requested chainId
    let chainIdx: number | undefined = undefined;
    if (chains && chains.auth_asym_id && typeof chains.auth_asym_id.value === 'function') {
        for (let i = 0; i < chains._rowCount; i++) {
            if (chains.auth_asym_id.value(i) === chainId) { chainIdx = i; break; }
        }
    } else if (chains && chains.auth_asym_id && Array.isArray(chains.auth_asym_id.value)) {
        for (let i = 0; i < chains._rowCount; i++) {
            if (chains.auth_asym_id.value[i] === chainId) { chainIdx = i; break; }
        }
    }
    //console.log('[getResidueInfo] chainIdx for chainId', chainId, ':', chainIdx);
    if (chainIdx === undefined) {
        console.warn('Chain ID not found in model.atomicHierarchy.chains:', chainId);
        return { residueLabels, residueToAtomIds };
    }
    // Iterate over all units and collect residue/atom info for this chain
    for (const unit of units) {
        if (unit.kind !== 0) continue; // Only atomic units
        const { chainIndex, residueIndex, elements } = unit;
        //console.log('[getResidueInfo] Processing unit:', unit, 'elements.length:', elements.length);
        for (let i = 0; i < elements.length; i++) {
            const atomIdx = elements[i];
            if (chainIndex[atomIdx] !== chainIdx) continue;
            const resIdx = residueIndex[atomIdx];
            // Get residue auth_seq_id
            let residueId = '';
            if (residues && residues.auth_seq_id && typeof residues.auth_seq_id.value === 'function') {
                residueId = residues.auth_seq_id.value(resIdx)?.toString();
            } else if (residues && residues.auth_seq_id && Array.isArray(residues.auth_seq_id.value)) {
                residueId = residues.auth_seq_id.value[resIdx]?.toString();
            }
            if (!residueId) continue;
            // Atom ID (use atomIdx as string)
            if (!residueToAtomIds[residueId]) residueToAtomIds[residueId] = [];
            residueToAtomIds[residueId].push(atomIdx.toString());
            //console.log('[getResidueInfo] Atom', atomIdx, 'added to residue', residueId);
            // Build enhanced residue label info
            let label_comp_id = '';
            let label_seq_id = '';
            let auth_comp_id = '';
            let auth_seq_id = '';
            let group_PDB = '';
            let insCode = '';
            let atom_label_comp_id = '';
            let atom_auth_comp_id = '';
            // Canonical (label) fields
            if (residues && residues.label_comp_id && typeof residues.label_comp_id.value === 'function') {
                label_comp_id = residues.label_comp_id.value(resIdx) || '';
            } else if (residues && residues.label_comp_id && Array.isArray(residues.label_comp_id.value)) {
                label_comp_id = residues.label_comp_id.value[resIdx] || '';
            }
            if (residues && residues.label_seq_id && typeof residues.label_seq_id.value === 'function') {
                label_seq_id = residues.label_seq_id.value(resIdx)?.toString() || '';
            } else if (residues && residues.label_seq_id && Array.isArray(residues.label_seq_id.value)) {
                label_seq_id = residues.label_seq_id.value[resIdx]?.toString() || '';
            }
            // Author fields
            if (residues && residues.auth_comp_id && typeof residues.auth_comp_id.value === 'function') {
                auth_comp_id = residues.auth_comp_id.value(resIdx) || '';
            } else if (residues && residues.auth_comp_id && Array.isArray(residues.auth_comp_id.value)) {
                auth_comp_id = residues.auth_comp_id.value[resIdx] || '';
            }
            if (residues && residues.auth_seq_id && typeof residues.auth_seq_id.value === 'function') {
                auth_seq_id = residues.auth_seq_id.value(resIdx)?.toString() || '';
            } else if (residues && residues.auth_seq_id && Array.isArray(residues.auth_seq_id.value)) {
                auth_seq_id = residues.auth_seq_id.value[resIdx]?.toString() || '';
            }
            // group_PDB fallback (rare, but for legacy/mmCIF)
            if (residues && residues.group_PDB && typeof residues.group_PDB.value === 'function') {
                group_PDB = residues.group_PDB.value(resIdx) || '';
            } else if (residues && residues.group_PDB && Array.isArray(residues.group_PDB.value)) {
                group_PDB = residues.group_PDB.value[resIdx] || '';
            }
            // Insertion code
            if (residues && residues.pdbx_PDB_ins_code && typeof residues.pdbx_PDB_ins_code.value === 'function') {
                insCode = residues.pdbx_PDB_ins_code.value(resIdx) || '';
            } else if (residues && residues.pdbx_PDB_ins_code && Array.isArray(residues.pdbx_PDB_ins_code.value)) {
                insCode = residues.pdbx_PDB_ins_code.value[resIdx] || '';
            }

            // Atom-level fallback: residue table can be missing comp_id while atom table still has it.
            atom_label_comp_id = readColumnValue(atoms?.label_comp_id, atomIdx) || readColumnValue(atoms?.label_comp_id, i);
            atom_auth_comp_id = readColumnValue(atoms?.auth_comp_id, atomIdx) || readColumnValue(atoms?.auth_comp_id, i);

            // Fallback logic for residue name (Mol* style): prefer residue/atom comp ids, never group_PDB token.
            const rawResidueName =
                label_comp_id ||
                auth_comp_id ||
                atom_label_comp_id ||
                atom_auth_comp_id ||
                group_PDB ||
                '?';
            const residueName = normalizeResidueCode(rawResidueName);
            let seqNum = label_seq_id || auth_seq_id || '';
            const displayCode = residueName || '?';
            const label = formatResidueLabel(displayCode, seqNum, insCode);
            residueLabels.set(residueId, {
                id: residueId,
                name: label,
                compId: displayCode,
                seqNumber: Number(seqNum),
                insCode: insCode
            });
        }
    }
    // Debug logging disabled to avoid console spam; uncomment if needed:
    // console.info('[getResidueInfo] residueLabels:', residueLabels);
    // console.info('[getResidueInfo] residueToAtomIds:', residueToAtomIds);
    return {
        residueLabels: residueLabels,
        residueToAtomIds: residueToAtomIds
    };
}