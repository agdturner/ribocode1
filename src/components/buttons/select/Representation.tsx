/**
 * A representation select button component.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React from 'react';
import GenericSelectButton, { idSuffix as selectIdSuffix } from './Select';
import { allowedRepresentationTypes, AllowedRepresentationType } from '../../../types/ribocode';

/**
 * Props for the SelectButton component.
 * @property label The label for the select button.
 * @property options The array of string options to select from.
 * @property selected The currently selected option.
 * @property onSelect Callback function when an option is selected.
 * @property disabled Whether the select button is disabled.
 */
interface RepresentationSelectButtonProps {
	label?: string;
	options: AllowedRepresentationType[];
	selected: AllowedRepresentationType;
	onSelect: (option: AllowedRepresentationType) => void;
	disabled?: boolean;
	id?: string;
}

/**
 * A select button for representations.
 * @param label The label for the select button.
 * @param options The array of string options to select from.
 * @param selected The currently selected option.
 * @param onSelect Callback function when an option is selected.
 * @param disabled Whether the select button is disabled.
 * @returns The SelectButton component.
 */
const RepresentationSelectButton: React.FC<RepresentationSelectButtonProps> = ({ label = 'Add Representation', options, selected, onSelect, disabled, id }) => (
	<GenericSelectButton
		label={label}
		options={options.map(String)}
		selected={String(selected)}
		onSelect={value => onSelect(value as AllowedRepresentationType)}
		disabled={disabled}
		id={id ?? selectIdSuffix}
	/>
);

export default RepresentationSelectButton;
