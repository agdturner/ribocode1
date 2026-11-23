# ADR-0001: Alignment Quality Gates and Ownership Split

- Status: Accepted
- Date: 2026-10-13
- Decision Makers: Ribocode maintainers

## Current investigation status (2026-11-23)

- Improved initial alignment remains a developer-only experiment; production defaults
  have not changed. Manual 6XU6/6XU8 comparison was positive.
- Geometry source/runtime mismatch is resolved and pinned to Mol* commit
  `2d4fd2c68fe4cdf600ebb38a84e9030bed4f8725`; formerly failing geometry tests now pass.
- An instrumented full-CU residue regression passed all assertions in 176 seconds.
  The previous 120-second budget could expire during loading or controls before fitting.
  Its readiness wait now requires the Aligned visibility control's accessible label
  to indicate `Hide`, rather than matching the disabled `Show Aligned` placeholder.
  Full-ribosome residue tests and the related clipping/repeat-alignment workflows
  use 240 seconds; the smaller AlphaFold test budget and all numerical assertions
  are unchanged. Aligned readiness allows up to 120 seconds for cold loading.
- Full PR-suite qualification, a passing full Mol* library build, experimental session
  round trips and broader structure validation remain required before release.
- The persistent camera-parity failure was reproduced with forced software WebGL:
  position, target and up matched exactly, but radius was 173.195677 in A versus
  172.354395 in B (difference 0.841282). Default browser runs could pass, so both
  modes matter when qualifying this regression.
- Root cause: Mol* reports clipping radius as a rounded integer percentage of the
  scene radius. App camera-event readback updated the clipping controls, whose
  fog/clipping effect wrote that percentage back to Mol*, quantizing the exact
  radius just copied during realignment. The effect now omits radius when the
  requested percentage already matches Mol*; intentional slider changes still apply.
- With that fix, all three residue regressions pass under forced software WebGL,
  including the unchanged camera threshold of 0.0001. Camera parity also passed a
  second focused run. Related reset-zoom, wheel/selection-mode clipping, live clipping
  and repeat-alignment checks pass across focused runs. Live clipping's interactive
  close/reopen check needs a 20-second polling budget on this environment.
- Camera helper/context/sync unit coverage passes (31 tests). TypeScript reports only
  the two previously known `container` TS2454 errors in `MolstarContainer.test.tsx`;
  the production Vite/PWA bundle builds successfully. Full PR-suite and full Mol*
  build qualification remain outstanding.

The dated investigation sections below preserve historical observations. Statements
about deliberately failing geometry tests or unresolved provenance describe earlier
checkpoints, not the current state.

The camera check now requires both snapshots and polls the same threshold instead
of silently skipping missing snapshots or using a fixed final delay. On failure it
includes normalized and raw snapshots to distinguish radius drift from orientation
or translation differences.

## Context

Ribocode alignment behavior is implemented across two layers:

- Application orchestration in src/App.tsx
- Geometry/fitting methods in packages/molstar

Recent benchmark work established one strong reference case and one weak case:

- Strong case: 6XU6.cif -> 6XU8.cif, chain CU -> CU
- Weak case: 7WTT.cif -> 7WTZ.cif, chain e -> e

The fit already includes rigid-body rotation and translation. Experiments showed that adding post-fit translation-only behavior is not a reliable fix for weak correspondence cases.

## Decision

1. Use benchmark-driven quality gates for alignment changes.
2. Treat correspondence quality as the primary improvement target for weak cases.
3. Keep implementation ownership split explicit:
   - App-level behavior/contracts documented in project docs.
   - Geometry-method behavior documented near molstar geometry implementation.

## Quality Gates

Any alignment algorithm change must satisfy all of the following:

1. No regression in strong-case benchmark behavior (6XU6/6XU8 CU -> CU).
2. Material improvement target for weak-case benchmark behavior (7WTT/7WTZ e -> e), or a documented reason if deferred.
3. Unit and E2E checks pass, including alignment metric tests.
4. In-place and fallback paths are both validated when App.tsx realignment logic changes.

## Required Automated Checks

Run at minimum:

- npm test -- src/utils/alignmentGeometry.test.ts src/utils/realignment.test.ts src/App.test.tsx
- npm test -- src/utils/alignmentPerformance.test.ts
- npx playwright test e2e/sync-and-realign-camera.e2e.spec.ts
- npx playwright test e2e/alignment-performance-cu-6xu6-6xu8.e2e.spec.ts
- npx playwright test e2e/alignment-diagnostic-e-7wtt-7wtz.e2e.spec.ts

