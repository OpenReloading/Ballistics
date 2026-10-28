Replications per cell: 20000, bootstrap resamples: 1000, seed 338. Monte Carlo standard error of a coverage near 95 %: 0.2 points.

### Distributions

| Case | Skewness | Excess kurtosis |
|---|---|---|
| normal | 0.00 | 0.00 |
| skewed (gamma, shape 4) | 1.00 | 1.50 |
| strongly skewed (lognormal, sigma 0.5) | 1.75 | 5.90 |
| heavy-tailed (Student t, 5 df) | 0.00 | 6.00 |
| stray shots (95 % N(0,1) + 5 % N(0,3^2)) | 0.00 | 4.65 |

### Coverage of the true SD, 90 % intervals (percent; miss below / miss above in brackets)

| Case | Method | n=3 | n=5 | n=10 | n=20 | n=30 | n=50 |
|---|---|---|---|---|---|---|---|
| normal | chi-square | 90.2 (4.8 / 5.0) | 90.4 (4.9 / 4.7) | 90.1 (5.0 / 4.9) | 89.9 (4.9 / 5.2) | 89.7 (5.3 / 4.9) | 90.2 (4.7 / 5.1) |
| normal | bootstrap | 43.9 (0.0 / 56.1) | 60.7 (0.0 / 39.2) | 73.2 (0.7 / 26.1) | 80.5 (1.5 / 18.0) | 83.3 (1.9 / 14.8) | 85.9 (2.1 / 12.0) |
| skewed (gamma, shape 4) | chi-square | 87.1 (6.4 / 6.5) | 85.6 (7.0 / 7.4) | 83.7 (8.0 / 8.3) | 80.9 (9.3 / 9.8) | 80.9 (9.4 / 9.7) | 79.2 (10.1 / 10.7) |
| skewed (gamma, shape 4) | bootstrap | 39.7 (0.0 / 60.3) | 54.2 (0.0 / 45.8) | 66.5 (0.7 / 32.9) | 73.6 (1.2 / 25.2) | 77.6 (1.5 / 20.9) | 81.0 (1.8 / 17.2) |
| strongly skewed (lognormal, sigma 0.5) | chi-square | 84.9 (6.7 / 8.3) | 80.1 (8.4 / 11.6) | 74.5 (10.3 / 15.2) | 68.2 (12.8 / 19.1) | 66.9 (13.9 / 19.2) | 65.1 (14.6 / 20.2) |
| strongly skewed (lognormal, sigma 0.5) | bootstrap | 33.0 (0.0 / 67.0) | 46.2 (0.0 / 53.7) | 57.8 (0.5 / 41.7) | 65.9 (0.7 / 33.4) | 71.1 (0.8 / 28.1) | 75.3 (1.1 / 23.6) |
| heavy-tailed (Student t, 5 df) | chi-square | 87.1 (6.1 / 6.8) | 84.9 (7.1 / 8.0) | 80.0 (8.9 / 11.1) | 76.5 (10.3 / 13.2) | 74.9 (11.0 / 14.1) | 72.8 (12.0 / 15.2) |
| heavy-tailed (Student t, 5 df) | bootstrap | 36.8 (0.0 / 63.2) | 51.0 (0.1 / 48.9) | 63.4 (0.6 / 36.1) | 71.4 (0.8 / 27.8) | 74.8 (0.9 / 24.3) | 78.1 (1.3 / 20.5) |
| stray shots (95 % N(0,1) + 5 % N(0,3^2)) | chi-square | 87.9 (5.6 / 6.4) | 85.4 (6.9 / 7.7) | 80.4 (9.3 / 10.3) | 74.5 (12.0 / 13.6) | 71.8 (13.1 / 15.1) | 68.0 (14.4 / 17.5) |
| stray shots (95 % N(0,1) + 5 % N(0,3^2)) | bootstrap | 36.1 (0.0 / 63.9) | 50.5 (0.1 / 49.4) | 60.6 (0.4 / 39.0) | 67.0 (0.6 / 32.3) | 70.1 (0.7 / 29.2) | 73.0 (1.0 / 26.0) |

### Coverage of the true SD, 95 % intervals (percent; miss below / miss above in brackets)

