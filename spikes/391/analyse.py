"""Aggregates of the study from the per-row dumps of rows-dump.mts. Prints family-level tables only.

python spikes/391/analyse.py <command> ...
  noise <m3.jsonl>                         noise floor
  informative <m3.jsonl>                   informative rows against constants, per family
  metrics <m3.jsonl> <candidate.jsonl> <name>   held-out metrics, bootstrap, direction checks
  residual <m3.jsonl> <out.json>           fit the 3-constant residual correction on training rows
  exponent <fit-dir> <m3.jsonl> <out.json> choose the exponent per family on training error
  rich <fit-dir> <out.json>                the per-powder constants of the rich law
  ml <m3.jsonl>                            machine-learning candidates
"""

import glob
import json
import math
import pickle
import sys
from collections import defaultdict

import numpy as np

SEED = 391
# a family is reported with at least this many cartridges, source tables and powders, else "other"
MIN_CARTRIDGES = 5
MIN_TABLES = 2
MIN_POWDERS = 3


def rows(path):
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def used(rs, split):
    return [r for r in rs if r["split"] == split and "v" in r]


def q(values, p):
    return float(np.percentile(values, p)) if len(values) else float("nan")


def err(model, printed):
    return abs(model - printed) / printed


def families(rs):
    """Reported family label of each family of `rs`: small or single-source families become 'other'."""
    seen = defaultdict(lambda: (set(), set(), set()))
    for r in rs:
        c, t, p = seen[r["family"]]
        c.add(r["cartridge"])
        t.add(r["table"])
        p.add(r["powder"])
    return {f: (f if len(c) >= MIN_CARTRIDGES and len(t) >= MIN_TABLES and len(p) >= MIN_POWDERS else "other")
            for f, (c, t, p) in seen.items()}


def summary(es):
    return {"rows": len(es), "median": q(es, 50), "p90": q(es, 90)}


def pct(x):
    return f"{100 * x:.2f} %"


def bootstrap(base, cand, draws=2000):
    """SE of the median velocity error (baseline) and of the paired change, resampling cartridges."""
    rng = np.random.default_rng(SEED)
    by = defaultdict(lambda: ([], []))
    for cart, e in base:
        by[cart][0].append(e)
    for cart, e in cand:
        by[cart][1].append(e)
    keys = sorted(by)
    b_med, d_med = [], []
    for _ in range(draws):
        pick = rng.integers(0, len(keys), len(keys))
        b = np.concatenate([by[keys[i]][0] for i in pick if by[keys[i]][0]])
        c = np.concatenate([by[keys[i]][1] for i in pick if by[keys[i]][1]])
        b_med.append(np.median(b))
        d_med.append(np.median(c) - np.median(b))
    return float(np.std(b_med, ddof=1)), float(np.std(d_med, ddof=1)), len(keys)


def noise(path):
    rs = [r for r in rows(path) if r.get("printedV")]
    # the same load in two source tables: cartridge, powder, bullet mass and type, barrel, charge
    loads = defaultdict(dict)
    for r in rs:
        _, cart, mass, _, _, _, powder = r["session"].split("|")
        # bullet type and barrel are spelled differently between tables; mass and charge in g
        key = (cart, powder, round(float(mass), 2), round(r["charge"], 2))
        loads[key].setdefault(r["table"], r["printedV"])
    d = []
    for tables in loads.values():
        v = list(tables.values())
        for i in range(len(v)):
            for j in range(i + 1, len(v)):
                d.append(abs(v[i] - v[j]) / ((v[i] + v[j]) / 2))
    d = np.array(d)
    print(f"same load in two tables: pairs {len(d)}, identical {np.mean(d == 0):.1%}, "
          f"median {pct(q(d, 50))}, P90 {pct(q(d, 90))}; nonzero pairs {np.sum(d > 0)}, "
          f"median {pct(q(d[d > 0], 50))}, P90 {pct(q(d[d > 0], 90))}")
    # rows of one powder across cartridges: spread of the per-cartridge mean log residual of M3
    u = [r for r in rs if "v" in r]
    per = defaultdict(lambda: defaultdict(list))
    for r in u:
        per[r["powder"]][r["cartridge"]].append(math.log(r["v"] / r["printedV"]))
    sds = [np.std([np.mean(x) for x in c.values()], ddof=1) for c in per.values() if len(c) >= 3]
    print(f"one powder across cartridges (>= 3 cartridges, {len(sds)} powders): SD of the cartridge mean "
          f"log velocity residual, median {pct(q(sds, 50))}, P90 {pct(q(sds, 90))}")
    # within one table, cartridge and powder: the residual spread around the cartridge mean
    within = []
    for c in per.values():
        for x in c.values():
            if len(x) >= 3:
                m = np.mean(x)
                within.extend(abs(v - m) for v in x)
    print(f"within one cartridge and powder: median absolute deviation of the log residual {pct(q(within, 50))}, "
          f"P90 {pct(q(within, 90))}, rows {len(within)}")


