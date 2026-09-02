## [v0.12.0] - 2026-09-02
Release summary: this release improves alignment and camera-sync reliability in dual-viewer workflows, and updates Mol* interaction behavior so right-clicking empty canvas space no longer resets zoom to full extent.
- Fixed `Select Subunit` filtering so chain options are populated from real inferred subunit mappings (`All`, `Large`, `Small`, `Other`) instead of a fallback default bucket.
- Added `Zoom to Subunit` controls for each viewer/molecule panel, using the selected subunit chain set for camera focus.
- Added `Re-align to Subunit` in General Controls, enabled only when valid non-`All` subunits are selected on both datasets and disabled after an already-applied subunit pair.
- Added dedicated Playwright E2E coverage for subunit re-alignment button state transitions in `e2e/subunit-realign.e2e.spec.ts`.
- Updated `Select Residue` to support multi-residue selection per viewer, while keeping session compatibility via legacy first-selected `residueId` fallback.
- Updated `Zoom to Residue` so when multiple residues are selected the camera focuses the combined loci of all selected residues (instead of only the first).
- Fixed residue-code extraction so labels use meaningful residue/nucleotide codes from residue/atom comp IDs instead of malformed fallbacks (e.g. preventing `ATOM` -> `ATO`).
- Added residue code normalization for RNA/protein conventions and updated residue label order to `number code` (for example `12 A`, `70 GLY`).
- Added focused unit/integration regression coverage for residue label lookup, multi-selection persistence (`residueIds` + legacy `residueId`), and session round-tripping.
- Reordered per-column controls so representation actions (`Representation` selector/add button and `Load Colours`) appear before Select/Zoom controls.
- Added per-column `Show/Hide Select and Zoom Controls` toggle that controls Subunit/Chain/Residue selectors, zoom buttons, and Chain Finder together.
- Set Select/Zoom controls to be collapsed by default, and positioned the toggle immediately above `Show/Hide Advanced Mol* Controls`.
- Updated toggle button layout so `Show/Hide Advanced Mol* Controls` always appears below `Show/Hide Select and Zoom Controls` (stacked vertically).
- Moved per-molecule representation toggle rows (`MoleculeUI` visibility controls) to render immediately below each Mol* viewer, before `Load Molecule` controls.
- Fixed per-viewer clipping controls to drive Mol* `cameraClipping` parameters (`radius` and `minNear`) so slider changes now match visible clipping behavior in native Mol* Settings.

## [v0.11.0] - 2026-08-14
- Added a preferred in-place chain re-alignment path that applies rigid transforms directly to existing aligned structures in both viewers.
- Kept the existing reload-based `ReAligned` path as an automatic fallback if in-place transform application is unavailable or fails.
- Updated chain-fit atom selection to use atom types present in the selected chains, instead of relying on a narrow static default subset.
- Added re-alignment fit diagnostics in logs, including selected atom counts, atom pair count, and pairwise RMSD.
- Updated Mol* alignment-data application to use full rotation+translation when `rotMat` and centroids are available.
- Updated sync camera propagation to follow the current active viewer as the source, avoiding unintended camera pan/rotation updates from the inactive viewer.
- Updated sync propagation to apply source camera deltas (pan/rotation/zoom) onto the non-active viewer, preserving the non-active viewer's own local framing instead of hard-overwriting its target/centroid.
- Updated active-viewer detection so sync source follows pointer presence/interactions in a viewer (hover/move/wheel/pointer down), rather than requiring a click to switch source.
- Added camera-sync no-op suppression so unchanged source camera events are ignored.
- Fixed sync zoom propagation for cases where wheel/dolly updates camera distance (`position-target`) without changing radius; zoom now tracks distance scaling as well as radius changes.
- Added in-place re-alignment pair tracking to prevent repeated transform stacking when the same chain pair is re-aligned again.
- Corrected Mol* equal-count alignment centroid mapping so `centroid` (moving) and `centroidReference` (reference) match the trajectory transform convention `R * (p - centroid) + centroidReference`.
- Added regression coverage for sync directionality and repeated re-align guarding across unit, integration, and E2E tests.
- Disabled empty-space camera reset on right-click by overriding Mol* `camera-focus-loci` reset bindings, so background right-click no longer zooms out to full extent.

## [v0.10.0] - 2026-07-28
- Moved viewer rendering to the top of each column so the two Mol* canvases stay visually aligned even when control content differs between columns.
- Added a dedicated advanced-controls panel below the Chain Finder in each column, with `Show Advanced Mol* Controls` / `Hide Advanced Mol* Controls` placed directly above the panel.
- Reworked advanced-controls rendering to avoid unstable DOM reparenting of Mol* internal layout regions.
- Fixed a React unmount race triggered while toggling advanced controls (`Attempted to synchronously unmount a root while React was already rendering`).
- Added a standalone `MolstarAdvancedControls` component that renders advanced Mol* UI sections (sequence, structure tools, left panel, and log) using the active viewer plugin context.
- Updated tests covering advanced-controls toggle behavior and column ordering.

## [v0.9.0] - 2026-07-23
- Updated default post-load visibility behavior:
	- `AlignedTo` loads hidden by default in `Viewer B`.
	- `Aligned` loads hidden by default in `Viewer A`.
