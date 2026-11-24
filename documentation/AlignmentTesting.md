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
