# Open licensed photographs of shot targets and bullets

Question: which photographs of shot paper targets and of bullets beside a ruler can be published in the repository as test fixtures under CC0, public domain or CC BY (CC BY-SA flagged)?

Short answer: there are enough CC BY-SA photographs of shot faces to build a small real-photo test set, and a few bullet photographs with a ruler. There is no CC0, public-domain or CC BY photograph of a shot standard face at a useful resolution. Every shot-face fixture would carry share-alike on the image file. Public-domain target photographs exist only for unshot faces or for holes on plain cardboard.

## What a test photo has to show

From `apps/docs/docs/models/hole-detection.md`, `apps/docs/docs/models/bullet-photo.md` and the synthetic fixtures (`apps/web/test/fixtures/target-photos/`, `apps/web/test/face-photos.ts`, `apps/web/test/face-render.ts`):

- Hole detection needs a whole sheet with ring lines, holes smaller than or about the bullet, a known or typed hole size, dark and light faces, holes that sit on printed numerals or ring lines, coloured faces, and the backing colour seen through the hole.
- The face search needs a face that matches one of the 51 records of `packages/data/records/target-faces/` (or a face with no record, which tests the manual path).
- The bullet reading needs a side view of a bullet, a plain background, a ruler or card in the bullet's plane, and a published diameter or length to check against.

## Method

- Wikimedia Commons was searched through its API (file search, category listings of Shooting targets, Air gun targets, Bullseye targets, Target practice, Bullet holes, Bullets, Bullets with rulers indicating scale, Cartridges with rulers indicating scale). I opened the thumbnail of every candidate and judged what it shows myself.
- The licence in each table is the licence data of the Commons file page. The raw licence templates of every photo marked "fits" were read, and the file pages of two photos (Paper Target, 35 Whelen) were opened to confirm the licence text and the author.
- Open data hosts (Kaggle, Roboflow Universe, e-cienciaDatos, arXiv, MDPI, Crossref) and the DVIDS copyright notice were checked as far as the hosts answered automated requests. Where a page returned HTTP 403 the licence is marked unverified.
- Image files were not downloaded into the repository. Thumbnails of up to 900 px went to a scratch directory for viewing only.
- Hole counts are two numbers per photo. "Stated" comes from the description or the handwriting on the sheet. "Seen" is what I counted on a 900 px preview. Both are unverified, and a test must count on the full-size file.

## Licence handling for fixtures