CANDIDATE_CONSTANTS = {
    "present (vivacity, energy)": 2,
    "exponent per family (+ vivacity refit)": 2,
    "rich form (vivacity, energy, a, m)": 4,
    "exponential series, 3 terms (+ energy)": 7,
}


def informative(path):
    tr = used(rows(path), "training")
    by = defaultdict(list)
    for r in tr:
        by[r["powder"]].append(r)
    fam = defaultdict(list)
    for p, rs in by.items():
        loads = {(r["cartridge"], round(r["mass"], 5), round(r["charge"], 4), r["barrel"]) for r in rs}
        carts = {r["cartridge"] for r in rs}
        press = [r for r in rs if r.get("printedP")]
        pk = [r["p"] for r in rs]
        dens = [r["density"] for r in rs]
        burnt = [r["burnt"] for r in rs if r["burnt"] is not None]
        fam[rs[0]["family"]].append({
            "loads": len(loads), "carts": len(carts), "press": len(press),
            "pRatio": max(pk) / min(pk), "dRatio": max(dens) / min(dens),
            "burntRange": (max(burnt) - min(burnt)) if burnt else 0,
        })
    label = families(tr)
    merged = defaultdict(list)
    for f, ps in fam.items():
        merged[label[f]].extend(ps)
    print("| Family | Powders | Informative loads per powder (min / median / max) | Cartridges per powder (median) | Pressure rows per powder (median) | Peak pressure max/min (median) | Loading density max/min (median) | Burnt fraction range (median) | " +
          " | ".join(f"Share below {k} = {n}" for k, n in CANDIDATE_CONSTANTS.items()) + " |")
    print("|" + " --- |" * (8 + len(CANDIDATE_CONSTANTS)))
    for f in sorted(merged, key=lambda k: (k == "other", k)):
        ps = merged[f]
        if f == "other":
            continue
        L = [p["loads"] for p in ps]
        shares = [np.mean([p["loads"] < n for p in ps]) for n in CANDIDATE_CONSTANTS.values()]
        print(f"| {f} | {len(ps)} | {min(L)} / {int(np.median(L))} / {max(L)} | {np.median([p['carts'] for p in ps]):.0f} | "
              f"{np.median([p['press'] for p in ps]):.0f} | {np.median([p['pRatio'] for p in ps]):.2f} | "
              f"{np.median([p['dRatio'] for p in ps]):.2f} | {np.median([p['burntRange'] for p in ps]):.2f} | " +
              " | ".join(f"{s:.0%}" for s in shares) + " |")
    allp = [p for ps in fam.values() for p in ps]
    L = [p["loads"] for p in allp]
    print(f"all: {len(allp)} powders, loads {min(L)} / {int(np.median(L))} / {max(L)}; " +
          ", ".join(f"{k} {np.mean([x < n for x in L]):.0%}" for k, n in CANDIDATE_CONSTANTS.items()))


def direction(rs, key, wrong):
    pairs = [(r["v"], r[key]["v"]) for r in rs if r.get(key)]
    return sum(wrong(v, w) for v, w in pairs), len(pairs)


def report(name, base, cand_rows, v_of=lambda r: r["v"], p_of=lambda r: r["p"], extra=""):
    """One table line per group, plus the bootstrap and direction checks against the baseline."""
    fam = families(base)
    ev = [err(v_of(r), r["printedV"]) for r in cand_rows]
    pe = [err(p_of(r), r["printedP"]) for r in cand_rows if r.get("printedP") and p_of(r) is not None]
    s = summary(ev)
    print(f"| {name} | all | {s['rows']} | {pct(s['median'])} | {pct(s['p90'])} | "
          f"{pct(q(pe, 50))} | {pct(q(pe, 90))} | {len(pe)} |{extra}")
    groups = defaultdict(list)
    for r in cand_rows:
        groups[fam.get(r["family"], "other")].append(err(v_of(r), r["printedV"]))
    for g in sorted(groups):
        if g == "other":
            continue
        s = summary(groups[g])
        print(f"| {name} | {g} | {s['rows']} | {pct(s['median'])} | {pct(s['p90'])} | | | |")


