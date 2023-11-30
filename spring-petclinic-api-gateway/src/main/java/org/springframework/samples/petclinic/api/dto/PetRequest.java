// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.api.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import javax.validation.constraints.Size;
import java.util.Date;

@Data
public class PetRequest {

    private int id;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date birthDate;

    @Size(min = 1)
    private String name;

    private int typeId;
}
