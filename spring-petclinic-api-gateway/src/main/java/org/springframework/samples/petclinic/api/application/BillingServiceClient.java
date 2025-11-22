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
import org.springframework.samples.petclinic.api.dto.BillingDetail;
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
public class BillingServiceClient {

    private final WebClient.Builder webClientBuilder;

    public Flux<BillingDetail> getBillings() {
        // return Flux.empty().cast(InsuranceDetail.class);
        return webClientBuilder.build().get()
            .uri("http://billing-service/billings/")
            .retrieve()
            .bodyToFlux(BillingDetail.class);
    }

}
