// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.api.application;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import lombok.RequiredArgsConstructor;
import org.springframework.samples.petclinic.api.dto.VetDetails;
import org.springframework.samples.petclinic.api.utils.WellKnownAttributes;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

@Component
@RequiredArgsConstructor
public class VetsServiceClient {

    private final WebClient.Builder webClientBuilder;

    @WithSpan
    public Flux<VetDetails> getVets() {
        return webClientBuilder.build().get()
            .uri("lb://vets-service/vets")
            .retrieve()
            .bodyToFlux(VetDetails.class);
    }
}
