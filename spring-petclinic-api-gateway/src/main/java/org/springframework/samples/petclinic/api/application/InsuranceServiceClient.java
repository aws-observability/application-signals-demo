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

import io.opentelemetry.instrumentation.annotations.WithSpan;
import lombok.RequiredArgsConstructor;
import org.springframework.samples.petclinic.api.dto.InsuranceDetail;
import org.springframework.samples.petclinic.api.dto.PetInsurance;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * @author Maciej Szarlinski
 */
@Component
@RequiredArgsConstructor
public class InsuranceServiceClient {

    private final WebClient.Builder webClientBuilder;

    public Flux<InsuranceDetail> getInsurances() {
        // return Flux.empty().cast(InsuranceDetail.class);
        return webClientBuilder.build().get()
            // .uri("lb://insurance-service/insurances")
            .uri("http://insurance-service/insurances/")
            .retrieve()
            .bodyToFlux(InsuranceDetail.class);
    }

    @WithSpan
    public Mono<Void> addPetInsurance(final PetInsurance petInsurance) {
        return webClientBuilder.build()
                .post()
                .uri("http://insurance-service/pet-insurances/")
                .body(Mono.just(petInsurance), PetInsurance.class)
                .retrieve()
                .bodyToMono(Void.class);
    }
    @WithSpan
    public Mono<PetInsurance> updatePetInsurance(final int petId, final PetInsurance petInsurance) {
        return webClientBuilder.build()
                .put()
                .uri("http://insurance-service/pet-insurances/" + petId + "/")
                .body(Mono.just(petInsurance), PetInsurance.class)
                .retrieve()
                .bodyToMono(PetInsurance.class);
    }
    @WithSpan
    public Mono<PetInsurance> getPetInsurance(final int petId) {
        return webClientBuilder.build()
                .get()
                .uri("http://insurance-service/pet-insurances/" + petId + "/")
                .retrieve()
                .bodyToMono(PetInsurance.class);
    }
}
