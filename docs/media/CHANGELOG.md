## [v0.20.0] - 2026-10-27
Release summary: this minor release splits Representation Controls colour-theme management into separate Chain Theme and Residue Theme workflows, with independent save/load/selection persistence and new round-trip regression coverage.
- Split Representation Controls colour-theme UI in `src/components/LoadMolecule.tsx` into separate `Chain Theme` and `Residue Theme` sections, each with dedicated theme dropdown, load, remove, and save actions.
- Extended viewer prop wiring in `src/components/ViewerColumn.tsx` to pass separate chain/residue theme controls and file inputs while preserving compatibility with existing single-theme call paths.
- Added separate per-mode selected theme state in `src/App.tsx` (`selectedChainThemeName` and `selectedResidueThemeName` semantics) and immediate representation theme application when either selector changes.
- Added separate colour-theme file loading routes in `src/App.tsx` for chain and residue themes with theme-kind validation (`chain` vs `residue_type`) to prevent cross-kind uploads.
- Extended session `uiState.colorThemesByMode` persistence/restore in `src/App.tsx` to include `selectedChainThemeName` and `selectedResidueThemeName` (while keeping `selectedThemeName` for backward compatibility).
- Added residue-theme CSV export support in `src/App.tsx` (`residue_type,color`) alongside existing chain-theme export.
- Replaced single selected-chain colour editing with a searchable per-chain `Chain Colours` editor in `src/components/LoadMolecule.tsx`, with per-row swatch draft/apply controls aligned to chain-selector UX.
- Added Playwright regression coverage in `e2e/session-load-all-separate-theme-selectors.e2e.spec.ts` to verify `Save All`/`Load All` restores separate chain and residue theme selections.
- Updated integration coverage in `src/App.integration.test.tsx` for split chain/residue colour-load controls and expanded saved-session colour-theme state assertions.
- Updated component and integration tests in `src/components/LoadMolecule.test.tsx` and `src/App.integration.test.tsx` to validate searchable per-chain colour editing behavior.
- Updated the Mol* submodule in `packages/molstar` to upstream tag `v5.13.1` (gitlink `a4e9cc79415213263090ee47bf380d2a33e0118e`) and refreshed dependency lock state in `package-lock.json` for reproducible installs.
- Added dual Playwright execution modes for this upgrade cycle: strict mode in `npm run test:e2e` (requires a free local dev port) and reuse mode in `npm run test:e2e:reuse` for running against an already-started dev server.
- Updated six chain-colour/session E2E specs under `e2e/` to align selectors and interaction flow with the searchable per-chain editor introduced alongside the Mol* `v5.13.1` transition.

## [v0.19.0] - 2026-10-26
Release summary: this minor release fixes session reload fidelity for selected-chain colour state so control selection and rendered chain colouring restore identically, and adds stronger regression coverage for session round-trips.
- Fixed a session round-trip mismatch where selected-chain colour controls and rendered chain colours could diverge after load; custom theme selection and applied chain colouring now restore in parity.
- Fixed session `uiState` selection persistence/restore for second chain slot state (`chainId2`, `residueId2`, `residueIds2`) so `Save` and `Load` match `Save All` behavior.
- Added integration regression coverage in `src/App.integration.test.tsx` for Select Chain 2 session round-tripping.
- Added end-to-end regression coverage in `e2e/session-load-all-chain2-selections.e2e.spec.ts` for `Save All`/`Load All` restoration of chain and residue selections across both viewers.
- Hardened sync/session-load E2E stability in `e2e/session-load-sync-camera-order.e2e.spec.ts` by waiting for sync readiness before asserting `Sync: On`.
- Reduced duplicate session E2E setup logic by introducing shared helpers in `e2e/helpers/session-load.ts` and reusing them in session-load specs.

