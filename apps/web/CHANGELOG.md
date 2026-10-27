# Changelog

## [0.0.4](https://github.com/OpenReloading/Ballistics/compare/web-v0.0.3...web-v0.0.4) (2026-10-27)


### Features

* **web:** develop and review the web app on data files without an API ([#314](https://github.com/OpenReloading/Ballistics/issues/314)) ([60a4488](https://github.com/OpenReloading/Ballistics/commit/60a44888543900d14f46ecff428dd46149015173))
* **web:** German UI foundation, language setting and catalogue ([#375](https://github.com/OpenReloading/Ballistics/issues/375)) ([5a07fbe](https://github.com/OpenReloading/Ballistics/commit/5a07fbe0b606b6308390e82bf7247d5906f8f4c3))


### Bug fixes

* **web:** verify and fix the accessibility candidate failures ([#323](https://github.com/OpenReloading/Ballistics/issues/323)) ([fd3fc10](https://github.com/OpenReloading/Ballistics/commit/fd3fc107c8eba63944940172c33ca61f03f28810))


### Documentation

* describe the single static edition and the API as its own product ([#381](https://github.com/OpenReloading/Ballistics/issues/381)) ([53dbcd4](https://github.com/OpenReloading/Ballistics/commit/53dbcd4a4fda15a7597668640dd28426cd7ef313))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/api bumped from 0.0.3 to 0.0.4
    * @open-reloading/data bumped from 0.0.3 to 0.0.4
    * @open-reloading/importers bumped from 0.0.3 to 0.0.4
    * @open-reloading/schema bumped from 0.0.3 to 0.0.4

## [0.0.3](https://github.com/OpenReloading/Ballistics/compare/web-v0.0.2...web-v0.0.3) (2026-10-27)


### Features

* **core:** fit a chamber volume correction and note a volume that is not measured ([#229](https://github.com/OpenReloading/Ballistics/issues/229)) ([3b4c161](https://github.com/OpenReloading/Ballistics/commit/3b4c161004d42e4cca00287eb72285e8aee5e934))
* **schema,data,api,web:** primer records, API and workbench picker ([#263](https://github.com/OpenReloading/Ballistics/issues/263)) ([5589507](https://github.com/OpenReloading/Ballistics/commit/558950741a48ce15623f99da0f5fe556f254611a))
* **schema,drawing,web,data:** DSU oval-ring faces b2 to b5 with their disciplines ([#260](https://github.com/OpenReloading/Ballistics/issues/260)) ([713ec86](https://github.com/OpenReloading/Ballistics/commit/713ec86c6eef3d26c2d2e4ae1632bfc34d380fa5))
* **schema,web:** structured bullet construction fields and a derived lead-free flag ([#259](https://github.com/OpenReloading/Ballistics/issues/259)) ([360326e](https://github.com/OpenReloading/Ballistics/commit/360326e6d51d29eea15478e82b2b2333c1d08540))
* **web,api,schema,data:** case records per cartridge ([#228](https://github.com/OpenReloading/Ballistics/issues/228)) ([dc70ef0](https://github.com/OpenReloading/Ballistics/commit/dc70ef0b64ec950f5c0f5b6ac7d0ba7107bcc199))
* **web,api,schema:** own cases as user records, listed and picked in the workbench ([#250](https://github.com/OpenReloading/Ballistics/issues/250)) ([0347181](https://github.com/OpenReloading/Ballistics/commit/03471817fd80d0ad34e275434eb6608d1ab30a0c))
* **web,schema,drawing:** measured lands contact of a firearm gives the jump ([#257](https://github.com/OpenReloading/Ballistics/issues/257)) ([e8e90e5](https://github.com/OpenReloading/Ballistics/commit/e8e90e58259020c62ab51cc243716e0432b24ab3))
* **web,schema:** range mode for offline entry of velocities, conditions and notes ([#262](https://github.com/OpenReloading/Ballistics/issues/262)) ([7aa702f](https://github.com/OpenReloading/Ballistics/commit/7aa702febf0e263a4ce656769a95fc91147caf2b))
* **web:** bullet from a photo, outline and measurements with uncertainty, open in designer ([#230](https://github.com/OpenReloading/Ballistics/issues/230)) ([3feb6a2](https://github.com/OpenReloading/Ballistics/commit/3feb6a2c3a0dbc308d2c2dde6f14886dc94affb2))
* **web:** Federations as a Database tab ([#329](https://github.com/OpenReloading/Ballistics/issues/329)) ([ea786c6](https://github.com/OpenReloading/Ballistics/commit/ea786c6f00047377b73f4df732106fcfe55fc8a0))
* **web:** fold My gear into the Database and add Your data to Settings ([#270](https://github.com/OpenReloading/Ballistics/issues/270)) ([5dd0279](https://github.com/OpenReloading/Ballistics/commit/5dd027928715434300d48e53a966b3fc1df5faba))
* **web:** hole detection on dark faces, on printed numerals and at bull quarter marks ([#224](https://github.com/OpenReloading/Ballistics/issues/224)) ([82f1ca0](https://github.com/OpenReloading/Ballistics/commit/82f1ca0473d4f2ebb6e40b5b04027214e1af0065))
* **web:** notes on a saved load when lots, seating, velocity or round count change ([#215](https://github.com/OpenReloading/Ballistics/issues/215)) ([98409f1](https://github.com/OpenReloading/Ballistics/commit/98409f16f4fef64cd90bffb4f8d49411ea1fd6de))
* **web:** one Database page and a My gear page in the navigation ([#258](https://github.com/OpenReloading/Ballistics/issues/258)) ([79b68f9](https://github.com/OpenReloading/Ballistics/commit/79b68f95b6ed44c4e6c62ba23a6e7c72b6e8d642))
* **web:** powder designer ([#226](https://github.com/OpenReloading/Ballistics/issues/226)) ([f06205c](https://github.com/OpenReloading/Ballistics/commit/f06205c6b61e701f8535a394b66b9e102408f001))


### Performance

* **web:** keep the seating slider at input speed ([#251](https://github.com/OpenReloading/Ballistics/issues/251)) ([232b0ee](https://github.com/OpenReloading/Ballistics/commit/232b0ee4cf6ea651204446e1b5c391d749cef2b5))


### Documentation

* **web:** add the German term table with sources ([#324](https://github.com/OpenReloading/Ballistics/issues/324)) ([6fbc3a4](https://github.com/OpenReloading/Ballistics/commit/6fbc3a45ee68a896cecdd243804c7b2ee8e0eeb6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/api bumped from 0.0.2 to 0.0.3
    * @open-reloading/core bumped from 0.0.2 to 0.0.3
    * @open-reloading/data bumped from 0.0.2 to 0.0.3
    * @open-reloading/drawing bumped from 0.0.2 to 0.0.3
    * @open-reloading/importers bumped from 0.0.2 to 0.0.3
    * @open-reloading/schema bumped from 0.0.2 to 0.0.3

## [0.0.2](https://github.com/OpenReloading/Ballistics/compare/web-v0.0.1...web-v0.0.2) (2026-10-26)


### Features

* **api:** list every missing load file key, download resolved values ([#167](https://github.com/OpenReloading/Ballistics/issues/167)) ([820395f](https://github.com/OpenReloading/Ballistics/commit/820395f0f2f2f3e9a8a0626257224a3a22ace25a))
* **api:** write the Pages data files from the catalogue ([3161597](https://github.com/OpenReloading/Ballistics/commit/3161597c5a165132523f94838726e45c23e5be9d)), closes [#145](https://github.com/OpenReloading/Ballistics/issues/145)
* **core,web:** pressure and velocity bands from sampled input tolerances ([60e8207](https://github.com/OpenReloading/Ballistics/commit/60e8207c8756243a5684bf5146522a59cc415fcf)), closes [#60](https://github.com/OpenReloading/Ballistics/issues/60)
* **data:** add BDS multi-distance disciplines and rule-book notes ([#114](https://github.com/OpenReloading/Ballistics/issues/114)) ([8ab8362](https://github.com/OpenReloading/Ballistics/commit/8ab8362d4dc3116724c4f868578e903b0fa4547a))
* **data:** add missing BDMP disciplines and target faces ([#115](https://github.com/OpenReloading/Ballistics/issues/115)) ([1bc4837](https://github.com/OpenReloading/Ballistics/commit/1bc48370ac2cc216f7bc85e5eadec3c5496cd51c))
* **data:** add the ISSF moving target disciplines and faces ([#117](https://github.com/OpenReloading/Ballistics/issues/117)) ([da96e18](https://github.com/OpenReloading/Ballistics/commit/da96e184906238932d6097d95ef0ec37d5bcb29f))
* **data:** caliber classes become catalogue records ([c174ad6](https://github.com/OpenReloading/Ballistics/commit/c174ad69a8ed2355f96e508bc486522195a05120)), closes [#138](https://github.com/OpenReloading/Ballistics/issues/138)
* **data:** DSB Sportordnung 2027, running target disciplines ([#113](https://github.com/OpenReloading/Ballistics/issues/113)) ([75f8cf9](https://github.com/OpenReloading/Ballistics/commit/75f8cf906dd3b648df5492a7b2ac1d6b36945a7d))
* density altitude and a transonic stability check ([77e1d7a](https://github.com/OpenReloading/Ballistics/commit/77e1d7a0bd93fca1db6873aa555779f3416c85df)), closes [#48](https://github.com/OpenReloading/Ballistics/issues/48)
* hit probability from group dispersion, wind and range uncertainty ([2d5343e](https://github.com/OpenReloading/Ballistics/commit/2d5343e9a30adafdf8580e979e0c59920b948d1f)), closes [#50](https://github.com/OpenReloading/Ballistics/issues/50)
* hollow-base bullets in the schema, outline and seated volume ([7fbb22f](https://github.com/OpenReloading/Ballistics/commit/7fbb22f41b9873ffd76e50992583a03949010a8d)), closes [#23](https://github.com/OpenReloading/Ballistics/issues/23)
* moving target lead from angle, speed and time of flight ([e597932](https://github.com/OpenReloading/Ballistics/commit/e5979323d5755fbce9b693e3e325a356ed34cec7)), closes [#53](https://github.com/OpenReloading/Ballistics/issues/53)
* **release:** publish the libraries to npm under [@open-reloading](https://github.com/open-reloading) ([#123](https://github.com/OpenReloading/Ballistics/issues/123)) ([a25e75f](https://github.com/OpenReloading/Ballistics/commit/a25e75f36e8f82b37efc807d93a6a1ee0cbef11f))
* **schema,web:** catalogue ids use recordId, newId works on insecure origins ([0f4c9db](https://github.com/OpenReloading/Ballistics/commit/0f4c9db4b85ae78269d9a307ec07f99c2d1053fa)), closes [#129](https://github.com/OpenReloading/Ballistics/issues/129)
* **schema:** bullets and firearms name their manufacturer by reference ([fc574ab](https://github.com/OpenReloading/Ballistics/commit/fc574ab911afa341a5f41896100d8eeb51f5087b)), closes [#135](https://github.com/OpenReloading/Ballistics/issues/135)
* **schema:** case capacity references ([#160](https://github.com/OpenReloading/Ballistics/issues/160)) ([3eb89de](https://github.com/OpenReloading/Ballistics/commit/3eb89deafca1703cc766a90a8b47193c2d6326be))
* **schema:** firearm in one shape in stored units ([4eba127](https://github.com/OpenReloading/Ballistics/commit/4eba127053eb9eb03fc57cdc1ee47dced5d768b7)), closes [#131](https://github.com/OpenReloading/Ballistics/issues/131)
* **schema:** one Load in stored units for the catalogue, user data and the load file ([0279e8f](https://github.com/OpenReloading/Ballistics/commit/0279e8fe55c0c58e7ae6a75530285a2225760b21)), closes [#132](https://github.com/OpenReloading/Ballistics/issues/132)
* **schema:** target faces name their federation by id and events carry ids ([e385467](https://github.com/OpenReloading/Ballistics/commit/e385467d8155a32afb92a1e0df67d4d32f77b6c8)), closes [#138](https://github.com/OpenReloading/Ballistics/issues/138)
* **schema:** user manufacturer record ([99be8e1](https://github.com/OpenReloading/Ballistics/commit/99be8e1e782ba4f372bf41c711c77a5839c2525c)), closes [#135](https://github.com/OpenReloading/Ballistics/issues/135)
* velocity flat spots across a charge ladder ([1e4673d](https://github.com/OpenReloading/Ballistics/commit/1e4673dcad103167996fecf1699fb91ea081cc44)), closes [#52](https://github.com/OpenReloading/Ballistics/issues/52)
* **web:** bullet search dialog prototype for the Bullet card ([#120](https://github.com/OpenReloading/Ballistics/issues/120)) ([c25679e](https://github.com/OpenReloading/Ballistics/commit/c25679ed96545dd5b4dcc0ac7491212d9cfdfc55))
* **web:** bullet search on the shared matcher in the field, Ctrl+K and the dialog ([#163](https://github.com/OpenReloading/Ballistics/issues/163)) ([f71b33b](https://github.com/OpenReloading/Ballistics/commit/f71b33b1614ad83713f11b2999fdfb458de0347c))
* **web:** cartridge table like the bullet table ([#180](https://github.com/OpenReloading/Ballistics/issues/180)) ([ef84936](https://github.com/OpenReloading/Ballistics/commit/ef849368eb44c3639355e73355d9d3d2d791814d))
* **web:** default order of disciplines and target faces per federation ([70db41b](https://github.com/OpenReloading/Ballistics/commit/70db41ba26e3bdf46a9f105497b6457fb4be053b)), closes [#102](https://github.com/OpenReloading/Ballistics/issues/102)
* **web:** delete an invalid record from the Open list ([b951d44](https://github.com/OpenReloading/Ballistics/commit/b951d444407e45d3c423cdb6340ed88a39495111)), closes [#147](https://github.com/OpenReloading/Ballistics/issues/147)
* **web:** designs as overrides, base changed, share links, re-save, offline lists ([#170](https://github.com/OpenReloading/Ballistics/issues/170)) ([58910ed](https://github.com/OpenReloading/Ballistics/commit/58910ed381cfc112693d0218e2154ab5ccafd7d4))
* **web:** designs resolve against their base record and loads keep the design by reference ([8d6cd66](https://github.com/OpenReloading/Ballistics/commit/8d6cd666b6ffa12c7af506d76e68ed899aa11a47)), closes [#130](https://github.com/OpenReloading/Ballistics/issues/130)
* **web:** dope card with clicks, wind brackets and paper sizes ([b34fd2d](https://github.com/OpenReloading/Ballistics/commit/b34fd2d33099fa592cd913e913e14e330495637e)), closes [#49](https://github.com/OpenReloading/Ballistics/issues/49)
* **web:** face search takes the scale of a calibrated sheet ([f6fd4ea](https://github.com/OpenReloading/Ballistics/commit/f6fd4ea524d647821be2940cb8437f7b4255238e)), closes [#32](https://github.com/OpenReloading/Ballistics/issues/32)
* **web:** firearm library, editor and Gun card read the stored-unit firearm ([1a9b2cc](https://github.com/OpenReloading/Ballistics/commit/1a9b2cc39eced64d7dc6725b14a8595eb286cf9c)), closes [#131](https://github.com/OpenReloading/Ballistics/issues/131)
* **web:** first-run step for the unit preset and the example load ([a01ea06](https://github.com/OpenReloading/Ballistics/commit/a01ea062cc1429618b9e4f02a4808d87778908ef)), closes [#42](https://github.com/OpenReloading/Ballistics/issues/42)
* **web:** keep and list invalid browser records, version the IndexedDB store ([c8621b8](https://github.com/OpenReloading/Ballistics/commit/c8621b8ef26e6bb7579517149a6ae20ac187b457)), closes [#137](https://github.com/OpenReloading/Ballistics/issues/137)
* **web:** manufacturer records with their records, delete unused, no offline duplicates ([#172](https://github.com/OpenReloading/Ballistics/issues/172)) ([8538853](https://github.com/OpenReloading/Ballistics/commit/8538853df3a7e79e3b1a7d5f94d74cef2ddeb245))
* **web:** message severities and no layout shift in the ladder target ([#202](https://github.com/OpenReloading/Ballistics/issues/202)) ([caf351d](https://github.com/OpenReloading/Ballistics/commit/caf351d0bad7c8cf127e5d457dd27c4b521f0a8f))
* **web:** one order for the target face picker lists, federation narrows faces ([bf99eca](https://github.com/OpenReloading/Ballistics/commit/bf99eca3a028def7980101bbf82f7cdc2e96d847)), closes [#31](https://github.com/OpenReloading/Ballistics/issues/31)
* **web:** powder lot rows and a barrel-time chart in the charge ladder ([f6ed7e9](https://github.com/OpenReloading/Ballistics/commit/f6ed7e9380eb1fa4c8b2f530ff55025ef2bd6990)), closes [#47](https://github.com/OpenReloading/Ballistics/issues/47) [#47](https://github.com/OpenReloading/Ballistics/issues/47)
* **web:** powder-temperature ladder ([bb0c8a8](https://github.com/OpenReloading/Ballistics/commit/bb0c8a88b59d01b298b158f9ca70bba55b4d9de9)), closes [#35](https://github.com/OpenReloading/Ballistics/issues/35)
* **web:** precache the catalogue index in the Pages edition ([ffe5dbc](https://github.com/OpenReloading/Ballistics/commit/ffe5dbc5788199ae9ad315b98742b30c8642ca21)), closes [#145](https://github.com/OpenReloading/Ballistics/issues/145)
* **web:** printable ladder target scaled to distance ([cf35939](https://github.com/OpenReloading/Ballistics/commit/cf359391f4e4cb3b72909e05525c3cdb2b48024c)), closes [#38](https://github.com/OpenReloading/Ballistics/issues/38)
* **web:** rank the Pages edition's search as the API does ([17e9489](https://github.com/OpenReloading/Ballistics/commit/17e9489c3d324ce76cde7e5427d6bfbc507b89be)), closes [#143](https://github.com/OpenReloading/Ballistics/issues/143)
* **web:** restore the invalid records of an Export all file on import ([bef1f6c](https://github.com/OpenReloading/Ballistics/commit/bef1f6ca0e3666cf8fff587c71d0c2869f74c400)), closes [#147](https://github.com/OpenReloading/Ballistics/issues/147)
* **web:** score oval rings, several bulls and square areas ([#122](https://github.com/OpenReloading/Ballistics/issues/122)) ([fbcee91](https://github.com/OpenReloading/Ballistics/commit/fbcee91aba7085341455d35cb368a43fa354e6a9))
* **web:** seat a bullet in the cartridge designer ([ade90ff](https://github.com/OpenReloading/Ballistics/commit/ade90ffd21fe36567c0cd4d9ea5df5a3466c5143)), closes [#40](https://github.com/OpenReloading/Ballistics/issues/40)
* **web:** target face designer ([#124](https://github.com/OpenReloading/Ballistics/issues/124)) ([8dc4bc2](https://github.com/OpenReloading/Ballistics/commit/8dc4bc2e8e129a21460ecb96045ce0d0ad474e6b))
* **web:** the workbench saves and opens the one Load ([3dd85e0](https://github.com/OpenReloading/Ballistics/commit/3dd85e00596ed3f7e78f8c901175a0ab2d802d3b)), closes [#132](https://github.com/OpenReloading/Ballistics/issues/132)
* **web:** truing section in the Trajectory tab ([bf0c46c](https://github.com/OpenReloading/Ballistics/commit/bf0c46c9c5ce86aa447e359347fa32b928b08887)), closes [#33](https://github.com/OpenReloading/Ballistics/issues/33)
* **web:** unify chronograph sessions across imports, the workbench and target sheets ([#168](https://github.com/OpenReloading/Ballistics/issues/168)) ([bc1d594](https://github.com/OpenReloading/Ballistics/commit/bc1d594123001d2da9848da86b03ba13864e337b))
* **web:** use cartridge designs in the workbench and the seating preview ([2c95e75](https://github.com/OpenReloading/Ballistics/commit/2c95e75498b2715a0d60e76ac09fd7ac94d6fd03)), closes [#41](https://github.com/OpenReloading/Ballistics/issues/41)
* **web:** UUID ids for new records, report dangling references ([ecc9d77](https://github.com/OpenReloading/Ballistics/commit/ecc9d77c424671b7dbad7f774f3f64e8827d7460)), closes [#129](https://github.com/OpenReloading/Ballistics/issues/129)
* **web:** zero atmosphere and drag factor per mounted optic ([66ce080](https://github.com/OpenReloading/Ballistics/commit/66ce080294832eb0a68d3e839840bdc2866f3d12)), closes [#20](https://github.com/OpenReloading/Ballistics/issues/20) [#20](https://github.com/OpenReloading/Ballistics/issues/20)


### Bug fixes

* accessibility, regular expression and style findings of SonarCloud ([#164](https://github.com/OpenReloading/Ballistics/issues/164)) ([91b8bdb](https://github.com/OpenReloading/Ballistics/commit/91b8bdbbb64d9be7115242149c37ad726db521cf))
* **core,web:** keep the band request across edits, print the corner-case range ([6be8f8f](https://github.com/OpenReloading/Ballistics/commit/6be8f8fad1787b8fe4a5b26fd5d9d66dde7d30c5)), closes [#60](https://github.com/OpenReloading/Ballistics/issues/60)
* harden containers, CI workflows and scripts (SonarCloud) ([#165](https://github.com/OpenReloading/Ballistics/issues/165)) ([ca84d06](https://github.com/OpenReloading/Ballistics/commit/ca84d06f66f316a76fff4ba57f10adfad07f3fb6))
* resolve SonarCloud bug findings (unhandled promises, reduce, sort, page size) ([#159](https://github.com/OpenReloading/Ballistics/issues/159)) ([fb5e394](https://github.com/OpenReloading/Ballistics/commit/fb5e3945b5230123529b2b4346630c2c3ae6bd3c))
* **schema:** a saved sheet's face event is an event id ([a23d00e](https://github.com/OpenReloading/Ballistics/commit/a23d00e267f936dfd9a1ffbed3266ee29d6b284e)), closes [#138](https://github.com/OpenReloading/Ballistics/issues/138)
* **web:** a list keeps its scroll when the browser's records arrive ([#181](https://github.com/OpenReloading/Ballistics/issues/181)) ([f083a22](https://github.com/OpenReloading/Ballistics/commit/f083a227d0ea303cbe65f2a75e585a2c2c668b6e))
* **web:** a load of charge 0 saves, the gun weight returns on a reopened firearm ([19a4bf3](https://github.com/OpenReloading/Ballistics/commit/19a4bf3fde669c840845d86d59e50576fbe863f3)), closes [#132](https://github.com/OpenReloading/Ballistics/issues/132)
* **web:** a typed manufacturer is stored before the save shortcut saves ([2be8f1c](https://github.com/OpenReloading/Ballistics/commit/2be8f1cccc2e166324c49e7a622bbbe4321c3d4d)), closes [#135](https://github.com/OpenReloading/Ballistics/issues/135)
* **web:** ask the two lot ladders one after the other ([f7c5baf](https://github.com/OpenReloading/Ballistics/commit/f7c5bafa145870c83fb3ae42319b9c3425ce0938)), closes [#152](https://github.com/OpenReloading/Ballistics/issues/152)
* **web:** build the catalogue entry of the API package in the web image ([4b6bcb4](https://github.com/OpenReloading/Ballistics/commit/4b6bcb4c30861227c1ec2adf734c21d1e252d7ee)), closes [#153](https://github.com/OpenReloading/Ballistics/issues/153)
* **web:** choosing a suggested manufacturer leaves the field showing the record ([ace9cf8](https://github.com/OpenReloading/Ballistics/commit/ace9cf8099784e6972f4f14f30f91ef855155085)), closes [#135](https://github.com/OpenReloading/Ballistics/issues/135)
* **web:** convert the bullet mass of the picker with the unit table ([db2017b](https://github.com/OpenReloading/Ballistics/commit/db2017b667cb3b9fbf00f91712b861ed44e085b7)), closes [#141](https://github.com/OpenReloading/Ballistics/issues/141)
* **web:** do not report the example rifle or an unreadable store as missing ([3dd7f9d](https://github.com/OpenReloading/Ballistics/commit/3dd7f9d2f73c3dc6a3a8db2190bd422561366fa7)), closes [#129](https://github.com/OpenReloading/Ballistics/issues/129)
* **web:** faces of a discipline keep their stage order, a face pick shows its federation ([1bb1abd](https://github.com/OpenReloading/Ballistics/commit/1bb1abd9f2409fa02f60ccfcd1d41cbcbe522d27)), closes [#31](https://github.com/OpenReloading/Ballistics/issues/31)
* **web:** federation page uses the default order; comparator tests per federation ([4bccddd](https://github.com/OpenReloading/Ballistics/commit/4bccdddf61654d17a2a8a98bfbe63b6992363cb7)), closes [#102](https://github.com/OpenReloading/Ballistics/issues/102)
* **web:** fold the moving target and hit probability panels into a closed disclosure ([afe4893](https://github.com/OpenReloading/Ballistics/commit/afe4893785ee66f8d91dca38cbe158a9e7e1d170))
* **web:** keep the designer drawing at a fixed height when a bullet is seated ([c4a0558](https://github.com/OpenReloading/Ballistics/commit/c4a055868847f99687307d387b9d75a2edcdb740)), closes [#40](https://github.com/OpenReloading/Ballistics/issues/40)
* **web:** keep the lot rows value stable and the printed chart without a note ([19cdf70](https://github.com/OpenReloading/Ballistics/commit/19cdf70da8bec6d7259923dab4196534870a6766)), closes [#47](https://github.com/OpenReloading/Ballistics/issues/47)
* **web:** keep the photo of an invalid target sheet ([66587d4](https://github.com/OpenReloading/Ballistics/commit/66587d4c89e2bbe22d7b85baac2d14753f4964fc)), closes [#137](https://github.com/OpenReloading/Ballistics/issues/137)
* **web:** keep zero air and drag factor editable after a firearm choice ([5855977](https://github.com/OpenReloading/Ballistics/commit/5855977a4da7b83ec129bc9f1387fa9df27be854)), closes [#20](https://github.com/OpenReloading/Ballistics/issues/20)
* **web:** lot rows print with their reason, load their chart early and mark only the main row ([c50d8c4](https://github.com/OpenReloading/Ballistics/commit/c50d8c44f05749b68dc9a3d52b437e08a33b23b2)), closes [#47](https://github.com/OpenReloading/Ballistics/issues/47)
* **web:** mass range parse without a super-linear regular expression ([#188](https://github.com/OpenReloading/Ballistics/issues/188)) ([d92b131](https://github.com/OpenReloading/Ballistics/commit/d92b1316ab7c603876c6aeee42ec412845aeca26))
* **web:** own bullets in the site search, numbers match whole numbers ([#171](https://github.com/OpenReloading/Ballistics/issues/171)) ([08f8d1d](https://github.com/OpenReloading/Ballistics/commit/08f8d1d6c2286c6d28ca1b9e1766068e41b8b09e))
* **web:** saved loads group by cartridge reference, an opened design keeps the seating and capacity ([2809782](https://github.com/OpenReloading/Ballistics/commit/280978253405c0ea8403281e97aa85387a709db5)), closes [#130](https://github.com/OpenReloading/Ballistics/issues/130)
* **web:** say when the sampled band did not finish, test the band line ([0a1d3e3](https://github.com/OpenReloading/Ballistics/commit/0a1d3e3d7d805bdf5ce3186a884c27a01b8e6be6)), closes [#60](https://github.com/OpenReloading/Ballistics/issues/60)
* **web:** show full shot coordinates, keep the loading status out of the firearm alert line ([409b06e](https://github.com/OpenReloading/Ballistics/commit/409b06e4a89650cd25eace58ba28d62deaccf5e7)), closes [#21](https://github.com/OpenReloading/Ballistics/issues/21)
* **web:** SonarCloud findings, focus stops and the API document path, serialize-javascript ([#177](https://github.com/OpenReloading/Ballistics/issues/177)) ([bedd08f](https://github.com/OpenReloading/Ballistics/commit/bedd08f5d11633948de06aa2d87189572e6d0f7f))
* **web:** the manufacturer field reports a reference with every keystroke ([4181f42](https://github.com/OpenReloading/Ballistics/commit/4181f4244fd196ee7f56422e22e6ee5504a58932)), closes [#135](https://github.com/OpenReloading/Ballistics/issues/135)


### Documentation

* correct text that still named the SQL layer as the reader ([d33f964](https://github.com/OpenReloading/Ballistics/commit/d33f9647f48a84af0b1647f46328122da1e3795d)), closes [#143](https://github.com/OpenReloading/Ballistics/issues/143)
* describe the catalogue as what the API reads ([9ab1319](https://github.com/OpenReloading/Ballistics/commit/9ab1319b2328bb582bc8aee85d340f71e0b9aab8)), closes [#143](https://github.com/OpenReloading/Ballistics/issues/143)
* describe the Pages edition's catalogue index ([ecfd49b](https://github.com/OpenReloading/Ballistics/commit/ecfd49b954615955e7cb0ad36fa9077f8ea451a8)), closes [#145](https://github.com/OpenReloading/Ballistics/issues/145)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/api bumped from 0.0.1 to 0.0.2
    * @open-reloading/core bumped from 0.0.1 to 0.0.2
    * @open-reloading/data bumped from 0.0.1 to 0.0.2
    * @open-reloading/drawing bumped from 0.0.1 to 0.0.2
    * @open-reloading/importers bumped from 0.0.1 to 0.0.2
    * @open-reloading/schema bumped from 0.0.1 to 0.0.2

## 0.0.1 (2026-10-22)


### Features

* first public version ([17b7bfa](https://github.com/OpenReloading/Ballistics/commit/17b7bfa7dfe088597de2cf16e2effaef1a9d692b))


### Bug fixes

* code scanning findings, property tests and the e2e hydration wait ([#14](https://github.com/OpenReloading/Ballistics/issues/14)) ([c2a7ecd](https://github.com/OpenReloading/Ballistics/commit/c2a7ecd5862c2810bc2805820ff68382cbe61fe7))
* **deps:** next 16.4.2, fastify 5.12.7 and katex 0.18.2 for their security advisories ([#8](https://github.com/OpenReloading/Ballistics/issues/8)) ([248a38d](https://github.com/OpenReloading/Ballistics/commit/248a38d83b484cdfe5f454282a05ec407ead476d))
* one drawing scale in mm and inches; agent skills out of the repository ([#66](https://github.com/OpenReloading/Ballistics/issues/66)) ([37b4d42](https://github.com/OpenReloading/Ballistics/commit/37b4d4244fe87f409ead98e2cc190f035c54b748))
* **web:** route without the trailing slash of the Pages edition ([#67](https://github.com/OpenReloading/Ballistics/issues/67)) ([d99b35f](https://github.com/OpenReloading/Ballistics/commit/d99b35f838a5bd8dc80af057d395565eb8c6533d))
* **web:** start a worker script from the shell cache with its own URL ([#72](https://github.com/OpenReloading/Ballistics/issues/72)) ([f3f5218](https://github.com/OpenReloading/Ballistics/commit/f3f52189432f0f1dd2fa6ac2543b7aaf77005255))
* **web:** the example link runs once the seated bullet is drawn ([#82](https://github.com/OpenReloading/Ballistics/issues/82)) ([92db539](https://github.com/OpenReloading/Ballistics/commit/92db53900336d86487b7c21efec23c7704af8ac7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/api bumped from * to 0.0.1
    * @open-reloading/core bumped from * to 0.0.1
    * @open-reloading/data bumped from * to 0.0.1
    * @open-reloading/drawing bumped from * to 0.0.1
    * @open-reloading/importers bumped from * to 0.0.1
    * @open-reloading/schema bumped from * to 0.0.1
