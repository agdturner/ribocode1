# Alignment Development Reference

## Re-alignment implementation

Chain-based re-alignment now uses a staged approach in `src/App.tsx`.

### Two-Layer Alignment Model (Important)

Ribocode intentionally uses two related but distinct alignment layers:

- Geometry/frame alignment (coordinate-space):
  - Applied during load/parse to place structures into a comparable coordinate frame.
  - This keeps structural operations (selection loci, clipping behavior, fit computations, and session transform restore) numerically consistent across both viewers.
- View alignment (camera-space):
  - Applied after user-triggered realign actions so both viewers present the same viewpoint.
  - This is a UI consistency rule and is independent of whether the fitted atom coordinates are already correct.

Why we keep both layers:

- Geometry-only alignment can still look "wrong" to users if viewer cameras drift apart after sequential actions.
- Camera-only alignment makes visual parity easy, but can leave structures in different coordinate frames and complicate downstream structural logic.
- The current design keeps coordinate normalization for robust structural behavior, then enforces camera parity after realign actions for perceptual consistency.

Practical contract for contributors:

- Any action that changes `Aligned` structure transforms (chain/subunit/residue realign; in-place or reload fallback) should explicitly restore viewer camera parity.
- In current implementation this is done by copying camera A -> B after successful realign apply.
- If this contract is changed in future, update both this guide and regression tests together.

- Preferred path (in-place):
  - Fit is computed using `alignDatasetUsingChains` from the customized Mol* ribocode geometry utilities.
  - A rigid transform matrix is built from the fitted rotation and derived translation.
  - The transform is applied to existing aligned structures using `StateTransforms.Model.TransformStructureConformation`.
  - Applied in-place chain pairs are tracked and deduplicated so the same `(from, to)` pair is not transformed repeatedly.
- Fallback path (reload-based):
  - If in-place transform cannot be applied, the app falls back to the existing `ReAligned` loading flow using alignment data.
- Post-realign camera behavior:
  - After chain re-alignment is applied, the `Aligned` viewer camera is matched to the `AlignedTo` viewer camera (zoom, pan target, and orientation) to keep both viewers in the same viewpoint.
- Alignment-data transform behavior:
  - Mol* trajectory alignment application now uses full `rotation + translation` when `rotMat`, `centroid`, and `centroidReference` are available.
  - Equal-count fit mapping is normalized so `centroid` is the moving-set centroid and `centroidReference` is the reference-set centroid, matching the transform convention `R * (p - centroid) + centroidReference`.
- Diagnostics:
  - Re-alignment logs include chain atom summaries, atom selector mode, selected atom counts, pair count, and RMSD.
- Feature flag:
  - In-place path can be controlled via `ENABLE_IN_PLACE_CHAIN_REALIGN` in `src/App.tsx`.
- Sync behavior note:
  - Camera sync propagation is source-directed from the current `activeViewer` only.
  - Sync applies source camera deltas (pan/rotation/zoom) to the target viewer, preserving the target viewer's local frame instead of replacing it with the source camera frame.
  - Zoom propagation combines radius scaling and source camera-distance scaling (`|position-target|`) so wheel/dolly zoom is propagated even when radius does not change.
  - `activeViewer` switches based on pointer presence/interactions in a viewer (`pointerenter`, `pointermove`, `wheel`, `pointerdown`), so a click is not required to change sync source.
  - Viewer activation listeners are attached natively on the Mol* container in capture mode (`MolstarContainer`) for reliable detection across nested Mol* UI roots.
  - Unchanged source snapshots are ignored to avoid no-op camera churn.
  - A lightweight animation-frame poll loop keeps sync responsive during pan/zoom/rotation interactions where camera events may be sparse.
  - Poll frequency is configurable via `VITE_SYNC_POLL_INTERVAL_MS` (default `20`, clamped to `5..100`) in `.env`/`.env.production`.
- Utility helpers:
  - Re-align pair-key and dedupe helpers are implemented in `src/utils/realignment.ts` (`makeRealignPairKey`, `hasRealignPair`, `addRealignPair`).

### Cache and State Hygiene

Alignment regressions can be obscured by stale state from prior loads if either browser caches or in-memory transform caches are reused between scenarios.

Current policy:

