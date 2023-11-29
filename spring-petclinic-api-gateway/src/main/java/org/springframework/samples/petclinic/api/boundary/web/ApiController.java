// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.api.boundary.web;

import lombok.RequiredArgsConstructor;
import org.springframework.samples.petclinic.api.application.CustomersServiceClient;
import org.springframework.samples.petclinic.api.application.VetsServiceClient;
import org.springframework.samples.petclinic.api.application.VisitsServiceClient;
import org.springframework.samples.petclinic.api.dto.OwnerDetails;
import org.springframework.samples.petclinic.api.dto.OwnerRequest;
import org.springframework.samples.petclinic.api.dto.PetDetails;
import org.springframework.samples.petclinic.api.dto.PetRequest;
import org.springframework.samples.petclinic.api.dto.PetType;
import org.springframework.samples.petclinic.api.dto.VetDetails;
import org.springframework.samples.petclinic.api.dto.VisitDetails;
import org.springframework.samples.petclinic.api.dto.Visits;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/")
public class ApiController {

    private final CustomersServiceClient customersServiceClient;
    private final VetsServiceClient vetsServiceClient;
    private final VisitsServiceClient visitsServiceClient;

    @GetMapping(value = "customer/owners")
    public Flux<OwnerDetails> getOwners() {
        return customersServiceClient.getOwners();
    }

    @GetMapping(value = "customer/owners/{ownerId}")
    public Mono<OwnerDetails> getOwner(final @PathVariable int ownerId) {
        return customersServiceClient.getOwner(ownerId);
    }

    @PutMapping(value = "customer/owners/{ownerId}")
    public Mono<Void> getOwner(final @PathVariable int ownerId, @RequestBody OwnerRequest ownerRequest) {
        return customersServiceClient.updateOwner(ownerId, ownerRequest);
    }

    @PostMapping(value = "customer/owners")
    public Mono<Void> addOwner(@RequestBody OwnerRequest ownerRequest) {
        return customersServiceClient.addOwner(ownerRequest);
    }

    @GetMapping(value = "customer/petTypes")
    public Flux<PetType> getPetTypes() {
        return customersServiceClient.getPetTypes();
    }

    @GetMapping(value = "customer/owners/{ownerId}/pets/{petId}")
    public Mono<PetDetails> getPetTypes(final @PathVariable int ownerId, final @PathVariable int petId) {
        return customersServiceClient.getPet(ownerId, petId);
    }

    @PutMapping("customer/owners/{ownerId}/pets/{petId}")
    public Mono<Void> updatePet(final @PathVariable int ownerId, final @PathVariable int petId, @RequestBody PetRequest petRequest) {
        return customersServiceClient.updatePet(ownerId, petId, petRequest);
    }

    @PostMapping("customer/owners/{ownerId}/pets")
    public Mono<Void> addPet(final @PathVariable int ownerId, @RequestBody PetRequest petRequest) {
        return customersServiceClient.addPet(ownerId, petRequest);
    }

    @GetMapping(value = "vet/vets")
    public Flux<VetDetails> getVets() {
        return vetsServiceClient.getVets();
    }

    @GetMapping(value = "visit/owners/{ownerId}/pets/{petId}/visits")
    public Mono<Visits> getVisits(final @PathVariable int ownerId, final @PathVariable int petId) {
        return visitsServiceClient.getVisitsForOwnersPets(ownerId, petId);
    }

    @PostMapping(value = "visit/owners/{ownerId}/pets/{petId}/visits")
    public Mono<Void> addVisit(final @PathVariable int ownerId, final @PathVariable int petId, final @RequestBody VisitDetails visitDetails) {
        return visitsServiceClient.addVisitForOwnersPets(ownerId, petId, visitDetails);
    }
}