def verdict(name, base, cand_rows, v_of=lambda r: r["v"], direction_counts=None):
    b = [(r["cartridge"], err(r["v"], r["printedV"])) for r in base]
    c = [(r["cartridge"], err(v_of(r), r["printedV"])) for r in cand_rows]
    u, ud, n = bootstrap(b, c)
    bm, bp = np.median([e for _, e in b]), q([e for _, e in b], 90)
    cm, cp = np.median([e for _, e in c]), q([e for _, e in c], 90)
    fall = bm - cm
    rule = {
        "1 median falls >= 0.1 pp": fall >= 0.001,
        "2 fall > 2 u_d": fall > 2 * ud,
        "3 P90 does not rise": cp <= bp,
        "4 used rows within 1 %": len(c) >= 0.99 * len(b),
    }
    if direction_counts is not None:
        rule["5 wrong direction < 1 %"] = direction_counts < 0.01
    ok = all(rule.values())
    print(f"{name}: median change {100 * (cm - bm):+.2f} pp, P90 change {100 * (cp - bp):+.2f} pp, u {100 * u:.2f} pp, "
          f"u_d {100 * ud:.2f} pp over {n} cartridges, rows {len(c)} of {len(b)}; "
          + ", ".join(f"{k}: {'yes' if v else 'no'}" for k, v in rule.items()) + f" -> {'PASS' if ok else 'FAIL'}")


def metrics(base_path, cand_path, name):
    base = used(rows(base_path), "validation")
    cand = used(rows(cand_path), "validation")
    report(name, base, cand)
    up = direction(cand, "vCharge", lambda v, w: w < v)
    sh = direction(cand, "vShort", lambda v, w: w > v)
    share = (up[0] + sh[0]) / max(1, up[1] + sh[1])
    print(f"{name}: wrong direction charge +2 % {up[0]} of {up[1]}, barrel -10 % {sh[0]} of {sh[1]}")
    unseen = [r for r in cand if r.get("vUnseen")]
    ue = [err(r["vUnseen"]["v"], r["printedV"]) for r in unseen]
    upe = [err(r["vUnseen"]["p"], r["printedP"]) for r in unseen if r.get("printedP")]
    print(f"| {name} | not in the fitted set | {len(ue)} | {pct(q(ue, 50))} | {pct(q(ue, 90))} | "
          f"{pct(q(upe, 50))} | {pct(q(upe, 90))} | {len(upe)} |")
    verdict(name, base, cand, direction_counts=share)


def residual(path, out):
    tr = used(rows(path), "training")
    X = np.array([[1, math.log(r["chargeRatio"]), math.log(r["density"])] for r in tr])
    y = np.array([math.log(r["printedV"] / r["v"]) for r in tr])
    c, *_ = np.linalg.lstsq(X, y, rcond=None)
    json.dump({"residual": [float(v) for v in c]}, open(out, "w"))
    print("residual constants", c)


def load_fits(fit_dir, mode):
    out = {}
    for f in sorted(glob.glob(f"{fit_dir}/{mode}-*.json")):
        out.update(json.load(open(f)))
    return out


def exponent(fit_dir, path, out):
    fits = load_fits(fit_dir, "exponent")
    tr = used(rows(path), "training")
    fam_of = {r["powder"]: r["family"] for r in tr}
    grid = [f["n"] for f in next(iter(fits.values()))["fits"]]
    by_fam = defaultdict(lambda: np.zeros(len(grid)))
    for p, v in fits.items():
        by_fam[fam_of[p]] += np.array([f["sse"] for f in v["fits"]])
    best = {f: grid[int(np.argmin(s))] for f, s in by_fam.items()}
    params = {"powders": {}}
    control = {"powders": {}}
    for p, v in fits.items():
        n = best[fam_of[p]]
        fit = next(f for f in v["fits"] if f["n"] == n)
        params["powders"][v["key"]] = {"viv": fit["viv"], "n": n}
        one = next(f for f in v["fits"] if f["n"] == 1)
        control["powders"][v["key"]] = {"viv": one["viv"]}
    json.dump(params, open(out, "w"))
    json.dump(control, open(out.replace(".json", "-control.json"), "w"))
    print("exponent per family (training SSE):", {f: n for f, n in sorted(best.items())})
    ns = [best[fam_of[p]] for p in fits]
    print("powders per exponent:", {n: ns.count(n) for n in grid})


def rich(fit_dir, out):
    fits = load_fits(fit_dir, "rich")
    params = {"powders": {v["key"]: {k: v[k] for k in ("viv", "energy", "a", "m")} for v in fits.values()}}
    json.dump(params, open(out, "w"))
    # positivity and monotone vivacity of the fitted form: phi = (1 + a z)^m on [0, z1] > 0 and monotone
    bad_pos = sum(1 + v["a"] * v["z1"] <= 0 for v in fits.values())
    z = np.linspace(0, 1, 101)
    bad_mono = 0
    for v in fits.values():
        zz = z[z <= v["z1"]]
        phi = (1 + v["a"] * zz) ** v["m"]
        d = np.diff(phi)
        bad_mono += not (np.all(d >= -1e-12) or np.all(d <= 1e-12))
    print(f"rich: {len(fits)} powders, not positive {bad_pos}, not monotone on the first stage {bad_mono}; "
          f"training SSE ratio rich/record median {np.median([v['sse'] / v['sseRecord'] for v in fits.values() if v['sseRecord'] > 0]):.2f}")