## Follow-up Work

1. Investigate residue-correspondence-aware pairing in chain alignment for weak cases.
2. Expand explicit automated coverage for residue-based chain correspondence behavior.
3. Keep benchmark metrics in release notes when alignment internals change.

### Initial-load diagnostics (2026-11-23)

Initial loading modifies coordinates during mmCIF parsing. An identity structure-transform
matrix therefore does not establish that the initial fit is correct. Diagnose coordinate
alignment separately from camera orientation before changing either.

- [Geometry diagnostics](../src/utils/alignmentGeometry.test.ts) check an asymmetric
  structure with a known rotation and translation, including unequal selected-atom counts
  in both directions and atoms excluded from the fit. They exercise both the compiled
  runtime and the pinned Mol* TypeScript source.
- The first diagnostic run passed all three compiled-runtime cases but failed both
  unequal-count cases in the pinned source. Local generated `packages/molstar/lib`
  geometry differs from the source: the runtime uses a shared rigid-transform helper
  that is absent from the source. Do not rebuild or treat a source-only defect as the
  cause of the observed viewer behavior without checking this provenance.
- [Initial-load browser diagnostics](../e2e/initial-alignment-coordinate-diagnostic.e2e.spec.ts)
  compare actual atomic coordinates for each dataset across viewers, record phosphorus
  counts and centroids, measure CU C-alpha distances using shared author residue IDs,
  and record camera forward/up dot products before manual realignment. The CU anchors
  are a diagnostic for this known pair, not an automatic correspondence policy.
- The first browser run found identical coordinates across viewers for both datasets
  (219,765 reference atoms and 216,955 aligned atoms; maximum coordinate distance zero).
  Camera forward/up dot products were both 1 at capture time. Initial CU C-alpha RMSD
  was 107.963 Angstrom over 95 shared author-residue anchors; subsequent chain alignment
  reported 5.999 Angstrom and a 17.997-fold improvement. Initial phosphorus counts were
  5,910 and 5,906. This reproduces a poor molecular fit despite coordinate and camera
  parity, but does not yet establish whether atom correspondence or another fitting
  detail is responsible.
- Four of five browser checks passed. The full-CU residue-versus-chain check reached
  its 120-second total timeout while waiting for residue metrics; its final quality
  assertions were not reached. The other two residue checks passed. Do not consider
  residue realignment fully validated from this run. An isolated rerun also reached
  the 120-second timeout, so the failure cannot be attributed solely to concurrent
  unit-test/type-check work in the first run.

Run diagnostics with:

```sh
npm run test -- --run src/utils/alignmentGeometry.test.ts src/utils/alignmentPerformance.test.ts src/utils/realignment.test.ts
npm run test:e2e:webgl -- e2e/initial-alignment-coordinate-diagnostic.e2e.spec.ts
```

The source diagnostics intentionally remain failing pending a separate, validated fix.
The browser diagnostic records initial fit quality without imposing an unverified RMSD
threshold or camera-parity policy. Existing chain/residue quality gates remain required.

### Selector and pairing comparison (2026-11-23)

[Offline fixture diagnostics](../src/utils/initialAlignmentDiagnostic.test.ts) parse the
first model using Mol*, reproduce initial coordinate centralisation, and compare four
fits without changing application defaults. Candidate correspondence uses unique
author chain/residue/insertion-code, residue component, atom name and alternate-location
identities shared by the fixtures. This is fixture-specific matching, not a general
chain-homology or sequence-alignment algorithm. Duplicate identities are excluded.

All RMSDs below are in Angstrom. RNA evaluation uses shared P identities; protein
evaluation uses shared C-alpha identities. Evaluation overlaps the fit for matching
anchor types, so these are not independent validation scores. Protein evaluation is
excluded from the P-only fit.

| Pair | Fit | RNA RMSD | Protein RMSD | Author-ID chain proxy RMSD |
| --- | --- | --- | --- | --- |
| 6XU6/6XU8 | P, file order | 156.614 | 177.528 | 107.963 |
| 6XU6/6XU8 | P, shared identity | 2.519 | 2.140 | 6.130 |
| 6XU6/6XU8 | P + CA, shared identity | 2.529 | 2.114 | 6.138 |
| 6XU6/6XU8 | C4' + CA, shared identity | 2.530 | 2.114 | 6.137 |
| 7WTT/7WTZ | P, file order | 11.065 | 10.558 | 2.985 |
| 7WTT/7WTZ | P, shared identity | 10.840 | 9.920 | 3.543 |
| 7WTT/7WTZ | P + CA, shared identity | 11.043 | 9.380 | 4.653 |
| 7WTT/7WTZ | C4' + CA, shared identity | 11.042 | 9.381 | 4.650 |

