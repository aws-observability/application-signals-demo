package org.springframework.samples.petclinic.api.boundary.web;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.signer.Aws4Signer;
import software.amazon.awssdk.auth.signer.params.Aws4SignerParams;
import software.amazon.awssdk.http.SdkHttpFullRequest;
import software.amazon.awssdk.http.SdkHttpMethod;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.core.SdkBytes;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/agent")
public class AgentController {

    @Value("${agent.primary.arn:}")
    private String primaryAgentArn;

    @Value("${agent.nutrition.arn:}")
    private String nutritionAgentArn;

    @Value("${aws.region:us-east-1}")
    private String awsRegion;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @PostMapping(value = "/ask", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<Map<String, Object>> askAgent(@RequestBody Map<String, String> request) {
        String query = request.get("query");
        
        if (query == null || query.trim().isEmpty()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Query is required"));
        }

        if (primaryAgentArn == null || primaryAgentArn.isEmpty()) {
            return Mono.error(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Agent ARN not configured"));
        }

        return Mono.fromCallable(() -> invokeAgent(query));
    }

    private Map<String, Object> invokeAgent(String query) throws Exception {
        String sessionId = "pet-clinic-web-session-" + UUID.randomUUID().toString();
        String prompt = query;
        
        if (nutritionAgentArn != null && !nutritionAgentArn.isEmpty()) {
            prompt = query + "\n\nNote: Our nutrition specialist agent ARN is " + nutritionAgentArn;
        }

        String encodedArn = URLEncoder.encode(primaryAgentArn, StandardCharsets.UTF_8);
        String url = String.format("https://bedrock-agentcore.%s.amazonaws.com/runtimes/%s/invocations?qualifier=DEFAULT",
                awsRegion, encodedArn);

        String payload = String.format("{\"prompt\": \"%s\"}", prompt.replace("\"", "\\\""));

        // Sign the request with AWS SigV4
        SdkHttpFullRequest httpRequest = SdkHttpFullRequest.builder()
                .uri(URI.create(url))
                .method(SdkHttpMethod.POST)
                .putHeader("Content-Type", "application/json")
                .putHeader("X-Amzn-Bedrock-AgentCore-Runtime-Session-Id", sessionId)
                .contentStreamProvider(() -> SdkBytes.fromUtf8String(payload).asInputStream())
                .build();

        Aws4SignerParams signerParams = Aws4SignerParams.builder()
                .awsCredentials(DefaultCredentialsProvider.create().resolveCredentials())
                .signingName("bedrock-agentcore")
                .signingRegion(Region.of(awsRegion))
                .build();

        SdkHttpFullRequest signedRequest = Aws4Signer.create().sign(httpRequest, signerParams);

        // Build HTTP request
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .POST(HttpRequest.BodyPublishers.ofString(payload));

        signedRequest.headers().forEach((key, values) -> 
            values.forEach(value -> requestBuilder.header(key, value))
        );

        HttpResponse<String> response = httpClient.send(requestBuilder.build(), 
                HttpResponse.BodyHandlers.ofString());

        return Map.of(
                "query", query,
                "response", response.body(),
                "sessionId", sessionId
        );
    }
}
