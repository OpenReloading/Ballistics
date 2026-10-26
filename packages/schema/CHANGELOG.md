# Changelog

## [0.0.2](https://github.com/OpenReloading/Ballistics/compare/schema-v0.0.1...schema-v0.0.2) (2026-10-26)


### Features

* **api:** the load file route reads the load record ([6022b6f](https://github.com/OpenReloading/Ballistics/commit/6022b6fa7c9176ca634795ee27a1e8d150ec2fb8)), closes [#132](https://github.com/OpenReloading/Ballistics/issues/132)
* **data:** caliber classes become catalogue records ([c174ad6](https://github.com/OpenReloading/Ballistics/commit/c174ad69a8ed2355f96e508bc486522195a05120)), closes [#138](https://github.com/OpenReloading/Ballistics/issues/138)
* **data:** renames map for record ids that changed ([a6be073](https://github.com/OpenReloading/Ballistics/commit/a6be0732b02ebbc91af1e9441ebb9297d1821bd8)), closes [#146](https://github.com/OpenReloading/Ballistics/issues/146)
* hollow-base bullets in the schema, outline and seated volume ([7fbb22f](https://github.com/OpenReloading/Ballistics/commit/7fbb22f41b9873ffd76e50992583a03949010a8d)), closes [#23](https://github.com/OpenReloading/Ballistics/issues/23)
* **release:** publish the libraries to npm under [@open-reloading](https://github.com/open-reloading) ([#123](https://github.com/OpenReloading/Ballistics/issues/123)) ([a25e75f](https://github.com/OpenReloading/Ballistics/commit/a25e75f36e8f82b37efc807d93a6a1ee0cbef11f))
* **schema,web:** catalogue ids use recordId, newId works on insecure origins ([0f4c9db](https://github.com/OpenReloading/Ballistics/commit/0f4c9db4b85ae78269d9a307ec07f99c2d1053fa)), closes [#129](https://github.com/OpenReloading/Ballistics/issues/129)
* **schema:** add one search matcher and one sort key ([f425f23](https://github.com/OpenReloading/Ballistics/commit/f425f23247296bbdc1d5b04c71419f6d4387e516)), closes [#141](https://github.com/OpenReloading/Ballistics/issues/141)
* **schema:** add userId, ref and checkUserRefs ([6b3e96f](https://github.com/OpenReloading/Ballistics/commit/6b3e96f11760d697d7044883a27083c7dcc5deb1)), closes [#129](https://github.com/OpenReloading/Ballistics/issues/129)
* **schema:** bullets and firearms name their manufacturer by reference ([fc574ab](https://github.com/OpenReloading/Ballistics/commit/fc574ab911afa341a5f41896100d8eeb51f5087b)), closes [#135](https://github.com/OpenReloading/Ballistics/issues/135)
* **schema:** case capacity references ([#160](https://github.com/OpenReloading/Ballistics/issues/160)) ([3eb89de](https://github.com/OpenReloading/Ballistics/commit/3eb89deafca1703cc766a90a8b47193c2d6326be))
* **schema:** chronograph sessions name the device maker by reference ([e406649](https://github.com/OpenReloading/Ballistics/commit/e406649943e0321d6b0767af6fb81be2126ee8c6)), closes [#135](https://github.com/OpenReloading/Ballistics/issues/135)
* **schema:** firearm in one shape in stored units ([4eba127](https://github.com/OpenReloading/Ballistics/commit/4eba127053eb9eb03fc57cdc1ee47dced5d768b7)), closes [#131](https://github.com/OpenReloading/Ballistics/issues/131)
* **schema:** one Load in stored units for the catalogue, user data and the load file ([0279e8f](https://github.com/OpenReloading/Ballistics/commit/0279e8fe55c0c58e7ae6a75530285a2225760b21)), closes [#132](https://github.com/OpenReloading/Ballistics/issues/132)
* **schema:** target faces name their federation by id and events carry ids ([e385467](https://github.com/OpenReloading/Ballistics/commit/e385467d8155a32afb92a1e0df67d4d32f77b6c8)), closes [#138](https://github.com/OpenReloading/Ballistics/issues/138)
* **schema:** user bullet and cartridge records as overrides of a catalogue record ([a6267bb](https://github.com/OpenReloading/Ballistics/commit/a6267bb0798e405aaed1ff0fc3ed4d5b3d29b458)), closes [#130](https://github.com/OpenReloading/Ballistics/issues/130)
* **schema:** user manufacturer record ([99be8e1](https://github.com/OpenReloading/Ballistics/commit/99be8e1e782ba4f372bf41c711c77a5839c2525c)), closes [#135](https://github.com/OpenReloading/Ballistics/issues/135)
* **schema:** validate load-tables.json with a schema ([5581193](https://github.com/OpenReloading/Ballistics/commit/5581193e1b84ca41a342226e3e17db0f85b271ba)), closes [#138](https://github.com/OpenReloading/Ballistics/issues/138)
* **web:** default order of disciplines and target faces per federation ([70db41b](https://github.com/OpenReloading/Ballistics/commit/70db41ba26e3bdf46a9f105497b6457fb4be053b)), closes [#102](https://github.com/OpenReloading/Ballistics/issues/102)
* **web:** designs as overrides, base changed, share links, re-save, offline lists ([#170](https://github.com/OpenReloading/Ballistics/issues/170)) ([58910ed](https://github.com/OpenReloading/Ballistics/commit/58910ed381cfc112693d0218e2154ab5ccafd7d4))
* **web:** designs resolve against their base record and loads keep the design by reference ([8d6cd66](https://github.com/OpenReloading/Ballistics/commit/8d6cd666b6ffa12c7af506d76e68ed899aa11a47)), closes [#130](https://github.com/OpenReloading/Ballistics/issues/130)
* **web:** powder-temperature ladder ([bb0c8a8](https://github.com/OpenReloading/Ballistics/commit/bb0c8a88b59d01b298b158f9ca70bba55b4d9de9)), closes [#35](https://github.com/OpenReloading/Ballistics/issues/35)
* **web:** score oval rings, several bulls and square areas ([#122](https://github.com/OpenReloading/Ballistics/issues/122)) ([fbcee91](https://github.com/OpenReloading/Ballistics/commit/fbcee91aba7085341455d35cb368a43fa354e6a9))
* **web:** target face designer ([#124](https://github.com/OpenReloading/Ballistics/issues/124)) ([8dc4bc2](https://github.com/OpenReloading/Ballistics/commit/8dc4bc2e8e129a21460ecb96045ce0d0ad474e6b))
* **web:** unify chronograph sessions across imports, the workbench and target sheets ([#168](https://github.com/OpenReloading/Ballistics/issues/168)) ([bc1d594](https://github.com/OpenReloading/Ballistics/commit/bc1d594123001d2da9848da86b03ba13864e337b))
* **web:** zero atmosphere and drag factor per mounted optic ([66ce080](https://github.com/OpenReloading/Ballistics/commit/66ce080294832eb0a68d3e839840bdc2866f3d12)), closes [#20](https://github.com/OpenReloading/Ballistics/issues/20) [#20](https://github.com/OpenReloading/Ballistics/issues/20)


### Bug fixes

* **api:** document the 308 of the id routes and pass the doc-type check ([1efa7df](https://github.com/OpenReloading/Ballistics/commit/1efa7df3765f2e4181bdd29c3363e17988478690)), closes [#146](https://github.com/OpenReloading/Ballistics/issues/146)
* **schema:** a saved sheet's face event is an event id ([a23d00e](https://github.com/OpenReloading/Ballistics/commit/a23d00e267f936dfd9a1ffbed3266ee29d6b284e)), closes [#138](https://github.com/OpenReloading/Ballistics/issues/138)
* **schema:** drop imports the merge left unused ([4029c38](https://github.com/OpenReloading/Ballistics/commit/4029c3833a8f3ec53bbf37079fbafce0ae4540ad)), closes [#130](https://github.com/OpenReloading/Ballistics/issues/130)
* **schema:** name the record list type of checkUserRefs ([b85519c](https://github.com/OpenReloading/Ballistics/commit/b85519ce9ac036e33e94ed4eaaaee78f75a7deaf)), closes [#129](https://github.com/OpenReloading/Ballistics/issues/129)
* **schema:** read the first code of a discipline number in linear time ([#106](https://github.com/OpenReloading/Ballistics/issues/106)) ([9d72c5c](https://github.com/OpenReloading/Ballistics/commit/9d72c5ccea8eac2a355a5d4219c41b229b897e79))
* **web:** a typed manufacturer is stored before the save shortcut saves ([2be8f1c](https://github.com/OpenReloading/Ballistics/commit/2be8f1cccc2e166324c49e7a622bbbe4321c3d4d)), closes [#135](https://github.com/OpenReloading/Ballistics/issues/135)
* **web:** federation page uses the default order; comparator tests per federation ([4bccddd](https://github.com/OpenReloading/Ballistics/commit/4bccdddf61654d17a2a8a98bfbe63b6992363cb7)), closes [#102](https://github.com/OpenReloading/Ballistics/issues/102)
* **web:** own bullets in the site search, numbers match whole numbers ([#171](https://github.com/OpenReloading/Ballistics/issues/171)) ([08f8d1d](https://github.com/OpenReloading/Ballistics/commit/08f8d1d6c2286c6d28ca1b9e1766068e41b8b09e))


### Documentation

* add the record model page ([599bbd4](https://github.com/OpenReloading/Ballistics/commit/599bbd46bdcda7e25856eb7b1bd70d8621beb8c5)), closes [#127](https://github.com/OpenReloading/Ballistics/issues/127)

## 0.0.1 (2026-10-22)


### Features

* first public version ([17b7bfa](https://github.com/OpenReloading/Ballistics/commit/17b7bfa7dfe088597de2cf16e2effaef1a9d692b))
