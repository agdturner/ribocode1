/**
 * A generic select button component.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React from 'react';

/**
 * Suffix for the GenericSelectButton id, used for consistent id construction in code and tests.
 */
export const idSuffix = 'select-btn';

/**
 * Props for the GenericSelectButton component.
 * @property label The label for the select button.
 * @property options The array of string options to select from.
 * @property selected The currently selected option.
 * @property onSelect Callback function when an option is selected.
 * @property disabled Whether the select button is disabled.
 * @property placeholder Placeholder text when no option is selected.
 * @property id An optional id for the select button.
 */
interface GenericSelectButtonProps {
	label: string;
	options: string[];
	selected: string;
	onSelect: (value: string) => void;
	disabled?: boolean;
	placeholder?: string;
	id?: string;
	title?: string;
}

/**
 * A generic select button component.
 * @param label The label for the select button.
 * @param options The array of string options to select from.
 * @param selected The currently selected option.
 * @param onSelect Callback function when an option is selected.
 * @param disabled Whether the select button is disabled.
 * @param placeholder Placeholder text when no option is selected.
 * @param id An optional id for the select button.
 * @returns The GenericSelectButton component.
 */
const GenericSelectButton: React.FC<GenericSelectButtonProps> = ({
	label,
	options,
	selected,
	onSelect,
	disabled = false,
	placeholder = '...',
	id,
	title
}) => (
	<label title={title}>
		{label}
		<select
			className="msp-select msp-form-control"
			value={selected}
			onChange={e => onSelect(e.target.value)}
			disabled={disabled}
			id={id}
			title={title}
		>
			<option value="" disabled>{placeholder}</option>
			{options.map(opt => (
				<option key={opt} value={opt}>{opt}</option>
			))}
		</select>
	</label>
);

export default GenericSelectButton;
