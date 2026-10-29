# Aggregates, bootstrap and direction check of RULE.md over the per-row dump of dump.mts.
# python3 -I spikes/594/analyse.py <dump dir>  (NumPy; prints aggregates only)
import json
import sys
from collections import Counter, defaultdict

import numpy as np

out = sys.argv[1]
rows = [json.loads(line) for line in open(f'{out}/rows.jsonl')]
choices = json.load(open(f'{out}/choices.json'))
variants = ['base', 'in', 'lopo', 'unseenBase', 'unseen']


def used(r, k):
    return r[k] is not None and 'v' in r[k]


def err(r, k):
    return abs(r[k]['v'] - r['printedV']) / r['printedV']


def perr(r, k):
    return abs(r[k]['p'] - r['printedP']) / r['printedP']


def pct(x, q):
    return float(np.percentile(x, q * 100)) if len(x) else float('nan')


# families reported: at least 5 validation cartridges and more than one table among the used rows, else "other"
cart = defaultdict(set)
tables = defaultdict(set)
for r in rows:
    if not used(r, 'base'):
        continue
    cart[r['family']].add(r['cartridge'])
    tables[r['family']].add(r['table'])
reported = sorted(f for f in cart if len(cart[f]) >= 5 and len(tables[f]) > 1)


def line(sel, k):
    e = [err(r, k) for r in sel if used(r, k)]
    p = [perr(r, k) for r in sel if used(r, k) and r['printedP']]
    return len(e), pct(e, 0.5), pct(e, 0.9), len(p), pct(p, 0.5), pct(p, 0.9)


print('| Candidate | Group | Rows | Median v | P90 v | Pressure rows | Median p | P90 p |')
for k in variants:
    for g in ['all', *reported]:
        sel = rows if g == 'all' else [r for r in rows if r['family'] == g]
        n, m, p9, np_, pm, pp9 = line(sel, k)
        print(f'| {k} | {g} | {n} | {100 * m:.2f} % | {100 * p9:.2f} % | {np_} | {100 * pm:.2f} % | {100 * pp9:.2f} % |')
print('not used, base:', dict(Counter(r['base']['reason'] for r in rows if not used(r, 'base'))))
print('not used, lopo:', dict(Counter(r['lopo']['reason'] for r in rows if not used(r, 'lopo'))))
print('validation rows', len(rows), 'cartridges', len({r['cartridge'] for r in rows}), 'with used rows', len({r['cartridge'] for r in rows if used(r, 'base')}))
print('rows of powders without a leave-one-out fit:', sum(1 for r in rows if not r['lopoFitted']))

# bootstrap over the cartridges with used rows, of the paired change of the median
cartridges = sorted({r['cartridge'] for r in rows if used(r, 'base')})
by_cart = {c: [r for r in rows if r['cartridge'] == c] for c in cartridges}
rng = np.random.default_rng(594)
draws = [rng.integers(0, len(cartridges), len(cartridges)) for _ in range(2000)]


def boot(k, ref):
    out = []
    for d in draws:
        sel = [r for i in d for r in by_cart[cartridges[i]]]
        a = [err(r, k) for r in sel if used(r, k)]
        b = [err(r, ref) for r in sel if used(r, ref)]
        out.append(np.median(a) - np.median(b))
    return float(np.std(out, ddof=1))


base_med = np.median([err(r, 'base') for r in rows if used(r, 'base')])
u = float(np.std([np.median([err(r, 'base') for i in d for r in by_cart[cartridges[i]] if used(r, 'base')]) for d in draws], ddof=1))
print(f'u (SE of the baseline median) = {100 * u:.2f} pp')
for k, ref in [('in', 'base'), ('lopo', 'base'), ('unseen', 'unseenBase')]:
    a = line(rows, k)
    b = line(rows, ref)
    print(f'{k} vs {ref}: median change {100 * (a[1] - b[1]):+.2f} pp, P90 change {100 * (a[2] - b[2]):+.2f} pp, 2 u_d = {200 * boot(k, ref):.2f} pp, rows {a[0]} vs {b[0]}')

# direction: charge +2 % must not lower the velocity, barrel -10 % must not raise it
for k in ['base', 'lopo']:
    wrong = pairs = 0
    for r in rows:
        if not used(r, k):
            continue
        c, s = r[f'{k}Charge'], r[f'{k}Short']
        if c and 'v' in c:
            pairs += 1
            wrong += c['v'] < r[k]['v']
        if s and 'v' in s:
            pairs += 1
            wrong += s['v'] > r[k]['v']
    print(f'direction {k}: {wrong} wrong of {pairs} ({100 * wrong / pairs:.2f} %)')

# exponent choices
lo = choices['lopo']
fitted = {i: c for i, c in lo.items() if c['trainingRows'] > 0}
print('in-sample exponent per family:', choices['inSample'])
print('family sizes (fitted powders, training cartridges):', choices['familyCartridges'])
print('named powders', len(lo), 'with training rows', len(fitted))
print('leave-one-out exponent differs from in sample:', sum(1 for c in fitted.values() if c['n'] != c['nIn']))
print('fallback taken:', sum(1 for c in lo.values() if c['fallback']), 'by family', dict(Counter(c['family'] for c in lo.values() if c['fallback'])))
print('leave-one-out exponents:', dict(sorted(Counter(c['n'] for c in fitted.values()).items())))
print('changed by family:', dict(Counter(c['family'] for c in fitted.values() if c['n'] != c['nIn'])))
bad = [c for c in fitted.values() if not (c['factor'] and np.isfinite(c['factor']) and c['factor'] > 0)]
print('factors not finite and positive:', len(bad))
