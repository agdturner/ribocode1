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
    - `Session Menu`
      - For loading and saving sessions.
    - `Select Sync`
      - Control for synchronization
    - `Align Subunits`
      - Control for aliging using selected subunits. 
    - `Align Chains`
      - Control for aliging using selected chains.
    - `Align Residues`
      - Control for aliging using selected residues.
  - Column `A`
    - `Mol* Viewer A`
      - `3D Canvas`
    - `MoleculeUI`
      - Components (representation toggles) for:
        - `AlignedTo`
        - `Aligned`
    - `Load AlignedTo`
      - Button for loading the dataset to align to. Once loaded this is replaced with the name of the AignedTo data.
    - `Add Representation` control (enabled after AlignedTo data load)
    - `Load Colours` button (enabled after AlignedTo data load)
    - `Show Clipping controls`
      - Button (collapsed by default)
      - `Min Near` `Reset`
      - `Clip Radius` `Reset`
    - `Show Select and Zoom Controls`
      - Button (collapsed by default)
      - `Subunit Controls`
        - Button (collapsed by default)
        - `Select Subunit`
        - `Zoom` `Highlight` `Inspect`
      - `Chain Controls`
        - Button (collapsed by default)
        - Selected chain label
        - `Zoom` `Highlight` `Inspect`
        - `Select Chain Control`
        - Button (collapsed by default)
          - `Include Uniprot accession in chain labels`
          - Button (on by default)
          - Uniprot cache summary
      - `Residue Controls`
        - Button (collapsed by default)
        - Disabled until a chain is selected
        - `Select Residues`
        - `Zoom` `Highlight` `Inspect`
    - `Show Advanced Mol* Controls` button (collapsed by default)
      - Includes Sequence, Left Panel, Structure Tools, and Log sections
  - Column `B`
    - `Mol* Viewer B`
      - `3D Canvas`
    - `MoleculeUI`
      - Components (representation toggles) for:
        - `Aligned`
        - `AlignedTo`
    - `Load Aligned`
      - Button for loading the dataset to align. Once loaded this is replaced with the name of the Aigned data.
    - `Add Representation` control (enabled after Aligned data load)
    - `Load Colours` button (enabled after Aligned data load)
    - `Show Clipping controls`
      - Button (collapsed by default)
      - `Min Near` `Reset`
      - `Clip Radius` `Reset`
    - `Show Select and Zoom Controls`
      - Button (collapsed by default)
      - `Subunit Controls`
        - Button (collapsed by default)
        - `Select Subunit`
        - `Zoom` `Highlight` `Inspect`
      - `Chain Controls`
        - Button (collapsed by default)
        - Selected chain label
        - `Zoom` `Highlight` `Inspect`
        - `Select Chain Control`
        - Button (collapsed by default)
          - `Include Uniprot accession in chain labels`
          - Button (on by default)
          - Uniprot cache summary
      - `Residue Controls`
        - Button (collapsed by default)
        - Disabled until a chain is selected
        - `Select Residues`
        - `Zoom` `Highlight` `Inspect`
    - `Show Advanced Mol* Controls` button (collapsed by default)
      - Includes Sequence, Left Panel, Structure Tools, and Log sections
```
+-------------------------------------------------------------+
|      RiboCode Mol* Viewer Version (README | User Guide)     |
+-------------------------------------------------------------+
|                       General Controls                      |
|                       ----------------                      |
|         Session | Sync | Align   | Align  | Align           |
|           Menu  |      | Subunit | Chains | Residues        |
+------------------------------+------------------------------+
|          Column A            |           Column B           |
|          --------            |           --------           |
|  +------------------------+  |  +------------------------+  |
|  |                        |  |  |                        |  |
|  |       Mol* Viewer A    |  |  |       Mol* Viewer B    |  |
|  |        3D Canvas       |  |  |        3D Canvas       |  |
|  |                        |  |  |                        |  |
|  |                        |  |  |                        |  |
|  +------------------------+  |  +------------------------+  |
|         MoleculeUI           |          MoleculeUI          |
|         ----------           |          ----------          |
| AlignedTo                    | AlignedTo                    |
| Aligned                      | Aligned                      |
| --------                     | --------                     |
| Load AlignedTo               | Load Aligned                 |
| Add Representation           | Add Representation           |
| Load Colours                 | Load Colours                 |
| --------                     | --------                     |
| Clipping                     | Clipping                     |
|   Min Near                   |   Min Near                   |
|   Clip Radius                |   Clip Radius                |
| ------------------------     | ------------------------     |
| Select and Zoom Controls     | Select and Zoom Controls     |
|  Zoom extra | Zoom min       |  Zoom extra | Zoom min       |
|    Radius   |  Radius        |    Radius   |  Radius        |
|  Subunit                     |  Subunit                     |
|   Select                     |   Select                     |
|   Zoom Highlight Inspect     |   Zoom Highlight Inspect     |
|  Chain                       |  Chain                       |
|   Selected Chain Label       |   Selected Chain Label       |
|   Zoom Highlight Inspect     |   Zoom Highlight Inspect     |
|  Residue                     |  Residue                     |
|   Select                     |   Select                     |
|   Zoom Highlight Inspect     |   Zoom Highlight Inspect     |
| ---------------------------  | ---------------------------  |
| Advanced Mol* Controls       | Advanced Mol* Controls       |
| (Sequence/Tools/Log panels)  | (Sequence/Tools/Log panels)  |
+-------------------------------------------------------------+
```

## Chain Selection

