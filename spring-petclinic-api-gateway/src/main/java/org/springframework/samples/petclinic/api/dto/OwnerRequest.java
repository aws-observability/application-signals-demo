// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.api.dto;

import lombok.Data;

@Data
public class OwnerRequest {

    private String firstName;

    private String lastName;

    private String address;

    private String city;

    private String telephone;
}
