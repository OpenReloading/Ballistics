# Changelog

## [0.0.3](https://github.com/OpenReloading/Ballistics/compare/api-v0.0.2...api-v0.0.3) (2026-10-27)


### Features

* **schema,data,api,web:** primer records, API and workbench picker ([#263](https://github.com/OpenReloading/Ballistics/issues/263)) ([5589507](https://github.com/OpenReloading/Ballistics/commit/558950741a48ce15623f99da0f5fe556f254611a))
* **schema,drawing,web,data:** DSU oval-ring faces b2 to b5 with their disciplines ([#260](https://github.com/OpenReloading/Ballistics/issues/260)) ([713ec86](https://github.com/OpenReloading/Ballistics/commit/713ec86c6eef3d26c2d2e4ae1632bfc34d380fa5))
* **schema,web:** structured bullet construction fields and a derived lead-free flag ([#259](https://github.com/OpenReloading/Ballistics/issues/259)) ([360326e](https://github.com/OpenReloading/Ballistics/commit/360326e6d51d29eea15478e82b2b2333c1d08540))
* **schema:** manufacturer references on the components of a load ([#223](https://github.com/OpenReloading/Ballistics/issues/223)) ([5009a62](https://github.com/OpenReloading/Ballistics/commit/5009a625f896e8e5eccb0f31caed4c475dbd1b20))
* **web,api,schema,data:** case records per cartridge ([#228](https://github.com/OpenReloading/Ballistics/issues/228)) ([dc70ef0](https://github.com/OpenReloading/Ballistics/commit/dc70ef0b64ec950f5c0f5b6ac7d0ba7107bcc199))
* **web,api,schema:** own cases as user records, listed and picked in the workbench ([#250](https://github.com/OpenReloading/Ballistics/issues/250)) ([0347181](https://github.com/OpenReloading/Ballistics/commit/03471817fd80d0ad34e275434eb6608d1ab30a0c))
* **web,schema:** range mode for offline entry of velocities, conditions and notes ([#262](https://github.com/OpenReloading/Ballistics/issues/262)) ([7aa702f](https://github.com/OpenReloading/Ballistics/commit/7aa702febf0e263a4ce656769a95fc91147caf2b))
* **web:** Federations as a Database tab ([#329](https://github.com/OpenReloading/Ballistics/issues/329)) ([ea786c6](https://github.com/OpenReloading/Ballistics/commit/ea786c6f00047377b73f4df732106fcfe55fc8a0))
* **web:** notes on a saved load when lots, seating, velocity or round count change ([#215](https://github.com/OpenReloading/Ballistics/issues/215)) ([98409f1](https://github.com/OpenReloading/Ballistics/commit/98409f16f4fef64cd90bffb4f8d49411ea1fd6de))
* **web:** powder designer ([#226](https://github.com/OpenReloading/Ballistics/issues/226)) ([f06205c](https://github.com/OpenReloading/Ballistics/commit/f06205c6b61e701f8535a394b66b9e102408f001))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/core bumped from 0.0.2 to 0.0.3
    * @open-reloading/data bumped from 0.0.2 to 0.0.3
    * @open-reloading/schema bumped from 0.0.2 to 0.0.3

## [0.0.2](https://github.com/OpenReloading/Ballistics/compare/api-v0.0.1...api-v0.0.2) (2026-10-26)


### Features

* **api:** in-process catalogue module next to the SQL layer ([f7a9bef](https://github.com/OpenReloading/Ballistics/commit/f7a9befbad673c77652ef7d2e9ace94670f273b3)), closes [#142](https://github.com/OpenReloading/Ballistics/issues/142)
* **api:** list every missing load file key, download resolved values ([#167](https://github.com/OpenReloading/Ballistics/issues/167)) ([820395f](https://github.com/OpenReloading/Ballistics/commit/820395f0f2f2f3e9a8a0626257224a3a22ace25a))
* **api:** refuse old catalogue builds and redirect renamed ids ([0bcd69e](https://github.com/OpenReloading/Ballistics/commit/0bcd69e2ca066e8f90a3a9de58dd1407d0feaad7)), closes [#146](https://github.com/OpenReloading/Ballistics/issues/146)
* **api:** routes and compute read from the catalogue ([72dd555](https://github.com/OpenReloading/Ballistics/commit/72dd5557b7ba99d98c48b24cd6c7c322618b8b90)), closes [#143](https://github.com/OpenReloading/Ballistics/issues/143)
* **api:** the load file route reads the load record ([6022b6f](https://github.com/OpenReloading/Ballistics/commit/6022b6fa7c9176ca634795ee27a1e8d150ec2fb8)), closes [#132](https://github.com/OpenReloading/Ballistics/issues/132)
* **api:** write the Pages data files from the catalogue ([3161597](https://github.com/OpenReloading/Ballistics/commit/3161597c5a165132523f94838726e45c23e5be9d)), closes [#145](https://github.com/OpenReloading/Ballistics/issues/145)
* **core,web:** pressure and velocity bands from sampled input tolerances ([60e8207](https://github.com/OpenReloading/Ballistics/commit/60e8207c8756243a5684bf5146522a59cc415fcf)), closes [#60](https://github.com/OpenReloading/Ballistics/issues/60)
* **data:** add BDS multi-distance disciplines and rule-book notes ([#114](https://github.com/OpenReloading/Ballistics/issues/114)) ([8ab8362](https://github.com/OpenReloading/Ballistics/commit/8ab8362d4dc3116724c4f868578e903b0fa4547a))
* **data:** caliber classes become catalogue records ([c174ad6](https://github.com/OpenReloading/Ballistics/commit/c174ad69a8ed2355f96e508bc486522195a05120)), closes [#138](https://github.com/OpenReloading/Ballistics/issues/138)
* hollow-base bullets in the schema, outline and seated volume ([7fbb22f](https://github.com/OpenReloading/Ballistics/commit/7fbb22f41b9873ffd76e50992583a03949010a8d)), closes [#23](https://github.com/OpenReloading/Ballistics/issues/23)
* **release:** publish the libraries to npm under [@open-reloading](https://github.com/open-reloading) ([#123](https://github.com/OpenReloading/Ballistics/issues/123)) ([a25e75f](https://github.com/OpenReloading/Ballistics/commit/a25e75f36e8f82b37efc807d93a6a1ee0cbef11f))
* **schema:** case capacity references ([#160](https://github.com/OpenReloading/Ballistics/issues/160)) ([3eb89de](https://github.com/OpenReloading/Ballistics/commit/3eb89deafca1703cc766a90a8b47193c2d6326be))
* **schema:** target faces name their federation by id and events carry ids ([e385467](https://github.com/OpenReloading/Ballistics/commit/e385467d8155a32afb92a1e0df67d4d32f77b6c8)), closes [#138](https://github.com/OpenReloading/Ballistics/issues/138)
* **schema:** user bullet and cartridge records as overrides of a catalogue record ([a6267bb](https://github.com/OpenReloading/Ballistics/commit/a6267bb0798e405aaed1ff0fc3ed4d5b3d29b458)), closes [#130](https://github.com/OpenReloading/Ballistics/issues/130)
* **web:** default order of disciplines and target faces per federation ([70db41b](https://github.com/OpenReloading/Ballistics/commit/70db41ba26e3bdf46a9f105497b6457fb4be053b)), closes [#102](https://github.com/OpenReloading/Ballistics/issues/102)
* **web:** designs as overrides, base changed, share links, re-save, offline lists ([#170](https://github.com/OpenReloading/Ballistics/issues/170)) ([58910ed](https://github.com/OpenReloading/Ballistics/commit/58910ed381cfc112693d0218e2154ab5ccafd7d4))
* **web:** designs resolve against their base record and loads keep the design by reference ([8d6cd66](https://github.com/OpenReloading/Ballistics/commit/8d6cd666b6ffa12c7af506d76e68ed899aa11a47)), closes [#130](https://github.com/OpenReloading/Ballistics/issues/130)
* **web:** powder-temperature ladder ([bb0c8a8](https://github.com/OpenReloading/Ballistics/commit/bb0c8a88b59d01b298b158f9ca70bba55b4d9de9)), closes [#35](https://github.com/OpenReloading/Ballistics/issues/35)
* **web:** rank the Pages edition's search as the API does ([17e9489](https://github.com/OpenReloading/Ballistics/commit/17e9489c3d324ce76cde7e5427d6bfbc507b89be)), closes [#143](https://github.com/OpenReloading/Ballistics/issues/143)
* **web:** unify chronograph sessions across imports, the workbench and target sheets ([#168](https://github.com/OpenReloading/Ballistics/issues/168)) ([bc1d594](https://github.com/OpenReloading/Ballistics/commit/bc1d594123001d2da9848da86b03ba13864e337b))
* **web:** zero atmosphere and drag factor per mounted optic ([66ce080](https://github.com/OpenReloading/Ballistics/commit/66ce080294832eb0a68d3e839840bdc2866f3d12)), closes [#20](https://github.com/OpenReloading/Ballistics/issues/20) [#20](https://github.com/OpenReloading/Ballistics/issues/20)


### Bug fixes

* accessibility, regular expression and style findings of SonarCloud ([#164](https://github.com/OpenReloading/Ballistics/issues/164)) ([91b8bdb](https://github.com/OpenReloading/Ballistics/commit/91b8bdbbb64d9be7115242149c37ad726db521cf))
* **api:** catalogue hash width, empty filters and test coverage of items and rank ([09b3973](https://github.com/OpenReloading/Ballistics/commit/09b397320c09ae077924ea9f8016fa0de236577e)), closes [#142](https://github.com/OpenReloading/Ballistics/issues/142)
* **api:** document the 308 of the id routes and pass the doc-type check ([1efa7df](https://github.com/OpenReloading/Ballistics/commit/1efa7df3765f2e4181bdd29c3363e17988478690)), closes [#146](https://github.com/OpenReloading/Ballistics/issues/146)
* **core,web:** keep the band request across edits, print the corner-case range ([6be8f8f](https://github.com/OpenReloading/Ballistics/commit/6be8f8fad1787b8fe4a5b26fd5d9d66dde7d30c5)), closes [#60](https://github.com/OpenReloading/Ballistics/issues/60)
* harden containers, CI workflows and scripts (SonarCloud) ([#165](https://github.com/OpenReloading/Ballistics/issues/165)) ([ca84d06](https://github.com/OpenReloading/Ballistics/commit/ca84d06f66f316a76fff4ba57f10adfad07f3fb6))
* resolve SonarCloud bug findings (unhandled promises, reduce, sort, page size) ([#159](https://github.com/OpenReloading/Ballistics/issues/159)) ([fb5e394](https://github.com/OpenReloading/Ballistics/commit/fb5e3945b5230123529b2b4346630c2c3ae6bd3c))
* **web:** a load of charge 0 saves, the gun weight returns on a reopened firearm ([19a4bf3](https://github.com/OpenReloading/Ballistics/commit/19a4bf3fde669c840845d86d59e50576fbe863f3)), closes [#132](https://github.com/OpenReloading/Ballistics/issues/132)
* **web:** build the catalogue entry of the API package in the web image ([4b6bcb4](https://github.com/OpenReloading/Ballistics/commit/4b6bcb4c30861227c1ec2adf734c21d1e252d7ee)), closes [#153](https://github.com/OpenReloading/Ballistics/issues/153)


### Performance

* **api:** turn JIT off on the database pool ([81bf778](https://github.com/OpenReloading/Ballistics/commit/81bf778c043a65828056d7491b18b06b29b13446)), closes [#140](https://github.com/OpenReloading/Ballistics/issues/140)


### Documentation

* **api:** describe the new order and ranking in the contract ([881cf27](https://github.com/OpenReloading/Ballistics/commit/881cf27490bacbbf4220ee295ac176a0906c4563)), closes [#143](https://github.com/OpenReloading/Ballistics/issues/143)
* **api:** give the cartridge answer a named type ([c3186c1](https://github.com/OpenReloading/Ballistics/commit/c3186c1be5447796567219116ad1dd8a1cc648df)), closes [#145](https://github.com/OpenReloading/Ballistics/issues/145)
* **api:** the load file route fills no workbench default ([1a9fecf](https://github.com/OpenReloading/Ballistics/commit/1a9fecfbdb0f84bc0f013edc0da0de731f955e90)), closes [#132](https://github.com/OpenReloading/Ballistics/issues/132)
* correct text that still named the SQL layer as the reader ([d33f964](https://github.com/OpenReloading/Ballistics/commit/d33f9647f48a84af0b1647f46328122da1e3795d)), closes [#143](https://github.com/OpenReloading/Ballistics/issues/143)
* describe the catalogue as what the API reads ([9ab1319](https://github.com/OpenReloading/Ballistics/commit/9ab1319b2328bb582bc8aee85d340f71e0b9aab8)), closes [#143](https://github.com/OpenReloading/Ballistics/issues/143)
* describe the Pages edition's catalogue index ([ecfd49b](https://github.com/OpenReloading/Ballistics/commit/ecfd49b954615955e7cb0ad36fa9077f8ea451a8)), closes [#145](https://github.com/OpenReloading/Ballistics/issues/145)
* drop PostgreSQL and the SQL layer from the guides and the data pages ([4b0c96d](https://github.com/OpenReloading/Ballistics/commit/4b0c96db634d04e1b8bc71958f054c1bced89ecb)), closes [#144](https://github.com/OpenReloading/Ballistics/issues/144)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/core bumped from 0.0.1 to 0.0.2
    * @open-reloading/data bumped from 0.0.1 to 0.0.2
    * @open-reloading/schema bumped from 0.0.1 to 0.0.2

## 0.0.1 (2026-10-22)


### Features

* first public version ([17b7bfa](https://github.com/OpenReloading/Ballistics/commit/17b7bfa7dfe088597de2cf16e2effaef1a9d692b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/core bumped from * to 0.0.1
    * @open-reloading/data bumped from * to 0.0.1
    * @open-reloading/schema bumped from * to 0.0.1
