import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "coverage_floor", Path(__file__).resolve().parents[1] / "check_coverage_floor.py"
)
coverage_floor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coverage_floor)


class CoverageFloorTests(unittest.TestCase):
    def test_decrease_is_rejected(self):
        with self.assertRaises(ValueError):
            coverage_floor.check_floor(95, 100)

    def test_same_or_higher_floor_is_allowed(self):
        coverage_floor.check_floor(95, 95)
        coverage_floor.check_floor(100, 95)

    def test_invalid_floor_is_rejected(self):
        for value in ("0", "101", "-1", "nan", "inf", "true", '"100"'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                coverage_floor.read_floor(
                    f"[tool.coverage.report]\nfail_under = {value}\n"
                )

    def test_reads_numeric_floor(self):
        self.assertEqual(
            coverage_floor.read_floor("[tool.coverage.report]\nfail_under = 100\n"),
            100,
        )


if __name__ == "__main__":
    unittest.main()
