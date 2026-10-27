import { msg } from '../i18n/translate.ts'

/**
 * The Safety section of README.md as plain text, and the one source of the dialog's English text:
 * test/safety.test.ts keeps README.md equal to it and the German catalogue holding a translation
 * of every line. English is the binding text.
 */
export const safety = {
  intro: msg(
    'Reloading ammunition is dangerous. This software helps you plan, simulate and document. It does not replace published load data, the instructions of your component and equipment makers, or safe practice.',
  ),
  items: [
    msg(
      'Results are simulations, not load data. Never use a result as a charge weight or as proof that a load is safe. Start from load data published by the powder or bullet maker for your exact components.',
    ),
    msg(
      'Simulated pressures carry model and input uncertainty. The shown ranges do not include model error. The absence of a warning does not mean a load is safe.',
    ),
    msg(
      'Component lots, cases, chambers and barrels differ. Measured pressure and velocity can differ from any simulation.',
    ),
    msg(
      'Measurements, statistics, group sizes, scores and records shown here can contain errors from the models, the data or your inputs.',
    ),
  ],
  outro: msg(
    'Reloading and shooting are done at your own risk. This software comes without warranty of any kind, and its authors are not liable for any damage or injury arising from its use.',
  ),
  /** What the dialog shows besides the text: the confirmation above the buttons and the line that English binds. */
  confirm: msg('By selecting I accept you confirm that you have read and understood this notice.'),
  binding: msg('The English text is binding.'),
}
