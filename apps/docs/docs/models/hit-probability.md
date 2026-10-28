---
title: Hit probability
description: The probability of a hit and the expected score on a target face from the dispersion of a group scaled to the distance, with the crosswind and range uncertainty added.
---

# Hit probability

For a distance, a target face and the dispersion of the user's group, the model gives the probability that a shot lands inside each scoring zone of the face, the probability of a hit, and the expected score. The group's dispersion is scaled linearly with distance. The uncertainty of the wind and of the range adds to it through the sensitivity of the trajectory. The result is a simulation of a dispersion model, not a prediction of a shooter's score.

## Equations

### Point dispersion

The group's standard deviations per axis at the reference distance $D_0$ scale linearly to the distance $D$ of the target, $\sigma_g(D) = \sigma_{g,0}\,D / D_0$. The crosswind is $c = W \sin\phi$ for a wind speed $W$ blowing from the direction $\phi$ (0 a head wind, $\pi/2$ from the right). To first order its standard deviation follows from the standard deviations $\sigma_W$ of the speed and $\sigma_\phi$ of the direction:

$$
\sigma_c = \sqrt{\left(\sin\phi\ \sigma_W\right)^2 + \left(W \cos\phi\ \sigma_\phi\right)^2}
$$

Code: `packages/core/src/groups/hit-probability.ts`, `pointDispersion` (`crosswindSd`).

With $S_c$ the lateral displacement of the point of impact per 1 m/s of crosswind at the distance and $S_R$ the change of its height per metre of range, both from the trajectory, and $\sigma_R$ the standard deviation of the range, the standard deviations of the point of impact are

$$
\sigma_x = \sqrt{\sigma_{g,x}^2 + \left(S_c\,\sigma_c\right)^2}, \qquad \sigma_y = \sqrt{\sigma_{g,y}^2 + \left(S_R\,\sigma_R\right)^2}
$$

Code: `packages/core/src/groups/hit-probability.ts`, `pointDispersion`.

### Probability inside a zone

The point of impact is a bivariate normal variable centred on the aim point, with no correlation. A zone is an ellipse of semi-axes $a$ (along $x$) and $b$ (along $y$); a circle has $a = b$. With $x = a \sin t$ the probability inside it is the integral over $t$ of the density of $x$ times the probability that $\lvert y \rvert$ stays below $b \cos t$:

$$
P(a, b) = \int_{-t_0}^{t_0} \frac{e^{-x^2/(2\sigma_x^2)}}{\sigma_x \sqrt{2\pi}}\ \operatorname{erf}\!\left(\frac{b \cos t}{\sigma_y \sqrt{2}}\right) a \cos t\ \mathrm{d}t, \qquad x = a \sin t
$$

Code: `packages/core/src/groups/hit-probability.ts`, `ellipseProbability` (`f`, composite Simpson rule).

The integral is cut at $\lvert x \rvert = 8\sigma_x$. For a circular zone of radius $r$ and equal standard deviations it equals the closed form $1 - e^{-r^2/(2\sigma^2)}$, which the tests compare against. The error function is the chi-square distribution of one degree of freedom, $\operatorname{erf}(z/\sqrt{2}) = F_{\chi^2_1}(z^2)$ ([shot groups](groups.md)).

### Offset of the point of impact

Optionally the point of impact is centred at $(\delta_x, \delta_y)$ from the aim point, for example the measured group centre minus the point of aim ([shot groups](groups.md)). The density of $x$ is then centred at $\delta_x$, the probability for $y$ is the normal probability between $-b\cos t$ and $b\cos t$ about $\delta_y$, and the integral runs over $x \in [-a, a] \cap [\delta_x - 8\sigma_x, \delta_x + 8\sigma_x]$, empty (probability 0) when the zone lies beyond that:

$$
P(a, b) = \int \frac{e^{-(x-\delta_x)^2/(2\sigma_x^2)}}{\sigma_x \sqrt{2\pi}}\left[\Phi\!\left(\frac{b \cos t - \delta_y}{\sigma_y}\right) - \Phi\!\left(\frac{-b \cos t - \delta_y}{\sigma_y}\right)\right] a \cos t\ \mathrm{d}t
$$

Code: `packages/core/src/groups/hit-probability.ts`, `ellipseProbability` (`offset`), `hitProbability`.

