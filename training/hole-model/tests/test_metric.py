import pytest

from hole_model.metric import HoleMatch, correction_stats, corrections, match_holes, percentile


def test_two_marks_near_one_hole_pair_the_nearest() -> None:
    assert match_holes([(3, 0), (1, 0)], [(0, 0)], 8) == HoleMatch(matched=1, false=1, missed=0)


def test_nearest_pairs_go_first_across_holes() -> None:
    # the mark lies 3 px from the first hole and 2 px from the second, so it takes the second
    m = match_holes([(3, 0), (8.5, 0)], [(0, 0), (5, 0)], 8)
    assert m == HoleMatch(matched=1, false=1, missed=1)
    assert corrections(m) == 1


def test_a_mark_at_exactly_half_a_diameter_matches() -> None:
    assert match_holes([(4, 0), (0, 4.01)], [(0, 0), (0, 0)], 8) == HoleMatch(matched=1, false=1, missed=1)


def test_percentile_interpolates_between_ranks() -> None:
    assert percentile([1, 2, 3, 4], 0.5) == 2.5
    assert percentile([0, 10], 0.9) == 9
    assert percentile([7], 0.9) == 7


def test_the_90th_percentile_needs_20_photos() -> None:
    assert correction_stats(list(range(19))) == {"photos": 19, "median": 9, "max": 18}
    stats = correction_stats(list(range(20)))
    assert stats == {"photos": 20, "median": 9.5, "max": 19, "p90": pytest.approx(17.1)}
