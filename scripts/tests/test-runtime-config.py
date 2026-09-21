#!/usr/bin/env python3
"""Static runtime contract checks for local compose and Kubernetes manifests."""

from __future__ import annotations

import re
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


def assert_contains(text: str, needle: str, context: str) -> None:
    if needle not in text:
        fail(f"{context}: missing {needle!r}")


def assert_not_contains(text: str, needle: str, context: str) -> None:
    if needle in text:
        fail(f"{context}: unexpected {needle!r}")


def document_blocks(manifest: str) -> list[str]:
    return [block for block in re.split(r"^---\s*$", manifest, flags=re.MULTILINE) if block.strip()]


def metadata_value(block: str, field: str) -> str | None:
    match = re.search(rf"^\s*{re.escape(field)}:\s*([^\n#]+)", block, flags=re.MULTILINE)
    return match.group(1).strip().strip('"') if match else None


def configmap_namespaces(manifest_paths: list[str]) -> set[tuple[str, str]]:
    result: set[tuple[str, str]] = set()
    for path in manifest_paths:
        for block in document_blocks(read(path)):
            if not re.search(r"^kind:\s*ConfigMap\s*$", block, flags=re.MULTILINE):
                continue
            name = metadata_value(block, "name")
            namespace = metadata_value(block, "namespace") or "default"
            if name:
                result.add((namespace, name))
    return result


def secret_namespaces(manifest_paths: list[str]) -> set[tuple[str, str]]:
    result: set[tuple[str, str]] = set()
    for path in manifest_paths:
        for block in document_blocks(read(path)):
            if not re.search(r"^kind:\s*Secret\s*$", block, flags=re.MULTILINE):
                continue
            name = metadata_value(block, "name")
            namespace = metadata_value(block, "namespace") or "default"
            if name:
                result.add((namespace, name))
    return result


def pod_namespaces_and_refs(manifest_paths: list[str], ref_kind: str) -> list[tuple[str, str, str]]:
    refs: list[tuple[str, str, str]] = []
    for path in manifest_paths:
        for block in document_blocks(read(path)):
            if not re.search(r"^kind:\s*(Deployment|StatefulSet|DaemonSet|Job|CronJob)\s*$", block, flags=re.MULTILINE):
                continue
            namespace = metadata_value(block, "namespace") or "default"
            for name in re.findall(rf"{ref_kind}(?:KeyRef)?:\n(?:\s+[^\n]*\n)*?\s+name:\s*([A-Za-z0-9_.-]+)", block):
                refs.append((path, namespace, name))
    return refs



def container_block(manifest: str, container_name: str) -> str:
    match = re.search(rf"      - name: {re.escape(container_name)}\n.*?(?=\n      - name: |\n---\n|\Z)", manifest, flags=re.S)
    if not match:
        fail(f"container block not found: {container_name}")
    return match.group(0)

def env_names(block: str) -> list[str]:
    return re.findall(r"^        - name: ([A-Z0-9_]+)\s*$", block, flags=re.MULTILINE)

