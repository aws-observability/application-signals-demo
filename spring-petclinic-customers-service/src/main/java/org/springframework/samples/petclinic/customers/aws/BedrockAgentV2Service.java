// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.customers.aws;

import lombok.extern.slf4j.Slf4j;
import org.springframework.samples.petclinic.customers.Util;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.WebIdentityTokenFileCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockagent.BedrockAgentClient;
import software.amazon.awssdk.services.bedrockagent.model.*;

@Component
@Slf4j
public class BedrockAgentV2Service {
    final BedrockAgentClient bedrockAgentV2Client;

    public BedrockAgentV2Service() {
        // AWS web identity is set for EKS clusters, if these are not set then use default credentials
        if (System.getenv("AWS_WEB_IDENTITY_TOKEN_FILE") == null && System.getProperty("aws.webIdentityTokenFile") == null) {
            bedrockAgentV2Client = BedrockAgentClient.builder()
                    .region(Region.of(Util.REGION_FROM_EC2))
                    .build();
        }
        else {
            bedrockAgentV2Client = BedrockAgentClient.builder()
                    .region(Region.of(Util.REGION_FROM_EKS))
                    .credentialsProvider(WebIdentityTokenFileCredentialsProvider.create())
                    .build();
        }

    }

    public String bedrockAgentGetKnowledgeBaseV2() {
        try {
            ListKnowledgeBasesRequest listRequest = ListKnowledgeBasesRequest.builder().build();
            ListKnowledgeBasesResponse listResponse = bedrockAgentV2Client.listKnowledgeBases(listRequest);
            if(listResponse.hasKnowledgeBaseSummaries()) {
                String knowledgeBaseId = listResponse.knowledgeBaseSummaries().get(0).knowledgeBaseId();
                System.out.printf("GetKnowledgeBaseRequest: " + knowledgeBaseId);
                GetKnowledgeBaseRequest request = GetKnowledgeBaseRequest.builder()
                        .knowledgeBaseId(knowledgeBaseId).build();
                GetKnowledgeBaseResponse response = bedrockAgentV2Client.getKnowledgeBase(request);
                System.out.printf("KnowledgeBase ID: " + response.knowledgeBase().knowledgeBaseId());
                return response.knowledgeBase().knowledgeBaseId();
            } else {
                return "";
            }
        } catch (Exception e) {
            System.out.printf("Failed to GetKnowledgeBaseRequest! Error: %s%n", e.getMessage());
            throw e;
        }
    }
}
