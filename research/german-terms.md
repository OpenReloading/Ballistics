# German terms for reloading and ballistics

German terms for the components, measurements, procedures and target-shooting concepts the app shows, each with the document that uses the term. Terms are listed and cited, no text is copied.

Research date: 2026-10-27. Ticket: OpenReloading/Ballistics#274.

## Method and coverage

- The term list is built from `GLOSSARY.md` and the labels of `apps/web/src` (the field labels of the workbench, firearm editor, case editor, ring scoring and hit probability tools, the readouts, and the library tabs). A count of the label strings picked the terms to include, the tables are ordered by category, not by frequency. The most frequent labels (Name, Distance, Manufacturer, Muzzle velocity, Cartridge, Federation, Case fill, Barrel length, Peak pressure, Charge, Mass, Water capacity) each have a row. The frequent interior-ballistics labels without a row are named under Not reached. Interface chrome (Search, Settings, Copy link, Zoom) is out of scope.
- The tables hold 177 rows (a few rows group closely tied concepts), more than the 100 the ticket asked for first. 155 rows have a German term in a primary source: 124 verified and 31 disputed. 22 rows are unverified: no primary German source was found.
- Every German word below was found by full-text search of the PDF of the cited document, then read in context on its page. A word that the OCR of an old scan renders badly was checked against the surrounding sentence.
- Primary sources are the rule books of the German federations named in `packages/data/records/federations` (DSB, BDS, BDMP, VdRBw, DSU; the file hashes match the source records), the C.I.P. sheets and annex published in German, the Waffengesetz, and manufacturer documents in German (the RWS reloading book and the RCBS die manual). Secondary sources (forums, wikis, shops, magazines) were not used for any verified row.
- A row is disputed when two or more different German words (not inflections or compounds of one word) are found for the concept, in one source or in several. The row says which source uses which word. Verified means one word, possibly with a compound or an abbreviation (Hülse and Patronenhülse, Mündungsgeschwindigkeit and V0).
- Unverified means no primary German source was found. The German column then holds a candidate or "none", and the source column says what was searched.

## Sources and page conventions

| Key | Document | Edition | Page convention |
| --- | --- | --- | --- |
| DSB | Sportordnung des Deutschen Schützenbundes | Stand 01.01.2027, https://www.dsb.de/fileadmin/DSB.DE/PDF/PDF_2026/DSB-Sportordnung_2027.pdf | section number, PDF page |
| BDS-Z | BDS Sporthandbuch Zielscheiben | Fassung des BVA-Genehmigungsbescheids vom 27.06.2025, Red. 30.06.2025 | printed page Z-n, PDF page n+1 |
| BDS-A, BDS-L, BDS-K, BDS-Komm | BDS Sporthandbuch Allgemeiner Teil, Langwaffen, Kurzwaffen, Kommentar | 2026 (A: Änderungsversion auf Basis des Bescheids vom 30.06.2026) | section number, PDF page |
| BDMP | BDMP-Handbuch Sportordnung, Teile A bis F (bundle "Teile") and Register 6 and 9 | Sportordnung v. 24.02.2026, Stand 04.12.2025 | section number, PDF page of the named file |
| VdRBw | Schießsportordnung des VdRBw e.V. | bewilligt 18.12.2023 | PDF page |
| DSU | DSU Sporthandbuch | Ausgabe Stand 2018 | PDF page |
| CIP-TDCC | C.I.P. TDCC sheet "44 Rem. Mag.", German version, TAB. IV | Datum 86-12-14, Revision 20-11-10, https://bobp.cip-bobp.org/uploads/tdcc/tab-iv/44-rem-mag-200922-de.pdf | one page |
| CIP-CR1 | C.I.P. Anlage III, Tab. I-IV CR 1, Messläufe, German version | Datum 02-05-15, Revision 03-04-11, https://bobp.cip-bobp.org/uploads/annexe/anliii-de-cr1.pdf | one page |
| WaffG | Waffengesetz, Anlage 1 (Waffen- und munitionstechnische Begriffe) and § 15 | as published at https://www.gesetze-im-internet.de/waffg_2002/ on 2026-10-27 | Abschnitt, Unterabschnitt, Nummer |
| RWS | RWS (RUAG Ammotec, Dynamit Nobel), Wiederladen (Handbuch für Jäger und Schützen), 9. Auflage 2002, one PDF per chapter (Kap. 1 to 4, 6, 8, 9) from https://rws-ammunition.com/de/service/downloads | 9th ed. 2002 | chapter and PDF page of the chapter file; Kap. 9 printed page = PDF page + 569 |
| RWS-web | RWS German web pages, https://rws-ammunition.com/de/ (Wiederladekomponenten, Glossar, a product page) | read 2026-10-27 | page name |
| RCBS | RCBS, Bedienungsanleitung für Reloading Dies (German), https://rcbs.com/wp-content/uploads/2024/09/MATRIZEN.pdf | undated, PDF created 2007 | "Seite n von 9" |