- Only 270 of 5,906 ordered P pairs have matching identities in 6XU6/6XU8;
  identity pairing yields 5,906 RNA and 11,442 protein evaluation pairs.
- Only 539 of 1,575 ordered P pairs have matching identities in 7WTT/7WTZ;
  identity pairing yields 1,566 RNA and 5,295 protein evaluation pairs.
- The CU author-ID proxy reproduces the browser's 107.963-Angstrom initial measurement,
  but only **1 of its 95 author-number pairs has a matching residue component**.
  Do not describe this proxy, or the earlier browser CU metric, as verified biological
  correspondence. The chain-e proxy has matching components for all 20 pairs, but that
  alone does not establish sequence correspondence.
- Better pairing alone produces a large improvement in the strong fixture, without
  adding protein atoms to the fit. Mixed anchors provide a smaller additional protein
  improvement. The weak fixture has trade-offs, including a worse chain-e proxy.
  No candidate is approved as a universal replacement.

Reproduce with:

```sh
npm run test -- --run src/utils/initialAlignmentDiagnostic.test.ts --reporter=verbose
```

Next steps: inspect fixture chain/residue sequence correspondence, separate valid
biological anchors from numbering-based proxies, and validate candidates on additional
structures before proposing automatic pairing. Keep current chain/residue realignment
unchanged and retain all existing quality gates.

### Observed protein sequence correspondence (2026-11-23)

The offline diagnostics now use Mol*'s existing BLOSUM62 sequence aligner to rank
each target reference protein against all observed C-alpha chains in the moving
fixture. Sequences include only residues with observed C-alpha coordinates, with
alternate locations deduplicated. They are not complete deposited polymer sequences.
Unknown one-letter codes do not count as identical anchors. This report does not
change application pairing or establish a general acceptance threshold.

| Target | Observed lengths (reference/moving) | Aligned positions | Identical positions | Best/second candidate score |
| --- | --- | --- | --- | --- |
| 6XU6/6XU8 CU | 96 / 99 | 95 | 55 (57.9% of aligned positions) | CU: 278 / AZ: 5 |
| 7WTT/7WTZ e | 20 / 55 | 20 | 20 (100% of aligned positions) | e: 68 / Y: 11 |

- CU is the strongest sequence candidate, but **none of its 55 identical
  sequence-aligned residue pairs has matching author numbering**. The earlier
  numbering-based proxy pairs different sequence positions.
- For sequence-identical CU C-alpha anchors, the current order-based P fit gives
  108.291-Angstrom RMSD. Identity-paired P fitting reduces that to 3.057 Angstrom.
  These protein anchors are excluded from the P-only fit and support the initial-fit
  improvement independently of the earlier numbering proxy.
- For chain e, the 20 identical positions have matching author numbering, but cover
  only 36.4% of the moving chain's observed 55 residues. Its sequence-supported RMSDs
  equal the earlier chain-e proxy values; the candidate fits still have trade-offs.
- Candidate ranking is only in the reference-to-moving direction for these two
  targets. Reciprocal matches, ambiguous chains, RNA sequence correspondence and
  complete polymer sequences remain to be investigated before automatic matching.

### Reciprocal matching and RNA anchors (2026-11-23)

Protein target matching is now checked in both directions. CU and e are unique
top-scoring candidates reciprocally among observed protein chains.

RNA candidates are extracted from observed C4' atoms, deduplicated by author
chain/residue, then compared using Mol*'s default nucleotide scoring. All reference/
moving candidate combinations are scored. A match contributes sequence-identical
anchors only if it is the unique best-scoring match in both directions; ties and
non-reciprocal choices are excluded. The same score table supplies both rankings.
Unknown residue codes never contribute identical anchors.

- 6XU6/6XU8 has five reciprocal candidate pairs: A9, A7, A8, B2 and A5.
  The first four have identical observed sequences. A5 has 3,707 versus 3,703
  observed residues, with 3,703 identical aligned positions. Together these yield
  5,912 C4' anchors without using chain-name or author-number equality for pairing.
- 7WTT/7WTZ has a reciprocal chain-2 pair with 1,575 versus 1,624 observed
  residues and 1,567 identical positions (99.5% reference and 96.5% moving coverage).
  Reference candidate q contains only one unknown C4'-bearing residue and is
  non-reciprocal; it contributes no fit anchors. C4' presence alone is not a
  validated RNA-polymer classification, so this is explicitly a candidate report.