## [v0.18.0] - 2026-10-19
Release summary: this minor release adds true two-chain/two-residue-slot alignment behavior, refines chain/residue controls, and strengthens regression coverage for highlight and realignment workflows.
- Added two-slot chain selection behavior in `src/App.tsx`, `src/components/LoadMolecule.tsx`, and `src/components/ViewerColumn.tsx`, including optional chain-2 selection, chain-2 clear action, and nested per-slot controls.
- Updated chain and residue realignment in `src/App.tsx` so alignment uses all selected slot pairs when available (slot 1 + slot 2), rather than slot 1 only.
- Updated `Align Chains` labeling to show all selected chain codes when multiple slot pairs are selected, with label wiring in `src/App.tsx` and `src/components/GeneralControls.tsx`.
- Fixed and clarified mirrored highlight behavior across chain/residue/subunit controls for `AlignedTo`, with deterministic behavior checks in `e2e/highlight-mirror-state.e2e.spec.ts`.
- Added end-to-end regression coverage for combined two-chain highlighting in `e2e/combined-highlight-two-chains.e2e.spec.ts`.
- Added end-to-end regression coverage for multi-slot chain/residue realignment metrics in `e2e/multi-slot-realign-metrics.e2e.spec.ts`.
- Added focused test coverage updates in `src/components/GeneralControls.test.tsx` and `src/App.integration.test.tsx` for multi-selection summary and alignment behavior.

## [v0.17.0] - 2026-10-16
Release summary: this minor release expands residue selection workflows with bulk-select actions, residue-type grouping, invert selection, and shared-residue selection across chains.
- Added residue quick-selection actions in `src/components/LoadMolecule.tsx`: `Select All`, `Clear`, `Invert`, and `Select Shared`.
- Added residue-type buckets in `src/components/LoadMolecule.tsx` that display per-type counts (for example `ALA (n)`, `GLY (n)`) and allow add/remove toggling of all residues of a given type.
- Added shared-residue selection wiring in `src/App.tsx` by computing residue IDs common to the currently selected `AlignedTo` and `Aligned` chains and passing them into per-column residue controls.
- Threaded new residue bulk-selection props through `src/components/ViewerColumn.tsx` so both columns expose consistent residue-selection behavior.
- Added focused regression coverage in `src/components/LoadMolecule.test.tsx` validating quick-selection actions, residue-type toggles, and shared-selection behavior.

## [v0.16.10] - 2026-10-16
Release summary: this patch release hardens session transform restore reliability after chain realignment and fixes custom colour-theme application for mmCIF chain IDs so mapped chains no longer fall back to grey.
- Hardened Save/Load transform capture and restore in `src/App.tsx` by resolving structure refs from live Mol* hierarchy when state refs are stale/missing, reducing race-sensitive restore misses after `Align Chains` + `Save All` + `Load All`.
- Added temporary transform checkpoint diagnostics on `__ribocodeTestApi` in `src/App.tsx` to capture effective per-viewer structure transforms before save and after load for regression/debug visibility.
- Added integration regression assertions in `src/App.integration.test.tsx` to verify pre-save and post-load effective transform parity in the in-place chain realign session round-trip flow.
- Fixed custom chain colour-theme lookup in `src/utils/colors.ts` to prefer `auth_asym_id` with fallback to `label_asym_id`, with normalized chain-id matching (trim/case-insensitive) to avoid unintended grey fallback.
- Added focused unit regression coverage in `src/utils/colors.test.ts` for auth-vs-label chain ID matching and normalized key handling in custom theme application.

## [v0.16.9] - 2026-10-16
Release summary: this patch release fixes viewer camera/placement drift after `Align Chains` followed by `Save All` and `Load All` by persisting aligned-structure transforms in session state and restoring them before camera snapshots.
- Fixed session round-trip placement drift in `src/App.tsx` by persisting per-viewer structure transform matrices for `AlignedTo` and `Aligned` datasets in session `uiState`.
- Fixed session load restore ordering in `src/App.tsx` so saved structure transforms are applied before camera snapshot restore, keeping camera target/position consistent with restored aligned geometry.
- Added integration regression coverage in `src/App.integration.test.tsx` for in-place chain realign + session save/load transform persistence.
- Added end-to-end regression coverage in `e2e/session-load-all-chain-realign-camera.e2e.spec.ts` for `Align Chains -> Save All -> Load All` camera stability in viewer B.

