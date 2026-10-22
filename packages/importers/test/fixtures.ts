// Synthetic exports: invented values and device IDs, layouts of the device exports.

const bom = '\uFEFF'
const nnbsp = '\u202F'

/** English ShotView export in fps; shot 1 flagged cold bore. */
export const shotViewEnglish = [
  `${bom}"Test load A 42.0gr"`,
  '#,SPEED (FPS),\u0394 AVG (FPS),KE (FT-LB),POWER FACTOR (KGR\u22C5FT/S),TIME,CLEAN BORE,COLD BORE,SHOT NOTES',
  `1, 2800.0, -2.0, , , 2:10:05${nnbsp}PM, , X, "" `,
  `2, 2810.5, 8.5, , , 2:10:31${nnbsp}PM, , , "" `,
  `3, 2795.5, -6.5, , , 2:10:58${nnbsp}PM, , , "" `,
  '-,,,,,,',
  'AVERAGE SPEED,2802.0,,,,,,,',
  'STD DEV,6.3,,,,,,,',
  'SPREAD,15.0,,,,,,,',
  'SESSION NOTE,"",,,,,,,',
  '-,,,,,,',
  `DATE, "March 3, 2026 at 2:09${nnbsp}PM",,,,,`,
  `All shots included in the calculations,,,,,,,${bom}`,
].join('\n')

/** German ShotView export in m/s with decimal commas; BOM before the header row; shot 1 flagged clean bore. */
export const shotViewGerman = [
  'Testladung B, 2,5g P100',
  `${bom}#,Tempo (MPS),\u0394 DURCHSCHNITT (MPS),KE (J),Leistungsfaktor (N\u22C5s),Zeit,\u00D6lschuss,Erstschuss,Schussnotizen`,
  `1,"850,5","1,5","1000,0","3,0",10:00:01${nnbsp},X,,`,
  `2,"848,0","-1,0","990,0","3,0",10:00:20${nnbsp},,,`,
  `3,"848,5","-0,5","992,0","3,0",10:00:41${nnbsp},,,`,
  '-,,,,,,',
  'AVERAGE SPEED,"849,0",,,,,',
  'STANDARDABWEICHUNG,"1,1",,,,,',
  'STREUUNG,"2,5",,,,,',
  'Trainingsnotiz,,,,,,',
  '-,,,,,,',
  'Datum,"M\u00C4RZ 04, 2026 10:00",,,,,',
  'Alle Sch\u00FCsse sind in den Berechnungen enthalten,,,,,,',
].join('\n')

/** OpenReloading CSV template, comma-separated. */
export const template = [
  'string,velocity,velocityUnit,coldBore,excluded',
  '42.0 gr,2795,fps,yes,',
  '42.0 gr,2810,fps,,',
  '42.0 gr,2803,fps,,flyer',
  '42.5 gr,2831,fps,,',
].join('\n')

/**
 * English ShotView XLSX worksheet in fps, as a read workbook gives it: session name in row 1,
 * title-case header, cells only in the columns that hold values, no `-` rows.
 */
export const shotViewSheetEnglish = {
  name: 'Test load A 08_Mar@14-09',
  rows: [
    ['Test load A 42.0gr'],
    [
      '#',
      'Speed (FPS)',
      '\u0394 AVG (FPS)',
      'KE (FT-LB)',
      'Power Factor (kgr\u22C5ft/s)',
      'Time',
      'Clean Bore',
      'Cold Bore',
      'Shot Notes',
    ],
    ['1', '2800.0', '-2.0', '', '', `2:10:05${nnbsp}PM`],
    ['2', '2810.5', '8.5', '', '', `2:10:31${nnbsp}PM`],
    ['3', '2795.5', '-6.5', '', '', `2:10:58${nnbsp}PM`],
    ['AVERAGE SPEED', '2802.0'],
    ['STD DEV', '6.3'],
    ['SPREAD', '15.0'],
    ['SESSION NOTE', ''],
    ['DATE', `March 8, 2026 at 2:09${nnbsp}PM`],
    ['All shots included in the calculations'],
  ],
}

/** German ShotView XLSX worksheet in m/s with decimal points, nothing above the header; shot 1 flagged cold bore. */
export const shotViewSheetGerman = {
  name: 'Load B',
  rows: [
    [
      '#',
      'Tempo (mps)',
      '\u0394 DURCHSCHNITT (mps)',
      'KE (J)',
      'Leistungsfaktor (N\u22C5s)',
      'Zeit',
      '\u00D6lschuss',
      'Erstschuss',
      'Schussnotizen',
    ],
    ['1', '850.5', '-0.5', '1000.0', '3.0', '10:00:01', '', 'X'],
    ['2', '851.5', '0.5', '1002.0', '3.0', '10:00:20'],
    ['AVERAGE SPEED', '851.0'],
    ['STANDARDABWEICHUNG', '0.5'],
    ['STREUUNG', '1.0'],
    ['TRAININGSNOTIZ', '0.0'],
    ['DATUM', '8. M\u00E4rz 2026 um 09:00'],
    ['Alle Sch\u00FCsse sind in den Berechnungen enthalten'],
  ],
}