An offline fit using only those reciprocal, sequence-identical C4' anchors gives:

| Pair | Fit C4' RMSD | Evaluation P RMSD | Evaluation protein CA RMSD | Sequence-identical target CA RMSD |
| --- | --- | --- | --- | --- |
| 6XU6/6XU8 | 2.479 | 2.520 | 2.139 | 3.052 (55 CU pairs) |
| 7WTT/7WTZ | 11.062 | 10.841 | 9.908 | 3.597 (20 e pairs) |

P and protein CA evaluation atoms are excluded from this C4'-only fit. Broad
evaluation still uses shared fixture identities; only target CA evaluation uses
sequence-derived correspondence. The weak fixture's chain-e score remains worse
than the initial 2.985-Angstrom score, so the existing gates do not permit claiming
a universal improvement.

Synthetic checks confirm RNA sequence pairing ignores renamed chains/renumbered
residues, excludes unknown anchors, and reports equal scores for identical competing
sequences. No runtime alignment, selector or chain/residue realignment was changed.
Next investigate complete polymer metadata, tie/coverage acceptance and weak-fixture
domain motion before proposing an automatic initial-load policy.

### Polymer metadata and weak-case residuals (2026-11-23)

Offline candidate extraction now requires entity type `polymer` and the appropriate
Mol* subtype (`polyribonucleotide` for RNA or `polypeptide*` for protein). Reference
chain q in 7WTT is explicitly `non-polymer`, despite having a C4'-named atom and an
inferred polypeptide subtype; requiring both type and subtype excludes it. The
classified RNA candidates retain all 5,912 and 1,567 reciprocal anchors respectively,
so previous candidate-fit measurements are unchanged. Hybrid RNA/DNA and DNA entities
are not covered by this diagnostic policy.

Weak-fixture per-chain residuals after the reciprocal RNA fit are not uniformly small.
Independent offline fits on sequence-identical C-alpha pairs give:

| Chain | Global-fit identity CA RMSD | Independent sequence CA RMSD | Sequence pairs | Reference/moving identical coverage |
| --- | --- | --- | --- | --- |
| K | 20.376 | 1.425 | 909 | 88.9% / 100% |
| R | 19.946 | 1.654 | 81 | 100% / 66.4% |
| M | 17.138 | 1.043 | 108 | 100% / 87.8% |
| f | 14.032 | 2.524 | 57 | 100% / 78.1% |
| t | 10.473 | 11.453 | 56 | 94.9% / 44.1% |

Global and independent columns use different correspondence policies and sometimes
different pair counts; do not interpret them as a controlled before/after metric.
Nevertheless, several large global residuals coexist with good local rigid fits,
consistent with differing relative chain placement rather than a missing universal
translation. Chain t remains a poor local fit and needs separate correspondence/
structural inspection. These findings do not prove domain motion or establish a
single global transform that improves every chain.

No production acceptance thresholds have been selected. Candidate uniqueness,
reciprocity, known-residue identity, bilateral coverage and polymer classification
must be considered together; a unique candidate can still have low coverage. The
next implementation decision should distinguish initial whole-structure alignment
from targeted chain alignment and explicitly define acceptable global/local trade-offs.
Runtime chain/residue fitting remains unchanged.

### Approved developer-only integration (2026-11-23)

Maintainer choices: expose only through a development URL opt-in; allow the documented
weak-fixture global/local trade-off for this experiment only; if correspondence is
uncertain, warn and leave centered coordinates unfitted (do not fall back to the
legacy fit).

The prototype in [experimentalInitialAlignment.ts](../src/utils/experimentalInitialAlignment.ts)
requires unique reciprocal RNA polymer matches, at least 20 known identical residues,
90% aligned identity and 80% identical coverage bilaterally for every observed RNA
chain. Matching uses label-chain identity only to distinguish candidates, not to pair
them across structures. A 50-million-cell comparison limit bounds the quadratic
sequence aligner. Only RNA C4' anchors participate in this initial fit.

Enable with `?experimentalInitialAlignment=1` on the development server before
loading either file. Production and ordinary development loads remain unchanged.
Session restoration explicitly bypasses the experiment; experimental session-baseline
round trips are not supported yet. Both viewer parses receive the same explicit
rotation/centroid transform, using the existing parser path. ReAligned loads and
manual chain/residue fitting code are unchanged.

