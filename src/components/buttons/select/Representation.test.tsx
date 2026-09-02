/**
 * Test suite for RepresentationSelectButton component.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RepresentationSelectButton from './Representation';
import { allowedRepresentationTypes, AllowedRepresentationType } from '../../../types/ribocode';

describe('RepresentationSelectButton', () => {
    it('renders with default label and allowed options', () => {
        const { getByLabelText, getByText } = render(
            <RepresentationSelectButton
                options={Array.from(allowedRepresentationTypes)}
                selected={allowedRepresentationTypes[0]}
                onSelect={() => {}}
            />
        );
        expect(getByLabelText('Add Representation')).toBeInTheDocument();
        allowedRepresentationTypes.forEach(opt => {
            expect(getByText(opt)).toBeInTheDocument();
        });
    });

    it('renders with custom label', () => {
        const { getByLabelText } = render(
            <RepresentationSelectButton
                label="Rep Type"
                options={['cartoon', 'line'] as AllowedRepresentationType[]}
                selected={'cartoon' as AllowedRepresentationType}
                onSelect={() => {}}
            />
        );
        expect(getByLabelText('Rep Type')).toBeInTheDocument();
    });

    it('calls onSelect when option is chosen', () => {
        const onSelect = vi.fn();
        const { getByLabelText } = render(
            <RepresentationSelectButton
                options={['cartoon', 'line'] as AllowedRepresentationType[]}
                selected={'cartoon' as AllowedRepresentationType}
                onSelect={onSelect}
            />
        );
        fireEvent.change(getByLabelText('Add Representation'), { target: { value: 'line' } });
        expect(onSelect).toHaveBeenCalledWith('line');
    });

    it('is disabled when disabled prop is true', () => {
        const { getByLabelText } = render(
            <RepresentationSelectButton
                options={['cartoon'] as AllowedRepresentationType[]}
                selected={'cartoon' as AllowedRepresentationType}
                onSelect={() => {}}
                disabled
            />
        );
        expect(getByLabelText('Add Representation')).toBeDisabled();
    });
});