- CC BY-SA applies to the image file. A crop, resize or re-encode is an adaptation, so the derived fixture is also CC BY-SA. The test code is not covered.
- Each fixture needs title, author, file page URL, licence name and URL, and a note of the changes. This is what the Commons file page asks for (credit, licence link, indication of changes, same licence for adaptations).
- Several files are dual licensed (CC BY-SA with GFDL or with older CC versions). The CC BY-SA option is the one to use.
- The printed face on a photo can carry its own rights (a manufacturer's artwork, a copyright line on the sheet). The uploader's licence covers the photograph, not necessarily the printed design. This is flagged per photo and stays unverified.
- Photographs from the US Department of Defense are not copyrighted in the US. DVIDS asks that DoD imagery is not used so as to imply endorsement and that the line "The appearance of U.S. Department of War (DoW) visual information does not imply or constitute DoW endorsement." is shown. Source: https://www.dvidshub.net/about/copyright
- Public-domain claims here rest on the Commons page. Outside the US, public domain for US government work is unverified.

## A. Shot paper targets that fit (all CC BY-SA)

Face column: "no record" means I found no matching file in `packages/data/records/target-faces/` by name or ring layout. I did not compare ring geometry, so every match is unverified.

| Photo (Commons file page) | Author, licence | Size | Shows | Holes (stated / seen) | Fits |
| --- | --- | --- | --- | --- | --- |
| [Paper Target.jpg](https://commons.wikimedia.org/wiki/File:Paper_Target.jpg) | Angelsharum, CC BY-SA 3.0 | 2576 x 1716 | Close view of a light-cream face with red rings, a red 8 to 10 band, numerals 5 to 10 and an X, torn dark holes with the backing seen through them. No calibre stated. No record. | none / 7 or 8 (one pair touching) | Hole detection on a coloured ring face. Needs a typed hole size. Rings are cut at the frame, so no face search. |
| [Schießscheibe (1).jpg](https://commons.wikimedia.org/wiki/File:Schie%C3%9Fscheibe_%281%29.jpg) | Rollroboter, CC BY-SA 3.0 | 4960 x 6592 | Flat scan of a manufacturer's sighting-in sheet: large black disc with a printed white grid and a white centre bar, three clean white holes, two binder holes in the margin, a fold line, handwriting. Calibre .30-06 (handwritten), three shots at 100 m. No record. | 3 / 3 | Best dark-face case in the set: holes on a printed grid line and on the white bar, light holes on black, non-shot round holes at the margin. The printed sheet is a manufacturer's design (rights unverified). |
| [100m Trefferbild mit 2 Probeschuss tief.jpg](https://commons.wikimedia.org/wiki/File:100m_Trefferbild_mit_2_Probeschuss_tief.jpg) | NebelSTEFAN, CC BY-SA 4.0 | 1944 x 2592 | Phone photo of a dark face with ring lines and numerals over a light sheet, about twenty round black pasters covering earlier holes, green splatter halos around fresh holes, numerals 4 to 9 visible. Rifle "Fr8" at 100 m, calibre not stated. No record. | not stated / about 7 | Pasters look like holes, holes sit at a printed numeral, halos change the hole colour, dark face on light sheet. Strongest hard case. The paster count and the printed face make exact ground truth a manual job. |
| [Target 223 Savage 10FP 25 shot.jpg](https://commons.wikimedia.org/wiki/File:Target_223_Savage_10FP_25_shot.jpg) | Arthurrh, CC BY-SA 3.0 (dual with GFDL) | 1328 x 1197 | Flat scan of a black bull with green numerals, yellow splatter halo, one large ragged hole with two or three small ones beside it. .223 Remington, 69 gr match bullet, 25 shots at 100 yd inside 1 in. | 25 / one merged hole plus 2 or 3 | Merged-hole case: one connected part must count many shots. Not usable for per-hole ground truth. |
| [Target 223 Savage 10FP 5 shot.jpg](https://commons.wikimedia.org/wiki/File:Target_223_Savage_10FP_5_shot.jpg) | Arthurrh, CC BY-SA 3.0 (dual with GFDL) | 1059 x 1452 | Scan of tan card with a printed paster face, orange target spot with black lines, one ragged hole at the centre, handwriting. .223 Remington, 69 gr, 5 shots at 100 yd. | 5 / one merged hole | Merged-hole case on an orange face. |
| [Target 22mag Striker.jpg](https://commons.wikimedia.org/wiki/File:Target_22mag_Striker.jpg) | Arthurrh, CC BY-SA 3.0 (dual with GFDL) | 1076 x 1444 | Scan of tan card, orange spot with a black diamond, clean white holes. .22 Magnum pistol, 5 shots at 50 yd. | 5 / 4 parts (two holes touching) | Best clean coloured-face case with light holes, plus one pair that must count as two. |
| [Ten shot rifle grouping at 100yards.jpg](https://commons.wikimedia.org/wiki/File:Ten_shot_rifle_grouping_at_100yards.jpg) | Hemmers, CC BY-SA 4.0 | 1977 x 1958 | Phone photo of a dark face with cream ring lines and numerals 6 and 8, two small separate holes, a ragged cluster at the centre, a British 2 p coin. NSRA 100 yd small-bore target, Anschutz 1913 SuperMatch (calibre not stated, a small-bore match rifle is a .22 LR, my inference). No record. | 10 / 2 separate plus a cluster | Dark face, holes on and near ring lines, coin for scale. The description gives the coin as 29 mm. The Royal Mint lists the 2 p at 25.9 mm (https://www.royalmint.com/link/3428365d6e1e48469b07fc91d3fcd383.aspx, returned by search, page not opened), so the description is wrong. A test must take its scale from the published NSRA face dimensions. |
| [Cible carabine 10m.jpg](https://commons.wikimedia.org/wiki/File:Cible_carabine_10m.jpg) | Melimelo10, CC BY-SA 4.0 | 1456 x 1538 | Phone photo of a whole 10 m air rifle sheet (light paper, black disc from ring 4, rings 1 to 10 numbered, printer text and a serial number) with one torn hole at the centre and an orange backing seen through it. Calibre not stated (4.5 mm pellet is the usual 10 m air rifle calibre, inferred). Probably matches `issf-10m-air-rifle`, whose record says black from 4 to 9 (unverified match). | "with a 10" / 1 | Fits the existing air-rifle face test: whole sheet, a face with a record, one hole, backing colour. Only one hole. |
| [IMG 0832-blink for luftgevær.jpg](https://commons.wikimedia.org/wiki/File:IMG_0832-blink_for_luftgev%C3%A6r.jpg) | Oyvind Holmstad, CC BY-SA 4.0 | 4649 x 3321 | Hand-drawn pencil rings and a red-pencil centre on light blue paper, pinned to a board at four corners, five tan holes (one dark). Air rifle, calibre not stated. Face not printed. | not stated / 5 | Hole detection only: tan backing on pale blue paper. Not a face search case. |
| [GlowShot 10" Heavy Card Reactive Splatter Paper Target.jpg](https://commons.wikimedia.org/wiki/File:GlowShot_10%22_Heavy_Card_Reactive_Splatter_Paper_Target.jpg) | Tonydanzacutsinline, CC BY-SA 4.0 | 1198 x 1306 | Product photograph of a 10 inch black face with green and orange rings, red centre, numerals, about nine small holes with coloured halos. Calibre not stated. No record. | not stated / about 9 | Dark and coloured face with halos. The printed artwork and logo belong to the manufacturer, so the CC BY-SA claim may not cover them (unverified). Lowest priority. |

## B. Unshot faces (negative controls, face search)

| Photo | Author, licence | Size | Shows | Fits |
| --- | --- | --- | --- | --- |
| [PL7 Bullseye Target.jpg](https://commons.wikimedia.org/wiki/File:PL7_Bullseye_Target.jpg) | Neil Francis, public domain (Commons template for simple text or logo, see note) | 2736 x 3513 | Clean pistol face: black disc from ring 7 with white ring lines and white numerals, light rings with dark numerals out to ring 1. No holes. No record found. | Zero-hole case for numerals on both zones (no proposals expected), manual face path. |
| [B1 full size 1500 target.jpg](https://commons.wikimedia.org/wiki/File:B1_full_size_1500_target.jpg) | Neil Francis, public domain (same template) | 2663 x 3465 | Full-size dark silhouette-ellipse face with white ring lines and numerals 7 to 9 and an X. No holes. No record found. | Zero-hole case on an all-dark face. |
| [Мишень Яблочко.jpg](https://commons.wikimedia.org/wiki/File:%D0%9C%D0%B8%D1%88%D0%B5%D0%BD%D1%8C_%D0%AF%D0%B1%D0%BB%D0%BE%D1%87%D0%BA%D0%BE.jpg) | Chippollino, CC BY-SA 3.0 | 2448 x 3264 | Toy apple-shaped face with blue, red, yellow and black bands and numerals 10 to 100, glare, shot at a wall. No holes. | Colour and glare negative control. |

Note on the public-domain claim of the two Neil Francis photos: the file pages use a template meant for logos and text too simple to be protected. That addresses the printed design, not necessarily the photograph, so the basis is weaker than a plain author dedication. Unverified.

## C. Seen and not usable

| Photo | Why not |
| --- | --- |
| [140711-F-LX370-754 JBER (DVIDS, public domain)](https://commons.wikimedia.org/wiki/File:140711-F-LX370-754_-_JBER_Airmen_train_with_sniper_weapon_system_%28Image_22_of_39%29.jpg) | 2418 x 1405, two torn holes on plain tan cardboard, no face, 7.62 mm sniper rifle per the caption. Only useful as a close-up of what a torn hole looks like. Needs the DoD endorsement line. |
| [Offhandgroup25.jpg](https://commons.wikimedia.org/wiki/File:Offhandgroup25.jpg) | 640 x 480, public domain by the uploader. Five holes on a red sight-in sheet but a revolver covers a third of the frame and the sheet shows a copyright line of its maker. Too small and too covered. |
| [Zielscheibe klein.png](https://commons.wikimedia.org/wiki/File:Zielscheibe_klein.png) | 123 x 124, public domain, 10 air rifle shots. Too small. |
| US Navy and US Army range photographs (for example [A Sailor counts bullet holes in a target](https://commons.wikimedia.org/wiki/File:A_Sailor_counts_bullet_holes_in_a_target._%288199137663%29.jpg), [Helping Iraqi army troops put rounds on target](https://commons.wikimedia.org/wiki/File:Helping_Iraqi_army_troops_put_rounds_on_target_DVIDS204190.jpg), [Zero Target Practice](https://commons.wikimedia.org/wiki/File:Zero_Target_Practice_%2825072271523%29.jpg)) | Public domain or CC BY 2.0 range photographs where the target is a small part of the frame, held, bent or behind a person, with silhouettes or zeroing grids. Not a whole sheet with rings. |
| arXiv 2601.17062 figures | The paper is marked CC0 (arXiv page and PDF metadata). The PDF holds two raster figures (663 x 704 and 652 x 631 px) of real wall-mounted sheets, but the targets are about 100 px wide and the figures carry detection overlays. Not a usable photo. The paper names no released dataset or code. |
| Dartboard, artwork, museum and diagram files in the Commons target categories | Not shot paper targets. |

## D. Bullets and cartridges beside a scale

The cut-out in `bullet-photo.md` uses Otsu on the luma with the border as background and keeps the largest part that does not touch the edge, with the ruler a part of its own. The scale needs two points on a graduation in the bullet's plane. A published diameter or length for the cartridge has to come from a cartridge specification, which I did not look up (unverified for every row).

| Photo | Author, licence | Size | Shows | Fit |
| --- | --- | --- | --- | --- |
| [GP90-bullet.JPG](https://commons.wikimedia.org/wiki/File:GP90-bullet.JPG) | Gremi-ch, CC BY 3.0 (no share-alike) | 800 x 522 | One 5.56 mm GP90 FMJ boat-tail spitzer, fired, corroded copper with rifling marks, lying on a ruler with centimetre and millimetre ticks 0 to 2 cm and beyond, about 30 px per mm by my estimate. White background with glare. | Good for scale and the rifling-mark and corrosion edge case. Low resolution but the only non-share-alike bullet with a ruler. The bullet touches the ruler ticks. |
| [Bullet 7-92Mauser.JPG](https://commons.wikimedia.org/wiki/File:Bullet_7-92Mauser.JPG) (and the [cropped version](https://commons.wikimedia.org/wiki/File:Bullet_7-92Mauser_%28cropped%29.JPG)) | Seha bs, CC BY-SA 3.0 (dual with GFDL) | 3648 x 2736 (cropped 2700 x 1600) | Two copper-jacket 7.92 mm bullets on a transparent millimetre ruler, one upright, one lying, light grey background. | Good: clear silhouette, scale in the bullet's plane. The ruler's edge may join the bullet's part. Two bullets in one frame. |
| [Bullet of caliber .458 Winchester Magnum.jpg](https://commons.wikimedia.org/wiki/File:Bullet_of_caliber_.458_Winchester_Magnum.jpg) | Metronomo, CC BY-SA (all versions) | 4320 x 3240 | One brass-coloured round-nose bullet with a cannelure above a green transparent ruler 0 to 5 cm, pale background, soft glare. | Good: separated from the ruler, plain background, high resolution. Brass colour on a pale background. |
| [Cartridge comparison with mm scale.jpg](https://commons.wikimedia.org/wiki/File:Cartridge_comparison_with_mm_scale.jpg) | WizardOfOz, CC BY-SA 3.0 (dual with GFDL) | 3306 x 1961 | Four cartridges (7x64, 7.92x57, .243 Win, .222 Rem) and one loose 7.92 mm bullet on millimetre graph paper, printed labels. | Medium: the scale is in the same plane, but the grid background and the labels work against a threshold cut-out. |
| [35 Whelen handloaded cartridges.png](https://commons.wikimedia.org/wiki/File:35_Whelen_handloaded_cartridges.png) | Thewellman, CC0 | 1732 x 1792 | Four loaded .35 Whelen cartridges (soft point, polymer tip copper, frangible, cast lead) standing on a 6.4 mm (quarter inch) blue grid. | Low for the photo reading: cartridges not bare bullets, grid behind the cartridges, perspective error. The only CC0 image with a stated scale. |
| Ultratone85 series, for example [.25 Remington with .223 Rem and .308 Win.JPG](https://commons.wikimedia.org/wiki/File:.25_Remington_with_.223_Rem_and_.308_Win.JPG) and [.22 Extra Long](https://commons.wikimedia.org/wiki/File:.22_Extra_Long,_with_.22_Long_Rifle_for_comparison.jpg) (seven files in Category:Bullets with rulers indicating scale) | Ultratone85, CC BY-SA 4.0 | 2092 to 3214 px per side | Loaded cartridges standing upright beside a vertical metric and inch steel rule on a wooden table. | Low: cartridges, not bullets, ruler beside rather than under them, brown reflective background. Resolution is high. |

Other CC0 bullet photographs by Thewellman (for example [ThirtyCaliberFullMetalJacketBullets.png](https://commons.wikimedia.org/wiki/File:ThirtyCaliberFullMetalJacketBullets.png), [Five301906govtBullets.png](https://commons.wikimedia.org/wiki/File:Five301906govtBullets.png)) show bare bullets in side view on a yellow tray, 2000 px and more, but carry no ruler. They could serve an outline test only with a published diameter, not a scale reading.

## E. Data sets and archives checked

| Source | Result |
| --- | --- |
| Kaggle [Yolo_Shot_Datasets_with_Annots](https://www.kaggle.com/datasets/pfrmusic/yolo-shot-datasets-with-annots) (owner Hayati_Yurtoglu) | Photos of target paper with holes, YOLO boxes. The Kaggle API reports licence "MIT", a software licence outside the accepted set, and 8.3 MB in total, so the images are small. Image count and resolution not checked. Not accepted. |
| Roboflow Universe bullet-hole projects (pitrosz, project-bat, ali-7ylpc, mcmc) | Search results quote CC BY 4.0 for some. The pages answer automated requests with HTTP 403, so licence, image count and size are unverified. Universe projects are usually collected from many sources, so a CC BY label does not show that the uploader could grant it. Not accepted until the images are inspected by a person. |
| Butt et al., AI 2024, 5(1), 5 (https://doi.org/10.3390/ai5010005) | The article is CC BY 4.0 (Crossref licence record). The abstract says the dataset is public. The host is not named in anything I could read, the images were resized to 640 x 640, which is too small for whole-sheet tests, and the article licence does not show the dataset licence. Unverified. |
| UAH bullet impact set (https://doi.org/10.21950/PVWAHT, e-cienciaDatos) | 1,800 PNG images of impacts on particleboard and drywall, not paper targets. Custom terms of use whose wording I could not read. Not accepted. |
| MDPI NDT 2023, 3(3), 16 (https://doi.org/10.3390/ndt3030016) | Forensic bullet-hole comparison on controlled and uncontrolled images. Page blocked (HTTP 403), no dataset release confirmed. Unverified. |
| NIST Ballistics Toolmark Research Database | Microscope and topography data of fired bullets and cases, not photographs with a ruler. Out of scope. |
| Zenodo, figshare | Searches returned no record of shot-target photographs or bullet photographs with a scale. Not exhaustive. |
| DVIDS and US Navy and Army photographs | Public domain in the US per the DVIDS notice, with the endorsement line. Mirrored on Commons, listed in sections A to C. |
| Smithsonian Open Access | One search found no bullet photograph with a scale. Not exhaustively searched. |

## What is usable, in order

1. Shot faces for hole detection: Schießscheibe (1), 100m Trefferbild, Target 22mag Striker, Ten shot rifle grouping, Cible carabine 10m, Paper Target. These cover dark faces, holes on printed lines and numerals, pasters, a coloured face with halos, a face with a record, and merged holes. All CC BY-SA.
2. Merged-hole counting: the two Savage scans, with stated shot counts of 25 and 5.
3. Zero-hole controls: PL7 Bullseye and B1 1500 (public domain claim of weaker basis), Мишень Яблочко (CC BY-SA).
4. Bullet reading: GP90-bullet (CC BY 3.0), Bullet 7-92Mauser, the .458 Winchester Magnum bullet, then Cartridge comparison with mm scale. Everything else is cartridges.

## What stays unverified

- Hole counts, face matches to records and pixel scales: not measured on the full-size files.
- Whether the printed design on a sheet (Mauser sighting sheet, GlowShot artwork, the Redfield sheet) restricts reuse beyond the photograph's licence.
- The licence basis of the two PD-textlogo photographs.
- The Royal Mint 2 p figure was taken from a search result, not from an opened page.
- Licences and sizes of the Roboflow, Butt et al. and MDPI NDT data.
- Published bullet dimensions for the bullet photographs.
- Commons holds more photographs than I could list. The search was by keyword and by category, so a shot target filed in no target category may be missing.
- Everything outside Commons was a keyword search, not a crawl.
