package org.springframework.samples.petclinic.customers.aws;

import com.amazonaws.auth.WebIdentityTokenCredentialsProvider;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.bedrock.AmazonBedrock;
import com.amazonaws.services.bedrock.AmazonBedrockClientBuilder;
import com.amazonaws.services.bedrock.model.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.samples.petclinic.customers.Util;
import org.springframework.stereotype.Component;
import org.springframework.samples.petclinic.customers.Util;
import java.util.List;

@Component
@Slf4j
public class BedrockV1Service {
    final AmazonBedrock bedrockV1Client;

    public BedrockV1Service() {
        // AWS web identity is set for EKS clusters, if these are not set then use default credentials
        if (System.getenv("REGION_FROM_ECS") != null) {
            String regionName = System.getenv("REGION_FROM_ECS");
            bedrockV1Client = AmazonBedrockClientBuilder.standard()
                            .withRegion(regionName)
                            .build();
        } else if (System.getenv("AWS_WEB_IDENTITY_TOKEN_FILE") == null && System.getProperty("aws.webIdentityTokenFile") == null) {
            bedrockV1Client = AmazonBedrockClientBuilder.standard()
                    .withRegion(Util.REGION_FROM_EC2)
                    .build();
        }
        else {
            bedrockV1Client = AmazonBedrockClientBuilder.standard()
                    .withRegion(Util.REGION_FROM_EKS)
                    .withCredentials(WebIdentityTokenCredentialsProvider.create())
                    .build();
        }
    }

    public String getGuardrail() {
        String responseString = "No guardrail found";
        try {
            ListGuardrailsRequest listRequest = new ListGuardrailsRequest();
            ListGuardrailsResult listResponse = bedrockV1Client.listGuardrails(listRequest);
            List<GuardrailSummary> guardrails = listResponse.getGuardrails();
            if(guardrails != null && guardrails.size() > 0) {
                String guardRailId = guardrails.get(0).getId();
                log.info("ListGuardrailsResult: " + guardRailId);

                GetGuardrailRequest request = new GetGuardrailRequest()
                        .withGuardrailIdentifier(guardRailId);
                GetGuardrailResult response = bedrockV1Client.getGuardrail(request);
                responseString = response.toString();
            }
        } catch (Exception e) {
            log.error("Failed to GetGuardrailRequest. Error: %s", e.getMessage());
            throw e;
        }
        return "Guardrail ID: " + responseString;
    }
}
