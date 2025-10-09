package kr.rojae.waf.dashboard.service;

import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.Configuration;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.*;
import io.kubernetes.client.util.Config;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Kubernetes Service for managing ConfigMaps and Deployments
 * Handles custom rule deployment and rolling updates
 */
@Service
@Slf4j
public class KubernetesService {

    @Value("${kubernetes.namespace:waf-system}")
    private String namespace;

    @Value("${kubernetes.configmap.name:modsecurity-custom-rules}")
    private String customRulesConfigMapName;

    @Value("${kubernetes.deployment.name:nginx-waf}")
    private String nginxDeploymentName;

    @Value("${kubernetes.rollout.timeout.minutes:5}")
    private int rolloutTimeoutMinutes;

    private ApiClient apiClient;
    private CoreV1Api coreV1Api;
    private AppsV1Api appsV1Api;

    @PostConstruct
    public void init() {
        try {
            // Initialize Kubernetes client
            this.apiClient = Config.defaultClient();
            Configuration.setDefaultApiClient(apiClient);

            this.coreV1Api = new CoreV1Api(apiClient);
            this.appsV1Api = new AppsV1Api(apiClient);

            log.info("Kubernetes client initialized successfully");
            log.info("Target namespace: {}", namespace);
            log.info("Custom rules ConfigMap: {}", customRulesConfigMapName);
            log.info("Nginx deployment: {}", nginxDeploymentName);

        } catch (Exception e) {
            log.error("Failed to initialize Kubernetes client", e);
            throw new RuntimeException("Kubernetes client initialization failed", e);
        }
    }

