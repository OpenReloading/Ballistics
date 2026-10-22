/** The Safety section of README.md as plain text; test/safety.test.ts keeps the two equal. */
export const safety = {
  intro:
    'Reloading ammunition is dangerous. This software helps you plan, simulate and document. It does not replace published load data, the instructions of your component and equipment makers, or safe practice.',
  items: [
    'Results are simulations, not load data. Never use a result as a charge weight or as proof that a load is safe. Start from load data published by the powder or bullet maker for your exact components.',
    'Simulated pressures carry model and input uncertainty. The shown ranges do not include model error. The absence of a warning does not mean a load is safe.',
    'Component lots, cases, chambers and barrels differ. Measured pressure and velocity can differ from any simulation.',
    'Measurements, statistics, group sizes, scores and records shown here can contain errors from the models, the data or your inputs.',
  ],
  outro:
    'Reloading and shooting are done at your own risk. This software comes without warranty of any kind, and its authors are not liable for any damage or injury arising from its use.',
}
