# Alignment Testing Reference

## Alignment regression testing

Alignment changes should be validated with both automated and manual checks before release.

Reference decision record: [ADR-0001 Alignment Quality Gates](decisions/ADR-0001-alignment-quality-gates.md).

### Post-alignment camera and clipping checks

These checks validate viewer consistency, not the molecular fit. Camera parity should also be checked with `PW_E2E_FORCE_WEBGL=1`: the default
browser mode did not consistently reproduce a clipping readback regression.
Mol* exposes clipping radius as a rounded percentage. When reflecting camera events
in the controls, do not write an unchanged percentage back through `setProps`:
that round trip quantizes the exact camera radius and can undo realignment parity.
Intentional clipping changes must still be applied.

Run the focused camera/residue/clipping checks with software WebGL:

```sh
npm run test:e2e:webgl -- e2e/residue-realign.e2e.spec.ts e2e/clipping-controls-live-sync.e2e.spec.ts e2e/clipping-sync-after-molstar-reset-zoom.e2e.spec.ts e2e/clipping-sync-after-molstar-wheel-zoom.e2e.spec.ts e2e/sync-and-realign-camera.e2e.spec.ts
```

The full-ribosome residue and related live-clipping/repeat-alignment workflows have
240-second budgets. Load readiness must wait for the Aligned visibility control's
`Hide` accessible label, not merely visibility of its disabled `Show Aligned`
placeholder. The camera check requires both snapshots and a maximum difference
below `0.0001`; it polls for completion because fit metrics precede asynchronous
structure transforms and camera restoration.

### Molecular fit and benchmark checks

Recent findings from benchmark datasets:

- 6XU6.cif -> 6XU8.cif, chain CU -> CU is currently stable with strong improvement.
- 7WTT.cif -> 7WTZ.cif contains distinct `E` and `e` chains. After correcting
  case-sensitive lookup, the `e` fit uses 20 pairs out of 55 moving C-alpha
  anchors and measured 0.354 Angstrom RMSD. This limited coverage does not
  establish general fit quality. Earlier 262-pair results used the wrong chain.
- The current fit already includes both rotation and translation, so adding a second translation pass is not expected to fix weak fits by itself.
- Multi-chain anchor fitting currently uses only the first selected chain pair;
  the metric's chain ID list alone does not establish that later pairs contributed.
  The e/E browser diagnostic records this limitation; it is not a quality gate
  for a combined fit.
- A robust outlier-trim re-fit experiment was evaluated and did not improve the 7WTT/7WTZ e-case.

### Offline multi-chain weighting diagnostic

Run the diagnostic separately to print its report:

```sh
npm test -- --run --maxWorkers=1 --disableConsoleIntercept src/utils/multiChainAlignmentDiagnostic.test.ts
```

This developer-only experiment fits one transform using either equal atom-pair
weights or equal total weight per chain pair. It reports per-pair anchor counts,
coverage, fit weight, and RMSD under the shared transform and each pair's own
transform. Coverage uses the observed C-alpha anchor counts in each input, not
the full biological sequence. The 7WTT/7WTZ diagnostic matches unique author
residue number, insertion code and component; duplicate keys are excluded. It
does not handle renumbered chains and is not the production pairing policy.
Low coverage or a large shared-versus-individual difference warrants further
investigation; neither establishes a cause or an automatic exclusion threshold.

On the e/E fixture, the fit used 20 e and 262 E pairs. Per-atom weighting gave
shared RMSDs of 0.494 and 0.326 Angstrom respectively; equal-chain weighting
gave 0.415 and 0.353 Angstrom. Individual fits were 0.354 and 0.316 Angstrom.
These particular pairs agree well; e has only 20/55 moving-anchor coverage.
Synthetic conflicting pairs also check that the weighting changes the compromise.
These measurements do not choose a production weighting policy.

### Developer-only multi-chain fit

Open the app with `?experimentalMultiChainAlignment=1` to enable the
experimental Align Chains path; without the flag the existing behavior is
unchanged. Select corresponding chains in the same slot on each side and press
Align Chains. Every occupied fixed or dynamic slot must have a chain on both
sides. A failed or ambiguous pair blocks the entire fit; it is not silently
excluded.

The experiment uses the first anchor type in `P`, `CA`, `C4'`, `C1'` order
with at least ten unique matches for each chain pair. A match uses author
residue number, insertion code and component; duplicate keys are excluded,
and missing author numbers or components cannot match. Unknown insertion codes
are treated as blank, following the offline diagnostic; the report warns about
this assumption and counts affected pairs. These keys do not establish sequence
correspondence and cannot handle renumbered chains reliably.
If residue-key coverage is below 50% on either side, the affected report row
warns, but the fit is still applied and no chain is excluded. Exactly 50%
does not trigger this warning. The threshold is an experimental prompt to
inspect the result, not a correctness guarantee; even a high-coverage match
can be wrong.

If no anchor type has ten key matches, the experiment tries a protein-only
sequence fallback using observed C-alpha anchors ordered by `label_seq_id`.
It rejects non-protein anchors, missing or duplicate sequence positions and
alignments larger than 2,000,000 matrix cells. Mol* aligns the observed amino
acid sequences using BLOSUM62; only identical known amino acids become pairs.
It requires at least ten pairs, at least 50% identity among aligned positions
and at least 50% matched-anchor coverage on each side. Forward and reversed
sequence alignments must produce the same identical-residue pairs. These
thresholds and the two-trace check are experimental safeguards, not proof of a
unique or biologically correct alignment; missing residues, repeats and
divergence remain sources of uncertainty. RNA does not have a sequence
fallback. No ordered atom pairing is used.

