/*
 * Copyright 2002-2021 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Modifications Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package org.springframework.samples.petclinic.api.application;

import io.opentelemetry.instrumentation.annotations.SpanAttribute;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.samples.petclinic.api.dto.*;
import org.springframework.samples.petclinic.api.utils.WellKnownAttributes;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import org.springframework.web.server.ResponseStatusException;

/**
 * @author Maciej Szarlinski
 */
@Component
@RequiredArgsConstructor
public class CustomersServiceClient {

    private final WebClient.Builder webClientBuilder;

    public Flux<OwnerDetails> getOwners() {
        return fluxQuery(OwnerDetails.class, "customers-service", "/owners");
    }

    @WithSpan
    public Mono<OwnerDetails> getOwner(final int ownerId) {
        return webClientBuilder.build().get()
            .uri("http://customers-service/owners/{ownerId}", ownerId)
            .retrieve()
            .onStatus(
                HttpStatus.BAD_REQUEST::equals,
                response -> response.bodyToMono(String.class).map(IllegalArgumentException::new))
            .bodyToMono(OwnerDetails.class);
    }

//    @WithSpan
    public Mono<Void> updateOwner(final int ownerId, final OwnerRequest ownerRequest) {
        return webClientBuilder.build().put()
            .uri("http://customers-service/owners/{ownerId}", ownerId)
            .body(Mono.just(ownerRequest), OwnerRequest.class)
            .retrieve()
            .bodyToMono(Void.class);
    }

    @WithSpan
    public Mono<Void> addOwner(final OwnerRequest ownerRequest) {
        return webClientBuilder.build().post()
            .uri("http://customers-service/owners")
            .body(Mono.just(ownerRequest), OwnerRequest.class)
            .retrieve()
            .bodyToMono(Void.class);
    }

    public Flux<PetType> getPetTypes() {
        return fluxQuery(PetType.class, "customers-service", "/petTypes");
    }

    @WithSpan
    public Mono<PetFull> getPet(final int ownerId, final int petId) {
        return webClientBuilder.build().get()
            .uri("http://customers-service/owners/{ownerId}/pets/{petId}", ownerId, petId)
            .retrieve()
            .bodyToMono(PetFull.class);
    }

    @WithSpan
    public Mono<Void> updatePet(final int ownerId, final int petId, final PetRequest petRequest) {
        return webClientBuilder.build().put()
            .uri("http://customers-service/owners/{ownerId}/pets/{petId}", ownerId, petId)
            .body(Mono.just(petRequest), PetRequest.class)
            .retrieve()
            .bodyToMono(Void.class);
    }

    @WithSpan
    public Mono<PetFull> addPet(final int ownerId, final PetRequest petRequest) {
        return webClientBuilder.build().post()
            .uri("http://customers-service/owners/{ownerId}/pets", ownerId)
            .body(Mono.just(petRequest), PetRequest.class)
            .retrieve()
            .bodyToMono(PetFull.class);
    }

    @WithSpan
    private <T> Flux<T> fluxQuery(Class<T> clazz,
                                  @SpanAttribute(WellKnownAttributes.REMOTE_APPLICATION) String host,
                                  @SpanAttribute(WellKnownAttributes.REMOTE_OPERATION) String path,
                                  Object... params) {
        return webClientBuilder.build().get().uri(String.format("http://%s%s", host, path), params).retrieve().bodyToFlux(clazz);
    }
}