    /**
     * Update or create custom rules ConfigMap
     */
    public void updateCustomRulesConfigMap(String rulesContent, String deploymentId) throws ApiException {
        log.info("Updating custom rules ConfigMap: {} in namespace: {}", customRulesConfigMapName, namespace);

        try {
            // Check if ConfigMap exists
            V1ConfigMap existingConfigMap = null;
            try {
                existingConfigMap = coreV1Api.readNamespacedConfigMap(customRulesConfigMapName, namespace, null);
                log.info("Found existing ConfigMap: {}", customRulesConfigMapName);
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    log.info("ConfigMap does not exist, will create new one");
                } else {
                    throw e;
                }
            }

            V1ConfigMap configMap = createCustomRulesConfigMap(rulesContent, deploymentId);

            if (existingConfigMap != null) {
                // Update existing ConfigMap
                coreV1Api.replaceNamespacedConfigMap(customRulesConfigMapName, namespace, configMap, null, null, null, null);
                log.info("Successfully updated ConfigMap: {}", customRulesConfigMapName);
            } else {
                // Create new ConfigMap
                coreV1Api.createNamespacedConfigMap(namespace, configMap, null, null, null, null);
                log.info("Successfully created ConfigMap: {}", customRulesConfigMapName);
            }

        } catch (ApiException e) {
            log.error("Failed to update ConfigMap: {} - Code: {}, Message: {}",
                    customRulesConfigMapName, e.getCode(), e.getResponseBody());
            throw e;
        }
    }

    /**
     * Trigger rolling update for Nginx deployment
     */
    public void rolloutNginxDeployment() throws ApiException {
        log.info("Triggering rolling update for deployment: {} in namespace: {}", nginxDeploymentName, namespace);

        try {
            // Get current deployment
            V1Deployment deployment = appsV1Api.readNamespacedDeployment(nginxDeploymentName, namespace, null);

            // Add/update annotation to trigger rollout
            V1ObjectMeta metadata = deployment.getSpec().getTemplate().getMetadata();
            if (metadata == null) {
                metadata = new V1ObjectMeta();
                deployment.getSpec().getTemplate().setMetadata(metadata);
            }

            Map<String, String> annotations = metadata.getAnnotations();
            if (annotations == null) {
                annotations = new java.util.HashMap<>();
                metadata.setAnnotations(annotations);
            }

            // Update rollout annotation to trigger deployment
            annotations.put("waf.rojae.kr/rules-updated", LocalDateTime.now().toString());
            annotations.put("waf.rojae.kr/last-rollout", String.valueOf(System.currentTimeMillis()));

            // Patch the deployment
            appsV1Api.replaceNamespacedDeployment(nginxDeploymentName, namespace, deployment, null, null, null, null);

            log.info("Successfully triggered rolling update for deployment: {}", nginxDeploymentName);

            // Monitor rollout status
            monitorRolloutStatus();

        } catch (ApiException e) {
            log.error("Failed to trigger rolling update for deployment: {} - Code: {}, Message: {}",
                    nginxDeploymentName, e.getCode(), e.getResponseBody());
            throw e;
        }
    }

    /**
     * Monitor deployment rollout status
     */
    public void monitorRolloutStatus() {
        log.info("Monitoring rollout status for deployment: {}", nginxDeploymentName);

        try {
            int maxAttempts = rolloutTimeoutMinutes * 60 / 10; // Check every 10 seconds
            int attempts = 0;

            while (attempts < maxAttempts) {
                V1Deployment deployment = appsV1Api.readNamespacedDeployment(nginxDeploymentName, namespace, null);
                V1DeploymentStatus status = deployment.getStatus();

                if (status != null) {
                    Integer readyReplicas = status.getReadyReplicas();
                    Integer replicas = status.getReplicas();
                    Integer updatedReplicas = status.getUpdatedReplicas();

                    log.debug("Deployment status - Ready: {}, Total: {}, Updated: {}",
                            readyReplicas, replicas, updatedReplicas);

                    // Check if rollout is complete
                    if (readyReplicas != null && replicas != null && updatedReplicas != null &&
                        readyReplicas.equals(replicas) && updatedReplicas.equals(replicas)) {

                        log.info("Rolling update completed successfully for deployment: {}", nginxDeploymentName);
                        return;
                    }
                }

                // Wait before next check
                Thread.sleep(10000); // 10 seconds
                attempts++;
            }

            log.warn("Rolling update monitoring timed out after {} minutes", rolloutTimeoutMinutes);

        } catch (Exception e) {
            log.error("Error monitoring rollout status", e);
        }
    }

    /**
     * Get deployment status
     */
    public Map<String, Object> getDeploymentStatus() throws ApiException {
        try {
            V1Deployment deployment = appsV1Api.readNamespacedDeployment(nginxDeploymentName, namespace, null);
            V1DeploymentStatus status = deployment.getStatus();

            if (status == null) {
                return Map.of("status", "unknown");
            }

            return Map.of(
                "replicas", status.getReplicas() != null ? status.getReplicas() : 0,
                "readyReplicas", status.getReadyReplicas() != null ? status.getReadyReplicas() : 0,
                "updatedReplicas", status.getUpdatedReplicas() != null ? status.getUpdatedReplicas() : 0,
                "unavailableReplicas", status.getUnavailableReplicas() != null ? status.getUnavailableReplicas() : 0,
                "observedGeneration", status.getObservedGeneration() != null ? status.getObservedGeneration() : 0,
                "conditions", status.getConditions()
            );

        } catch (ApiException e) {
            log.error("Failed to get deployment status", e);
            throw e;
        }
    }

    /**
     * Check if ConfigMap exists
     */
    public boolean configMapExists() {
        try {
            coreV1Api.readNamespacedConfigMap(customRulesConfigMapName, namespace, null);
            return true;
        } catch (ApiException e) {
            return e.getCode() != 404;
        }
    }

    /**
     * Get current ConfigMap content
     */
    public String getCurrentRulesContent() throws ApiException {
        try {
            V1ConfigMap configMap = coreV1Api.readNamespacedConfigMap(customRulesConfigMapName, namespace, null);
            return configMap.getData() != null ? configMap.getData().get("custom-rules.conf") : "";
        } catch (ApiException e) {
            if (e.getCode() == 404) {
                return "";
            }
            throw e;
        }
    }

    /**
     * Create custom rules ConfigMap
     */
    private V1ConfigMap createCustomRulesConfigMap(String rulesContent, String deploymentId) {
        V1ConfigMap configMap = new V1ConfigMap();

        // Metadata
        V1ObjectMeta metadata = new V1ObjectMeta();
        metadata.setName(customRulesConfigMapName);
        metadata.setNamespace(namespace);

        // Add labels for identification
        metadata.setLabels(Map.of(
            "app", "waf",
            "component", "custom-rules",
            "managed-by", "waf-dashboard"
        ));

        // Add annotations for tracking
        metadata.setAnnotations(Map.of(
            "waf.rojae.kr/deployment-id", deploymentId,
            "waf.rojae.kr/updated-at", LocalDateTime.now().toString(),
            "waf.rojae.kr/rules-count", String.valueOf(countRules(rulesContent))
        ));

        configMap.setMetadata(metadata);

        // Data
        Map<String, String> data = Map.of(
            "custom-rules.conf", rulesContent
        );
        configMap.setData(data);

        return configMap;
    }

    /**
     * Count the number of rules in content
     */
    private int countRules(String rulesContent) {
        if (rulesContent == null || rulesContent.trim().isEmpty()) {
            return 0;
        }

        // Count occurrences of "SecRule" (case insensitive)
        String[] lines = rulesContent.split("\n");
        int count = 0;
        for (String line : lines) {
            if (line.trim().toLowerCase().startsWith("secrule")) {
                count++;
            }
        }
        return count;
    }

    /**
     * Validate Kubernetes connection
     */
    public boolean isKubernetesAvailable() {
        try {
            // Try to list namespaces as a connectivity test
            coreV1Api.listNamespace(null, null, null, null, null, null, null, null, null, null);
            return true;
        } catch (Exception e) {
            log.warn("Kubernetes is not available: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Get cluster information
     */
    public Map<String, Object> getClusterInfo() {
        try {
            // Get basic cluster information
            return Map.of(
                "connected", isKubernetesAvailable(),
                "namespace", namespace,
                "configMapName", customRulesConfigMapName,
                "deploymentName", nginxDeploymentName,
                "configMapExists", configMapExists()
            );
        } catch (Exception e) {
            return Map.of(
                "connected", false,
                "error", e.getMessage()
            );
        }
    }
}