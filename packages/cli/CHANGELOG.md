# Changelog

## [0.0.2](https://github.com/OpenReloading/Ballistics/compare/cli-v0.0.1...cli-v0.0.2) (2026-11-09)


### Features

* **ballistics:** add the ballistics package with the exterior models ([#1024](https://github.com/OpenReloading/Ballistics/issues/1024)) ([6038aac](https://github.com/OpenReloading/Ballistics/commit/6038aac5d72c2bd6838f47ba301a2aea88691c12))
* **ballistics:** move the interior model and the record helpers into ballistics ([#1038](https://github.com/OpenReloading/Ballistics/issues/1038)) ([1ac9bd7](https://github.com/OpenReloading/Ballistics/commit/1ac9bd721bbfaf47f9c042d9850242f70ed8e85d))
* **schema:** store where the user entered a source and a range exclusion as values, not English text ([#1132](https://github.com/OpenReloading/Ballistics/issues/1132)) ([9b56a82](https://github.com/OpenReloading/Ballistics/commit/9b56a8248e79604ebea042916756732f0029d1b8))
* **statistics:** add the statistics package and the test kit ([#1013](https://github.com/OpenReloading/Ballistics/issues/1013)) ([6a7ef0a](https://github.com/OpenReloading/Ballistics/commit/6a7ef0a5d0f2de689b39d822fa2505a72db25b67))
* **statistics:** one check of the solver limits and one percentile; truing refuses unusable limits ([#1077](https://github.com/OpenReloading/Ballistics/issues/1077)) ([b181937](https://github.com/OpenReloading/Ballistics/commit/b18193777942846387df4a03e4b512c0edb9de13))
* **units:** add the units package with the new-package gate profile ([#996](https://github.com/OpenReloading/Ballistics/issues/996)) ([fee565b](https://github.com/OpenReloading/Ballistics/commit/fee565bdccc35afb221db665c2526e7103eee004))
* **use-cases:** add the use-cases package with the compute task protocol ([#1094](https://github.com/OpenReloading/Ballistics/issues/1094)) ([7e1441b](https://github.com/OpenReloading/Ballistics/commit/7e1441bb51998661ef6f37755505cfe4ce1961c0))


### Documentation

* long rationale comments move to the docs with one-line pointers ([#1113](https://github.com/OpenReloading/Ballistics/issues/1113)) ([7ea9a4f](https://github.com/OpenReloading/Ballistics/commit/7ea9a4f6658d85fa1d8b4d30aac98b5edac199f5))
* one-line comments in tools, cli, the apps' scripts and tests, and the small packages ([#1135](https://github.com/OpenReloading/Ballistics/issues/1135)) ([a7ec598](https://github.com/OpenReloading/Ballistics/commit/a7ec5981642f3de5429bbd4b1b498d3652882870))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/api bumped to 0.0.6
    * @open-reloading/catalog bumped to 0.0.6
    * @open-reloading/drawing bumped to 0.0.5
    * @open-reloading/schema bumped to 0.0.6

## 0.0.1 (2026-11-02)


### Features

* **cli:** ready command for the measured check of the propellant-temperature energy term ([#367](https://github.com/OpenReloading/Ballistics/issues/367)) ([#968](https://github.com/OpenReloading/Ballistics/issues/968)) ([6a8e179](https://github.com/OpenReloading/Ballistics/commit/6a8e1790cb14fc8a2c73b622f9fb15d2f05100c4))
* **cli:** verify and compare held-out model evaluation ([#406](https://github.com/OpenReloading/Ballistics/issues/406)) ([d0b9202](https://github.com/OpenReloading/Ballistics/commit/d0b920239073991dfe5f06b690747d0c0b5b9d83))
* **cli:** verify and compare read the catalogue's published loads, muzzle-corrected, pressure by basis ([#913](https://github.com/OpenReloading/Ballistics/issues/913)) ([054e5c0](https://github.com/OpenReloading/Ballistics/commit/054e5c0810ff684ee3e8dc3312e3157048f824fa))
* pre-release batch of command line, importer, firearm and size check work ([#659](https://github.com/OpenReloading/Ballistics/issues/659)) ([e468295](https://github.com/OpenReloading/Ballistics/commit/e46829524214011f7e7c6f7bb26752b6ffb8cff7))
* pre-release batch of firearm views, box label, load-file importer and research entries ([#656](https://github.com/OpenReloading/Ballistics/issues/656)) ([5d38b2c](https://github.com/OpenReloading/Ballistics/commit/5d38b2cd057a9f0d6e2757dcf833501a1ab0268e))
* pre-release batch of limits, tests and research entries ([#589](https://github.com/OpenReloading/Ballistics/issues/589)) ([7b36740](https://github.com/OpenReloading/Ballistics/commit/7b36740b42ca2804b65cb0d707c1c51702b82b3e))
* pre-release batch of tests, fixes and research entries ([#612](https://github.com/OpenReloading/Ballistics/issues/612)) ([df1f134](https://github.com/OpenReloading/Ballistics/commit/df1f1347845b62b98a153896a7f27caefd56befb))
* pre-release batch of workbench record chooser, notes area, print fixes, photo guide and command line operations ([#688](https://github.com/OpenReloading/Ballistics/issues/688)) ([db2b2da](https://github.com/OpenReloading/Ballistics/commit/db2b2dae53086aa27177764e6dc91d0f0699e78f))
* pre-release integration of the 1.0 work ([#493](https://github.com/OpenReloading/Ballistics/issues/493)) ([46ace26](https://github.com/OpenReloading/Ballistics/commit/46ace26932aa37546eaf95f905870c0606abfb8d))


### Bug fixes

* **cli:** name the cause, option and column in usage errors ([#549](https://github.com/OpenReloading/Ballistics/issues/549)) ([6701ea4](https://github.com/OpenReloading/Ballistics/commit/6701ea4b54ee42ce13a47ca647dc9641422c6ab5))
* **cli:** print the usage on stdout with exit 0 for --help ([#544](https://github.com/OpenReloading/Ballistics/issues/544)) ([bc0a9cc](https://github.com/OpenReloading/Ballistics/commit/bc0a9cca9a70630618c7aea8e054d6207f6c232a))
* second batch of audit fixes for messages, contrast, German layout and offline start ([#744](https://github.com/OpenReloading/Ballistics/issues/744)) ([c01a781](https://github.com/OpenReloading/Ballistics/commit/c01a7816faea53693d1941ffc830c536764a88e7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/api bumped from 0.0.4 to 0.0.5
    * @open-reloading/core bumped from 0.0.3 to 0.0.4
    * @open-reloading/data bumped from 0.0.4 to 0.0.5
    * @open-reloading/drawing bumped from 0.0.3 to 0.0.4
    * @open-reloading/schema bumped from 0.0.4 to 0.0.5
