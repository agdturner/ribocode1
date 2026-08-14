/**
 * Custom hook for managing molecule loading logic.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { useCallback } from 'react';
import { Asset } from 'molstar/lib/mol-util/assets';
import { loadMoleculeFileToViewer, Molecule } from 'molstar/lib/extensions/ribocode/structure';
import { AlignmentData } from 'molstar/lib/extensions/ribocode/types';
import { AlignedTo, Aligned, ReAligned } from '../constants/ribocode';
import type { MoleculeMode } from '../types/ribocode';

/**
 * Custom hook to encapsulate molecule loading logic for both viewers.
 *
 * Accepts a single options object containing viewer state, Mol* helpers,
 * and optional setters used by reload/re-alignment flows.
 */
export function useMoleculeLoader({
  viewerA,
  viewerB,
  molstarA,
  molstarB,
  setAlignedFile,
  selectedChainIdAlignedTo,
  selectedChainIdAligned,
  setRealignedMoleculesA,
  setRealignedMoleculesB,
  setRealignedStructRefsA,
  setRealignedStructRefsB,
  setRealignedRepRefsA,
  setRealignedRepRefsB,
}: any) {
  const loadMoleculeIntoViewers = useCallback(
    async (file: File, mode: MoleculeMode, alignmentData?: AlignmentData) => {
      const assetFile = Asset.File(new File([file], file.name));
      const pluginA = viewerA.ref.current!;
      const pluginB = viewerB.ref.current!;
      if (mode === AlignedTo) {
        // Viewer A
        const viewerAMoleculeAlignedTo = await loadMoleculeFileToViewer(
          pluginA, assetFile, true, true
        );
        if (!viewerAMoleculeAlignedTo) {
          console.error('Failed to load molecule into viewer A.');
          return;
        }
        viewerA.setMoleculeAlignedTo((prev: any) => ({
          label: viewerAMoleculeAlignedTo.label,
          name: viewerAMoleculeAlignedTo.name,
          filename: viewerAMoleculeAlignedTo.filename ?? prev?.filename ?? "",
          presetResult: viewerAMoleculeAlignedTo.presetResult ?? "Unknown",
          trajectory: viewerAMoleculeAlignedTo.trajectory,
          alignmentData: viewerAMoleculeAlignedTo.alignmentData
        }));
        const structureA = pluginA.managers.structure.hierarchy.current.structures[0];
        if (structureA) {
          const ref = structureA.cell.transform.ref;
          molstarA.setStructureRef(AlignedTo, ref);
        }
        viewerA.setIsMoleculeAlignedToLoaded(true);
        viewerA.setIsMoleculeAlignedToVisible(true);
        // Viewer B
        const viewerBMoleculeAlignedTo: Molecule | undefined = await loadMoleculeFileToViewer(
          pluginB, assetFile, false, true
        );
        if (!viewerBMoleculeAlignedTo) {
          console.error('Failed to load molecule into viewer B.');
          return;
        }
        viewerB.setMoleculeAlignedTo((prev: any) => ({
          label: viewerBMoleculeAlignedTo.label,
          name: viewerBMoleculeAlignedTo.name,
          filename: viewerBMoleculeAlignedTo.filename ?? prev?.filename ?? "",
          presetResult: viewerBMoleculeAlignedTo.presetResult ?? "Unknown",
          trajectory: viewerBMoleculeAlignedTo.trajectory,
        }));
        const structureB = pluginB.managers.structure.hierarchy.current.structures[0];
        if (structureB) {
          const ref = structureB.cell.transform.ref;
          molstarB.setStructureRef(AlignedTo, ref);
        }
        viewerB.setIsMoleculeAlignedToLoaded(true);
        viewerB.setIsMoleculeAlignedToVisible(true);
      } else if (mode === Aligned) {
        if (!viewerA.moleculeAlignedTo?.alignmentData) {
          console.error(AlignedTo + ' molecule must be loaded before loading aligned molecule.');
          return;
        }
        setAlignedFile && setAlignedFile(file); // Store File for reloads
        const alignData = alignmentData ?? viewerA.moleculeAlignedTo.alignmentData;
        // Viewer A
        const viewerAMoleculeAligned: Molecule | undefined = await loadMoleculeFileToViewer(
          pluginA, assetFile, false, true, alignData
        );
        if (!viewerAMoleculeAligned) {
          console.error('Failed to load molecule into viewer A.');
          return;
        }
        viewerA.setMoleculeAligned((prev: any) => ({
          label: viewerAMoleculeAligned.label,
          name: viewerAMoleculeAligned.name,
          filename: viewerAMoleculeAligned.filename ?? prev?.filename ?? "",
          presetResult: viewerAMoleculeAligned.presetResult ?? "Unknown",
          trajectory: viewerAMoleculeAligned.trajectory,
        }));
        const structureA = pluginA.managers.structure.hierarchy.current.structures[1];
        if (structureA) {
          const ref = structureA.cell.transform.ref;
          molstarA.setStructureRef(Aligned, ref);
        }
        viewerA.setIsMoleculeAlignedLoaded(true);
        viewerA.setIsMoleculeAlignedVisible(true);
        // Viewer B
        const viewerBMoleculeAligned: Molecule | undefined = await loadMoleculeFileToViewer(
          pluginB, assetFile, false, true, alignData
        );
        if (!viewerBMoleculeAligned) {
          console.error('Failed to load molecule into viewer B.');
          return;
        }
        viewerB.setMoleculeAligned((prev: any) => ({
          label: viewerBMoleculeAligned.label,
          name: viewerBMoleculeAligned.name,
          filename: viewerBMoleculeAligned.filename ?? prev?.filename ?? "",
          presetResult: viewerBMoleculeAligned.presetResult ?? "Unknown",
          trajectory: viewerBMoleculeAligned.trajectory,
        }));
        const structureB = pluginB.managers.structure.hierarchy.current.structures[1];
        if (structureB) {
          const ref = structureB.cell.transform.ref;
          molstarB.setStructureRef(Aligned, ref);
        }
        viewerB.setIsMoleculeAlignedLoaded(true);
        viewerB.setIsMoleculeAlignedVisible(true);
      } else if (mode === ReAligned) {
        if (!viewerA.moleculeAlignedTo?.alignmentData) {
          console.error(AlignedTo + ' molecule must be loaded before loading realigned molecule.');
          return;
        }
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
        const label = `Re-aligned: ${selectedChainIdAlignedTo} → ${selectedChainIdAligned}`;
        // Load in Viewer A
        const molA = await loadMoleculeFileToViewer(pluginA, assetFile, false, true, alignmentData);
        let structRefA = null;
        if (pluginA.managers.structure.hierarchy.current.structures.length > 0) {
          structRefA = pluginA.managers.structure.hierarchy.current.structures.at(-1)?.cell?.transform.ref;
        }
        if (structRefA) {
          molstarA.setStructureRef(id, structRefA);
          molstarA.refreshRepresentationRefs(id, structRefA);
          setTimeout(() => {
            setRealignedRepRefsA && setRealignedRepRefsA((prev: any) => ({ ...prev, [id]: molstarA.representationRefs[id] || [] }));
          }, 500);
          setRealignedStructRefsA && setRealignedStructRefsA((prev: any) => ({ ...prev, [id]: structRefA }));
        }
        setRealignedMoleculesA && setRealignedMoleculesA((prev: any) => [...prev, { id, file: file, label, from: selectedChainIdAlignedTo, to: selectedChainIdAligned }]);
        // Load in Viewer B
        const molB = await loadMoleculeFileToViewer(pluginB, assetFile, false, true, alignmentData);
        let structRefB = null;
        if (pluginB.managers.structure.hierarchy.current.structures.length > 0) {
          structRefB = pluginB.managers.structure.hierarchy.current.structures.at(-1)?.cell?.transform.ref;
        }
        if (structRefB) {
          molstarB.setStructureRef(id, structRefB);
          molstarB.refreshRepresentationRefs(id, structRefB);
          setTimeout(() => {
            setRealignedRepRefsB && setRealignedRepRefsB((prev: any) => ({ ...prev, [id]: molstarB.representationRefs[id] || [] }));
          }, 500);
          setRealignedStructRefsB && setRealignedStructRefsB((prev: any) => ({ ...prev, [id]: structRefB }));
        }
        setRealignedMoleculesB && setRealignedMoleculesB((prev: any) => [...prev, { id, file: file, label, from: selectedChainIdAlignedTo, to: selectedChainIdAligned }]);
        console.log('Realignment added to Viewer A and B models.');
      }
    }, [viewerA, viewerB, molstarA, molstarB, setAlignedFile, selectedChainIdAlignedTo, selectedChainIdAligned, setRealignedMoleculesA, setRealignedMoleculesB, setRealignedStructRefsA, setRealignedStructRefsB, setRealignedRepRefsA, setRealignedRepRefsB]);

  return { loadMoleculeIntoViewers };
}
