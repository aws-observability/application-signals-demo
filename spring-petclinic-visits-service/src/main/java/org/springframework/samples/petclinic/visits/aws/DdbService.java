// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.visits.aws;

import lombok.Value;
import lombok.extern.slf4j.Slf4j;

import org.springframework.samples.petclinic.visits.Util;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSortKey;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;
import software.amazon.awssdk.auth.credentials.WebIdentityTokenFileCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.core.retry.RetryPolicy;


import java.util.HashMap;
import java.util.Map;
import java.time.Instant;

@Slf4j
@Component
public class DdbService {

    DynamoDbTable<MyItem> table;

    public DdbService() {
        RetryPolicy dynamoDbRetryPolicy = RetryPolicy.builder()
            .numRetries(1)
            .build();
        ClientOverrideConfiguration clientOverrideConfiguration = ClientOverrideConfiguration.builder()
            .retryPolicy(dynamoDbRetryPolicy).build();


        DynamoDbClient dynamoDbClient = null;

        // AWS web identity is set for EKS clusters, if these are not set then use default credentials
        if (System.getenv("AWS_WEB_IDENTITY_TOKEN_FILE") == null && System.getProperty("aws.webIdentityTokenFile") == null) {
            dynamoDbClient = DynamoDbClient.builder()
                .region(Region.of(Util.REGION_FROM_EC2))
                .overrideConfiguration(clientOverrideConfiguration)
                .build();
        }
        else {
            dynamoDbClient = DynamoDbClient.builder()
                .region(Region.of(Util.REGION_FROM_EKS))
                .credentialsProvider(WebIdentityTokenFileCredentialsProvider.create())
                .overrideConfiguration(clientOverrideConfiguration)
                .build();
        }

        String tableName = "apm_test";
        try {
            // Try to describe the table
            dynamoDbClient.describeTable(DescribeTableRequest.builder().tableName(tableName).build());
            log.info("Table " + tableName + " already exists");
        } catch (ResourceNotFoundException e) {
            CreateTableRequest request = CreateTableRequest.builder()
                .tableName(tableName)
                .keySchema(KeySchemaElement.builder()
                    .attributeName("id")
                    .keyType(KeyType.HASH)
                    .build())
                .attributeDefinitions(AttributeDefinition.builder()
                    .attributeName("id")
                    .attributeType(ScalarAttributeType.S)
                    .build())
                .provisionedThroughput(ProvisionedThroughput.builder()
                    .readCapacityUnits(1L)
                    .writeCapacityUnits(1L)
                    .build())
                .build();

            try {
                dynamoDbClient.createTable(request);
            } catch (DynamoDbException ex) {
                System.err.println(ex.getMessage());
                throw ex;
            }
        }

        DynamoDbEnhancedClient enhancedClient = DynamoDbEnhancedClient.builder().dynamoDbClient(dynamoDbClient).build();
        // Map Table Using Bean
        table = enhancedClient.table("apm_test", TableSchema.fromBean(MyItem.class));
    }

    public void putItems() {
        try {
            for (int i = 0; i < 1; i++) {
                String timestamp = Instant.now().toString();
                // Save the item
                MyItem item = new MyItem.Builder(timestamp).withSomeData("This is some data").build();
                table.putItem(item);
            }
        } catch (Exception e){
            handleCommonErrors(e);
        }
    }

    @DynamoDbBean
    public static class MyItem {
        private String id;
        private String someData;

        public MyItem() {}

        @DynamoDbPartitionKey
        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getSomeData() {
            return someData;
        }

        public void setSomeData(String someData) {
            this.someData = someData;
        }

        // Static Builder Class
        public static class Builder {
            private String id;
            private String someData;

            public Builder(String id) {
                this.id = id;
            }

            public Builder withSomeData(String someData) {
                this.someData = someData;
                return this;
            }

            public MyItem build() {
                MyItem item = new MyItem();
                item.id = id;
                item.someData = someData;
                return item;
            }
        }
    }



    // Exception Helper Method
    private static void handleCommonErrors(Exception exception) {
        try {
            throw exception;
        } catch (InternalServerErrorException isee) {
            log.info("Internal Server Error, generally safe to retry with exponential back-off. Error: " + isee.getMessage());
            throw isee;
        } catch (RequestLimitExceededException rlee) {
            log.info("Throughput exceeds the current throughput limit for your account, increase account level throughput before " +
                "retrying. Error: " + rlee.getMessage());
            throw rlee;
        } catch (ProvisionedThroughputExceededException ptee) {
            log.info("Request rate is too high. If you're using a custom retry strategy make sure to retry with exponential back-off. " +
                "Otherwise consider reducing frequency of requests or increasing provisioned capacity for your table or secondary index. Error: " +
                ptee.getMessage());
            throw ptee;
        } catch (ResourceNotFoundException rnfe) {
            log.info("One of the tables was not found, verify table exists before retrying. Error: " + rnfe.getMessage());
            throw rnfe;
        } catch (Exception e) {
            log.error("An exception occurred, investigate and configure retry strategy. Error: ", e);
            throw new RuntimeException(e);
        }
    }
}
