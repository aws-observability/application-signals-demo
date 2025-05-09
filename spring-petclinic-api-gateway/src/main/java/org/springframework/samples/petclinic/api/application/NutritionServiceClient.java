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
import io.opentelemetry.api.trace.Span;
import lombok.RequiredArgsConstructor;

import org.springframework.samples.petclinic.api.dto.PetNutrition;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
public class NutritionServiceClient {

    private final WebClient.Builder webClientBuilder;

    @WithSpan
    public Mono<PetNutrition> getPetNutrition(final String petType) {
        Span.current().setAttribute("aws.local.service", "pet-clinic-frontend-java");
        return webClientBuilder.build()
                .get()
                .uri("http://nutrition-service/nutrition/" + petType + "/")
                .retrieve()
                .bodyToMono(PetNutrition.class);
    }
}
