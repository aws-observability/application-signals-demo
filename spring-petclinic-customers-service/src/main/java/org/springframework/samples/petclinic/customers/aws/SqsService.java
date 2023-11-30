// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.customers.aws;

import org.springframework.samples.petclinic.customers.Util;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.WebIdentityTokenFileCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.CreateQueueRequest;
import software.amazon.awssdk.services.sqs.model.CreateQueueResponse;
import software.amazon.awssdk.services.sqs.model.GetQueueUrlRequest;
import software.amazon.awssdk.services.sqs.model.PurgeQueueRequest;
import software.amazon.awssdk.services.sqs.model.SendMessageRequest;
import software.amazon.awssdk.services.sqs.model.SqsException;

@Component
public class SqsService {
    private static final String QUEUE_NAME = "apm_test";
    final SqsClient sqs;

    public SqsService() {
        // AWS web identity is set for EKS clusters, if these are not set then use default credentials
        if (System.getenv("AWS_WEB_IDENTITY_TOKEN_FILE") == null && System.getProperty("aws.webIdentityTokenFile") == null) {
            sqs = SqsClient.builder()
                .region(Region.of(Util.REGION_FROM_EC2))
                .build();
        }
        else {
            sqs = SqsClient.builder()
                .region(Region.of(Util.REGION_FROM_EKS))
                .credentialsProvider(WebIdentityTokenFileCredentialsProvider.create())
                .build();
        }

        try {
            CreateQueueResponse createResult = sqs.createQueue(CreateQueueRequest.builder().queueName(QUEUE_NAME).build());
        } catch (SqsException e) {
            if (!e.awsErrorDetails().errorCode().equals("QueueAlreadyExists")) {
                throw e;
            }
        }
    }

    public void sendMsg() {
        String queueUrl = sqs.getQueueUrl(GetQueueUrlRequest.builder().queueName(QUEUE_NAME).build()).queueUrl();

        SendMessageRequest sendMsgRequest = SendMessageRequest.builder()
            .queueUrl(queueUrl)
            .messageBody("hello world")
            .delaySeconds(5)
            .build();
        sqs.sendMessage(sendMsgRequest);

        PurgeQueueRequest purgeReq = PurgeQueueRequest.builder().queueUrl(queueUrl).build();
        try {
            sqs.purgeQueue(purgeReq);
        } catch (SqsException e) {
            System.out.println(e.awsErrorDetails().errorMessage());
            throw e;
        }
    }

}
