// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.customers;

import com.amazonaws.util.EC2MetadataUtils;
import io.opentelemetry.api.trace.Span;

public class Util {
    public static final String REGION_FROM_EKS = System.getProperty("AWS_REGION") != null ? System.getProperty("AWS_REGION") 
        : System.getenv("AWS_REGION") != null ? System.getenv("AWS_REGION") 
        : "us-west-2";

    public static final String REGION_FROM_EC2 = EC2MetadataUtils.getEC2InstanceRegion() != null ? EC2MetadataUtils.getEC2InstanceRegion() : "us-west-2";

    /**
     * Adds code location attributes to the current span
     * @param className The class name where the span is created
     * @param methodName The method name where the span is created
     */
    public static void addCodeLocationAttributes(String className, String methodName) {
        Span currentSpan = Span.current();
        if (currentSpan != null) {
            // Get the current stack trace to find the calling location
            StackTraceElement[] stackTrace = Thread.currentThread().getStackTrace();
            
            // Find the caller (skip getStackTrace, addCodeLocationAttributes, and the actual calling method)
            StackTraceElement caller = null;
            for (int i = 2; i < stackTrace.length; i++) {
                if (stackTrace[i].getClassName().equals(className)) {
                    caller = stackTrace[i];
                    break;
                }
            }
            
            if (caller != null) {
                currentSpan.setAttribute(WellKnownAttributes.CODE_FILENAME, caller.getFileName());
                currentSpan.setAttribute(WellKnownAttributes.CODE_LINENO, caller.getLineNumber());
                currentSpan.setAttribute(WellKnownAttributes.CODE_NAMESPACE, className);
                currentSpan.setAttribute(WellKnownAttributes.CODE_FUNCTION, methodName);
            } else {
                // Fallback if we can't find the exact caller
                currentSpan.setAttribute(WellKnownAttributes.CODE_NAMESPACE, className);
                currentSpan.setAttribute(WellKnownAttributes.CODE_FUNCTION, methodName);
            }
        }
    }

    public static class WellKnownAttributes {
        public static final String OWNER_ID = "owner.id";
        public static final String PET_ID = "pet.id";
        public static final String ORDER_ID = "order.id";
        
        // Code location attributes
        public static final String CODE_FILENAME = "code.filename";
        public static final String CODE_LINENO = "code.lineno";
        public static final String CODE_NAMESPACE = "code.namespace";
        public static final String CODE_FUNCTION = "code.function";
    }
}
