import importlib.util
import re
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch


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

    def disconnect(self):
        pass


class FakeConsumer:
    def __init__(self, fail_commit=False):
        self.commits = []
        self.fail_commit = fail_commit
        self.closed = False

    def commit(self, offsets=None):
        if self.fail_commit:
            raise RuntimeError("commit failed")
        self.commits.append(offsets)

    def close(self):
        self.closed = True


class FakeMessage:
    def __init__(self, offset, value=None, topic="waf-realtime-events", partition=0):
        self.topic = topic
        self.partition = partition
        self.offset = offset
        self.value = value


class PollingFakeConsumer(FakeConsumer):
    def __init__(self, polls):
        super().__init__()
        self.polls = list(polls)

    def poll(self, timeout_ms=None, max_records=None):
        if self.polls:
            return self.polls.pop(0)
        return {}


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
        consumer.batch_messages = [FakeMessage(10)]

        self.assertFalse(consumer.insert_batch())
        self.assertEqual(len(consumer.batch), 1)
        self.assertEqual(consumer.consumer.commits, [])

    def test_successful_insert_commits_offsets_after_clickhouse(self):
        consumer = consumer_module.KafkaClickHouseConsumer()
        consumer.clickhouse_client = FakeClickHouse()
        consumer.consumer = FakeConsumer()
        consumer.batch = [self.sample_event()]
        consumer.batch_messages = [FakeMessage(10)]

        self.assertTrue(consumer.insert_batch())
        self.assertEqual(consumer.batch, [])
        self.assertEqual(consumer.batch_messages, [])
        self.assertEqual(len(consumer.consumer.commits), 1)
        offsets = consumer.consumer.commits[0]
        self.assertEqual(len(offsets), 1)
        self.assertEqual(next(iter(offsets.values())).offset, 11)

    def test_commit_failure_retains_inserted_batch(self):
        consumer = consumer_module.KafkaClickHouseConsumer()
        consumer.clickhouse_client = FakeClickHouse()
        consumer.consumer = FakeConsumer(fail_commit=True)
        consumer.batch = [self.sample_event()]
        consumer.batch_messages = [FakeMessage(10)]

        self.assertFalse(consumer.insert_batch())
        self.assertEqual(len(consumer.batch), 1)
        self.assertEqual(len(consumer.batch_messages), 1)

    def test_preflush_commits_only_stored_batch_not_current_polled_message(self):
        consumer = consumer_module.KafkaClickHouseConsumer()
        consumer.clickhouse_client = FakeClickHouse()
        consumer.consumer = FakeConsumer()
        consumer.batch = [self.sample_event()]
        consumer.batch_messages = [FakeMessage(10)]
        consumer.last_insert_time = 0

        current_message = FakeMessage(11, value={"transaction": {"id": "tx-2", "client_ip": "203.0.113.11"}})

        with patch.object(consumer_module, "BATCH_TIMEOUT", 1):
            self.assertTrue(consumer.process_message(current_message))

        first_commit_offsets = consumer.consumer.commits[0]
        self.assertEqual(next(iter(first_commit_offsets.values())).offset, 11)
        self.assertEqual(len(consumer.batch_messages), 1)
        self.assertEqual(consumer.batch_messages[0].offset, 11)

    def test_multipartition_commit_uses_only_stored_offsets(self):
        consumer = consumer_module.KafkaClickHouseConsumer()
        consumer.batch_messages = [
            FakeMessage(10, partition=0),
            FakeMessage(12, partition=0),
            FakeMessage(4, partition=1),
        ]

        offsets = consumer.build_commit_offsets()
        by_partition = {tp.partition: metadata.offset for tp, metadata in offsets.items()}

        self.assertEqual(by_partition, {0: 13, 1: 5})

    def test_idle_poll_loop_flushes_batch_after_timeout(self):
        consumer = consumer_module.KafkaClickHouseConsumer()
        consumer.clickhouse_client = FakeClickHouse()
        consumer.consumer = PollingFakeConsumer([{}])
        consumer.batch = [self.sample_event()]
        consumer.batch_messages = [FakeMessage(10)]
        consumer.last_insert_time = 0
        consumer.running = True

        def stop_after_insert():
            original = consumer.insert_batch

            def wrapped():
                result = original()
                consumer.running = False
                return result

            return wrapped

        with patch.object(consumer, "setup_clickhouse_client", lambda: None), \
             patch.object(consumer, "setup_kafka_consumer", lambda: None), \
             patch.object(consumer_module, "BATCH_TIMEOUT", 1), \
             patch.object(consumer, "insert_batch", stop_after_insert()):
            self.assertTrue(consumer.run())

        self.assertEqual(len(consumer.consumer.commits), 1)

    def test_shutdown_failed_flush_returns_failure(self):
        consumer = consumer_module.KafkaClickHouseConsumer()
        consumer.clickhouse_client = FakeClickHouse(fail=True)
        consumer.consumer = FakeConsumer()
        consumer.batch = [self.sample_event()]
        consumer.batch_messages = [FakeMessage(10)]

        self.assertFalse(consumer.shutdown())
        self.assertEqual(len(consumer.batch), 1)
        self.assertEqual(consumer.consumer.commits, [])

    def test_timestamp_parser_preserves_timezone_as_utc(self):
        consumer = consumer_module.KafkaClickHouseConsumer()

        parsed = consumer.parse_event_timestamp("25/Oct/2025:21:30:45 +0900")

        self.assertEqual(parsed, datetime(2025, 10, 25, 12, 30, 45))

    def test_client_ip_does_not_fall_back_to_untrusted_headers(self):
        consumer = consumer_module.KafkaClickHouseConsumer()

        event = consumer.parse_waf_event({
            "transaction": {
                "request": {
                    "headers": {
                        "X-Forwarded-For": "198.51.100.10",
                        "User-Agent": "curl",
                    }
                },
                "response": {"http_code": 200},
            }
        })

        self.assertEqual(event["client_ip"], "0.0.0.0")

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