The rule books of the federations are the first source for target shooting. For reloading and ballistics they say little (they regulate shooting, not loading), so the manufacturer documents and the C.I.P. sheet carry those terms.

## Components and equipment

| English term (as in the app) | German term | Source (edition, section or page) | Status |
| --- | --- | --- | --- |
| Bullet | Geschoss | WaffG Anlage 1 Abschn. 1 Unterabschn. 3 Nr. 3; CIP-TDCC block "Geschoss"; RWS Kap. 3 p. 1 (contents, Das Geschoss) | verified |
| Powder, propellant | Treibladungspulver, short Pulver | RWS Kap. 3 p. 1 and p. 11; BDMP Register 9 D.6.1 p. 29 (Nitro-Treibladungspulver); RCBS Seite 1 (Pulver) | verified |
| Primer | Zündhütchen; also Anzündhütchen, Zünder, Zündung | Zündhütchen: RWS Kap. 3 p. 1, RCBS Seite 1, DSB 7.2.1.3 p. 340, BDMP Teile E.0.3 p. 540. Anzündhütchen: RWS-web Wiederladekomponenten and Glossar. Zünder: RCBS Seite 1. Zündung: RWS Kap. 9 p. 16 | disputed |
| Case, brass | Hülse, Patronenhülse; brass: Messinghülse | RWS Kap. 9 p. 16; RWS Kap. 3 p. 2 (Messinghülsen); RCBS Seite 3; BDMP Teile C.1.6 p. 108 | verified |
| Cartridge | Patrone | WaffG Anlage 1 Abschn. 1 Unterabschn. 3 Nr. 1.1 (Patronenmunition); CIP-TDCC header "PATRONE"; RWS Kap. 9 p. 24 | verified |
| Ammunition | Munition | WaffG Anlage 1 Abschn. 1 Unterabschn. 3 Nr. 1 | verified |
| Chamber | Patronenlager | WaffG Anlage 1 Abschn. 1 Unterabschn. 1 Nr. 1.3.1.3; CIP-TDCC header "PATRONENLAGER" | verified |
| Barrel | Lauf | WaffG Anlage 1 Abschn. 1 Unterabschn. 1 Nr. 1.3.1.1; CIP-TDCC block "Lauf" | verified |
| Lands | Felder | RWS Kap. 2 p. 3 and Kap. 4 p. 27; BDMP Register 9 D.6.1 p. 29 | verified |
| Grooves | Züge (singular Zug) | CIP-TDCC block "Züge"; RWS Kap. 2 p. 3; BDMP Register 9 D.6.1 p. 29 | verified |
| Bore diameter, groove diameter | Felddurchmesser, Zugdurchmesser as candidates; the sheet prints only the symbols F and Z under "Lauf" | CIP-TDCC block "Lauf" (symbols only); no document found that spells the compounds | unverified |
| Twist (rate of rifling) | Drall; length per turn: Dralllänge | RWS Kap. 9 p. 3 (entry Drall); BDMP Register 9 D.6.1 p. 29 (Dralllänge) | verified |
| Twist hand | Drallrichtung, Rechtsdrall as candidates | searched all documents of this note, no hit | unverified |
| Case neck | Hülsenhals | CIP-TDCC block "Hülsenhals"; RWS Kap. 3 p. 4; RCBS Seite 3 | verified |
| Case shoulder | Schulter, Hülsenschulter (RWS); C.I.P. sheet: Schulterkonus | RWS Kap. 3 p. 4; CIP-TDCC block "Schulterkonus" | disputed |
| Case mouth | Hülsenmund | RCBS Seite 3; RWS Kap. 6 p. 1 (Aufweiten des Hülsenmundes); BDMP Register 9 D.17.6 p. 138 | verified |
| Case head, case base | Hülsenboden (cartridge column), Stoßboden (chamber column) | CIP-TDCC blocks "Hülsenboden" and "Stoßboden"; RWS Kap. 3 p. 3 | verified |
| Rim, rimless, belted | Rand, randlos, Gürtelhülse | RWS Kap. 9 p. 16 (translation list) | verified |
| Headstamp | Bodenstempel (Hülsenprägung) | RWS Kap. 3 p. 5 | verified |
| Primer pocket | Zündglocke | RWS Kap. 3 p. 2 and p. 3; RWS Kap. 9 p. 2 | verified |
| Flash hole | Zündloch | RWS Kap. 2 p. 3; RWS Kap. 4 p. 2 | verified |
| Primer size small, large | kleines, großes Zündhütchen | RWS Kap. 9 p. 16 (small primer, large) | verified |
| Primer, rifle or pistol, magnum | no German pair found for rifle, pistol and magnum primers | searched the cited documents | unverified |
| Primer compound (lead-free) | bleifreier Zündsatz; Zündsatz | RWS Kap. 9 p. 2 (Bleifreier Zündsatz); RWS Kap. 3 p. 8 | verified |
| Grain form: ball | Kugelpulver | RWS Kap. 3 p. 14; RWS Kap. 9 p. 8 | verified |
| Grain form: extruded (tube) | Röhrchenpulver | RWS Kap. 3 p. 13; RWS Kap. 9 p. 10 | verified |
| Grain form: flake | Blättchenpulver | RWS Kap. 3 p. 12 | verified |
| Propellant base: single, double, triple | einbasig, zweibasig, dreibasig | RWS Kap. 3 p. 14; RWS Kap. 9 pp. 3 and 4 | verified |
| Bulk density | Schüttgewicht (RWS). Schüttdichte is not used in any searched document | RWS Kap. 3 p. 15 and p. 18; Schüttvolumen RWS Kap. 8 p. 52 | verified |
| Burn rate | Abbrandgeschwindigkeit (RWS Kap. 3), Verbrennungsgeschwindigkeit (RWS Kap. 2) | RWS Kap. 3 p. 11; RWS Kap. 2 p. 3 | disputed |
| Jacket | Mantel, Mantelgeschoss | RWS Kap. 9 p. 16; BDMP Teile C.4.3 p. 114 | verified |
| Core | Kern, Geschosskern | RWS Kap. 3 p. 20 | verified |
| Full metal jacket | Vollmantel, Vollmantelgeschoss | RWS Kap. 9 p. 16; BDMP Teile C.4.3 p. 114 | verified |
| Soft point | Teilmantelgeschoss; RWS names Teilmantel the general sense of "softpoint" | RWS Kap. 9 p. 16; BDMP Teile C.3.3 p. 111 | verified |
| Hollow point | Hohlspitze, Hohlspitzgeschoss | RWS Kap. 9 p. 16 and p. 6; RWS Kap. 3 p. 21 | verified |
| Boat tail | Bootsheck (RWS translation list), Heckkonus (RWS entries) | RWS Kap. 9 p. 16 and p. 14; RWS Kap. 2 p. 6 | disputed |
| Gas check | Kupferschuh, Geschossschuh | RWS Kap. 9 p. 16 and p. 5 | disputed |
| Lead bullet (cast) | Bleigeschoss; cast: selbstgegossen | RWS Kap. 8 p. 1 (contents) | verified |
| Cannelure | Rändelung, Crimprille | RWS Kap. 9 p. 16; RWS Kap. 4 p. 28 | disputed |
| Ogive | Ogive (used as the German word for the bullet's nose form) | RWS Kap. 4 p. 27 | verified |
| Bearing length | Führungsteil of the bullet | RWS Kap. 3 p. 20 | verified |
| Meplat, polymer tip | none found | searched all documents | unverified |
| Caliber | Kaliber | WaffG Anlage 1 Abschn. 1 Unterabschn. 1 Nr. 1.3.1.1; RWS Kap. 1 p. 13; BDS-A and DSB use it throughout | verified |
| Bullet diameter | Geschossdurchmesser | RWS Kap. 1 p. 13 and Kap. 4 p. 14; CIP-TDCC symbol G1 under "Geschoss" | verified |
| Bullet mass, bullet weight | Geschossgewicht (DSB, BDS-K) and Geschossmasse (RWS headword) | DSB 2.16.1 p. 151; BDS-K K 7.06 p. 28; RWS Kap. 9 p. 4 | disputed |
| Mass (generic label) | Masse | RWS Kap. 9 p. 4 (Geschossmasse) | verified |
| Firearm | Schusswaffe | WaffG Anlage 1 Abschn. 1 Unterabschn. 1 Nr. 1.1 | verified |
| Rifle | Gewehr, Langwaffe; Büchse in hunting and reloading texts | DSB p. 95 table (Gewehr, Langwaffe); RWS Kap. 4 p. 1 (Büchsenpatronen) | disputed |
| Pistol, revolver, handgun | Pistole, Revolver, Kurzwaffe | DSB p. 98 table (Kurzwaffe, Pistolentabelle); BDS-K K 1.11 p. 4 (Revolver) | verified |
| Scope | Zielfernrohr | DSB p. 95 table; BDMP Register 9 D.11.4 p. 67 | verified |
| Reticle | Absehen | BDMP Register 9 D.11.4 p. 67; DSB 1.8.6 p. 131 | verified |
| Iron sights | offene Visierung, Visierung | VdRBw p. 93; BDS-L L 14.01 p. 9 | verified |
| Red dot | Leuchtpunktvisier (BDMP), Leuchtpunktvisierung LV (DSU), Rotpunktvisier and Leuchtpunktvisier (BDS-L), Reflexvisier and elektrooptische Visierung (VdRBw) | BDMP Teile D.16.16 p. 338; DSU p. 11; BDS-L L 14.07 p. 80; VdRBw p. 53 | disputed |
| Front sight, rear sight | Korn, Kimme; Diopter | DSB 0.5.3.1 p. 32 and table p. 98 | verified |
| Elevation (turret) | Höhenverstellung | BDS-Komm p. 16 | verified |
| Windage (turret) | Seitenverstellung | BDS-K p. 9; VdRBw p. 93 | verified |
| Click (turret) | Klickverstellung | RWS Kap. 8 p. 27 | verified |
| Manufacturer | Hersteller | RCBS Seite 1 | verified |
| Lot | Los (Pulverlos, Munitionslos) | RWS Kap. 9 p. 16 | verified |
| Country (of origin) | Ursprungsland | CIP-TDCC header | verified |
| Alias, other names | Alternative Namen | CIP-TDCC header | verified |
| Name, designation | Name (plural Namen); Bezeichnung | CIP-TDCC header (Alternative Namen); RWS Kap. 9 p. 24 (Bezeichnung der Munition) | verified |
| Standard table | Tabelle (TAB. I to VII); date: Datum; revision: Revision | CIP-TDCC header | verified |
| Tolerance | Toleranzen | CIP-CR1 section 1 | verified |
| Dimensions | Maße | CIP-TDCC footer (Maße in mm); RWS Kap. 9 p. 24 (Maßtabelle) | verified |

## Measurements

| English term (as in the app) | German term | Source (edition, section or page) | Status |
| --- | --- | --- | --- |
| Muzzle velocity | Mündungsgeschwindigkeit, abbreviation V0; also Anfangsgeschwindigkeit | BDS-K K 7.06 p. 28; DSB 2.16.1 p. 151; BDMP Register 9 D.23.1.4 p. 212; RWS Kap. 9 p. 9; Anfangsgeschwindigkeit RWS Kap. 2 p. 5 | disputed |
| Muzzle energy | Mündungsenergie (DSB, RWS); DSB also writes Geschossenergie | DSB 0.2 p. 22; DSB 0.5.1 p. 32; RWS Kap. 9 p. 9 | disputed |
| Muzzle pressure | Mündungsgasdruck | RWS Kap. 2 pp. 3 and 4 | verified |
| MIP factor (momentum index) | Mindestimpuls | BDS-K K 7.06 p. 28; DSB 2.21.1 p. 157; BDMP Teile C.13A.3 p. 183 | verified |
| Peak pressure, chamber pressure | Gasdruck (the pressure), Maximalgasdruck and Maximaldruck (its peak) | RWS Kap. 9 p. 5 (Gasdruck); RWS Kap. 4 p. 12 (Maximalgasdruck); RWS Kap. 2 p. 3 (Maximaldruck) | disputed |
| Pmax (C.I.P. maximum pressure) | Pmax under "Drücke (Energien)"; limit tables: zulässige höchste Gebrauchsgasdrücke | CIP-TDCC block "Drücke (Energien)"; RWS Kap. 9 p. 24 | verified |
| Pressure by transducer | mechanisch-elektrischer Wandler | CIP-TDCC block "Drücke (Energien)", line "Mech. elektr. Wandler" | verified |
| Pressure by piezo | Piezo-Messquarz | RWS Kap. 2 p. 3 | verified |
| Pressure by crusher | Kupferstauchzylinder | RWS Kap. 2 p. 3 | verified |
| Measuring barrel, measuring position | Messlauf, Messstelle (M) | CIP-CR1 title and section 3 | verified |
| Case capacity | Hülsenvolumen | RWS Kap. 4 p. 3 | verified |
| Water capacity | Wasserkapazität, Wasserinhalt as candidates | searched all documents, no hit | unverified |
| Overall length (COAL) | Patronenlänge (RWS Kap. 9), Gesamtlänge and Gesamt-Patronenlänge (RWS Kap. 4, Kap. 1) | RWS Kap. 9 p. 16 (L.O.A.); RWS Kap. 4 p. 27; RWS Kap. 1 p. 18 | disputed |
| Case length | Hülsenlänge | RWS Kap. 4 p. 9 and p. 10; DSB 0.5.1 p. 32; BDS-L L 14.01 p. 14 | verified |
| Barrel length | Lauflänge | BDS-K K 2.02 p. 9; BDMP Teile C.1.5 p. 107; DSB 0.5.1 p. 32; RWS Kap. 9 p. 20 | verified |
| Trim, trim length | kürzen (RWS), trimmen and Trimmer (RWS, colloquial); trimmer: Hülsenkürzer | RWS Kap. 4 p. 10; RWS Kap. 9 p. 7 | disputed |
| Neck wall | Hülsenhalsstärke | RWS Kap. 8 p. 14; RWS Kap. 9 p. 2 | verified |
| Seating depth | Setztiefe (RCBS, RWS Kap. 9), Einsetztiefe (RWS Kap. 3, Kap. 4) | RCBS Seite 5; RWS Kap. 9 p. 13; RWS Kap. 4 pp. 19 and 27 | disputed |
| Seating (verb), seating die | Geschoss setzen, Setzmatrize | RWS Kap. 4 p. 1 and Kap. 9 p. 16; RCBS Seite 4 | verified |
| Jump (to the lands) | Freiflug: the distance the bullet travels from the case to the rifling. RWS notes the word is often confused with the non-rotating path | RWS Kap. 9 p. 5; RWS Kap. 4 p. 27 | verified |
| Throat, leade | Übergangskegel (rifle barrels, defined at Kap. 9), Übergangskonus (defined there for shotgun barrels, used for a rifle at Kap. 4) | RWS Kap. 9 p. 14; RWS Kap. 4 p. 25 | disputed |
| Freebore | none found that separates it from Freiflug | searched all documents | unverified |
| Case fill, load ratio | Ladedichte | RWS Kap. 9 p. 8; RWS Kap. 8 p. 6 | verified |
| Charge | Ladung (RWS), Pulverladung (RWS), Treibladung (WaffG: Ladungen; DSB) | RWS Kap. 1 p. 17; RWS Kap. 2 p. 3; WaffG Anlage 1 Abschn. 1 Unterabschn. 3 Nr. 2; DSB 0.11.3.1 p. 58 (Trockenschuss definition) | disputed |
| Load (the recipe) | Laborierung; Bestlaborierung for the best load | RWS Kap. 4 p. 3; RWS Kap. 9 p. 8 | verified |
| Starting load, maximum load | Anfangsladung, Maximalladung | RWS Kap. 1 p. 17 | verified |
| Reduced load | reduzierte Ladung | RWS Kap. 8 p. 1 (contents), p. 4 | verified |
| Crimp | Bördelung, Hülsenmundbördelung; "crimpen" is called neudeutsch | RWS Kap. 9 p. 16 and p. 2; RCBS Seite 4 | verified |
| Full-length sizing | Vollkalibrieren, Vollkalibriermatrize; RCBS: Rekalibrieren | RWS Kap. 9 p. 16; RCBS Seite 4 | disputed |
| Neck sizing | Hülsenhalskalibrierung; tool: Halskalibrierer | RCBS Seite 4; RWS Kap. 9 p. 16 | verified |
| Deprime | Zündhütchen ausstoßen; RCBS: entzündern | RWS Kap. 4 p. 1; RCBS Seite 4 | disputed |
| Expand (case mouth) | Aufweiten | RWS Kap. 6 p. 1; RCBS Seite 4 | verified |
| Reload (verb), reloader | Wiederladen, Wiederlader | RWS Kap. 1 p. 1; RCBS Seite 1 | verified |
| Times fired (case) | Anzahl der Abschüsse as a candidate | searched all documents | unverified |
| Ballistic coefficient (BC) | Ballistischer Koeffizient (BC); RWS web product page labels it "BC Wert" | RWS Kap. 9 p. 2 (printed p. 571); RWS-web product page of a rifle cartridge | verified |
| Drag | Luftwiderstand | RWS Kap. 2 p. 3 and p. 6; RWS Kap. 9 p. 2 | verified |
| Drag model (G1, G7), drag coefficient | none found | searched all documents | unverified |
| Sectional density | Querschnittsbelastung | RWS Kap. 9 p. 11 (printed p. 580) | verified |
| Form factor | Formfaktor (shape of the bullet, shown in the ballistic form value) | RWS Kap. 9 p. 5 | verified |
| Trajectory | Flugbahn | RWS Kap. 2 p. 5 and p. 6 | verified |
| Time of flight | Flugzeit | RWS Kap. 2 p. 5 and p. 15 | verified |
| Drop | Flugbahnabfall | RWS Kap. 2 p. 15 | verified |
| Wind drift | Seitenwindabdrift | RWS Kap. 2 p. 6 | verified |
| Wind speed, wind direction | Windgeschwindigkeit, Windrichtung as candidates | searched all documents, no hit | unverified |
| Air pressure | Luftdruck | RWS Kap. 2 p. 16 | verified |
| Air density | Luftdichte | RWS Kap. 2 p. 6 | verified |
| Altitude | Höhenlage | RWS Kap. 2 p. 15 | verified |
| Humidity | Luftfeuchte | RWS Kap. 8 p. 56 | verified |
| Line of sight | Visierlinie | RWS Kap. 2 p. 6; RWS Kap. 8 p. 46 | verified |
| Sight height | Visierhöhe as a candidate | searched all documents, no hit | unverified |
| Zero, zeroing | Einschießen | RWS Kap. 8 p. 26 | verified |
| Zero range | Einschießentfernung | RWS Kap. 2 p. 6 and p. 7 | verified |
| Stability | Stabilität, Stabilisierung (of the bullet) | RWS Kap. 2 p. 6; RWS Kap. 9 p. 3 | verified |
| Stability factor, spin drift, Coriolis | none found | searched all documents | unverified |
| Recoil | Rückstoß | RWS Kap. 4 p. 28; RWS Kap. 8 p. 11 | verified |
| Interior ballistics | Innenballistik | RWS Kap. 2 p. 1 | verified |
| Exterior ballistics | Außenballistik | RWS Kap. 2 p. 1 | verified |
| Terminal ballistics | Zielballistik | RWS Kap. 2 p. 1 | verified |
| Transitional ballistics | Übergangsballistik | RWS Kap. 2 p. 1 | verified |
| Dispersion | Streuung | RWS Kap. 8 p. 28 | verified |
| Standard deviation | Standardabweichung | RWS Kap. 8 p. 32 | verified |
| Group size | Streukreis; smallest circle decides ties | BDMP Teile B.12 p. 102; VdRBw p. 24; RWS Kap. 9 p. 2 | verified |
| Shot group | Schussgruppe (DSU), Schussbild (DSB), Trefferbild (RWS) | DSU p. 5; DSB p. 154; RWS Kap. 8 p. 28 | disputed |
| Point of aim | Haltepunkt | BDS-L L 14.08.3 p. 82; RWS Kap. 2 p. 7 | verified |
| Point of impact | Treffpunkt, Treffpunktlage (RWS), Trefferlage (BDMP, VdRBw, DSB) | RWS Kap. 2 pp. 5 and 7; BDMP Register 9 D.1.2.1 p. 7; VdRBw p. 59; DSB p. 287 | disputed |
| Extreme spread, mean radius | none found | searched all documents | unverified |
| Hit probability | Trefferwahrscheinlichkeit as a candidate | searched all documents, no hit | unverified |
| Chronograph | Chronograph (BDMP, RWS), Geschwindigkeitsmesser, Geschossgeschwindigkeitsmessgerät (RWS definition) | BDMP Teile C.14.5 p. 195; RWS Kap. 9 pp. 3 and 5; RWS Kap. 8 p. 31 (Wiederladerchronograph) | disputed |
| Shot string (chronograph) | Schussreihe as a candidate | searched all documents | unverified |
| Cold bore | Kaltschuss as a candidate | searched all documents, no hit | unverified |
| Burnout, vivacity, covolume, specific energy (impetus) | none found | searched the RWS chapters | unverified |
| Barrel time | Rohrlaufzeit as a candidate | searched all documents, no hit | unverified |
| Safety notice | Sicherheitsregeln; precautions: Vorsichtsmaßnahmen | RWS Kap. 1 p. 15; RWS Kap. 8 p. 5; RCBS Seite 1 | disputed |

## Procedures

| English term (as in the app) | German term | Source (edition, section or page) | Status |
| --- | --- | --- | --- |
| Ladder (charge, seating, temperature) | Ladeleiter, Ladungsleiter, Ladungsreihe as candidates | searched the RWS chapters, RCBS and the rule books, no hit | unverified |
| Truing | none found | searched all documents | unverified |
| Range card | Schusstafel as a candidate | searched all documents, no hit | unverified |
| Case preparation | Vorbereitung der Hülse | RWS Kap. 4 p. 1 (contents) | verified |
| Powder charging | Pulver einfüllen | RWS Kap. 4 p. 1 (contents) | verified |
| Powder measure | Pulvermessgerät, Pulverdosierer | RCBS Seite 2; RWS Kap. 4 p. 3 | disputed |
| Test shooting, sighting shot | Probeschuss | DSB 0.8.1.1 p. 45; BDMP Teile A.4.11.2.2 p. 21 | verified |

## Target shooting

| English term (as in the app) | German term | Source (edition, section or page) | Status |
| --- | --- | --- | --- |
| Target | Scheibe (DSB, BDMP, VdRBw), Zielscheibe (BDS-Z title, DSB electronic target) | DSB 0.4.1.2 p. 28; BDS-Z p. 1 (title); DSB 0.19.2.3 p. 79 | disputed |
| Target face | Scheibe, with the printed name such as "BDS-100m-Scheibe" | BDS-Z Z1 p. 2; DSB p. 94 table | verified |
| Ring | Ring (plural Ringe) | DSB 0.11.3.3 p. 58; BDS-Z Z1 p. 2 | verified |
| Inner ten | Innenzehner (DSB, BDMP), Innenzehn (BDS-A, BDS-L, BDMP), Innen-10 (BDS-Z, DSU), Mouche (BDMP) | DSB 0.11.3.2 p. 58; BDS-Z Z1 p. 2; BDS-A A 9.03 p. 22; DSU p. 28; BDMP Teile B.11.7 p. 58 | disputed |
| Ten | Zehner, 10 | DSB 0.12.1 p. 61; BDS-Z Z1 p. 2 | verified |
| Black (aiming area) | Spiegel, Scheibenspiegel | BDS-Z Z1 p. 2 (rings 5 to 10); DSB 0.3 p. 24; BDMP Teile A.4.8.2 p. 19 | verified |
| Score, ring value | Ringzahl and Ergebnis (total), Ringwert and Schusswert (single shot), Wertung | DSB 0.9.4.1 p. 52; DSB 0.4.3.2 p. 30 (Ringwert); DSB 0.4.3.1 p. 28 (Schusswert); BDS-A A9 p. 1 | disputed |
| Decimal scoring | Zehntelwertung | DSB 9.4 p. 412 | verified |
| Series | Serien (plural); the rule books also use the singular | DSB 0.11.5.2 p. 61 (Ablegen der Serien); DSB 0.4.3.2 p. 30 (10er-Serien); BDS-A A 9.05 p. 22; VdRBw p. 16 | verified |
| Discipline | Disziplin; DSB table also uses Wettbewerb for the single event | DSB Teil 0 p. 19; BDS-A A 1.04 p. 2; BDMP Teile A.0 p. 3 (Präambel); DSB table p. 94 (Wettbewerb) | disputed |
| Discipline category | Waffenart | DSB table header p. 94 | verified |
| Event (face event) | Wettbewerb | DSB table p. 94; DSB 0.4.1.2 p. 28 | verified |
| Shot | Schuss | DSB 0.8.4 p. 46; BDS-A A 9.05 p. 22 | verified |
| Shot count | Schusszahl | DSB 0.4.1.2 p. 28 | verified |
| Hit | Treffer | BDS-A A 9.03 p. 22 | verified |
| Miss | Fehlschuss | DSB 0.11.4.2 p. 60 | verified |
| Scoring shot | Wertungsschuss | DSB 0.8.4 p. 46 | verified |
| Distance | Entfernung, Schießentfernung (DSB), Schussentfernung and Scheibenentfernung (BDMP) | DSB 0.3 p. 24; BDMP Teile C.15.8 p. 210; BDMP Teile C.13A.6 p. 183 (Scheibenentfernung) | disputed |
| Caliber class | Kaliberklasse | BDMP Teile C.13A.1 and C.13A.2 p. 182; DSU p. 10 | verified |
| Federation | Verband; the law's term: Schießsportverband | VdRBw p. 4; WaffG § 15 (heading) | verified |
| Rule book | Sportordnung (DSB, BDMP, VdRBw: Schießsportordnung), Sporthandbuch (BDS, DSU) | titles of the documents of this note | disputed |
| Hole gauge | Schusslochprüfer (outer gauge: Außenlehre; inner gauge: Innenlehre) | DSB 0.11.3.2 p. 58; BDMP Teile A.3.21.2 p. 15 | verified |
| Gauge diameter (hole as scored) | Messring "A" of the Schusslochprüfer | DSB 0.11.3.2 p. 58 | verified |
| Bullet hole | Schussloch | DSB 0.11.3.3 p. 58; BDMP Teile A.3.21.2 p. 15 (Schusslochprüfer) | verified |
| Tie (equal rings) | Ringgleichheit (BDS), Ergebnisgleichheit (DSB, VdRBw) | BDS-A A 9.03 p. 22; DSB 0.12.1 p. 61; VdRBw p. 24 | disputed |
| Target format | Scheibenformat | BDS-Z Z1 p. 2 | verified |
| Firing line | Feuerlinie | DSB 0.3 p. 24 | verified |
| Shooting range | Schießstand | DSB 0.3 p. 24 | verified |
| Position | Anschlag (Liegendanschlag, Stehendanschlag) | DSB 0.3 p. 24 | verified |
| Electronic target | elektronische Scheibe | DSB 0.4.3.2 p. 30 | verified |
| Stage, course of fire | not researched | none | unverified |
| Paper size, bull, printed numerals | not researched | none | unverified |

## Disagreements

- Primer: Zündhütchen is the word of the reloading guides, the RWS book and the rule books. RWS writes Anzündhütchen on its web pages. RCBS writes Zünder.
- Pressure: three words for one measured quantity (Gasdruck, Kammerdruck, Maximaldruck). The C.I.P. sheet itself says only Drücke and Pmax. Gasdruck is the word of the RWS definitions (Kap. 9 p. 5) and of the BDMP rule on the approved pressure of a weapon (Teile C.6C.1 p. 132).
- Seating depth: Setztiefe is used by RCBS and RWS Kap. 9, Einsetztiefe by RWS Kap. 3 and Kap. 4.
- Inner ten: Innenzehner (DSB, BDMP), Innenzehn (BDS-A, BDS-L, BDMP), Innen-10 (BDS-Z, DSU), Mouche (BDMP scoring sheet text).
- Target: BDS names its document Zielscheiben, the other rule books say Scheibe.
- Rule book: DSB, BDMP and VdRBw call theirs Sportordnung (VdRBw: Schießsportordnung), BDS and DSU call theirs Sporthandbuch.
- Red dot: Leuchtpunktvisier (BDMP, BDS), Rotpunktvisier (BDS-L), Reflexvisier (VdRBw), Leuchtpunktvisierung (DSU).
- Bullet mass: Geschossgewicht in the rule books, Geschossmasse as an RWS headword.

## Not reached

- Labels of the app with no row: Solid density, Step size, Percent of maximum, Burnt at the muzzle, Ratio of specific heats, Start pressure, Pressure exponent, Pressure range, Efficiency, Free recoil, Muzzle spin, Turret travel, Drag factor. No document was searched for them beyond the full-text searches listed below, which gave no German word.
- Searched without a primary hit (rows marked unverified): ladder test, truing, extreme spread, mean radius, hit probability, Coriolis, spin drift, drag model (G1, G7), barrel time, burnout, vivacity, covolume, impetus, water capacity, freebore, meplat, polymer tip, wind speed, sight height, twist hand, times fired, cold bore, range card, shot string. The German words in those rows are candidates, not sources.
- Not searched: German textbooks and standards on interior and exterior ballistics, the C.I.P. rules of procedure in German (Beschussverfahren), the Beschussgesetz and its ordinance, and the DEVA publications. Web searches for German reloading documents of other bullet and powder makers (Lapua, Nosler, Lyman and others) returned no manufacturer document; the Lapua site read is English.
- Only one die manual (RCBS) was read; the German die manuals of other makers were not.
- Interface chrome terms (Search, Settings, Copy link, Zoom, Theme) are not covered.
- One C.I.P. sheet was read in full (44 Rem. Mag., TAB. IV); table types for rim fire and shotshell were not read.
- The RWS book and the RCBS manual are manufacturer documents, not standards. They give the working vocabulary of German reloaders. The RWS book carries a translation list of English reloading terms (Kap. 9 p. 16).
