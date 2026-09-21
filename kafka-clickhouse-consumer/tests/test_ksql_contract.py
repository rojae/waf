import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).parents[2]
DDL = REPO_ROOT / "ksqldb" / "ddl.sql"


def read_statements():
    sql = DDL.read_text()
    return [statement.strip() for statement in sql.split(";") if statement.strip()]


def statement_named(prefix, name):
    wanted = f"{prefix} {name}".upper()
    for statement in read_statements():
        normalized = re.sub(r"\s+", " ", statement.upper())
        if wanted in normalized:
            return statement
    raise AssertionError(f"statement not found: {prefix} {name}")


class KsqlContractTests(unittest.TestCase):
    def test_raw_stream_declares_nested_classification_from_fluentbit_lua(self):
        raw = statement_named("CREATE STREAM", "MODSEC_RAW")
        columns = raw[raw.index("(") + 1:raw.rindex(") WITH")]

        self.assertRegex(columns, r"classification\s+STRUCT<", re.I)
        for field in ["track STRING", "anomaly_score INT", "rule_id STRING", "timestamp STRING"]:
            self.assertIn(field, re.sub(r"\s+", " ", columns))

    def test_analytics_stream_reads_nested_classification_track(self):
        analytics = statement_named("CREATE STREAM", "MODSEC_ANALYTICS")
        select_part = analytics.split("FROM MODSEC_RAW", 1)[0]
        where_part = analytics.split("FROM MODSEC_RAW", 1)[1]

        self.assertIn("classification->track AS track", select_part)
        self.assertIn("WHERE classification->track = 'analytics'", where_part)
        self.assertNotIn("WHERE track = 'analytics'", where_part)


if __name__ == "__main__":
    unittest.main()
