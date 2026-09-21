import json
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).parents[2]
PIPELINE = REPO_ROOT / "logstash" / "pipeline" / "pipeline.conf"
TEMPLATE = REPO_ROOT / "logstash" / "pipeline" / "waf-logs-template.json"


class LogstashContractTests(unittest.TestCase):
    def test_pipeline_uses_raw_topic_and_flat_document_contract(self):
        pipeline = PIPELINE.read_text()

        self.assertIn('topics            => ["waf-realtime-events"]', pipeline)
        self.assertIn('document_id        => "%{tx_id}"', pipeline)
        self.assertIn('event.set("client_ip"', pipeline)
        self.assertIn('event.set("status_code"', pipeline)
        self.assertIn('event.set("rule_id"', pipeline)
        self.assertIn('event.set("severity"', pipeline)
        self.assertIn('event.set("attack_type"', pipeline)
        self.assertIn('event.set("timestamp", ts.time.utc.strftime("%Y-%m-%dT%H:%M:%S.%3NZ"))', pipeline)

    def test_severity_and_attack_type_match_dashboard_filters(self):
        pipeline = PIPELINE.read_text()

        for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
            self.assertIn(f'"{severity}"', pipeline)

        self.assertLess(pipeline.index('when /^942/'), pipeline.index('when /^941/'))
        self.assertLess(pipeline.index('when /^932/'), pipeline.index('when /^930/'))
        for attack_type in ["SQL Injection", "XSS", "RCE", "Path Traversal", "Scanner", "Protocol", "Other"]:
            self.assertIn(f'"{attack_type}"', pipeline)

    def test_country_and_document_id_fallback_do_not_collapse(self):
        pipeline = PIPELINE.read_text()

        self.assertNotIn("%{[geo][country_iso_code]}", pipeline)
        self.assertIn("Digest::SHA256.hexdigest(tx.to_s)", pipeline)
        self.assertIn('tx_id = "raw-#{Digest::SHA256.hexdigest(tx.to_s)[0, 24]}"', pipeline)
        self.assertIn('tx_id = "kafka-#{topic}-#{partition}-#{offset}"', pipeline)

    def test_elasticsearch_template_declares_java_document_fields(self):
        template = json.loads(TEMPLATE.read_text())
        properties = template["template"]["mappings"]["properties"]

        expected = {
            "timestamp": "date",
            "client_ip": "ip",
            "method": "keyword",
            "status_code": "integer",
            "severity": "keyword",
            "attack_type": "keyword",
            "blocked": "boolean",
            "country": "keyword",
            "response_time": "long",
            "tx_id": "keyword",
        }
        for field, field_type in expected.items():
            self.assertEqual(properties[field]["type"], field_type)


if __name__ == "__main__":
    unittest.main()