def ml(path):
    from sklearn.ensemble import HistGradientBoostingRegressor
    from sklearn.gaussian_process import GaussianProcessRegressor
    from sklearn.gaussian_process.kernels import RBF, WhiteKernel
    from sklearn.neural_network import MLPRegressor
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    rs = rows(path)
    tr, val = used(rs, "training"), used(rs, "validation")
    fams = sorted({r["family"] for r in tr + val})

    def feats(r, physics_only=False):
        x = [math.log(r["chargeRatio"]), math.log(r["density"]), math.log(r["expansion"]),
             math.log(r["mass"]), math.log(r["vivacity"]), math.log(r["energy"]),
             math.log(r["startPressure"]), r["burnt"] if r["burnt"] is not None else 1.0]
        if not physics_only:
            x += [math.log(r["v"]), math.log(r["p"])]
        return x + [r["family"] == f for f in fams]

    def with_load(r, key):
        """The row with the features and outputs of a perturbed or unseen load."""
        return {**r, **r[key]}

    rng = np.random.default_rng(SEED)
    sub = rng.choice(len(tr), size=min(2000, len(tr)), replace=False)
    learners = {
        "GBT": lambda: HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_leaf_nodes=15,
                                                     l2_regularization=1.0, random_state=SEED),
        "MLP": lambda: make_pipeline(StandardScaler(), MLPRegressor(hidden_layer_sizes=(32, 32), alpha=1e-3,
                                                                     max_iter=500, early_stopping=True,
                                                                     random_state=SEED)),
        "GP": lambda: make_pipeline(StandardScaler(), GaussianProcessRegressor(
            kernel=RBF(length_scale=np.ones(8 + len(fams) + 2)) + WhiteKernel(1e-3), normalize_y=True,
            random_state=SEED)),
    }
    for kind in ("corrector", "stand-alone"):
        physics = kind == "stand-alone"
        X = np.array([feats(r, physics) for r in tr], dtype=float)
        y = np.array([math.log(r["printedV"] / (1 if physics else r["v"])) for r in tr])
        for lname, make in learners.items():
            if lname == "GP" and physics:
                continue
            idx = sub if lname == "GP" else slice(None)
            if lname == "GP":
                make_k = lambda: make_pipeline(StandardScaler(), GaussianProcessRegressor(  # noqa: E731
                    kernel=RBF(length_scale=np.ones(X.shape[1])) + WhiteKernel(1e-3), normalize_y=True,
                    random_state=SEED))
                model = make_k().fit(X[idx], y[idx])
            else:
                model = make().fit(X[idx], y[idx])

            def pred(r):
                f = np.array([feats(r, physics)], dtype=float)
                out = float(model.predict(f)[0])
                return math.exp(out) if physics else r["v"] * math.exp(out)

            name = f"ML {kind} {lname}"
            vs = {id(r): pred(r) for r in val}
            report(name, val, val, v_of=lambda r: vs[id(r)], p_of=lambda r: None)
            wrong = total = 0
            for r in val:
                for key, bad in (("vCharge", lambda v, w: w < v), ("vShort", lambda v, w: w > v)):
                    if r.get(key):
                        total += 1
                        wrong += bad(vs[id(r)], pred(with_load(r, key)))
            ue = [err(pred(with_load(r, "vUnseen")), r["printedV"]) for r in val if r.get("vUnseen")]
            print(f"| {name} | not in the fitted set | {len(ue)} | {pct(q(ue, 50))} | {pct(q(ue, 90))} | | | |")
            size = len(pickle.dumps(model))
            again = (make_k() if lname == "GP" else make()).fit(X[idx], y[idx])
            same = np.allclose(again.predict(X[:200]), model.predict(X[:200]), rtol=0, atol=0)
            print(f"{name}: wrong direction {wrong} of {total} ({wrong / max(1, total):.2%}), size {size / 1024:.0f} KiB, "
                  f"deterministic {same}")
            verdict(name, val, val, v_of=lambda r: vs[id(r)], direction_counts=wrong / max(1, total))


if __name__ == "__main__":
    cmd, *args = sys.argv[1:]
    {"noise": noise, "informative": informative, "metrics": metrics, "residual": residual,
     "exponent": exponent, "rich": rich, "ml": ml}[cmd](*args)
