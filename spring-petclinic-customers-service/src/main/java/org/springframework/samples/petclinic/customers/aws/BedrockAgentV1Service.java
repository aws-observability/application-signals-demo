// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.customers.aws;

import com.amazonaws.auth.WebIdentityTokenCredentialsProvider;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.bedrockagent.AWSBedrockAgent;
import com.amazonaws.services.bedrockagent.AWSBedrockAgentClientBuilder;
import com.amazonaws.services.bedrockagent.model.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.samples.petclinic.customers.Util;
import org.springframework.stereotype.Component;
import java.util.List;
@Component
@Slf4j
public class BedrockAgentV1Service {
    final AWSBedrockAgent bedrockAgentV1Client;

    public BedrockAgentV1Service() {
        // AWS web identity is set for EKS clusters, if these are not set then use default credentials
        if (System.getenv("REGION_FROM_ECS") != null) {
            String regionName = System.getenv("REGION_FROM_ECS");
            bedrockAgentV1Client = AWSBedrockAgentClientBuilder.standard()
                            .withRegion(regionName)
                            .build();
        } else if (System.getenv("AWS_WEB_IDENTITY_TOKEN_FILE") == null && System.getProperty("aws.webIdentityTokenFile") == null) {
            bedrockAgentV1Client = AWSBedrockAgentClientBuilder.standard()
                .withRegion(Util.REGION_FROM_EC2)
                .build();
        }
        else {
            bedrockAgentV1Client = AWSBedrockAgentClientBuilder.standard()
                .withRegion(Util.REGION_FROM_EKS)
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
                log.info("GetKnowledgeBaseRequest: " + knowledgeBaseId);
                GetKnowledgeBaseRequest request = new GetKnowledgeBaseRequest()
                        .withKnowledgeBaseId(knowledgeBaseId);
                GetKnowledgeBaseResult response = bedrockAgentV1Client.getKnowledgeBase(request);
                log.info("KnowledgeBase ID: " + response.getKnowledgeBase().getName());
                return response.getKnowledgeBase().getName();
            } else {
                return "no knowledge base summaries found";
            }
        } catch (Exception e) {
            log.error("Failed to GetKnowledgeBaseRequest. Error: %s", e.getMessage());
            throw e;
        }
    }

}
