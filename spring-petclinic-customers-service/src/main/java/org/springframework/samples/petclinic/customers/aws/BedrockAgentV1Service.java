// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.customers.aws;

import com.amazonaws.auth.WebIdentityTokenCredentialsProvider;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.bedrockagent.AWSBedrockAgent;
import com.amazonaws.services.bedrockagent.AWSBedrockAgentClientBuilder;
import com.amazonaws.services.bedrockagent.model.*;
import org.springframework.stereotype.Component;
import java.util.List;
@Component
public class BedrockAgentV1Service {
    final AWSBedrockAgent bedrockAgentV1Client;

    public BedrockAgentV1Service() {
        // AWS web identity is set for EKS clusters, if these are not set then use default credentials
        if (System.getenv("AWS_WEB_IDENTITY_TOKEN_FILE") == null && System.getProperty("aws.webIdentityTokenFile") == null) {
            bedrockAgentV1Client = AWSBedrockAgentClientBuilder.standard()
                .withRegion(Regions.US_EAST_1) // replace with your desired region
                .build();
        }
        else {
            bedrockAgentV1Client = AWSBedrockAgentClientBuilder.standard()
                .withRegion(Regions.US_EAST_1) // replace with your desired region
                .withCredentials(WebIdentityTokenCredentialsProvider.create())
                .build();
        }
    }

    public String getKnowledgeBase() {
        try {
            ListKnowledgeBasesRequest listRequest = new ListKnowledgeBasesRequest();
            ListKnowledgeBasesResult listResponse = bedrockAgentV1Client.listKnowledgeBases(listRequest);
            List<KnowledgeBaseSummary> summaries =listResponse.getKnowledgeBaseSummaries();
            if(summaries != null && summaries.size() > 0 ) {
                String knowledgeBaseId = summaries.get(0).getKnowledgeBaseId();
                System.out.printf("GetKnowledgeBaseRequest: " + knowledgeBaseId);
                GetKnowledgeBaseRequest request = new GetKnowledgeBaseRequest()
                        .withKnowledgeBaseId(knowledgeBaseId);
                GetKnowledgeBaseResult response = bedrockAgentV1Client.getKnowledgeBase(request);
                System.out.printf("KnowledgeBase ID: " + response.getKnowledgeBase().getName());
                return response.getKnowledgeBase().getName();
            } else {
                return "no knowledge base summaries found";
            }
        } catch (Exception e) {
            System.out.printf("Failed to GetKnowledgeBaseRequest. Error: %s%n", e.getMessage());
            throw e;
        }
    }

}
