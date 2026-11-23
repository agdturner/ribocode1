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
- 7WTT.cif -> 7WTZ.cif, chain e -> e currently improves only modestly and remains a known weak case.
- The current fit already includes both rotation and translation, so adding a second translation pass is not expected to fix weak fits by itself.
- A robust outlier-trim re-fit experiment was evaluated and did not improve the 7WTT/7WTZ e-case.

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

- Improve correspondence quality for difficult chain pairs (for example, long-chain e -> e cases) rather than adding extra translation-only corrections.
- Investigate residue-correspondence-aware pairing coverage in chain alignment tests, including gaps in automated checks for residue-key alignment behavior.
- Keep both benchmark families active during changes:
  - Strong-case guardrail: 6XU6/6XU8 CU -> CU should remain stable.
  - Weak-case guardrail: 7WTT/7WTZ e -> e should materially improve without regressions elsewhere.


See the [alignment development reference](./AlignmentDevelopment.md) for implementation and the developer-only experiment.
