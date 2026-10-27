# Terms and file formats of three load file types

Research note for the load file import issues: program A (issue 242), program B (issue 243) and program C (issue 245), and the ticket that asked for it (issue 282). Programs are named only by letter. Researched on 2026-10-27.

Every legal reading in this note is unverified and not legal advice. Facts about the programs come from the public sources named in each section. No program was downloaded or run, and no database or protected file was opened.

## Summary

| | Program A | Program B | Program C |
| --- | --- | --- | --- |
| Load file | Text (XML) | No public description found | Text (XML) |
| Documented by its maker | Component files yes, load file only mentioned | No | Contents described in its user manual, structure only in its GPL source |
| Encrypted | Load file no sign of it; bundled database reported encrypted by program C's README | Unknown; maker's data updates ship as encrypted archives | No, plain text, stated in its manual |
| Terms mention analysing saved files | No | Not known: its own terms were not obtained | No (GPL-3.0) |
| Terms restrict analysing the program | Yes, taking the program apart (code analysis), with a legal-exception carve-out | Same author's sister program has the same kind of clause, program B's own text not seen | Not applicable, free software |

## Program A

Sources: program A's user manual, English edition dated 2021-09-29 (licence on pp. 5 to 7, file formats from p. 126, archive layout in the installation chapter), and program A's own site (home page notice and FAQ list).

Terms, as printed in the manual (English translation, the manual says a German original governs, German law applies):
- The licence is free of charge. Copyright stays with the maker. Copies may be passed on only as the unchanged original archive.
- Forbidden: offering the product as a paid service, use beyond the licence, renting or transferring it, changing it or inserting it into another program, and analysing the program's code by translating it back, taking it apart or recovering its source (the manual's clause 3c). That clause has exceptions: where applicable law waives the restriction, where the maker permits it in writing, or where the program's "Files" expressly permit it.
- Nothing in the text mentions load files, saved files, output files, reading files in another program or interoperability. The clauses are about the program, not about files a user saved.
- Status: program A's site states that the download was removed on 2026-07-27 because development and bug fixing stopped. The licence text in the manual is an older edition than the last release, so the text of the final release is unverified.

File format:
- The manual documents four file types as XML: caliber, bullet, powder and simulation results. Each has a root element named after the program, text values plain or URL encoded, and a dot as decimal separator. The manual says these files are "normal XML files".
- The load file is mentioned (notes, images and other files added in the result tab are stored in it) but its structure is not described in the manual.
- The archive ships a folder of sample load files. The licence allows passing on only the unchanged archive, so these samples are not ours to publish as test fixtures.
- Program C's user manual and README state that program C reads and writes program A's load files, that the file holds the caliber, bullet and powder values, and that it has an appendix with measurements, notes and pictures. Program C's source header, read only to describe the format, shows a root element named after program A that wraps a load section of name, value and unit entries. That is consistent with plain XML text.
- Program C's README says program A's bundled database is encrypted. Load files are not described as encrypted anywhere. The database is out of scope for issue 242.

## Program B

Sources: program B's seller's shop page (version and delivery), the North American distributor's FAQ, the user guide of the same author's sister program (a 2009 copy hosted by a retailer, not by the author), Wikipedia for authorship and distribution. Program B's own licence text and its user guide were not found on any official public page: the seller says the manual is on the installation disc, the distributor sells only physical media, and the copies of the guide on document hosting sites were not readable here.

Terms:
- Program B's own licence text was not obtained. Everything below is the sister program's licence, by the same author and distributor, and may differ.
- The sister program's licence is an agreement with a regional distributor (USA, Canada, Mexico). A buyer elsewhere gets another distributor's version. It grants use of one copy on a computer in the country of purchase, and it says a printed licence in the package takes precedence over the guide.
- It forbids the same kind of code analysis as program A's clause, "unless otherwise provided in the Warranty and Special Provisions for your country". Those provisions were not read.
- It says nothing about saved files, data files or interoperability.
- The distributor's FAQ says the program is sold only as physical media and may be installed on the buyer's own registered devices. Data updates come as downloads or discs, and the downloaded archives need an extraction tool before installation (they are encrypted archives). That concerns the update packages for the databases, not load files.

File format:
- No public description of the load file was found: not whether it is text or binary, its extension, whether it embeds component values or names entries of the program's databases, or whether it is encrypted.
- The sister program's guide says the two programs exchange data through a small data file and a plain-text initialization file. That is not the load file.
- Forum posts (secondary, unverified) describe some of program B's component data files as editable plain text and say a saved load is a normal file opened through the toolbar. None gives an extension or structure.
- Issue 243 already says the work stops if the file is encrypted or protected. That matches Directive 2009/24/EC Article 7(1)(c) (see the law section): means made to circumvent a protection device are treated separately from the freedom to study.

## Program C

Sources: program C's public repository (README, user manual chapter on files, the licence, the header comments of its load file module), read only to describe the format in our own words. Nothing was copied.

