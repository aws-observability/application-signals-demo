// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.customers.aws;

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

    public String invokeAnthropicClaude() {
        try {
            System.out.printf("Invoke Anthropic claude: ");
            String claudeModelId = "anthropic.claude-3-sonnet-20240229-v1:0";
            String prompt = "What's the common disease for a pet?";
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
            System.out.printf("Anthropic claude Model with modelId: " + claudeModelId + " prompt: " + prompt + "max_gen_len: 1000 temperature: 0.5 top_p: 0.9");

            InvokeModelRequest request = InvokeModelRequest.builder()
                    .body(SdkBytes.fromUtf8String(payload))
                    .modelId(claudeModelId)
                    .contentType("application/json")
                    .accept("application/json")
                    .build();
            System.out.println("Anthropic claude request:" + request.body().asUtf8String());

            InvokeModelResponse response = bedrockRuntimeV2Client.invokeModel(request);

            JSONObject responseBody = new JSONObject(response.body().asUtf8String());
            System.out.println("invokeLlama2 response:" + response.body().asUtf8String());
            String generatedText = responseBody.getString("generation");
            int promptTokenCount = responseBody.getInt("prompt_token_count");
            int generationTokenCount = responseBody.getInt("generation_token_count");
            String stopReason = responseBody.getString("stop_reason");
            System.out.printf("Invoke claude Model response: prompt_token_count: " + promptTokenCount + " generation_token_count: " + generationTokenCount + " stop_reason: " + stopReason);
            return generatedText;
        } catch (Exception e) {
            System.out.printf("Failed to invoke Anthropic claude: Error: %s%n",e.getMessage());
            throw e;
        }
    }
}