The shared fit gives each matched anchor pair equal weight. The persistent report
shows the last applied fit's correspondence method, sequence identity when
applicable, per-pair coverage, shared-fit RMSD and independent fit RMSD.
Observed counts include finite anchors of the chosen type even if they
cannot be matched. The report is not saved with sessions and may describe an
earlier selection after the user changes chains. The experiment is not a
production correspondence policy or a recommendation to deselect chains.

#### 6XU6/6xu8 CU and CP observation

A manual CU/CP selection and the automated fixture test both produce one shared
fit with 240 pairs. CU uses 55 protein-sequence pairs (57.9% identity; 55/96
reference and 55/99 moving anchors); its shared and individual RMSDs are 3.134
and 2.850 Angstrom. CP uses 185 residue-key pairs (185/185 on both sides);
its shared and individual RMSDs are 2.082 and 1.841 Angstrom.

All 185 CP matches carry the unknown-insertion warning. In each input, the
`_atom_site.pdbx_PDB_ins_code` value for every CP C-alpha anchor is `?`
(unknown). For those same label-chain and sequence positions, the
`_pdbx_poly_seq_scheme.pdb_ins_code` value is `.` (not present/not applicable)
and the author sequence numbers agree. This supports the blank-code assumption
for this example but does not make the atom-site values known or establish
biological correspondence. The experiment continues to warn.

Other tested pairs illustrate the limits of the safeguards: CO/CO has 205
residue-key matches and 0.982 Angstrom individual RMSD; deliberately mismatched
CP/CU is rejected because the forward and reverse sequence traces disagree.
However, deliberately mismatched CP/CO **is accepted**: 14 incidental residue
keys pass the minimum of ten, despite coverage of only 14/185 and 14/205 and
an individual RMSD of 20.135 Angstrom. The report now warns about its low
coverage but still applies the fit. Residue-key matches are not subject to
the sequence fallback's identity and coverage thresholds. A successful fit is
therefore not a correspondence-quality check; inspect the report and do not
rely on a fit merely because it was accepted. This known limitation needs a
separate policy decision before any production use.

```sh
npm test -- --run src/utils/experimentalMultiChainAlignment.test.ts
PW_E2E_FORCE_WEBGL=1 npx playwright test e2e/experimental-multi-chain-alignment.e2e.spec.ts --workers=1
```

### Conflicting chain fixture

The same diagnostic compares 7WTT/7WTZ author chains T (40S S19), F (40S S5)
and K (RRP12-like protein). Both files identify the chains with those descriptions.
Correspondences use matching author residue number, insertion code and component.
This is a candidate selected by screening these fixtures, not proof of the cause
of the observed differences:

| Pair | Matched C-alpha anchors (reference / moving observed) | Individual RMSD | Shared per-atom RMSD | Shared equal-chain RMSD |
|---|---:|---:|---:|---:|
| T | 144 (144 / 144) | 0.701 Angstrom | 16.291 Angstrom | 6.062 Angstrom |
| F | 189 (189 / 189) | 0.821 Angstrom | 12.510 Angstrom | 4.715 Angstrom |
| K | 909 (1022 / 909) | 1.425 Angstrom | 10.796 Angstrom | 15.853 Angstrom |

Per-atom weighting gives K 73% of the fit weight, while equal-chain weighting
gives each pair one third. Fitting T and F without K gives their RMSDs as 0.731
and 0.834 Angstrom; the excluded K anchors under that transform have 20.650
Angstrom RMSD.
This supports reporting trade-offs and coverage, not automatically deselecting
K or concluding that the mismatch is necessarily biological. Different sets
have different overall RMSD denominators and should be compared per pair.

Recommended focused automated checks:

```sh
npm test -- src/utils/alignmentGeometry.test.ts src/utils/realignment.test.ts src/App.test.tsx
npm test -- src/utils/alignmentPerformance.test.ts
npx playwright test e2e/alignment-performance-cu-6xu6-6xu8.e2e.spec.ts
npx playwright test e2e/alignment-diagnostic-e-7wtt-7wtz.e2e.spec.ts
```

Recommended manual benchmark workflow:

1. Load `AlignedTo` using `6XU6.cif`.
2. Load `Aligned` using `6XU8.cif`.
3. Select known chain pairs used in day-to-day analysis and run `Align Chains`.
4. Repeat alignment for the same pair and for several different pairs.
5. Confirm alignment quality does not degrade and that camera/viewpoint behavior remains consistent.

When alignment internals are changed:

- If the change is in `packages/molstar`, treat it as package-level geometry behavior and validate against the benchmark workflow above.
- If the change is in `src/App.tsx`, verify both in-place transform behavior and reload-based fallback behavior.
- Verify camera/viewpoint parity after sequential realign actions (for example chain -> residue and residue -> chain), not just fit metrics.
- Record any expected behavior changes in `CHANGELOG.md` so regressions are easier to trace.

Next alignment investigation focus:

- Improve correspondence quality and coverage for difficult chain pairs rather than adding extra translation-only corrections.
- Investigate residue-correspondence-aware pairing coverage in chain alignment tests, including gaps in automated checks for residue-key alignment behavior.
- Keep both benchmark families active during changes:
  - Strong-case guardrail: 6XU6/6XU8 CU -> CU should remain stable.
  - Weak-case guardrail: 7WTT/7WTZ e -> e should materially improve without regressions elsewhere.


See the [alignment development reference](./AlignmentDevelopment.md) for implementation and the developer-only experiment.
