/*
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 *
 * Modifications Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package org.springframework.samples.petclinic.vets.aws;

import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.WebIdentityTokenFileCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Component
public class S3Service {
  private S3Client s3Client;
  private static final String ENV_TRACE_BUCKET = "TRACE_DATA_BUCKET";
  private static final String ENV_TRACE_S3_KEY = "TRACE_DATA_S3_KEY";

  public S3Service(){

      // AWS web identity is set for EKS clusters, if these are not set then use default credentials
      if (System.getenv("AWS_WEB_IDENTITY_TOKEN_FILE") == null && System.getProperty("aws.webIdentityTokenFile") == null) {
          s3Client = S3Client.builder()
              .region(Region.US_EAST_1)
              .build();
      }
      else {
          s3Client = S3Client.builder()
              .region(Region.US_EAST_1)
              .credentialsProvider(WebIdentityTokenFileCredentialsProvider.create())
              .build();
      }
  }

  public void listBuckets() {
      s3Client.listBuckets();
  }
}