## [v0.16.8] - 2026-10-15
Release summary: this patch release hardens session-load camera restore ordering when sync is enabled, and fixes inspect mirroring so hidden datasets do not show inspect focus in the opposite viewer.
- Fixed session-load camera restore sequencing in `src/App.tsx` by suspending sync propagation while per-viewer camera snapshots are applied, then re-enabling sync after restore settles.
- Added a sync-suspension guard to `src/components/buttons/Sync.tsx` and wired it through `src/components/GeneralControls.tsx` so camera propagation cannot run during session camera restoration.
- Added deterministic integration regression coverage in `src/App.integration.test.tsx` for loading sessions with sync already on while preserving distinct viewer camera snapshots.
- Added end-to-end regression coverage in `e2e/session-load-sync-camera-order.e2e.spec.ts` with fixture `e2e/test-session-sync-camera.json`.
- Fixed inspect synchronization in `src/App.tsx` and `src/utils/viewerHelpers.ts` so chain/residue/subunit inspect toggles only mirror to the opposite viewer when that dataset is currently visible there.
- Added integration regression coverage in `src/App.integration.test.tsx` for hidden-opposite viewer inspect toggles, plus helper-level validation in `src/utils/viewerHelpers.test.ts`.

## [v0.16.7] - 2026-10-14
Release summary: this patch release aligns Highlight/Inspect control state with per-viewer molecule visibility, clears stale inspect focus when datasets are hidden, and hardens E2E startup against stale local dev servers.
- Updated visibility semantics in `src/App.tsx` so Highlight/Inspect controls show `Off` and are disabled when the corresponding dataset is hidden in that viewer.
- Updated dataset-visibility toggles in `src/App.tsx` so hiding/showing a dataset no longer mutates residue/chain/subunit inspect toggle state.
- Fixed inspect-control wiring in `src/App.tsx` so each viewer row uses inspect handlers/state for its own dataset (not the other dataset in the same column), preventing cross-dataset residue inspect/detail changes.
- Updated molecule visibility UI semantics in `src/components/Molecule.tsx` so overall dataset visibility reflects dataset state directly and can remain visible even when all representations are hidden.
- Kept `Dim unselected` behavior selection-driven (not highlight-toggle-driven), preserving dimming when a valid chain/residue/subunit selection exists.
- Hardened Playwright local test startup in `playwright.config.ts` by setting `webServer.reuseExistingServer` to `false`, avoiding stale listener reuse that caused `page.goto` abort failures.
- Re-validated behavior with full Playwright E2E coverage (`18 passed`).

## [v0.16.6] - 2026-10-14
Release summary: this patch release fixes `Dim unselected` behavior so dimming remains active whenever a selection exists, even if highlight toggles are off.
- Fixed selection-display dimming logic in `src/App.tsx` so `Dim unselected` is gated by selection presence (chain/residue/subunit selection), not by highlight toggle state.
- Added and exported a deterministic selection predicate helper (`hasSelectionForDisplayDim`) in `src/App.tsx` to make dimming behavior explicit and testable.
- Added focused unit regression coverage in `src/App.test.tsx` for dim-selection gating across chain, residue, and subunit selection cases, plus no-selection negative cases.
- Verified targeted app/unit/integration suites for this behavior path remain green.

