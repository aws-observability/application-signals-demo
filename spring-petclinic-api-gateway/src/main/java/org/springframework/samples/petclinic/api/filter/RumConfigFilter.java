package org.springframework.samples.petclinic.api.filter;

import org.reactivestreams.Publisher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.http.server.reactive.ServerHttpResponseDecorator;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

/**
 * Filter to inject AWS RUM configuration values into the index.html file.
 * This filter intercepts requests to the root path or index.html and replaces
 * placeholder values with actual configuration from application.yml.
 */
@Component
public class RumConfigFilter implements WebFilter {

    @Value("${aws.rum.monitor.id}")
    private String monitorId;

    @Value("${aws.rum.monitor.identity-pool-id}")
    private String identityPoolId;
    
    @Value("${aws.region}")
    private String region;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        // Only process index.html or root path
        if ("/".equals(path) || "/index.html".equals(path)) {
            ServerHttpResponse originalResponse = exchange.getResponse();
            
            // Create a response decorator to modify the response body
            ServerHttpResponseDecorator decoratedResponse = new ServerHttpResponseDecorator(originalResponse) {
                @Override
                public Mono<Void> writeWith(Publisher<? extends DataBuffer> body) {
                    if (body instanceof Flux) {
                        Flux<? extends DataBuffer> fluxBody = (Flux<? extends DataBuffer>) body;
                        
                        return super.writeWith(fluxBody.buffer().map(dataBuffers -> {
                            // Combine all data buffers
                            StringBuilder builder = new StringBuilder();
                            dataBuffers.forEach(buffer -> {
                                byte[] bytes = new byte[buffer.readableByteCount()];
                                buffer.read(bytes);
                                builder.append(new String(bytes, StandardCharsets.UTF_8));
                            });
                            
                            // Replace placeholders with actual configuration values
                            String content = builder.toString();
                            content = content.replace("{{AWS_RUM_MONITOR_ID}}", monitorId);
                            content = content.replace("{{AWS_RUM_IDENTITY_POOL_ID}}", identityPoolId);
                            content = content.replace("{{REGION}}", region);
                            
                            // Create a new data buffer with modified content
                            byte[] modifiedBytes = content.getBytes(StandardCharsets.UTF_8);
                            DataBuffer modifiedBuffer = exchange.getResponse().bufferFactory().wrap(modifiedBytes);
                            
                            return modifiedBuffer;
                        }).flatMap(Flux::just));
                    }
                    
                    return super.writeWith(body);
                }
            };

            return chain.filter(exchange.mutate().response(decoratedResponse).build());
        }
        
        // For other paths, continue without modification
        return chain.filter(exchange);
    }
}