With $\Phi$ the standard normal distribution function. For a circular zone of radius $r$ and equal standard deviations it is $1 - Q_1(\delta/\sigma,\ r/\sigma)$ with $\delta = \sqrt{\delta_x^2 + \delta_y^2}$ and $Q_1$ the Marcum Q function of order 1 (source not in the bibliography, unverified); the tests compare against it, written as the noncentral chi-square distribution of two degrees of freedom. For $\delta > r$ the probability first rises and then falls as $\sigma$ grows: a tighter group lowers it. The offset is an input of the prediction, not a setting of the sight.

### Shots needed

With $p$ the probability of a hit with one shot (the hit probability above) and independent shots, the chance of at least one hit in $n$ shots is $1 - (1-p)^n$. The smallest whole number of shots with a wanted chance $P_w$ and the mean number of shots to the first hit are

$$
n = \left\lceil \frac{\ln(1 - P_w)}{\ln(1 - p)} \right\rceil, \qquad \bar n = \frac{1}{p}
$$

Code: `packages/core/src/groups/hit-probability.ts`, `shotsToHit`.

After $\bar n$ shots the chance tends to $1 - e^{-1} \approx 63.2$ percent as $p$ becomes small.

### Expected score

Zones are nested, outermost first, with values $v_k$. A shot inside zone $k$ and outside zone $k+1$ scores $v_k$:

$$
p_k = P_k - P_{k+1}, \qquad P_{\text{hit}} = P_1, \qquad \mathbb{E}[v] = \sum_k v_k\,p_k
$$

Code: `packages/core/src/groups/hit-probability.ts`, `hitProbability`.

The zones of a face are its rings, grown by the radius of the scored hole as in [ring scoring](ring-scoring.md): a shot scores a ring when the hole edge touches it. The tenth-ring values and the inner ten are not part of the expected score.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $\sigma_{g,0}$, $\sigma_g$ | Group standard deviation per axis, at the reference distance and the target | mm | m |
| $D_0$, $D$ | Reference distance, distance of the target | m | m |
| $W$, $\sigma_W$ | Wind speed, its standard deviation | m/s | m/s |
| $\phi$, $\sigma_\phi$ | Direction the wind comes from, its standard deviation | deg | rad |
| $\sigma_c$ | Standard deviation of the crosswind | m/s | m/s |
| $S_c$ | Lateral displacement per 1 m/s of crosswind | no kind | m per m/s |
| $S_R$, $\sigma_R$ | Height change per metre of range, standard deviation of the range | no kind, m | m/m, m |
| $\sigma_x$, $\sigma_y$ | Standard deviations of the point of impact | mm | m |
| $a$, $b$ | Semi-axes of a scoring zone | mm | m |
| $P$, $p_k$ | Probability inside a zone, inside a zone and outside the next | 1 | 1 |
| $v_k$ | Value of zone $k$ | 1 | 1 |
| $\delta_x$, $\delta_y$ | Offset of the centre of the point of impact from the aim point | mm | m |
| $n$, $\bar n$, $P_w$ | Shots needed, mean shots to the first hit, wanted chance of a hit | 1 | 1 |

## Assumptions

- The group is a sample of the same distribution as the shots to be fired: the same rifle, load and shooter, the dispersion circular unless two standard deviations are given. Hold and aim errors beyond the group are not included.
- Dispersion grows linearly with distance, which holds for the dispersion of a group in angle and not for a drift that grows faster than the distance.
- The sensitivities $S_c$ and $S_R$ are taken at the nominal wind and range and held for the whole spread (first order). A wind of changing speed along the path is one wind.
- The point of impact is centred on the aim point unless an offset is given: without one, the zero is right. With one, it is the same for every shot.
- The shots are independent, with the same probability of a hit, for the number of shots needed.
- The wind and range errors are independent of each other and of the group.

## Limits

- The standard deviation of a group of a few shots is itself uncertain; the probability inherits it. A group of 5 shots gives a standard deviation known to about a third.
- Faces whose zones are not nested ellipses about one centre (several bulls per sheet, scoring areas that are no ellipse) are outside the model.
- An offset is the same for every shot. A centre that changes from group to group, and an offset that is not measured, are not modelled.
- A very small dispersion against a large zone gives a probability of 1 to the precision of the integration.

## Sources

- [NIST/SEMATECH](../bibliography.md#nist-sematech): 1.3.6.6.1 (normal distribution), 4.1.1 (first-order propagation of error), section numbers unverified.
- [Grubbs 1991](../bibliography.md#grubbs-1991): the circular normal dispersion of a group and its radial distribution.
