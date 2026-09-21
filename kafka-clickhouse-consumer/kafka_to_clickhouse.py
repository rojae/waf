#!/usr/bin/env python3
"""
Kafka to ClickHouse Consumer
Consumes WAF events from Kafka and writes directly to ClickHouse
"""

import os
import json
import logging
import signal
import sys
from collections import namedtuple
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import time
import ipaddress

try:
    from kafka import KafkaConsumer
    from kafka.structs import OffsetAndMetadata, TopicPartition
except ImportError:  # pragma: no cover - exercised in minimal test envs
    KafkaConsumer = None
    TopicPartition = namedtuple("TopicPartition", ["topic", "partition"])
    OffsetAndMetadata = namedtuple("OffsetAndMetadata", ["offset", "metadata"])

try:
    from clickhouse_driver import Client
except ImportError:  # pragma: no cover - exercised in minimal test envs
    Client = None

try:
    import geoip2.database
except ImportError:  # pragma: no cover - exercised in minimal test envs
    geoip2 = None

try:
    from user_agents import parse as parse_user_agent
except ImportError:  # pragma: no cover - exercised in minimal test envs
    parse_user_agent = None

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Environment variables
KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
KAFKA_TOPIC = os.getenv('KAFKA_TOPIC', 'waf-realtime-events')
KAFKA_GROUP_ID = os.getenv('KAFKA_GROUP_ID', 'clickhouse-consumer-group')

CLICKHOUSE_HOST = os.getenv('CLICKHOUSE_HOST', 'localhost')
CLICKHOUSE_PORT = int(os.getenv('CLICKHOUSE_PORT', '9000'))
CLICKHOUSE_USER = os.getenv('CLICKHOUSE_USER', 'default')
CLICKHOUSE_PASSWORD = os.getenv('CLICKHOUSE_PASSWORD', '')
CLICKHOUSE_DATABASE = os.getenv('CLICKHOUSE_DATABASE', 'waf_analytics')

BATCH_SIZE = int(os.getenv('BATCH_SIZE', '100'))
BATCH_TIMEOUT = int(os.getenv('BATCH_TIMEOUT', '5'))  # seconds
POLL_TIMEOUT_MS = int(os.getenv('POLL_TIMEOUT_MS', '1000'))

# GeoIP Database (optional)
GEOIP_DB_PATH = os.getenv('GEOIP_DB_PATH', '/usr/share/GeoIP/GeoLite2-City.mmdb')

