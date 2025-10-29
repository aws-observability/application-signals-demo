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
import software.amazon.awssdk.services.sqs.model.SendMessageRequest;
import software.amazon.awssdk.services.sqs.model.SqsException;

import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class SqsService {
    private static final String QUEUE_NAME = "apm_test";
    final SqsClient sqs;
    private String queueUrl;

    public SqsService() {
        // AWS web identity is set for EKS clusters, if these are not set then use default credentials
        if (System.getenv("REGION_FROM_ECS") != null) {
            String regionName = System.getenv("REGION_FROM_ECS");
            sqs = SqsClient.builder()
                .region(Region.of(regionName))
                .build();
        }
        else if (System.getenv("AWS_WEB_IDENTITY_TOKEN_FILE") == null && System.getProperty("aws.webIdentityTokenFile") == null) {
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
            log.info("SQS queue created or already exists: {}", QUEUE_NAME);
        } catch (SqsException e) {
            if (!e.awsErrorDetails().errorCode().equals("QueueAlreadyExists")) {
                log.error("Failed to create SQS queue: {}", e.awsErrorDetails().errorMessage());
                throw e;
            }
        }

        // Cache the queue URL to avoid repeated lookups
        try {
            this.queueUrl = sqs.getQueueUrl(GetQueueUrlRequest.builder().queueName(QUEUE_NAME).build()).queueUrl();
            log.info("SQS queue URL cached: {}", this.queueUrl);
        } catch (SqsException e) {
            log.error("Failed to get SQS queue URL: {}", e.awsErrorDetails().errorMessage());
            throw e;
        }
    }

    public void sendMsg() {
        try {
            SendMessageRequest sendMsgRequest = SendMessageRequest.builder()
                .queueUrl(queueUrl)
                .messageBody("hello world")
                .delaySeconds(5)
                .build();
            
            sqs.sendMessage(sendMsgRequest);
            log.debug("Message sent successfully to SQS queue: {}", QUEUE_NAME);
            
            // REMOVED: PurgeQueue operation that was causing "Only one PurgeQueue operation allowed every 60 seconds" errors
            // The purgeQueue operation is not necessary for normal message processing and was causing availability issues
            
        } catch (SqsException e) {
            log.error("Failed to send message to SQS queue: {}", e.awsErrorDetails().errorMessage());
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error while sending SQS message", e);
            throw new RuntimeException("Failed to send SQS message", e);
        }
    }
}