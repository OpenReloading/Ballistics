# Changelog

## [0.0.5](https://github.com/OpenReloading/Ballistics/compare/web-v0.0.4...web-v0.0.5) (2026-11-01)


### Features

* **api:** input hash, API version and data hash on compute answers ([#415](https://github.com/OpenReloading/Ballistics/issues/415)) ([e3cc1bc](https://github.com/OpenReloading/Ballistics/commit/e3cc1bc993bc6b4ae4ea02ac5912006837ed704a))
* **cli:** verify and compare held-out model evaluation ([#406](https://github.com/OpenReloading/Ballistics/issues/406)) ([d0b9202](https://github.com/OpenReloading/Ballistics/commit/d0b920239073991dfe5f06b690747d0c0b5b9d83))
* **cli:** verify and compare read the catalogue's published loads, muzzle-corrected, pressure by basis ([#913](https://github.com/OpenReloading/Ballistics/issues/913)) ([054e5c0](https://github.com/OpenReloading/Ballistics/commit/054e5c0810ff684ee3e8dc3312e3157048f824fa))
* **core:** bullets and core model batch ([#847](https://github.com/OpenReloading/Ballistics/issues/847), [#845](https://github.com/OpenReloading/Ballistics/issues/845), [#846](https://github.com/OpenReloading/Ballistics/issues/846), [#843](https://github.com/OpenReloading/Ballistics/issues/843), [#842](https://github.com/OpenReloading/Ballistics/issues/842)) ([#947](https://github.com/OpenReloading/Ballistics/issues/947)) ([73e97e2](https://github.com/OpenReloading/Ballistics/commit/73e97e2ab2a1312e2a281d9dbf631ce6232a90a5))
* **core:** named refusals on the strings plan and a divergence of the velocity and drag fits ([#423](https://github.com/OpenReloading/Ballistics/issues/423)) ([c880f8f](https://github.com/OpenReloading/Ballistics/commit/c880f8f7b6906a7593210b29399ffb40f67b1426))
* **core:** one advisory registry for warnings and ignored inputs ([#421](https://github.com/OpenReloading/Ballistics/issues/421)) ([d9cfa7a](https://github.com/OpenReloading/Ballistics/commit/d9cfa7a761852444ad27730626203e35c992c56d))
* **data:** add the Austrian OeSB with its national target and disciplines ([#699](https://github.com/OpenReloading/Ballistics/issues/699)) ([95051bc](https://github.com/OpenReloading/Ballistics/commit/95051bc271d6fcb975f3812c8fb37fbeef91f4c2))
* **data:** publish the existing bullet, powder, case capacity and manufacturer records ([#850](https://github.com/OpenReloading/Ballistics/issues/850)) ([a38c963](https://github.com/OpenReloading/Ballistics/commit/a38c963e1bcd96de5da9ff3ea993ca4be439ab4c))
* **data:** rule facts per discipline and stage ([#432](https://github.com/OpenReloading/Ballistics/issues/432)) ([be5fcd5](https://github.com/OpenReloading/Ballistics/commit/be5fcd55a456a33e3c823890a229f8c5d3fd7195))
* point of impact per charge of a ladder from linked chronograph shots ([#757](https://github.com/OpenReloading/Ballistics/issues/757)) ([4d4e32f](https://github.com/OpenReloading/Ballistics/commit/4d4e32ffc648000bed71ee9e68f66b65aeb6dfb0))
* pre-release batch of command line, importer, firearm and size check work ([#659](https://github.com/OpenReloading/Ballistics/issues/659)) ([e468295](https://github.com/OpenReloading/Ballistics/commit/e46829524214011f7e7c6f7bb26752b6ffb8cff7))
* pre-release batch of firearm views, box label, load-file importer and research entries ([#656](https://github.com/OpenReloading/Ballistics/issues/656)) ([5d38b2c](https://github.com/OpenReloading/Ballistics/commit/5d38b2cd057a9f0d6e2757dcf833501a1ab0268e))
* pre-release batch of fits, hit probability, tuning and docs ([#569](https://github.com/OpenReloading/Ballistics/issues/569)) ([3a5c6a4](https://github.com/OpenReloading/Ballistics/commit/3a5c6a4a7be9d52d20eca911cdccd49ad2d104c4))
* pre-release batch of limits, tests and research entries ([#589](https://github.com/OpenReloading/Ballistics/issues/589)) ([7b36740](https://github.com/OpenReloading/Ballistics/commit/7b36740b42ca2804b65cb0d707c1c51702b82b3e))
* pre-release batch of national body data and hole detection of filled print areas ([#668](https://github.com/OpenReloading/Ballistics/issues/668)) ([5f2e7ea](https://github.com/OpenReloading/Ballistics/commit/5f2e7ea399ae919859628146a2a5d7b3867b6ed5))
* pre-release batch of tests, fixes and research entries ([#612](https://github.com/OpenReloading/Ballistics/issues/612)) ([df1f134](https://github.com/OpenReloading/Ballistics/commit/df1f1347845b62b98a153896a7f27caefd56befb))
* pre-release batch of workbench record chooser, notes area, print fixes, photo guide and command line operations ([#688](https://github.com/OpenReloading/Ballistics/issues/688)) ([db2b2da](https://github.com/OpenReloading/Ballistics/commit/db2b2dae53086aa27177764e6dc91d0f0699e78f))
* pre-release integration of the 1.0 work ([#493](https://github.com/OpenReloading/Ballistics/issues/493)) ([46ace26](https://github.com/OpenReloading/Ballistics/commit/46ace26932aa37546eaf95f905870c0606abfb8d))
* **schema,core:** competition event record and scoring of ring series and practical stages ([#920](https://github.com/OpenReloading/Ballistics/issues/920)) ([44223df](https://github.com/OpenReloading/Ballistics/commit/44223dfdfb12d5b52be430d47278d65cb253e35c))
* **schema,data:** published loads, name-only bullets, primer text and the case-contact pressure basis ([#833](https://github.com/OpenReloading/Ballistics/issues/833)) ([a008085](https://github.com/OpenReloading/Ballistics/commit/a00808567c82c600a8b8d6b6beac1915124f60e0))
* **schema:** record the measuring convention of a case capacity ([#422](https://github.com/OpenReloading/Ballistics/issues/422)) ([f41453b](https://github.com/OpenReloading/Ballistics/commit/f41453b38e31592820ce961693776236506a45dd))
* **web,api:** bullet list columns and filters by construction, tip, base and lead-free ([#872](https://github.com/OpenReloading/Ballistics/issues/872)) ([1f4ed48](https://github.com/OpenReloading/Ballistics/commit/1f4ed489e033a1a745fbc09de5c9f7d2ebe17f73))
* **web,api:** training rows column and the user's own powders in the list and overlay ([#885](https://github.com/OpenReloading/Ballistics/issues/885)) ([a7cf46c](https://github.com/OpenReloading/Ballistics/commit/a7cf46c6b131564fc55c0afc7ed8f2f97130ac5b))
* **web,api:** type Pmax, case length L3 and bulk density over the record, read as "your Pmax" ([#869](https://github.com/OpenReloading/Ballistics/issues/869)) ([1364375](https://github.com/OpenReloading/Ballistics/commit/13643750a3b5cecf3bf3023c791bdc80aa608b68))
* **web,schema:** choose the bullet base form and type its dimensions over the record ([#851](https://github.com/OpenReloading/Ballistics/issues/851)) ([2c865e8](https://github.com/OpenReloading/Ballistics/commit/2c865e82dba94b25301718605792c09f8d944b3e)), closes [#758](https://github.com/OpenReloading/Ballistics/issues/758)
* **web,schema:** shooting log entries with print, CSV and the firearm round count ([#933](https://github.com/OpenReloading/Ballistics/issues/933)) ([13b133c](https://github.com/OpenReloading/Ballistics/commit/13b133c676d49c9d8edba808a81128a11a8fa159))
* **web:** better automatic bullet outline detection and photo quality hints ([#384](https://github.com/OpenReloading/Ballistics/issues/384)) ([5c654f7](https://github.com/OpenReloading/Ballistics/commit/5c654f7e9d4b43c9e04ba3564f5a4d6241e80b1b))
* **web:** better cut-outs for photographs on tables, and scale from caliper sizes ([#390](https://github.com/OpenReloading/Ballistics/issues/390)) ([3b836e8](https://github.com/OpenReloading/Ballistics/commit/3b836e8fd6747bb8801f6364d3980ad2afea2f1b))
* **web:** bullet photo takes a one-sided shadow out and says what a typed scale rests on ([#918](https://github.com/OpenReloading/Ballistics/issues/918)) ([7d9471b](https://github.com/OpenReloading/Ballistics/commit/7d9471b6622bd6ba93576816008c22369e07f743))
* **web:** bullet photo trims a shadow past the base and names it ([#935](https://github.com/OpenReloading/Ballistics/issues/935)) ([b9c85f3](https://github.com/OpenReloading/Ballistics/commit/b9c85f32f1c89e4b37dca69f617005a9975b8968))
* **web:** bullet record facts and filter, bullet compare key values, differences and Add bullet ([#890](https://github.com/OpenReloading/Ballistics/issues/890)) ([1acd01c](https://github.com/OpenReloading/Ballistics/commit/1acd01c5471ea6504ed4f286216e15ca3a4142d6))
* **web:** cartridge, case and primer record pages: standard in Sources, tolerance column, cartridge as a fact ([#882](https://github.com/OpenReloading/Ballistics/issues/882)) ([7aea048](https://github.com/OpenReloading/Ballistics/commit/7aea048a81d1d41161e0e37f56933a4c874bcb70))
* **web:** competition events page and shooting log links to events ([#863](https://github.com/OpenReloading/Ballistics/issues/863), [#936](https://github.com/OpenReloading/Ballistics/issues/936)) ([#959](https://github.com/OpenReloading/Ballistics/issues/959)) ([7dbbbfb](https://github.com/OpenReloading/Ballistics/commit/7dbbbfbbe1738b8eda52079fd30577ca518fceab))
* **web:** Database lists, record pages and comparisons in German ([#413](https://github.com/OpenReloading/Ballistics/issues/413)) ([bad3c44](https://github.com/OpenReloading/Ballistics/commit/bad3c4484c174b49be8b483c840136419617127f))
* **web:** decide the disputed German terms ([#433](https://github.com/OpenReloading/Ballistics/issues/433)) ([400863a](https://github.com/OpenReloading/Ballistics/commit/400863a5a13b04c8bba2c160fa2af6a04a5a98ca))
* **web:** decimal comma shown, comma and point accepted under the German setting ([#388](https://github.com/OpenReloading/Ballistics/issues/388)) ([0d56696](https://github.com/OpenReloading/Ballistics/commit/0d56696e7c22fe04d1f9872cbd810c046a0729b4))
* **web:** designer rows fill their width, touch-height fields, Units button and unit switches on every designer ([#907](https://github.com/OpenReloading/Ballistics/issues/907)) ([a0a85aa](https://github.com/OpenReloading/Ballistics/commit/a0a85aae0d52e4a7facb8d58757997c19a178f5e))
* **web:** edit bullet diameter, length and BC on the Bullet card ([#759](https://github.com/OpenReloading/Ballistics/issues/759)) ([9d98d6a](https://github.com/OpenReloading/Ballistics/commit/9d98d6a137256bfb07324fedae210bbbe398c2f0))
* **web:** German Safety text beside the English one ([#387](https://github.com/OpenReloading/Ballistics/issues/387)) ([97db702](https://github.com/OpenReloading/Ballistics/commit/97db7020ff7c623762e321dcf3c86063a0ca0481))
* **web:** mark values changed over their record, reset them, and follow a typed bore diameter ([#832](https://github.com/OpenReloading/Ballistics/issues/832)) ([deea0de](https://github.com/OpenReloading/Ballistics/commit/deea0deeb1635623edabb6c8fd01090080d33512))
* **web:** match-rounds readout, grouped sources, sticky list header, aligned federation tables ([#894](https://github.com/OpenReloading/Ballistics/issues/894)) ([208142a](https://github.com/OpenReloading/Ballistics/commit/208142a4328df5a1d1b502e8ebea70f68c54b222))
* **web:** note on a revolver powder fit without a leak area ([#900](https://github.com/OpenReloading/Ballistics/issues/900)) ([8ce72d7](https://github.com/OpenReloading/Ballistics/commit/8ce72d765c7fc5610e845e6bfa8401a3992c51dc))
* **web:** page tours for the record pages and the shot groups page ([#746](https://github.com/OpenReloading/Ballistics/issues/746)) ([4226b33](https://github.com/OpenReloading/Ballistics/commit/4226b33b2d07061678825e54e7c929183729f6ca))
* **web:** photo quality check for target photos ([#382](https://github.com/OpenReloading/Ballistics/issues/382)) ([1c2c9da](https://github.com/OpenReloading/Ballistics/commit/1c2c9da01da2bdb9416122a71f5d2a23b0b115e6))
* **web:** powder tune pages with the chart beside the controls, one strings table and field errors ([#948](https://github.com/OpenReloading/Ballistics/issues/948)) ([abeded8](https://github.com/OpenReloading/Ballistics/commit/abeded8f24fad8ca66b4c18a0307610d7c9a065a))
* **web:** shared choice filters for Disciplines, Federations and Targets, discipline distance unit ([#427](https://github.com/OpenReloading/Ballistics/issues/427)) ([61737a0](https://github.com/OpenReloading/Ballistics/commit/61737a0d9269d0cb9930860c2d7b563f7c6b6b4b))
* **web:** skip unknown record kinds of a user data file and report them ([#702](https://github.com/OpenReloading/Ballistics/issues/702)) ([f5346fe](https://github.com/OpenReloading/Ballistics/commit/f5346fe56db073969f0bb633c4d7bd9c466af38e))
* **web:** translate the printed pages to German ([#434](https://github.com/OpenReloading/Ballistics/issues/434)) ([8969277](https://github.com/OpenReloading/Ballistics/commit/896927785acd514edf80e90d7608292522ba2e88))
* **web:** translate the workbench and the messages of the packages and the API to German ([#414](https://github.com/OpenReloading/Ballistics/issues/414)) ([aa8084c](https://github.com/OpenReloading/Ballistics/commit/aa8084c063b0cdfb1aa9f78b4097c143391e7998))
* **web:** Units button with its preset, top bar buttons after the page actions in keyboard order ([#883](https://github.com/OpenReloading/Ballistics/issues/883)) ([c817007](https://github.com/OpenReloading/Ballistics/commit/c81700709564ef371bb1935c7e2c07ea05414904))
* **web:** velocity SD interval, shots needed and string comparison in the session summary ([#416](https://github.com/OpenReloading/Ballistics/issues/416)) ([910d048](https://github.com/OpenReloading/Ballistics/commit/910d0483043fb8bda24321e64634a280e7d2a3ac))
* **web:** workbench model inputs batch ([#799](https://github.com/OpenReloading/Ballistics/issues/799), [#811](https://github.com/OpenReloading/Ballistics/issues/811), [#836](https://github.com/OpenReloading/Ballistics/issues/836), [#839](https://github.com/OpenReloading/Ballistics/issues/839), [#853](https://github.com/OpenReloading/Ballistics/issues/853), [#938](https://github.com/OpenReloading/Ballistics/issues/938)) ([#969](https://github.com/OpenReloading/Ballistics/issues/969)) ([f9b0fef](https://github.com/OpenReloading/Ballistics/commit/f9b0fef466df30d0c167ebe96688fc13dc599855))
* **web:** yearly summary of the shooting log: rounds per firearm and cartridge ([#937](https://github.com/OpenReloading/Ballistics/issues/937)) ([9d63dad](https://github.com/OpenReloading/Ballistics/commit/9d63dad9bc885455873808dfaa008c2ebfa7da3d))


### Bug fixes

* batch of audit fixes for scoring, German text and layout ([#722](https://github.com/OpenReloading/Ballistics/issues/722)) ([2e2a601](https://github.com/OpenReloading/Ballistics/commit/2e2a6015ff24a4b54ee052fc2098f34bbe9db207))
* **drawing:** bullet outline notes write their lengths in the page unit ([#912](https://github.com/OpenReloading/Ballistics/issues/912)) ([0ac1b75](https://github.com/OpenReloading/Ballistics/commit/0ac1b75cedc25bf5a986ea9620f22f0a192c6609))
* make six number and text patterns linear and name the page bar status line ([#531](https://github.com/OpenReloading/Ballistics/issues/531)) ([3359a1e](https://github.com/OpenReloading/Ballistics/commit/3359a1e3c90c683057d3bd3d57aacbf1f7dd9ec9))
* pre-release batch of audit fixes for import, API query checks, load file, data package and CI plan ([#698](https://github.com/OpenReloading/Ballistics/issues/698)) ([eba4c2c](https://github.com/OpenReloading/Ballistics/commit/eba4c2c703aaba75e1e50989d850691b46926a10))
* second batch of audit fixes for messages, contrast, German layout and offline start ([#744](https://github.com/OpenReloading/Ballistics/issues/744)) ([c01a781](https://github.com/OpenReloading/Ballistics/commit/c01a7816faea53693d1941ffc830c536764a88e7))
* two SonarCloud findings in the cartridge name order and an e2e helper ([#873](https://github.com/OpenReloading/Ballistics/issues/873)) ([703e14b](https://github.com/OpenReloading/Ballistics/commit/703e14b5e0fe6573196ed3d7b8bc28ccc4bd604a))
* **web,data:** small follow-ups batch ([#958](https://github.com/OpenReloading/Ballistics/issues/958), [#914](https://github.com/OpenReloading/Ballistics/issues/914), [#925](https://github.com/OpenReloading/Ballistics/issues/925), [#949](https://github.com/OpenReloading/Ballistics/issues/949), [#954](https://github.com/OpenReloading/Ballistics/issues/954), [#927](https://github.com/OpenReloading/Ballistics/issues/927), [#919](https://github.com/OpenReloading/Ballistics/issues/919)) ([#965](https://github.com/OpenReloading/Ballistics/issues/965)) ([6d1389a](https://github.com/OpenReloading/Ballistics/commit/6d1389aa75b8436fff6c0a5cf7796a3c4466d732))
* **web,schema:** small fixes batch ([#876](https://github.com/OpenReloading/Ballistics/issues/876), [#906](https://github.com/OpenReloading/Ballistics/issues/906), [#928](https://github.com/OpenReloading/Ballistics/issues/928), [#898](https://github.com/OpenReloading/Ballistics/issues/898), [#792](https://github.com/OpenReloading/Ballistics/issues/792), [#796](https://github.com/OpenReloading/Ballistics/issues/796)) ([#946](https://github.com/OpenReloading/Ballistics/issues/946)) ([fd88ad9](https://github.com/OpenReloading/Ballistics/commit/fd88ad943867e8409f524ac7622c515992c1aa83))
* **web:** a run pressed while the seated volume arrives keeps no "Enter a number" error ([#939](https://github.com/OpenReloading/Ballistics/issues/939)) ([0995729](https://github.com/OpenReloading/Ballistics/commit/0995729389024b963b225edb3fdffc6574d9f0be))
* **web:** an ArrowDown right after typing keeps its row in the record chooser ([#930](https://github.com/OpenReloading/Ballistics/issues/930)) ([70bdb1e](https://github.com/OpenReloading/Ballistics/commit/70bdb1e4e48ef1270b12cd2af59766b5d4507896))
* **web:** bullet designer refusal in the page unit, Check the unit flag, narrower photo dialog ([#897](https://github.com/OpenReloading/Ballistics/issues/897)) ([7c133fe](https://github.com/OpenReloading/Ballistics/commit/7c133fe887dd4b430ef85f94ce1043dd2a59ee40))
* **web:** bullet photo names a typed axis off the bullet's and gives no boat tail for its turned base face ([#929](https://github.com/OpenReloading/Ballistics/issues/929)) ([e43eefc](https://github.com/OpenReloading/Ballistics/commit/e43eefc3921530b0d6f2f5985cc72fa4cf38fdb3))
* **web:** check a kept base record against its schema before offline use ([#552](https://github.com/OpenReloading/Ballistics/issues/552)) ([d5bfa7c](https://github.com/OpenReloading/Ballistics/commit/d5bfa7c6518e74661b3df62af77bb787fbe9bd9d))
* **web:** drop saved import mappings of another shape ([#525](https://github.com/OpenReloading/Ballistics/issues/525)) ([45db7a0](https://github.com/OpenReloading/Ballistics/commit/45db7a0259f93f5f4eb7b6c155d849aa38594b2a))
* **web:** firearms row focus ring runs around the sticky menu cell ([#922](https://github.com/OpenReloading/Ballistics/issues/922)) ([9a8511c](https://github.com/OpenReloading/Ballistics/commit/9a8511cbd47e12b411c6df6e4da774f6fe91470b))
* **web:** firearms table fits 1280 px, one save status, same tab offset ([#893](https://github.com/OpenReloading/Ballistics/issues/893)) ([ae7e39d](https://github.com/OpenReloading/Ballistics/commit/ae7e39d60055b282c7c9231a9d208873717d53b0))
* **web:** keep the page bar title and the chart labels whole with the WCAG text spacing ([#750](https://github.com/OpenReloading/Ballistics/issues/750)) ([896ecb7](https://github.com/OpenReloading/Ballistics/commit/896ecb7b64f547b74e152eb76a774f274e06b02f))
* **web:** model inputs follow bullet, powder and cartridge records ([#852](https://github.com/OpenReloading/Ballistics/issues/852)) ([1f33264](https://github.com/OpenReloading/Ballistics/commit/1f33264975a1ca2c088dbb9816e1421541a0e4a9))
* **web:** parse the mass range number in linear time ([#748](https://github.com/OpenReloading/Ballistics/issues/748)) ([cf30a26](https://github.com/OpenReloading/Ballistics/commit/cf30a26281fd366eff4a99a97a52e08e49ddcbec))
* **web:** plain powder designer messages and a clearer powder record page ([#875](https://github.com/OpenReloading/Ballistics/issues/875)) ([fede1a4](https://github.com/OpenReloading/Ballistics/commit/fede1a49a85b9cd0e4264d4bcf5c994364e208aa))
* **web:** range page names the load's components, statistics under Add shot ([#889](https://github.com/OpenReloading/Ballistics/issues/889)) ([295c7f1](https://github.com/OpenReloading/Ballistics/commit/295c7f17096358bb046342be98603b5131ffbb6c))
* **web:** readable I accept button of the Safety notice in dark mode ([#868](https://github.com/OpenReloading/Ballistics/issues/868)) ([3097221](https://github.com/OpenReloading/Ballistics/commit/3097221c0169dfc095232c8752e4a5c7831473c1))
* **web:** refuse a file over 40 MB in the Import entry before reading it ([#550](https://github.com/OpenReloading/Ballistics/issues/550)) ([2b4c773](https://github.com/OpenReloading/Ballistics/commit/2b4c773a1b4db11f2d4a19cf99a707aed3645579))
* **web:** refuse a share link of a large record before building it ([#543](https://github.com/OpenReloading/Ballistics/issues/543)) ([01b7867](https://github.com/OpenReloading/Ballistics/commit/01b7867c713674c8387975c584808791dff8074e))
* **web:** refused file reason in German and round count of entries sharing an event ([#962](https://github.com/OpenReloading/Ballistics/issues/962), [#961](https://github.com/OpenReloading/Ballistics/issues/961)) ([#975](https://github.com/OpenReloading/Ballistics/issues/975)) ([40d55e7](https://github.com/OpenReloading/Ballistics/commit/40d55e756dc5c34432f92ed1b913e2cec38368b2))
* **web:** return focus after dialogs and fix three more accessibility findings ([#408](https://github.com/OpenReloading/Ballistics/issues/408)) ([6fc6345](https://github.com/OpenReloading/Ballistics/commit/6fc63457d969c7ec66de04f518602ea200b0db14))
* **web:** revolver note when the tuning link is followed before the cartridge record loads ([#921](https://github.com/OpenReloading/Ballistics/issues/921)) ([8dfc8bb](https://github.com/OpenReloading/Ballistics/commit/8dfc8bb644d7134f7feff38f6de53b42129b0571))
* **web:** seating preview writes its notes' lengths in the page unit ([#926](https://github.com/OpenReloading/Ballistics/issues/926)) ([099bac7](https://github.com/OpenReloading/Ballistics/commit/099bac71f999dc09ce7b4b45d0e52dc6d89f3bf3))
* **web:** shot groups detection steps and panel layout ([#880](https://github.com/OpenReloading/Ballistics/issues/880)) ([828dfb5](https://github.com/OpenReloading/Ballistics/commit/828dfb55286e5bca194a8783392dab966ebca895))
* **web:** small UI fixes batch ([#841](https://github.com/OpenReloading/Ballistics/issues/841)) ([de67369](https://github.com/OpenReloading/Ballistics/commit/de6736984610e7c8ded7ede53eabf4d0c2dc7567))
* **web:** stored cavity depth and per-step seating ladder cavity bracket ([#952](https://github.com/OpenReloading/Ballistics/issues/952), [#953](https://github.com/OpenReloading/Ballistics/issues/953)) ([#971](https://github.com/OpenReloading/Ballistics/issues/971)) ([4a98d3b](https://github.com/OpenReloading/Ballistics/commit/4a98d3beb76bcc13adbae0b0d406426fa02e324e))
* **web:** tour popover below the top bar beside a tall target, unseen dot on the Tour button in the phone panel ([#881](https://github.com/OpenReloading/Ballistics/issues/881)) ([01d4009](https://github.com/OpenReloading/Ballistics/commit/01d40099c4498d2159bd52668cb0bcadcedfab86))


### Performance

* **web:** render cartridge record pages in the browser from their data file ([#383](https://github.com/OpenReloading/Ballistics/issues/383)) ([9b4cb28](https://github.com/OpenReloading/Ballistics/commit/9b4cb288a789157c4822859d2a9d72b462049b73))
* **web:** roll out the small record page to every record kind ([#407](https://github.com/OpenReloading/Ballistics/issues/407)) ([9c2771a](https://github.com/OpenReloading/Ballistics/commit/9c2771ae10a3a77c9f976c89eac29c1d84d931d1))


### Documentation

* accessibility audit page and two fixes from it ([#386](https://github.com/OpenReloading/Ballistics/issues/386)) ([f522a7c](https://github.com/OpenReloading/Ballistics/commit/f522a7c5156f2c260cf290d7e38346541ba0de89))
* how close a result is, with the sources of variation and the held-out error ([#888](https://github.com/OpenReloading/Ballistics/issues/888)) ([10f209e](https://github.com/OpenReloading/Ballistics/commit/10f209e3eafe427d1655d7ce00193bb9ada6d248))
* match the docs to the code and settings ([#529](https://github.com/OpenReloading/Ballistics/issues/529)) ([d2853ab](https://github.com/OpenReloading/Ballistics/commit/d2853ab24bfdfd8bce45291d8fc7731437c8febd))
* **research:** bullet geometry from photographs for records without it ([#905](https://github.com/OpenReloading/Ballistics/issues/905)) ([ab9f1dd](https://github.com/OpenReloading/Ballistics/commit/ab9f1dd135ab808040eb2816bc1f3155e62ea735))
* **research:** bullet inertia from the outline against the solid cylinder ([#429](https://github.com/OpenReloading/Ballistics/issues/429)) ([9eeb1e1](https://github.com/OpenReloading/Ballistics/commit/9eeb1e1c4c3c57021acbbcdbdea6f5cedbf053c9))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/api bumped from 0.0.4 to 0.0.5
    * @open-reloading/core bumped from 0.0.3 to 0.0.4
    * @open-reloading/data bumped from 0.0.4 to 0.0.5
    * @open-reloading/drawing bumped from 0.0.3 to 0.0.4
    * @open-reloading/importers bumped from 0.0.4 to 0.0.5
    * @open-reloading/schema bumped from 0.0.4 to 0.0.5

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
* **release:** publish the libraries to npm under [@open-reloading](https://www.npmjs.com/org/open-reloading) ([#123](https://github.com/OpenReloading/Ballistics/issues/123)) ([a25e75f](https://github.com/OpenReloading/Ballistics/commit/a25e75f36e8f82b37efc807d93a6a1ee0cbef11f))
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
