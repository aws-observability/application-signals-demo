// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.customers.aws;

import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.samples.petclinic.customers.Util;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.WebIdentityTokenFileCredentialsProvider;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.*;

@Component
@Slf4j
public class BedrockRuntimeV2Service {
    final BedrockRuntimeClient bedrockRuntimeV2Client;

    public BedrockRuntimeV2Service() {
        // AWS web identity is set for EKS clusters, if these are not set then use default credentials
        if (System.getenv("AWS_WEB_IDENTITY_TOKEN_FILE") == null && System.getProperty("aws.webIdentityTokenFile") == null) {
            bedrockRuntimeV2Client = BedrockRuntimeClient.builder()
                    .region(Region.of(Util.REGION_FROM_EC2))
                    .build();
        }
        else {
            bedrockRuntimeV2Client = BedrockRuntimeClient.builder()
                    .region(Region.of(Util.REGION_FROM_EKS))
                    .credentialsProvider(WebIdentityTokenFileCredentialsProvider.create())
                    .build();
        }

    }

    public String invokeAnthropicClaude(String petType) {
        try {
            String claudeModelId = "anthropic.claude-v2:1";
            String prompt = String.format("What are the best preventive measures for common %s diseases?", petType);
            JSONObject userMessage = new JSONObject()
                    .put("role", "user")
                    .put("content", "Pet diagnose content");
            JSONArray messages = new JSONArray()
                    .put(userMessage);

            String payload = new JSONObject()
                    .put("anthropic_version", "bedrock-2023-05-31")
                    .put("messages", messages)
                    .put("system", prompt)
                    .put("max_tokens", 1000)
                    .put("temperature", 0.5)
                    .put("top_p", 0.9)
                    .toString();

            InvokeModelRequest request = InvokeModelRequest.builder()
                    .body(SdkBytes.fromUtf8String(payload))
                    .modelId(claudeModelId)
                    .contentType("application/json")
                    .accept("application/json")
                    .build();

            InvokeModelResponse response = bedrockRuntimeV2Client.invokeModel(request);

            JSONObject responseBody = new JSONObject(response.body().asUtf8String());

            int promptTokenCount = 0;
            int generationTokenCount = 0;
            if (responseBody.has("usage")) {
                JSONObject usage = responseBody.getJSONObject("usage");
                promptTokenCount = usage.getInt("input_tokens");
                generationTokenCount = usage.getInt("output_tokens");
            }
            String generatedText = "";
            if (responseBody.has("content")) {
                JSONArray content = responseBody.getJSONArray("content");
                if (content.length() > 0) {
                    JSONObject firstContent = content.getJSONObject(0);
                    if (firstContent.has("text")) {
                        generatedText = firstContent.getString("text");
                    }
                }

            }
            String stopReason = responseBody.getString("stop_reason");
            log.info(
                    "Invoke Claude Model response: " +
                            "{ " +
                            "\"modelId\": \"" + claudeModelId + "\", " +
                            "\"prompt_token_count\": " + promptTokenCount + ", " +
                            "\"generation_token_count\": " + generationTokenCount + ", " +
                            "\"prompt\": \"" + prompt + "\", " +
                            "\"generated_text\": \"" + generatedText.replace("\n", " ") + "\", " +
                            "\"max_gen_len\": 1000, " +
                            "\"temperature\": 0.5, " +
                            "\"top_p\": 0.9, " +
                            "\"stop_reason\": \"" + stopReason + "\" " +
                            " }");

            return generatedText;
        } catch (Exception e) {
            log.error("Failed to invoke Anthropic claude: Error: %s%n ",e.getMessage());
            throw e;
        }
    }

}
