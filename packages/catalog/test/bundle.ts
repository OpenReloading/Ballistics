import type { Cartridge, Provenance } from '@rangefoundry/schema'
import type { Bundle } from '../src/records.ts'

const published: Provenance = { kind: 'published', sources: [{ title: 'Test standard' }] }

const sheet = (c: Pick<Cartridge, 'id' | 'name' | 'table' | 'values' | 'aliases'>): Cartridge => ({
  ...c,
  published: '2020-01-01',
  verification: 'unverified',
  provenance: published,
})

/** Synthetic records; the numbers are made up. */
export const bundle: Bundle = {
  cartridges: [
    sheet({
      id: 'alpha-rifle',
      name: 'Alpha Rifle',
      aliases: ['Alpha 7,62'],
      table: 'I',
      values: [
        {
          side: 'cartridge',
          symbol: 'L1',
          quantity: 'length',
          value: 40,
          tolerance: { lower: -0.2 },
        },
        { side: 'chamber', symbol: 'i', quantity: 'angle', value: 1.5, raw: `1°30'0"` },
        { symbol: 'Pmax', quantity: 'pressure', value: 4000 },
      ],
    }),
    sheet({
      id: 'beta-pistol',
      name: 'Beta Pistol',
      table: 'IV',
      values: [
        { side: 'cartridge', symbol: 'L3', quantity: 'length', value: 20 },
        { side: 'cartridge', symbol: 'L6', quantity: 'length', value: 30.1, variant: 'b' },
        { side: 'cartridge', symbol: 'L6', quantity: 'length', value: 29.7, variant: 'a' },
        { side: 'cartridge', symbol: 'G1', quantity: 'length', value: 9.03, variant: 'b' },
        { side: 'cartridge', symbol: 'G1', quantity: 'length', value: 9.02, variant: 'a' },
        { side: 'chamber', symbol: 'G1', quantity: 'length', value: 8.9 },
        { side: 'chamber', symbol: 'F', quantity: 'length', value: 7.82 },
        { side: 'chamber', symbol: 'Q', quantity: 'area', value: 47.51 },
      ],
    }),
    sheet({
      id: 'gamma-100-percent',
      name: 'Gamma 100% Mag.',
      table: 'I',
      values: [{ symbol: 'M', quantity: 'length', raw: '25/30' }],
    }),
  ],
  manufacturers: [
    { id: 'example-a', name: 'Example A', aliases: ['Old A'], provenance: published },
    ...['b', 'c', 'f'].map((x) => ({
      id: `example-${x}`,
      name: `Example ${x.toUpperCase()}`,
      provenance: published,
    })),
  ],
  powders: [
    {
      id: 'example-a-fast',
      manufacturer: 'example-a',
      name: 'Fast',
      bulkDensity: { value: 0.9, raw: 'VMD 0.072 cm³/gr' },
      provenance: { kind: 'derived', sources: [{ title: 'Test chart', fields: ['bulkDensity'] }] },
    },
    { id: 'example-b-slow', manufacturer: 'example-b', name: 'Slow', provenance: published },
  ],
  primers: [
    {
      id: 'example-a-large-rifle',
      manufacturer: 'example-a',
      name: 'Large Rifle',
      productNumber: 'LR-1',
      size: 'large-rifle',
      magnum: false,
      compound: 'lead-styphnate',
      provenance: published,
    },
    {
      id: 'example-a-small-pistol',
      manufacturer: 'example-a',
      name: 'Small Pistol',
      size: 'small-pistol',
      compound: 'lead-free',
      provenance: published,
    },
    {
      id: 'example-b-large-rifle-magnum',
      manufacturer: 'example-b',
      name: 'Large Rifle Magnum',
      size: 'large-rifle',
      magnum: true,
      provenance: published,
    },
  ],
  bullets: [
    {
      id: 'example-a-1',
      manufacturer: 'example-a',
      productNumber: '1',
      name: 'Test 168',
      diameter: { value: 7.82 },
      mass: { value: 10.89 },
      ballisticCoefficients: [{ dragModel: 'G1', value: 0.46 }],
      provenance: published,
    },
  ],
  cases: [
    {
      id: 'alpha-brass',
      origin: 'catalogue',
      name: 'Alpha Brass',
      manufacturer: 'catalogue:example-a',
      cartridge: 'catalogue:alpha-rifle',
      productNumber: 'AB-1',
      material: 'brass',
      mass: { value: 11.4 },
      waterCapacity: { value: 3.55 },
      provenance: published,
    },
    {
      id: 'alpha-steel',
      origin: 'catalogue',
      name: 'Alpha Steel',
      manufacturer: 'catalogue:example-b',
      cartridge: 'catalogue:alpha-rifle',
      productNumber: 'AS-2',
      material: 'lacquered-steel',
      provenance: published,
    },
    {
      id: 'beta-brass',
      origin: 'catalogue',
      name: 'Beta Brass',
      manufacturer: 'catalogue:example-a',
      cartridge: 'catalogue:beta-pistol',
      productNumber: 'BB-1',
      material: 'brass',
      provenance: published,
    },
  ],
  capacities: [
    {
      id: 'alpha-rifle-test',
      origin: 'catalogue',
      cartridge: 'catalogue:alpha-rifle',
      waterCapacity: { value: 3.6, raw: '55.6 gr H2O' },
      primerState: 'primed-spent',
      fillLevel: 'mouth',
      provenance: published,
    },
  ],
  loads: [],
  chronoSessions: [],
  firings: [],
  rangeFirings: [],
  targetFaces: [
    {
      id: 'test-face',
      name: 'Test Face',
      federation: 'test-federation',
      rings: [
        { value: 9, diameter: { value: 20 } },
        { value: 10, diameter: { value: 10 } },
      ],
      innerTen: { diameter: { value: 5 }, rule: 'touch' },
      blackDiameter: { value: 20 },
      decimal: true,
      events: [
        {
          id: 'test-event',
          name: 'Test event',
          distance: { value: 10000 },
          gauge: { value: 4.5 },
          category: 'air-rifle',
        },
      ],
      provenance: published,
    },
  ],
  federations: [
    {
      id: 'test-federation',
      name: 'Test Federation',
      abbreviation: 'Test',
      country: 'international',
      website: 'https://example.org/',
      ruleBooks: [
        {
          title: 'Test rule book',
          edition: '2026',
          url: 'https://example.org/rules.pdf',
          sha256: '0'.repeat(64),
        },
      ],
      provenance: published,
    },
  ],
  disciplines: [
    {
      id: 'test-discipline',
      federation: 'test-federation',
      name: 'Test discipline',
      number: '1',
      section: '1.1',
      page: 'p. 1',
      distance: { value: 10000, unit: 'm' },
      category: 'air-pistol',
      caliberClasses: { ids: ['air-4-5'], basis: 'stated' },
      provenance: published,
    },
  ],
  caliberClasses: [
    {
      id: 'air-4-5',
      name: '4.5 mm (.177) air',
      diameter: { value: 4.5 },
      cartridges: [],
      provenance: published,
    },
  ],
  eventTypes: [
    {
      id: 'test-championship',
      name: 'Test championship',
      federation: 'test-federation',
      ruleBook: {
        title: 'Test rule book',
        edition: '2026',
        publisher: 'Test Federation',
        url: 'https://example.org/rules.pdf',
        sha256: 'a'.repeat(64),
      },
      scoring: { method: 'rings' },
      levels: ['Club', 'National'],
      provenance: published,
    },
  ],
  targetMappings: [
    {
      id: 'test-discipline-test-face',
      discipline: 'test-discipline',
      face: 'test-face',
      event: 'test-event',
      gauge: { value: 4.5 },
      shotCount: 60,
      provenance: published,
    },
  ],
}
