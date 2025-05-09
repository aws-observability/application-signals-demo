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

import org.springframework.stereotype.Component;
import lombok.RequiredArgsConstructor;

import org.springframework.samples.petclinic.api.dto.PaymentAdd;
import org.springframework.samples.petclinic.api.dto.PaymentDetail;
import org.springframework.samples.petclinic.api.utils.WellKnownAttributes;
import org.springframework.web.reactive.function.client.WebClient;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.instrumentation.annotations.SpanAttribute;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
public class PaymentClient {
    private final WebClient.Builder webClientBuilder;

    @WithSpan
    public Flux<PaymentDetail> getPayments(@SpanAttribute(WellKnownAttributes.OWNER_ID) final int ownerId, @SpanAttribute(WellKnownAttributes.PET_ID) final int petId) {
        Span.current().setAttribute("aws.local.service", "pet-clinic-frontend-java");
        return webClientBuilder.build().get()
                .uri("http://payment-service/owners/{ownerId}/pets/{petId}/payments", ownerId, petId)
                .retrieve()
                .bodyToFlux(PaymentDetail.class);
    }

    @WithSpan
    public Mono<PaymentDetail> getPaymentById(@SpanAttribute(WellKnownAttributes.OWNER_ID) final int ownerId, @SpanAttribute(WellKnownAttributes.PET_ID) final int petId, @SpanAttribute(WellKnownAttributes.ORDER_ID) final String paymentId) {
        Span.current().setAttribute("aws.local.service", "pet-clinic-frontend-java");
        return webClientBuilder.build().get()
                .uri("http://payment-service/owners/{ownerId}/pets/{petId}/payments/{paymentId}", ownerId, petId,
                        paymentId)
                .retrieve()
                .bodyToMono(PaymentDetail.class);
    }

    @WithSpan
    public Mono<PaymentDetail> addPayment(@SpanAttribute(WellKnownAttributes.OWNER_ID) final int ownerId, @SpanAttribute(WellKnownAttributes.PET_ID) final int petId, @SpanAttribute(WellKnownAttributes.ORDER_ID) final PaymentAdd paymentAdd) {
        Span.current().setAttribute("aws.local.service", "pet-clinic-frontend-java");
        return webClientBuilder.build().post()
                .uri("http://payment-service/owners/{ownerId}/pets/{petId}/payments", ownerId, petId)
                .body(Mono.just(paymentAdd), PaymentAdd.class)
                .retrieve()
                .bodyToMono(PaymentDetail.class);
    }

    public Mono<PaymentDetail> cleanPaymentTable() {
        return webClientBuilder.build().delete()
                .uri("http://payment-service/clean-db")
                .retrieve()
                .bodyToMono(PaymentDetail.class);
    }
}
