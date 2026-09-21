import importlib.util
import re
import unittest
from datetime import datetime
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "kafka_to_clickhouse.py"
INIT_SQL = Path(__file__).parents[2] / "clickhouse" / "init.sql"


spec = importlib.util.spec_from_file_location("kafka_to_clickhouse", MODULE_PATH)
consumer_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(consumer_module)


class FakeClickHouse:
    def __init__(self, fail=False):
        self.fail = fail
        self.executed = []

    def execute(self, query, data=None):
        self.executed.append((query, data))
        if self.fail:
            raise RuntimeError("insert failed")
        return []


class FakeConsumer:
    def __init__(self):
        self.commits = 0

    def commit(self):
        self.commits += 1


class KafkaClickHouseConsumerTests(unittest.TestCase):
    def sample_event(self):
        return {
            "timestamp": datetime(2026, 9, 22, 1, 2, 3),
            "tx_id": "tx-1",
            "client_ip": "203.0.113.10",
            "country_code": "US",
            "country_name": "United States",
            "city": "Test City",
            "latitude": 1.0,
            "longitude": 2.0,
            "uri": "/",
            "method": "GET",
            "status_code": 403,
            "referer": "",
            "accept_language": "",
            "rule_id": "942100",
            "anomaly_score": 5,
            "severity": "CRITICAL",
            "category": "attack-sqli",
            "msg": "SQL injection",
            "classification_track": "realtime",
            "attack_type": "SQL Injection",
            "attack_category": "injection",
            "severity_level": "critical",
            "is_scanner_detected": 0,
            "user_agent": "curl",
            "browser": "Unknown",
            "browser_version": "",
            "os": "Unknown",
            "os_version": "",
            "device": "Desktop",
            "is_bot": 0,
            "is_mobile": 0,
            "is_tablet": 0,
            "tags": ["attack-sqli"],
        }

    def test_failed_insert_retains_batch_and_does_not_commit(self):
        consumer = consumer_module.KafkaClickHouseConsumer()
        consumer.clickhouse_client = FakeClickHouse(fail=True)
        consumer.consumer = FakeConsumer()
        consumer.batch = [self.sample_event()]
        consumer.batch_messages = [object()]

        self.assertFalse(consumer.insert_batch())
        self.assertEqual(len(consumer.batch), 1)
        self.assertEqual(consumer.consumer.commits, 0)

    def test_successful_insert_commits_offsets_after_clickhouse(self):
        consumer = consumer_module.KafkaClickHouseConsumer()
        consumer.clickhouse_client = FakeClickHouse()
        consumer.consumer = FakeConsumer()
        consumer.batch = [self.sample_event()]
        consumer.batch_messages = [object()]

        self.assertTrue(consumer.insert_batch())
        self.assertEqual(consumer.batch, [])
        self.assertEqual(consumer.batch_messages, [])
        self.assertEqual(consumer.consumer.commits, 1)

    def test_insert_columns_exist_in_clickhouse_schema_or_additive_migration(self):
        source = MODULE_PATH.read_text()
        sql = INIT_SQL.read_text()

        insert_columns_match = re.search(
            r"INSERT INTO waf_analytics\.events\s*\((.*?)\)\s*VALUES",
            source,
            re.S,
        )
        self.assertIsNotNone(insert_columns_match)
        insert_columns = {
            column.strip()
            for column in insert_columns_match.group(1).replace("\n", " ").split(",")
            if column.strip()
        }

        create_columns_match = re.search(
            r"CREATE TABLE IF NOT EXISTS waf_analytics\.events \((.*?)\) ENGINE",
            sql,
            re.S,
        )
        self.assertIsNotNone(create_columns_match)
        create_columns = {
            line.strip().split()[0]
            for line in create_columns_match.group(1).splitlines()
            if line.strip() and not line.strip().startswith("--")
        }
        alter_columns = set(
            re.findall(
                r"ALTER TABLE waf_analytics\.events ADD COLUMN IF NOT EXISTS (\w+)",
                sql,
            )
        )

        missing = insert_columns - create_columns - alter_columns
        self.assertEqual(missing, set())


if __name__ == "__main__":
    unittest.main()
