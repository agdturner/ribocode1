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
at the recorded commit is normal. The full Mol* build has encountered Express
route-parameter type errors in the current development environment. If it fails,
see the [build notes](./AlignmentDevelopment.md#developer-only-initial-alignment-experiment);
the documented geometry-only workaround does not replace a full library build.

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
npm run test -- --run
npm run test:e2e
```

On Linux, Playwright may also need system dependencies; see the
[Playwright setup instructions](./DeveloperGuide.md#system-dependencies-for-playwright-linux).
To reuse a running server instead, use `npm run test:e2e:reuse`. Before requesting
PR review, run `npm run test:pr` with port 5173 free.

See the [Developer Guide](./DeveloperGuide.md) for the full setup, test, contribution,
and release workflows.