Acceptance: strong-fixture evaluation P and protein CA RMSD below 3 Angstrom,
sequence-identical CU CA RMSD below 4 Angstrom, coordinate parity across viewers,
explicit rejected-match outcomes, and working manual chain realignment after the
experimental fit. The weak-case exception does not relax default/release gates.
Source/runtime provenance and the full-CU residue-test timeout still block promoting
this experiment to a default.

Verification of the integration: nine acceptance unit tests pass (including the
20-pair/80%-coverage boundary); the broader 33-test unit run before those two boundary
additions passed. Browser checks passed for unchanged default coordinates, accepted
experimental coordinates in both viewers, manual CU chain alignment after the
experiment, and warned/centered protein-only rejection. A selected unchanged
7WTT/AlphaFold residue-realignment regression also passed. The Vite production build
passed. Standalone type-checking reports only the two existing unassigned `container`
diagnostics in MolstarContainer tests. The full suite was not run; the intentionally
failing pinned-source geometry diagnostics and full-CU residue timeout remain open.

### Checkpoint and restart (2026-11-23)

The maintainer manually retried 6XU6/6XU8 with the experiment and confirmed that the
initial alignment works much better. An earlier upside-down observation was withdrawn
after retrying. This supports the candidate but does not approve a new default.

Resume on branch `investigate/initial-alignment`:

1. Manually compare additional pairs, especially 7WTT/7WTZ, using the development URL
   `?experimentalInitialAlignment=1` before loading either file.
2. Reconcile pinned Mol* source with local generated runtime geometry before rebuilding
   Mol*. The two unequal-count source tests in alignmentGeometry.test.ts intentionally
   fail; the generated runtime currently passes them. Generated library files are not
   committed, so another checkout may behave differently until this is resolved.
3. Investigate the existing 120-second full-CU residue-versus-chain regression timeout.
4. Validate in-place/fallback manual alignment, session restoration and additional
   structures before promoting the experimental option. Experimental session baseline
   round trips are not supported; restoration currently uses the existing path.

This is a work-in-progress safety checkpoint, not a release-ready change. No release
version or default alignment policy has changed. The full PR suite has not passed on
this branch; targeted validation and its limitations are recorded above.

### Source/runtime geometry reconciliation (2026-11-23)

The Mol* source on branch `fix/rigid-alignment-centroid-mapping` now uses the same
rigid-coordinate helper as the previously working local runtime in all count branches.
For extra moving atoms, the previous source added the moving centroid rather than
the reference centroid. For extra reference atoms, it added the moving centroid before
rotation and subtracted it afterward. Both paths now consistently apply
`R * (moving - movingCentroid) + referenceCentroid`. Selection, truncation and rotation
fitting policy are unchanged. The pinned source's single-pair translation safeguard,
which was absent from the old generated runtime, is preserved.

Both unequal-count diagnostics now pass against source and regenerated runtime.
Additional single-pair source/runtime checks pass. Six Mol* Jest geometry tests pass,
and the rebuilt application's focused 79-test unit/integration run passed before the
two new single-pair checks. The subsequent geometry/performance/pair-tracking run
passes all 15 tests.

Build qualification: local dependencies were restored after TypeScript version drift
and missing packages were observed; no dependency manifests or lockfiles were changed.
The normal full library build remains blocked by unrelated Express server
route-parameter type errors. A focused TypeScript build regenerated the geometry
dependency tree in ESM and CommonJS, then ran the library asset/alias step. This
does not qualify the full library build as passing. Parent type-checking still reports
only the two existing MolstarContainer test diagnostics.

Seven rebuilt browser checks passed: default and experimental initial coordinates,
centered/unfitted rejection, CU and e chain benchmarks, repeat alignment in the camera
regression spec, and the selected 7WTT/AlphaFold residue regression. CU remains at
5.999-Angstrom chain RMSD with 17.997-fold improvement. The weak e diagnostic remains
poor (72.233-Angstrom RMSD over 262 chain-fit atoms); a passing diagnostic is not a
quality approval. This chain-fit metric uses different atoms from the earlier offline
20-pair C-alpha comparison and must not be conflated with it.

The reconciled source is committed and pushed to `agdturner/molstar` on branch
`fix/rigid-alignment-centroid-mapping`, commit
`2d4fd2c68fe4cdf600ebb38a84e9030bed4f8725`. Ribocode's submodule pin is updated to this
commit. Fetching the exact SHA from the configured `ribocode-slola/molstar` remote
succeeded, so the submodule URL does not need to change for this checkpoint.

## Consequences

- Alignment changes become easier to review objectively.
- Risk of repeating unstable experiments is reduced.
- Work remains traceable despite split ownership between App and customized Mol* code.