class KafkaClickHouseConsumer:
    def __init__(self):
        self.running = True
        self.consumer = None
        self.clickhouse_client = None
        self.batch = []
        self.batch_messages = []
        self.last_insert_time = time.time()
        self.geoip_reader = None

        # Try to load GeoIP database
        try:
            if geoip2 and os.path.exists(GEOIP_DB_PATH):
                self.geoip_reader = geoip2.database.Reader(GEOIP_DB_PATH)
                logger.info(f"✓ GeoIP database loaded: {GEOIP_DB_PATH}")
            else:
                logger.warning(f"GeoIP database not found: {GEOIP_DB_PATH}")
        except Exception as e:
            logger.warning(f"Failed to load GeoIP database: {e}")

    def setup_kafka_consumer(self):
        """Initialize Kafka consumer"""
        if KafkaConsumer is None:
            raise RuntimeError("kafka-python is required to run the ClickHouse consumer")
        logger.info(f"Connecting to Kafka: {KAFKA_BOOTSTRAP_SERVERS}")
        logger.info(f"Topic: {KAFKA_TOPIC}, Group ID: {KAFKA_GROUP_ID}")

        self.consumer = KafkaConsumer(
            KAFKA_TOPIC,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS.split(','),
            group_id=KAFKA_GROUP_ID,
            auto_offset_reset='latest',  # Start from latest messages
            enable_auto_commit=False,
            value_deserializer=lambda x: json.loads(x.decode('utf-8')) if x else None
        )
        logger.info("✓ Kafka consumer initialized")

    def setup_clickhouse_client(self):
        """Initialize ClickHouse client"""
        if Client is None:
            raise RuntimeError("clickhouse-driver is required to run the ClickHouse consumer")
        logger.info(f"Connecting to ClickHouse: {CLICKHOUSE_HOST}:{CLICKHOUSE_PORT}")

        self.clickhouse_client = Client(
            host=CLICKHOUSE_HOST,
            port=CLICKHOUSE_PORT,
            user=CLICKHOUSE_USER,
            password=CLICKHOUSE_PASSWORD,
            database=CLICKHOUSE_DATABASE
        )

        # Test connection
        result = self.clickhouse_client.execute('SELECT version()')
        logger.info(f"✓ ClickHouse connected - Version: {result[0][0]}")

    def get_geoip_info(self, ip_str: str) -> Dict[str, str]:
        """Get GeoIP information for an IP address"""
        result = {
            'country_code': 'XX',  # Default unknown
            'country_name': 'Unknown',
            'city': 'Unknown',
            'latitude': 0.0,
            'longitude': 0.0
        }

        if not self.geoip_reader:
            return result

        try:
            # Skip private/local IPs
            ip = ipaddress.ip_address(ip_str)
            if ip.is_private or ip.is_loopback:
                result['country_code'] = 'LOCAL'
                result['country_name'] = 'Local Network'
                result['city'] = 'localhost'
                return result

            # Lookup GeoIP
            response = self.geoip_reader.city(ip_str)
            if response.country.iso_code:
                result['country_code'] = response.country.iso_code
                result['country_name'] = response.country.name or 'Unknown'
            if response.city.name:
                result['city'] = response.city.name
            if response.location.latitude and response.location.longitude:
                result['latitude'] = response.location.latitude
                result['longitude'] = response.location.longitude

        except Exception as e:
            logger.debug(f"GeoIP lookup failed for {ip_str}: {e}")

        return result

    def parse_user_agent(self, ua_string: str) -> Dict[str, str]:
        """Parse User-Agent string"""
        result = {
            'browser': 'Unknown',
            'browser_version': '',
            'os': 'Unknown',
            'os_version': '',
            'device': 'Desktop',
            'is_bot': False,
            'is_mobile': False,
            'is_tablet': False
        }

        if not ua_string:
            return result
        if parse_user_agent is None:
            return result

        try:
            ua = parse_user_agent(ua_string)
            result['browser'] = ua.browser.family
            result['browser_version'] = ua.browser.version_string
            result['os'] = ua.os.family
            result['os_version'] = ua.os.version_string
            result['device'] = ua.device.family
            result['is_bot'] = ua.is_bot
            result['is_mobile'] = ua.is_mobile
            result['is_tablet'] = ua.is_tablet
        except Exception as e:
            logger.debug(f"User-Agent parsing failed: {e}")

        return result

    def detect_attack_type(self, messages: list) -> Dict[str, Any]:
        """Detect attack type and classification from messages"""
        attack_info = {
            'attack_type': 'unknown',
            'attack_category': 'general',
            'severity_level': 'low',
            'is_scanner': False,
            'rule_tags': []
        }

        if not messages:
            return attack_info

        try:
            first_msg = messages[0] if isinstance(messages, list) else messages
            details = first_msg.get('details', {})
            tags = details.get('tags', [])

            # Classify attack type from tags
            for tag in tags:
                if 'attack-sqli' in tag:
                    attack_info['attack_type'] = 'SQL Injection'
                    attack_info['attack_category'] = 'injection'
                    attack_info['severity_level'] = 'critical'
                elif 'attack-xss' in tag:
                    attack_info['attack_type'] = 'Cross-Site Scripting'
                    attack_info['attack_category'] = 'xss'
                    attack_info['severity_level'] = 'high'
                elif 'attack-lfi' in tag or 'attack-rfi' in tag:
                    attack_info['attack_type'] = 'File Inclusion'
                    attack_info['attack_category'] = 'file-inclusion'
                    attack_info['severity_level'] = 'critical'
                elif 'attack-rce' in tag:
                    attack_info['attack_type'] = 'Remote Code Execution'
                    attack_info['attack_category'] = 'rce'
                    attack_info['severity_level'] = 'critical'
                elif 'scanner' in tag.lower() or 'automation' in tag.lower():
                    attack_info['is_scanner'] = True
                    attack_info['attack_type'] = 'Scanner/Bot'
                    attack_info['attack_category'] = 'recon'

            attack_info['rule_tags'] = tags

        except Exception as e:
            logger.debug(f"Attack type detection failed: {e}")

        return attack_info

    def parse_waf_event(self, message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse WAF event from Kafka message"""
        try:
            # Extract fields from ModSecurity audit log
            transaction = message.get('transaction', {})
            request = transaction.get('request', {})
            response = transaction.get('response', {})
            messages = transaction.get('messages', [])

            # Parse timestamp
            timestamp_str = transaction.get('time_stamp')
            timestamp = self.parse_event_timestamp(timestamp_str)

            # Get client IP
            client_ip = transaction.get('client_ip', '0.0.0.0')

            # Get GeoIP information
            geoip_info = self.get_geoip_info(client_ip)

            # Get User-Agent and parse it
            user_agent = request.get('headers', {}).get('User-Agent', 'Unknown')
            ua_info = self.parse_user_agent(user_agent)

            # Get rule information and attack classification
            rule_id = ''
            anomaly_score = 0
            severity = 'INFO'
            category = 'general'
            msg = ''
            tags = []

            if messages:
                first_msg = messages[0] if isinstance(messages, list) else messages
                details = first_msg.get('details', {})
                rule_id = details.get('ruleId', '')
                severity = details.get('severity', 'INFO')
                msg = details.get('msg', details.get('message', first_msg.get('message', '')))
                tags = details.get('tags', [])

                # Extract category from tags
                for tag in tags:
                    if tag.startswith('attack-'):
                        category = tag
                        break

                # Calculate anomaly score
                if severity == 'CRITICAL':
                    anomaly_score = 5
                elif severity == 'ERROR':
                    anomaly_score = 4
                elif severity == 'WARNING':
                    anomaly_score = 3
                else:
                    anomaly_score = 0

            # Detect attack type and classification
            attack_info = self.detect_attack_type(messages)

            # Get HTTP headers for additional context
            headers = request.get('headers', {})
            referer = headers.get('Referer', '')
            accept_language = headers.get('Accept-Language', '')

            # Determine classification track (realtime vs analytics)
            classification_track = 'realtime' if anomaly_score >= 3 else 'analytics'

            # Build enriched event data
            event_data = {
                'timestamp': timestamp,
                'tx_id': transaction.get('id', transaction.get('unique_id', '')),
                'client_ip': client_ip,
                'uri': request.get('uri', '/'),
                'method': request.get('method', 'GET'),
                'status_code': int(response.get('http_code', 0)),
                'rule_id': rule_id,
                'anomaly_score': anomaly_score,
                'severity': severity,
                'category': category,
                'msg': msg,
                'classification_track': classification_track,

                # User-Agent information
                'user_agent': user_agent,
                'browser': ua_info['browser'],
                'browser_version': ua_info['browser_version'],
                'os': ua_info['os'],
                'os_version': ua_info['os_version'],
                'device': ua_info['device'],
                'is_bot': 1 if ua_info['is_bot'] else 0,
                'is_mobile': 1 if ua_info['is_mobile'] else 0,
                'is_tablet': 1 if ua_info['is_tablet'] else 0,

                # GeoIP information
                'country_code': geoip_info['country_code'],
                'country_name': geoip_info['country_name'],
                'city': geoip_info['city'],
                'latitude': geoip_info['latitude'],
                'longitude': geoip_info['longitude'],

                # Attack classification
                'attack_type': attack_info['attack_type'],
                'attack_category': attack_info['attack_category'],
                'severity_level': attack_info['severity_level'],
                'is_scanner_detected': 1 if attack_info['is_scanner'] else 0,

                # Additional metadata
                'referer': referer,
                'accept_language': accept_language,
                'tags': tags
            }

            return event_data

        except Exception as e:
            logger.error(f"Error parsing WAF event: {e}")
            logger.debug(f"Message: {message}")
            return None

    def parse_event_timestamp(self, timestamp_str: Optional[str]) -> datetime:
        """Parse ModSecurity timestamps and normalize to UTC without dropping offsets."""
        if not timestamp_str:
            return datetime.now(timezone.utc).replace(tzinfo=None)

        candidates = [
            ("%d/%b/%Y:%H:%M:%S %z", timestamp_str),
            ("%Y-%m-%dT%H:%M:%S.%f%z", timestamp_str.replace("Z", "+0000")),
            ("%Y-%m-%dT%H:%M:%S%z", timestamp_str.replace("Z", "+0000")),
            ("%Y-%m-%d %H:%M:%S", timestamp_str),
        ]
        for layout, value in candidates:
            try:
                parsed = datetime.strptime(value, layout)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                return parsed.astimezone(timezone.utc).replace(tzinfo=None)
            except ValueError:
                continue

        try:
            parsed = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError:
            logger.warning("Failed to parse event timestamp; using current UTC time")
            return datetime.now(timezone.utc).replace(tzinfo=None)

    def build_commit_offsets(self) -> Dict[Any, Any]:
        offsets = {}
        for message in self.batch_messages:
            topic = getattr(message, 'topic', None)
            partition = getattr(message, 'partition', None)
            offset = getattr(message, 'offset', None)
            if topic is None or partition is None or offset is None:
                continue

            tp = TopicPartition(topic, partition)
            next_offset = int(offset) + 1
            current = offsets.get(tp)
            if current is None or next_offset > current.offset:
                offsets[tp] = OffsetAndMetadata(next_offset, None)
        return offsets

    def commit_batch_offsets(self) -> bool:
        if not self.consumer or not self.batch_messages:
            return True

        offsets = self.build_commit_offsets()
        if not offsets:
            logger.error("No explicit Kafka offsets available for inserted batch; retaining batch")
            return False

        self.consumer.commit(offsets=offsets)
        logger.info(f"✓ Kafka offsets committed after durable ClickHouse insert: {offsets}")
        return True

    def insert_batch(self) -> bool:
        """Insert batch of events to ClickHouse"""
        if not self.batch:
            return True

        try:
            # Prepare data for insertion
            data_to_insert = []
            for event in self.batch:
                data_to_insert.append((
                    event['timestamp'],
                    event['tx_id'],
                    event['client_ip'],
                    event['country_code'],
                    event['country_name'],
                    event['city'],
                    event['latitude'],
                    event['longitude'],
                    event['uri'],
                    event['method'],
                    event['status_code'],
                    event['referer'],
                    event['accept_language'],
                    event['rule_id'],
                    event['anomaly_score'],
                    event['severity'],
                    event['category'],
                    event['msg'],
                    event['classification_track'],
                    event['attack_type'],
                    event['attack_category'],
                    event['severity_level'],
                    event['is_scanner_detected'],
                    event['user_agent'],
                    event['browser'],
                    event['browser_version'],
                    event['os'],
                    event['os_version'],
                    event['device'],
                    event['is_bot'],
                    event['is_mobile'],
                    event['is_tablet'],
                    event['tags']
                ))

            # Insert to ClickHouse
            self.clickhouse_client.execute(
                '''
                INSERT INTO waf_analytics.events
                (timestamp, tx_id, client_ip, country_code, country_name, city, latitude, longitude,
                 uri, method, status_code, referer, accept_language,
                 rule_id, anomaly_score, severity, category, msg, classification_track,
                 attack_type, attack_category, severity_level, is_scanner_detected,
                 user_agent, browser, browser_version, os, os_version, device,
                 is_bot, is_mobile, is_tablet, tags)
                VALUES
                ''',
                data_to_insert
            )

            logger.info(f"✓ Inserted {len(self.batch)} events to ClickHouse")
            if not self.commit_batch_offsets():
                return False
            self.batch = []
            self.batch_messages = []
            self.last_insert_time = time.time()
            return True

        except Exception as e:
            logger.error(f"Error inserting batch to ClickHouse: {e}")
            logger.error("Retaining batch and leaving Kafka offsets uncommitted for replay")
            return False

    def process_message(self, message) -> bool:
        """Process a single Kafka message"""
        try:
            if self.batch:
                if len(self.batch) >= BATCH_SIZE or (time.time() - self.last_insert_time) >= BATCH_TIMEOUT:
                    if not self.insert_batch():
                        return False

            if message.value is None:
                return True

            # Parse WAF event
            event_data = self.parse_waf_event(message.value)
            if event_data:
                self.batch.append(event_data)
                self.batch_messages.append(message)

                # Insert batch if size reached or timeout
                if len(self.batch) >= BATCH_SIZE or \
                   (time.time() - self.last_insert_time) >= BATCH_TIMEOUT:
                    return self.insert_batch()
            return True

        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return False

    def run(self):
        """Main consumer loop"""
        logger.info("Starting Kafka to ClickHouse consumer...")

        # Setup connections
        self.setup_clickhouse_client()
        self.setup_kafka_consumer()

        logger.info(f"Consuming messages from topic: {KAFKA_TOPIC}")
        logger.info(f"Batch size: {BATCH_SIZE}, Timeout: {BATCH_TIMEOUT}s")
        logger.info("Press Ctrl+C to stop")

        failed = False
        try:
            message_count = 0
            while self.running:
                polled = self.consumer.poll(timeout_ms=POLL_TIMEOUT_MS, max_records=BATCH_SIZE)
                if not polled:
                    if self.batch and (time.time() - self.last_insert_time) >= BATCH_TIMEOUT:
                        if not self.insert_batch():
                            logger.error("Stopping consumer to avoid advancing past failed ClickHouse batch")
                            failed = True
                            break
                    continue

                for messages in polled.values():
                    for message in messages:
                        if not self.running:
                            break
                        if not self.process_message(message):
                            logger.error("Stopping consumer to avoid advancing past failed ClickHouse batch")
                            failed = True
                            self.running = False
                            break
                        message_count += 1

                        if message_count % 100 == 0:
                            logger.info(f"Processed {message_count} messages")
                    if not self.running:
                        break

        except KeyboardInterrupt:
            logger.info("Received shutdown signal")
        finally:
            shutdown_ok = self.shutdown()
        return not failed and shutdown_ok

    def shutdown(self) -> bool:
        """Graceful shutdown"""
        logger.info("Shutting down consumer...")
        self.running = False
        ok = True

        # Insert remaining batch
        if self.batch:
            logger.info("Inserting remaining batch...")
            if not self.insert_batch():
                logger.error("Shutdown left Kafka offsets uncommitted for retained failed batch")
                ok = False

        # Close connections
        if self.consumer:
            self.consumer.close()
            logger.info("✓ Kafka consumer closed")

        if self.clickhouse_client:
            self.clickhouse_client.disconnect()
            logger.info("✓ ClickHouse client disconnected")

        logger.info("Consumer stopped")
        return ok

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {signum}")
    sys.exit(0)

if __name__ == '__main__':
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Run consumer
    consumer = KafkaClickHouseConsumer()
    if not consumer.run():
        sys.exit(1)
