import { msg } from '../i18n/translate.ts'

/** test/safety.test.ts keeps README.md equal to it and the i18n lint requires German for every line; English is binding. */
export const safety = {
  intro: msg(
    'Reloading ammunition is dangerous: excess pressure can destroy a firearm and injure or kill. This software helps you plan, simulate and document. It does not replace published load data, the instructions of your component and equipment makers, or safe practice.',
  ),
  items: [
    msg(
      'Results are simulations, not load data. Never use a result as a charge weight or as proof that a load is safe.',
    ),
    msg(
      'Measured pressure and velocity can differ greatly from any simulation. The shown ranges do not include model error. The absence of a warning does not mean a load is safe.',
    ),
    msg(
      'Small input errors can change the predicted pressure a lot, and stored values may not match your components. Measure what you can: case capacity, bullet dimensions, seating depth, bullet jump, barrel and chamber dimensions, temperature.',
    ),
    msg(
      'Work up in small steps from the start charge published by the powder or bullet maker for your exact components, and check every step yourself. Never exceed the published maximum.',
    ),
    msg('Measurements, statistics, group sizes, scores and records shown here can contain errors.'),
  ],
  outro: msg(
    'Reloading and shooting are at your own risk: you are responsible for your inputs, loads and safety checks.',
  ),
  /** What the dialog shows besides the text: the confirmation above the buttons and the line that English binds. */
  confirm: msg('Select I accept to accept this notice and continue.'),
  binding: msg('The English text is binding.'),
}
