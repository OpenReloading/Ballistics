# Changelog

## [0.0.3](https://github.com/OpenReloading/Ballistics/compare/core-v0.0.2...core-v0.0.3) (2026-10-27)


### Features

* **core:** fit a chamber volume correction and note a volume that is not measured ([#229](https://github.com/OpenReloading/Ballistics/issues/229)) ([3b4c161](https://github.com/OpenReloading/Ballistics/commit/3b4c161004d42e4cca00287eb72285e8aee5e934))
* **core:** fit burn form and pressure exponent from a pressure-time curve ([#225](https://github.com/OpenReloading/Ballistics/issues/225)) ([211b9ce](https://github.com/OpenReloading/Ballistics/commit/211b9ce117de37b4fa8371aa568c477d2adbf235))
* **core:** fit energy and temperature factor from sessions at several barrel lengths and temperatures ([#233](https://github.com/OpenReloading/Ballistics/issues/233)) ([11a96ab](https://github.com/OpenReloading/Ballistics/commit/11a96abc92c2b3698e027bdd4a807b75a9460277))
* **core:** pressure range, similar-powder prior and confidence label of a powder fit ([#261](https://github.com/OpenReloading/Ballistics/issues/261)) ([9b59440](https://github.com/OpenReloading/Ballistics/commit/9b594400524501cdfa3d72c5f1df8697de045bc2))
* **web:** notes on a saved load when lots, seating, velocity or round count change ([#215](https://github.com/OpenReloading/Ballistics/issues/215)) ([98409f1](https://github.com/OpenReloading/Ballistics/commit/98409f16f4fef64cd90bffb4f8d49411ea1fd6de))

## [0.0.2](https://github.com/OpenReloading/Ballistics/compare/core-v0.0.1...core-v0.0.2) (2026-10-26)


### Features

* **api:** list every missing load file key, download resolved values ([#167](https://github.com/OpenReloading/Ballistics/issues/167)) ([820395f](https://github.com/OpenReloading/Ballistics/commit/820395f0f2f2f3e9a8a0626257224a3a22ace25a))
* **core,web:** pressure and velocity bands from sampled input tolerances ([60e8207](https://github.com/OpenReloading/Ballistics/commit/60e8207c8756243a5684bf5146522a59cc415fcf)), closes [#60](https://github.com/OpenReloading/Ballistics/issues/60)
* **core:** add prediction bands of a powder fit at any charge ([527711b](https://github.com/OpenReloading/Ballistics/commit/527711bbff4fddec3eb1cef01a7ed3b6e4b16090)), closes [#58](https://github.com/OpenReloading/Ballistics/issues/58)
* **core:** add priors and a Huber loss to the powder fit ([cce4190](https://github.com/OpenReloading/Ballistics/commit/cce4190e1a086776389b09547c410ce2af194ae0)), closes [#59](https://github.com/OpenReloading/Ballistics/issues/59)
* density altitude and a transonic stability check ([77e1d7a](https://github.com/OpenReloading/Ballistics/commit/77e1d7a0bd93fca1db6873aa555779f3416c85df)), closes [#48](https://github.com/OpenReloading/Ballistics/issues/48)
* hit probability from group dispersion, wind and range uncertainty ([2d5343e](https://github.com/OpenReloading/Ballistics/commit/2d5343e9a30adafdf8580e979e0c59920b948d1f)), closes [#50](https://github.com/OpenReloading/Ballistics/issues/50)
* moving target lead from angle, speed and time of flight ([e597932](https://github.com/OpenReloading/Ballistics/commit/e5979323d5755fbce9b693e3e325a356ed34cec7)), closes [#53](https://github.com/OpenReloading/Ballistics/issues/53)
* **release:** publish the libraries to npm under [@open-reloading](https://www.npmjs.com/org/open-reloading) ([#123](https://github.com/OpenReloading/Ballistics/issues/123)) ([a25e75f](https://github.com/OpenReloading/Ballistics/commit/a25e75f36e8f82b37efc807d93a6a1ee0cbef11f))
* velocity flat spots across a charge ladder ([1e4673d](https://github.com/OpenReloading/Ballistics/commit/1e4673dcad103167996fecf1699fb91ea081cc44)), closes [#52](https://github.com/OpenReloading/Ballistics/issues/52)
* **web:** powder-temperature ladder ([bb0c8a8](https://github.com/OpenReloading/Ballistics/commit/bb0c8a88b59d01b298b158f9ca70bba55b4d9de9)), closes [#35](https://github.com/OpenReloading/Ballistics/issues/35)


### Bug fixes

* accessibility, regular expression and style findings of SonarCloud ([#164](https://github.com/OpenReloading/Ballistics/issues/164)) ([91b8bdb](https://github.com/OpenReloading/Ballistics/commit/91b8bdbbb64d9be7115242149c37ad726db521cf))
* **core,web:** keep the band request across edits, print the corner-case range ([6be8f8f](https://github.com/OpenReloading/Ballistics/commit/6be8f8fad1787b8fe4a5b26fd5d9d66dde7d30c5)), closes [#60](https://github.com/OpenReloading/Ballistics/issues/60)
* **core:** checkAir rejects air whose density is out of range ([dfd3086](https://github.com/OpenReloading/Ballistics/commit/dfd30869b056c0c44fd68a390a97caeda209f3bd)), closes [#15](https://github.com/OpenReloading/Ballistics/issues/15)
* **core:** ignore an undefined prior entry in the powder fit ([87a835c](https://github.com/OpenReloading/Ballistics/commit/87a835c9cf2873108bcf54651833feb000823fb5)), closes [#59](https://github.com/OpenReloading/Ballistics/issues/59)
* **web:** say when the sampled band did not finish, test the band line ([0a1d3e3](https://github.com/OpenReloading/Ballistics/commit/0a1d3e3d7d805bdf5ce3186a884c27a01b8e6be6)), closes [#60](https://github.com/OpenReloading/Ballistics/issues/60)

## 0.0.1 (2026-10-22)


### Features

* first public version ([17b7bfa](https://github.com/OpenReloading/Ballistics/commit/17b7bfa7dfe088597de2cf16e2effaef1a9d692b))


### Bug fixes

* code scanning findings, property tests and the e2e hydration wait ([#14](https://github.com/OpenReloading/Ballistics/issues/14)) ([c2a7ecd](https://github.com/OpenReloading/Ballistics/commit/c2a7ecd5862c2810bc2805820ff68382cbe61fe7))
