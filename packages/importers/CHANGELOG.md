# Changelog

## [0.0.5](https://github.com/OpenReloading/Ballistics/compare/importers-v0.0.4...importers-v0.0.5) (2026-10-31)


### Features

* pre-release batch of command line, importer, firearm and size check work ([#659](https://github.com/OpenReloading/Ballistics/issues/659)) ([e468295](https://github.com/OpenReloading/Ballistics/commit/e46829524214011f7e7c6f7bb26752b6ffb8cff7))
* pre-release batch of firearm views, box label, load-file importer and research entries ([#656](https://github.com/OpenReloading/Ballistics/issues/656)) ([5d38b2c](https://github.com/OpenReloading/Ballistics/commit/5d38b2cd057a9f0d6e2757dcf833501a1ab0268e))
* pre-release batch of fits, hit probability, tuning and docs ([#569](https://github.com/OpenReloading/Ballistics/issues/569)) ([3a5c6a4](https://github.com/OpenReloading/Ballistics/commit/3a5c6a4a7be9d52d20eca911cdccd49ad2d104c4))
* pre-release batch of tests, fixes and research entries ([#612](https://github.com/OpenReloading/Ballistics/issues/612)) ([df1f134](https://github.com/OpenReloading/Ballistics/commit/df1f1347845b62b98a153896a7f27caefd56befb))
* pre-release integration of the 1.0 work ([#493](https://github.com/OpenReloading/Ballistics/issues/493)) ([46ace26](https://github.com/OpenReloading/Ballistics/commit/46ace26932aa37546eaf95f905870c0606abfb8d))


### Bug fixes

* **importers:** cap columns and cells of delimited text and JSON lists ([#545](https://github.com/OpenReloading/Ballistics/issues/545)) ([c72699d](https://github.com/OpenReloading/Ballistics/commit/c72699db6509228f26d04fd58e6dd1adfb3caf16))
* **importers:** reject numbers that overflow to Infinity ([#528](https://github.com/OpenReloading/Ballistics/issues/528)) ([15f97e0](https://github.com/OpenReloading/Ballistics/commit/15f97e0df5aa3f2b15b484164608adb2cb61bb7d))
* make six number and text patterns linear and name the page bar status line ([#531](https://github.com/OpenReloading/Ballistics/issues/531)) ([3359a1e](https://github.com/OpenReloading/Ballistics/commit/3359a1e3c90c683057d3bd3d57aacbf1f7dd9ec9))
* pre-release batch of audit fixes for import, API query checks, load file, data package and CI plan ([#698](https://github.com/OpenReloading/Ballistics/issues/698)) ([eba4c2c](https://github.com/OpenReloading/Ballistics/commit/eba4c2c703aaba75e1e50989d850691b46926a10))
* second batch of audit fixes for messages, contrast, German layout and offline start ([#744](https://github.com/OpenReloading/Ballistics/issues/744)) ([c01a781](https://github.com/OpenReloading/Ballistics/commit/c01a7816faea53693d1941ffc830c536764a88e7))


### Documentation

* add npm READMEs and package metadata to the published libraries ([#527](https://github.com/OpenReloading/Ballistics/issues/527)) ([21db896](https://github.com/OpenReloading/Ballistics/commit/21db896a6800ead1892216fb9918258dbb20834f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/schema bumped from 0.0.4 to 0.0.5

## [0.0.4](https://github.com/OpenReloading/Ballistics/compare/importers-v0.0.3...importers-v0.0.4) (2026-10-27)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/schema bumped from 0.0.3 to 0.0.4

## [0.0.3](https://github.com/OpenReloading/Ballistics/compare/importers-v0.0.2...importers-v0.0.3) (2026-10-27)


### Features

* **core:** fit burn form and pressure exponent from a pressure-time curve ([#225](https://github.com/OpenReloading/Ballistics/issues/225)) ([211b9ce](https://github.com/OpenReloading/Ballistics/commit/211b9ce117de37b4fa8371aa568c477d2adbf235))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/schema bumped from 0.0.2 to 0.0.3

## [0.0.2](https://github.com/OpenReloading/Ballistics/compare/importers-v0.0.1...importers-v0.0.2) (2026-10-26)


### Features

* **release:** publish the libraries to npm under [@open-reloading](https://www.npmjs.com/org/open-reloading) ([#123](https://github.com/OpenReloading/Ballistics/issues/123)) ([a25e75f](https://github.com/OpenReloading/Ballistics/commit/a25e75f36e8f82b37efc807d93a6a1ee0cbef11f))
* **schema:** chronograph sessions name the device maker by reference ([e406649](https://github.com/OpenReloading/Ballistics/commit/e406649943e0321d6b0767af6fb81be2126ee8c6)), closes [#135](https://github.com/OpenReloading/Ballistics/issues/135)
* **web:** unify chronograph sessions across imports, the workbench and target sheets ([#168](https://github.com/OpenReloading/Ballistics/issues/168)) ([bc1d594](https://github.com/OpenReloading/Ballistics/commit/bc1d594123001d2da9848da86b03ba13864e337b))


### Bug fixes

* accessibility, regular expression and style findings of SonarCloud ([#164](https://github.com/OpenReloading/Ballistics/issues/164)) ([91b8bdb](https://github.com/OpenReloading/Ballistics/commit/91b8bdbbb64d9be7115242149c37ad726db521cf))
* resolve SonarCloud bug findings (unhandled promises, reduce, sort, page size) ([#159](https://github.com/OpenReloading/Ballistics/issues/159)) ([fb5e394](https://github.com/OpenReloading/Ballistics/commit/fb5e3945b5230123529b2b4346630c2c3ae6bd3c))
* **web:** choosing a suggested manufacturer leaves the field showing the record ([ace9cf8](https://github.com/OpenReloading/Ballistics/commit/ace9cf8099784e6972f4f14f30f91ef855155085)), closes [#135](https://github.com/OpenReloading/Ballistics/issues/135)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/schema bumped from 0.0.1 to 0.0.2

## 0.0.1 (2026-10-22)


### Features

* first public version ([17b7bfa](https://github.com/OpenReloading/Ballistics/commit/17b7bfa7dfe088597de2cf16e2effaef1a9d692b))


### Bug fixes

* code scanning findings, property tests and the e2e hydration wait ([#14](https://github.com/OpenReloading/Ballistics/issues/14)) ([c2a7ecd](https://github.com/OpenReloading/Ballistics/commit/c2a7ecd5862c2810bc2805820ff68382cbe61fe7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/schema bumped from * to 0.0.1