Terms:
- Program C is licensed GPL-3.0. The README says the records in its data folder are CC BY-SA 4.0 and that program A's database and sample files are not part of the repository and not covered by program C's licence.
- GPL-3.0 section 2 on gnu.org: the output of running a covered work is covered by the licence only if the output, given its content, constitutes a covered work. A load file holds the user's inputs, so the GPL puts no condition on reading it.
- Caution for issue 245: the manual says a load file is self-contained, with the caliber, bullet and powder records stored in it with their values. A saved file can therefore carry records that come from program C's CC BY-SA data, from program A's database, or from the user. Whose licence applies to an embedded record is unverified and depends on the record. This is a reason to keep provenance per record and to import component records only as user records.

File format (own words, from the manual and the load module header):
- Plain XML text, stated in the manual ("plain XML text", suited to version control). The extension selects the format when saving.
- A root element named after the program with a format number (1), a load element, and sections for configuration, caliber, a fuller caliber record, firearm, bullet, powder, shotshell parts and the powder model's burn values, plus an appendix for notes, measurements and pictures that is kept as it is.
- Each section is a list of entries with a name, value, unit, type and description. Text values are percent encoded as UTF-8.
- The manual documents what the file contains, not a schema. The structure above comes from the GPL source.
- Not encrypted. Program C also reads and writes program A's load files.

## What the EU law sources say

Unverified readings, not legal advice. Sources: the judgment in Case C-406/10, SAS Institute v World Programming, Grand Chamber, 2 May 2012, on EUR-Lex (https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62010CJ0406), and Directive 2009/24/EC on the legal protection of computer programs (https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009L0024). The judgment applies Directive 91/250/EEC, which Directive 2009/24/EC codifies with the same Articles 1(2) and 5(3).

- Format of data files: paragraphs 39, 42 and 46 hold that neither the functionality of a program nor its programming language nor the format of data files it uses to exploit its functions is a form of expression of the program, so none is protected as such by copyright in computer programs. Directive Article 1(2) says the same of ideas and principles, including those behind interfaces.
- Not the end of the matter: paragraph 45 says a data file format might still be protected as a work under Directive 2001/29/EC if it is its author's own intellectual creation. A flat list of names and values is a weak candidate, but this was not tested.
- Code access: paragraph 43 says that using code relating to a data format, taken from the program's source or object code, to build similar elements in another program can be partial reproduction. Paragraph 44 found no infringement because the defendant never had the source code, did not translate the object code back, and only observed, studied and tested the behaviour. Consequence for issues 242, 243 and 245: build the mapping from documentation, from sample files and from tests, not from another program's code. Program C's source was read only to describe the format here, and its code must not be reused.
- Studying a lawful copy: Article 5(3) lets a person with a right to use a copy observe, study or test the program's functioning to determine its ideas and principles while doing the acts the licence allows. Paragraphs 50 to 59 hold that the rightholder cannot prevent this by licence. Article 8 of the Directive makes contract terms contrary to Article 5(2) and (3) and to Article 6 null and void.
- Code translation and interoperability: Article 6 (headed with the term for translating object code back) allows reproducing code and translating its form only where indispensable to obtain information for interoperability of an independently created program, with limits on the use of that information. Recital 10 defines interoperability as the ability to exchange information and use it. Nothing in this note needs it.
- Circumvention: Article 7(1)(c) covers means whose sole intended purpose is to remove or circumvent a technical device protecting a program. This supports stopping where a file is encrypted.
- National law: program A's licence is under German law. German UrhG section 69a(2) repeats the idea and principle rule and section 69g(2) voids contract terms that conflict with sections 69d(2), (3), (5), (7) and 69e (https://www.gesetze-im-internet.de/urhg/__69g.html). The content of sections 69d and 69e was not read. Program B's governing law was not confirmed.
- Databases: if load files embed records taken from another program's database, Directive 96/9/EC Article 8 protects a lawful user's extraction of insubstantial parts, and Article 7 gives the maker a right against substantial extraction. Whether mass import of embedded records is substantial was not assessed.

## Fit with the owner's position

The position is that the project supports a file format that users bring and imports nothing itself. Reading that against the sources, all unverified:
- The user opens their own file in their own browser. The project ships no file, no sample, no database and no code of another program.
- Neither the program A licence nor the sister program's licence mentions saved files. Their restrictions concern the program. The SAS judgment treats the file format as free to use, which supports the position, with the originality caveat of paragraph 45.
- The open points are the ones a lawyer would settle: program B's own terms, whether embedded component records carry a third-party licence, and fixtures (use synthetic files only, as the issues already say).

## Not verified

- Program B: its own licence, its user guide, load file structure, extension and encryption.
- Program A: the licence of the final release, the German original, and the load file schema (only seen second-hand through program C).
- Program C: schema beyond the section list, and the licence status of records embedded in a saved file.
- The legal readings above, in particular paragraph 45 (originality of a format) and the national law of Germany and any other Member State.
