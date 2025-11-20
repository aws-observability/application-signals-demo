// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.api.boundary.web;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.samples.petclinic.api.application.*;
import org.springframework.samples.petclinic.api.dto.*;
import org.springframework.samples.petclinic.api.utils.WellKnownAttributes;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.opentelemetry.instrumentation.annotations.SpanAttribute;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import io.opentelemetry.api.trace.Span;

@RestController
@RequiredArgsConstructor
@Slf4j
@RequestMapping("/api/")
public class ApiController {

    private final CustomersServiceClient customersServiceClient;
    private final VetsServiceClient vetsServiceClient;
    private final VisitsServiceClient visitsServiceClient;
    private final InsuranceServiceClient insuranceServiceClient;
    private final BillingServiceClient billingServiceClient;
    private final PaymentClient paymentClient;
    private final NutritionServiceClient nutritionServiceClient;

    @GetMapping(value = "customer/owners")
    public Flux<OwnerDetails> getOwners() {
        return customersServiceClient.getOwners();
    }

    @GetMapping(value = "customer/owners/{ownerId}")
    public Mono<OwnerDetails> getOwner(final @PathVariable int ownerId) {
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
        return customersServiceClient.getOwner(ownerId);
    }

    @PutMapping(value = "customer/owners/{ownerId}")
    public Mono<Void> getOwner(final @PathVariable int ownerId, @RequestBody OwnerRequest ownerRequest) {
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
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
    public Mono<PetFull> getPetTypes(final @PathVariable int ownerId, final @PathVariable int petId) {
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
        Span.current().setAttribute(WellKnownAttributes.PET_ID, petId);
        return customersServiceClient.getPet(ownerId, petId);
    }

    @GetMapping(value = "customer/diagnose/owners/{ownerId}/pets/{petId}")
    public Mono<Void> diagnosePet(final @PathVariable int ownerId, final @PathVariable int petId) {
        log.info("DEBUG: Inside the diagnose API - diagnosePet");
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
        Span.current().setAttribute(WellKnownAttributes.PET_ID, petId);
        return customersServiceClient.diagnosePet(ownerId, petId);
    }

    @PutMapping("customer/owners/{ownerId}/pets/{petId}")
    public Mono<Void> updatePet(final @PathVariable int ownerId, final @PathVariable int petId,
            @RequestBody PetRequest petRequest) {
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
        Span.current().setAttribute(WellKnownAttributes.PET_ID, petId);
        return customersServiceClient.updatePet(ownerId, petId, petRequest);
    }

    @PostMapping("customer/owners/{ownerId}/pets")
    public Mono<PetFull> addPet(final @PathVariable int ownerId, @RequestBody PetRequest petRequest) {
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
        return customersServiceClient.addPet(ownerId, petRequest);
    }

    @GetMapping(value = "vet/vets")
    public Flux<VetDetails> getVets() {
        return vetsServiceClient.getVets();
    }

    @GetMapping(value = "visit/owners/{ownerId}/pets/{petId}/visits")
    public Mono<Visits> getVisits(final @PathVariable int ownerId, final @PathVariable int petId) {
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
        Span.current().setAttribute(WellKnownAttributes.PET_ID, petId);
        return visitsServiceClient.getVisitsForOwnersPets(ownerId, petId);
    }

    @PostMapping(value = "visit/owners/{ownerId}/pets/{petId}/visits")
    public Mono<String> addVisit(final @PathVariable int ownerId, final @PathVariable int petId,
            final @RequestBody VisitDetails visitDetails) {
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
        Span.current().setAttribute(WellKnownAttributes.PET_ID, petId);
        return visitsServiceClient.addVisitForOwnersPets(ownerId, petId, visitDetails);
    }

    @GetMapping(value = "insurance/insurances")
    public Flux<InsuranceDetail> getInsurance() {
        return insuranceServiceClient.getInsurances();
    }

    @GetMapping(value = "billing/billings")
    public Flux<BillingDetail> getBillings() {
        return billingServiceClient.getBillings();
    }

    @GetMapping(value = "billing/summary")
    public Mono<Object> getBillingSummary() {
        return billingServiceClient.getBillingSummary();
    }

    @PostMapping(value = "insurance/pet-insurances")
    public Mono<Void> addPetInsurance(final @RequestBody PetInsurance petInsurance) {
        System.out.println(petInsurance.toString());
        return insuranceServiceClient.addPetInsurance(petInsurance);
    }

    @PutMapping(value = "insurance/pet-insurances/{petId}")
    public Mono<PetInsurance> updatePetInsurance(final @PathVariable int petId,
            final @RequestBody PetInsurance petInsurance) {
        Span.current().setAttribute(WellKnownAttributes.PET_ID, petId);
        return insuranceServiceClient.updatePetInsurance(petId, petInsurance);
    }

    @GetMapping(value = "insurance/pet-insurances/{petId}")
    public Mono<PetInsurance> getPetInsurance(final @PathVariable int petId) {
        Span.current().setAttribute(WellKnownAttributes.PET_ID, petId);
        return insuranceServiceClient.getPetInsurance(petId);
    }

    @GetMapping(value = "payments/owners/{ownerId}/pets/{petId}")
    public Flux<PaymentDetail> getPayments(final @PathVariable int ownerId, final @PathVariable int petId) {
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
        Span.current().setAttribute(WellKnownAttributes.PET_ID, petId);
        return paymentClient.getPayments(ownerId, petId);
    }

    @GetMapping(value = "payments/owners/{ownerId}/pets/{petId}/{paymentId}")
    public Mono<PaymentDetail> getPaymentById(final @PathVariable int ownerId, final @PathVariable int petId,
            final @PathVariable String paymentId) {
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
        Span.current().setAttribute(WellKnownAttributes.PET_ID, petId);
        return paymentClient.getPaymentById(ownerId, petId, paymentId);
    }

    @PostMapping(value = "payments/owners/{ownerId}/pets/{petId}")
    public Mono<PaymentDetail> addPayment(final @PathVariable int ownerId, final @PathVariable int petId,
            final @RequestBody PaymentAdd paymentAdd) {
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
        Span.current().setAttribute(WellKnownAttributes.PET_ID, petId);
        return paymentClient.addPayment(ownerId, petId, paymentAdd);
    }

    @DeleteMapping(value = "payments/clean-db")
    public Mono<PaymentDetail> cleanPaymentTable() {
        return paymentClient.cleanPaymentTable();
    }

    @GetMapping(value = "nutrition/facts/{petType}")
    public Mono<PetNutrition> getNutrition(final @PathVariable String petType) {
        return nutritionServiceClient.getPetNutrition(petType);
    }

}
