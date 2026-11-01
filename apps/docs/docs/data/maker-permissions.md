---
title: Maker permissions
description: What the project asks a component maker for, the permission letter in English and German, and how a written grant is recorded in a record's provenance.
---

# Maker permissions

A value a maker publishes about its own product (a bullet's diameter and mass, a case's water capacity) is a source with `origin: manufacturer`: the maker published or supplied it, and that claims no permission and carries no project licence ([Record model](record-model.md#envelope), [Published loads](published-loads.md#sources-and-licence)). Where the maker's terms do not allow the use, the project asks the maker for a written permission with the letter below. Sending it, choosing the makers and keeping the list of answers are the owner's steps (issue #297); this page holds the letter and the rule for recording an answer.

This page is not legal advice.

## What the project asks for

- The specifications the maker already publishes for a product range: for bullets the diameter, mass, length, ogive form and ballistic coefficient with its drag reference; for powders the name, class and grain form; for cases the mass, water capacity, flash hole and primer pocket; for primers the size, type and cup dimensions where they are published.
- Not photographs, descriptive text, drawings, logos or load data. Company and product names only name the records.
- Each value is shown with the maker named as the source, a link to its page and the date it was read.
- The data set is public under CC BY 4.0, so anyone may copy and reuse the values with attribution, also commercially. A maker can withdraw the permission at any time in writing; the values are then removed from the next release. CC BY 4.0 cannot be revoked for copies already made: the licence is "irrevocable" ([legal code](https://creativecommons.org/licenses/by/4.0/legalcode.en), section 2(a)(1)), and the letter says so.

## The letter

Placeholders: `<maker>`, `<product range or page URL>`, `<name>`, `<contact address>` (in the German letter `<Hersteller>`, `<Produktreihe oder Seiten-URL>`, `<Name>`, `<Kontaktadresse>`). Delete the field lines that do not apply to the maker: a powder maker gets only the powder line.

### English

Subject: Permission to publish product specifications in OpenReloading

Hello,

I maintain OpenReloading (https://github.com/OpenReloading/Ballistics), an open-source reference for handloaders. Its code is under the MIT licence and its data under CC BY 4.0. It describes cartridges, bullets, powders, cases and primers; its results are simulations, not load data.

**What we would use.** Specifications you already publish for `<product range or page URL>`:
- bullets: diameter, mass, length, ogive form, ballistic coefficient with its drag reference;
- powders: name, class, grain form;
- cases: mass, water capacity, flash hole, primer pocket;
- primers: size, type, cup dimensions where you publish them.

We would not use photographs, descriptive text, drawings, logos or load data. Company and product names would only name the records.

**What we publish.** Each value is shown with `<maker>` named as the source, a link to your page and the date we read it. The data set is public under CC BY 4.0: anyone may copy and reuse the values with attribution, also commercially. You can withdraw the permission at any time by writing to us; we then remove the values from the next release. Copies made before that keep the licence they were published with.

**What we ask.** May we publish these values on these terms?

**How to answer.** A short reply to this email is enough, for example:
- "Yes, as described."
- "Yes, but only these fields or products: ..."
- "Yes, with this attribution: ..."
- "No."

Please also tell us who we may name as having granted the permission (a role is enough).

Kind regards,
`<name>`
`<contact address>`

### Deutsch

Betreff: Erlaubnis zur Veröffentlichung von Produktdaten in OpenReloading

Guten Tag,

ich betreue OpenReloading (https://github.com/OpenReloading/Ballistics), ein Open-Source-Nachschlagewerk für Wiederlader. Der Code steht unter der MIT-Lizenz, die Daten unter CC BY 4.0. Es beschreibt Patronen, Geschosse, Pulver, Hülsen und Zündhütchen; seine Ergebnisse sind Simulationen, keine Ladedaten.

**Was wir verwenden würden.** Angaben, die Sie für `<Produktreihe oder Seiten-URL>` bereits veröffentlichen:
- Geschosse: Durchmesser, Masse, Länge, Ogivenform, ballistischer Koeffizient mit seiner Widerstandsfunktion (zum Beispiel G1, G7);
- Pulver: Name, Klasse, Kornform;
- Hülsen: Masse, Hülsenvolumen (Wasser), Zündkanal, Zündglocke;
- Zündhütchen: Größe, Typ, Maße des Näpfchens, soweit Sie diese veröffentlichen.

Fotos, Beschreibungstexte, Zeichnungen, Logos und Ladedaten würden wir nicht verwenden. Firmen- und Produktnamen dienen nur zur Benennung der Datensätze.

**Was wir veröffentlichen.** Jeder Wert wird mit `<Hersteller>` als Quelle, einem Link auf Ihre Seite und dem Datum unseres Abrufs angezeigt. Der Datensatz ist unter CC BY 4.0 öffentlich: Jeder darf die Werte mit Namensnennung kopieren und weiterverwenden, auch kommerziell. Sie können die Erlaubnis jederzeit schriftlich widerrufen; wir entfernen die Werte dann im nächsten Release. Kopien, die vorher entstanden sind, behalten die Lizenz, unter der sie veröffentlicht wurden.

**Was wir fragen.** Dürfen wir diese Werte zu diesen Bedingungen veröffentlichen?

**Wie Sie antworten.** Eine kurze Antwort auf diese E-Mail genügt, zum Beispiel:
- „Ja, wie beschrieben.“
- „Ja, aber nur diese Felder oder Produkte: ...“
- „Ja, mit dieser Namensnennung: ...“
- „Nein.“

Bitte nennen Sie uns auch, wen wir als Erteiler der Erlaubnis angeben dürfen (eine Funktion genügt).

Mit freundlichen Grüßen
`<Name>`
`<Kontaktadresse>`

## Recording a grant

Each record that uses granted values cites the grant as one source in `provenance.sources` (`source` in `packages/schema/src/provenance.ts`):

| Field | Value |
|---|---|
| `origin` | `"manufacturer"` |
| `publisher` | The maker |
| `url` | The maker's product page the values were read from |
| `retrieved` | The day the values were read, ISO 8601 |
| `license` | `"LicenseRef-`<maker>`"`, one token of letters, digits, `.`, `+` and `-` |
| `terms` | A note of the grant: its date, who granted it (a role, not a person's name), the fields and the scope as granted, and any attribution asked for |
| `fields` | Only when the grant covers some fields: their dot paths |

```json
{
  "title": "Example Maker bullet specifications",
  "publisher": "Example Maker",
  "url": "https://example.org/bullets",
  "retrieved": "2026-10-30",
  "origin": "manufacturer",
  "license": "LicenseRef-Example-Maker",
  "terms": "Written permission of 2026-10-30 by the head of product management: diameter, mass and length of the listed bullets, published under CC BY 4.0; withdrawal removes the values from the next release.",
  "fields": ["diameter", "mass", "length"]
}
```

`npm run data:validate` accepts this form: `license` takes `LicenseRef-<name>` for a written permission described in `terms`, and `terms` is a note unless it starts with `http://` or `https://`. A published load table checks more: a maker source there may carry only a `LicenseRef-` id with `terms`, and an SPDX id such as `CC-BY-4.0` fails ([Published loads](published-loads.md#sources-and-licence)). A component record's schema does not check that rule, so a reviewer of a record change looks for it. The written answer itself stays with the owner, out of the repository; the record holds the note.

A withdrawn permission removes the source and the values it covers in the next release, as the letter says. Without a grant, values from a maker whose terms do not allow the use are not added ([Contributing](https://github.com/OpenReloading/Ballistics/blob/main/CONTRIBUTING.md)).
