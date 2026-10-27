# Sources and terms for real bullet, powder, case and primer data

Research note, read on 2026-10-27. Every legal reading below is unverified and is not legal advice. Evidence tags: `[read]` the page text was read in full for the clause, `[summary]` only a fetch tool's summary was available, `[search]` only a search result snippet. No page was crawled, no file was bulk-downloaded, no value was copied.

## Result

- No source found allows publishing real bullet, powder, case or primer records as an open dataset. No maker's terms grant a licence for its specification values.
- Of the 15 makers checked: 7 restrict copying and reuse of site content in their terms (two name "data" or "product information"), 1 allows copying only to place an order, 2 state only that the user will not violate copyright, and 5 have no terms that could be read (not found or built by script). None of the 15 grants a permission.
- Open sources exist only for narrow parts: US Government reports (no US copyright, each report to be checked), a government database under an open licence (images, no specification values), and the maker's own supply of a file to a free tool (one case, no licence stated).
- No openly licensed primer dataset exists, which confirms the finding of issue 36. No CC BY publication with a DOI that carries bullet, powder, case or primer specifications was found.
- The route that stays is written permission per maker, recorded in the source record (`origin` `manufacturer`, `license` `LicenseRef-<name>`, `terms`), as `packages/data/AGENTS.md` (Provenance) already requires. The permission must allow redistribution under the data licence of the repository (CC BY 4.0, `README.md` License section).

## Scope and method

- Makers: the ranking "ten largest" was not verified. The selection is the makers whose specification, catalogue or legal pages were reachable, grouped by owner, 15 in all (M1 to M15), covering all four kinds. Maker names, owners, URLs and quoted owner names are left out of the public note: the rows carry a key and a role. The clause quoted is the one that governs reuse, cut to one sentence, with the owner's name replaced by "[owner]".
- Terms were read once per maker, a single page each, with a plain fetch. Several sites answered 403 to the script or showed a page built by script, so those rows say what was not read.
- Records carry provenance and terms (`packages/schema/src/provenance.ts`: `origin`, `license`, `terms`); the same fields apply to every row below.

## Which values carry the lesser legal risk

Unverified, not legal advice.

