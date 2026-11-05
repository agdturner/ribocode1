/**
 * A subunit select button component for ribosome subunit selection (large/small).
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
import { RibosomeSubunitType, RibosomeSubunitTypes } from '../../../utils/subunit';

/**
 * Props for the SubunitSelectButton component.
 * @property disabled Whether the select button is disabled.
 * @property selectedSubunit The currently selected subunit.
 * @property onSelect Callback function when a subunit is selected.
 * @property label Optional label for the select button.
 * @property id A unique identifier for the select button.
 */
export interface SubunitSelectButtonProps {
    disabled: boolean;
    selectedSubunit?: RibosomeSubunitType;
    onSelect: (subunit: RibosomeSubunitType) => void;
    label?: string;
    id: string;
    title?: string;
}

/**
 * A select button for ribosome subunits (large/small).
 * @param disabled Whether the select button is disabled.
 * @param selectedSubunit The currently selected subunit.
 * @param onSelect Callback function when a subunit is selected.
 * @param label Optional label for the select button.
 * @param id A unique identifier for the select button.
 * @returns The SubunitSelectButton component.
 */
const SubunitSelectButton: React.FC<SubunitSelectButtonProps> = ({
    disabled,
    selectedSubunit,
    onSelect,
    label,
    id,
    title
}) => (
        <GenericSelectButton
            label={label || 'Select'}
            options={RibosomeSubunitTypes}
            selected={selectedSubunit || ''}
            onSelect={(value: string) => onSelect(value as RibosomeSubunitType)}
            disabled={disabled}
            id={id ?? selectIdSuffix}
            title={title}
        />
);

export default SubunitSelectButton;
