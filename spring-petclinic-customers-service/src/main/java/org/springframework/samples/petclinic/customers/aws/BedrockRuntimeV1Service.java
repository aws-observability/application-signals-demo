// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.customers.aws;

import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.auth.WebIdentityTokenCredentialsProvider;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.bedrockruntime.AmazonBedrockRuntime;
import com.amazonaws.services.bedrockruntime.AmazonBedrockRuntimeClientBuilder;
import com.amazonaws.services.bedrockruntime.model.InvokeModelRequest;
import com.amazonaws.services.bedrockruntime.model.InvokeModelResult;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.samples.petclinic.customers.Util;
import org.springframework.stereotype.Component;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

@Component
@Slf4j
public class BedrockRuntimeV1Service {
    final AmazonBedrockRuntime bedrockRuntimeV1Client;

    public BedrockRuntimeV1Service() {
        // AWS web identity is set for EKS clusters, if these are not set then use default credentials
        if (System.getenv("REGION_FROM_ECS") != null) {
            String regionName = System.getenv("REGION_FROM_ECS");
            bedrockRuntimeV1Client = AmazonBedrockRuntimeClientBuilder.standard()
                            .withRegion(regionName)
                            .build();
        } else if (System.getenv("AWS_WEB_IDENTITY_TOKEN_FILE") == null && System.getProperty("aws.webIdentityTokenFile") == null) {
            bedrockRuntimeV1Client = AmazonBedrockRuntimeClientBuilder.standard()
                    .withRegion(Util.REGION_FROM_EC2)
                    .build();
        }
        else {
            bedrockRuntimeV1Client = AmazonBedrockRuntimeClientBuilder.standard()
                    .withRegion(Util.REGION_FROM_EKS)
                    .withCredentials(WebIdentityTokenCredentialsProvider.create())
                    .build();
        }

    }

    public String invokeModel(String petType) {
        try {
            String modelId = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
            String inputText = String.format("What's the common disease for a %s?", petType);
            float temperature = 0.8f;
            int maxTokenCount = 1000;

            JSONObject message = new JSONObject();
            message.put("role", "user");
            message.put("content", inputText);

            JSONObject nativeRequestObject = new JSONObject();
            nativeRequestObject.put("anthropic_version", "bedrock-2023-05-31");
            nativeRequestObject.put("max_tokens", maxTokenCount);
            nativeRequestObject.put("temperature", temperature);
            nativeRequestObject.put("messages", new JSONArray().put(message));

            String nativeRequest = nativeRequestObject.toString();
            ByteBuffer buffer = StandardCharsets.UTF_8.encode(nativeRequest);

            InvokeModelRequest invokeModelRequest = new InvokeModelRequest()
                    .withModelId(modelId)
                    .withBody(buffer);
            InvokeModelResult result = bedrockRuntimeV1Client.invokeModel(invokeModelRequest);

            ByteBuffer resultBodyBuffer = result.getBody().asReadOnlyBuffer();
            byte[] bytes = new byte[resultBodyBuffer.remaining()];
            resultBodyBuffer.get(bytes);
            String result_body = new String(bytes, StandardCharsets.UTF_8);

            JSONObject jsonObject = new JSONObject(result_body);
            JSONObject usage = jsonObject.getJSONObject("usage");
            int inputTextTokenCount = usage.getInt("input_tokens");
            int outputTokenCount = usage.getInt("output_tokens");
            String generatedText = jsonObject.getJSONArray("content").getJSONObject(0).getString("text");
            String completionReason = jsonObject.getString("stop_reason");
            log.info(
                    "Invoke Model Result: " +
                            "{ " +
                            "\"modelId\": \"" + modelId + "\", " +
                            "\"prompt_token_count\": " + inputTextTokenCount + ", " +
                            "\"generation_token_count\": " + outputTokenCount + ", " +
                            "\"prompt\": \"" + inputText + "\", " +
                            "\"generated_text\": \"" + generatedText.replace("\n", " ") + "\", " +
                            "\"stop_reason\": \"" + completionReason + "\", " +
                            "\"temperature\": " + temperature +
                            " }"
            );
            return "Invoke Model Result: " + result_body;
        } catch (Exception e) {
            log.error("Invoke Model Result: Error: %s", e.getMessage());
            throw e;
        }
    }
}
