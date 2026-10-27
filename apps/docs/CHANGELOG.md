# Changelog

## [0.0.3](https://github.com/OpenReloading/Ballistics/compare/docs-v0.0.2...docs-v0.0.3) (2026-10-27)


### Features

* **core:** fit a chamber volume correction and note a volume that is not measured ([#229](https://github.com/OpenReloading/Ballistics/issues/229)) ([3b4c161](https://github.com/OpenReloading/Ballistics/commit/3b4c161004d42e4cca00287eb72285e8aee5e934))
* **core:** fit burn form and pressure exponent from a pressure-time curve ([#225](https://github.com/OpenReloading/Ballistics/issues/225)) ([211b9ce](https://github.com/OpenReloading/Ballistics/commit/211b9ce117de37b4fa8371aa568c477d2adbf235))
* **core:** fit energy and temperature factor from sessions at several barrel lengths and temperatures ([#233](https://github.com/OpenReloading/Ballistics/issues/233)) ([11a96ab](https://github.com/OpenReloading/Ballistics/commit/11a96abc92c2b3698e027bdd4a807b75a9460277))
* **core:** pressure range, similar-powder prior and confidence label of a powder fit ([#261](https://github.com/OpenReloading/Ballistics/issues/261)) ([9b59440](https://github.com/OpenReloading/Ballistics/commit/9b594400524501cdfa3d72c5f1df8697de045bc2))
* **schema,data,api,web:** primer records, API and workbench picker ([#263](https://github.com/OpenReloading/Ballistics/issues/263)) ([5589507](https://github.com/OpenReloading/Ballistics/commit/558950741a48ce15623f99da0f5fe556f254611a))
* **schema,drawing,web,data:** DSU oval-ring faces b2 to b5 with their disciplines ([#260](https://github.com/OpenReloading/Ballistics/issues/260)) ([713ec86](https://github.com/OpenReloading/Ballistics/commit/713ec86c6eef3d26c2d2e4ae1632bfc34d380fa5))
* **schema,web:** structured bullet construction fields and a derived lead-free flag ([#259](https://github.com/OpenReloading/Ballistics/issues/259)) ([360326e](https://github.com/OpenReloading/Ballistics/commit/360326e6d51d29eea15478e82b2b2333c1d08540))
* **schema:** cite the cannelure datum and refuse a groove off the shank ([#240](https://github.com/OpenReloading/Ballistics/issues/240)) ([780449b](https://github.com/OpenReloading/Ballistics/commit/780449be8ad7d2b2063dabc53aa4c60b5af273ab))
* **schema:** manufacturer references on the components of a load ([#223](https://github.com/OpenReloading/Ballistics/issues/223)) ([5009a62](https://github.com/OpenReloading/Ballistics/commit/5009a625f896e8e5eccb0f31caed4c475dbd1b20))
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


### Documentation

* **docs:** list SonarQube Cloud as a used tool and match the rulesets ([#239](https://github.com/OpenReloading/Ballistics/issues/239)) ([7d3c237](https://github.com/OpenReloading/Ballistics/commit/7d3c23793f0fea3aad9b1f35640fcde30264253a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/api bumped from 0.0.2 to 0.0.3

## [0.0.2](https://github.com/OpenReloading/Ballistics/compare/docs-v0.0.1...docs-v0.0.2) (2026-10-26)


### Features

* **api:** list every missing load file key, download resolved values ([#167](https://github.com/OpenReloading/Ballistics/issues/167)) ([820395f](https://github.com/OpenReloading/Ballistics/commit/820395f0f2f2f3e9a8a0626257224a3a22ace25a))
* **api:** refuse old catalogue builds and redirect renamed ids ([0bcd69e](https://github.com/OpenReloading/Ballistics/commit/0bcd69e2ca066e8f90a3a9de58dd1407d0feaad7)), closes [#146](https://github.com/OpenReloading/Ballistics/issues/146)
* **core,web:** pressure and velocity bands from sampled input tolerances ([60e8207](https://github.com/OpenReloading/Ballistics/commit/60e8207c8756243a5684bf5146522a59cc415fcf)), closes [#60](https://github.com/OpenReloading/Ballistics/issues/60)
* **core:** add prediction bands of a powder fit at any charge ([527711b](https://github.com/OpenReloading/Ballistics/commit/527711bbff4fddec3eb1cef01a7ed3b6e4b16090)), closes [#58](https://github.com/OpenReloading/Ballistics/issues/58)
* **core:** add priors and a Huber loss to the powder fit ([cce4190](https://github.com/OpenReloading/Ballistics/commit/cce4190e1a086776389b09547c410ce2af194ae0)), closes [#59](https://github.com/OpenReloading/Ballistics/issues/59)
* **data:** add BDS multi-distance disciplines and rule-book notes ([#114](https://github.com/OpenReloading/Ballistics/issues/114)) ([8ab8362](https://github.com/OpenReloading/Ballistics/commit/8ab8362d4dc3116724c4f868578e903b0fa4547a))
* **data:** add missing BDMP disciplines and target faces ([#115](https://github.com/OpenReloading/Ballistics/issues/115)) ([1bc4837](https://github.com/OpenReloading/Ballistics/commit/1bc48370ac2cc216f7bc85e5eadec3c5496cd51c))
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
* **schema:** chronograph sessions name the device maker by reference ([e406649](https://github.com/OpenReloading/Ballistics/commit/e406649943e0321d6b0767af6fb81be2126ee8c6)), closes [#135](https://github.com/OpenReloading/Ballistics/issues/135)
* **schema:** firearm in one shape in stored units ([4eba127](https://github.com/OpenReloading/Ballistics/commit/4eba127053eb9eb03fc57cdc1ee47dced5d768b7)), closes [#131](https://github.com/OpenReloading/Ballistics/issues/131)
* **schema:** one Load in stored units for the catalogue, user data and the load file ([0279e8f](https://github.com/OpenReloading/Ballistics/commit/0279e8fe55c0c58e7ae6a75530285a2225760b21)), closes [#132](https://github.com/OpenReloading/Ballistics/issues/132)
* **schema:** target faces name their federation by id and events carry ids ([e385467](https://github.com/OpenReloading/Ballistics/commit/e385467d8155a32afb92a1e0df67d4d32f77b6c8)), closes [#138](https://github.com/OpenReloading/Ballistics/issues/138)
* **schema:** validate load-tables.json with a schema ([5581193](https://github.com/OpenReloading/Ballistics/commit/5581193e1b84ca41a342226e3e17db0f85b271ba)), closes [#138](https://github.com/OpenReloading/Ballistics/issues/138)
* velocity flat spots across a charge ladder ([1e4673d](https://github.com/OpenReloading/Ballistics/commit/1e4673dcad103167996fecf1699fb91ea081cc44)), closes [#52](https://github.com/OpenReloading/Ballistics/issues/52)
* **web:** bullet search dialog prototype for the Bullet card ([#120](https://github.com/OpenReloading/Ballistics/issues/120)) ([c25679e](https://github.com/OpenReloading/Ballistics/commit/c25679ed96545dd5b4dcc0ac7491212d9cfdfc55))
* **web:** bullet search on the shared matcher in the field, Ctrl+K and the dialog ([#163](https://github.com/OpenReloading/Ballistics/issues/163)) ([f71b33b](https://github.com/OpenReloading/Ballistics/commit/f71b33b1614ad83713f11b2999fdfb458de0347c))
* **web:** cartridge table like the bullet table ([#180](https://github.com/OpenReloading/Ballistics/issues/180)) ([ef84936](https://github.com/OpenReloading/Ballistics/commit/ef849368eb44c3639355e73355d9d3d2d791814d))
* **web:** default order of disciplines and target faces per federation ([70db41b](https://github.com/OpenReloading/Ballistics/commit/70db41ba26e3bdf46a9f105497b6457fb4be053b)), closes [#102](https://github.com/OpenReloading/Ballistics/issues/102)
* **web:** designs as overrides, base changed, share links, re-save, offline lists ([#170](https://github.com/OpenReloading/Ballistics/issues/170)) ([58910ed](https://github.com/OpenReloading/Ballistics/commit/58910ed381cfc112693d0218e2154ab5ccafd7d4))
* **web:** designs resolve against their base record and loads keep the design by reference ([8d6cd66](https://github.com/OpenReloading/Ballistics/commit/8d6cd666b6ffa12c7af506d76e68ed899aa11a47)), closes [#130](https://github.com/OpenReloading/Ballistics/issues/130)
* **web:** face search takes the scale of a calibrated sheet ([f6fd4ea](https://github.com/OpenReloading/Ballistics/commit/f6fd4ea524d647821be2940cb8437f7b4255238e)), closes [#32](https://github.com/OpenReloading/Ballistics/issues/32)
* **web:** manufacturer records with their records, delete unused, no offline duplicates ([#172](https://github.com/OpenReloading/Ballistics/issues/172)) ([8538853](https://github.com/OpenReloading/Ballistics/commit/8538853df3a7e79e3b1a7d5f94d74cef2ddeb245))
* **web:** one order for the target face picker lists, federation narrows faces ([bf99eca](https://github.com/OpenReloading/Ballistics/commit/bf99eca3a028def7980101bbf82f7cdc2e96d847)), closes [#31](https://github.com/OpenReloading/Ballistics/issues/31)
* **web:** powder lot rows and a barrel-time chart in the charge ladder ([f6ed7e9](https://github.com/OpenReloading/Ballistics/commit/f6ed7e9380eb1fa4c8b2f530ff55025ef2bd6990)), closes [#47](https://github.com/OpenReloading/Ballistics/issues/47) [#47](https://github.com/OpenReloading/Ballistics/issues/47)
* **web:** powder-temperature ladder ([bb0c8a8](https://github.com/OpenReloading/Ballistics/commit/bb0c8a88b59d01b298b158f9ca70bba55b4d9de9)), closes [#35](https://github.com/OpenReloading/Ballistics/issues/35)
* **web:** score oval rings, several bulls and square areas ([#122](https://github.com/OpenReloading/Ballistics/issues/122)) ([fbcee91](https://github.com/OpenReloading/Ballistics/commit/fbcee91aba7085341455d35cb368a43fa354e6a9))
* **web:** seat a bullet in the cartridge designer ([ade90ff](https://github.com/OpenReloading/Ballistics/commit/ade90ffd21fe36567c0cd4d9ea5df5a3466c5143)), closes [#40](https://github.com/OpenReloading/Ballistics/issues/40)
* **web:** target face designer ([#124](https://github.com/OpenReloading/Ballistics/issues/124)) ([8dc4bc2](https://github.com/OpenReloading/Ballistics/commit/8dc4bc2e8e129a21460ecb96045ce0d0ad474e6b))
* **web:** truing section in the Trajectory tab ([bf0c46c](https://github.com/OpenReloading/Ballistics/commit/bf0c46c9c5ce86aa447e359347fa32b928b08887)), closes [#33](https://github.com/OpenReloading/Ballistics/issues/33)
* **web:** unify chronograph sessions across imports, the workbench and target sheets ([#168](https://github.com/OpenReloading/Ballistics/issues/168)) ([bc1d594](https://github.com/OpenReloading/Ballistics/commit/bc1d594123001d2da9848da86b03ba13864e337b))
* **web:** UUID ids for new records, report dangling references ([ecc9d77](https://github.com/OpenReloading/Ballistics/commit/ecc9d77c424671b7dbad7f774f3f64e8827d7460)), closes [#129](https://github.com/OpenReloading/Ballistics/issues/129)


### Bug fixes

* accessibility, regular expression and style findings of SonarCloud ([#164](https://github.com/OpenReloading/Ballistics/issues/164)) ([91b8bdb](https://github.com/OpenReloading/Ballistics/commit/91b8bdbbb64d9be7115242149c37ad726db521cf))
* **core,web:** keep the band request across edits, print the corner-case range ([6be8f8f](https://github.com/OpenReloading/Ballistics/commit/6be8f8fad1787b8fe4a5b26fd5d9d66dde7d30c5)), closes [#60](https://github.com/OpenReloading/Ballistics/issues/60)
* **core:** checkAir rejects air whose density is out of range ([dfd3086](https://github.com/OpenReloading/Ballistics/commit/dfd30869b056c0c44fd68a390a97caeda209f3bd)), closes [#15](https://github.com/OpenReloading/Ballistics/issues/15)
* harden containers, CI workflows and scripts (SonarCloud) ([#165](https://github.com/OpenReloading/Ballistics/issues/165)) ([ca84d06](https://github.com/OpenReloading/Ballistics/commit/ca84d06f66f316a76fff4ba57f10adfad07f3fb6))
* **schema:** a saved sheet's face event is an event id ([a23d00e](https://github.com/OpenReloading/Ballistics/commit/a23d00e267f936dfd9a1ffbed3266ee29d6b284e)), closes [#138](https://github.com/OpenReloading/Ballistics/issues/138)
* **web:** choosing a suggested manufacturer leaves the field showing the record ([ace9cf8](https://github.com/OpenReloading/Ballistics/commit/ace9cf8099784e6972f4f14f30f91ef855155085)), closes [#135](https://github.com/OpenReloading/Ballistics/issues/135)
* **web:** faces of a discipline keep their stage order, a face pick shows its federation ([1bb1abd](https://github.com/OpenReloading/Ballistics/commit/1bb1abd9f2409fa02f60ccfcd1d41cbcbe522d27)), closes [#31](https://github.com/OpenReloading/Ballistics/issues/31)
* **web:** own bullets in the site search, numbers match whole numbers ([#171](https://github.com/OpenReloading/Ballistics/issues/171)) ([08f8d1d](https://github.com/OpenReloading/Ballistics/commit/08f8d1d6c2286c6d28ca1b9e1766068e41b8b09e))
* **web:** say when the sampled band did not finish, test the band line ([0a1d3e3](https://github.com/OpenReloading/Ballistics/commit/0a1d3e3d7d805bdf5ce3186a884c27a01b8e6be6)), closes [#60](https://github.com/OpenReloading/Ballistics/issues/60)


### Documentation

* add the record model page ([599bbd4](https://github.com/OpenReloading/Ballistics/commit/599bbd46bdcda7e25856eb7b1bd70d8621beb8c5)), closes [#127](https://github.com/OpenReloading/Ballistics/issues/127)
* correct text that still named the SQL layer as the reader ([d33f964](https://github.com/OpenReloading/Ballistics/commit/d33f9647f48a84af0b1647f46328122da1e3795d)), closes [#143](https://github.com/OpenReloading/Ballistics/issues/143)
* **data:** add the catalogue storage page ([b5ac138](https://github.com/OpenReloading/Ballistics/commit/b5ac138bd9f4d96a8dd215320aad311ae729ee89)), closes [#141](https://github.com/OpenReloading/Ballistics/issues/141)
* **data:** describe the catalogue module and its checks ([5ce14f0](https://github.com/OpenReloading/Ballistics/commit/5ce14f0a269af5390972eaaecfd9ef9b306e7ca7)), closes [#142](https://github.com/OpenReloading/Ballistics/issues/142)
* describe the branch flow, run CI on pushes to develop ([be509dd](https://github.com/OpenReloading/Ballistics/commit/be509dde1ad50bdd5f4690b274319a18a70e2c40))
* describe the catalogue as what the API reads ([9ab1319](https://github.com/OpenReloading/Ballistics/commit/9ab1319b2328bb582bc8aee85d340f71e0b9aab8)), closes [#143](https://github.com/OpenReloading/Ballistics/issues/143)
* describe the Pages edition's catalogue index ([ecfd49b](https://github.com/OpenReloading/Ballistics/commit/ecfd49b954615955e7cb0ad36fa9077f8ea451a8)), closes [#145](https://github.com/OpenReloading/Ballistics/issues/145)
* drop PostgreSQL and the SQL layer from the guides and the data pages ([4b0c96d](https://github.com/OpenReloading/Ballistics/commit/4b0c96db634d04e1b8bc71958f054c1bced89ecb)), closes [#144](https://github.com/OpenReloading/Ballistics/issues/144)
* firearm records research and decision brief ([#119](https://github.com/OpenReloading/Ballistics/issues/119)) ([f54584e](https://github.com/OpenReloading/Ballistics/commit/f54584e0ec080b47dc6bfe1de72d99435b367525))
* **site:** repository widget in the navbar ([#100](https://github.com/OpenReloading/Ballistics/issues/100)) ([c8a8dd4](https://github.com/OpenReloading/Ballistics/commit/c8a8dd48b733a510ab717fb5408e57ef49bed25a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/api bumped from 0.0.1 to 0.0.2

## 0.0.1 (2026-10-22)


### Features

* first public version ([17b7bfa](https://github.com/OpenReloading/Ballistics/commit/17b7bfa7dfe088597de2cf16e2effaef1a9d692b))


### Bug fixes

* **deps:** next 16.4.2, fastify 5.12.7 and katex 0.18.2 for their security advisories ([#8](https://github.com/OpenReloading/Ballistics/issues/8)) ([248a38d](https://github.com/OpenReloading/Ballistics/commit/248a38d83b484cdfe5f454282a05ec407ead476d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/api bumped from * to 0.0.1