- Lower risk: bare numeric specifications of a product (bullet diameter, mass, ballistic coefficient as a number, water capacity of a case, primer size and type, powder name and class), each transcribed by hand with a citation of the page. Facts are not protected by copyright in the US ([copyright office FAQ](https://www.copyright.gov/help/faq/faq-protect.html), [Feist](https://www.law.cornell.edu/supremecourt/text/499/340) [summary]).
- Higher risk: photographs, drawings, descriptive text, and a compiled table or a whole catalogue taken as a selection. The EU database right protects the extraction of a substantial part of a database whatever its contents ([Directive 96/9/EC](https://eur-lex.europa.eu/eli/dir/1996/9/2019-06-06) [summary]). Load tables (charge weights with velocity and pressure) are a maker's compiled work and a safety-critical claim; they stay out.
- Contract: terms of use can restrict facts even where copyright does not. Two makers' terms name "product information" (M6) and "data" (M10) next to copying. Whether a browse-wrap term binds a visitor is unverified and depends on the country.
- Names and marks: product and maker names are trademarks. Using them to name a product record is probably descriptive use. Unverified.
- The owner's decision is whether a hand-transcribed number with a page citation is enough without a grant. The project took the cautious route for firearm records (`apps/docs/docs/data/firearm-records.md`, option E: permission first, invented demo records until then). The same rule fits here.

## Makers

Kinds: B bullets, P powders, C cases, R primers. The "Reuse with attribution" column answers: do the terms read allow publishing the values with attribution without asking.

| Key | Role (kinds) | Governing clause | Reuse with attribution | Contact route for a permission request |
|---|---|---|---|---|
| M1 | US bullet and loaded-ammunition maker, load-data publisher (B, C) | "You further agree that you will not violate any copyright or other law with respect to your use of the Site." [summary]. No clause on copying, reuse or automated access; the footer claims copyright. | Not stated. Copyright applies by default; no permission given. | The terms page names an online form and a phone line. |
| M2 | US bullet and ammunition maker (B, C) | "Permission is granted to electronically copy and to print hard copy portions of this website for the sole purpose of placing an order with [owner] or using this website as a shopping resource." [read] Any other use "without prior written permission of [owner] is strictly prohibited". | No. | A phone number on the terms page and a contact page. |
| M3 | US precision bullet maker, site run by a group LLC, part of a Nordic group (B) | "You agree not to reproduce, duplicate, copy, sell, resell or exploit any portion of the Service, use of the Service, or access to the Service or any contact on the website through which the service is provided, without express written permission by us." [read] Section 12 also bans "spider, crawl, or scrape". | No, written permission needed. | Section 20 prints a sales mailbox for questions about the terms. |
| M4 | US bullet maker (B) | The user agreement sits inside the privacy page: "You further agree that you will not violate any copyright or other laws with respect to your access to or use of the Site." [read] No reuse clause. | Not stated. No permission given. | A contact page and a phone line on the site. |
| M5 | US bullet maker (B) | No terms page found (guessed paths returned 404; the privacy page holds none); footer "© 2026 [owner]". Owner relation to M4 not checked. | Unverified. | A contact page and a phone line on the site. |
| M6 | US ammunition and component group whose terms page the sites of a bullet maker, two primer makers, a powder maker, an ammunition maker and a US distribution brand link to (B, P, R, C). The link is observed; ownership of each brand by this group is not asserted. | "You further agree not to download or copy any content or product information for the benefit of any third party or use any data mining, robots, or similar data gathering and extraction tools." [read] Also: no reproduction for a commercial purpose "without the express written consent" of the group. | No. | The terms name a "Contact Us" form and a copyright-agent mailbox and postal address; written consent is the route. |
| M7 | Finnish case and bullet maker, subsidiary of a Nordic group (C, B) | "Duplication, distribution, alteration or alternative use without a prior written consent from [owner] is prohibited." [read] The page also says the content is owned by the company. The maker publishes radar-measured drag data for its bullets through its own software (a trade page, not read). | No. | A contact page with a form; a distributor list. |
| M8 | Finnish powder maker, same group as M7 (P, R) | Same sentence as M7. A link to the site needs prior approval. [read] | No. | A contact-information page. |
| M9 | US brass maker (C) | "You may not copy, reproduce, modify, distribute, display, or exploit any part of the website content without prior written permission, except as permitted by law." [read] | No (the "as permitted by law" carve-out is the only room). | Phone numbers and an email on the terms page. |
| M10 | US ammunition and primer maker, site owned by a chemical group (R, C, ammunition) | "Other than as expressly allowed by [owner], you may not download, post, display, copy, reproduce, distribute, transmit, modify, perform, broadcast, transfer, create derivative works from, sell or otherwise exploit any content, code, data or materials on or available through the Website." [read] Retailers may reuse promotional material for sales only. | No. | A contact page; a copyright agent is named for notices. |
| M11 | German ammunition and component maker (R, C, B) | Imprint: "Alle Texte, Software und Bilder dieser Homepage sind Eigentum der [owner] und dürfen ohne unsere ausdrückliche schriftliche Genehmigung nicht verwendet werden." (All texts, software and images of this site belong to the company and may not be used without its express written permission.) Then: "Die Daten in den Downloadbereichen dürfen für den unkommerziellen Eigenbedarf verwendet werden." (Data in the download areas may be used for non-commercial own use.) [read] | No. Non-commercial own use does not cover republication. | A product-questions mailbox in the imprint. |
| M12 | US powder group with several powder brands, publishes a yearly manual and a reference-data section (P) | No terms found. The group's site answered 403 to the script; through the fetch tool the footer showed no terms link; a similar domain that carries "Terms of Service" is a parked domain of a domain registrar and is not the maker's. Footer: "© 2026 [owner]". | Unverified. | A contact page on the maker's reloading site. |
| M13 | Swedish cartridge and component maker (C, B) | Footer links privacy policy and imprint; the pages are built by script and the text was not read. | Unverified. | None found in the text read. |
| M14 | Czech ammunition and component maker (R, C, B) | No terms link found on the English home page; contact page exists. | Unverified. | A contact page. |
| M15 | Swiss powder maker (P) | Footer "© 2026 [owner]"; no terms page found. The site offers a download of the maker's own powder datasets (14 powders) for import into a free handload simulation tool, stated as an addition to the maker's datasets, not the tool itself. [read] | Not stated. The offer shows the maker supplies its data to a free tool; no licence is attached. | Distributors page and a contact form on the site. |

Kinds covered by makers whose terms were read: bullets M1 to M4, M6, M7; powders M6, M8, M15 (M12 unread); cases M7, M9, M10, M11; primers M6, M10, M11.

### What the pages print (so what a transcription could take)

- A bullet maker's product page printed caliber and mass in the product name; a "Specifications" tab and a ballistic-coefficient page were linked, and their text was not in what was read, so the presence of BC values is unverified. [summary]
- A bullet maker's category page printed diameter and mass in product names, no length or BC. [summary]
- A case page of one maker printed caliber, product number, primer type and bullet diameter, no water capacity or mass. [summary]
- A primer listing printed primer style and size class (small, large, pistol, rifle, magnum), package size and product numbers, no cup diameter, height, material or composition. [summary] The primer page of M10 returned 404. This matches issue 36: no primer dimension or performance figure is published on the pages read.
- Powder burn-rate charts and load data exist on maker sites; not read, and a load table is outside the lower-risk class above.

## Open and public sources

| Key | Source (owner) | Governing clause | Reuse with attribution | Contact route |
|---|---|---|---|---|
| O1 | US Government works, 17 U.S.C. 105 | "Copyright protection under this title is not available for any work of the United States Government" ([text](https://www.law.cornell.edu/uscode/text/17/105)) [read] | Yes for a work of the Government itself, in the US; outside the US unverified. Contractor-written or third-party material inside a report is not covered. | None needed; cite the report. |
| O2 | Defense Technical Information Center (DTIC), report host | "Databases and some publications created by DTIC staff are works of the U.S. Government." ([notice](https://discover.dtic.mil/privacy-security-copyright/)) [summary]. Covers DTIC staff works only; each report carries its own distribution statement. | Per report, after reading its distribution statement. | [contact page](https://discover.dtic.mil/contact-us/) |
| O3 | Army ballistic research reports on exterior ballistics of military small arms ammunition (found through DTIC search results; one is a memorandum on .50 caliber ball and armor-piercing aerodynamics, another covers ballistic coefficients of small arms bullets) | The `[search]` snippet of one shows a public-release, unlimited-distribution marking; its PDF answered 403, so the marking is unverified. | Probably, per report, if the marking holds. Covers military ball ammunition, not commercial products of the makers above. | The report's issuing laboratory, via DTIC. |
| O4 | Standard drag functions (G1, G7 and related) | A third-party code project states its drag tables are "PUBLIC DOMAIN - No restrictions on use" and cites two older US reports as origin. [summary] The two reports were not read. | Likely usable as published functions; unverified until the original reports are read. | Not applicable. |
| O5 | NIST Ballistics Toolmark Research Database (National Institute of Standards and Technology) | "Please explicitly acknowledge the National Institute of Standards and Technology as the source of the data" ([NIST open licence](https://www.nist.gov/open/license)) [read]. Some NIST works "may have been written by third parties and may be subject to copyright protection." | Yes with acknowledgement. Holds images and 3D topography of fired bullets and cases from handguns, no catalogue specifications. [search] | See NIST licence page. |
| O6 | Smokeless powder database of a university forensic centre, built with an explosives working group and funded by a justice-department institute | A search summary states the sample data and interpretations belong to each contributing source; the site's own terms were not read (certificate error). [search] Holds photomicrographs, physical characteristics, GC-MS and FTIR data, no burn rate or load data. | Unverified. | The database page names a representative per source. |
| O7 | Preprint on free-flight drag of 5.56 mm bullets with amateur Doppler radar, DOI 10.48550/arXiv.1608.06500 ([abstract](https://arxiv.org/abs/1608.06500)) | arXiv's distribution licence: "I grant arXiv.org a perpetual, non-exclusive license to distribute this article." ([licence](http://arxiv.org/licenses/nonexclusive-distrib/1.0/)) [summary]. It grants rights to arXiv only; it is not an open licence for others. | Not as a licence. Facts only with a citation, or ask the authors for CC BY. | The authors via the arXiv page. |
| O8 | C.I.P. Tables of dimensions of cartridges and chambers | Footer "© C.I.P. - All rights reserved"; no terms page ([site](https://www.cip-bobp.org/en)) [summary]. | Already the basis of the cartridge records; no grant on file. Not component data. | [contact page](https://www.cip-bobp.org/en/contact) |
| O9 | SAAMI voluntary standards (cartridge and chamber drawings) | The terms say all content "is owned or licensed by or to SAAMI" ([terms](https://saami.org/terms-of-use/)) [summary]; the firearm note quotes "exclusive property of SAAMI" [read]. | No licence given; written permission. | A phone number on the terms page. |
| O10 | USPTO patent documents | Generally not under copyright with limited exceptions ([terms](https://www.uspto.gov/terms-use-uspto-websites), as read in `firearm-records.md`). Primer and powder patents can state compositions and ratios. | Single facts with a citation; not a catalogue source. | Not applicable. |

CC BY publications with a DOI: searches for open datasets of drag measurements, powder burn rates, primer output, case dimensions and ammunition composition found no CC BY data set with product specifications. The one CC BY item that surfaced is a forensic journal paper on gunshot-residue composition, which describes residue, not products. Search coverage was a handful of web searches, not a repository query: unverified.

## How other open projects obtain data

- A free handload simulation tool receives powder datasets as a file the Swiss maker (M15) publishes for it, with no licence text. Forum posts say powder makers are reluctant to release closed-vessel data and that volunteers derive profiles from chronograph data. [search, forum posts, unverified]
- A published code package ships standard drag tables labelled public domain and sourced from US Army reports (O4). [summary] Other open calculators were not checked for bundled maker data.
- Open Food Facts publishes its database under the Open Database Licence and the contents under the Database Contents Licence, with a separate producers site. Its legal page says nothing about what producers contribute or under which terms ([legal](https://world.openfoodfacts.org/legal)) [read]. What it asks makers is unverified.
- Commercial desktop software for pressure simulation: no statement on data permissions found. Unverified.
- Inside this project: `apps/docs/docs/data/firearm-records.md` reached the same finding for firearm makers and chose permission first, invented demo records until a grant, and an owner task to send requests. `AGENTS.md` (Conventions, Reference material) allows measurement data a publication releases under CC BY 4.0 and US Government reports approved for unlimited release.

## Permission request (what to ask for)

A written grant per maker or authority that covers:

- the fields wanted by record kind (bullet: diameter, mass, length, ogive form, ballistic coefficient with its reference function; powder: name, class, grain form; case: mass, water capacity, flash hole, primer pocket; primer: size, type, cup material and dimensions, if the maker has them);
- publication of those values in a public repository under CC BY 4.0 with attribution, copying and redistribution by anyone, including commercial reuse;
- use of the maker's and product names to name records;
- no photographs, text, drawings or load tables.

Record the grant in the source record: `origin: manufacturer`, `license: LicenseRef-<name>`, `terms` as the permission note.

## Not verified

- Wording of every `[summary]` and `[search]` row; the terms of M5, M12, M13 and M14; the pages behind scripts (M13 imprint, M12 terms, specification tabs of M1); the PDFs of the DTIC reports (403); the terms of the university powder database; the original reports behind the standard drag functions.
- Whether browse-wrap terms bind a reader, whether the EU database right applies to a maker's page, and the legal status of a hand-transcribed number outside the US.
- The ranking of the ten largest makers per kind.
- Which maker will grant what: no request was sent.