## [v0.16.4] - 2026-10-14
Release summary: this patch release strengthens regression detection for residue realignment by adding fast low-level tests that catch residue atom-extraction failures before end-to-end runs.
- Added focused unit regression coverage in `src/App.test.tsx` for residue atom extraction used by residue realignment.
- Added a guard test to ensure selected residue atom IDs are preserved and not dropped by chain-id mismatch behavior.
- Exported the residue atom-extraction helper from `src/App.tsx` to enable direct low-level validation.
- Verified the new low-level checks alongside the targeted residue realignment E2E suite (`e2e/residue-realign.e2e.spec.ts`).

## [v0.16.3] - 2026-10-14
Release summary: this patch release fixes a residue-realignment regression where valid residue selections could produce no usable atom set, and adds focused regression coverage to keep this workflow stable.
- Fixed residue realignment atom extraction so selected residues consistently produce finite coordinate sets for alignment.
- Fixed residue chain-id lookup to support both auth and label asym identifiers when deriving residue mappings.
- Added focused Playwright E2E coverage in `e2e/residue-realign.e2e.spec.ts` for:
	- full-chain residue realign consistency against chain realign on `6XU6`/`6XU8` (`CU->CU`), and
	- targeted auth-range residue realign (`23..30`) for `7WTT` chain `w` to `AF-Q13895-F1-model_v6` chain `A`.
- Added residue realignment debug exposure via test API to make regressions fail fast with actionable diagnostics instead of opaque timeouts.

## [v0.16.2] - 2026-10-14
Release summary: this patch release improves alignment compatibility and reliability, and fixes visibility/camera behavior for default-hidden dual-viewer workflows.
- Added benchmark E2E coverage for chain-specific CU->CU alignment metrics on `6XU6`/`6XU8` to guard against fit-quality regressions.
- Added an alignment diagnostics E2E benchmark for the weaker `7WTT`/`7WTZ` `e->e` case to track non-ideal but expected behavior.
- Added ADR documentation for alignment quality gates and ownership split in `decisions/ADR-0001-alignment-quality-gates.md`, with guide/roadmap references.
- Fixed Viewer B reveal behavior for default-hidden structures by stabilizing camera framing/reset flow after visibility changes.
- Updated general molecule visibility controls so they reflect aggregate representation visibility and toggle all representations on/off.
- Fixed trajectory alignment fallback for datasets without phosphorus atoms by selecting a best shared atom type when the requested selector yields no atoms (for example protein-only `CA` datasets).
- Added regression coverage in `src/utils/alignmentGeometry.test.ts` to ensure default selector alignment no longer throws when only shared non-`P` atom types are present.

## [v0.16.1] - 2026-10-13
Release summary: this patch release restores expected chain realignment behavior for 6XU6/6XU8-style workflows.
- Fixed a chain realignment regression by reverting rigid-transform translation behavior in `packages/molstar/src/extensions/ribocode/utils/geometry.ts` to the prior stable coordinate path.

## [v0.16.0] - 2026-10-13
Release summary: this minor release improves chain-label correctness for mmCIF files where auth and label chain IDs collide, and adds focused regression coverage to keep chain search behavior reliable.
- Fixed chain label molecule-name mapping precedence so auth-chain mappings from `_pdbx_poly_seq_scheme` override colliding label-chain keys when needed.
- Fixed incorrect molecule-description carry-over in auth/label collision cases (for example, preventing chain `G` inheriting chain `e` `S30` description in `7WTT`-style mappings).
- Added regression coverage in `src/utils/uniprot.test.ts` for auth/label chain-ID collision handling during chain-to-molecule parsing.
- Added regression coverage in `src/utils/chain.test.ts` to verify final enriched labels remain correct for both chains in collision scenarios (`eS30` on auth `e`, `eS6` on auth `G`).
- Added chain-table search regression coverage in `src/components/ChainSelectionTable.test.tsx` to ensure `s30` matches only the intended chain label.
- Updated `src/utils/viewerHelpers.test.ts` highlight-on assertions to align with the explicit highlight display-mode argument (`overlay`) used by current helper signatures.

