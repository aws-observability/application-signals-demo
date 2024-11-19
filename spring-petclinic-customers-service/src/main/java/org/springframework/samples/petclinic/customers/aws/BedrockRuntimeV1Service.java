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
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Component;
import org.springframework.samples.petclinic.customers.Util;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

@Component
public class BedrockRuntimeV1Service {
    final AmazonBedrockRuntime bedrockRuntimeV1Client;

    public BedrockRuntimeV1Service() {
        // AWS web identity is set for EKS clusters, if these are not set then use default credentials
        if (System.getenv("AWS_DEFAULT_REGION") != null) {
            String regionName = System.getenv("AWS_DEFAULT_REGION");
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

    public String invokeTitanModel() {
        try {
            System.out.printf("invokeTitanModel: ");
            String modelId = "amazon.titan-text-express-v1";
            String inputText = "What's the common disease for a pet?";
            float temperature = 0.8f;
            float topP = 0.9f;
            int maxTokenCount = 100;
            System.out.printf("Invoke titan Model with modelId: " + modelId + " inputText: " + inputText + " temperature: " + temperature + " topP: " + topP + " maxTokenCount: " + maxTokenCount);

            JSONObject textGenerationConfig = new JSONObject();
            textGenerationConfig.put("temperature", temperature);
            textGenerationConfig.put("topP", topP);
            textGenerationConfig.put("maxTokenCount", maxTokenCount);

            JSONObject nativeRequestObject = new JSONObject();
            nativeRequestObject.put("inputText", inputText);
            nativeRequestObject.put("textGenerationConfig", textGenerationConfig);

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

            System.out.printf("Invoke titan Model Result: " + result_body);
            JSONObject jsonObject = new JSONObject(result_body);
            int inputTextTokenCount = jsonObject.getInt("inputTextTokenCount");
            JSONArray resultsArray = jsonObject.getJSONArray("results");
            JSONObject firstResult = resultsArray.getJSONObject(0);
            int outputTokenCount = firstResult.getInt("tokenCount");
            String completionReason = firstResult.getString("completionReason");
            System.out.printf("Invoke titan Model Result: inputTextTokenCount: " + inputTextTokenCount + " outputTokenCount: " + outputTokenCount + " completionReason: " + completionReason);
            return "Invoke titan Model Result: " + result_body;
        } catch (Exception e) {
            System.out.printf("Invoke titan Model Result: Error: %s%n", e.getMessage());
            throw e;
        }
    }
}