- Do not force a full browser cache flush on every normal app initialization.
- Do clear internal alignment caches when loading a new dataset pair (AlignedTo or Aligned) so each load starts from a fresh transform baseline.
- Do provide explicit diagnostics/test hooks for manual and automated cache resets.
- Provide a user-facing troubleshooting reset (`Session > Reset Local Caches`) so reporters can quickly verify whether issues persist after a clean local state reset.

Why we do not hard-flush all browser caches at startup:

- It can degrade performance by defeating normal browser and service-worker caching.
- It can interfere with offline/PWA behavior.
- It can unexpectedly remove persisted local state users may rely on.
- It does not target the main source of alignment confusion (in-memory transform carryover), so it is broader than necessary.

Recommended practice for debugging and regression tests:

- In E2E setup, perform a hard browser-state reset when validating initial-load parity scenarios:
  - clear `localStorage` and `sessionStorage`
  - clear IndexedDB databases
  - unregister service workers
  - clear Cache Storage
- Also clear app-internal alignment caches before taking diagnostics snapshots.

Reference regression test:

- `e2e/initial-load-transform-stability.e2e.spec.ts` validates that a hard cache flush + fresh load yields stable initial aligned transforms across repeated runs.

## Developer-only initial alignment experiment

Start `npm run dev` and open `http://localhost:5173/?experimentalInitialAlignment=1`
**before loading files**. Load AlignedTo and then Aligned normally. This opt-in fits
reciprocal RNA sequence-identical C4' anchors; it does not change manual chain/residue
alignment. Without the query parameter, or in a production build, the default initial
alignment is unchanged.

Every observed RNA polymer chain must have a unique reciprocal match, at least 20
known identical residues, at least 90% identity among aligned positions and at least
80% identical coverage on both sides. Ambiguous, insufficient, unsupported or
over-budget matching warns and leaves both datasets centered but **unfitted**, rather
than using the default fit. The comparison is limited to 50 million sequence matrix
cells and uses observed residues, not complete deposited sequences.

Console diagnostics use `[Experimental Initial Alignment]`; development test API
`getExperimentalInitialAlignment()` reports the outcome. Parsing/fitting errors
remain load errors, not unfitted successes. Session restoration bypasses this
experiment; do not use Save/Load round trips to validate an experimental baseline.
This option is not yet release-ready: full PR-suite qualification, a passing full
Mol* library build and experimental session-baseline round trips remain outstanding.
The production Vite/PWA bundle builds successfully, but that does not certify the
full Mol* library build. The geometry source/runtime mismatch is resolved as described
below. See the [ADR's current-status section](./decisions/ADR-0001-alignment-quality-gates.md) for validation results and known blockers.

The source/runtime geometry mismatch was subsequently repaired on Mol* branch
`fix/rigid-alignment-centroid-mapping`: all count branches now apply
`R * (moving - movingCentroid) + referenceCentroid`, retaining the single-pair
translation guard. Both source and regenerated library tests pass. The source changes
are committed and pushed to `agdturner/molstar` at
`2d4fd2c68fe4cdf600ebb38a84e9030bed4f8725`, and Ribocode's submodule pin now identifies
that source. Fetching this SHA from the configured shared Mol* remote was verified.

A full Mol* library build currently also encounters unrelated Express route-parameter
type errors. The geometry dependency tree can be rebuilt without those server entry
points using the root repository's TypeScript compiler:

```sh
node node_modules/typescript/bin/tsc packages/molstar/src/extensions/ribocode/utils/geometry.ts --target es2018 --module esnext --moduleResolution node --esModuleInterop --strict --skipLibCheck --rootDir packages/molstar/src --outDir packages/molstar/lib
node node_modules/typescript/bin/tsc packages/molstar/src/extensions/ribocode/utils/geometry.ts --target es2018 --module commonjs --moduleResolution node --esModuleInterop --strict --skipLibCheck --rootDir packages/molstar/src --outDir packages/molstar/lib/commonjs
npm run build:lib-extra --workspace=molstar
```

This focused rebuild validates geometry only; it is not evidence that the full
Mol* library build passes. Generated library files are not committed.

```sh
npm run test -- --run src/utils/experimentalInitialAlignment.test.ts
npm run test:e2e:webgl -- e2e/initial-alignment-coordinate-diagnostic.e2e.spec.ts
```


See the [alignment testing reference](./AlignmentTesting.md) for regression checks.
