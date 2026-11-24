# Developer Quick Start

You will need [Git](https://git-scm.com/) to clone the repository and [Node](https://nodejs.org/) version 24.11.0 or later.

Fork [Ribocode](https://github.com/ribocode-slola/ribocode1).

Run these commands from a terminal, replacing `<github_username>` with your GitHub username.

```sh
git clone https://github.com/<github_username>/ribocode1.git
cd ribocode1
git submodule update --init --recursive
npm install
npm run build:lib --workspace=molstar
```

The Mol* build is required because Ribocode imports its generated library; rebuild
it after changing the submodule checkout or Mol* source. A detached submodule HEAD
at the recorded commit is normal. The current Mol* 5.13.1-based pin has passed
the full library build; see the [Mol* setup notes](./DeveloperGuide.md#molstar)
for the pin and troubleshooting context.

Start the app:

```sh
npm run dev
```

Open the local URL printed by Vite, normally <http://localhost:5173/>.

To run tests from the repository root, first stop the development server (Ctrl+C)
so Playwright can start its own server on port 5173. Install Playwright's Chromium
browser before the first E2E run:

```sh
npx playwright install chromium
npx tsc --noEmit --pretty false
npm run test:pr
```

`test:pr` runs the unit/integration suite once and then the standard Playwright
suite; it does not run the TypeScript check above. For a smaller change, run
its focused tests first, for example `npm test -- --run path/to/file.test.ts`.
For alignment or viewer changes, also run the applicable forced-WebGL checks in
the [alignment testing reference](./AlignmentTesting.md). Standard browser tests
may skip WebGL-dependent checks; the WebGL suite is separate from `test:pr`.

On Linux, Playwright may also need system dependencies; see the
[Playwright setup instructions](./DeveloperGuide.md#system-dependencies-for-playwright-linux).
To reuse a running server for browser tests instead, use
`npm run test:e2e:reuse`. Run `npm run test:pr` with port 5173 free before
requesting PR review.

## Make a first contribution

From the Ribocode root, add the shared repository as `upstream` once (if it is
not already configured), update local `main` and create a feature branch:

```sh
git remote add upstream https://github.com/ribocode-slola/ribocode1.git
git switch main
git pull --ff-only upstream main
git switch -c my-change
```

After changing code, run focused tests and the checks above, then commit your
changes and push the branch to your fork:

```sh
git add <changed-files>
git commit -m "Describe the change"
git push -u origin my-change
```

Open a pull request from your fork's `my-change` branch into
`ribocode-slola/ribocode1:main` and record the tests you ran. If the submodule
pin changes when updating branches, save any submodule work, run
`git submodule update --init --recursive` and rebuild its library.

See the [Developer Guide](./DeveloperGuide.md) for the full setup, test, contribution,
and release workflows.