def rendered_configmaps_only() -> str:
    env = os.environ.copy()
    env.update(
        {
            "DOMAIN": "http://localhost:3001",
            "COOKIE_DOMAIN": "localhost",
            "COOKIE_SECURE": "false",
            "GOOGLE_OAUTH_REDIRECT_URI": "http://localhost:3001/login/oauth2/code/google",
            "OAUTH_CALLBACK_BASE_URL": "http://localhost:3001",
            "OAUTH_DEFAULT_REDIRECT_URL": "http://localhost:3001",
            "INFLUXDB_TOKEN": "test-influx-token",
            "INFLUXDB_ADMIN_PASSWORD": "test-influx-admin-password",
            "INFLUXDB_ORG": "waf-org",
            "INFLUXDB_BUCKET": "waf-realtime",
            "CLICKHOUSE_PASSWORD": "test-clickhouse-password",
            "GOOGLE_CLIENT_ID": "test-google-client-id",
            "GOOGLE_CLIENT_SECRET": "test-google-client-secret",
            "JWT_SECRET": "test-jwt-secret-with-at-least-32-bytes",
            "NEXTAUTH_SECRET": "test-nextauth-secret-with-at-least-32-bytes",
        }
    )
    result = subprocess.run(
        [
            "envsubst",
            "${DOMAIN} ${COOKIE_DOMAIN} ${COOKIE_SECURE} ${GOOGLE_OAUTH_REDIRECT_URI} ${OAUTH_CALLBACK_BASE_URL} ${OAUTH_DEFAULT_REDIRECT_URL} ${INFLUXDB_TOKEN} ${INFLUXDB_ORG} ${INFLUXDB_BUCKET} ${INFLUXDB_ADMIN_PASSWORD} ${GOOGLE_CLIENT_ID} ${GOOGLE_CLIENT_SECRET} ${JWT_SECRET} ${NEXTAUTH_SECRET} ${CLICKHOUSE_PASSWORD}",
        ],
        cwd=ROOT,
        env=env,
        input=read("k8s/02-configmaps-only.yaml"),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        fail(f"envsubst render failed: {result.stderr.strip()}")
    return result.stdout


def test_compose_contracts() -> None:
    compose = read("docker-compose.yml")
    override = read("docker-compose.override.yml")
    assert_contains(compose, "context: ./nginx", "docker-compose nginx build")
    assert_contains(compose, "dockerfile: Dockerfile", "docker-compose nginx build")
    assert_not_contains(compose, "build: .\n", "docker-compose nginx build")
    assert_contains(override, "context: ./backend", "dashboard build")
    assert_contains(override, "target: dashboard-api", "dashboard build")
    assert_contains(override, "target: social-api", "social build")
    assert_contains(override, "JWT_SECRET=${JWT_SECRET", "shared auth secret")
    assert_contains(override, "CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS:-http://localhost:3001}", "compose CORS origin")
    assert_contains(override, "COOKIE_SECURE=${COOKIE_SECURE:-false}", "compose cookie secure")
    assert_contains(override, "WAF_MANAGEMENT_STORE=/app/data/management.json", "dashboard management store")
    assert_contains(override, "waf-management-data:/app/data", "dashboard management volume")
    backend_dockerfile = read("backend/Dockerfile")
    assert_contains(backend_dockerfile, "mkdir -p /app/custom-rules /app/modsecurity-rules /app/data", "dashboard data dir image path")
    assert_contains(backend_dockerfile, "addgroup -g 10001 -S spring", "stable spring gid")
    assert_contains(backend_dockerfile, "adduser -u 10001 -S spring -G spring spring", "stable spring uid")
    assert_contains(backend_dockerfile, "chown -R spring:spring /app", "spring owns app runtime dirs")
    assert_contains(compose, "fluent-bit-state:/var/lib/fluent-bit", "fluent-bit durable state volume")
    assert_contains(compose, "kafka-clickhouse-consumer:", "compose Kafka ClickHouse consumer")
    assert_contains(compose, "context: ./kafka-clickhouse-consumer", "consumer build context")
    assert_contains(compose, "CLICKHOUSE_DATABASE=${CLICKHOUSE_DATABASE:-waf_analytics}", "consumer database env")
    assert_contains(compose, "CLICKHOUSE_PORT=${CLICKHOUSE_PORT:-9000}", "consumer clickhouse port")
    assert_contains(compose, "DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=${INFLUXDB_TOKEN}", "compose InfluxDB setup token")
    assert_contains(compose, "--path.config", "compose Logstash pipeline path")

    env = os.environ.copy()
    env.update(
        {
            "GOOGLE_CLIENT_ID": "test-client-id",
            "GOOGLE_CLIENT_SECRET": "test-client-secret",
            "JWT_SECRET": "test-jwt-secret-with-at-least-32-bytes",
            "NEXTAUTH_SECRET": "test-nextauth-secret-with-at-least-32-bytes",
            "INFLUXDB_TOKEN": "test-influx-token",
            "INFLUXDB_ORG": "waf-org",
            "INFLUXDB_BUCKET": "waf-realtime",
            "INFLUXDB_ADMIN_USERNAME": "admin",
            "INFLUXDB_ADMIN_PASSWORD": "test-password",
            "GRAFANA_ADMIN_USER": "admin",
            "GRAFANA_ADMIN_PASSWORD": "test-password",
            "CLICKHOUSE_DB": "waf_analytics",
            "CLICKHOUSE_USER": "admin",
            "CLICKHOUSE_PASSWORD": "test-password",
            "CLICKHOUSE_DATABASE": "waf_analytics",
            "CLICKHOUSE_PORT": "9000",
            "KAFKA_BOOTSTRAP_SERVERS": "kafka:9092",
            "CORS_ALLOWED_ORIGINS": "http://localhost:3001",
            "COOKIE_SECURE": "false",
        }
    )
    result = subprocess.run(
        ["docker", "compose", "config"],
        cwd=ROOT,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        fail(f"docker compose config failed: {result.stderr.strip()}")
    assert_contains(result.stdout, f"context: {ROOT / 'nginx'}", "compose parser nginx context")
    assert_contains(result.stdout, "target: dashboard-api", "compose parser dashboard target")
    assert_contains(result.stdout, "target: social-api", "compose parser social target")
    assert_contains(result.stdout, "waf-kafka-clickhouse-consumer", "compose parser consumer service")
    assert_contains(result.stdout, f"context: {ROOT / 'kafka-clickhouse-consumer'}", "compose parser consumer context")


def test_startup_contracts() -> None:
    startup = read("k8s-startup.sh")
    assert_contains(startup, "docker build -t waf-dashboard-api:latest -f backend/Dockerfile --target dashboard-api backend", "dashboard image build")
    assert_contains(startup, "docker build -t waf-social-api:latest -f backend/Dockerfile --target social-api backend", "social image build")
    assert_contains(startup, "docker build -t waf-nginx:latest -f nginx/Dockerfile nginx", "nginx image build")
    assert_contains(startup, "docker build -t waf-realtime-processor:latest -f services/realtime-processor/Dockerfile services/realtime-processor", "realtime image build")
    assert_contains(startup, "docker build -t waf-alert-processor:latest -f services/alert-processor/Dockerfile services/alert-processor", "alert image build")
    assert_contains(startup, "docker build -t waf-kafka-clickhouse-consumer:latest -f kafka-clickhouse-consumer/Dockerfile kafka-clickhouse-consumer", "consumer image build")
    assert_contains(startup, "kind load docker-image", "kind image load")
    assert_contains(startup, "minikube image load", "minikube image load")
    assert_contains(startup, "./scripts/generate-k8s-configmaps.sh", "startup generated configmaps")
    assert_contains(startup, "kubectl apply -f k8s/11-kafka-clickhouse-consumer.yaml", "consumer manifest apply")
    assert_contains(startup, "app=clickhouse -n waf-data", "clickhouse readiness before consumer")
    assert_not_contains(startup, "backend/waf-dashboard-api/Dockerfile", "removed dashboard Dockerfile path")
    assert_not_contains(startup, "backend/waf-social-api/Dockerfile", "removed social Dockerfile path")
    assert_not_contains(startup, "kubectl wait --for=condition=ready pod -l app=elasticsearch -n waf-data --timeout=300s || true", "masked elasticsearch readiness")
    assert_not_contains(startup, "print_success \"All pods are ready\"", "unconditional readiness success")



def test_local_startup_contracts() -> None:
    startup = read("startup.sh")
    assert_contains(startup, "compose_up topics-init", "startup topics job")
    assert_contains(startup, "wait_job_success topics-init", "startup topics readiness")
    assert_contains(startup, "compose_up ksqldb-cli-init", "startup ksql job")
    assert_contains(startup, "wait_job_success ksqldb-cli-init", "startup ksql readiness")
    assert_contains(startup, "kafka-clickhouse-consumer", "startup consumer")
    assert_not_contains(startup, "sh ./kafka/ensure-topics.sh", "startup manual topic script")
    assert_not_contains(startup, "sleep 30", "startup fixed core sleep")
    assert_not_contains(startup, "Redis Streams", "startup stale Redis architecture")
    assert_not_contains(startup, "admin/admin", "startup hardcoded Grafana credential")
    assert_not_contains(startup, "Started Successfully", "startup false success banner")

def test_nginx_bypass_contracts() -> None:
    nginx_conf = read("nginx/nginx.conf")
    whitelist = read("nginx/modsecurity/custom-whitelist.conf")
    k8s_nginx = read("k8s/03-nginx-waf.yaml")
    assert_not_contains(nginx_conf, "set_real_ip_from 0.0.0.0/0", "nginx forwarded IP trust")
    assert_not_contains(whitelist, "ctl:ruleEngine=Off", "local whitelist")
    assert_not_contains(k8s_nginx, "ctl:ruleEngine=Off", "k8s whitelist")
    assert_not_contains(k8s_nginx, "@beginsWith /auth/google", "k8s OAuth WAF bypass")



def test_deploy_script_contracts() -> None:
    deploy_all = read("deploy-all.sh")
    restart = read("k8s-restart.sh")
    legacy = read("k8s/02-configmaps-secrets.yaml")
    assert_contains(deploy_all, "./scripts/generate-k8s-configmaps.sh", "deploy-all generated configmaps")
    assert_contains(deploy_all, 'envsubst "$CONFIG_ENVSUBST_VARS" < k8s/02-configmaps-only.yaml', "deploy-all constrained config envsubst")
    assert_contains(deploy_all, "kubectl apply -f k8s/02-configmaps-only.yaml.local", "deploy-all generated config apply")
    assert_contains(deploy_all, "kubectl wait --for=condition=ready pod -l app=clickhouse -n waf-data", "deploy-all clickhouse readiness")
    assert_contains(deploy_all, "kubectl apply -f k8s/11-kafka-clickhouse-consumer.yaml", "deploy-all consumer manifest")
    assert_not_contains(deploy_all, "02-configmaps-secrets.yaml.local", "deploy-all legacy config apply")
    assert_contains(restart, "./scripts/generate-k8s-configmaps.sh", "restart generated configmaps")
    assert_contains(restart, 'envsubst "$CONFIG_ENVSUBST_VARS" < k8s/02-configmaps-only.yaml', "restart constrained config envsubst")
    assert_contains(legacy, "kind: List", "legacy 02 no-op manifest")
    assert_not_contains(legacy, "waf_classifier.lua", "legacy 02 stale classifier")
    assert_not_contains(legacy, "pipeline.conf", "legacy 02 stale logstash")

def test_k8s_config_contracts() -> None:
    manifests = [
        "k8s/02-configmaps-only.yaml",
        "k8s/03-nginx-waf.yaml",
        "k8s/04-data-stores.yaml",
        "k8s/05-processing-services.yaml",
        "k8s/06-applications.yaml",
        "k8s/07-monitoring.yaml",
        "k8s/11-kafka-clickhouse-consumer.yaml",
    ]
    rendered = rendered_configmaps_only()
    assert_contains(rendered, "influxdb-token: \"test-influx-token\"", "rendered InfluxDB secret")
    assert_contains(rendered, "influxdb-admin-password: \"test-influx-admin-password\"", "rendered InfluxDB admin secret")
    assert_contains(rendered, "google-client-id: \"test-google-client-id\"", "rendered auth secret")
    assert_contains(rendered, "clickhouse-password: \"test-clickhouse-password\"", "rendered ClickHouse secret")
    assert_contains(rendered, "processed_timestamp ${HOSTNAME}-${TIMESTAMP}", "preserved Fluent Bit runtime vars")
    assert_contains(rendered, 'BROKER="${BROKER:-kafka.waf-processing.svc.cluster.local:9092}"', "preserved Kafka script vars")

    configmaps = configmap_namespaces(["k8s/02-configmaps-only.yaml", "k8s/03-nginx-waf.yaml", "k8s/07-monitoring.yaml"])
    missing_configmaps = [
        (path, namespace, name)
        for path, namespace, name in pod_namespaces_and_refs(manifests, "configMap")
        if (namespace, name) not in configmaps
        and name != "modsecurity-rules"
    ]
    if missing_configmaps:
        fail(f"k8s ConfigMap refs without same-namespace ConfigMap: {missing_configmaps}")

    secrets = secret_namespaces(["k8s/02-configmaps-only.yaml"])
    if ("waf-system", "waf-auth-secrets") not in secrets:
        fail("generated auth Secret missing from k8s/02-configmaps-only.yaml")
    missing_secrets = [
        (path, namespace, name)
        for path, namespace, name in pod_namespaces_and_refs(manifests, "secret")
        if (namespace, name) not in secrets
    ]
    if missing_secrets:
        fail(f"k8s Secret refs without same-namespace Secret: {missing_secrets}")

    assert_not_contains(read("k8s/03-nginx-waf.yaml"), "hostPath:", "nginx repo config mounts")
    assert_not_contains(read("k8s/04-data-stores.yaml"), "clickhouse/init.sql", "clickhouse repo init mount")
    assert_contains(read("k8s/04-data-stores.yaml"), "configMap:\n          name: clickhouse-initdb", "clickhouse init ConfigMap")
    assert_contains(read("k8s/02-configmaps-only.yaml"), "Generated by scripts/generate-k8s-configmaps.sh", "generated configmaps")
    assert_contains(read("k8s/02-configmaps-only.yaml"), "waf-logs-template.json: |", "generated Logstash template")
    assert_contains(read("k8s/02-configmaps-only.yaml"), "name: logstash-pipeline\n  namespace: waf-system", "generated Logstash namespace")
    assert_contains(read("k8s/03-nginx-waf.yaml"), "mountPath: /var/lib/fluent-bit", "fluent-bit durable state mount")
    assert_contains(read("k8s/07-monitoring.yaml"), "name: logstash-pipeline", "k8s Logstash generated ConfigMap ref")
    assert_contains(read("k8s/07-monitoring.yaml"), "path: waf-logs-template.json", "k8s Logstash template mount")
    assert_not_contains(read("k8s/07-monitoring.yaml"), "waf-logstash-pipeline", "duplicate Logstash ConfigMap")
    assert_not_contains(read("k8s/07-monitoring.yaml"), "pipeline.conf: |", "inline stale Logstash pipeline")
    for block in document_blocks(read("k8s/02-configmaps-only.yaml")):
        if re.search(r"^kind:\s*ConfigMap\s*$", block, flags=re.MULTILINE):
            assert_not_contains(block, "influxdb-token:", "Influx token ConfigMap")
    data_stores = read("k8s/04-data-stores.yaml")
    consumer = read("k8s/11-kafka-clickhouse-consumer.yaml")
    assert_contains(data_stores, "name: waf-influxdb-secrets", "InfluxDB admin password secret ref")
    assert_not_contains(data_stores, "adminpassword", "plaintext data-store password")
    assert_contains(data_stores, "name: waf-clickhouse-secrets", "ClickHouse password secret ref")
    assert_contains(consumer, "image: waf-kafka-clickhouse-consumer:latest", "consumer image")
    assert_contains(consumer, "name: KAFKA_BOOTSTRAP_SERVERS", "consumer kafka env")
    assert_contains(consumer, "value: \"kafka.waf-processing.svc.cluster.local:9092\"", "consumer kafka service")
    assert_contains(consumer, "name: CLICKHOUSE_PORT\n          value: \"9000\"", "consumer clickhouse port")
    assert_contains(consumer, "name: CLICKHOUSE_DATABASE\n          value: \"waf_analytics\"", "consumer clickhouse database")
    assert_contains(consumer, "name: waf-clickhouse-secrets", "consumer ClickHouse secret")
    assert_not_contains(consumer, "adminpassword", "consumer plaintext ClickHouse password")
    apps = read("k8s/06-applications.yaml")
    apps_template = read("k8s/06-applications.yaml.template")
    dashboard = container_block(apps, "waf-dashboard-api")
    social = container_block(apps, "waf-social-api")
    for block, label in [(dashboard, "dashboard"), (social, "social")]:
        names = env_names(block)
        for required in ["JWT_SECRET", "CORS_ALLOWED_ORIGINS", "COOKIE_DOMAIN", "COOKIE_SECURE"]:
            if names.count(required) != 1:
                fail(f"{label} {required} env count expected 1, got {names.count(required)}")
    assert_contains(dashboard, "name: waf-auth-secrets\n              key: jwt-secret", "dashboard JWT secret")
    assert_contains(apps, "WAF_MANAGEMENT_STORE", "dashboard management env")
    assert_contains(apps, "claimName: waf-management-data-pvc", "dashboard management pvc")
    assert_contains(apps, "fsGroup: 10001", "dashboard fsGroup for writable pvc")
    assert_contains(apps, "runAsUser: 10001", "dashboard runAsUser matches image uid")
    assert_contains(apps_template, "fsGroup: 10001", "template dashboard fsGroup")
    assert_contains(apps_template, "name: waf-auth-secrets\n              key: jwt-secret", "template dashboard JWT secret")
    assert_not_contains(apps, "${COOKIE_SECURE", "unrendered cookie secure literal")
    assert_not_contains(apps_template, "${COOKIE_SECURE", "template unrendered cookie secure literal")
    assert_not_contains(apps_template, "hostPath:", "template hostPath drift")
    data_stores = read("k8s/04-data-stores.yaml")
    monitoring = read("k8s/07-monitoring.yaml")
    assert_contains(data_stores, "DOCKER_INFLUXDB_INIT_ADMIN_TOKEN", "k8s InfluxDB setup token")
    assert_contains(monitoring, "--path.config", "k8s Logstash pipeline path")


def main() -> None:
    test_compose_contracts()
    test_startup_contracts()
    test_local_startup_contracts()
    test_nginx_bypass_contracts()
    test_deploy_script_contracts()
    test_k8s_config_contracts()
    print("runtime config contracts passed")


if __name__ == "__main__":
    main()