- Added and updated Playwright E2E coverage for visibility defaults and toggle behavior, and stabilized session representation-restore assertions.
- Added fallback chain-to-UniProt mapping from uploaded mmCIF text so chain labels can include accessions even when runtime Mol* model categories (`struct_ref` / `struct_ref_seq`) are unavailable.
- Wired `Show UniProt accession in chain labels` so Select Chain labels now include/removes accessions based on toggle state with reduced console logging noise.
- Preserved auth chain IDs in enriched labels (for example `ZB [auth CU]`) instead of collapsing to label-only forms.
- Added molecule-description enrichment to chain labels (for example appending `Ribosomal protein L22-like protein`) from loaded mmCIF metadata.
- Added per-column searchable chain-finder tables below viewers to make long chain lists easier to search and select.
- Updated `UserGuide.md` to document the visibility and chain-label behavior.

## [v0.8.4] - 2026-07-23
- Updated default visibility behavior after loading datasets:
	- `AlignedTo` is now hidden by default in `Viewer B` after loading via `Load AlignedTo`.
	- `Aligned` is now hidden by default in `Viewer A` after loading via `Load Aligned`.
- Added Playwright E2E coverage for the new default visibility behavior in `e2e/right-column-default-hidden.e2e.spec.ts`.
- Updated `UserGuide.md` to document the expected default-hidden viewer behavior for `AlignedTo` and `Aligned`.
- Added Node type definitions in `tsconfig.json` (`types: ["node"]`) to resolve TypeScript `process` name errors in editor diagnostics.

## [v0.8.3] - 2026-06-22
- Added live UniProt lookup status reporting in `General Controls` (cached, pending, and in-flight counts).
- Added explicit UniProt lookup progress logging and incremental per-batch chain label updates during background resolution.
- Added local-storage persistence for UniProt lookup results so cache survives browser reloads in addition to session save/load.

## [v0.8.2] - 2026-06-22
- Added UniProt gene-name enrichment for chain labels with background, rate-limited lookup and session-cached results.
- Added a `Show UniProt accession in chain labels` toggle in `General Controls`, persisted in session `uiState` and restored on load.

## [v0.8.1] - 2026-06-22
- Fixed session restore representation matching so saved color themes are preserved; type-only matches with different themes are now replaced with the saved representation.

## [v0.8.0] - 2026-06-22
- Updated chain labels to prefer ribosomal `family` names from `RP_name_table_uniprot.csv` (first column), shown in selectors as `<family> [<label>]` when matched.
- Added species-aware RP lookup resolution so each dataset uses the correct homolog column (arabidopsis, drosophila, human, yeast) with robust fallback to all-species mapping.
- Updated chain select option ordering to sort by displayed family label rather than raw chain ID.
- Added regression tests for species-specific CSV parsing, species inference from mmCIF source metadata, family label resolution, and chain option ordering.

## [v0.7.4] - 2026-06-22
- Extended session save/load to persist and restore UI state exactly, including `Residue Zoom` (`extraRadius`, `minRadius`), subunit/chain/residue selections for both columns, sync state, and active viewer.
- Added camera snapshot persistence for both viewers so orientation and zoom radius are restored on session load.
- Added integration coverage for `uiState` save/restore behavior, including regression checks for sync and camera state restoration.

## [v0.7.3] - 2026-06-22
- Fixed residue zoom wiring in `App.tsx` so `Residue Zoom extraRadius` and `minRadius` are passed through to Mol* focus calls.
- Added regression coverage for residue zoom option forwarding in `viewerHelpers` tests.
- Included chain/residue selection reliability fixes and chain label improvements using `RP_name_table_uniprot.csv` lookup data.

## [v0.7.2] - 2026-06-22
- Added per-column `Show Advanced Mol* Controls` / `Hide Advanced Mol* Controls` toggle below each viewer.
- Hid non-canvas Mol* interface panels (sequence, menu, controls, log) by default to reduce UI clutter.
- Kept the core Mol* `3D Canvas` visible, with advanced panels available on demand.

## [v0.7.1] - 2026-05-29
- Save/Load session buttons added.
- Code moved from App.tsx into hooks and components. Constants and Types defined separately. - Tests added for functional files.
- End to End (E2E) testing added using Playwright
  
## [v0.7.0] - 2026-01-02
- Added control to select a subunit to help filter chain selection.
- Commented out `Load Dictionary` and `Load Alignment` buttons.
- Added `Re-align` functionality.
- Added [User Guide](./UserGuide.md) and [Developer Guide](./DeveloperGuide.md).
- Started using [TypeDoc](https://typedoc.org/) to generate API documentation from TypeScript source code and comments.

## [v0.6.0] - 2026-01-01
- Added `Residue Zoom` controls for setting `extraRadius` and `minRadius`.

## [v0.5.1] - 2025-12-28
- General update to css styles and layout.
- Functionality to delete representations added.
- Functionality for zooming to residue.

## [v0.5.0] - 2025-12-24
- Functionality to choose the style of representation with a drop down.

## [v0.4.4] - 2025-12-22
- Added `Select Chain` buttons to select chains for AlignedTo and Aligned data.
- The `Select and Zoom` is replaced by `Zoom to:` buttons for each molecule in each viewer.
- If the viewers are set to sync, then the zoom happens in both. Otherwise the zoom happens only in the viewer where the `Zoom to:` button is actioned.

## [v0.4.3] - 2025-12-20
- Updated README.md
- Added LICENSE
- `Select and Zoom` button now zooms to a specific chain rather than the first atom.  