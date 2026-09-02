# User Guide

Welcome to the ribocode1 User Guide!

## Table of Contents

- [Data and Mol* Acknowledgements](#data-and-mol-acknowledgements)
- [User Interface](#user-interface)
- [Chain Selection Enrichment](#chain-selection-enrichment)
- [Sessions](#sessions)


## Data and Mol* Acknowledgements

In publications, users should acknowledge the data sources used, and the underlying [Mol*](https://github.com/molstar/molstar) technology using a citation along the following lines:
- David Sehnal, Sebastian Bittrich, Mandar Deshpande, Radka Svobodová, Karel Berka, Václav Bazgier, Sameer Velankar, Stephen K Burley, Jaroslav Koča, Alexander S Rose: [Mol* Viewer: modern web app for 3D visualization and analysis of large biomolecular structures](https://doi.org/10.1093/nar/gkab314), *Nucleic Acids Research*, 2021; https://doi.org/10.1093/nar/gkab314.


## User Interface

The Ribocode User Interface (UI) is best displayed on a screen at a width of 1200 pixels and a height of at least 800 pixels. UI interaction is normally via a mouse and keyboard.

The UI layout is as follows:
 - Title containing the version with a link to this README.
 - `General Controls`
   - `Resdue Zoom` controls
   - `Select Sync` control for synchronization
   - `Show UniProt accession in chain labels` toggle for chain selector labels
   - `Re-align to Chains` control
 - Column `A`
   - `Mol* Viewer A`
     - `3D Canvas`
   - `MoleculeUI` components (representation toggles) including:
     - `AlignedTo` with `Zoom to Chain:` and `Zoom to Residue` 
     - `Aligned` with `Zoom to Chain:` and `Zoom to Residue` 
   - `Load Molecule`
     - `Load AlignedTo` button for loading the dataset to align to (`AlignedTo`)
     - `Add Representation` control
     - `Load Colours` button
   - `Clipping` controls (directly above `Select and Zoom Controls`): `Min Near`, `Clip Radius`, and `Reset Clipping`
   - `Show Select and Zoom Controls` button (collapsed by default)
   - `Select and Zoom Controls` panel (shown only when expanded; includes `Select Subunit`, `Select Chain`, `Select Residues`, `Zoom to ...` controls, and `AlignedTo Chain Finder`)
   - `Show Advanced Mol* Controls` button (toggles advanced Mol* interface for power users)
   - `Advanced Mol* Controls` panel (shown only when expanded; includes Sequence, Left Panel, Structure Tools, and Log sections)
 - Column `B`
   - `Mol* Viewer B`
     - `3D Canvas`
   - `MoleculeUI` components (representation toggles) including:
     - `AlignedTo` with `Zoom to Chain:` and `Zoom to Residue`
     - `Aligned` with `Zoom to Chain:` and `Zoom to Residue`
   - `Load Molecule` 
     - `Load Aligned` button for loading the dataset to be aligned (`Aligned`)
     - `Add Representation` control
     - `Load Colours` button
   - `Clipping` controls (directly above `Select and Zoom Controls`): `Min Near`, `Clip Radius`, and `Reset Clipping`
   - `Show Select and Zoom Controls` button (collapsed by default)
   - `Select and Zoom Controls` panel (shown only when expanded; includes `Select Subunit`, `Select Chain`, `Select Residues`, `Zoom to ...` controls, and `Aligned Chain Finder`)
   - `Show Advanced Mol* Controls` button (toggles advanced Mol* interface for power users)
   - `Advanced Mol* Controls` panel (shown only when expanded; includes Sequence, Left Panel, Structure Tools, and Log sections)
```
+-------------------------------------------------------------+
|           RiboCode Mol* Viewer, Version, README             |
+-------------------------------------------------------------+
|     [General Controls: Residue Zoom | Sync | Re-align]      |
+------------------------------+------------------------------+
|          Column A            |           Column B           |
+------------------------------+------------------------------+
|         Mol* Viewer A        |         Mol* Viewer B        |
|  +------------------------+  |  +------------------------+  |
|  |                        |  |  |                        |  |
|  |                        |  |  |                        |  |
|  |        3D Canvas       |  |  |        3D Canvas       |  |
|  |                        |  |  |                        |  |
|  |                        |  |  |                        |  |
|  +------------------------+  |  +------------------------+  |
+------------------------------+------------------------------+
|     MoleculeUI AlignedTo     |     MoleculeUI AlignedTo     |
|      MoleculeUI Aligned      |      MoleculeUI Aligned      |
|     MoleculeUI Re-aligned    |     MoleculeUI Re-aligned    |
|              ...             |             ...              |
|         Load AlignedTo       |          Load Aligned        |
|      Representation/+        |       Representation/+       |
|          Load Colours        |          Load Colours        |
| Show Select and Zoom Controls| Show Select and Zoom Controls|
| Select/Zoom + Chain Finder   | Select/Zoom + Chain Finder   |
| Show Advanced Mol* Controls  | Show Advanced Mol* Controls  |
|  Advanced Mol* Controls      |   Advanced Mol* Controls     |
| (Sequence/Tools/Log panels)  | (Sequence/Tools/Log panels)  |
+-------------------------------------------------------------+
```

## Chain Selection

When structure data are loaded, Ribocode enriches chain labels used in the respective (`AlignedTo` or `Aligned`):
- `Select Chain` dropdown; and,
- `Chain Finder` table below each viewer.

The `Chain Finder` table appears inside the `Select and Zoom Controls` panel and is hidden by default together with Select/Zoom controls.
- Column `A` shows the `AlignedTo Chain Finder`.
- Column `B` shows the `Aligned Chain Finder`.

Users can use `Chain Finder` search boxes to quickly find chains by any part of the label, including:
  - label chain ID (e.g., `ZB`),
  - auth chain ID (e.g., `auth CU`),
  - UniProt accession,
  - RP family name,
  - molecule description (e.g., `L22-like`).

Selecting a chain can be done both via the `Select Chain` drop down or by selecting a row in the `Chain Finder`.

To access `Select Subunit`, `Select Chain`, `Select Residues`, and zoom-to-selection controls, first click `Show Select and Zoom Controls` in the relevant column.

Ribocode combines metadata from the loaded mmCIF file and lookup tables to build a richer chain label.

Depending on available metadata, labels can include:
- RP family name (from `RP_name_table_uniprot.csv` lookup),
- UniProt accession and/or gene name,
- original chain identity with auth preserved (`<label> [auth <auth>]`),
- molecule description from mmCIF entity metadata.

Example enriched label:

`eL22 | P35268 | ZB [auth CU] | Ribosomal protein L22-like protein`

### UniProt toggle behavior

- `Show UniProt accession in chain labels` controls whether accession codes are shown in the chain label text.
- This toggle affects both the dropdown and chain-finder labels.
- The toggle state is saved and restored as part of session `uiState`.


## Sessions

A user starting from scratch starts a session by loading a dataset in [CIF](https://www.iucr.org/resources/cif/spec/version1.1) file format via the `Load AlignedTo` button. As the data load, the coordinates for all the atoms are centralized so that the coordinate origin is at the centre.

When the `AlignedTo` dataset is loaded several things happen:
  - The `Select Sync` control becomes actionable.
  - The `Load AlignedTo` button is replaced by the name of the dataset loaded.
  - The `AlignedTo` Select/Zoom panel can be expanded via `Show Select and Zoom Controls`; inside that panel `Select Subunit` and `Select Chain` become actionable.
  - The `Load Aligned` button becomes actionable.
  - The `MoleculeUI` for `AlignedTo` in both columns populates and becomes actionable.
  - A default `cartoon` style 3D visual representation of the dataset appears in `Viewer A`.
  - In `Viewer B`, the loaded `AlignedTo` dataset is hidden by default. Use the `AlignedTo` visibility (eye) button in `MoleculeUI` to show it.

Next, the user can do several things:
  - Additional representations can be added via the `+` button in the `Representation` component of the `LoadMoleculeUI`. Initially this is set to add a `spacefill` representation, but other representation types can be selected.
  - Representation can be removed from the `MoleculeUI` components using the `x` button.
  - Custom colours for `AlignedTo` representations can be loaded from file via the actionable `Load Colours` button.
  - The 3D representation of the dataset in `Viewer A` can be rotated/zoomed.
  - The 3D representation of the dataset in `Viewer A` can be rotated/zoomed.
  - The `Select Sync` can be changed to `On`.
  - An `Aligned` dataset can be loaded via the `Load Aligned` button.
  - A subunit can be selected in the `Select Subunit` control (inside the Select/Zoom panel) to reduce chain options for `Select Chain`.
  - A chain can be selected from `Select Chain` or from the `Chain Finder` table in that panel.
  
* As an `Aligned` dataset is loaded, it's atom positions are centralized and aligned with the centralized `AlignedTo` atom positions using an algorithm.
* In `Viewer A`, the loaded `Aligned` dataset is hidden by default. Use the `Aligned` visibility (eye) button in `MoleculeUI` to show it.
* If a chain is selected, the `Select Residue` control becomes actionable and the `Zoom to Chain` control becomes actionable to zoom to the selected chain.
* If a residue is selected, the `Zoom to Residue` control becomes actionable to zoom to the selected residue within the chain. The selected residue will be in the viewer centre. How much is displayed around that depends on the `Residue Zoom` settings.
* If chains are selected for both `AlignedTo` and `Aligned` molecules, the `Re-align` button can be actioned to apply chain-based re-alignment.
* Re-aligning a different chain pair is supported repeatedly; repeating the same pair is blocked to avoid cumulative transform/rotation drift.

### Re-align implementation note

- Chain re-alignment now prefers an in-place transform of the currently loaded aligned structures for faster iteration.
- If in-place transform cannot be applied, Ribocode automatically falls back to the reload-based `ReAligned` path.
- Console diagnostics for re-alignment now include fit-quality metrics (`movingSelectedAtomCount`, `referenceSelectedAtomCount`, `atomPairCount`, and `rmsd`).

Ribosome data can be downloaded from the [RCSB Protein Data Bank](https://www.rcsb.org/pages/about-us/index) in CIF format. Two datasets which align well are: [4ug0](https://files.rcsb.org/download/4UG0.cif); and [6xu8](https://files.rcsb.org/download/6XU8.cif).

Synchronization is `Off` by default. If selected to be `On`, camera changes (rotation/pan/zoom) from the active viewer are propagated to the other viewer as relative deltas.

Please refer to the [Mol* viewer Documentation](https://molstar.org/viewer-docs/) for details of the Mol* UI. In each Ribocode `Molstar Container`, the `Mol* 3D Canvas` is always visible and the additional Mol* panels (`Sequence Panel`, `Main Menu`, `Control Panel`, `Log Panel`) are hidden by default so as not to clutter the UI. Use the `Show Advanced Mol* Controls` button in a column to expand those hidden by default panels for advanced usage, and use `Hide Advanced Mol* Controls` to collapse them again. The Mol* viewer style is adapted so that the UI fits in a column of 600 pixels in width.

For convenience, users can save and load a session via the Session Menu. Loading a session does not load the data. For security reasons data loading is a manual process, but once the `AlignedTo` and `Aligned` data are selected, the representations are recreated and the loaded session should be in the same state as when the session was saved.

Session `uiState` persists the `Show UniProt accession in chain labels` setting, so chain label formatting is restored consistently when a session is loaded.

The `Session` > `Save All` saves all the data and all the UI state so that this can be reloaded using `Session` > `Load All`.
---