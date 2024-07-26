package org.springframework.samples.petclinic.customers.aws;

import com.amazonaws.auth.WebIdentityTokenCredentialsProvider;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.bedrock.AmazonBedrock;
import com.amazonaws.services.bedrock.AmazonBedrockClientBuilder;
import com.amazonaws.services.bedrock.model.*;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
public class BedrockV1Service {
    final AmazonBedrock bedrockV1Client;

    public BedrockV1Service() {
        // AWS web identity is set for EKS clusters, if these are not set then use default credentials
        if (System.getenv("AWS_WEB_IDENTITY_TOKEN_FILE") == null && System.getProperty("aws.webIdentityTokenFile") == null) {
            bedrockV1Client = AmazonBedrockClientBuilder.standard()
                    .withRegion(Regions.US_EAST_1) // replace with your desired region
                    .build();
        }
        else {
            //            BasicAWSCredentials awsCreds = new BasicAWSCredentials("access_key_id", "secret_key_id");
            bedrockV1Client = AmazonBedrockClientBuilder.standard()
                    .withRegion(Regions.US_EAST_1) // replace with your desired region
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
                System.out.printf("ListGuardrailsResult: " + guardRailId);

                GetGuardrailRequest request = new GetGuardrailRequest()
                        .withGuardrailIdentifier(guardRailId);
                GetGuardrailResult response = bedrockV1Client.getGuardrail(request);
                responseString = response.toString();
            }
        } catch (Exception e) {
            System.out.printf("Failed to GetGuardrailRequest. Error: %s%n", e.getMessage());
            throw e;
        }
        return "Guardrail ID: " + responseString;
    }
}
