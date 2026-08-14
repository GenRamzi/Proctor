def double(values):
    return [value * 2 for value in values]


def test_returns_a_stable_smoke_test_result():
    assert double([1, 2, 3]) == [2, 4, 6]
