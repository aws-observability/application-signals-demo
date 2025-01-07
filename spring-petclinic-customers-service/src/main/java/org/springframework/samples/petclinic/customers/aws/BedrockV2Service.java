package org.springframework.samples.petclinic.customers.aws;

import lombok.extern.slf4j.Slf4j;
import org.springframework.samples.petclinic.customers.Util;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.WebIdentityTokenFileCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrock.BedrockClient;
import software.amazon.awssdk.services.bedrock.model.*;

@Component
@Slf4j
public class BedrockV2Service {
    final BedrockClient bedrockV2Client;

    public BedrockV2Service() {
        // AWS web identity is set for EKS clusters, if these are not set then use default credentials
        if (System.getenv("AWS_WEB_IDENTITY_TOKEN_FILE") == null && System.getProperty("aws.webIdentityTokenFile") == null) {
            bedrockV2Client = BedrockClient.builder()
                    .region(Region.of(Util.REGION_FROM_EC2))
                    .build();
        }
        else {
            bedrockV2Client = BedrockClient.builder()
                    .region(Region.of(Util.REGION_FROM_EKS))
                    .credentialsProvider(WebIdentityTokenFileCredentialsProvider.create())
                    .build();
        }
    }
    public String getGuardrail() {
        String id = "";
        try {
            ListGuardrailsRequest listRequest =ListGuardrailsRequest.builder().build();
            ListGuardrailsResponse listResponse = bedrockV2Client.listGuardrails(listRequest);
            if(listResponse.hasGuardrails()) {
                String guardRailId = listResponse.guardrails().get(0).id();
                log.info("ListGuardrailsRequest: " + guardRailId);

                GetGuardrailRequest request = GetGuardrailRequest.builder()
                        .guardrailIdentifier(guardRailId).build();
                GetGuardrailResponse response = bedrockV2Client.getGuardrail(request);
                return response.guardrailId();
            } else {
                return "";
            }
        } catch (Exception e) {
            log.error("Failed to GetGuardrailRequest. Error: %s", e.getMessage());
            throw e;
        }
    }
}
