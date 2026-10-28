---
title: Identifiability report against the two-parameter closed form
description: Whether the variance inflation, condition number and correlation of a weighted Jacobian match the exact values for two columns of a given correlation.
---

# Identifiability report against the two-parameter closed form

## Question

Least squares: does `identifiability` give the variance inflation, the condition number, the correlation and the standard errors that two parameters of known correlation must have?

## Method

A weighted Jacobian of two columns of unit norm whose information has correlation $\rho = 0.9$ was built as rows $(1, \rho)$ and $(0, \sqrt{1 - \rho^2})$. The report was compared with the closed forms below. Accept limits, from the tests: $5 \cdot 10^{-10}$ (9 digits) for the variance inflation and the condition number, $5 \cdot 10^{-13}$ (12 digits) for the correlation, and equality for the conditional sigmas. Two more cases: independent columns must give inflation 1, and a singular design must give infinite inflation, standard uncertainty and condition number with finite correlations.

## Formulas

The information matrix $F = J^\top J$ is here already a correlation matrix $R$ with unit diagonal and off-diagonal $\rho$. Its eigenvalues are $1 \pm \rho$, and its inverse is $\frac{1}{1 - \rho^2}$ times the matrix with 1 on the diagonal and $-\rho$ off it. So, with the quantities of the [least squares page](../models/least-squares.md):

$$
\mathrm{VIF} = \frac{1}{1 - \rho^2}, \qquad \kappa^2 = \frac{1 + \rho}{1 - \rho}, \qquad \rho_{12} = -\rho, \qquad \sigma^\text{cond} = 1, \qquad \sigma_j = \sigma^\text{cond}_j \sqrt{\mathrm{VIF}_j}
$$

## Numbers

All values agree within the limits above. The correlation of the estimates is $-\rho$: positively correlated columns give negatively correlated estimates. A second case (columns 0 and 1 equal, column 2 orthogonal) gives infinite inflation for the first two and 1 for the third.

## Result

No change. The eigenvalue floor of $10^{-12}\mu_\text{max}$ does not disturb a well-conditioned design, and a singular direction is reported as infinite for the parameters it involves and finite for the others.

## Data basis

Analytic: a closed form for a two-column design, no measured data.

## Where in the app

- `packages/core/src/least-squares.ts`, `identifiability`.
- `packages/core/test/least-squares.test.ts`, the tests "gives the two-parameter closed forms", "gives independent columns unit inflation and a singular matrix a huge one" and "leaves a parameter outside the null direction of a singular design finite".
- Model page: [least squares](../models/least-squares.md).

## Confidence

High for two parameters. Designs of three or more columns have no closed form here, and the report there rests on the eigenvalue formulas alone.
