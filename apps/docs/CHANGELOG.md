# Changelog

## [0.0.5](https://github.com/OpenReloading/Ballistics/compare/docs-v0.0.4...docs-v0.0.5) (2026-11-01)


### Features

* **api:** classify an entered maximum pressure against the tolerance range ([#420](https://github.com/OpenReloading/Ballistics/issues/420)) ([4c057f9](https://github.com/OpenReloading/Ballistics/commit/4c057f9528dbf35e8257f854ccba1e8fd0128d8f))
* **cli:** ready command for the measured check of the propellant-temperature energy term ([#367](https://github.com/OpenReloading/Ballistics/issues/367)) ([#968](https://github.com/OpenReloading/Ballistics/issues/968)) ([6a8e179](https://github.com/OpenReloading/Ballistics/commit/6a8e1790cb14fc8a2c73b622f9fb15d2f05100c4))
* **cli:** verify and compare held-out model evaluation ([#406](https://github.com/OpenReloading/Ballistics/issues/406)) ([d0b9202](https://github.com/OpenReloading/Ballistics/commit/d0b920239073991dfe5f06b690747d0c0b5b9d83))
* **cli:** verify and compare read the catalogue's published loads, muzzle-corrected, pressure by basis ([#913](https://github.com/OpenReloading/Ballistics/issues/913)) ([054e5c0](https://github.com/OpenReloading/Ballistics/commit/054e5c0810ff684ee3e8dc3312e3157048f824fa))
* **core:** bullets and core model batch ([#847](https://github.com/OpenReloading/Ballistics/issues/847), [#845](https://github.com/OpenReloading/Ballistics/issues/845), [#846](https://github.com/OpenReloading/Ballistics/issues/846), [#843](https://github.com/OpenReloading/Ballistics/issues/843), [#842](https://github.com/OpenReloading/Ballistics/issues/842)) ([#947](https://github.com/OpenReloading/Ballistics/issues/947)) ([73e97e2](https://github.com/OpenReloading/Ballistics/commit/73e97e2ab2a1312e2a281d9dbf631ce6232a90a5))
* **core:** named refusals on the strings plan and a divergence of the velocity and drag fits ([#423](https://github.com/OpenReloading/Ballistics/issues/423)) ([c880f8f](https://github.com/OpenReloading/Ballistics/commit/c880f8f7b6906a7593210b29399ffb40f67b1426))
* **core:** one advisory registry for warnings and ignored inputs ([#421](https://github.com/OpenReloading/Ballistics/issues/421)) ([d9cfa7a](https://github.com/OpenReloading/Ballistics/commit/d9cfa7a761852444ad27730626203e35c992c56d))
* **core:** powder fit domain on every axis of a prediction ([#417](https://github.com/OpenReloading/Ballistics/issues/417)) ([3d1c339](https://github.com/OpenReloading/Ballistics/commit/3d1c33985eaf4b03a453ec2d3f539e0f90fe82f5))
* **core:** report the stop rule and whether the outlier weights settled ([#419](https://github.com/OpenReloading/Ballistics/issues/419)) ([70aa613](https://github.com/OpenReloading/Ballistics/commit/70aa61363d65c3fd05553c9ce1824fa585ce378d))
* **core:** require the pressure basis of a ladder pressure and refuse mixed bases ([#418](https://github.com/OpenReloading/Ballistics/issues/418)) ([b4c9d77](https://github.com/OpenReloading/Ballistics/commit/b4c9d778d1ff0d2fa94e90e44455295089ac6255))
* **data,schema:** event type records for IPSC Handgun, USPSA and DSB championships ([#915](https://github.com/OpenReloading/Ballistics/issues/915)) ([af593ca](https://github.com/OpenReloading/Ballistics/commit/af593cad4bb9bb5592f221fb97f505b1be2517e5))
* **data:** add the Austrian OeSB with its national target and disciplines ([#699](https://github.com/OpenReloading/Ballistics/issues/699)) ([95051bc](https://github.com/OpenReloading/Ballistics/commit/95051bc271d6fcb975f3812c8fb37fbeef91f4c2))
* **data:** construction fields from maker wording, Cutting Edge (part 4 of 4, [#844](https://github.com/OpenReloading/Ballistics/issues/844)) ([#943](https://github.com/OpenReloading/Ballistics/issues/943)) ([7fb32bc](https://github.com/OpenReloading/Ballistics/commit/7fb32bca5e6bd338b2699705bc65894f7a630179))
* **data:** construction fields from maker wording, Lehigh, Sako and Hammer (part 1 of 4, [#844](https://github.com/OpenReloading/Ballistics/issues/844)) ([#940](https://github.com/OpenReloading/Ballistics/issues/940)) ([9b3340d](https://github.com/OpenReloading/Ballistics/commit/9b3340df31ef21c9627e4ae56b6ee8bb2a04ffda))
* **data:** construction fields from maker wording, Missouri Bullet and Hammer (part 2 of 4, [#844](https://github.com/OpenReloading/Ballistics/issues/844)) ([#941](https://github.com/OpenReloading/Ballistics/issues/941)) ([e0d70b3](https://github.com/OpenReloading/Ballistics/commit/e0d70b33be946a310bd5a88b53713516af633f44))
* **data:** merge published load files with stable load ids and a re-import report ([#909](https://github.com/OpenReloading/Ballistics/issues/909)) ([78ed0bd](https://github.com/OpenReloading/Ballistics/commit/78ed0bdc0fc69e3010ed421fb7148e79386d49c7))
* **data:** plausibility warnings for published loads in data:validate ([#910](https://github.com/OpenReloading/Ballistics/issues/910)) ([3acb5a4](https://github.com/OpenReloading/Ballistics/commit/3acb5a4a65730403f1cd69e03f829bc409707ad7))
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
* **schema,data:** catalogue maker data batch ([#840](https://github.com/OpenReloading/Ballistics/issues/840), [#860](https://github.com/OpenReloading/Ballistics/issues/860)) ([#950](https://github.com/OpenReloading/Ballistics/issues/950)) ([751bf26](https://github.com/OpenReloading/Ballistics/commit/751bf266293b3883513e5efe51536f84533f679b))
* **schema,data:** published loads, name-only bullets, primer text and the case-contact pressure basis ([#833](https://github.com/OpenReloading/Ballistics/issues/833)) ([a008085](https://github.com/OpenReloading/Ballistics/commit/a00808567c82c600a8b8d6b6beac1915124f60e0))
* **schema:** export the JSON Schemas and leave the build script out of the tarball ([#530](https://github.com/OpenReloading/Ballistics/issues/530)) ([2e69b08](https://github.com/OpenReloading/Ballistics/commit/2e69b08995e26a12d43486d2fa1ab67165d2f560))
* **schema:** record the measuring convention of a case capacity ([#422](https://github.com/OpenReloading/Ballistics/issues/422)) ([f41453b](https://github.com/OpenReloading/Ballistics/commit/f41453b38e31592820ce961693776236506a45dd))
* **web,api:** type Pmax, case length L3 and bulk density over the record, read as "your Pmax" ([#869](https://github.com/OpenReloading/Ballistics/issues/869)) ([1364375](https://github.com/OpenReloading/Ballistics/commit/13643750a3b5cecf3bf3023c791bdc80aa608b68))
* **web,schema:** choose the bullet base form and type its dimensions over the record ([#851](https://github.com/OpenReloading/Ballistics/issues/851)) ([2c865e8](https://github.com/OpenReloading/Ballistics/commit/2c865e82dba94b25301718605792c09f8d944b3e)), closes [#758](https://github.com/OpenReloading/Ballistics/issues/758)
* **web,schema:** shooting log entries with print, CSV and the firearm round count ([#933](https://github.com/OpenReloading/Ballistics/issues/933)) ([13b133c](https://github.com/OpenReloading/Ballistics/commit/13b133c676d49c9d8edba808a81128a11a8fa159))
* **web:** better automatic bullet outline detection and photo quality hints ([#384](https://github.com/OpenReloading/Ballistics/issues/384)) ([5c654f7](https://github.com/OpenReloading/Ballistics/commit/5c654f7e9d4b43c9e04ba3564f5a4d6241e80b1b))
* **web:** better cut-outs for photographs on tables, and scale from caliper sizes ([#390](https://github.com/OpenReloading/Ballistics/issues/390)) ([3b836e8](https://github.com/OpenReloading/Ballistics/commit/3b836e8fd6747bb8801f6364d3980ad2afea2f1b))
* **web:** bullet photo takes a one-sided shadow out and says what a typed scale rests on ([#918](https://github.com/OpenReloading/Ballistics/issues/918)) ([7d9471b](https://github.com/OpenReloading/Ballistics/commit/7d9471b6622bd6ba93576816008c22369e07f743))
* **web:** bullet photo trims a shadow past the base and names it ([#935](https://github.com/OpenReloading/Ballistics/issues/935)) ([b9c85f3](https://github.com/OpenReloading/Ballistics/commit/b9c85f32f1c89e4b37dca69f617005a9975b8968))
* **web:** competition events page and shooting log links to events ([#863](https://github.com/OpenReloading/Ballistics/issues/863), [#936](https://github.com/OpenReloading/Ballistics/issues/936)) ([#959](https://github.com/OpenReloading/Ballistics/issues/959)) ([7dbbbfb](https://github.com/OpenReloading/Ballistics/commit/7dbbbfbbe1738b8eda52079fd30577ca518fceab))
* **web:** Database lists, record pages and comparisons in German ([#413](https://github.com/OpenReloading/Ballistics/issues/413)) ([bad3c44](https://github.com/OpenReloading/Ballistics/commit/bad3c4484c174b49be8b483c840136419617127f))
* **web:** decide the disputed German terms ([#433](https://github.com/OpenReloading/Ballistics/issues/433)) ([400863a](https://github.com/OpenReloading/Ballistics/commit/400863a5a13b04c8bba2c160fa2af6a04a5a98ca))
* **web:** decimal comma shown, comma and point accepted under the German setting ([#388](https://github.com/OpenReloading/Ballistics/issues/388)) ([0d56696](https://github.com/OpenReloading/Ballistics/commit/0d56696e7c22fe04d1f9872cbd810c046a0729b4))
* **web:** edit bullet diameter, length and BC on the Bullet card ([#759](https://github.com/OpenReloading/Ballistics/issues/759)) ([9d98d6a](https://github.com/OpenReloading/Ballistics/commit/9d98d6a137256bfb07324fedae210bbbe398c2f0))
* **web:** mark values changed over their record, reset them, and follow a typed bore diameter ([#832](https://github.com/OpenReloading/Ballistics/issues/832)) ([deea0de](https://github.com/OpenReloading/Ballistics/commit/deea0deeb1635623edabb6c8fd01090080d33512))
* **web:** note on a revolver powder fit without a leak area ([#900](https://github.com/OpenReloading/Ballistics/issues/900)) ([8ce72d7](https://github.com/OpenReloading/Ballistics/commit/8ce72d765c7fc5610e845e6bfa8401a3992c51dc))
* **web:** photo quality check for target photos ([#382](https://github.com/OpenReloading/Ballistics/issues/382)) ([1c2c9da](https://github.com/OpenReloading/Ballistics/commit/1c2c9da01da2bdb9416122a71f5d2a23b0b115e6))
* **web:** powder tune pages with the chart beside the controls, one strings table and field errors ([#948](https://github.com/OpenReloading/Ballistics/issues/948)) ([abeded8](https://github.com/OpenReloading/Ballistics/commit/abeded8f24fad8ca66b4c18a0307610d7c9a065a))
* **web:** shared choice filters for Disciplines, Federations and Targets, discipline distance unit ([#427](https://github.com/OpenReloading/Ballistics/issues/427)) ([61737a0](https://github.com/OpenReloading/Ballistics/commit/61737a0d9269d0cb9930860c2d7b563f7c6b6b4b))
* **web:** skip unknown record kinds of a user data file and report them ([#702](https://github.com/OpenReloading/Ballistics/issues/702)) ([f5346fe](https://github.com/OpenReloading/Ballistics/commit/f5346fe56db073969f0bb633c4d7bd9c466af38e))
* **web:** translate the printed pages to German ([#434](https://github.com/OpenReloading/Ballistics/issues/434)) ([8969277](https://github.com/OpenReloading/Ballistics/commit/896927785acd514edf80e90d7608292522ba2e88))
* **web:** translate the workbench and the messages of the packages and the API to German ([#414](https://github.com/OpenReloading/Ballistics/issues/414)) ([aa8084c](https://github.com/OpenReloading/Ballistics/commit/aa8084c063b0cdfb1aa9f78b4097c143391e7998))
* **web:** velocity SD interval, shots needed and string comparison in the session summary ([#416](https://github.com/OpenReloading/Ballistics/issues/416)) ([910d048](https://github.com/OpenReloading/Ballistics/commit/910d0483043fb8bda24321e64634a280e7d2a3ac))
* **web:** workbench model inputs batch ([#799](https://github.com/OpenReloading/Ballistics/issues/799), [#811](https://github.com/OpenReloading/Ballistics/issues/811), [#836](https://github.com/OpenReloading/Ballistics/issues/836), [#839](https://github.com/OpenReloading/Ballistics/issues/839), [#853](https://github.com/OpenReloading/Ballistics/issues/853), [#938](https://github.com/OpenReloading/Ballistics/issues/938)) ([#969](https://github.com/OpenReloading/Ballistics/issues/969)) ([f9b0fef](https://github.com/OpenReloading/Ballistics/commit/f9b0fef466df30d0c167ebe96688fc13dc599855))
* **web:** yearly summary of the shooting log: rounds per firearm and cartridge ([#937](https://github.com/OpenReloading/Ballistics/issues/937)) ([9d63dad](https://github.com/OpenReloading/Ballistics/commit/9d63dad9bc885455873808dfaa008c2ebfa7da3d))


### Bug fixes

* batch of audit fixes for scoring, German text and layout ([#722](https://github.com/OpenReloading/Ballistics/issues/722)) ([2e2a601](https://github.com/OpenReloading/Ballistics/commit/2e2a6015ff24a4b54ee052fc2098f34bbe9db207))
* **cli:** print the usage on stdout with exit 0 for --help ([#544](https://github.com/OpenReloading/Ballistics/issues/544)) ([bc0a9cc](https://github.com/OpenReloading/Ballistics/commit/bc0a9cca9a70630618c7aea8e054d6207f6c232a))
* pre-release batch of audit fixes for import, API query checks, load file, data package and CI plan ([#698](https://github.com/OpenReloading/Ballistics/issues/698)) ([eba4c2c](https://github.com/OpenReloading/Ballistics/commit/eba4c2c703aaba75e1e50989d850691b46926a10))
* second batch of audit fixes for messages, contrast, German layout and offline start ([#744](https://github.com/OpenReloading/Ballistics/issues/744)) ([c01a781](https://github.com/OpenReloading/Ballistics/commit/c01a7816faea53693d1941ffc830c536764a88e7))
* **web,data:** small follow-ups batch ([#958](https://github.com/OpenReloading/Ballistics/issues/958), [#914](https://github.com/OpenReloading/Ballistics/issues/914), [#925](https://github.com/OpenReloading/Ballistics/issues/925), [#949](https://github.com/OpenReloading/Ballistics/issues/949), [#954](https://github.com/OpenReloading/Ballistics/issues/954), [#927](https://github.com/OpenReloading/Ballistics/issues/927), [#919](https://github.com/OpenReloading/Ballistics/issues/919)) ([#965](https://github.com/OpenReloading/Ballistics/issues/965)) ([6d1389a](https://github.com/OpenReloading/Ballistics/commit/6d1389aa75b8436fff6c0a5cf7796a3c4466d732))
* **web,schema:** small fixes batch ([#876](https://github.com/OpenReloading/Ballistics/issues/876), [#906](https://github.com/OpenReloading/Ballistics/issues/906), [#928](https://github.com/OpenReloading/Ballistics/issues/928), [#898](https://github.com/OpenReloading/Ballistics/issues/898), [#792](https://github.com/OpenReloading/Ballistics/issues/792), [#796](https://github.com/OpenReloading/Ballistics/issues/796)) ([#946](https://github.com/OpenReloading/Ballistics/issues/946)) ([fd88ad9](https://github.com/OpenReloading/Ballistics/commit/fd88ad943867e8409f524ac7622c515992c1aa83))
* **web:** bullet photo names a typed axis off the bullet's and gives no boat tail for its turned base face ([#929](https://github.com/OpenReloading/Ballistics/issues/929)) ([e43eefc](https://github.com/OpenReloading/Ballistics/commit/e43eefc3921530b0d6f2f5985cc72fa4cf38fdb3))
* **web:** firearms table fits 1280 px, one save status, same tab offset ([#893](https://github.com/OpenReloading/Ballistics/issues/893)) ([ae7e39d](https://github.com/OpenReloading/Ballistics/commit/ae7e39d60055b282c7c9231a9d208873717d53b0))
* **web:** keep the page bar title and the chart labels whole with the WCAG text spacing ([#750](https://github.com/OpenReloading/Ballistics/issues/750)) ([896ecb7](https://github.com/OpenReloading/Ballistics/commit/896ecb7b64f547b74e152eb76a774f274e06b02f))
* **web:** model inputs follow bullet, powder and cartridge records ([#852](https://github.com/OpenReloading/Ballistics/issues/852)) ([1f33264](https://github.com/OpenReloading/Ballistics/commit/1f33264975a1ca2c088dbb9816e1421541a0e4a9))
* **web:** return focus after dialogs and fix three more accessibility findings ([#408](https://github.com/OpenReloading/Ballistics/issues/408)) ([6fc6345](https://github.com/OpenReloading/Ballistics/commit/6fc63457d969c7ec66de04f518602ea200b0db14))
* **web:** shot groups detection steps and panel layout ([#880](https://github.com/OpenReloading/Ballistics/issues/880)) ([828dfb5](https://github.com/OpenReloading/Ballistics/commit/828dfb55286e5bca194a8783392dab966ebca895))
* **web:** stored cavity depth and per-step seating ladder cavity bracket ([#952](https://github.com/OpenReloading/Ballistics/issues/952), [#953](https://github.com/OpenReloading/Ballistics/issues/953)) ([#971](https://github.com/OpenReloading/Ballistics/issues/971)) ([4a98d3b](https://github.com/OpenReloading/Ballistics/commit/4a98d3beb76bcc13adbae0b0d406426fa02e324e))


### Documentation

* accessibility audit page and two fixes from it ([#386](https://github.com/OpenReloading/Ballistics/issues/386)) ([f522a7c](https://github.com/OpenReloading/Ballistics/commit/f522a7c5156f2c260cf290d7e38346541ba0de89))
* **core:** state the spin drift and jump fits against the modified point mass ([#430](https://github.com/OpenReloading/Ballistics/issues/430)) ([051c116](https://github.com/OpenReloading/Ballistics/commit/051c1166bddd722ffca6c3140ad85ba5d3f07046))
* how close a result is, with the sources of variation and the held-out error ([#888](https://github.com/OpenReloading/Ballistics/issues/888)) ([10f209e](https://github.com/OpenReloading/Ballistics/commit/10f209e3eafe427d1655d7ce00193bb9ada6d248))
* list the required checks of the main ruleset as they are ([#753](https://github.com/OpenReloading/Ballistics/issues/753)) ([69c2b8d](https://github.com/OpenReloading/Ballistics/commit/69c2b8ddb2553ef68aef1bcc4f52eb0068ce5a54))
* match the docs to the code and settings ([#529](https://github.com/OpenReloading/Ballistics/issues/529)) ([d2853ab](https://github.com/OpenReloading/Ballistics/commit/d2853ab24bfdfd8bce45291d8fc7731437c8febd))
* **models:** validation protocol, decisions and the claims the docs may make ([#425](https://github.com/OpenReloading/Ballistics/issues/425)) ([bf50731](https://github.com/OpenReloading/Ballistics/commit/bf50731e72ce67cdcfa8e2d01bf96d40c84d67ec))
* remove maker licensing and permission discussion ([#960](https://github.com/OpenReloading/Ballistics/issues/960)) ([1a4c17e](https://github.com/OpenReloading/Ballistics/commit/1a4c17e17bbe6e86db54b6fac15cc69d2c179324))
* research log with a template, one example entry and a field check ([#410](https://github.com/OpenReloading/Ballistics/issues/410)) ([f9ba023](https://github.com/OpenReloading/Ballistics/commit/f9ba0233f61c75b2623e34a3b2279973ff8bc38b))
* **research:** bullet geometry from photographs for records without it ([#905](https://github.com/OpenReloading/Ballistics/issues/905)) ([ab9f1dd](https://github.com/OpenReloading/Ballistics/commit/ab9f1dd135ab808040eb2816bc1f3155e62ea735))
* **research:** bullet inertia from the outline against the solid cylinder ([#429](https://github.com/OpenReloading/Ballistics/issues/429)) ([9eeb1e1](https://github.com/OpenReloading/Ballistics/commit/9eeb1e1c4c3c57021acbbcdbdea6f5cedbf053c9))
* **research:** closed-form checks, worked examples and model choices ([#426](https://github.com/OpenReloading/Ballistics/issues/426)) ([ed4a3e1](https://github.com/OpenReloading/Ballistics/commit/ed4a3e15136810e2bc65b84180aae5fd66ec1fe7))
* **research:** extreme spread per shot count, flier screen and impact per charge ([#435](https://github.com/OpenReloading/Ballistics/issues/435)) ([c3d7629](https://github.com/OpenReloading/Ballistics/commit/c3d7629d7fd3dd6fa6381e987e7822a281d377c3))
* **research:** heat loss against gun figures and leak against mortar clearance ([#431](https://github.com/OpenReloading/Ballistics/issues/431)) ([14b8299](https://github.com/OpenReloading/Ballistics/commit/14b829939a2bf45e74012fcfe72aa2fd873c38fa))
* **research:** muzzle velocity from a speed measured downrange ([#436](https://github.com/OpenReloading/Ballistics/issues/436)) ([d32ff7c](https://github.com/OpenReloading/Ballistics/commit/d32ff7c65ad3140b31b3d7fa42f57bcf682b6042))
* state the effects the interior and capacity models leave out ([#879](https://github.com/OpenReloading/Ballistics/issues/879)) ([d3c2760](https://github.com/OpenReloading/Ballistics/commit/d3c2760fd62a4a070cbd4803848eecf4162097a3))
* write the sealed holdout looks into the hole detection research entry ([#878](https://github.com/OpenReloading/Ballistics/issues/878)) ([d0eb881](https://github.com/OpenReloading/Ballistics/commit/d0eb881b51a23b608d70b9f8c332056c32de74ef))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/api bumped from 0.0.4 to 0.0.5

## [0.0.4](https://github.com/OpenReloading/Ballistics/compare/docs-v0.0.3...docs-v0.0.4) (2026-10-27)


### Features

* **web:** develop and review the web app on data files without an API ([#314](https://github.com/OpenReloading/Ballistics/issues/314)) ([60a4488](https://github.com/OpenReloading/Ballistics/commit/60a44888543900d14f46ecff428dd46149015173))
* **web:** German UI foundation, language setting and catalogue ([#375](https://github.com/OpenReloading/Ballistics/issues/375)) ([5a07fbe](https://github.com/OpenReloading/Ballistics/commit/5a07fbe0b606b6308390e82bf7247d5906f8f4c3))


### Documentation

* describe the single static edition and the API as its own product ([#381](https://github.com/OpenReloading/Ballistics/issues/381)) ([53dbcd4](https://github.com/OpenReloading/Ballistics/commit/53dbcd4a4fda15a7597668640dd28426cd7ef313))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @open-reloading/api bumped from 0.0.3 to 0.0.4

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
* **release:** publish the libraries to npm under [@open-reloading](https://www.npmjs.com/org/open-reloading) ([#123](https://github.com/OpenReloading/Ballistics/issues/123)) ([a25e75f](https://github.com/OpenReloading/Ballistics/commit/a25e75f36e8f82b37efc807d93a6a1ee0cbef11f))
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
