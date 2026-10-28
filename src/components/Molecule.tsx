/**
 * MoleculeRow component for displaying molecule controls and information.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React, { useState } from 'react';
// import '../../src/css/controls.css'; // Now loaded globally via index.css
import { VisibilityOutlinedSvg, VisibilityOffOutlinedSvg } from 'molstar/lib/mol-plugin-ui/controls/icons';
import { idSuffix as toggleVisibilityRepIdSuffix } from './buttons/RepresentationVisibilityToggle';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { allowedRepresentationTypes } from '../types/ribocode';

const INTERNAL_RESIDUE_DEFAULT_THEMES = new Set([
    'AlignedTo-default-residue-colors',
    'Aligned-default-residue-colors',
]);

/**
 * Suffix for the MoleculeUI root id, used for consistent id construction in code and tests.
 */
export const idSuffix = 'moleculeui';

/**
 * Props for the MoleculeUI component.
 * @param label The label for the molecule.
 * @param plugin The Mol* PluginUIContext instance.
 * @param structureRef The structure reference for the molecule.
 * @param isVisible Whether the molecule is currently visible.
 * @param onToggleVisibility Function to toggle the molecule's visibility.
 * @param chainZoomLabel The label for the chain zoom button.
 * @param onChainZoom Function to zoom to the chain.
 * @param chainZoomDisabled Whether the chain zoom button is disabled.
 * @param residueZoomLabel The label for the residue zoom button.
 * @param onResidueZoom Function to zoom to the residue.
 * @param residueZoomDisabled Whether the residue zoom button is disabled.
 * @param isLoaded Whether the molecule data is loaded.
 * @param forceUpdate A function to force the parent component to re-render.
 * @param representationRefs Array of representation refs associated with the molecule.
 * @param onDeleteRepresentation Optional callback to delete a representation.
 * @param onToggleRepVisibility Optional callback to toggle representation visibility.
 * @return The MoleculeUI component.
 */
interface MoleculeUIProps {
    label: string;
    plugin: PluginUIContext | null;
    isVisible: boolean;
    onToggleVisibility: () => void | Promise<void>;
    chainZoomLabel: string;
    onChainZoom: () => void;
    chainZoomDisabled: boolean;
    subunitZoomLabel?: string;
    onSubunitZoom?: () => void;
    subunitZoomDisabled?: boolean;
    residueZoomLabel: string;
    onResidueZoom: () => void;
    residueZoomDisabled: boolean;
    isLoaded: boolean;
    forceUpdate: () => void;
    representationRefs?: string[];
    onDeleteRepresentation?: (ref: string) => void;
    onToggleRepVisibility?: (ref: string) => void;
    chainThemeOptions?: Array<{ value: string; label: string }>;
    residueThemeOptions?: Array<{ value: string; label: string }>;
    onRepresentationChainThemeChange?: (ref: string, themeName: string) => void;
    onRepresentationResidueThemeChange?: (ref: string, themeName: string) => void;
    extraControls?: React.ReactNode;
    onRemove?: () => void;
    idPrefix?: string;
}

/**
 * Molecule controls and info, including visibility and zoom.
 * @param label The label for the molecule.
 * @param plugin The Mol* PluginUIContext instance.
 * @param isVisible Whether the molecule is currently visible.
 * @param onToggleVisibility Function to toggle the molecule's visibility.
 * @param chainZoomLabel The label for the chain zoom button.
 * @param onChainZoom Function to zoom to the chain.
 * @param chainZoomDisabled Whether the chain zoom button is disabled.
 * @param residueZoomLabel The label for the residue zoom button.
 * @param onResidueZoom Function to zoom to the residue.
 * @param residueZoomDisabled Whether the residue zoom button is disabled.
 * @param isLoaded Whether the molecule data is loaded.
 * @param forceUpdate A function to force the parent component to re-render.
 * @param representationRefs Array of representation refs associated with the molecule.
 * @param onDeleteRepresentation Optional callback to delete a representation.
 * @param onToggleRepVisibility Optional callback to toggle representation visibility.
 * @returns The MoleculeRow component.
 */
