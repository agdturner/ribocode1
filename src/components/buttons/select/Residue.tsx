/**
 * A residue select button component.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.1
 * @lastModified 2026-06-22
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React from 'react';
import { idSuffix as selectIdSuffix } from './Select';
import { ResidueLabelInfo } from 'src/utils/residue';

/**
 * Props for the ResidueSelectButton component.
 * @property disabled Whether the select button is disabled.
 * @property residueLabels The map of residue IDs to labels to select from.
 * @property selectedResidueIds The currently selected residue IDs.
 * @property onSelect Callback function when residue IDs are selected.
 * @property label Optional label for the select button.
 * @property id A unique identifier for the select button.
 */
export interface ResidueSelectButtonProps {
	disabled: boolean;
	residueLabels: Map<string, ResidueLabelInfo>;
	selectedResidueIds?: string[];
	onSelect: (residueIds: string[]) => void;
	label?: string;
	id: string;
}

/**
 * A select button for residues.
 *
 * Uses the residue ID as the underlying `<option>` value and displays the
 * human-readable label (e.g. "LEU 70") as the option text.  This avoids the
 * fragile name-based reverse-lookup that the previous GenericSelectButton
 * wrapper required.
 *
 * @param disabled Whether the select button is disabled.
 * @param residueLabels Map from residue ID → ResidueLabelInfo.
 * @param selectedResidueIds The currently selected residue IDs.
 * @param onSelect Callback invoked with selected residue IDs.
 * @param label Optional label for the select element.
 * @param id A unique identifier for the select element.
 * @returns The ResidueSelectButton component.
 */
const ResidueSelectButton: React.FC<ResidueSelectButtonProps> = ({
	disabled,
	residueLabels,
	selectedResidueIds = [],
	onSelect,
	label,
	id
}) => {
	// Sort by sequence number (ascending), with insertion code as tiebreaker
	const orderedEntries = Array.from(residueLabels.entries()).sort(
		([, a], [, b]) =>
			a.seqNumber - b.seqNumber || a.insCode.localeCompare(b.insCode)
	);
	return (
		<label>
			{label || 'Select Residues'}
			<select
				className="msp-select msp-form-control"
				multiple
				size={Math.min(Math.max(4, orderedEntries.length), 10)}
				value={selectedResidueIds}
				onChange={e => {
					const values = Array.from(e.target.selectedOptions).map(opt => opt.value);
					onSelect(values);
				}}
				disabled={disabled}
				id={id ?? selectIdSuffix}
			>
				{orderedEntries.map(([residueId, info]) => (
					<option key={residueId} value={residueId}>{info.name}</option>
				))}
			</select>
		</label>
	);
};

export default ResidueSelectButton;
