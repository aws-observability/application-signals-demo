// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.api.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Data
public class VetDetails {

    private Integer id;

    private String firstName;

    private String lastName;

    private Set<SpecialtyDetails> specialties;

    private final List<PetDetails> pets = new ArrayList<>();
}