| Case | Method | n=3 | n=5 | n=10 | n=20 | n=30 | n=50 |
|---|---|---|---|---|---|---|---|
| normal | chi-square | 95.0 (2.5 / 2.5) | 95.1 (2.5 / 2.4) | 95.0 (2.6 / 2.4) | 95.0 (2.5 / 2.5) | 94.8 (2.7 / 2.5) | 95.1 (2.3 / 2.6) |
| normal | bootstrap | 43.9 (0.0 / 56.1) | 65.4 (0.0 / 34.6) | 78.0 (0.2 / 21.8) | 85.7 (0.5 / 13.7) | 88.6 (0.8 / 10.6) | 90.8 (1.0 / 8.2) |
| skewed (gamma, shape 4) | chi-square | 92.8 (3.9 / 3.3) | 91.9 (4.3 / 3.8) | 90.2 (5.3 / 4.6) | 88.0 (6.2 / 5.8) | 87.9 (6.4 / 5.8) | 86.6 (6.8 / 6.6) |
| skewed (gamma, shape 4) | bootstrap | 39.7 (0.0 / 60.3) | 58.4 (0.0 / 41.6) | 71.1 (0.2 / 28.7) | 78.6 (0.4 / 21.0) | 83.0 (0.5 / 16.5) | 86.2 (0.7 / 13.2) |
| strongly skewed (lognormal, sigma 0.5) | chi-square | 91.0 (4.7 / 4.3) | 87.3 (6.2 / 6.5) | 83.1 (7.7 / 9.2) | 77.5 (9.8 / 12.6) | 75.7 (10.8 / 13.5) | 74.0 (11.5 / 14.4) |
| strongly skewed (lognormal, sigma 0.5) | bootstrap | 33.0 (0.0 / 67.0) | 49.8 (0.0 / 50.2) | 62.1 (0.1 / 37.8) | 70.6 (0.2 / 29.1) | 75.8 (0.3 / 23.8) | 80.6 (0.3 / 19.1) |
| heavy-tailed (Student t, 5 df) | chi-square | 92.8 (3.8 / 3.5) | 90.8 (5.1 / 4.1) | 87.2 (6.4 / 6.4) | 84.0 (7.7 / 8.2) | 82.7 (8.3 / 9.0) | 80.8 (9.0 / 10.2) |
| heavy-tailed (Student t, 5 df) | bootstrap | 36.8 (0.0 / 63.2) | 55.2 (0.0 / 44.8) | 67.9 (0.1 / 31.9) | 76.7 (0.2 / 23.0) | 80.2 (0.3 / 19.5) | 83.7 (0.5 / 15.8) |
| stray shots (95 % N(0,1) + 5 % N(0,3^2)) | chi-square | 92.7 (4.0 / 3.3) | 90.9 (5.2 / 3.9) | 87.1 (7.3 / 5.6) | 82.4 (9.5 / 8.1) | 80.1 (10.4 / 9.5) | 77.1 (11.4 / 11.5) |
| stray shots (95 % N(0,1) + 5 % N(0,3^2)) | bootstrap | 36.1 (0.0 / 63.9) | 55.2 (0.0 / 44.8) | 65.7 (0.1 / 34.2) | 72.9 (0.2 / 26.9) | 76.4 (0.2 / 23.4) | 78.9 (0.4 / 20.7) |

### Median half-width of the interval over the true SD, 90 % (percent)

