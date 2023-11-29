// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.api;

import io.opentelemetry.instrumentation.annotations.SpanAttribute;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.samples.petclinic.api.TracingRouteGatewayFilterFactory.Config;
import org.springframework.samples.petclinic.api.utils.WellKnownAttributes;
import org.springframework.stereotype.Component;

import java.net.URI;

import static org.springframework.cloud.gateway.support.ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR;
import static org.springframework.cloud.gateway.support.ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR;

@Component
public class TracingRouteGatewayFilterFactory extends AbstractGatewayFilterFactory<Config> {
    public TracingRouteGatewayFilterFactory() {
        super(Config.class);
    }

    @Override
    public String name() {
        return "Tracing";
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            Route route = exchange.getAttribute(GATEWAY_ROUTE_ATTR);
            URI uri = exchange.getAttribute(GATEWAY_REQUEST_URL_ATTR);
            if (uri == null) {
                uri = exchange.getRequest().getURI();
            }
            traceRouteInfo(route.getId(), uri.getPath());
            return chain.filter(exchange);
        };
    }

    @WithSpan(value = "RecordRoute")
    public void traceRouteInfo(@SpanAttribute(WellKnownAttributes.REMOTE_APPLICATION) String application,
                               @SpanAttribute(WellKnownAttributes.REMOTE_OPERATION) String operation) {

    }

    public static class Config {
    }
}