## [v0.15.0] - 2026-10-13
Release summary: this minor release improves highlight readability and reliability by introducing ordered multi-style highlighting, custom default highlight colours, and session persistence for highlight toggle state.
- Added per-representation opacity sliders in molecule controls so each representation can be faded in or out independently.
- Updated dataset highlight behavior to use shared mirrored state across viewers, so toggling highlight for a dataset applies consistently to both viewers.
- Fixed highlight desynchronization across chain/subunit/residue interactions by replacing incremental clear/apply logic with deterministic full reconciliation from current state.
- Updated default highlight visual style with distinct colours for each highlight type and explicit render ordering so subunit highlights apply first, then chain, then residues.
- Updated highlight rendering internals to serialize overpaint updates and avoid race conditions during rapid toggles.
- Added a selection display-mode control (`Highlight (halo)`, `Colour overlay`, `Hybrid`) and optional `Dim unselected` controls with adjustable strength.
- Persisted and restored selection display preferences in session `uiState` (`mode`, `dimUnselected`, `dimStrength`) with integration regression coverage.
- Fixed ViewerColumn pass-through wiring for selection-display controls so active panel interactions update app state correctly.
- Fixed add-representation camera behavior under sync by snapshotting and restoring both viewer cameras after representation creation.
- Fixed chain realignment translation behavior by applying centroid-aware rigid transforms consistently in Mol* geometry alignment.
- Updated Chain controls wording from `Selected Chain` to `Selected` for clearer, consistent terminology.
- Updated molecule representation-row layout to render representation controls on separate rows with compact spacing/indent for improved readability when multiple representations exist.
- Hardened E2E selector timing for aligned/alignedto file-load button independence under parallel test load.
- Added session save/load support for highlight toggle state (`chain`, `residue`, `subunit`) for both `AlignedTo` and `Aligned` datasets.
- Added regression coverage across unit/integration/E2E tests, including highlight interaction stability and session highlight-state persistence/round-tripping.
- Added [ROADMAP.md](./ROADMAP.md) to document planned future version themes and likely contribution areas.
- Updated `DeveloperGuide.md` to link developers to both roadmap direction and GitHub issues when choosing what to contribute.

## [v0.14.0] - 2026-10-09
Release summary: this minor release introduces a per-mode colour theme manager so users can keep multiple loaded themes available, choose the active theme for new representations, and safely manage theme lifecycle.
- Added a new `Colour Theme` selector for each load panel, with options for the default theme plus all loaded themes for that mode (`AlignedTo`/`Aligned`).
- Updated `Load Colours` behavior so each uploaded theme is added to a persistent in-session selection list instead of replacing the only available custom theme.
- Added `Remove Theme` support with guardrails: `Default` cannot be removed, and in-use themes are protected from removal until representations using them are switched.
- Updated representation creation so new representations always use the currently selected colour theme for the active mode.
- Extended session `uiState` save/load to persist and restore loaded colour themes (including parsed rows) and per-mode selected theme.
- Added regression coverage for colour-theme selector interactions, remove-theme behavior, selected-theme application during representation add, and session round-tripping.

## [v0.13.0] - 2026-10-08
Release summary: this minor release standardizes `Select and Zoom` control UX across subunit/chain/residue flows, clarifies chain-label controls, and improves selector/test stability.
- Updated `Re-align` to chains so sync is temporarily disabled while realignment runs, then restored to its prior enabled state.
- Standardized Subunit, Chain, and Residue control sections to a consistent nested layout with aligned indentation and action ordering (`Zoom`, `Highlight`, `Inspect`).
- Simplified action button labels across controls (for example `Zoom`, `Highlight: On/Off`, `Inspect: On/Off`) to reduce visual clutter.
- Added nested chain controls with `Show/Hide Chain Controls` and `Show/Hide Select Chain Control`; selected-chain summary/actions remain visible while select-table details can be collapsed.
- Changed chain-selection panel naming to `Select Chain` in both columns for clearer, symmetric terminology.
- Renamed chain-label toggle wording to `Include UniProt accession in chain labels` for consistency with `Show/Hide` section controls.
- Updated tests to prefer stable ID-based selectors for control actions and added regression coverage for nested chain-section visibility and repeated realign workflows.