When structure data are loaded, Ribocode enriches chain labels used in the `Select Chain` tables for each dataset (`AlignedTo` or `Aligned`). Users can use the search box to quickly find chains by any part of the label, including:
  - label chain ID (e.g., `ZB`),
  - auth chain ID (e.g., `auth CU`),
  - UniProt accession,
  - RP family name,
  - molecule description (e.g., `L22-like`).

Selecting a chain is done by selecting a row in the table.

Ribocode combines metadata from the loaded mmCIF file and lookup tables to build a richer chain label.

Depending on available metadata, labels can include:
- RP family name (from `RP_name_table_uniprot.csv` lookup),
- UniProt accession and/or gene name,
- original chain identity with auth preserved (`<label> [auth <auth>]`),
- molecule description from mmCIF entity metadata.

Example enriched label:

`eL22 | P35268 | ZB [auth CU] | Ribosomal protein L22-like protein`

### UniProt toggle behavior

- `Include UniProt accession in chain labels` controls whether accession codes are shown in chain label text.
- There is a control for each of `AlignedTo` and `Aligned` which can be configured independently.
- Each chain section also displays UniProt cache progress (`cached`, `pending`, `in-flight`).
- The per-dataset toggle state is saved and restored as part of session `uiState`.


## Sessions

A user starting from scratch starts a session by loading a dataset in [CIF](https://www.iucr.org/resources/cif/spec/version1.1) file format via the `Load AlignedTo` button. As the data load, the coordinates for all the atoms are centralized so that the coordinate origin is at the centre.

When the `AlignedTo` dataset is loaded several things happen:
  - The `Sync` control becomes actionable.
  - The `Load AlignedTo` button is replaced by the name of the dataset loaded.
  - The Select and Zoom Controls become actionable.
  - The `Load Aligned` button becomes actionable.
  - The `MoleculeUI` for `AlignedTo` in both columns populates and becomes actionable.
  - A default `cartoon` style 3D visual representation of the dataset appears in `Viewer A`.
  - In `Viewer B`, the loaded `AlignedTo` dataset is hidden by default. Use the `AlignedTo` visibility (eye) button to show it.

Next, the user can do several things:
  - Additional representations can be added via the `+` button in the `Add Representation` component. Initially this is set to add a `spacefill` representation, but other representation types can be selected.
  - Representation can be removed from the `MoleculeUI` components using the `x` buttons.
  - Custom colours for `AlignedTo` representations can be loaded from file via the actionable `Load Colours` button.
  - The 3D representation of the dataset in `Viewer A` can be rotated/zoomed.
  - An `Aligned` dataset can be loaded via the `Load Aligned` button.
  - Subunit, chain and residues can be selected, highlighted and inspected.
  
* As an `Aligned` dataset is loaded, it's atom positions are centralized and aligned with the centralized `AlignedTo` atom positions using an algorithm.
* In `Viewer A`, the loaded `Aligned` dataset is hidden by default. Use the `Aligned` visibility (eye) button in `MoleculeUI` to show it.
* If a chain is selected, residue slection from that chain is supported and the `Zoom`, `Highlight` and `Inspect` controls become actionable for the chain.
* Residue labels in `Select Residues` follow Mol* style: `code number [auth n]` (for example `GLY 70 [auth 70]`, `A 12 [auth 12]`).
* If a residue is selected then residue `Zoom`, `Highlight` and `Inspect` controls become actionable.
* If chains are selected for both `AlignedTo` and `Aligned` molecules, the `Align Chains` button can be actioned to apply chain-based re-alignment.
* After chain re-alignment, the `Aligned` viewer camera is matched to the `AlignedTo` viewer camera (zoom, pan target, and orientation) so both viewers show the same viewpoint.

### Re-align implementation note

- Chain re-alignment now prefers an in-place transform of the currently loaded aligned structures for faster iteration.
- Console diagnostics for re-alignment include fit-quality metrics (`movingSelectedAtomCount`, `referenceSelectedAtomCount`, `atomPairCount`, and `rmsd`) are available when debug flags are enabled.

Ribosome data can be downloaded from the [RCSB Protein Data Bank](https://www.rcsb.org/pages/about-us/index) in CIF format. Two datasets which align well are: [4ug0](https://files.rcsb.org/download/4UG0.cif); and [6xu8](https://files.rcsb.org/download/6XU8.cif).

Synchronization is `Off` by default. If selected to be `On`, camera changes (rotation/pan/zoom) from the active viewer are propagated to the other viewer as relative deltas.

Please refer to the [Mol* viewer Documentation](https://molstar.org/viewer-docs/) for details of the Mol* UI. In each Ribocode `Molstar Container`, the `Mol* 3D Canvas` is always visible and the additional Mol* panels (`Sequence Panel`, `Main Menu`, `Control Panel`, `Log Panel`) are hidden by default so as not to clutter the UI. Use the `Show Advanced Mol* Controls` button in a column to expand those hidden by default panels for advanced usage, and use `Hide Advanced Mol* Controls` to collapse them again. The Mol* viewer style is adapted so that the UI fits in a column of 600 pixels in width.

For convenience, users can save and load a session via the Session Menu. Loading a session does not load the data. For security reasons data loading is a manual process, but once the `AlignedTo` and `Aligned` data are selected, the representations are recreated and the loaded session should be in the same state as when the session was saved.

Session `uiState` persists `Residue Zoom` settings and per-dataset `Include UniProt accession in chain labels` settings, so chain label formatting and residue zoom behavior are restored consistently when a session is loaded.

The `Session` > `Save All` saves all the data and all the UI state so that this can be reloaded using `Session` > `Load All`.
---