| Case | Method | n=3 | n=5 | n=10 | n=20 | n=30 | n=50 |
|---|---|---|---|---|---|---|---|
| normal | chi-square | 159.7 | 79.1 | 44.0 | 28.3 | 22.5 | 17.0 |
| normal | bootstrap | 45.8 | 41.0 | 30.3 | 23.0 | 19.4 | 15.5 |
| skewed (gamma, shape 4) | chi-square | 149.3 | 74.6 | 42.6 | 27.7 | 22.1 | 16.8 |
| skewed (gamma, shape 4) | bootstrap | 42.9 | 38.6 | 29.4 | 23.8 | 21.0 | 17.6 |
| strongly skewed (lognormal, sigma 0.5) | chi-square | 132.1 | 67.9 | 39.9 | 26.5 | 21.4 | 16.4 |
| strongly skewed (lognormal, sigma 0.5) | bootstrap | 37.9 | 35.6 | 29.5 | 25.9 | 23.9 | 20.8 |
| heavy-tailed (Student t, 5 df) | chi-square | 142.4 | 71.6 | 41.2 | 27.0 | 21.6 | 16.6 |
| heavy-tailed (Student t, 5 df) | bootstrap | 40.9 | 37.6 | 30.4 | 25.2 | 22.2 | 18.9 |
| stray shots (95 % N(0,1) + 5 % N(0,3^2)) | chi-square | 142.8 | 71.4 | 40.4 | 26.5 | 21.2 | 16.4 |
| stray shots (95 % N(0,1) + 5 % N(0,3^2)) | bootstrap | 41.0 | 37.1 | 28.4 | 22.8 | 20.3 | 17.9 |

### Median half-width of the interval over the true SD, 95 % (percent)

| Case | Method | n=3 | n=5 | n=10 | n=20 | n=30 | n=50 |
|---|---|---|---|---|---|---|---|
| normal | chi-square | 239.9 | 104.4 | 54.6 | 34.3 | 27.1 | 20.4 |
| normal | bootstrap | 45.8 | 46.4 | 35.8 | 27.2 | 23.0 | 18.3 |
| skewed (gamma, shape 4) | chi-square | 224.2 | 98.5 | 52.9 | 33.6 | 26.7 | 20.2 |
| skewed (gamma, shape 4) | bootstrap | 42.9 | 43.7 | 34.7 | 28.1 | 24.8 | 20.8 |
| strongly skewed (lognormal, sigma 0.5) | chi-square | 198.4 | 89.6 | 49.6 | 32.2 | 25.8 | 19.7 |
| strongly skewed (lognormal, sigma 0.5) | bootstrap | 37.9 | 40.0 | 34.6 | 30.4 | 28.0 | 24.5 |
| heavy-tailed (Student t, 5 df) | chi-square | 213.8 | 94.5 | 51.2 | 32.8 | 26.0 | 19.9 |
| heavy-tailed (Student t, 5 df) | bootstrap | 40.9 | 42.4 | 35.6 | 29.6 | 26.2 | 22.3 |
| stray shots (95 % N(0,1) + 5 % N(0,3^2)) | chi-square | 214.6 | 94.2 | 50.2 | 32.2 | 25.6 | 19.6 |
| stray shots (95 % N(0,1) + 5 % N(0,3^2)) | bootstrap | 41.0 | 42.1 | 33.4 | 26.9 | 24.0 | 21.1 |

### Chi-square interval as factors of the sample SD

| n | 90 % lower | 90 % upper | 90 % half-width | 95 % lower | 95 % upper | 95 % half-width |
|---|---|---|---|---|---|---|
| 3 | 0.58 | 4.42 | 191.9 % | 0.52 | 6.28 | 288.2 % |
| 4 | 0.62 | 2.92 | 115.0 % | 0.57 | 3.73 | 158.1 % |
| 5 | 0.65 | 2.37 | 86.2 % | 0.60 | 2.87 | 113.7 % |
| 6 | 0.67 | 2.09 | 70.9 % | 0.62 | 2.45 | 91.4 % |
| 8 | 0.71 | 1.80 | 54.6 % | 0.66 | 2.04 | 68.7 % |
| 10 | 0.73 | 1.65 | 45.8 % | 0.69 | 1.83 | 56.9 % |
| 15 | 0.77 | 1.46 | 34.5 % | 0.73 | 1.58 | 42.2 % |
| 20 | 0.79 | 1.37 | 28.8 % | 0.76 | 1.46 | 35.0 % |
| 30 | 0.83 | 1.28 | 22.7 % | 0.80 | 1.34 | 27.4 % |
| 50 | 0.86 | 1.20 | 17.1 % | 0.84 | 1.25 | 20.5 % |

### Shots needed for a relative half-width of the SD interval

| Half-width | 90 % | 95 % |
|---|---|---|
| 50 % | 9 | 12 |
| 30 % | 19 | 26 |
| 20 % | 38 | 53 |