## [v0.12.2] - 2026-10-08
Release summary: this patch release aligns chain re-alignment camera behavior across viewers for a consistent side-by-side viewpoint.
- Updated chain re-alignment camera behavior so after `Re-align` to chains, the `Aligned` viewer camera matches the `AlignedTo` viewer viewpoint (zoom, pan target, and orientation).
- Fixed camera snapshot type compatibility in `App.tsx` by using Mol* `Vec3` values when applying copied camera state (`position`, `target`, `up`).
- Updated tests to match diagnostics-gated logging behavior in `src/utils/data.ts` (removed stale always-log assertion in `data.test.ts`).
- Tightened `App.test.tsx` mock typing for `makeZoomHandler` to avoid TypeScript spread/tuple inference errors.

## [v0.12.1] - 2026-09-04
Release summary: this patch release stabilizes repeated chain re-alignment, clarifies highlight vs inspect behavior, and reduces default diagnostic console noise.
- Split `Highlight` and `Inspect` behavior for subunit/chain/residue controls so simple highlighting no longer triggers focus/details inspect side effects.
- Fixed inspect toggle wiring in active viewer panels so `Inspect Chain` and `Inspect Residues` reliably toggle on/off.
- Switched basic highlight flows to persistent selection channels, preserving highlights during viewer interaction and pointer movement.
- Added follow-selection highlight synchronization so active highlights update when selected subunit/chain/residue changes.
- Hardened chain re-alignment atom fitting by preferring anchor atoms and deterministic residue-key pairing (`shared-residue-keys`) before fallback strategies.
- Improved chain re-alignment fit quality for problematic pairs (for example `CU -> CU`) by preventing mismatched positional atom pairing.
- Made repeated in-place chain re-alignment idempotent by composing each operation against a stable operation-specific baseline transform.
- Added regression coverage for repeated chain realign stability while preserving repeat availability.
- Reduced temporary troubleshooting log noise by gating realignment and atom-extraction diagnostics behind disabled-by-default debug flags.

## [v0.12.0] - 2026-09-02
Release summary: this release improves alignment and camera-sync reliability in dual-viewer workflows, and updates Mol* interaction behavior so right-clicking empty canvas space no longer resets zoom to full extent.
- Fixed `Select Subunit` filtering so chain options are populated from real inferred subunit mappings (`All`, `Large`, `Small`, `Other`) instead of a fallback default bucket.
- Added `Zoom to Subunit` controls for each viewer/molecule panel, using the selected subunit chain set for camera focus.
- Added `Re-align to Subunit` in General Controls, enabled only when valid non-`All` subunits are selected on both datasets and disabled after an already-applied subunit pair.
- Added dedicated Playwright E2E coverage for subunit re-alignment button state transitions in `e2e/subunit-realign.e2e.spec.ts`.
- Updated `Select Residue` to support multi-residue selection per viewer, while keeping session compatibility via legacy first-selected `residueId` fallback.
- Updated `Zoom to Residue` so when multiple residues are selected the camera focuses the combined loci of all selected residues (instead of only the first).
- Moved `Residue Zoom` (`extraRadius`, `minRadius`) and `Show UniProt accession in chain labels` to per-viewer controls directly below each viewer's `Zoom to Residue` button, with per-viewer session save/load support and legacy global-field fallback.
- Fixed residue-code extraction so labels use meaningful residue/nucleotide codes from residue/atom comp IDs instead of malformed fallbacks (e.g. preventing `ATOM` -> `ATO`).
- Added residue code normalization for RNA/protein conventions and updated residue labels to Mol*-style `code number [auth n]` (for example `A 12 [auth 12]`, `GLY 70 [auth 70]`).
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