const MoleculeUI: React.FC<MoleculeUIProps> = ({
    label,
    plugin,
    isVisible,
    onToggleVisibility,
    isLoaded,
    forceUpdate,
    representationRefs = [],
    onDeleteRepresentation,
    onToggleRepVisibility,
    chainThemeOptions = [],
    residueThemeOptions = [],
    onRepresentationChainThemeChange,
    onRepresentationResidueThemeChange,
    onRemove,
    idPrefix,
}) => {
    // Helper to get visibility state and type for a representation
    const getRepType = (ref: string): string | null => {
        if (!plugin) return null;
        const cell = plugin.state?.data?.cells?.get(ref);
        const typeName = cell?.params?.values?.type?.name;
        if (typeName && allowedRepresentationTypes.includes(typeName)) {
            return typeName;
        }
        return null;
    };
    // Check if a representation is visible.
    const isRepVisible = (ref: string) => {
        if (!plugin) return false;
        const cell = plugin.state?.data?.cells?.get(ref);
        // If isHidden is undefined or false, treat as visible
        return cell?.state?.isHidden !== true;
    };

    const getRepOpacity = (ref: string): number => {
        if (!plugin) return 1;
        const cell = plugin.state?.data?.cells?.get(ref);
        const alpha = cell?.params?.values?.type?.params?.alpha;
        return typeof alpha === 'number' && Number.isFinite(alpha) ? alpha : 1;
    };

    const setRepOpacity = async (ref: string, opacity: number) => {
        if (!plugin) return;
        const cell = plugin.state?.data?.cells?.get(ref);
        const values = cell?.params?.values;
        if (!values?.type) return;

        const nextOpacity = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
        const currentOpacity = values?.type?.params?.alpha;
        if (typeof currentOpacity === 'number' && Math.abs(currentOpacity - nextOpacity) < 1e-6) return;

        const nextParams = {
            ...values,
            type: {
                ...values.type,
                params: {
                    ...(values.type.params ?? {}),
                    alpha: nextOpacity,
                },
            },
        };

        const tree = plugin.state.data.build().to(ref).update(nextParams);
        await plugin.runTask(plugin.state.data.updateTree(tree));
        plugin.canvas3d?.requestDraw?.();
        forceUpdate();
    };
    // Toggle visibility for a representation.
    const handleToggleRepVisibility = async (ref: string, retryCount = 0) => {
        if (!plugin) return;
        const cell = plugin.state?.data?.cells?.get(ref);
        if (!cell) {
            if (retryCount < 3) {
                setTimeout(() => handleToggleRepVisibility(ref, retryCount + 1), 100);
            } else {
                console.warn('Representation cell not found for ref after retries:', ref);
            }
            return;
        }
        await PluginCommands.State.ToggleVisibility.apply(plugin, [plugin, { state: plugin.state.data, ref }]);
        plugin.canvas3d?.requestDraw?.();
        forceUpdate();
    };

    const setRepresentationVisibility = async (ref: string, visible: boolean) => {
        if (!plugin) return;
        const cell = plugin.state?.data?.cells?.get(ref);
        if (!cell) return;
        const currentlyVisible = cell?.state?.isHidden !== true;
        if (currentlyVisible === visible) return;
        if (onToggleRepVisibility) {
            onToggleRepVisibility(ref);
            return;
        }
        await PluginCommands.State.ToggleVisibility.apply(plugin, [plugin, { state: plugin.state.data, ref }]);
    };

    const getAnyRepresentationVisible = () => {
        if (!plugin || representationRefs.length === 0) return isVisible;
        return representationRefs.some(ref => isRepVisible(ref));
    };

    const handleToggleAllVisibility = async () => {
        const hasRepresentationControls = representationRefs.length > 0;
        if (!hasRepresentationControls || !plugin) {
            await onToggleVisibility();
            return;
        }

        const anyVisible = getAnyRepresentationVisible();
        const targetVisible = !anyVisible;

        // Keep the parent structure state and camera behavior consistent on reveal/hide.
        if ((targetVisible && !isVisible) || (!targetVisible && isVisible)) {
            await onToggleVisibility();
        }

        for (const ref of representationRefs) {
            await setRepresentationVisibility(ref, targetVisible);
        }

        plugin.canvas3d?.requestDraw?.();
        forceUpdate();
    };
    // Per-representation menu state
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [themeKindOverrides, setThemeKindOverrides] = useState<Record<string, 'chain' | 'residue-type'>>({});
    // Render the component.
    // Defensive: ensure label is a string
    const safeLabel = typeof label === 'string' ? label : '';
    const hasRepresentationControls = representationRefs.length > 0;
    const effectiveVisible = isVisible;

    return (
        <div className={`molecule-row${hasRepresentationControls ? ' has-rep-controls' : ''}`} id={idPrefix ? `${idPrefix}-${idSuffix}-${safeLabel.replace(/\s+/g, '-').toLowerCase()}` : `${idSuffix}-${safeLabel.replace(/\s+/g, '-').toLowerCase()}` }>
            <div className="molecule-top-row">
                <button
                    onClick={() => { void handleToggleAllVisibility(); }}
                    disabled={!plugin || !isLoaded}
                    className="msp-btn msp-form-control molecule-visibility-btn"
                    aria-label={effectiveVisible ? `Hide ${label}` : `Show ${label}`}
                    id={idPrefix ? `${idPrefix}-toggle-visibility-btn` : undefined}
                >
                    {effectiveVisible ? <VisibilityOutlinedSvg /> : <VisibilityOffOutlinedSvg />}
                    <span className="molstar-label">{label}</span>
                </button>
            </div>
            {/* Per-representation controls rendered below in indented rows. */}
            {hasRepresentationControls && (
                <div className="rep-controls-row">
                    {representationRefs.map(ref => {
                        const cell = plugin?.state?.data?.cells?.get(ref);
                        const typeName = getRepType(ref);
                        const repVisible = isRepVisible(ref);
                        const opacity = getRepOpacity(ref);
                        if (!typeName) return null;
                        // Use _ribocodeId if available, else fallback to ref
                        const repId = cell?.params?.values?._ribocodeId || ref;
                        const colorThemeName = cell?.params?.values?.colorTheme?.name;
                        const persistedKind = cell?.params?.values?._ribocodeActiveThemeKind
                            ?? cell?.params?.values?.colorTheme?.params?.__ribocodeActiveThemeKind;
                        const resolvedThemeKind: 'chain' | 'residue-type' =
                            themeKindOverrides[ref]
                            ?? (persistedKind === 'residue-type' ? 'residue-type' : 'chain');
                        const selectedChainTheme = cell?.params?.values?._ribocodeChainTheme
                            || (colorThemeName && colorThemeName !== 'chain-id' ? colorThemeName : 'default');
                        const selectedResidueTheme = cell?.params?.values?._ribocodeResidueTheme
                            || (resolvedThemeKind === 'residue-type' && colorThemeName && colorThemeName !== 'chain-id' ? colorThemeName : 'default');
                        const displayResidueTheme = INTERNAL_RESIDUE_DEFAULT_THEMES.has(selectedResidueTheme)
                            ? 'default'
                            : selectedResidueTheme;
                        const activeThemeKind: 'chain' | 'residue-type' = resolvedThemeKind;
                        const effectiveChainThemeOptions = chainThemeOptions.some(option => option.value === selectedChainTheme)
                            ? chainThemeOptions
                            : [...chainThemeOptions, { value: selectedChainTheme, label: selectedChainTheme }];
                        const safeResidueThemeOptions = residueThemeOptions.filter(option => option.value !== 'chain-id');
                        const effectiveResidueThemeOptions = safeResidueThemeOptions.some(option => option.value === displayResidueTheme)
                            ? safeResidueThemeOptions
                            : [...safeResidueThemeOptions, { value: displayResidueTheme, label: displayResidueTheme }];
                        return (
                            <div key={ref}>
                                <div className="rep-btn-group rep-btn-group-row">
                                    <button
                                        onClick={() => onToggleRepVisibility ? onToggleRepVisibility(ref) : handleToggleRepVisibility(ref)}
                                        className="msp-btn msp-form-control"
                                        disabled={!isLoaded}
                                        aria-label={`Toggle visibility for ${typeName} representation`}
                                        id={idPrefix ? `${idPrefix}-${toggleVisibilityRepIdSuffix}-${repId}` : undefined}
                                    >
                                        {repVisible ? <VisibilityOutlinedSvg /> : <VisibilityOffOutlinedSvg />}
                                        <span className="molstar-label">{typeName}</span>
                                    </button>
                                    <label
                                        htmlFor={idPrefix ? `${idPrefix}-rep-opacity-${repId}` : undefined}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                    >
                                        <span className="molstar-label">Opacity</span>
                                        <input
                                            id={idPrefix ? `${idPrefix}-rep-opacity-${repId}` : undefined}
                                            type="range"
                                            min={0.1}
                                            max={1}
                                            step={0.05}
                                            value={opacity}
                                            disabled={!isLoaded}
                                            onChange={e => {
                                                void setRepOpacity(ref, Number(e.target.value));
                                            }}
                                        />
                                        <span className="molstar-label">{Math.round(opacity * 100)}%</span>
                                    </label>
                                    {/* Delete button */}
                                    <button
                                        onClick={() => onDeleteRepresentation && onDeleteRepresentation(repId)}
                                        className="msp-btn msp-btn-danger msp-form-control"
                                        disabled={!isLoaded}
                                        aria-label={`Delete ${typeName} representation`}
                                        id={idPrefix ? `${idPrefix}-delete-rep-${repId}` : undefined}
                                    >
                                        &#x2716;
                                    </button>
                                </div>
                                {(chainThemeOptions.length > 0 || residueThemeOptions.length > 0) && (
                                    <div className="rep-btn-group rep-btn-group-row" style={{ marginLeft: 28, marginTop: 4 }}>
                                        <label
                                            htmlFor={idPrefix ? `${idPrefix}-rep-theme-kind-${repId}` : undefined}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                        >
                                            <span className="molstar-label">Theme Type</span>
                                            <select
                                                id={idPrefix ? `${idPrefix}-rep-theme-kind-${repId}` : undefined}
                                                className="msp-form-control"
                                                disabled={!isLoaded}
                                                value={activeThemeKind}
                                                onChange={e => {
                                                    const nextKind = e.target.value === 'residue-type' ? 'residue-type' : 'chain';
                                                    setThemeKindOverrides(prev => ({ ...prev, [ref]: nextKind }));
                                                    if (nextKind === 'residue-type') {
                                                        onRepresentationResidueThemeChange?.(ref, selectedResidueTheme);
                                                    } else {
                                                        onRepresentationChainThemeChange?.(ref, selectedChainTheme);
                                                    }
                                                }}
                                            >
                                                <option value="chain">Chain</option>
                                                <option value="residue-type">Residue</option>
                                            </select>
                                        </label>
                                        {activeThemeKind === 'chain' && effectiveChainThemeOptions.length > 0 && (
                                            <label
                                                htmlFor={idPrefix ? `${idPrefix}-rep-chain-theme-${repId}` : undefined}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                            >
                                                <span className="molstar-label">Chain Theme</span>
                                                <select
                                                    id={idPrefix ? `${idPrefix}-rep-chain-theme-${repId}` : undefined}
                                                    className="msp-form-control"
                                                    disabled={!isLoaded}
                                                    value={selectedChainTheme}
                                                    onChange={e => {
                                                        onRepresentationChainThemeChange?.(ref, e.target.value);
                                                    }}
                                                >
                                                    {effectiveChainThemeOptions.map(option => (
                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}
                                        {activeThemeKind === 'residue-type' && effectiveResidueThemeOptions.length > 0 && (
                                            <label
                                                htmlFor={idPrefix ? `${idPrefix}-rep-residue-theme-${repId}` : undefined}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                            >
                                                <span className="molstar-label">Residue Theme</span>
                                                <select
                                                    id={idPrefix ? `${idPrefix}-rep-residue-theme-${repId}` : undefined}
                                                    className="msp-form-control"
                                                    disabled={!isLoaded}
                                                    value={displayResidueTheme}
                                                    onChange={e => {
                                                        onRepresentationResidueThemeChange?.(ref, e.target.value);
                                                    }}
                                                >
                                                    {effectiveResidueThemeOptions.map(option => (
                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            {/* Remove button for realigned molecules */}
            {onRemove && (
                <button
                    onClick={onRemove}
                    className="msp-btn msp-btn-danger msp-form-control"
                    aria-label={`Remove ${label}`}
                    style={{ fontSize: '1.5em', lineHeight: 1 }}
                    id={idPrefix ? `${idPrefix}-remove-btn` : undefined}
                >
                    &#x2716;
                </button>
            )}
        </div>
    );
};

export default MoleculeUI;