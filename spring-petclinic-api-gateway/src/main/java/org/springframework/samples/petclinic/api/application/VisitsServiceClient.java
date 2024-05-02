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

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.samples.petclinic.api.dto.VisitDetails;
import org.springframework.samples.petclinic.api.dto.Visits;
import org.springframework.samples.petclinic.api.utils.WellKnownAttributes;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

import java.util.List;

import static java.util.stream.Collectors.joining;

/**
 * @author Maciej Szarlinski
 */
@Component
@RequiredArgsConstructor
public class VisitsServiceClient {

    // Could be changed for testing purpose
    private String hostname = "http://visits-service/";

    private final WebClient.Builder webClientBuilder;

    @WithSpan
    public Mono<Visits> getVisitsForPets(final List<Integer> petIds) {
        // Span.current().setAttribute(WellKnownAttributes.REMOTE_APPLICATION, "visits-service");
        // Span.current().setAttribute(WellKnownAttributes.REMOTE_OPERATION, "/pets/visits");
        return webClientBuilder.build()
            .get()
            .uri(hostname + "pets/visits?petId={petId}", joinIds(petIds))
            .retrieve()
            .bodyToMono(Visits.class);

    }

    @WithSpan
    public Mono<Visits> getVisitsForOwnersPets(final int ownerId, final int petId) {
        // Span.current().setAttribute(WellKnownAttributes.REMOTE_APPLICATION, "visits-service");
        // Span.current().setAttribute(WellKnownAttributes.REMOTE_OPERATION, "/owners/*/pets/{petId}/visits");
        return webClientBuilder.build()
            .get()
            .uri(hostname + "owners/{ownerId}/pets/{petId}/visits", ownerId, petId)
            .retrieve()
            .bodyToMono(Visits.class);

    }

    @WithSpan
    public Mono<String> addVisitForOwnersPets(final int ownerId, final int petId, final VisitDetails visitDetails) {
        // Span.current().setAttribute(WellKnownAttributes.REMOTE_APPLICATION, "visits-service");
        // Span.current().setAttribute(WellKnownAttributes.REMOTE_OPERATION, "/owners/*/pets/{petId}/visits");
        return webClientBuilder.build()
            .post()
            .uri(hostname + "owners/{ownerId}/pets/{petId}/visits", ownerId, petId)
            .body(Mono.just(visitDetails), VisitDetails.class)
            .retrieve()
            .bodyToMono(String.class)
                .onErrorResume(WebClientResponseException.class,
                    ex -> {
                        if (ex.getRawStatusCode() == 400) {
                            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getResponseBodyAsString()));
                        } else {
                            return Mono.error(ex);
                        }
                    });
    }

    private String joinIds(List<Integer> petIds) {
        return petIds.stream().map(Object::toString).collect(joining(","));
    }

    void setHostname(String hostname) {
        this.hostname = hostname;
    }
}
