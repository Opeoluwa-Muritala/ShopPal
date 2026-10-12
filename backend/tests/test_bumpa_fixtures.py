from tests.bumpa_fixture_loader import HANDWRITTEN, load_handwritten


def test_all_handwritten_fixtures_are_labelled_and_parseable():
    paths = list(HANDWRITTEN.glob("*.jsonc"))
    assert len(paths) >= 16
    for path in paths:
        assert isinstance(load_handwritten(path.name), dict)
