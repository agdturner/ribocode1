[![License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](./LICENSE)


# Ribocode

Ribocode orchestrates a User Interface (UI) based on two styled [Mol*](https://github.com/molstar/molstar) viewers and is specifically geared for comparing two [ribosome](https://en.wikipedia.org/wiki/Ribosome) datasets in [3D](https://en.wikipedia.org/wiki/Three-dimensional_space). It is deployed as a [Progressive Web App (PWA)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps) via GitHub Pages that can be easily duplicated. The latest version is released at the following URL:
* https://ribocode-slola.github.io/ribocode1/

An official Ribocode release includes deployment of the GitHub Pages PWA build.

The user requires a recent [Web browser](https://en.wikipedia.org/wiki/Web_browser) (e.g. [Firefox](https://www.firefox.com/)) that will run [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript), a large screen, a keyboard and a mouse.

Once installed as a PWA, Ribocode can be used offline.


## Documentation

For recent UI and workflow updates, see the [CHANGELOG](./CHANGELOG.md).

The generated API documentation is created locally by `npm run docs` into the `docs/` directory (entry point: `docs/index.html`).

Documentation is deployed when you run `npm run deploy` (the build copies `docs/` into `dist/docs` before publishing GitHub Pages).

For this repository, deployed API docs are available at:
* https://ribocode-slola.github.io/ribocode1/docs/index.html

For forks, the equivalent deployed URL is:
* `https://<username>.github.io/ribocode1/docs/index.html`

Please see the [User Guide](./UserGuide.md) for help using Ribocode.

For a cleaner default workspace, each viewer column shows the Mol* `3D Canvas` and hides extra Mol* panels by default. Advanced users can expand these per column using `Show Advanced Mol* Controls`.

Ribocode source code is mostly [TypeScript](https://www.typescriptlang.org/). The UI is based on the [React](https://react.dev/) library. Build and deployment is based on [Node](https://nodejs.org/) and [Vite](https://vite.dev/). General deployment is via [GitHub](https://github.com/). Other key technologies used for development include [Git](https://git-scm.com/), [GitHub Copilot](https://docs.github.com/en/copilot) and [Visual Studio Code](https://code.visualstudio.com/).


## Quick Start (for Developers)

To get started with development:

1. Clone the repository:
	```sh
	git clone https://github.com/ribocode-slola/ribocode1.git
	cd ribocode1
	```
2. Use Node 24.11.0+.
3. Install dependencies:
	```sh
	npm install
	```
4. Start the development server:
	```sh
	npm run dev
	```
	The app will be available at http://localhost:5173/

For more details, see the [Developer Guide](./DeveloperGuide.md).

## Typical Workflows

### First-use workflow 1: Load datasets, then save session

1. Load `AlignedTo` data.
2. Load `Aligned` data.
3. Work with representations/visibility and other controls, including `Highlight display` (`Highlight (halo)`, `Colour overlay`, `Hybrid`) and optional `Dim unselected`.
4. Save session state:
   - `Session > Save` to save session configuration.
   - `Session > Save All` to save session configuration together with wrapped input data for sharing with another user.

Saved sessions should preserve created representations and their visibilities, highlight toggles, and selection display preferences so the state can be restored on load.

### First-use workflow 2: Load a shared all-in-one session

1. Use `Session > Load All`.
2. Select a file supplied by another user.
3. Continue analysis from that restored state.

### Second-use workflow: Load a saved session and reattach data

1. Use `Session > Load` to load a previously saved session file.
2. When prompted, load the required `AlignedTo` and `Aligned` data files.
   - The filenames should match those referenced in the session file.
3. Continue work, then save again via `Session > Save` and/or `Session > Save All`.

## Testing

Ribocode includes automated unit, integration, and end-to-end (E2E) tests.

- **Unit/Integration tests:**
  ```sh
  npm test
  ```
- **E2E tests (Playwright):**
  ```sh
  npm run test:e2e
  ```
  Playwright will automatically start the dev server if needed.

See the [Developer Guide](./DeveloperGuide.md) for more on testing and best practices.

Ribocode is being developed as part of the [Ribocode project](https://ribocode.org/).


## Contributing

Ribocode project participants and Scientific Advisory Board members are encouraged to provide feedback, in particular describing what can be improved and what additional features are wanted. A good way to provide feedback is to comment on and create [issues](https://github.com/ribocode-slola/ribocode1/issues).

Before filing a bug report for unexpected UI/alignment behaviour, try `Session > Reset Local Caches` and re-test the same workflow. This clears local browser cache/storage used by Ribocode and reloads the app, which helps distinguish stale local state issues from reproducible defects.

Contributions from others are also welcome, please see the [Developer Guide](./DeveloperGuide.md) for more guidance on contributing.


## Acknowledgements

[UKRI](https://www.ukri.org/) funded the initial development of this tool under research grant [BB/X003086/1](https://gtr.ukri.org/projects?ref=BB%2FX003086%2F1).

The tool is based on other open source technology and has been developed with the use of both open source and proprietary technology and platforms. [GitHub](https://github.com) provided the main platform for developing the software. [GitHub Copilot](https://github.com/features/copilot) and [Microsoft Copilot](https://www.microsoft.com/en-gb/copilot) have been used to help develop the software and supporting documentation. Other key tools used in development include: [Visual Studio Code](https://code.visualstudio.com/); [Node](https://nodejs.org/en); [Vite](https://vite.dev/); and, [TypeDoc](https://typedoc.org/). A considerable number of third party dependencies listed in [package-lock.json](./package-lock.json) are required for the tool to function. Without these dependencies building this tool would have not been possible with the resources available. The main third party dependency is [Mol*](https://github.com/molstar/molstar) which should be acknowledged/cited in any publication along the following lines:
- David Sehnal, Sebastian Bittrich, Mandar Deshpande, Radka Svobodová, Karel Berka, Václav Bazgier, Sameer Velankar, Stephen K Burley, Jaroslav Koča, Alexander S Rose: [Mol* Viewer: modern web app for 3D visualization and analysis of large biomolecular structures](https://doi.org/10.1093/nar/gkab314), *Nucleic Acids Research*, 2021; https://doi.org/10.1093/nar/gkab314.